import { getMockDataState } from './_lib/mockData.js';
import { verifyToken } from './_lib/jwt.js';
import { UserRole } from '../types.js';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, writeBatch, collection, getDocs, setDoc } from 'firebase/firestore';
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
    const centerId = (authPayload as any).centerId as string | undefined;
    const colName = getCollectionName(centerId);

    if (req.method === 'POST') {
        try {
            await authenticateServer();
            const mockData = getMockDataState();
            
            // === SAFETY: Auto-backup before reset ===
            try {
                const currentSnapshot = await getDocs(collection(db, colName));
                const backupData: Record<string, any> = {};
                const NON_SHARDED_KEYS = ['students', 'teachers', 'staff', 'classes', 'rooms', 'settings', 'announcements', 'progressReports'];
                currentSnapshot.forEach(docSnap => {
                    if (NON_SHARDED_KEYS.includes(docSnap.id)) {
                        backupData[docSnap.id] = docSnap.data().data;
                    }
                });
                const backupDocId = `_autobackup_reset_${Date.now()}`;
                await setDoc(doc(db, colName, backupDocId), { 
                    data: backupData, 
                    operation: 'resetToMockData', 
                    timestamp: Date.now(),
                    type: 'auto_backup'
                });
                console.log(`Auto-backup created: ${backupDocId} before reset`);
            } catch (backupErr) {
                console.error('Auto-backup failed:', backupErr);
            }

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

            // Delete existing documents BUT protect special docs
            // Use multiple batches to stay under Firestore 500-op limit
            const RESET_PROTECTED_PREFIXES = ['_messageLog', 'webhookLog', '_autobackup'];
            const querySnapshot = await getDocs(collection(db, colName));
            let deleteBatch = writeBatch(db);
            let deleteCount = 0;
            for (const docSnap of querySnapshot.docs) {
                if (RESET_PROTECTED_PREFIXES.some(prefix => docSnap.id.startsWith(prefix))) continue;
                deleteBatch.delete(docSnap.ref);
                deleteCount++;
                if (deleteCount >= 450) {
                    await deleteBatch.commit();
                    deleteBatch = writeBatch(db);
                    deleteCount = 0;
                }
            }
            if (deleteCount > 0) await deleteBatch.commit();

            // Set new base collections for THIS center
            const writeBatchObj = writeBatch(db);
            BASE_COLLECTIONS.forEach(col => {
                writeBatchObj.set(doc(db, colName, col), { data: mockData[col] });
            });
            writeBatchObj.set(doc(db, colName, '_sync'), { lastUpdatedAt: Date.now() });
            
            await writeBatchObj.commit();
            
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
