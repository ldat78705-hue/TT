import admin from 'firebase-admin';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const firebaseConfig = require('./firebase-applet-config.json');

try {
    admin.initializeApp({
        projectId: firebaseConfig.projectId
    });
    const db = admin.firestore();
    db.settings({ databaseId: firebaseConfig.firestoreDatabaseId });
    
    await db.collection('test').limit(1).get();
    console.log('Admin SDK initialized successfully');
} catch (e) {
    console.error('Admin SDK failed:', e);
}
