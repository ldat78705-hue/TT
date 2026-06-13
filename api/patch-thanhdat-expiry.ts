/**
 * Patch: Add expiresAt to existing center_thanhdat registry
 * Run: npx tsx api/patch-thanhdat-expiry.ts
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import fs from 'fs';
import path from 'path';

const firebaseConfig = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function patch() {
    // Auth
    const auth = getAuth(app);
    const SERVER_EMAIL = 'server_admin@educenter.local';
    const SERVER_PASSWORD = process.env.SERVER_DB_PASSWORD || 'EduCenter_Secure_Server_Pwd_2026!';
    await signInWithEmailAndPassword(auth, SERVER_EMAIL, SERVER_PASSWORD);
    console.log('✅ Authenticated');

    // Set thanhdat expiry to 10 years
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 10);
    
    await updateDoc(doc(db, 'centers_registry', 'thanhdat'), {
        expiresAt: expiry.toISOString()
    });

    console.log(`✅ Updated thanhdat expiresAt to: ${expiry.toLocaleDateString('vi-VN')} (10 years)`);
}

patch().then(() => process.exit(0)).catch(err => { console.error('❌', err); process.exit(1); });
