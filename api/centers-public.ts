import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, getDocs, collection } from 'firebase/firestore';
import { authenticateServer } from './_lib/serverAuth.js';
import fs from 'fs';
import path from 'path';

let firebaseConfig: any;
try {
    firebaseConfig = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
} catch (e) {
    console.error("Could not load firebase config.");
}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        await authenticateServer();
        const querySnapshot = await getDocs(collection(db, 'centers_registry'));
        const centers: any[] = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            // Only return public info (no internal details)
            centers.push({
                id: docSnap.id,
                name: data.name,
                slug: data.slug,
                status: data.status
            });
        });

        // Cache for 5 minutes
        res.setHeader('Cache-Control', 'public, s-maxage=300');
        return res.status(200).json({ centers: centers.filter(c => c.status === 'ACTIVE') });
    } catch (error) {
        console.error('Centers Public GET Error:', error);
        return res.status(500).json({ centers: [] });
    }
}
