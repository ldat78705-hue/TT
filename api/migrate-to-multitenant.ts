/**
 * Migration script: Copy dữ liệu từ collection cũ sang center_thanhdat
 * 
 * AN TOÀN: 
 * - KHÔNG xóa dữ liệu cũ
 * - Chỉ COPY sang collection mới
 * - Có thể chạy nhiều lần (idempotent)
 * 
 * Chạy: npx tsx api/migrate-to-multitenant.ts
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDocs, collection, writeBatch, getDoc, setDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const firebaseConfig = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const OLD_COLLECTION = 'db_core_v2_secure_9a8b7c6d5e4f3g2h1';
const CENTER_ID = 'thanhdat';
const NEW_COLLECTION = `center_${CENTER_ID}`;

async function migrate() {
    console.log('=== EduCenter Pro Migration: Single → Multi-tenant ===');
    console.log(`Source: ${OLD_COLLECTION}`);
    console.log(`Target: ${NEW_COLLECTION}`);
    console.log('');

    // Step 1: Authenticate (import serverAuth logic inline)
    const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('firebase/auth');
    const auth = getAuth(app);
    const SERVER_EMAIL = 'server_admin@educenter.local';
    const SERVER_PASSWORD = process.env.SERVER_DB_PASSWORD || 'EduCenter_Secure_Server_Pwd_2026!';
    
    try {
        await signInWithEmailAndPassword(auth, SERVER_EMAIL, SERVER_PASSWORD);
        console.log('✅ Authenticated to Firebase');
    } catch (e: any) {
        if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
            await createUserWithEmailAndPassword(auth, SERVER_EMAIL, SERVER_PASSWORD);
            console.log('✅ Created server account and authenticated');
        } else {
            throw e;
        }
    }

    // Step 2: Read all documents from old collection
    console.log(`\n📖 Reading from ${OLD_COLLECTION}...`);
    const querySnapshot = await getDocs(collection(db, OLD_COLLECTION));
    const docs: { id: string; data: any }[] = [];
    
    querySnapshot.forEach((docSnap) => {
        docs.push({ id: docSnap.id, data: docSnap.data() });
    });
    
    console.log(`   Found ${docs.length} documents`);
    docs.forEach(d => {
        const dataStr = JSON.stringify(d.data);
        console.log(`   - ${d.id} (${(dataStr.length / 1024).toFixed(1)} KB)`);
    });

    // Step 3: Check if target collection already exists
    console.log(`\n🔍 Checking target ${NEW_COLLECTION}...`);
    const existingDocs = await getDocs(collection(db, NEW_COLLECTION));
    if (existingDocs.size > 0) {
        console.log(`   ⚠️  Target already has ${existingDocs.size} documents!`);
        console.log('   Skipping data copy to avoid overwriting. Delete target collection first if you want to re-migrate.');
        
        // Still create registry entry
        await createRegistryEntry();
        return;
    }

    // Step 4: Copy all documents to new collection (batch write)
    console.log(`\n📝 Copying ${docs.length} documents to ${NEW_COLLECTION}...`);
    
    // Firestore batch limit is 500 operations per batch
    const BATCH_SIZE = 450;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + BATCH_SIZE);
        
        chunk.forEach(d => {
            batch.set(doc(db, NEW_COLLECTION, d.id), d.data);
        });
        
        await batch.commit();
        console.log(`   ✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: copied ${chunk.length} docs`);
    }

    // Step 5: Create centers registry
    await createRegistryEntry();

    console.log('\n🎉 Migration complete!');
    console.log(`   Old data in ${OLD_COLLECTION}: UNTOUCHED ✅`);
    console.log(`   New data in ${NEW_COLLECTION}: COPIED ✅`);
    console.log(`   Registry: CREATED ✅`);
    console.log('\n   Next: Update backend code to use center_${centerId} collections');
}

async function createRegistryEntry() {
    console.log('\n📋 Creating centers registry...');
    
    // Read settings from old collection to get center name
    const settingsDoc = await getDoc(doc(db, OLD_COLLECTION, 'settings'));
    const settings = settingsDoc.exists() ? settingsDoc.data().data : {};
    
    await setDoc(doc(db, 'centers_registry', CENTER_ID), {
        name: settings.name || 'HỘ KINH DOANH THÀNH ĐẠT',
        slug: CENTER_ID,
        owner: 'admin',
        plan: 'free',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        collectionName: NEW_COLLECTION
    });
    
    console.log(`   ✅ Registry entry created: centers_registry/${CENTER_ID}`);
}

// Run
migrate().then(() => {
    console.log('\nDone. Process exiting...');
    process.exit(0);
}).catch((err) => {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
});
