import type { AppData } from '../types.js';
import { getMockDataState } from './_lib/mockData.js';
import { applyOperation } from './_lib/operations.js';
import { verifyToken } from './_lib/jwt.js';
import { UserRole } from '../types.js';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDocs, collection, writeBatch, onSnapshot } from 'firebase/firestore';
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

const BASE_COLLECTIONS = [
    'students', 'teachers', 'staff', 'classes', 'attendance', 
    'invoices', 'progressReports', 'transactions', 'income', 
    'expenses', 'payrolls', 'announcements', 'settings'
] as const;

const NON_SHARDED = ['students', 'teachers', 'staff', 'classes', 'progressReports', 'announcements', 'settings'];
const SHARDED = ['attendance', 'invoices', 'transactions', 'income', 'expenses', 'payrolls'];

function getShardKey(item: any, collectionName: string): string {
    try {
        if (['attendance', 'transactions', 'income', 'expenses'].includes(collectionName)) {
            if (item.date) {
                // Shard by DAY for high-volume collections to support 500+ students
                const match = item.date.match(/^(\d{4})-(\d{2})-(\d{2})/);
                if (match) return `${collectionName}_${match[1]}_${match[2]}_${match[3]}`;
            }
        } else if (['invoices', 'payrolls'].includes(collectionName)) {
            if (collectionName === 'payrolls' && item.year && item.month) {
                // Shard payrolls
                return `${collectionName}_${item.year}_${item.month.toString().padStart(2, '0')}`;
            } else if (collectionName === 'invoices' && item.month) {
                // Shard invoices using the month string format "YYYY-MM"
                const parts = item.month.split('-');
                if (parts.length === 2) {
                    return `${collectionName}_${parts[0]}_${parts[1]}`;
                }
            }
        }
    } catch (e) {}
    return collectionName;
}

function shardAppData(data: Omit<AppData, 'loading'>): Record<string, any> {
    const shards: Record<string, any> = {};
    
    NON_SHARDED.forEach(col => {
        if (data[col as keyof typeof data] !== undefined) {
            shards[col] = data[col as keyof typeof data];
        }
    });

    SHARDED.forEach(col => {
        // We MUST ensure the base collection key exists so it overwrites any old un-sharded data with []
        shards[col] = []; 
        
        const items = (data as any)[col] || [];
        items.forEach((item: any) => {
            const shardKey = getShardKey(item, col);
            if (shardKey === col) {
                shards[col].push(item);
            } else {
                if (!shards[shardKey]) shards[shardKey] = [];
                shards[shardKey].push(item);
            }
        });
    });
    
    return shards;
}

// In-memory cache and lock for extreme performance
let cachedData: Omit<AppData, 'loading'> | null = null;
let rawShardStrings: Record<string, string> = {};
let fetchPromise: Promise<Omit<AppData, 'loading'>> | null = null;
let isLocked = false;
let localSyncId = '';

// Listen to _sync document changes in the background to invalidate cache across instances
let syncListenerSetup = false;
function setupSyncListener() {
    if (syncListenerSetup) return;
    syncListenerSetup = true;
    onSnapshot(doc(db, 'db_core_v2_secure_9a8b7c6d5e4f3g2h1', '_sync'), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const remoteSyncId = data.syncId || data.lastUpdatedAt?.toString(); // Fallback for old data
            if (remoteSyncId && remoteSyncId !== localSyncId) {
                console.log("Remote sync detected, invalidating cache...");
                localSyncId = remoteSyncId;
                cachedData = null; // Force refresh on next request
                fetchPromise = null;
            }
        }
    }, (error) => {
        console.error("Sync listener error:", error);
        syncListenerSetup = false; // Allow retry
    });
}

