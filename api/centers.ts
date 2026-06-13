import { verifyToken } from './_lib/jwt.js';
import { UserRole } from '../types.js';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';
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

const REGISTRY_COLLECTION = 'centers_registry';

// Super admin email - only this user can manage centers
const SUPER_ADMIN_USERS = ['ADMIN_USER'];

async function getAuthPayload(req: any) {
    const authHeader = req.headers.authorization || req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    return await verifyToken(token);
}

export default async function handler(req: any, res: any) {
    const authPayload = await getAuthPayload(req);
    if (!authPayload) {
        return res.status(401).json({ error: 'Không có quyền truy cập' });
    }

    const role = (authPayload as any).role;
    const userId = (authPayload as any).userId;

    // Only ADMIN can manage centers
    if (role !== UserRole.ADMIN || !SUPER_ADMIN_USERS.includes(userId)) {
        return res.status(403).json({ error: 'Chỉ Super Admin mới có quyền quản lý trung tâm' });
    }

    await authenticateServer();

    // GET: List all centers
    if (req.method === 'GET') {
        try {
            const querySnapshot = await getDocs(collection(db, REGISTRY_COLLECTION));
            const centers: any[] = [];
            querySnapshot.forEach((docSnap) => {
                centers.push({ id: docSnap.id, ...docSnap.data() });
            });
            return res.status(200).json({ centers });
        } catch (error) {
            console.error('Centers GET Error:', error);
            return res.status(500).json({ error: 'Lỗi đọc danh sách trung tâm' });
        }
    }

    // POST: Create a new center
    if (req.method === 'POST') {
        try {
            let body = req.body || {};
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (e) {}
            }

            const { slug, name, address, phone, owner } = body;
            if (!slug || !name) {
                return res.status(400).json({ error: 'Thiếu slug hoặc tên trung tâm' });
            }

            // Check if center already exists
            const existing = await getDoc(doc(db, REGISTRY_COLLECTION, slug));
            if (existing.exists()) {
                return res.status(409).json({ error: `Trung tâm với slug "${slug}" đã tồn tại` });
            }

            const centerData = {
                name,
                slug,
                address: address || '',
                phone: phone || '',
                owner: owner || userId,
                plan: 'free',
                status: 'ACTIVE',
                createdAt: new Date().toISOString(),
                collectionName: `center_${slug}`
            };

            await setDoc(doc(db, REGISTRY_COLLECTION, slug), centerData);

            return res.status(201).json({ 
                success: true, 
                center: { id: slug, ...centerData },
                message: `Trung tâm "${name}" đã được tạo thành công. Collection: center_${slug}`
            });
        } catch (error) {
            console.error('Centers POST Error:', error);
            return res.status(500).json({ error: 'Lỗi tạo trung tâm' });
        }
    }

    // DELETE: Remove a center (registry only, NOT data)
    if (req.method === 'DELETE') {
        try {
            let body = req.body || {};
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (e) {}
            }

            const { slug } = body;
            if (!slug) {
                return res.status(400).json({ error: 'Thiếu slug trung tâm' });
            }

            await deleteDoc(doc(db, REGISTRY_COLLECTION, slug));
            return res.status(200).json({ success: true, message: `Đã xóa trung tâm "${slug}" khỏi registry` });
        } catch (error) {
            console.error('Centers DELETE Error:', error);
            return res.status(500).json({ error: 'Lỗi xóa trung tâm' });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
