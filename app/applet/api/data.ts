import { kv } from '@vercel/kv';
import type { AppData } from '../types.js';
import { getMockDataState } from './_lib/mockData.js';
import { applyOperation } from './_lib/operations.js';
import { verifyToken } from './_lib/jwt.js';
import { UserRole } from '../types.js';

const V1_DATA_KEY = 'educenter_pro_data_kv_v1';
const PREFIX = 'educenter_pro_v2_';
const LOCK_KEY = 'educenter_pro_data_kv_v2_lock';
const LOCK_TTL_SECONDS = 10;

const COLLECTIONS = [
    'students', 'teachers', 'staff', 'classes', 'attendance', 
    'invoices', 'progressReports', 'transactions', 'income', 
    'expenses', 'payrolls', 'announcements', 'settings'
] as const;

async function acquireLock(): Promise<boolean> {
  const result = await kv.set(LOCK_KEY, 'locked', { nx: true, ex: LOCK_TTL_SECONDS });
  return result === 'OK';
}

async function releaseLock(): Promise<void> {
  await kv.del(LOCK_KEY);
}

// Helper to check JWT
async function getAuthPayload(request: Request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    return await verifyToken(token);
}

async function getSplitData(): Promise<Omit<AppData, 'loading'>> {
    const keys = COLLECTIONS.map(c => PREFIX + c);
    const values = await kv.mget<any[]>(...keys);
    
    const defaultState = getMockDataState();
    const data: any = {};
    
    let hasData = false;
    
    COLLECTIONS.forEach((col, index) => {
        if (values[index]) {
            data[col] = values[index];
            hasData = true;
        } else {
            data[col] = defaultState[col];
        }
    });
    
    // Auto-migrate from V1 if V2 is empty
    if (!hasData) {
        console.log("V2 store is empty. Attempting to migrate from V1...");
        const v1Data = await kv.get<Partial<Omit<AppData, 'loading'>>>(V1_DATA_KEY);
        if (v1Data) {
            console.log("V1 data found. Migrating to V2...");
            const msetPayload: Record<string, any> = {};
            COLLECTIONS.forEach(col => {
                const val = v1Data[col] || defaultState[col];
                data[col] = val;
                msetPayload[PREFIX + col] = val;
            });
            await kv.mset(msetPayload);
        } else {
            console.log("No V1 data found. Seeding with initial mock data.");
            const msetPayload: Record<string, any> = {};
            COLLECTIONS.forEach(col => {
                msetPayload[PREFIX + col] = defaultState[col];
            });
            await kv.mset(msetPayload);
        }
    }
    
    return data as Omit<AppData, 'loading'>;
}

async function saveSplitData(data: Omit<AppData, 'loading'>, originalDataStringified?: Record<string, string>): Promise<void> {
    const msetPayload: Record<string, any> = {};
    let hasChanges = false;
    
    COLLECTIONS.forEach(col => {
        if (originalDataStringified) {
            const newDataString = JSON.stringify(data[col]);
            if (newDataString !== originalDataStringified[col]) {
                msetPayload[PREFIX + col] = data[col];
                hasChanges = true;
            }
        } else {
            msetPayload[PREFIX + col] = data[col];
            hasChanges = true;
        }
    });
    
    if (hasChanges) {
        await kv.mset(msetPayload);
    }
}

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
    const authPayload = await getAuthPayload(request);
    if (!authPayload) {
        return new Response('Unauthorized: Invalid or missing Token', { status: 401 });
    }

    if (request.method === 'GET') {
        try {
            const data = await getSplitData();
            
            // SECURITY: Strip passwords from the response so they don't leak to the client
            if (data.teachers) {
                data.teachers = data.teachers.map(t => {
                    const { password, ...rest } = t;
                    return rest as any;
                });
            }
            if (data.staff) {
                data.staff = data.staff.map(s => {
                    const { password, ...rest } = s;
                    return rest as any;
                });
            }
            if (data.settings) {
                const { adminPassword, ...safeSettings } = data.settings;
                data.settings = safeSettings as any;
            }

            return new Response(JSON.stringify(data), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                },
                status: 200,
            });
        } catch (error) {
            console.error('Vercel KV GET Error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown KV error';
            if (errorMessage.includes("Missing required environment variable")) {
                return new Response('Lỗi Cấu hình: Vui lòng kết nối Vercel KV database với project của bạn trong trang cài đặt Vercel.', { status: 500 });
            }
            return new Response(`Lỗi Máy chủ: Không thể lấy dữ liệu từ Vercel KV. Chi tiết: ${errorMessage}`, { status: 500 });
        }
    }

    if (request.method === 'POST') {
        // Enforce basic RBAC for mutations
        const role = authPayload.role as UserRole;
        if (role === UserRole.VIEWER || role === UserRole.PARENT) {
            return new Response('Forbidden: You do not have permission to modify data', { status: 403 });
        }

        let attempts = 0;
        const maxAttempts = 8;

        while (attempts < maxAttempts) {
            if (await acquireLock()) {
                try {
                    const operation = await request.json();
                    
                    if (operation.op === 'restoreData') {
                        if (role !== UserRole.ADMIN) {
                            return new Response('Forbidden: Only admins can restore data', { status: 403 });
                        }
                        const restoredDataFromFile = operation.payload as Omit<AppData, 'loading'>;
                        // Ensure all collections exist
                        const defaultState = getMockDataState();
                        COLLECTIONS.forEach(col => {
                            if (!restoredDataFromFile[col]) {
                                (restoredDataFromFile as any)[col] = defaultState[col];
                            }
                        });
                        
                        await saveSplitData(restoredDataFromFile);
                        return new Response(JSON.stringify(restoredDataFromFile), {
                            headers: { 'Content-Type': 'application/json' },
                            status: 200,
                        });
                    }

                    const currentData = await getSplitData();
                    
                    // Stringify current data for comparison to optimize KV writes
                    const currentDataStringified: Record<string, string> = {};
                    COLLECTIONS.forEach(col => {
                        currentDataStringified[col] = JSON.stringify(currentData[col]);
                    });

                    const newData = applyOperation(currentData, operation);
                    await saveSplitData(newData, currentDataStringified);
                    
                    // Strip passwords before returning the updated state to the client
                    if (newData.teachers) {
                        newData.teachers = newData.teachers.map(t => {
                            const { password, ...rest } = t;
                            return rest as any;
                        });
                    }
                    if (newData.staff) {
                        newData.staff = newData.staff.map(s => {
                            const { password, ...rest } = s;
                            return rest as any;
                        });
                    }
                    if (newData.settings) {
                        const { adminPassword, ...safeSettings } = newData.settings;
                        newData.settings = safeSettings as any;
                    }

                    return new Response(JSON.stringify(newData), {
                        headers: { 'Content-Type': 'application/json' },
                        status: 200,
                    });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown operation error';
                    return new Response(`Thao tác thất bại: ${errorMessage}`, { status: 400 });
                } finally {
                    await releaseLock();
                }
            }
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 250 * attempts));
        }

        return new Response('Máy chủ đang bận, vui lòng thử lại. Không thể khóa dữ liệu.', { status: 503 });
    }

    return new Response('Method Not Allowed', { status: 405 });
}
