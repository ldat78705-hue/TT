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

// Multi-tenant: collection name per center
const LEGACY_COLLECTION = 'db_core_v2_secure_9a8b7c6d5e4f3g2h1';

function getCollectionName(centerId?: string): string {
    if (!centerId || centerId === '_legacy') return LEGACY_COLLECTION;
    return `center_${centerId}`;
}


const BASE_COLLECTIONS = [
    'students', 'teachers', 'staff', 'classes', 'attendance', 
    'invoices', 'progressReports', 'transactions', 'income', 
    'expenses', 'payrolls', 'announcements', 'settings', 'auditLogs', 'rooms'
] as const;

const NON_SHARDED = ['students', 'teachers', 'staff', 'classes', 'progressReports', 'announcements', 'settings', 'auditLogs', 'rooms'];
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

// In-memory cache and lock for extreme performance - PER CENTER
interface CenterCache {
    cachedData: Omit<AppData, 'loading'> | null;
    rawShardStrings: Record<string, string>;
    fetchPromise: Promise<Omit<AppData, 'loading'>> | null;
    localSyncId: string;
    syncListenerSetup: boolean;
}
const centerCaches = new Map<string, CenterCache>();

function getCenterCache(centerId: string): CenterCache {
    if (!centerCaches.has(centerId)) {
        centerCaches.set(centerId, {
            cachedData: null,
            rawShardStrings: {},
            fetchPromise: null,
            localSyncId: '',
            syncListenerSetup: false
        });
    }
    return centerCaches.get(centerId)!;
}

let isLocked = false;

// Listen to _sync document changes in the background to invalidate cache across instances
function setupSyncListener(centerId: string) {
    const cache = getCenterCache(centerId);
    if (cache.syncListenerSetup) return;
    cache.syncListenerSetup = true;
    const colName = getCollectionName(centerId);
    onSnapshot(doc(db, colName, '_sync'), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const remoteSyncId = data.syncId || data.lastUpdatedAt?.toString();
            if (remoteSyncId && remoteSyncId !== cache.localSyncId) {
                console.log(`Remote sync detected for center ${centerId}, invalidating cache...`);
                cache.localSyncId = remoteSyncId;
                cache.cachedData = null;
                cache.fetchPromise = null;
            }
        }
    }, (error) => {
        console.error(`Sync listener error for center ${centerId}:`, error);
        cache.syncListenerSetup = false;
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

export async function getSplitData(centerId: string = '_legacy', forceRefresh = false): Promise<Omit<AppData, 'loading'>> {
    const cache = getCenterCache(centerId);
    const colName = getCollectionName(centerId);
    
    if (cache.cachedData && !forceRefresh) return cache.cachedData;
    if (cache.fetchPromise && !forceRefresh) return cache.fetchPromise;

    cache.fetchPromise = (async () => {
        try {
            await authenticateServer();
            setupSyncListener(centerId);
            const defaultState = getMockDataState();
            const data: any = {
                students: [], teachers: [], staff: [], classes: [], attendance: [],
                invoices: [], progressReports: [], transactions: [], income: [],
                expenses: [], payrolls: [], announcements: [], settings: defaultState.settings,
                auditLogs: [], rooms: []
            };
            
            let hasData = false;
            const newRawStrings: Record<string, string> = {};

            const querySnapshot = await getDocs(collection(db, colName));
            
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
                console.log(`Firestore collection ${colName} is empty. Seeding with initial mock data.`);
                
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
                    batch.set(doc(db, colName, col), { data: defaultState[col] });
                    data[col] = defaultState[col];
                    newRawStrings[col] = JSON.stringify(defaultState[col]);
                });
                const newSyncId = Date.now().toString() + '_' + Math.random().toString(36).substring(2);
                batch.set(doc(db, colName, '_sync'), { syncId: newSyncId, lastUpdatedAt: Date.now() });
                await batch.commit();
                cache.localSyncId = newSyncId;
            }

            cache.rawShardStrings = newRawStrings;
            cache.cachedData = data as Omit<AppData, 'loading'>;
            return cache.cachedData;
        } catch (error) {
            cache.fetchPromise = null;
            throw error;
        }
    })();

    return cache.fetchPromise;
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

    // Strip passwords from ALL user types
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
    if (filtered.students) {
        filtered.students = filtered.students.map((s: any) => {
            const { password, ...rest } = s;
            return rest;
        });
    }
    if (filtered.settings) {
        const { adminPassword, zaloAccessToken, zaloTokenExpiresAt, ...safeSettings } = filtered.settings;
        filtered.settings = safeSettings;
    }

    return filtered;
}

