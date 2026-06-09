import { kv } from '@vercel/kv';
import { getMockDataState } from './_lib/mockData.js';
import { verifyToken } from './_lib/jwt.js';
import { UserRole } from '../types.js';

const PREFIX = 'educenter_pro_v2_';
const COLLECTIONS = [
    'students', 'teachers', 'staff', 'classes', 'attendance', 
    'invoices', 'progressReports', 'transactions', 'income', 
    'expenses', 'payrolls', 'announcements', 'settings'
] as const;

// Helper to check JWT
async function getAuthPayload(request: Request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    return await verifyToken(token);
}

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {    
    const authPayload = await getAuthPayload(request);
    if (!authPayload) {
        return new Response('Unauthorized: Invalid or missing Token', { status: 401 });
    }

    if (authPayload.role !== UserRole.ADMIN) {
        return new Response('Forbidden: Only admins can reset data', { status: 403 });
    }

    if (request.method === 'POST') {
        try {
            const mockData = getMockDataState();
            const msetPayload: Record<string, any> = {};
            COLLECTIONS.forEach(col => {
                msetPayload[PREFIX + col] = mockData[col];
            });
            await kv.mset(msetPayload);
            
            // Strip passwords
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

            return new Response(JSON.stringify(mockData), { 
                headers: { 'Content-Type': 'application/json' },
                status: 200 
            });
        } catch (error) {
            console.error('Vercel KV Reset Error:', error);
            return new Response('Failed to reset data in Vercel KV.', { status: 500 });
        }
    }

    return new Response('Method Not Allowed', { status: 405 });
}
