import { signToken } from './_lib/jwt.js';
import { getMockDataState } from './_lib/mockData.js';
import { UserRole } from '../types.js';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
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

async function getAuthData() {
    await authenticateServer();
    // Fetch only the collections needed for authentication
    const collections = ['settings', 'teachers', 'staff', 'students'];
    const promises = collections.map(col => getDoc(doc(db, 'db_core_v2_secure_9a8b7c6d5e4f3g2h1', col)));
    const snapshots = await Promise.all(promises);
    
    const defaultState = getMockDataState();
    
    return {
        settings: snapshots[0].exists() ? snapshots[0].data().data : defaultState.settings,
        teachers: snapshots[1].exists() ? snapshots[1].data().data : defaultState.teachers,
        staff: snapshots[2].exists() ? snapshots[2].data().data : defaultState.staff,
        students: snapshots[3].exists() ? snapshots[3].data().data : defaultState.students,
    };
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        let body = req.body || {};
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) {}
        }
        const { identifier, password } = body;

        if (!identifier || !password) {
            return res.status(400).json({ error: 'Thiếu thông tin đăng nhập' });
        }

        const data = await getAuthData();
        const upperIdentifier = identifier.toUpperCase();
        let user = null;
        let role = null;
        const hashedInputPassword = hashPassword(password);

        // 1. Check Admin
        if (upperIdentifier === 'ADMIN' || upperIdentifier === 'ADMIN_USER') {
            const adminPassword = data.settings?.adminPassword || '123456';
            if (password === adminPassword || hashedInputPassword === adminPassword) {
                user = { id: 'ADMIN_USER', name: 'Admin', role: UserRole.ADMIN };
                role = UserRole.ADMIN;
            }
        }
        // 2. Check Viewer
        else if (upperIdentifier === 'VIEWER' || upperIdentifier === 'VIEWER_USER') {
            if (data.settings?.viewerAccountActive !== false && (password === 'viewer123' || hashedInputPassword === 'viewer123')) {
                user = { id: 'VIEWER_USER', name: 'Viewer', role: UserRole.VIEWER };
                role = UserRole.VIEWER;
            }
        }
        // 3. Check Teacher
        else if (data.teachers) {
            const teacher = data.teachers.find((t: any) => t.id.toUpperCase() === upperIdentifier);
            if (teacher && (teacher.password === password || teacher.password === hashedInputPassword)) {
                user = teacher;
                role = teacher.role;
            }
        }
        
        // 4. Check Staff
        if (!user && data.staff) {
            const staffMember = data.staff.find((s: any) => s.id.toUpperCase() === upperIdentifier);
            if (staffMember && (staffMember.password === password || staffMember.password === hashedInputPassword)) {
                user = staffMember;
                role = staffMember.role;
            }
        }

        // 5. Check Student (Parent)
        if (!user && data.students) {
            const student = data.students.find((s: any) => s.id.toUpperCase() === upperIdentifier);
            if (student) {
                const dobPassword = student.dob ? student.dob.split('-').reverse().join('') : null;
                const correctPassword = student.password || dobPassword;
                if (password === correctPassword || hashedInputPassword === correctPassword) {
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

            return res.status(200).json({ token, user: safeUser, role });
        }

        return res.status(401).json({ error: 'Thông tin đăng nhập không hợp lệ' });

    } catch (error) {
        console.error('Auth Error:', error);
        return res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
}