/**
 * Filter data for PARENT role: only return data relevant to their student.
 * Hides: staff, income, expenses, payrolls, auditLogs, other students' data.
 */
function applyParentFilter(data: any, studentId: string): any {
    const filtered = { ...data };

    // Only their own student
    if (filtered.students) {
        filtered.students = filtered.students.filter((s: any) => s.id === studentId);
    }

    // Only classes the student is enrolled in
    const myClassIds = new Set<string>();
    if (filtered.classes) {
        filtered.classes = filtered.classes.filter((c: any) => {
            const enrolled = (c.studentIds || []).includes(studentId);
            if (enrolled) myClassIds.add(c.id);
            return enrolled;
        });
    }

    // Only teachers who teach the student's classes
    const myTeacherIds = new Set<string>();
    if (filtered.classes) {
        filtered.classes.forEach((c: any) => {
            (c.teacherIds || []).forEach((tid: string) => myTeacherIds.add(tid));
        });
    }
    if (filtered.teachers) {
        filtered.teachers = filtered.teachers.filter((t: any) => myTeacherIds.has(t.id));
    }

    // Only the student's attendance
    if (filtered.attendance) {
        filtered.attendance = filtered.attendance.filter((a: any) => a.studentId === studentId);
    }

    // Only the student's transactions
    if (filtered.transactions) {
        filtered.transactions = filtered.transactions.filter((t: any) => t.studentId === studentId);
    }

    // Only the student's invoices
    if (filtered.invoices) {
        filtered.invoices = filtered.invoices.filter((inv: any) => inv.studentId === studentId);
    }

    // Only the student's progress reports
    if (filtered.progressReports) {
        filtered.progressReports = filtered.progressReports.filter((p: any) => p.studentId === studentId);
    }

    // Filter announcements: only ALL, STUDENTS, or targeted to this student/class
    if (filtered.announcements) {
        filtered.announcements = filtered.announcements.filter((ann: any) => {
            if (!ann.targetAudience || ann.targetAudience === 'ALL' || ann.targetAudience === 'STUDENTS') return true;
            if (ann.targetAudience === 'CLASS' && ann.classId) return myClassIds.has(ann.classId);
            if (ann.targetAudience === 'SPECIFIC_STUDENTS' && ann.targetStudentIds) return ann.targetStudentIds.includes(studentId);
            return false;
        });
    }

    // Hide sensitive center data entirely
    filtered.staff = [];
    filtered.income = [];
    filtered.expenses = [];
    filtered.payrolls = [];
    filtered.auditLogs = [];
    filtered.rooms = [];

    return filtered;
}

export async function executeOperationInternal(operation: { op: string, payload: any }, centerId: string = '_legacy') {
    await acquireLock();
    try {
        await authenticateServer();
        const cache = getCenterCache(centerId);
        const colName = getCollectionName(centerId);
        const currentData = await getSplitData(centerId);
        const dataClone = structuredClone(currentData);
        const updatedData = applyOperation(dataClone, operation);
        const updatedShards = shardAppData(updatedData);

        const batch = writeBatch(db);
        let hasChanges = false;
        const pendingRawStringsUpdates: Record<string, string | null> = {};
        
        Object.keys(updatedShards).forEach(key => {
            const oldStr = cache.rawShardStrings[key];
            const newStr = JSON.stringify(updatedShards[key]);
            if (oldStr !== newStr) {
                batch.set(doc(db, colName, key), { data: updatedShards[key] });
                hasChanges = true;
                pendingRawStringsUpdates[key] = newStr;
            }
        });

        Object.keys(cache.rawShardStrings).forEach(key => {
            if (key !== '_sync' && updatedShards[key] === undefined) {
                batch.delete(doc(db, colName, key));
                hasChanges = true;
                pendingRawStringsUpdates[key] = null;
            }
        });

        if (hasChanges) {
            const newSyncId = Date.now().toString() + '_' + Math.random().toString(36).substring(2);
            batch.set(doc(db, colName, '_sync'), { syncId: newSyncId, lastUpdatedAt: Date.now() });
            
            cache.cachedData = updatedData;
            cache.localSyncId = newSyncId;
            
            try {
                await batch.commit();
                Object.keys(pendingRawStringsUpdates).forEach(key => {
                    const val = pendingRawStringsUpdates[key];
                    if (val === null) delete cache.rawShardStrings[key];
                    else cache.rawShardStrings[key] = val;
                });
            } catch (err) {
                cache.cachedData = null; 
                throw err;
            }
        }
        return applySmartWindowFilter(updatedData);
    } finally {
        releaseLock();
    }
}

