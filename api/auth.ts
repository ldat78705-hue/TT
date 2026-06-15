import { signToken } from './_lib/jwt.js';
import { UserRole } from '../types.js';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, getDocs, collection } from 'firebase/firestore';
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

function getCollectionName(centerId?: string): string {
    if (!centerId || centerId === '_legacy') return LEGACY_COLLECTION;
    return `center_${centerId}`;
}

async function getAuthData(centerId?: string) {
    const colName = getCollectionName(centerId);
    const collections = ['settings', 'teachers', 'staff', 'students'];
    const promises = collections.map(col => getDoc(doc(db, colName, col)));
    const snapshots = await Promise.all(promises);
    
    return {
        settings: snapshots[0].exists() ? snapshots[0].data().data : null,
        teachers: snapshots[1].exists() ? snapshots[1].data().data : [],
        staff: snapshots[2].exists() ? snapshots[2].data().data : [],
        students: snapshots[3].exists() ? snapshots[3].data().data : [],
    };
}

// Check if user is using default/DOB password
function isDefaultPassword(user: any, password: string, role: string): boolean {
    if (role === UserRole.ADMIN && (password === '123456')) return true;
    if (user.dob) {
        const dobPwd = user.dob.split('-').reverse().join('');
        if (password === dobPwd) return true;
    }
    return false;
}

