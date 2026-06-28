import type { AppData } from '../types.js';
import { getMockDataState } from './_lib/mockData.js';
import { applyOperation } from './_lib/operations.js';
import { verifyToken } from './_lib/jwt.js';
import { UserRole } from '../types.js';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, getDocs, setDoc, collection, writeBatch, onSnapshot, runTransaction } from 'firebase/firestore';
import { hashPassword, verifyPassword } from './_lib/crypto.js';
import { authenticateServer } from './_lib/serverAuth.js';
import { validateOperation } from './_lib/validation.js';
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

/** Remove a center from the in-memory cache (called when center is deleted) */
export function invalidateCenterCache(centerId: string) {
    centerCaches.delete(centerId);
    centerRegistryCache.delete(centerId);
}

// Cache center registry status to avoid Firestore read on every request
const centerRegistryCache = new Map<string, { status: string; checkedAt: number }>();
const CENTER_REGISTRY_TTL = 60_000; // 1 minute TTL

async function validateCenterStatus(centerId: string): Promise<{ valid: boolean; error?: string }> {
    if (!centerId || centerId === '_legacy') return { valid: true };
    
    const cached = centerRegistryCache.get(centerId);
    const now = Date.now();
    if (cached && now - cached.checkedAt < CENTER_REGISTRY_TTL) {
        if (cached.status === 'DELETED') return { valid: false, error: 'Trung tâm đã bị xóa khỏi hệ thống. Vui lòng đăng xuất.' };
        if (cached.status === 'LOCKED') return { valid: false, error: 'Trung tâm đã bị khóa. Vui lòng liên hệ quản trị viên hệ thống.' };
        return { valid: true };
    }
    
    try {
        const centerDoc = await getDoc(doc(db, 'centers_registry', centerId));
        if (!centerDoc.exists()) {
            centerRegistryCache.set(centerId, { status: 'DELETED', checkedAt: now });
            return { valid: false, error: 'Trung tâm đã bị xóa khỏi hệ thống. Vui lòng đăng xuất.' };
        }
        const centerData = centerDoc.data();
        const status = centerData.status || 'ACTIVE';
        centerRegistryCache.set(centerId, { status, checkedAt: now });
        if (status === 'LOCKED') {
            return { valid: false, error: 'Trung tâm đã bị khóa. Vui lòng liên hệ quản trị viên hệ thống.' };
        }
        return { valid: true };
    } catch (e) {
        console.error('Center validation error:', e);
        return { valid: true }; // Fail open on network errors
    }
}

let isLocked = false;

// Per-center lock map for multi-tenant performance
const centerLocks = new Map<string, boolean>();

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

async function acquireLock(centerId?: string): Promise<void> {
    if (centerId) {
        // Per-center lock: only blocks writes to the same center
        while (centerLocks.get(centerId)) {
            await new Promise(resolve => setTimeout(resolve, 30));
        }
        centerLocks.set(centerId, true);
    } else {
        // Global lock fallback
        while (isLocked) {
            await new Promise(resolve => setTimeout(resolve, 30));
        }
        isLocked = true;
    }
}

