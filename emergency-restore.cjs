// Restore: Merge backup students/teachers/classes with current Firebase sharded data
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, writeBatch, setDoc } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf-8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);
const COL_NAME = 'center_hkd_thanhdat';

async function restore() {
    // 1. Read backup from June 2026
    const backupFile = path.resolve(__dirname, 'EduCenterPro_Backup_2026-06-14.json');
    if (!fs.existsSync(backupFile)) {
        console.error('FATAL: Backup file not found!');
        process.exit(1);
    }
    const backup = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));
    
    console.log('=== BACKUP DATA (June 2026) ===');
    console.log(`  students: ${backup.students?.length || 0}`);
    console.log(`  teachers: ${backup.teachers?.length || 0}`);
    console.log(`  staff: ${backup.staff?.length || 0}`);
    console.log(`  classes: ${backup.classes?.length || 0}`);
    console.log(`  rooms: ${backup.rooms?.length || 0}`);
    console.log(`  settings.centerName: "${backup.settings?.centerName || backup.settings?.name || ''}"`);
    console.log(`  announcements: ${backup.announcements?.length || 0}`);
    console.log(`  progressReports: ${backup.progressReports?.length || 0}`);
    
    // 2. Read current Firebase data
    console.log('\n=== CURRENT FIREBASE DATA ===');
    const snapshot = await getDocs(collection(db, COL_NAME));
    const currentRaw = {};
    snapshot.forEach(d => { currentRaw[d.id] = d.data(); });
    
    // Collect all sharded data from current Firebase
    const currentAttendance = [];
    const currentInvoices = [];
    const currentTransactions = [];
    const currentIncome = [];
    const currentExpenses = [];
    const currentPayrolls = [];
    
    Object.keys(currentRaw).forEach(key => {
        const data = currentRaw[key]?.data;
        if (!Array.isArray(data)) return;
        if (key.startsWith('attendance')) currentAttendance.push(...data);
        else if (key.startsWith('invoices')) currentInvoices.push(...data);
        else if (key.startsWith('transactions')) currentTransactions.push(...data);
        else if (key.startsWith('income')) currentIncome.push(...data);
        else if (key.startsWith('expenses')) currentExpenses.push(...data);
        else if (key.startsWith('payrolls')) currentPayrolls.push(...data);
    });
    
    console.log(`  attendance (shards): ${currentAttendance.length}`);
    console.log(`  invoices (shards): ${currentInvoices.length}`);
    console.log(`  transactions (shards): ${currentTransactions.length}`);
    console.log(`  income (shards): ${currentIncome.length}`);
    console.log(`  expenses (shards): ${currentExpenses.length}`);
    console.log(`  payrolls (shards): ${currentPayrolls.length}`);
    
    // 3. Build merged data: backup NON_SHARDED + current SHARDED
    // Settings from current Firebase (keep bank info, admin password etc.)
    const currentSettings = currentRaw['settings']?.data || {};
    // Merge: use backup settings as base, overlay current financial settings
    const mergedSettings = {
        ...(backup.settings || {}),
        // Keep current bank/payment settings (might have been updated)
        bankBin: currentSettings.bankBin || backup.settings?.bankBin,
        bankAccountNumber: currentSettings.bankAccountNumber || backup.settings?.bankAccountNumber,
        bankAccountHolder: currentSettings.bankAccountHolder || backup.settings?.bankAccountHolder,
        bankName: currentSettings.bankName || backup.settings?.bankName,
        // Keep current admin password
        adminPassword: currentSettings.adminPassword || backup.settings?.adminPassword,
        // Keep Zalo settings
        ...(currentSettings.zaloAccessToken ? { zaloAccessToken: currentSettings.zaloAccessToken } : {}),
        ...(currentSettings.zaloTokenExpiresAt ? { zaloTokenExpiresAt: currentSettings.zaloTokenExpiresAt } : {}),
        ...(currentSettings.zaloAppId ? { zaloAppId: currentSettings.zaloAppId } : {}),
        ...(currentSettings.zaloSecretKey ? { zaloSecretKey: currentSettings.zaloSecretKey } : {}),
        ...(currentSettings.zaloRefreshToken ? { zaloRefreshToken: currentSettings.zaloRefreshToken } : {}),
        ...(currentSettings.webhookSecretKey ? { webhookSecretKey: currentSettings.webhookSecretKey } : {}),
    };
    
    console.log('\n=== MERGED RESULT ===');
    console.log(`  students: ${backup.students?.length || 0} (from backup)`);
    console.log(`  teachers: ${backup.teachers?.length || 0} (from backup)`);
    console.log(`  staff: ${backup.staff?.length || 0} (from backup)`);
    console.log(`  classes: ${backup.classes?.length || 0} (from backup)`);
    console.log(`  attendance: ${currentAttendance.length} (from Firebase shards - CURRENT)`);
    console.log(`  invoices: ${currentInvoices.length} (from Firebase shards - CURRENT)`);
    console.log(`  transactions: ${currentTransactions.length} (from Firebase shards - CURRENT)`);
    console.log(`  settings.centerName: "${mergedSettings.centerName || mergedSettings.name || ''}"`);
    
    // 4. Write ONLY the NON_SHARDED docs that are empty/missing
    // DO NOT touch sharded data — it's correct on Firebase
    console.log('\n=== WRITING TO FIREBASE ===');
    
    const batch = writeBatch(db);
    
    // Restore non-sharded data from backup
    batch.set(doc(db, COL_NAME, 'students'), { data: backup.students || [] });
    console.log(`  Writing students: ${backup.students?.length || 0}`);
    
    batch.set(doc(db, COL_NAME, 'teachers'), { data: backup.teachers || [] });
    console.log(`  Writing teachers: ${backup.teachers?.length || 0}`);
    
    batch.set(doc(db, COL_NAME, 'staff'), { data: backup.staff || [] });
    console.log(`  Writing staff: ${backup.staff?.length || 0}`);
    
    batch.set(doc(db, COL_NAME, 'classes'), { data: backup.classes || [] });
    console.log(`  Writing classes: ${backup.classes?.length || 0}`);
    
    batch.set(doc(db, COL_NAME, 'rooms'), { data: backup.rooms || [] });
    console.log(`  Writing rooms: ${backup.rooms?.length || 0}`);
    
    batch.set(doc(db, COL_NAME, 'settings'), { data: mergedSettings });
    console.log(`  Writing settings (merged)`);
    
    batch.set(doc(db, COL_NAME, 'announcements'), { data: backup.announcements || [] });
    console.log(`  Writing announcements: ${backup.announcements?.length || 0}`);
    
    batch.set(doc(db, COL_NAME, 'progressReports'), { data: backup.progressReports || [] });
    console.log(`  Writing progressReports: ${backup.progressReports?.length || 0}`);
    
    // Update sync to invalidate cache
    const newSyncId = Date.now().toString() + '_restore_' + Math.random().toString(36).substring(2);
    batch.set(doc(db, COL_NAME, '_sync'), { syncId: newSyncId, lastUpdatedAt: Date.now() });
    
    await batch.commit();
    console.log('\n✅ RESTORE COMPLETE! Refresh the website (Ctrl+F5).');
    
    // Save merged full data as backup
    const fullMerged = {
        students: backup.students || [],
        teachers: backup.teachers || [],
        staff: backup.staff || [],
        classes: backup.classes || [],
        rooms: backup.rooms || [],
        settings: mergedSettings,
        announcements: backup.announcements || [],
        progressReports: backup.progressReports || [],
        auditLogs: currentRaw['auditLogs']?.data || [],
        attendance: currentAttendance,
        invoices: currentInvoices,
        transactions: currentTransactions,
        income: currentIncome,
        expenses: currentExpenses,
        payrolls: currentPayrolls,
    };
    
    const ts = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const mergedFile = path.resolve(__dirname, `backup_MERGED_${ts}.json`);
    fs.writeFileSync(mergedFile, JSON.stringify(fullMerged, null, 2), 'utf-8');
    console.log(`\nFull merged backup saved: ${mergedFile}`);
    console.log(`File size: ${(fs.statSync(mergedFile).size / 1024).toFixed(1)} KB`);
    
    process.exit(0);
}

restore().catch(e => { console.error('FATAL:', e); process.exit(1); });
