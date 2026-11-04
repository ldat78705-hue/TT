// Emergency: Download ALL data from Firebase center_hkd_thanhdat
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf-8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

const COL_NAME = 'center_hkd_thanhdat';

async function downloadAll() {
    console.log(`\n=== DOWNLOADING ALL DATA FROM ${COL_NAME} ===\n`);
    
    const snapshot = await getDocs(collection(db, COL_NAME));
    const allData = {};
    let totalDocs = 0;
    
    snapshot.forEach(doc => {
        totalDocs++;
        const id = doc.id;
        const data = doc.data();
        allData[id] = data;
        
        // Show summary of each document
        const dataField = data.data;
        if (Array.isArray(dataField)) {
            console.log(`  ${id}: ${dataField.length} items`);
        } else if (typeof dataField === 'object' && dataField !== null) {
            console.log(`  ${id}: object (${Object.keys(dataField).length} keys)`);
        } else {
            console.log(`  ${id}: ${JSON.stringify(data).substring(0, 100)}`);
        }
    });
    
    console.log(`\n=== TOTAL: ${totalDocs} documents ===\n`);
    
    // Save to file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const outputFile = path.resolve(__dirname, `backup_${COL_NAME}_${timestamp}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(allData, null, 2), 'utf-8');
    console.log(`\nSaved to: ${outputFile}`);
    console.log(`File size: ${(fs.statSync(outputFile).size / 1024).toFixed(1)} KB`);
    
    // Also check key documents
    console.log('\n=== KEY DOCUMENT STATUS ===');
    const keyDocs = ['students', 'teachers', 'staff', 'classes', 'settings', 'rooms', 'announcements', 'progressReports', 'auditLogs'];
    for (const key of keyDocs) {
        if (allData[key]) {
            const d = allData[key].data;
            if (Array.isArray(d)) {
                console.log(`  ✅ ${key}: ${d.length} items`);
            } else if (typeof d === 'object' && d !== null) {
                console.log(`  ✅ ${key}: object with ${Object.keys(d).length} keys`);
            } else {
                console.log(`  ⚠️ ${key}: ${typeof d} — ${JSON.stringify(d).substring(0, 80)}`);
            }
        } else {
            console.log(`  ❌ ${key}: MISSING!`);
        }
    }
    
    process.exit(0);
}

downloadAll().catch(e => { console.error('FATAL:', e); process.exit(1); });
