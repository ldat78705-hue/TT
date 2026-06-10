import type { AppData } from '../types.js';
import { getMockDataState } from './_lib/mockData.js';
import { applyOperation } from './_lib/operations.js';
import { verifyToken } from './_lib/jwt.js';
import { UserRole } from '../types.js';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDocs, collection, writeBatch, onSnapshot, runTransaction } from 'firebase/firestore';
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
        if (['transactions', 'income', 'expenses'].includes(collectionName)) {
            if (item.date) {
                // Shard by MONTH for financial records
                const match = item.date.match(/^(\d{4})-(\d{2})/);
                if (match) return `${collectionName}_${match[1]}_${match[2]}`;
            }
        } else if (collectionName === 'attendance') {
            if (item.date) {
                // Shard by MONTH + CLASS for attendance
                const match = item.date.match(/^(\d{4})-(\d{2})/);
                const classId = item.classId || 'unknown';
                if (match) return `attendance_${match[1]}_${match[2]}_${classId}`;
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

export async function executeAttendanceTransaction(payload: any) {
    await acquireLock();
    try {
        await authenticateServer();
        const records: any[] = payload;
        
        // Group by shard key
        const shardsAffected = new Set<string>();
        records.forEach(r => {
            const shardKey = getShardKey(r, 'attendance');
            shardsAffected.add(shardKey);
        });

        // We also need to read classes to get teacherIds if needed
        shardsAffected.add('classes');

        await runTransaction(db, async (transaction) => {
            const shardRefs = Array.from(shardsAffected).map(k => doc(db, 'db_core_v2_secure_9a8b7c6d5e4f3g2h1', k));
            const snapshots = await Promise.all(shardRefs.map(ref => transaction.get(ref)));
            
            const currentData: any = {};
            snapshots.forEach((snap, i) => {
                const key = Array.from(shardsAffected)[i];
                if (snap.exists()) {
                    currentData[key] = snap.data().data || [];
                } else {
                    currentData[key] = [];
                }
            });

            const classes = currentData['classes'];

            const recordsByClassDate = new Map<string, any[]>();
            records.forEach(r => {
                const key = `${r.classId}|${r.date}`;
                if (!recordsByClassDate.has(key)) recordsByClassDate.set(key, []);
                recordsByClassDate.get(key)!.push(r);
            });

            // For each shard, we update its records
            const updatedShardsData: any = {};

            recordsByClassDate.forEach((newRecords, key) => {
                const [classId, date] = key.split('|');
                const cls = classes.find((c: any) => c.id === classId);
                const currentTeacherIds = cls ? cls.teacherIds : [];
                
                // Which shard does this date belong to?
                const sample = { date };
                const sKey = getShardKey(sample, 'attendance');
                
                if (!updatedShardsData[sKey]) {
                    updatedShardsData[sKey] = [...currentData[sKey]]; // clone
                }

                // Remove old records for this class and date
                updatedShardsData[sKey] = updatedShardsData[sKey].filter((a: any) => !(a.classId === classId && a.date === date));
                
                const generateUniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                
                const recordsWithIds = newRecords.map(record => ({
                    ...record, 
                    id: record.id || generateUniqueId('ATT'),
                    teacherIds: record.teacherIds || currentTeacherIds
                }));
                
                updatedShardsData[sKey].push(...recordsWithIds);
            });

            // Write back
            Object.keys(updatedShardsData).forEach(sKey => {
                const ref = doc(db, 'db_core_v2_secure_9a8b7c6d5e4f3g2h1', sKey);
                transaction.set(ref, { data: updatedShardsData[sKey] });
            });

            const syncRef = doc(db, 'db_core_v2_secure_9a8b7c6d5e4f3g2h1', '_sync');
            const newSyncId = Date.now().toString() + '_' + Math.random().toString(36).substring(2);
            transaction.set(syncRef, { syncId: newSyncId, lastUpdatedAt: Date.now() });
        });
        
        // Force full refresh next time
        cachedData = null;
        fetchPromise = null;
        
        // Return latest full data
        return applySmartWindowFilter(await getSplitData());
    } finally {
        releaseLock();
    }
}

export async function executeTuitionTransaction(payload: any) {
    await acquireLock();
    try {
        await authenticateServer();
        const { studentId, amount, date, description, type, paymentMethod } = payload;
        const finalAmount = type === 'CREDIT' ? amount : -amount;
        
        const shardKey = getShardKey({ date }, 'transactions');
        
        await runTransaction(db, async (transaction) => {
            const txRef = doc(db, 'db_core_v2_secure_9a8b7c6d5e4f3g2h1', shardKey);
            const studentsRef = doc(db, 'db_core_v2_secure_9a8b7c6d5e4f3g2h1', 'students');
            
            const [txSnap, studentsSnap] = await Promise.all([transaction.get(txRef), transaction.get(studentsRef)]);
            
            const transactions = txSnap.exists() ? txSnap.data().data || [] : [];
            const students = studentsSnap.exists() ? studentsSnap.data().data || [] : [];
            
            const student = students.find((s: any) => s.id === studentId);
            if (student) {
                student.balance += finalAmount;
                // Note: Recalculate invoices logic is omitted here for simplicity because manual payments 
                // typically don't trigger invoice recalculation directly unless they cover the invoice fully.
                // The full recalculation runs on standard save.
            }
            
            const generateUniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            transactions.push({ 
                id: generateUniqueId('TRX'), 
                studentId, 
                date, 
                type: type === 'CREDIT' ? 'PAYMENT' : 'ADJUSTMENT_DEBIT', 
                description, 
                amount: finalAmount, 
                paymentMethod: paymentMethod || 'transfer' 
            });
            
            transaction.set(txRef, { data: transactions });
            transaction.set(studentsRef, { data: students });
            
            const syncRef = doc(db, 'db_core_v2_secure_9a8b7c6d5e4f3g2h1', '_sync');
            const newSyncId = Date.now().toString() + '_' + Math.random().toString(36).substring(2);
            transaction.set(syncRef, { syncId: newSyncId, lastUpdatedAt: Date.now() });
        });
        
        cachedData = null;
        fetchPromise = null;
        
        return applySmartWindowFilter(await getSplitData());
    } finally {
        releaseLock();
    }
}

export default async function handler(req: any, res: any) {
    const authPayload = await getAuthPayload(req);
    if (!authPayload) {
        return res.status(401).json({ success: false, error: 'Không có quyền truy cập: Chỉ quản trị viên mới được thao tác' });
    }

    if (req.method === 'GET') {
        try {
            const data = await getSplitData();
            const responseData = applySmartWindowFilter(data);

            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            return res.status(200).json(responseData);
        } catch (error) {
            console.error('Firestore GET Error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Lỗi thao tác không xác định';
            return res.status(500).json({ success: false, error: errorMessage });
        }
    }

    if (req.method === 'POST') {
        const role = authPayload.role as UserRole;
        let operation = req.body || {};
        if (typeof operation === 'string') {
            try { operation = JSON.parse(operation); } catch (e) {}
        }

        if (role === UserRole.VIEWER) {
            return res.status(403).send('Từ chối: Bạn không có quyền sửa đổi dữ liệu');
        }
        if (role === UserRole.ACCOUNTANT) {
            const allowedOps = [
                'addIncome', 'updateIncome', 'deleteIncome', 
                'addExpense', 'updateExpense', 'deleteExpense', 
                'updateTransaction', 'addAdjustment', 'cancelInvoice', 
                'updateInvoiceStatus', 'updateUserPassword'
            ];
            if (!allowedOps.includes(operation.op)) {
                 return res.status(403).send('Từ chối: Kế toán chỉ được thay đổi dữ liệu tài chính');
            }
        }
        if (role === UserRole.PARENT) {
            if (operation.op !== 'updateUserPassword' || operation.payload?.userId !== authPayload.userId) {
                return res.status(403).send('Từ chối: Bạn không có quyền sửa đổi dữ liệu');
            }
        }

        if (operation.op === 'updateUserPassword') {
            const targetRole = operation.payload?.role;
            if (targetRole === UserRole.ADMIN && role !== UserRole.ADMIN) {
                return res.status(403).send('Từ chối: Chỉ quản trị viên mới được đổi mật khẩu Quản trị viên');
            }
            if (role !== UserRole.ADMIN && role !== UserRole.MANAGER) {
                if (!operation.payload?.currentPassword) {
                    return res.status(403).send('Từ chối: Yêu cầu mật khẩu hiện tại');
                }
                if (operation.payload.userId !== authPayload.userId) {
                    return res.status(403).send('Từ chối: Bạn chỉ có thể thay đổi mật khẩu của chính mình');
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
                    throw new Error('Từ chối: Chỉ quản trị viên mới có thể khôi phục dữ liệu');
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
                const errorMessage = error instanceof Error ? error.message : 'Lỗi thao tác không xác định';
                if (errorMessage.startsWith('Từ chối:') || errorMessage.startsWith('Forbidden:')) {
                    return res.status(403).send(errorMessage);
                }
                return res.status(400).send(`Thao tác thất bại: ${errorMessage}`);
            } finally {
                releaseLock();
            }
        } else {
            try {
                if (operation.op === 'updateAttendance') {
                    const responseData = await executeAttendanceTransaction(operation.payload);
                    return res.status(200).json(responseData);
                } else if (operation.op === 'addAdjustment') {
                    const responseData = await executeTuitionTransaction(operation.payload);
                    return res.status(200).json(responseData);
                } else {
                    const responseData = await executeOperationInternal(operation);
                    return res.status(200).json(responseData);
                }
            } catch (error) {
                console.error('Operation Error:', error);
                const errorMessage = error instanceof Error ? error.message : 'Lỗi thao tác không xác định';
                if (errorMessage.startsWith('Từ chối:') || errorMessage.startsWith('Forbidden:')) {
                    return res.status(403).send(errorMessage);
                }
                return res.status(400).send(`Thao tác thất bại: ${errorMessage}`);
            }
        }
    }

    return res.status(405).send('Method Not Allowed');
}
