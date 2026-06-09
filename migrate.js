import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const firebaseConfig = require('./firebase-applet-config.json');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const COLLECTIONS = [
    'students', 'teachers', 'staff', 'classes', 'attendance', 
    'invoices', 'progressReports', 'transactions', 'income', 
    'expenses', 'payrolls', 'announcements', 'settings'
];

const OLD_PATH = 'educenter_data';
const NEW_PATH = 'db_core_v2_secure_9a8b7c6d5e4f3g2h1';

async function migrate() {
    console.log('Starting migration...');
    for (const col of COLLECTIONS) {
        const oldDoc = await getDoc(doc(db, OLD_PATH, col));
        if (oldDoc.exists()) {
            await setDoc(doc(db, NEW_PATH, col), oldDoc.data());
            console.log(`Migrated ${col}`);
        } else {
            console.log(`No data for ${col}`);
        }
    }
    console.log('Migration complete!');
    process.exit(0);
}

migrate().catch(console.error);
