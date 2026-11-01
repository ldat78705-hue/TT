const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function main() {
    // Check webhookLogs in center_hkd_thanhdat
    const webhookSnap = await getDoc(doc(db, 'center_hkd_thanhdat', 'webhookLogs'));
    if (webhookSnap.exists()) {
        const data = webhookSnap.data();
        const entries = data?.entries || data?.logs || [];
        console.log(`webhookLogs in center_hkd_thanhdat: ${Array.isArray(entries) ? entries.length : 'not array'} entries`);
        if (Array.isArray(entries) && entries.length > 0) {
            console.log('First entry:', JSON.stringify(entries[0]).substring(0, 200));
            console.log('Last entry:', JSON.stringify(entries[entries.length-1]).substring(0, 200));
        }
        console.log('Top-level keys:', Object.keys(data));
    } else {
        console.log('webhookLogs: does not exist in center_hkd_thanhdat');
    }

    // Check webhookLogs in db_core_v2_secure
    const legacySnap = await getDoc(doc(db, 'db_core_v2_secure_9a8b7c6d5e4f3g2h1', 'webhookLogs'));
    if (legacySnap.exists()) {
        const data = legacySnap.data();
        const entries = data?.entries || data?.logs || [];
        console.log(`\nwebhookLogs in legacy: ${Array.isArray(entries) ? entries.length : 'not array'} entries`);
        console.log('Top-level keys:', Object.keys(data));
    }

    // Check all collections for _messageLog in OLD data
    const OLD_COLS = ['center_thaydat', 'center_thanhdat', 'db_core_v2_secure_9a8b7c6d5e4f3g2h1'];
    const MONTHS = ['2026-07','2026-08','2026-09','2026-10','2025-07','2025-08','2025-09','2025-10','2025-11','2025-12'];
    
    console.log('\n=== Checking old collections for messageLog ===');
    for (const col of OLD_COLS) {
        for (const m of MONTHS) {
            const snap = await getDoc(doc(db, col, `_messageLog_${m}`));
            if (snap.exists()) {
                const entries = snap.data()?.entries || [];
                console.log(`✅ ${col}/_messageLog_${m}: ${entries.length} entries`);
            }
        }
        // Also check if there's a single 'messageLogs' doc
        const mlSnap = await getDoc(doc(db, col, 'messageLogs'));
        if (mlSnap.exists()) {
            console.log(`✅ ${col}/messageLogs exists, keys: ${Object.keys(mlSnap.data())}`);
        }
    }

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