export async function executeAttendanceTransaction(payload: any, centerId: string = '_legacy') {
    await acquireLock();
    try {
        await authenticateServer();
        const cache = getCenterCache(centerId);
        const colName = getCollectionName(centerId);
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
            const shardRefs = Array.from(shardsAffected).map(k => doc(db, colName, k));
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
                
                // Which shard does this class+date belong to? Must include classId!
                const sample = { date, classId };
                const sKey = getShardKey(sample, 'attendance');
                
                if (!updatedShardsData[sKey]) {
                    updatedShardsData[sKey] = [...(currentData[sKey] || [])]; // clone, fallback to empty
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
                const ref = doc(db, colName, sKey);
                transaction.set(ref, { data: updatedShardsData[sKey] });
            });

            const syncRef = doc(db, colName, '_sync');
            const newSyncId = Date.now().toString() + '_' + Math.random().toString(36).substring(2);
            transaction.set(syncRef, { syncId: newSyncId, lastUpdatedAt: Date.now() });
        });
        
        // Force full refresh next time
        cache.cachedData = null;
        cache.fetchPromise = null;
        
        // Return latest full data
        return applySmartWindowFilter(await getSplitData(centerId));
    } finally {
        releaseLock();
    }
}

export async function executeTuitionTransaction(payload: any, centerId: string = '_legacy') {
    await acquireLock();
    try {
        await authenticateServer();
        const cache = getCenterCache(centerId);
        const colName = getCollectionName(centerId);
        const { studentId, amount, date, description, type, paymentMethod } = payload;
        const finalAmount = type === 'CREDIT' ? amount : -amount;
        
        const shardKey = getShardKey({ date }, 'transactions');
        
        await runTransaction(db, async (transaction) => {
            const txRef = doc(db, colName, shardKey);
            const studentsRef = doc(db, colName, 'students');
            
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
            
            const syncRef = doc(db, colName, '_sync');
            const newSyncId = Date.now().toString() + '_' + Math.random().toString(36).substring(2);
            transaction.set(syncRef, { syncId: newSyncId, lastUpdatedAt: Date.now() });
        });
        
        cache.cachedData = null;
        cache.fetchPromise = null;
        
        return applySmartWindowFilter(await getSplitData(centerId));
    } finally {
        releaseLock();
    }
}

