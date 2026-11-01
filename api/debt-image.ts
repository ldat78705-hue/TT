/**
 * Debt Image API — /api/debt-image
 * 
 * POST: Upload base64 image, store in Firestore, return public URL
 * GET:  Serve stored image as PNG (for SLL to download)
 * DELETE: Remove image after sending
 * 
 * Images are stored temporarily in Firestore and cleaned up after sending.
 * Auto-expiry: Images older than 30 minutes are automatically deleted.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

let firebaseConfig: any;
try {
    firebaseConfig = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
} catch (e) {
    console.error("Could not load firebase config for debt-image endpoint.");
}

const fbApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(fbApp, firebaseConfig?.firestoreDatabaseId);

const COLLECTION = '_debt_images_temp';
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes — auto-delete threshold

export default async function handler(req: any, res: any) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        if (req.method === 'POST') {
            // Upload image
            const { imageBase64, imageId } = req.body;
            if (!imageBase64 || !imageId) {
                return res.status(400).json({ error: 'Missing imageBase64 or imageId' });
            }
            
            // Strip data URL prefix if present
            const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
            
            // Store in Firestore (max doc size 1MB, images ~50-150KB = OK)
            await setDoc(doc(db, COLLECTION, imageId), {
                data: base64Data,
                createdAt: Date.now(),
            });
            
            // Build public URL for this image
            const host = req.headers.host || 'ttonline-five.vercel.app';
            const protocol = host.includes('localhost') ? 'http' : 'https';
            const imageUrl = `${protocol}://${host}/api/debt-image?id=${imageId}`;
            
            // Background cleanup: delete orphaned images older than 30 min
            // (fire-and-forget, don't block the response)
            cleanupOldImages().catch(() => {});
            
            return res.status(200).json({ success: true, imageUrl, imageId });
        }
        
        if (req.method === 'GET') {
            // Serve image
            const imageId = req.query?.id || (typeof req.url === 'string' ? new URL(req.url, 'http://localhost').searchParams.get('id') : null);
            if (!imageId) {
                return res.status(400).json({ error: 'Missing id parameter' });
            }
            
            const docRef = doc(db, COLLECTION, imageId as string);
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) {
                return res.status(404).json({ error: 'Image not found or expired' });
            }
            
            const docData = docSnap.data();
            const buffer = Buffer.from(docData.data, 'base64');
            
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Content-Length', buffer.length);
            res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache
            
            // Auto-delete image after serving if it's older than 10 minutes
            // (SLL server has already downloaded it by this point)
            const age = Date.now() - (docData.createdAt || 0);
            if (age > 10 * 60 * 1000) {
                deleteDoc(docRef).catch(() => {});
            }
            
            return res.status(200).end(buffer);
        }
        
        if (req.method === 'DELETE') {
            // Cleanup
            const { imageId } = req.body;
            if (imageId) {
                await deleteDoc(doc(db, COLLECTION, imageId));
            }
            return res.status(200).json({ success: true });
        }
        
        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error: any) {
        console.error('Debt image API error:', error);
        return res.status(500).json({ error: error.message || 'Server error' });
    }
}

/**
 * Cleanup orphaned images older than MAX_AGE_MS.
 * This runs opportunistically on POST to prevent Firestore bloat.
 */
async function cleanupOldImages() {
    try {
        const cutoff = Date.now() - MAX_AGE_MS;
        const colRef = collection(db, COLLECTION);
        const q = query(colRef, where('createdAt', '<', cutoff));
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);
        if (deletePromises.length > 0) {
            console.log(`[debt-image] Cleaned up ${deletePromises.length} orphaned images.`);
        }
    } catch (e) {
        // Silent — cleanup is best-effort
    }
}
