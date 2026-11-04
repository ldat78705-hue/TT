// RESTORE hkd_thanhdat ONLY from full backup file
// DO NOT touch haimua
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, writeBatch, collection, getDocs, setDoc } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf-8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

const COL_NAME = 'center_hkd_thanhdat';
const BACKUP_FILE = 'C:\\Users\\Admin\\Desktop\\EduCenterPro_FULL_Backup_01-07_02-11-2026.json';

// Shard key logic — MUST match data.ts getShardKey
function getShardKey(item, collectionName) {
    try {
        if (['transactions', 'income', 'expenses'].includes(collectionName)) {
            if (item.date) {
                const match = item.date.match(/^(\d{4})-(\d{2})/);
                if (match) return `${collectionName}_${match[1]}_${match[2]}`;
            }
        } else if (collectionName === 'attendance') {
            if (item.date) {
                const match = item.date.match(/^(\d{4})-(\d{2})/);
                const classId = item.classId || 'unknown';
                if (match) return `attendance_${match[1]}_${match[2]}_${classId}`;
            }
        } else if (collectionName === 'invoices' && item.month) {
            const parts = item.month.split('-');
            if (parts.length === 2) return `invoices_${parts[0]}_${parts[1]}`;
        } else if (collectionName === 'payrolls' && item.year && item.month) {
            return `payrolls_${item.year}_${item.month.toString().padStart(2, '0')}`;
        }
    } catch (e) {}
    return collectionName;
}

async function restore() {
    console.log('Loading backup file...');
    const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf-8'));
    const hkd = backup.centers.hkd_thanhdat;
    
    if (!hkd) {
        console.error('FATAL: hkd_thanhdat not found in backup!');
        process.exit(1);
    }
    
    console.log('Backup date:', backup.backupDate);
    console.log('Students:', hkd.students.length);
    console.log('Classes:', hkd.classes.length);
    console.log('Teachers:', hkd.teachers.length);
    console.log('Attendance:', hkd.attendance.length);
    console.log('Invoices:', hkd.invoices.length);
    console.log('Transactions:', hkd.transactions.length);
    
    // Step 1: Delete ALL existing docs in center_hkd_thanhdat
    // EXCEPT _messageLog* and webhookLog* (SLL message history)
    console.log('\n=== Step 1: Deleting old docs (preserving messageLog/webhookLog) ===');
    const existingDocs = await getDocs(collection(db, COL_NAME));
    const PROTECTED = ['_messageLog', 'webhookLog'];
    
    // Firestore batch max 500 operations
    let deleteBatches = [];
    let batch = writeBatch(db);
    let count = 0;
    let deleteCount = 0;
    let skipCount = 0;
    
    existingDocs.forEach(d => {
        if (PROTECTED.some(p => d.id.startsWith(p))) {
            skipCount++;
            return;
        }
        batch.delete(doc(db, COL_NAME, d.id));
        count++;
        deleteCount++;
        if (count >= 450) {
            deleteBatches.push(batch);
            batch = writeBatch(db);
            count = 0;
        }
    });
    if (count > 0) deleteBatches.push(batch);
    
    for (const b of deleteBatches) await b.commit();
    console.log(`  Deleted ${deleteCount} docs, preserved ${skipCount} protected docs`);
    
    // Step 2: Write NON-SHARDED collections
    console.log('\n=== Step 2: Writing non-sharded collections ===');
    const NON_SHARDED = ['students', 'teachers', 'staff', 'classes', 'rooms', 'settings', 'announcements', 'progressReports', 'auditLogs'];
    
    batch = writeBatch(db);
    count = 0;
    
    for (const col of NON_SHARDED) {
        if (hkd[col] !== undefined) {
            batch.set(doc(db, COL_NAME, col), { data: hkd[col] });
            count++;
            console.log(`  ${col}: ${Array.isArray(hkd[col]) ? hkd[col].length + ' items' : 'object'}`);
        }
    }
    
    await batch.commit();
    console.log(`  Written ${count} non-sharded docs`);
    
    // Step 3: Write SHARDED collections
    console.log('\n=== Step 3: Writing sharded collections ===');
    const SHARDED = ['attendance', 'invoices', 'transactions', 'income', 'expenses', 'payrolls'];
    
    let totalShards = 0;
    
    for (const col of SHARDED) {
        const items = hkd[col];
        if (!Array.isArray(items) || items.length === 0) {
            // Write empty base key
            await setDoc(doc(db, COL_NAME, col), { data: [] });
            continue;
        }
        
        // Group by shard key
        const shards = {};
        for (const item of items) {
            const key = getShardKey(item, col);
            if (!shards[key]) shards[key] = [];
            shards[key].push(item);
        }
        
        // Also write empty base key (required by getSplitData)
        shards[col] = shards[col] || [];
        
        // Write shards in batches
        const shardKeys = Object.keys(shards);
        let shardBatch = writeBatch(db);
        let shardCount = 0;
        
        for (const key of shardKeys) {
            shardBatch.set(doc(db, COL_NAME, key), { data: shards[key] });
            shardCount++;
            totalShards++;
            if (shardCount >= 450) {
                await shardBatch.commit();
                shardBatch = writeBatch(db);
                shardCount = 0;
            }
        }
        if (shardCount > 0) await shardBatch.commit();
        
        console.log(`  ${col}: ${items.length} items → ${shardKeys.length} shards`);
    }
    
    // Step 4: Write _sync doc
    const newSyncId = Date.now().toString() + '_fullrestore_' + Math.random().toString(36).substring(2);
    await setDoc(doc(db, COL_NAME, '_sync'), { syncId: newSyncId, lastUpdatedAt: Date.now() });
    
    console.log(`\n✅ KHÔI PHỤC HOÀN TẤT!`);
    console.log(`  Students: ${hkd.students.length}`);
    console.log(`  Classes: ${hkd.classes.length} (${hkd.classes.map(c => c.name).join(', ')})`);
    console.log(`  Teachers: ${hkd.teachers.length}`);
    console.log(`  Attendance: ${hkd.attendance.length}`);
    console.log(`  Invoices: ${hkd.invoices.length}`);
    console.log(`  Transactions: ${hkd.transactions.length}`);
    console.log(`  Total shards written: ${totalShards}`);
    console.log(`\n  Center name: ${hkd.settings?.name || hkd.settings?.centerName}`);
    console.log(`\n  haimua: KHÔNG THAY ĐỔI ✅`);
    
    process.exit(0);
}

restore().catch(e => { console.error('FATAL:', e); process.exit(1); });