function releaseLock(centerId?: string) {
    if (centerId) {
        centerLocks.delete(centerId);
    } else {
        isLocked = false;
    }
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
                // CRITICAL: Only auto-seed for legacy collection or centers that exist in registry
                // This prevents deleted centers from being re-created
                let shouldSeed = (centerId === '_legacy');
                if (!shouldSeed) {
                    try {
                        const registryDoc = await getDoc(doc(db, 'centers_registry', centerId));
                        shouldSeed = registryDoc.exists();
                    } catch (e) {
                        console.error(`Failed to check registry for center ${centerId}:`, e);
                        shouldSeed = false;
                    }
                }

                if (shouldSeed) {
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
                } else {
                    console.log(`Center ${centerId} not found in registry. Skipping auto-seed to prevent re-creation of deleted center.`);
                }
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
        const { adminPassword, viewerPassword, zaloAccessToken, zaloTokenExpiresAt, zaloAppId, zaloSecretKey, zaloRefreshToken, webhookSecretKey, ...safeSettings } = filtered.settings;
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

    // Only their own student (strip internal staff-only data)
    if (filtered.students) {
        filtered.students = filtered.students
            .filter((s: any) => s.id === studentId)
            .map((s: any) => { const { internalNotes, tags, ...rest } = s; return rest; });
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

/**
 * Filter data for TEACHER role: hide financial data, audit logs, etc.
 * Teachers should only see: classes (their own), students (in their classes),
 * teachers (themselves), attendance, progress reports, announcements, settings.
 */
function applyTeacherFilter(data: any, teacherId: string): any {
    const filtered = { ...data };

    // Find classes this teacher is assigned to
    const teacherClassIds = new Set<string>();
    const teacherStudentIds = new Set<string>();
    if (filtered.classes) {
        filtered.classes.forEach((cls: any) => {
            if ((cls.teacherIds || []).includes(teacherId)) {
                teacherClassIds.add(cls.id);
                (cls.studentIds || []).forEach((sid: string) => teacherStudentIds.add(sid));
            }
        });
    }

    // Only students in teacher's classes (strip balance + internal notes)
    if (filtered.students) {
        filtered.students = filtered.students
            .filter((s: any) => teacherStudentIds.has(s.id))
            .map((s: any) => { const { balance, internalNotes, ...rest } = s; return { ...rest, balance: 0 }; });
    }

    // Only attendance for teacher's classes
    if (filtered.attendance) {
        filtered.attendance = filtered.attendance.filter((a: any) => teacherClassIds.has(a.classId));
    }

    // Only progress reports for teacher's classes
    if (filtered.progressReports) {
        filtered.progressReports = filtered.progressReports.filter((p: any) => teacherClassIds.has(p.classId));
    }

    // Filter announcements: ALL, TEACHERS, or teacher's classes
    if (filtered.announcements) {
        filtered.announcements = filtered.announcements.filter((ann: any) => {
            if (!ann.targetAudience || ann.targetAudience === 'ALL' || ann.targetAudience === 'TEACHERS') return true;
            // Hide MANAGEMENT announcements from teachers
            if (ann.targetAudience === 'MANAGEMENT') return false;
            if ((ann.targetAudience === 'CLASS' || ann.targetAudience === 'SPECIFIC_STUDENTS') && ann.classId) {
                return teacherClassIds.has(ann.classId);
            }
            return false; // Hide STUDENTS-only announcements from teachers
        });
    }

    // Hide ALL financial & sensitive data
    filtered.transactions = [];
    filtered.income = [];
    filtered.expenses = [];
    filtered.payrolls = [];
    filtered.invoices = [];
    filtered.auditLogs = [];
    filtered.staff = [];

    return filtered;
}

// Map operations to the collections they affect — used to skip unnecessary shard comparisons
// CRITICAL: Must match EXACTLY what each case in operations.ts touches
function getAffectedCollections(opName: string): string[] | null {
    const map: Record<string, string[]> = {
        // Student operations
        addStudent: ['students', 'classes'],
        updateStudent: ['students', 'classes', 'attendance', 'invoices', 'progressReports', 'transactions'],
        deleteStudent: ['students', 'classes', 'transactions', 'attendance', 'progressReports', 'invoices'],
        archiveStudent: ['students', 'classes'],
        restoreStudent: ['students'],
        addStudentNote: ['students'],
        deleteStudentNote: ['students'],
        updateStudentTags: ['students'],
        // Teacher operations
        addTeacher: ['teachers'],
        updateTeacher: ['teachers', 'classes', 'attendance', 'payrolls', 'expenses'],
        deleteTeacher: ['teachers', 'classes'],
        // Staff operations
        addStaff: ['staff'],
        updateStaff: ['staff'],
        deleteStaff: ['staff'],
        // Class operations
        addClass: ['classes'],
        updateClass: ['classes', 'attendance', 'progressReports', 'announcements', 'payrolls'],
        deleteClass: ['classes', 'progressReports', 'announcements'],
        // Attendance — updateSingleAttendance can also create announcements
        updateAttendance: ['attendance'],
        updateSingleAttendance: ['attendance', 'announcements'],
        deleteAttendanceForDate: ['attendance'],
        deleteAttendanceByMonth: ['attendance'],
        // Finance
        addAdjustment: ['transactions', 'students', 'invoices'],
        addAdvancePayment: ['transactions', 'students', 'invoices'],
        updateTransaction: ['transactions', 'students', 'invoices'],
        deleteTransaction: ['transactions', 'students', 'invoices'],
        clearAllTransactions: ['transactions', 'students', 'invoices'],
        generateInvoices: ['invoices', 'transactions', 'students'],
        cancelInvoice: ['invoices', 'transactions', 'students'],
        updateInvoiceStatus: ['invoices', 'transactions', 'students'],
        // Payrolls — can also create/update/delete expenses
        generatePayrolls: ['payrolls', 'expenses'],
        updatePayroll: ['payrolls', 'expenses'],
        // Reports
        addProgressReport: ['progressReports'],
        addBulkProgressReports: ['progressReports'],
        updateProgressReport: ['progressReports'],
        deleteProgressReport: ['progressReports'],
        // Income/Expense
        addIncome: ['income'],
        updateIncome: ['income'],
        deleteIncome: ['income'],
        addExpense: ['expenses'],
        updateExpense: ['expenses'],
        deleteExpense: ['expenses'],
        // Announcements
        addAnnouncement: ['announcements'],
        deleteAnnouncement: ['announcements'],
        markAnnouncementRead: ['announcements'],
        markAnnouncementsReadBatch: ['announcements'],
        // Settings
        updateSettings: ['settings'],
        updateUserPassword: ['teachers', 'staff', 'students', 'settings'],
        // Rooms — deleteRoom also modifies classes (removes roomId from schedules)
        addRoom: ['rooms'],
        updateRoom: ['rooms'],
        deleteRoom: ['rooms', 'classes'],
        // Maintenance
        recalculateAllInvoices: ['invoices'],
        // Audit
        addAuditLog: ['auditLogs'],
    };
    return map[opName] || null; // null = compare all (safe fallback for unknown ops)
}

export async function executeOperationInternal(operation: { op: string, payload: any }, centerId: string = '_legacy') {
    await acquireLock(centerId);
    try {
        await authenticateServer();
        const cache = getCenterCache(centerId);
        const colName = getCollectionName(centerId);
        const currentData = await getSplitData(centerId);
        const dataClone = structuredClone(currentData);
        const updatedData = applyOperation(dataClone, operation);
        const updatedShards = shardAppData(updatedData);

        // Performance: Only compare shards that this operation could have changed
        const affectedCollections = getAffectedCollections(operation.op);

        const batch = writeBatch(db);
        let hasChanges = false;
        const pendingRawStringsUpdates: Record<string, string | null> = {};
        
        Object.keys(updatedShards).forEach(key => {
            // Skip shards that couldn't have been affected by this operation
            if (affectedCollections && !affectedCollections.some(col => key === col || key.startsWith(col + '_'))) {
                return;
            }
            const oldStr = cache.rawShardStrings[key];
            const newStr = JSON.stringify(updatedShards[key]);
            if (oldStr !== newStr) {
                batch.set(doc(db, colName, key), { data: updatedShards[key] });
                hasChanges = true;
                pendingRawStringsUpdates[key] = newStr;
            }
        });

        // Only check deletions for affected collections
        Object.keys(cache.rawShardStrings).forEach(key => {
            if (key !== '_sync' && updatedShards[key] === undefined) {
                if (affectedCollections && !affectedCollections.some(col => key === col || key.startsWith(col + '_'))) {
                    return;
                }
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
        releaseLock(centerId);
    }
}

export async function executeAttendanceTransaction(payload: any, centerId: string = '_legacy') {
    await acquireLock(centerId);
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

        // Track new records with generated IDs for cache update
        let committedNewRecords: any[] = [];
        
        await runTransaction(db, async (transaction) => {
            // Reset on each retry attempt to prevent duplicate records
            committedNewRecords = [];
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
                committedNewRecords.push(...recordsWithIds);
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
        
        // Performance: Update attendance in-place in cache instead of full re-read
        if (cache.cachedData) {
            const updatedData = { ...cache.cachedData };
            // Remove old records for affected class+date combos
            const classDateKeys = new Set<string>();
            records.forEach((r: any) => classDateKeys.add(`${r.classId}|${r.date}`));
            const filteredAttendance = updatedData.attendance.filter((a: any) => !classDateKeys.has(`${a.classId}|${a.date}`));
            // Add the committed new records (which have generated IDs and teacherIds)
            updatedData.attendance = [...filteredAttendance, ...committedNewRecords];
            cache.cachedData = updatedData as any;
            const newSyncFromTx = Date.now().toString() + '_' + Math.random().toString(36).substring(2);
            cache.localSyncId = newSyncFromTx;
            
            // Also update rawShardStrings for affected attendance shards
            // to prevent false-positive dirty writes on subsequent operations
            const affectedShardKeys = new Set<string>();
            records.forEach((r: any) => affectedShardKeys.add(getShardKey(r, 'attendance')));
            for (const sKey of affectedShardKeys) {
                const shardRecords = updatedData.attendance.filter((a: any) => getShardKey(a, 'attendance') === sKey);
                cache.rawShardStrings[sKey] = JSON.stringify(shardRecords);
            }
            
            return applySmartWindowFilter(updatedData);
        }
        
        // Fallback: full re-read if cache was empty
        cache.cachedData = null;
        cache.fetchPromise = null;
        return applySmartWindowFilter(await getSplitData(centerId));
    } finally {
        releaseLock(centerId);
    }
}

export async function executeTuitionTransaction(payload: any, centerId: string = '_legacy') {
    await acquireLock(centerId);
    try {
        await authenticateServer();
        const cache = getCenterCache(centerId);
        const colName = getCollectionName(centerId);
        const { studentId, amount, date, description, type, paymentMethod } = payload;
        const finalAmount = type === 'CREDIT' ? amount : -amount;
        
        const shardKey = getShardKey({ date }, 'transactions');
        const generateUniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const newTxRecord = { 
            id: generateUniqueId('TRX'), 
            studentId, 
            date, 
            type: type === 'CREDIT' ? 'PAYMENT' : 'ADJUSTMENT_DEBIT', 
            description, 
            amount: finalAmount, 
            paymentMethod: paymentMethod || 'transfer' 
        };
        let newSyncId = '';
        
        await runTransaction(db, async (transaction) => {
            const txRef = doc(db, colName, shardKey);
            const studentsRef = doc(db, colName, 'students');
            
            const [txSnap, studentsSnap] = await Promise.all([transaction.get(txRef), transaction.get(studentsRef)]);
            
            const transactions = txSnap.exists() ? txSnap.data().data || [] : [];
            const students = studentsSnap.exists() ? studentsSnap.data().data || [] : [];
            
            const student = students.find((s: any) => s.id === studentId);
            if (student) {
                student.balance += finalAmount;
            }
            
            transactions.push(newTxRecord);
            
            transaction.set(txRef, { data: transactions });
            transaction.set(studentsRef, { data: students });
            
            const syncRef = doc(db, colName, '_sync');
            newSyncId = Date.now().toString() + '_' + Math.random().toString(36).substring(2);
            transaction.set(syncRef, { syncId: newSyncId, lastUpdatedAt: Date.now() });
        });
        
        // Performance: Update cache in-place instead of full re-read from Firestore
        if (cache.cachedData) {
            const updatedData = { ...cache.cachedData };
            // Update student balance
            updatedData.students = updatedData.students.map((s: any) => 
                s.id === studentId ? { ...s, balance: s.balance + finalAmount } : s
            );
            // Add transaction
            updatedData.transactions = [...updatedData.transactions, newTxRecord as any];
            cache.cachedData = updatedData as any;
            cache.localSyncId = newSyncId;
            // Update raw shard strings for dirty-check
            cache.rawShardStrings['students'] = JSON.stringify(updatedData.students);
            const txShardData = JSON.parse(cache.rawShardStrings[shardKey] || '[]');
            txShardData.push(newTxRecord);
            cache.rawShardStrings[shardKey] = JSON.stringify(txShardData);
            return applySmartWindowFilter(updatedData);
        }
        
        // Fallback: full re-read if cache was empty
        cache.cachedData = null;
        cache.fetchPromise = null;
        return applySmartWindowFilter(await getSplitData(centerId));
    } finally {
        releaseLock(centerId);
    }
}

export default async function handler(req: any, res: any) {
    const authPayload = await getAuthPayload(req);
    if (!authPayload) {
        return res.status(401).json({ success: false, error: 'Không có quyền truy cập: Chỉ quản trị viên mới được thao tác' });
    }
    // Extract centerId from JWT - backward compatible with old tokens
    const centerId = (authPayload as any).centerId || '_legacy';

    // === CRITICAL: Validate center still exists and is active (cached) ===
    const centerValidation = await validateCenterStatus(centerId);
    if (!centerValidation.valid) {
        return res.status(403).json({ 
            success: false, 
            error: centerValidation.error,
            forceLogout: true 
        });
    }
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

            // Apply role-specific data filters
            const role = authPayload.role as UserRole;
            if (role === UserRole.PARENT) {
                responseData = applyParentFilter(responseData, (authPayload as any).userId as string);
            } else if (role === UserRole.TEACHER) {
                responseData = applyTeacherFilter(responseData, (authPayload as any).userId as string);
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

        // Validate operation payload with Zod schemas
        const validationError = validateOperation(operation.op, operation.payload);
        if (validationError) {
            return res.status(400).send(`Dữ liệu không hợp lệ: ${validationError}`);
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
                'updateTransaction', 'deleteTransaction', 'addAdjustment', 'addAdvancePayment', 'cancelInvoice', 
                'updateInvoiceStatus', 'generateInvoices', 'generatePayrolls', 'updatePayroll', 'updateUserPassword',
                'markAnnouncementRead', 'markAnnouncementsReadBatch'
            ];
            if (!allowedOps.includes(operation.op)) {
                 return res.status(403).send('Từ chối: Kế toán chỉ được thay đổi dữ liệu tài chính');
            }
        }
        // TEACHER: whitelist allowed operations
        if (role === UserRole.TEACHER) {
            const allowedTeacherOps = [
                'updateAttendance',
                'addProgressReport', 'updateProgressReport', 'deleteProgressReport', 'addBulkProgressReports',
                'addAnnouncement', 'updateAnnouncement', 'deleteAnnouncement',
                'updateUserPassword', 'addAuditLog', 'markAnnouncementRead', 'markAnnouncementsReadBatch',
                'addStudentNote', 'deleteStudentNote', 'updateStudentTags'
            ];
            if (!allowedTeacherOps.includes(operation.op)) {
                return res.status(403).send('Từ chối: Giáo viên không có quyền thực hiện thao tác này');
            }
        }
        if (role === UserRole.PARENT) {
            const allowedParentOps = ['updateUserPassword', 'updateSingleAttendance', 'markAnnouncementRead', 'markAnnouncementsReadBatch'];
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
            
            // Server-side currentPassword verification (bcrypt-aware)
            // operations.ts only does plain string compare which breaks with bcrypt hashes
            if (operation.payload.currentPassword) {
                const { userId, role: pwRole, currentPassword: inputCurrent } = operation.payload;
                let storedPassword: string | null = null;
                
                // Load current data to check stored password
                const pwCheckData = await getSplitData(centerId);
                
                if (pwRole === UserRole.ADMIN) {
                    storedPassword = pwCheckData.settings?.adminPassword || '123456';
                } else {
                    let userList: any[] = [];
                    if (pwRole === UserRole.PARENT) userList = pwCheckData.students;
                    else if (pwRole === UserRole.TEACHER) userList = pwCheckData.teachers;
                    else if (pwRole === UserRole.MANAGER || pwRole === UserRole.ACCOUNTANT) userList = pwCheckData.staff;
                    
                    const targetUser = userList.find((u: any) => u.id === userId);
                    if (targetUser) {
                        const dobPwd = targetUser.dob ? targetUser.dob.split('-').reverse().join('') : null;
                        storedPassword = targetUser.password || dobPwd;
                    }
                }
                
                if (storedPassword) {
                    // Support bcrypt, SHA-256, and plaintext passwords
                    const isValid = inputCurrent === storedPassword || verifyPassword(inputCurrent, storedPassword);
                    if (!isValid) {
                        return res.status(400).send('Mật khẩu hiện tại không đúng.');
                    }
                }
                
                // Clear currentPassword so operations.ts skips its own (broken) plain-string check
                delete operation.payload.currentPassword;
            }
            
            if (operation.payload.newPassword) {
                operation.payload.newPassword = hashPassword(operation.payload.newPassword);
            }
        }

        // Hash passwords for other operations
        // Helper: detect if a string is already a bcrypt or SHA-256 hash
        const isAlreadyHashed = (s: string) => s.startsWith('$2a$') || s.startsWith('$2b$') || /^[0-9a-f]{64}$/i.test(s);
        
        if (operation.op === 'addTeacher' || operation.op === 'updateTeacher') {
            // addTeacher sends flat payload { id, name, password, ... }
            // updateTeacher sends { originalId, updatedTeacher: { ... } }
            const t = operation.op === 'addTeacher' ? operation.payload : operation.payload.updatedTeacher;
            if (t && t.password && !isAlreadyHashed(t.password)) {
                t.password = hashPassword(t.password);
            }
        }
        if (operation.op === 'addStaff' || operation.op === 'updateStaff') {
            // addStaff sends flat payload { id, name, password, ... }
            // updateStaff sends { originalId, updatedStaff: { ... } }
            const s = operation.op === 'addStaff' ? operation.payload : operation.payload.updatedStaff;
            if (s && s.password && !isAlreadyHashed(s.password)) {
                s.password = hashPassword(s.password);
            }
        }
        if (operation.op === 'addStudent' || operation.op === 'updateStudent') {
            const st = operation.payload.student || operation.payload.updatedStudent;
            if (st && st.password && !isAlreadyHashed(st.password)) {
                st.password = hashPassword(st.password);
            }
        }
        if (operation.op === 'updateSettings') {
            const set = operation.payload;
            if (set && set.adminPassword && !isAlreadyHashed(set.adminPassword)) {
                set.adminPassword = hashPassword(set.adminPassword);
            }
        }

        if (operation.op === 'restoreData') {
            await acquireLock(centerId);
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

                // Write audit log for restore operation
                try {
                    const userName = (authPayload as any).name || (authPayload as any).email || 'Unknown';
                    const rUserId = (authPayload as any).userId || (authPayload as any).sub || '';
                    const auditEntry = buildAuditEntry('restoreData', operation.payload, rUserId, userName);
                    if (auditEntry) {
                        const auditRef = doc(db, colName, 'auditLogs');
                        await setDoc(auditRef, { data: [auditEntry] });
                    }
                } catch (logErr) { /* ignore */ }

                return res.status(200).json(restoredDataFromFile);
            } catch (error) {
                console.error('Operation Error:', error);
                const errorMessage = error instanceof Error ? error.message : 'Lỗi thao tác không xác định';
                if (errorMessage.startsWith('Từ chối:') || errorMessage.startsWith('Forbidden:')) {
                    return res.status(403).send(errorMessage);
                }
                return res.status(400).send(`Thao tác thất bại: ${errorMessage}`);
            } finally {
                releaseLock(centerId);
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

                // === AUDIT LOG (must complete before response on serverless) ===
                try {
                    const userName = (authPayload as any).name || (authPayload as any).email || 'Unknown';
                    const userId = (authPayload as any).userId || (authPayload as any).sub || '';
                    const auditEntry = buildAuditEntry(operation.op, operation.payload, userId, userName);
                    if (auditEntry) {
                        const colName = getCollectionName(centerId);
                        const auditRef = doc(db, colName, 'auditLogs');
                        const snap = await getDoc(auditRef);
                        const existing = snap.exists() ? snap.data().data || [] : [];
                        // Keep only last 500 entries to prevent bloat
                        const trimmed = existing.length >= 500 ? existing.slice(-499) : existing;
                        trimmed.push(auditEntry);
                        await setDoc(auditRef, { data: trimmed });
                        // Update in-memory cache
                        const c = getCenterCache(centerId);
                        if (c.cachedData) {
                            (c.cachedData as any).auditLogs = trimmed;
                            c.rawShardStrings['auditLogs'] = JSON.stringify(trimmed);
                        }
                        // Sync response so client sees the new entry immediately
                        if (responseData) responseData.auditLogs = trimmed;
                    }
                } catch (logErr) { /* silently ignore audit failures — don't block main operation */ }

                // Set ETag in response for client cache sync
                const cacheAfterWrite = getCenterCache(centerId);
                if (cacheAfterWrite.localSyncId) {
                    res.setHeader('ETag', cacheAfterWrite.localSyncId);
                }

                // Apply role-based filters to response data
                const postRole = (authPayload as any).role as UserRole;
                if (postRole === UserRole.PARENT) {
                    responseData = applyParentFilter(responseData, (authPayload as any).userId as string);
                } else if (postRole === UserRole.TEACHER) {
                    responseData = applyTeacherFilter(responseData, (authPayload as any).userId as string);
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
    const fmt = (n: number) => n?.toLocaleString('vi-VN') || '0';
    const OP_MAP: Record<string, { targetType: string; getDetails: (p: any) => { targetName: string; details: string } | null }> = {
        // === Classes ===
        addClass: { targetType: 'class', getDetails: (p) => ({ targetName: p.name || '', details: `Thêm lớp "${p.name}"` }) },
        updateClass: { targetType: 'class', getDetails: (p) => ({ targetName: p.updatedClass?.name || p.originalId || '', details: `Cập nhật lớp "${p.updatedClass?.name || p.originalId}"` }) },
        deleteClass: { targetType: 'class', getDetails: (p) => ({ targetName: p.classId || '', details: `Xóa lớp ${p.classId}` }) },
        // === Students ===
        addStudent: { targetType: 'student', getDetails: (p) => ({ targetName: p.student?.name || p.name || '', details: `Thêm học viên "${p.student?.name || p.name}"` }) },
        updateStudent: { targetType: 'student', getDetails: (p) => ({ targetName: p.updatedStudent?.name || '', details: `Cập nhật học viên "${p.updatedStudent?.name}"` }) },
        deleteStudent: { targetType: 'student', getDetails: (p) => ({ targetName: p.studentId || '', details: `Xóa học viên ${p.studentId}` }) },
        archiveStudent: { targetType: 'student', getDetails: (p) => ({ targetName: p.studentId || '', details: `Lưu trữ học viên ${p.studentId}` }) },
        restoreStudent: { targetType: 'student', getDetails: (p) => ({ targetName: p.studentId || '', details: `Khôi phục học viên ${p.studentId}` }) },
        addStudentNote: { targetType: 'student', getDetails: (p) => ({ targetName: p.studentId || '', details: `Thêm ghi chú cho HS ${p.studentId}` }) },
        deleteStudentNote: { targetType: 'student', getDetails: (p) => ({ targetName: p.studentId || '', details: `Xóa ghi chú của HS ${p.studentId}` }) },
        updateStudentTags: { targetType: 'student', getDetails: (p) => ({ targetName: p.studentId || '', details: `Cập nhật nhãn HS ${p.studentId}` }) },
        // === Teachers ===
        addTeacher: { targetType: 'teacher', getDetails: (p) => ({ targetName: p.name || '', details: `Thêm giáo viên "${p.name}"` }) },
        updateTeacher: { targetType: 'teacher', getDetails: (p) => ({ targetName: p.updatedTeacher?.name || '', details: `Cập nhật giáo viên "${p.updatedTeacher?.name}"` }) },
        deleteTeacher: { targetType: 'teacher', getDetails: (p) => ({ targetName: p.teacherId || '', details: `Xóa giáo viên ${p.teacherId}` }) },
        // === Staff ===
        addStaff: { targetType: 'staff', getDetails: (p) => ({ targetName: p.name || '', details: `Thêm nhân viên "${p.name}"` }) },
        updateStaff: { targetType: 'staff', getDetails: (p) => ({ targetName: p.updatedStaff?.name || '', details: `Cập nhật nhân viên "${p.updatedStaff?.name}"` }) },
        deleteStaff: { targetType: 'staff', getDetails: (p) => ({ targetName: p.staffId || '', details: `Xóa nhân viên ${p.staffId}` }) },
        // === Attendance ===
        updateAttendance: { targetType: 'attendance', getDetails: (p) => {
            const records = Array.isArray(p) ? p : [];
            const classId = records[0]?.classId || '';
            const date = records[0]?.date || '';
            return { targetName: `${classId}`, details: `Điểm danh lớp ${classId} ngày ${date} (${records.length} HS)` };
        }},
        deleteAttendanceForDate: { targetType: 'attendance', getDetails: (p) => ({ targetName: p.classId || '', details: `Xóa điểm danh lớp ${p.classId} ngày ${p.date}` }) },
        deleteAttendanceByMonth: { targetType: 'attendance', getDetails: (p) => ({ targetName: '', details: `Xóa điểm danh tháng ${p.month}/${p.year}` }) },
        updateSingleAttendance: { targetType: 'attendance', getDetails: (p) => ({ targetName: p.classId || '', details: `Cập nhật điểm danh HS ${p.studentId} lớp ${p.classId} ngày ${p.date} → ${p.status}` }) },
        // === Finance — Payments & Adjustments ===
        addAdjustment: { targetType: 'finance', getDetails: (p) => ({ targetName: p.studentId || '', details: `Thanh toán ${fmt(p.amount)}đ cho HS ${p.studentId}` }) },
        addAdvancePayment: { targetType: 'finance', getDetails: (p) => ({ targetName: p.studentId || '', details: `Thu trước ${p.months || ''}T HP ${fmt(p.amount)}đ cho HS ${p.studentId}` }) },
        // === Finance — Invoices ===
        generateInvoices: { targetType: 'finance', getDetails: (p) => ({ targetName: '', details: `Tạo hóa đơn tháng ${p.month}/${p.year}${p.classIds?.length ? ` (${p.classIds.length} lớp)` : ''}` }) },
        cancelInvoice: { targetType: 'finance', getDetails: (p) => ({ targetName: p.invoiceId || '', details: `Hủy hóa đơn ${p.invoiceId}` }) },
        updateInvoiceStatus: { targetType: 'finance', getDetails: (p) => ({ targetName: p.invoiceId || '', details: `Cập nhật HĐ ${p.invoiceId} → ${p.status}` }) },
        // === Finance — Transactions ===
        updateTransaction: { targetType: 'finance', getDetails: (p) => ({ targetName: p.id || '', details: `Sửa giao dịch ${p.id}` }) },
        deleteTransaction: { targetType: 'finance', getDetails: (p) => ({ targetName: p.transactionId || '', details: `Xóa giao dịch ${p.transactionId}` }) },
        clearAllTransactions: { targetType: 'finance', getDetails: () => ({ targetName: '', details: 'Xóa toàn bộ giao dịch và hóa đơn' }) },
        // === Finance — Income & Expense ===
        addIncome: { targetType: 'finance', getDetails: (p) => ({ targetName: p.description || '', details: `Thêm thu khác: ${p.description} (${fmt(p.amount)}đ)` }) },
        updateIncome: { targetType: 'finance', getDetails: (p) => ({ targetName: p.description || p.id || '', details: `Sửa thu khác: ${p.description || p.id}` }) },
        deleteIncome: { targetType: 'finance', getDetails: (p) => ({ targetName: p.itemId || '', details: `Xóa thu khác ${p.itemId}` }) },
        addExpense: { targetType: 'finance', getDetails: (p) => ({ targetName: p.description || '', details: `Thêm chi phí: ${p.description} (${fmt(p.amount)}đ)` }) },
        updateExpense: { targetType: 'finance', getDetails: (p) => ({ targetName: p.description || p.id || '', details: `Sửa chi phí: ${p.description || p.id}` }) },
        deleteExpense: { targetType: 'finance', getDetails: (p) => ({ targetName: p.itemId || '', details: `Xóa chi phí ${p.itemId}` }) },
        // === Payroll ===
        generatePayrolls: { targetType: 'finance', getDetails: (p) => ({ targetName: '', details: `Tạo bảng lương tháng ${p.month}/${p.year}` }) },
        updatePayroll: { targetType: 'finance', getDetails: (p) => ({ targetName: p.payrollId || '', details: `Cập nhật bảng lương ${p.payrollId} → ${p.status}` }) },
        // === Announcements ===
        addAnnouncement: { targetType: 'announcement', getDetails: (p) => ({ targetName: p.title || '', details: `Thêm thông báo "${p.title}"` }) },
        updateAnnouncement: { targetType: 'announcement', getDetails: (p) => ({ targetName: p.title || p.id || '', details: `Sửa thông báo "${p.title || p.id}"` }) },
        deleteAnnouncement: { targetType: 'announcement', getDetails: (p) => ({ targetName: p.id || '', details: `Xóa thông báo ${p.id}` }) },
        // === Progress Reports ===
        addProgressReport: { targetType: 'student', getDetails: (p) => ({ targetName: p.studentId || '', details: `Thêm báo cáo tiến độ HS ${p.studentId}` }) },
        addBulkProgressReports: { targetType: 'student', getDetails: (p) => ({ targetName: '', details: `Thêm ${Array.isArray(p?.records) ? p.records.length : (Array.isArray(p) ? p.length : '?')} báo cáo tiến độ hàng loạt` }) },
        updateProgressReport: { targetType: 'student', getDetails: (p) => ({ targetName: p.studentId || p.id || '', details: `Sửa báo cáo tiến độ ${p.id || ''}` }) },
        deleteProgressReport: { targetType: 'student', getDetails: (p) => ({ targetName: p.reportId || '', details: `Xóa báo cáo tiến độ ${p.reportId}` }) },
        // === Rooms ===
        addRoom: { targetType: 'room', getDetails: (p) => ({ targetName: p.name || '', details: `Thêm phòng "${p.name}"` }) },
        updateRoom: { targetType: 'room', getDetails: (p) => ({ targetName: p.name || p.id || '', details: `Cập nhật phòng "${p.name || p.id}"` }) },
        deleteRoom: { targetType: 'room', getDetails: (p) => ({ targetName: p.roomId || p.id || '', details: `Xóa phòng ${p.roomId || p.id}` }) },
        // === Settings & System ===
        updateSettings: { targetType: 'settings', getDetails: () => ({ targetName: 'Cài đặt', details: 'Cập nhật cài đặt hệ thống' }) },
        updateUserPassword: { targetType: 'settings', getDetails: (p) => ({ targetName: p.userId || '', details: `Đổi mật khẩu ${p.role || 'user'} ${p.userId || ''}` }) },
        recalculateAllInvoices: { targetType: 'finance', getDetails: () => ({ targetName: '', details: 'Tính lại toàn bộ hóa đơn' }) },
        restoreData: { targetType: 'system', getDetails: () => ({ targetName: 'Hệ thống', details: 'Khôi phục dữ liệu từ bản sao lưu' }) },
        clearCollections: { targetType: 'system', getDetails: (p) => ({ targetName: '', details: `Xóa dữ liệu: ${Array.isArray(p) ? p.join(', ') : p}` }) },
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