async function acquireLock(): Promise<void> {
    while (isLocked) {
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    isLocked = true;
}

function releaseLock() {
    isLocked = false;
}

// Helper to check JWT
async function getAuthPayload(req: any) {
    const authHeader = req.headers.authorization || req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    return await verifyToken(token);
}

export async function getSplitData(forceRefresh = false): Promise<Omit<AppData, 'loading'>> {
    if (cachedData && !forceRefresh) return cachedData;
    if (fetchPromise && !forceRefresh) return fetchPromise;

    fetchPromise = (async () => {
        try {
            await authenticateServer();
            setupSyncListener();
            const defaultState = getMockDataState();
            const data: any = {
                students: [], teachers: [], staff: [], classes: [], attendance: [],
                invoices: [], progressReports: [], transactions: [], income: [],
                expenses: [], payrolls: [], announcements: [], settings: defaultState.settings
            };
            
            let hasData = false;
            const newRawStrings: Record<string, string> = {};

            const querySnapshot = await getDocs(collection(db, 'db_core_v2_secure_9a8b7c6d5e4f3g2h1'));
            
            querySnapshot.forEach((docSnap) => {
                const id = docSnap.id;
                if (id === '_sync') return;
                
                hasData = true;
                const docData = docSnap.data().data;
                newRawStrings[id] = JSON.stringify(docData);
                
                let baseCol = id;
                if (id.startsWith('attendance_')) baseCol = 'attendance';
                else if (id.startsWith('invoices_')) baseCol = 'invoices';
                else if (id.startsWith('transactions_')) baseCol = 'transactions';
                else if (id.startsWith('income_')) baseCol = 'income';
                else if (id.startsWith('expenses_')) baseCol = 'expenses';
                else if (id.startsWith('payrolls_')) baseCol = 'payrolls';

                if (Array.isArray(docData)) {
                    if (!data[baseCol]) data[baseCol] = [];
                    data[baseCol].push(...docData);
                } else {
                    data[baseCol] = docData;
                }
            });

            if (!hasData) {
                console.log("Firestore is empty. Seeding with initial mock data.");
                
                // Hash passwords in defaultState
                if (defaultState.settings?.adminPassword) {
                    defaultState.settings.adminPassword = hashPassword(defaultState.settings.adminPassword);
                }
                if (defaultState.teachers) {
                    defaultState.teachers.forEach(t => {
                        if (t.password) t.password = hashPassword(t.password);
                    });
                }
                if (defaultState.staff) {
                    defaultState.staff.forEach(s => {
                        if (s.password) s.password = hashPassword(s.password);
                    });
                }
                if (defaultState.students) {
                    defaultState.students.forEach(s => {
                        if (s.password) s.password = hashPassword(s.password);
                    });
                }

                const batch = writeBatch(db);
                BASE_COLLECTIONS.forEach(col => {
                    batch.set(doc(db, 'db_core_v2_secure_9a8b7c6d5e4f3g2h1', col), { data: defaultState[col] });
                    data[col] = defaultState[col];
                    newRawStrings[col] = JSON.stringify(defaultState[col]);
                });
                const newSyncId = Date.now().toString() + '_' + Math.random().toString(36).substring(2);
                batch.set(doc(db, 'db_core_v2_secure_9a8b7c6d5e4f3g2h1', '_sync'), { syncId: newSyncId, lastUpdatedAt: Date.now() });
                await batch.commit();
                localSyncId = newSyncId;
            }

            rawShardStrings = newRawStrings;
            cachedData = data as Omit<AppData, 'loading'>;
            return cachedData;
        } catch (error) {
            fetchPromise = null;
            throw error;
        }
    })();

    return fetchPromise;
}

function applySmartWindowFilter(data: any) {
    const filtered = { ...data };
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const cutoffDateStr = twelveMonthsAgo.toISOString().substring(0, 10);
    const cutoffYear = twelveMonthsAgo.getFullYear();
    const cutoffMonth = twelveMonthsAgo.getMonth() + 1;

    if (filtered.attendance) filtered.attendance = filtered.attendance.filter((a: any) => a.date >= cutoffDateStr);
    if (filtered.transactions) filtered.transactions = filtered.transactions.filter((t: any) => t.date >= cutoffDateStr);
    if (filtered.income) filtered.income = filtered.income.filter((i: any) => i.date >= cutoffDateStr);
    if (filtered.expenses) filtered.expenses = filtered.expenses.filter((e: any) => e.date >= cutoffDateStr);
    if (filtered.progressReports) filtered.progressReports = filtered.progressReports.filter((p: any) => p.date >= cutoffDateStr);
    
    if (filtered.payrolls) {
        filtered.payrolls = filtered.payrolls.filter((p: any) => {
            if (p.year > cutoffYear) return true;
            if (p.year === cutoffYear && p.month >= cutoffMonth) return true;
            return false;
        });
    }
    if (filtered.invoices) {
        filtered.invoices = filtered.invoices.filter((inv: any) => {
            if (inv.status !== 'PAID') return true; // Smart window: Always keep unpaid invoices
            if (inv.month) {
                const parts = inv.month.split('-');
                if (parts.length === 2) {
                    const invYear = Number(parts[0]);
                    const invMonth = Number(parts[1]);
                    if (invYear > cutoffYear) return true;
                    if (invYear === cutoffYear && invMonth >= cutoffMonth) return true;
                }
            }
            return false;
        });
    }

    // Strip passwords
    if (filtered.teachers) {
        filtered.teachers = filtered.teachers.map((t: any) => {
            const { password, ...rest } = t;
            return rest;
        });
    }
    if (filtered.staff) {
        filtered.staff = filtered.staff.map((s: any) => {
            const { password, ...rest } = s;
            return rest;
        });
    }
    if (filtered.settings) {
        const { adminPassword, ...safeSettings } = filtered.settings;
        filtered.settings = safeSettings;
    }

    return filtered;
}

export async function executeOperationInternal(operation: { op: string, payload: any }) {
    await acquireLock();
    try {
        await authenticateServer();
        const currentData = await getSplitData();
        const dataClone = structuredClone(currentData);
        const updatedData = applyOperation(dataClone, operation);
        const updatedShards = shardAppData(updatedData);

        const batch = writeBatch(db);
        let hasChanges = false;
        const pendingRawStringsUpdates: Record<string, string | null> = {};
        
        Object.keys(updatedShards).forEach(key => {
            const oldStr = rawShardStrings[key];
            const newStr = JSON.stringify(updatedShards[key]);
            if (oldStr !== newStr) {
                batch.set(doc(db, 'db_core_v2_secure_9a8b7c6d5e4f3g2h1', key), { data: updatedShards[key] });
                hasChanges = true;
                pendingRawStringsUpdates[key] = newStr;
            }
        });

        Object.keys(rawShardStrings).forEach(key => {
            if (key !== '_sync' && updatedShards[key] === undefined) {
                batch.delete(doc(db, 'db_core_v2_secure_9a8b7c6d5e4f3g2h1', key));
                hasChanges = true;
                pendingRawStringsUpdates[key] = null;
            }
        });

        if (hasChanges) {
            const newSyncId = Date.now().toString() + '_' + Math.random().toString(36).substring(2);
            batch.set(doc(db, 'db_core_v2_secure_9a8b7c6d5e4f3g2h1', '_sync'), { syncId: newSyncId, lastUpdatedAt: Date.now() });
            
            cachedData = updatedData;
            localSyncId = newSyncId;
            
            try {
                await batch.commit();
                Object.keys(pendingRawStringsUpdates).forEach(key => {
                    const val = pendingRawStringsUpdates[key];
                    if (val === null) delete rawShardStrings[key];
                    else rawShardStrings[key] = val;
                });
            } catch (err) {
                cachedData = null; 
                throw err;
            }
        }
        return applySmartWindowFilter(updatedData);
    } finally {
        releaseLock();
    }
}

export default async function handler(req: any, res: any) {
    const authPayload = await getAuthPayload(req);
    if (!authPayload) {
        return res.status(401).send('Unauthorized: Invalid or missing Token');
    }

    if (req.method === 'GET') {
        try {
            const data = await getSplitData();
            const responseData = applySmartWindowFilter(data);

            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            return res.status(200).json(responseData);
        } catch (error) {
            console.error('Firestore GET Error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown Firestore error';
            return res.status(500).send(`Lỗi Máy chủ: Không thể lấy dữ liệu từ Firestore. Chi tiết: ${errorMessage}`);
        }
    }

    if (req.method === 'POST') {
        const role = authPayload.role as UserRole;
        let operation = req.body || {};
        if (typeof operation === 'string') {
            try { operation = JSON.parse(operation); } catch (e) {}
        }

        if (role === UserRole.VIEWER) {
            return res.status(403).send('Forbidden: You do not have permission to modify data');
        }
        if (role === UserRole.PARENT) {
            if (operation.op !== 'updateUserPassword' || operation.payload?.userId !== authPayload.userId) {
                return res.status(403).send('Forbidden: You do not have permission to modify data');
            }
        }

        if (operation.op === 'updateUserPassword') {
            const targetRole = operation.payload?.role;
            if (targetRole === UserRole.ADMIN && role !== UserRole.ADMIN) {
                return res.status(403).send('Forbidden: Only Admin can change Admin password');
            }
            if (role !== UserRole.ADMIN && role !== UserRole.MANAGER) {
                if (!operation.payload?.currentPassword) {
                    return res.status(403).send('Forbidden: currentPassword is required');
                }
                if (operation.payload.userId !== authPayload.userId) {
                    return res.status(403).send('Forbidden: You can only change your own password');
                }
            }
            if (operation.payload.newPassword) {
                operation.payload.newPassword = hashPassword(operation.payload.newPassword);
            }
        }

        // Hash passwords for other operations
        if (operation.op === 'addTeacher' || operation.op === 'updateTeacher') {
            const t = operation.payload.teacher || operation.payload.updatedTeacher;
            if (t && t.password && t.password.length < 64) { // Basic check to avoid re-hashing
                t.password = hashPassword(t.password);
            }
        }
        if (operation.op === 'addStaff' || operation.op === 'updateStaff') {
            const s = operation.payload.staff || operation.payload.updatedStaff;
            if (s && s.password && s.password.length < 64) {
                s.password = hashPassword(s.password);
            }
        }
        if (operation.op === 'addStudent' || operation.op === 'updateStudent') {
            const st = operation.payload.student || operation.payload.updatedStudent;
            if (st && st.password && st.password.length < 64) {
                st.password = hashPassword(st.password);
            }
        }
        if (operation.op === 'updateSettings') {
            const set = operation.payload;
            if (set && set.adminPassword && set.adminPassword.length < 64) {
                set.adminPassword = hashPassword(set.adminPassword);
            }
        }

        if (operation.op === 'restoreData') {
            await acquireLock();
            try {
                await authenticateServer();
                if (role !== UserRole.ADMIN) {
                    throw new Error('Forbidden: Only admins can restore data');
                }
                const restoredDataFromFile = operation.payload as Omit<AppData, 'loading'>;
                const restoredShards = shardAppData(restoredDataFromFile);
                
                const batch = writeBatch(db);

                // 1. Delete all existing documents to ensure a clean slate
                const querySnapshot = await getDocs(collection(db, 'db_core_v2_secure_9a8b7c6d5e4f3g2h1'));
                querySnapshot.forEach(docSnap => {
                    batch.delete(docSnap.ref);
                });

                // 2. Set new shards from the backup
                const newRawStrings: Record<string, string> = {};
                Object.keys(restoredShards).forEach(key => {
                    batch.set(doc(db, 'db_core_v2_secure_9a8b7c6d5e4f3g2h1', key), { data: restoredShards[key] });
                    newRawStrings[key] = JSON.stringify(restoredShards[key]);
                });
                
                const newSyncId = Date.now().toString() + '_' + Math.random().toString(36).substring(2);
                batch.set(doc(db, 'db_core_v2_secure_9a8b7c6d5e4f3g2h1', '_sync'), { syncId: newSyncId, lastUpdatedAt: Date.now() });
                
                try {
                    await batch.commit();
                    cachedData = restoredDataFromFile;
                    localSyncId = newSyncId;
                    rawShardStrings = newRawStrings; // Update memory state
                } catch (err) {
                    console.error("Restore commit failed:", err);
                    cachedData = null;
                    throw err;
                }

                return res.status(200).json(restoredDataFromFile);
            } catch (error) {
                console.error('Operation Error:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown operation error';
                if (errorMessage.startsWith('Forbidden:')) {
                    return res.status(403).send(errorMessage);
                }
                return res.status(400).send(`Thao tác thất bại: ${errorMessage}`);
            } finally {
                releaseLock();
            }
        } else {
            try {
                const responseData = await executeOperationInternal(operation);
                return res.status(200).json(responseData);
            } catch (error) {
                console.error('Operation Error:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown operation error';
                if (errorMessage.startsWith('Forbidden:')) {
                    return res.status(403).send(errorMessage);
                }
                return res.status(400).send(`Thao tác thất bại: ${errorMessage}`);
            }
        }
    }

    return res.status(405).send('Method Not Allowed');
}
