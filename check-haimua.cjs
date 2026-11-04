const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');
const config = JSON.parse(fs.readFileSync(path.resolve('D:/test-tich-hop/TT_CkVK475KL', 'firebase-applet-config.json'), 'utf-8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);
async function check() {
    const snap = await getDocs(collection(db, 'center_haimua'));
    snap.forEach(d => {
        const data = d.data().data;
        if (Array.isArray(data)) console.log(d.id + ': ' + data.length);
        else if (typeof data === 'object') console.log(d.id + ': object');
        else console.log(d.id + ': ' + typeof data);
    });
    process.exit(0);
}
check();