// Try to authenticate a user within a specific center's data
function tryAuthInData(data: any, identifier: string, password: string, hashedPassword: string): { user: any, role: string, mustChangePassword: boolean } | null {
    const upperIdentifier = identifier.toUpperCase();

    // 1. Admin
    if (upperIdentifier === 'ADMIN' || upperIdentifier === 'ADMIN_USER') {
        const adminPassword = data.settings?.adminPassword || '123456';
        if (password === adminPassword || hashedPassword === adminPassword) {
            const mustChange = password === '123456';
            return { user: { id: 'ADMIN_USER', name: 'Admin', role: UserRole.ADMIN }, role: UserRole.ADMIN, mustChangePassword: mustChange };
        }
        return null;
    }

    // 2. Viewer
    if (upperIdentifier === 'VIEWER' || upperIdentifier === 'VIEWER_USER') {
        if (data.settings?.viewerAccountActive !== false && (password === 'viewer123' || hashedPassword === 'viewer123')) {
            return { user: { id: 'VIEWER_USER', name: 'Viewer', role: UserRole.VIEWER }, role: UserRole.VIEWER, mustChangePassword: false };
        }
        return null;
    }

    // 3. Teacher
    if (data.teachers) {
        const teacher = data.teachers.find((t: any) => t.id && t.id.toUpperCase() === upperIdentifier);
        if (teacher && (teacher.password === password || teacher.password === hashedPassword)) {
            return { user: teacher, role: teacher.role || UserRole.TEACHER, mustChangePassword: isDefaultPassword(teacher, password, teacher.role || UserRole.TEACHER) };
        }
    }

    // 4. Staff
    if (data.staff) {
        const staffMember = data.staff.find((s: any) => s.id && s.id.toUpperCase() === upperIdentifier);
        if (staffMember && (staffMember.password === password || staffMember.password === hashedPassword)) {
            return { user: staffMember, role: staffMember.role || UserRole.MANAGER, mustChangePassword: isDefaultPassword(staffMember, password, staffMember.role || UserRole.MANAGER) };
        }
    }

    // 5. Student (Parent)
    if (data.students) {
        const student = data.students.find((s: any) => s.id && s.id.toUpperCase() === upperIdentifier);
        if (student) {
            const dobPassword = student.dob ? student.dob.split('-').reverse().join('') : null;
            const correctPassword = student.password || dobPassword;
            if (password === correctPassword || hashedPassword === correctPassword) {
                return { user: student, role: UserRole.PARENT, mustChangePassword: isDefaultPassword(student, password, UserRole.PARENT) };
            }
        }
    }

    return null;
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
        const { identifier, password, centerId } = body;

        if (!identifier || !password) {
            return res.status(400).json({ error: 'Thiếu thông tin đăng nhập' });
        }

        await authenticateServer();
        const hashedInputPassword = hashPassword(password);

        // Step 0: Check if identifier matches a center's loginUsername
        let effectiveCenterId = centerId || null;
        let centerLoginMatched = false;

        if (!centerId) {
            const allCenters = await getDocs(collection(db, 'centers_registry'));
            
            // Check center login
            allCenters.forEach((docSnap: any) => {
                const data = docSnap.data();
                if (data.loginUsername && data.loginUsername.toUpperCase() === identifier.toUpperCase()) {
                    effectiveCenterId = docSnap.id;
                    centerLoginMatched = true;
                }
            });

            // If matched center login, verify center password
            if (centerLoginMatched && effectiveCenterId) {
                const centerDoc = allCenters.docs.find((d: any) => d.id === effectiveCenterId);
                const centerData = centerDoc?.data();
                
                if (centerData?.status === 'LOCKED') {
                    return res.status(403).json({ error: 'Trung tâm này đã bị khóa. Vui lòng liên hệ quản trị viên hệ thống.' });
                }
                
                let expiryWarning: string | null = null;
                if (centerData?.expiresAt) {
                    const expiresAt = new Date(centerData.expiresAt);
                    const now = new Date();
                    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysLeft < 0) {
                        expiryWarning = `⚠️ Trung tâm đã hết hạn sử dụng từ ngày ${expiresAt.toLocaleDateString('vi-VN')}. Vui lòng liên hệ nhà cung cấp để gia hạn. Một số tính năng có thể bị hạn chế.`;
                    } else if (daysLeft <= 7) {
                        expiryWarning = `⚠️ Trung tâm sẽ hết hạn sau ${daysLeft} ngày (${expiresAt.toLocaleDateString('vi-VN')}). Vui lòng liên hệ nhà cung cấp để gia hạn.`;
                    }
                }

                const hashedInput = hashPassword(password);
                if (centerData?.loginPassword !== hashedInput) {
                    return res.status(401).json({ error: 'Mật khẩu không đúng' });
                }

                // Center login → admin
                const token = await signToken({
                    userId: 'ADMIN_USER',
                    role: UserRole.ADMIN,
                    name: centerData?.name || 'Admin',
                    centerId: effectiveCenterId
                });
                return res.status(200).json({
                    token,
                    user: { id: 'ADMIN_USER', name: centerData?.name || 'Admin', role: UserRole.ADMIN },
                    role: UserRole.ADMIN,
                    centerId: effectiveCenterId,
                    ...(expiryWarning && { expiryWarning })
                });
            }

            // NOT a center login → search across ALL active centers for GV/NV/Student
            const now = new Date();
            for (const docSnap of allCenters.docs) {
                const cData = docSnap.data();
                if (cData.status === 'LOCKED') continue;
                if (cData.expiresAt && new Date(cData.expiresAt) < now) continue;

                const cId = docSnap.id;
                try {
                    const authData = await getAuthData(cId);
                    const result = tryAuthInData(authData, identifier, password, hashedInputPassword);
                    if (result) {
                        const token = await signToken({
                            userId: result.user.id,
                            role: result.role,
                            name: result.user.name || result.user.id,
                            centerId: cId
                        });
                        const safeUser = { ...result.user };
                        delete safeUser.password;
                        return res.status(200).json({ token, user: safeUser, role: result.role, centerId: cId, mustChangePassword: result.mustChangePassword });
                    }
                } catch (e) {
                    console.error(`Error checking center ${cId}:`, e);
                }
            }

            return res.status(401).json({ error: 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.' });
        }

        // Has explicit centerId → authenticate within that center only
        if (effectiveCenterId && effectiveCenterId !== '_legacy') {
            const centerDoc = await getDoc(doc(db, 'centers_registry', effectiveCenterId));
            if (!centerDoc.exists()) {
                return res.status(403).json({ error: 'Trung tâm không tồn tại hoặc đã bị xóa.' });
            }
            const centerData = centerDoc.data();
            if (centerData.status === 'LOCKED') {
                return res.status(403).json({ error: 'Trung tâm này đã bị khóa.' });
            }
            if (centerData.expiresAt && new Date(centerData.expiresAt) < new Date()) {
                return res.status(403).json({ error: 'Trung tâm này đã hết hạn sử dụng.' });
            }
        }

        const data = await getAuthData(effectiveCenterId || '_legacy');
        const result = tryAuthInData(data, identifier, password, hashedInputPassword);

        if (result) {
            const token = await signToken({
                userId: result.user.id,
                role: result.role,
                name: result.user.name || result.user.id,
                centerId: effectiveCenterId || '_legacy'
            });
            const safeUser = { ...result.user };
            delete safeUser.password;
            return res.status(200).json({ token, user: safeUser, role: result.role, centerId: effectiveCenterId || '_legacy', mustChangePassword: result.mustChangePassword });
        }

        return res.status(401).json({ error: 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.' });

    } catch (error) {
        console.error('Auth Error:', error);
        return res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
}
