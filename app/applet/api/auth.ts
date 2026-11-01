import { kv } from '@vercel/kv';
import { signToken } from './_lib/jwt.js';
import { getMockDataState } from './_lib/mockData.js';
import { UserRole } from '../types.js';

export const config = {
  runtime: 'edge',
};

const V1_DATA_KEY = 'educenter_pro_data_kv_v1';
const PREFIX = 'educenter_pro_v2_';

async function getAuthData() {
    // Fetch only the collections needed for authentication
    const keys = ['settings', 'teachers', 'staff', 'students'].map(c => PREFIX + c);
    const values = await kv.mget<any[]>(...keys);
    
    const defaultState = getMockDataState();
    
    // If V2 is empty, fallback to V1 or default
    if (!values[0]) {
        const v1Data = await kv.get<any>(V1_DATA_KEY);
        if (v1Data) {
            return {
                settings: v1Data.settings || defaultState.settings,
                teachers: v1Data.teachers || defaultState.teachers,
                staff: v1Data.staff || defaultState.staff,
                students: v1Data.students || defaultState.students,
            };
        }
        return defaultState;
    }

    return {
        settings: values[0] || defaultState.settings,
        teachers: values[1] || defaultState.teachers,
        staff: values[2] || defaultState.staff,
        students: values[3] || defaultState.students,
    };
}

export default async function handler(request: Request) {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { identifier, password } = await request.json();

        if (!identifier || !password) {
            return new Response(JSON.stringify({ error: 'Missing credentials' }), { status: 400 });
        }

        const data = await getAuthData();
        const upperIdentifier = identifier.toUpperCase();
        let user = null;
        let role = null;

        // 1. Check Admin
        if (upperIdentifier === 'ADMIN' || upperIdentifier === 'ADMIN_USER') {
            const adminPassword = data.settings?.adminPassword || '123456';
            if (password === adminPassword) {
                const adminName = data.settings?.adminDisplayName || 'Admin';
                user = { id: 'ADMIN_USER', name: adminName, role: UserRole.ADMIN };
                role = UserRole.ADMIN;
            }
        }
        // 2. Check Viewer
        else if (upperIdentifier === 'VIEWER' || upperIdentifier === 'VIEWER_USER') {
            if (data.settings?.viewerAccountActive !== false && password === 'viewer123') {
                user = { id: 'VIEWER_USER', name: 'Viewer', role: UserRole.VIEWER };
                role = UserRole.VIEWER;
            }
        }
        // 3. Check Teacher
        else if (data.teachers) {
            const teacher = data.teachers.find((t: any) => t.id.toUpperCase() === upperIdentifier);
            if (teacher && teacher.password === password) {
                user = teacher;
                role = teacher.role;
            }
        }
        
        // 4. Check Staff
        if (!user && data.staff) {
            const staffMember = data.staff.find((s: any) => s.id.toUpperCase() === upperIdentifier);
            if (staffMember && staffMember.password === password) {
                user = staffMember;
                role = staffMember.role;
            }
        }

        // 5. Check Student (Parent)
        if (!user && data.students) {
            const student = data.students.find((s: any) => s.id.toUpperCase() === upperIdentifier);
            if (student) {
                const dobPassword = student.dob ? student.dob.split('-').reverse().join('') : null;
                if (password === dobPassword) {
                    user = student;
                    role = UserRole.PARENT;
                }
            }
        }

        if (user && role) {
            // Generate JWT
            const token = await signToken({ userId: user.id, role });
            
            // Remove sensitive info before sending back to client
            const safeUser = { ...user };
            delete safeUser.password;

            return new Response(JSON.stringify({ token, user: safeUser, role }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });

    } catch (error) {
        console.error('Auth Error:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }
}
