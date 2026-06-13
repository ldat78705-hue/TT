/**
 * Setup Super Admin credentials in Firestore
 * Run: npx tsx api/setup-superadmin.ts
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const firebaseConfig = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

function hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
}

async function setup() {
    // Auth
    const auth = getAuth(app);
    const SERVER_EMAIL = 'server_admin@educenter.local';
    const SERVER_PASSWORD = process.env.SERVER_DB_PASSWORD || 'EduCenter_Secure_Server_Pwd_2026!';
    await signInWithEmailAndPassword(auth, SERVER_EMAIL, SERVER_PASSWORD);
    console.log('✅ Authenticated');

    const username = 'superadmin';
    const password = 'SuperAdmin@2026';
    const hashed = hashPassword(password);

    // Check if already exists
    const existing = await getDoc(doc(db, 'super_admin', 'credentials'));
    if (existing.exists()) {
        console.log('⚠️  Super Admin doc already exists:', JSON.stringify(existing.data()));
        console.log('Overwriting...');
    }

    await setDoc(doc(db, 'super_admin', 'credentials'), {
        username,
        password: hashed,
        createdAt: new Date().toISOString()
    });

    console.log(`✅ Super Admin credentials set:`);
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
    console.log(`   Hash: ${hashed}`);

    // Verify read back
    const verify = await getDoc(doc(db, 'super_admin', 'credentials'));
    console.log('✅ Verify read:', JSON.stringify(verify.data()));
}

setup().then(() => process.exit(0)).catch(err => { console.error('❌', err); process.exit(1); });
