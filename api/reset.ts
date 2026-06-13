import { getMockDataState } from './_lib/mockData.js';
import { verifyToken } from './_lib/jwt.js';
import { UserRole } from '../types.js';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, writeBatch, collection, getDocs } from 'firebase/firestore';
import { hashPassword } from './_lib/crypto.js';
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

const LEGACY_COLLECTION = 'db_core_v2_secure_9a8b7c6d5e4f3g2h1';

const BASE_COLLECTIONS = [
    'students', 'teachers', 'staff', 'classes', 'attendance', 
    'invoices', 'progressReports', 'transactions', 'income', 
    'expenses', 'payrolls', 'announcements', 'settings'
] as const;

function getCollectionName(centerId?: string): string {
    if (!centerId || centerId === '_legacy') return LEGACY_COLLECTION;
    return `center_${centerId}`;
}

// Helper to check JWT
async function getAuthPayload(req: any) {
    const authHeader = req.headers.authorization || req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    return await verifyToken(token);
}

export default async function handler(req: any, res: any) {    
    const authPayload = await getAuthPayload(req);
    if (!authPayload) {
        return res.status(401).send('Unauthorized: Invalid or missing Token');
    }

    if (authPayload.role !== UserRole.ADMIN) {
        return res.status(403).send('Forbidden: Only admins can reset data');
    }

    // Use centerId from token to target the correct collection
    const centerId = authPayload.centerId;
    const colName = getCollectionName(centerId);

    if (req.method === 'POST') {
        try {
            await authenticateServer();
            const mockData = getMockDataState();
            
            // Hash passwords in mock data
            if (mockData.settings?.adminPassword) {
                mockData.settings.adminPassword = hashPassword(mockData.settings.adminPassword);
            }
            if (mockData.teachers) {
                mockData.teachers.forEach((t: any) => {
                    if (t.password) t.password = hashPassword(t.password);
                });
            }
            if (mockData.staff) {
                mockData.staff.forEach((s: any) => {
                    if (s.password) s.password = hashPassword(s.password);
                });
            }
            if (mockData.students) {
                mockData.students.forEach((s: any) => {
                    if (s.password) s.password = hashPassword(s.password);
                });
            }

            const batch = writeBatch(db);
            
            // Delete all existing documents (shards) in THIS center's collection
            const querySnapshot = await getDocs(collection(db, colName));
            querySnapshot.forEach(docSnap => {
                batch.delete(docSnap.ref);
            });

            // Set new base collections for THIS center
            BASE_COLLECTIONS.forEach(col => {
                batch.set(doc(db, colName, col), { data: mockData[col] });
            });
            batch.set(doc(db, colName, '_sync'), { lastUpdatedAt: Date.now() });
            
            await batch.commit();
            
            // Strip passwords before returning
            if (mockData.teachers) {
                mockData.teachers = mockData.teachers.map(t => {
                    const { password, ...rest } = t;
                    return rest as any;
                });
            }
            if (mockData.staff) {
                mockData.staff = mockData.staff.map(s => {
                    const { password, ...rest } = s;
                    return rest as any;
                });
            }
            if (mockData.settings) {
                const { adminPassword, ...safeSettings } = mockData.settings;
                mockData.settings = safeSettings as any;
            }

            return res.status(200).json(mockData);
        } catch (error) {
            console.error('Firestore Reset Error:', error);
            return res.status(500).send('Failed to reset data in Firestore.');
        }
    }

    return res.status(405).send('Method Not Allowed');
}