export default async function handler(req: any, res: any) {
    const authPayload = await getAuthPayload(req);
    if (!authPayload) {
        return res.status(401).json({ success: false, error: 'Không có quyền truy cập: Chỉ quản trị viên mới được thao tác' });
    }
    // Extract centerId from JWT - backward compatible with old tokens
    const centerId = (authPayload as any).centerId || '_legacy';

    if (req.method === 'GET') {
        try {
            // ETag-based caching: check if client already has latest data
            const clientETag = req.headers['if-none-match'];
            const cache = getCenterCache(centerId);
            
            // If client has an ETag and server cache exists with matching syncId,
            // return 304 without reading Firestore at all
            if (clientETag && cache.localSyncId && clientETag === cache.localSyncId && cache.cachedData) {
                res.setHeader('ETag', cache.localSyncId);
                res.setHeader('Cache-Control', 'no-cache');
                return res.status(304).end();
            }

            const data = await getSplitData(centerId);
            let responseData = applySmartWindowFilter(data);

            // Apply PARENT-specific data filter: only return data for their student
            const role = authPayload.role as UserRole;
            if (role === UserRole.PARENT) {
                responseData = applyParentFilter(responseData, (authPayload as any).userId as string);
            }

            // Set ETag from syncId for client-side caching
            if (cache.localSyncId) {
                res.setHeader('ETag', cache.localSyncId);
            }
            res.setHeader('Cache-Control', 'no-cache');
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
        // MANAGER: block dangerous admin-only operations
        if (role === UserRole.MANAGER) {
            const blockedManagerOps = ['clearCollections', 'updateSettings'];
            if (blockedManagerOps.includes(operation.op)) {
                return res.status(403).send('Từ chối: Chỉ quản trị viên mới được thực hiện thao tác này');
            }
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
        // TEACHER: whitelist allowed operations
        if (role === UserRole.TEACHER) {
            const allowedTeacherOps = [
                'updateAttendance',
                'addProgressReport', 'updateProgressReport', 'deleteProgressReport',
                'addAnnouncement', 'updateAnnouncement', 'deleteAnnouncement',
                'updateUserPassword', 'addAuditLog'
            ];
            if (!allowedTeacherOps.includes(operation.op)) {
                return res.status(403).send('Từ chối: Giáo viên không có quyền thực hiện thao tác này');
            }
        }
        if (role === UserRole.PARENT) {
            const allowedParentOps = ['updateUserPassword', 'updateSingleAttendance'];
            if (!allowedParentOps.includes(operation.op)) {
                return res.status(403).send('Từ chối: Bạn không có quyền sửa đổi dữ liệu');
            }
            if (operation.op === 'updateUserPassword' && operation.payload?.userId !== authPayload.userId) {
                return res.status(403).send('Từ chối: Bạn chỉ có thể thay đổi mật khẩu của chính mình');
            }
            if (operation.op === 'updateSingleAttendance') {
                // Parent can only submit EXCUSED_ABSENT for their own student
                const parentStudentId = authPayload.userId;
                const p = operation.payload;
                if (p.studentId !== parentStudentId) {
                    return res.status(403).send('Từ chối: Bạn chỉ có thể xin nghỉ cho con mình');
                }
                if (p.status !== 'EXCUSED_ABSENT') {
                    return res.status(403).send('Từ chối: Phụ huynh chỉ có thể xin nghỉ phép');
                }
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
                const colName = getCollectionName(centerId);
                if (role !== UserRole.ADMIN) {
                    throw new Error('Từ chối: Chỉ quản trị viên mới có thể khôi phục dữ liệu');
                }
                const restoredDataFromFile = operation.payload as Omit<AppData, 'loading'>;
                const restoredShards = shardAppData(restoredDataFromFile);
                
                const batch = writeBatch(db);

                // 1. Delete all existing documents to ensure a clean slate
                const querySnapshot = await getDocs(collection(db, colName));
                querySnapshot.forEach(docSnap => {
                    batch.delete(docSnap.ref);
                });

                // 2. Set new shards from the backup
                const newRawStrings: Record<string, string> = {};
                Object.keys(restoredShards).forEach(key => {
                    batch.set(doc(db, colName, key), { data: restoredShards[key] });
                    newRawStrings[key] = JSON.stringify(restoredShards[key]);
                });
                
                const newSyncId = Date.now().toString() + '_' + Math.random().toString(36).substring(2);
                batch.set(doc(db, colName, '_sync'), { syncId: newSyncId, lastUpdatedAt: Date.now() });
                
                try {
                    await batch.commit();
                    const cache = getCenterCache(centerId);
                    cache.cachedData = restoredDataFromFile;
                    cache.localSyncId = newSyncId;
                    cache.rawShardStrings = newRawStrings;
                } catch (err) {
                    console.error("Restore commit failed:", err);
                    const cache = getCenterCache(centerId);
                    cache.cachedData = null;
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
                let responseData: any;
                if (operation.op === 'updateAttendance') {
                    responseData = await executeAttendanceTransaction(operation.payload, centerId);
                } else if (operation.op === 'addAdjustment') {
                    responseData = await executeTuitionTransaction(operation.payload, centerId);
                } else {
                    responseData = await executeOperationInternal(operation, centerId);
                }

                // === AUDIT LOG ===
                try {
                    const userName = (authPayload as any).name || (authPayload as any).email || 'Unknown';
                    const userId = (authPayload as any).userId || (authPayload as any).sub || '';
                    const auditEntry = buildAuditEntry(operation.op, operation.payload, userId, userName);
                    if (auditEntry) {
                        // Fire-and-forget: don't block response for logging
                        executeOperationInternal({ op: 'addAuditLog', payload: auditEntry }, centerId).catch(() => {});
                    }
                } catch (logErr) { /* silently ignore audit failures */ }

                // Set ETag in response for client cache sync
                const cacheAfterWrite = getCenterCache(centerId);
                if (cacheAfterWrite.localSyncId) {
                    res.setHeader('ETag', cacheAfterWrite.localSyncId);
                }

                return res.status(200).json(responseData);
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

// === AUDIT LOG BUILDER ===
function buildAuditEntry(op: string, payload: any, userId: string, userName: string) {
    const OP_MAP: Record<string, { targetType: string; getDetails: (p: any) => { targetName: string; details: string } | null }> = {
        addClass: { targetType: 'class', getDetails: (p) => ({ targetName: p.name || '', details: `Thêm lớp "${p.name}"` }) },
        updateClass: { targetType: 'class', getDetails: (p) => ({ targetName: p.updatedClass?.name || p.originalId || '', details: `Cập nhật lớp "${p.updatedClass?.name || p.originalId}"` }) },
        deleteClass: { targetType: 'class', getDetails: (p) => ({ targetName: p.classId || '', details: `Xóa lớp ${p.classId}` }) },
        addStudent: { targetType: 'student', getDetails: (p) => ({ targetName: p.student?.name || p.name || '', details: `Thêm học viên "${p.student?.name || p.name}"` }) },
        updateStudent: { targetType: 'student', getDetails: (p) => ({ targetName: p.updatedStudent?.name || '', details: `Cập nhật học viên "${p.updatedStudent?.name}"` }) },
        deleteStudent: { targetType: 'student', getDetails: (p) => ({ targetName: p.studentId || '', details: `Xóa học viên ${p.studentId}` }) },
        addTeacher: { targetType: 'teacher', getDetails: (p) => ({ targetName: p.teacher?.name || '', details: `Thêm giáo viên "${p.teacher?.name}"` }) },
        updateTeacher: { targetType: 'teacher', getDetails: (p) => ({ targetName: p.updatedTeacher?.name || '', details: `Cập nhật giáo viên "${p.updatedTeacher?.name}"` }) },
        updateAttendance: { targetType: 'attendance', getDetails: (p) => {
            const records = Array.isArray(p) ? p : [];
            const classId = records[0]?.classId || '';
            const date = records[0]?.date || '';
            return { targetName: `${classId}`, details: `Điểm danh lớp ${classId} ngày ${date} (${records.length} HS)` };
        }},
        addAdjustment: { targetType: 'finance', getDetails: (p) => ({ targetName: p.studentId || '', details: `Thanh toán ${p.amount}đ cho HS ${p.studentId}` }) },
        addAnnouncement: { targetType: 'announcement', getDetails: (p) => ({ targetName: p.title || '', details: `Thêm thông báo "${p.title}"` }) },
        deleteAnnouncement: { targetType: 'announcement', getDetails: (p) => ({ targetName: p.id || '', details: `Xóa thông báo ${p.id}` }) },
        addRoom: { targetType: 'room', getDetails: (p) => ({ targetName: p.name || '', details: `Thêm phòng "${p.name}"` }) },
        updateRoom: { targetType: 'room', getDetails: (p) => ({ targetName: p.name || p.id || '', details: `Cập nhật phòng "${p.name || p.id}"` }) },
        deleteRoom: { targetType: 'room', getDetails: (p) => ({ targetName: p.roomId || p.id || '', details: `Xóa phòng ${p.roomId || p.id}` }) },
        updateSettings: { targetType: 'settings', getDetails: () => ({ targetName: 'Cài đặt', details: 'Cập nhật cài đặt hệ thống' }) },
        restoreData: { targetType: 'system', getDetails: () => ({ targetName: 'Hệ thống', details: 'Khôi phục dữ liệu từ bản sao lưu' }) },
    };
    const mapper = OP_MAP[op];
    if (!mapper) return null;
    const result = mapper.getDetails(payload);
    if (!result) return null;
    return {
        userId, userName,
        action: op,
        targetType: mapper.targetType,
        targetName: result.targetName,
        details: result.details,
        timestamp: new Date().toISOString()
    };
}
