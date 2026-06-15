import { verifyToken } from './_lib/jwt.js';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { authenticateServer } from './_lib/serverAuth.js';
import { invalidateCenterCache } from './data.js';
import { hashPassword, verifyPassword } from './_lib/crypto.js';
import { signToken } from './_lib/jwt.js';
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

const REGISTRY_COLLECTION = 'centers_registry';
const SUPER_ADMIN_COLLECTION = 'super_admin';

async function getAuthPayload(req: any) {
    const authHeader = req.headers.authorization || req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    return await verifyToken(token);
}

function isSuperAdmin(payload: any): boolean {
    return payload?.isSuperAdmin === true;
}

export default async function handler(req: any, res: any) {
  try {
    await authenticateServer();

    // === SUPER ADMIN LOGIN ===
    if (req.method === 'POST') {
        let body = req.body || {};
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) {}
        }

        // Login action
        if (body.action === 'login') {
            const { username, password } = body;
            if (!username || !password) {
                return res.status(400).json({ error: 'Thiếu tên đăng nhập hoặc mật khẩu' });
            }

            try {
                const adminDoc = await getDoc(doc(db, SUPER_ADMIN_COLLECTION, 'credentials'));
                if (!adminDoc.exists()) {
                    // First-time setup: create default super admin
                    const defaultUsername = 'superadmin';
                    const defaultPassword = 'SuperAdmin@2026';
                    const hashed = hashPassword(defaultPassword);
                    await setDoc(doc(db, SUPER_ADMIN_COLLECTION, 'credentials'), {
                        username: defaultUsername,
                        password: hashed,
                        createdAt: new Date().toISOString()
                    });

                    if (username === defaultUsername && password === defaultPassword) {
                        const token = await signToken({
                            userId: 'SUPER_ADMIN',
                            role: 'SUPER_ADMIN',
                            isSuperAdmin: true,
                            name: 'Super Admin'
                        });
                        return res.status(200).json({ token, role: 'SUPER_ADMIN', isSuperAdmin: true });
                    }
                    return res.status(401).json({ error: 'Thông tin đăng nhập không hợp lệ' });
                }

                const adminData = adminDoc.data();
                if (username !== adminData.username) {
                    return res.status(401).json({ error: 'Thông tin đăng nhập không hợp lệ' });
                }
                if (!verifyPassword(password, adminData.password)) {
                    return res.status(401).json({ error: 'Mật khẩu không đúng' });
                }

                const token = await signToken({
                    userId: 'SUPER_ADMIN',
                    role: 'SUPER_ADMIN',
                    isSuperAdmin: true,
                    name: 'Super Admin'
                });
                return res.status(200).json({ token, role: 'SUPER_ADMIN', isSuperAdmin: true });
            } catch (error) {
                console.error('Super Admin Login Error:', error);
                return res.status(500).json({ error: 'Lỗi đăng nhập' });
            }
        }

        // === GET SITE CONTENT (public-readable, no auth required) ===
        if (body.action === 'get_site_content') {
            try {
                const contentDoc = await getDoc(doc(db, SUPER_ADMIN_COLLECTION, 'site_content'));
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
                if (!contentDoc.exists()) {
                    return res.status(200).json({ success: true, content: null });
                }
                return res.status(200).json({ success: true, content: contentDoc.data() });
            } catch (error: any) {
                return res.status(500).json({ error: 'Lỗi tải nội dung: ' + error.message });
            }
        }

        // === ALL OTHER POST ACTIONS REQUIRE SUPER ADMIN AUTH ===
        const authPayload = await getAuthPayload(req);
        if (!authPayload || !isSuperAdmin(authPayload)) {
            return res.status(403).json({ error: 'Chỉ Super Admin mới có quyền thực hiện thao tác này' });
        }

        // Create center
        if (body.action === 'create') {
            const { slug, name, address, phone, expiresAt } = body;
            if (!slug || !name) {
                return res.status(400).json({ error: 'Thiếu mã hoặc tên trung tâm' });
            }

            const existing = await getDoc(doc(db, REGISTRY_COLLECTION, slug));
            if (existing.exists()) {
                return res.status(409).json({ error: `Trung tâm "${slug}" đã tồn tại` });
            }

            // Default: 30 days trial
            const defaultExpiry = new Date();
            defaultExpiry.setDate(defaultExpiry.getDate() + 30);

            const centerData = {
                name,
                slug,
                address: address || '',
                phone: phone || '',
                plan: 'free',
                status: 'ACTIVE',
                createdAt: new Date().toISOString(),
                expiresAt: expiresAt || defaultExpiry.toISOString(),
                collectionName: `center_${slug}`
            };

            await setDoc(doc(db, REGISTRY_COLLECTION, slug), centerData);
            return res.status(201).json({ success: true, center: { id: slug, ...centerData } });
        }

        // Extend center
        if (body.action === 'extend') {
            const { slug, days, expiresAt: customExpiry } = body;
            if (!slug) {
                return res.status(400).json({ error: 'Thiếu mã trung tâm' });
            }

            const centerRef = doc(db, REGISTRY_COLLECTION, slug);
            const centerDoc = await getDoc(centerRef);
            if (!centerDoc.exists()) {
                return res.status(404).json({ error: 'Trung tâm không tồn tại' });
            }

            let newExpiry: string;
            if (customExpiry) {
                newExpiry = customExpiry;
            } else {
                const currentExpiry = new Date(centerDoc.data().expiresAt || new Date());
                const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
                baseDate.setDate(baseDate.getDate() + (days || 30));
                newExpiry = baseDate.toISOString();
            }

            await updateDoc(centerRef, { expiresAt: newExpiry, status: 'ACTIVE' });
            return res.status(200).json({
                success: true,
                message: `Đã gia hạn trung tâm "${slug}" đến ${new Date(newExpiry).toLocaleDateString('vi-VN')}`,
                expiresAt: newExpiry
            });
        }

        // Toggle status (lock/unlock)
        if (body.action === 'toggle_status') {
            const { slug, status } = body;
            if (!slug) return res.status(400).json({ error: 'Thiếu mã trung tâm' });

            const centerRef = doc(db, REGISTRY_COLLECTION, slug);
            await updateDoc(centerRef, { status: status || 'LOCKED' });
            return res.status(200).json({ success: true, status: status || 'LOCKED' });
        }

        // Delete center
        if (body.action === 'delete') {
            const { slug } = body;
            if (!slug) return res.status(400).json({ error: 'Thiếu mã trung tâm' });

            // 1. Delete all documents in center data collection
            const colName = `center_${slug}`;
            try {
                const docsSnapshot = await getDocs(collection(db, colName));
                if (docsSnapshot.size > 0) {
                    const deleteBatches: any[] = [];
                    let batch = writeBatch(db);
                    let count = 0;
                    docsSnapshot.forEach((docSnap) => {
                        batch.delete(doc(db, colName, docSnap.id));
                        count++;
                        if (count >= 450) {
                            deleteBatches.push(batch);
                            batch = writeBatch(db);
                            count = 0;
                        }
                    });
                    if (count > 0) deleteBatches.push(batch);
                    for (const b of deleteBatches) await b.commit();
                }
            } catch (e) {
                console.error(`Error deleting center data for ${slug}:`, e);
            }

            // 2. Delete registry entry
            await deleteDoc(doc(db, REGISTRY_COLLECTION, slug));
            
            // 3. Invalidate server-side cache so deleted center doesn't "come back"
            invalidateCenterCache(slug);
            
            return res.status(200).json({ success: true, message: `Đã xóa trung tâm "${slug}" và toàn bộ dữ liệu` });
        }

        // Change super admin password
        if (body.action === 'change_password') {
            const { currentPassword, newPassword } = body;
            if (!currentPassword || !newPassword) {
                return res.status(400).json({ error: 'Thiếu mật khẩu' });
            }

            const adminDoc = await getDoc(doc(db, SUPER_ADMIN_COLLECTION, 'credentials'));
            if (!adminDoc.exists()) {
                return res.status(404).json({ error: 'Chưa thiết lập Super Admin' });
            }

            if (!verifyPassword(currentPassword, adminDoc.data().password)) {
                return res.status(401).json({ error: 'Mật khẩu hiện tại không đúng' });
            }

            await updateDoc(doc(db, SUPER_ADMIN_COLLECTION, 'credentials'), {
                password: hashPassword(newPassword)
            });
            return res.status(200).json({ success: true, message: 'Đã đổi mật khẩu Super Admin' });
        }

        // Set center login credentials
        if (body.action === 'set_credentials') {
            const { slug, loginUsername, loginPassword } = body;
            if (!slug || !loginUsername || !loginPassword) {
                return res.status(400).json({ error: 'Thiếu mã trung tâm, tên đăng nhập hoặc mật khẩu' });
            }

            // Check if loginUsername already used by another center
            const allCenters = await getDocs(collection(db, REGISTRY_COLLECTION));
            let conflict = false;
            allCenters.forEach((docSnap) => {
                const data = docSnap.data();
                if (docSnap.id !== slug && data.loginUsername === loginUsername) {
                    conflict = true;
                }
            });
            if (conflict) {
                return res.status(409).json({ error: `Tên đăng nhập "${loginUsername}" đã được sử dụng bởi trung tâm khác` });
            }

            const centerRef = doc(db, REGISTRY_COLLECTION, slug);
            const centerDoc = await getDoc(centerRef);
            if (!centerDoc.exists()) {
                return res.status(404).json({ error: 'Trung tâm không tồn tại' });
            }

            await updateDoc(centerRef, {
                loginUsername,
                loginPassword: hashPassword(loginPassword)
            });
            return res.status(200).json({ success: true, message: `Đã cập nhật tài khoản cho trung tâm "${slug}"` });
        }

        // Remove center login credentials
        if (body.action === 'remove_credentials') {
            const { slug } = body;
            if (!slug) return res.status(400).json({ error: 'Thiếu mã trung tâm' });

            const centerRef = doc(db, REGISTRY_COLLECTION, slug);
            const centerDoc = await getDoc(centerRef);
            if (!centerDoc.exists()) {
                return res.status(404).json({ error: 'Trung tâm không tồn tại' });
            }

            await updateDoc(centerRef, {
                loginUsername: '',
                loginPassword: ''
            });
            return res.status(200).json({ success: true, message: `Đã xóa tài khoản đăng nhập của trung tâm "${slug}"` });
        }

        // Change center's internal admin password
        if (body.action === 'change_center_admin_password') {
            const { slug, newAdminPassword } = body;
            if (!slug || !newAdminPassword) {
                return res.status(400).json({ error: 'Thiếu mã trung tâm hoặc mật khẩu mới' });
            }

            // Update admin password in center's settings collection
            const colName = `center_${slug}`;
            const settingsRef = doc(db, colName, 'settings');
            const settingsDoc = await getDoc(settingsRef);
            if (!settingsDoc.exists()) {
                return res.status(404).json({ error: `Không tìm thấy dữ liệu của trung tâm "${slug}"` });
            }

            const settingsData = settingsDoc.data();
            const currentSettings = settingsData.data || {};
            currentSettings.adminPassword = hashPassword(newAdminPassword);

            await updateDoc(settingsRef, { data: currentSettings });
            return res.status(200).json({ success: true, message: `Đã đổi mật khẩu quản trị nội bộ cho trung tâm "${slug}"` });
        }

        // Get all accounts in a center (teachers, staff)
        if (body.action === 'get_center_accounts') {
            const { slug } = body;
            if (!slug) return res.status(400).json({ error: 'Thiếu mã trung tâm' });

            const colName = `center_${slug}`;
            const accounts: any[] = [];

            // Get teachers
            const teachersDoc = await getDoc(doc(db, colName, 'teachers'));
            if (teachersDoc.exists()) {
                const teachers = teachersDoc.data()?.data || [];
                teachers.forEach((t: any) => {
                    accounts.push({
                        id: t.id,
                        name: t.name,
                        type: 'teacher',
                        typeLabel: 'Giáo viên',
                        role: t.role || 'TEACHER',
                        status: t.status || 'ACTIVE',
                        hasPassword: !!t.password,
                    });
                });
            }

            // Get staff
            const staffDoc = await getDoc(doc(db, colName, 'staff'));
            if (staffDoc.exists()) {
                const staff = staffDoc.data()?.data || [];
                staff.forEach((s: any) => {
                    accounts.push({
                        id: s.id,
                        name: s.name,
                        type: 'staff',
                        typeLabel: 'Nhân viên',
                        role: s.role || 'MANAGER',
                        status: s.status || 'ACTIVE',
                        hasPassword: !!s.password,
                    });
                });
            }

            // Get settings for admin password info
            const settingsDoc2 = await getDoc(doc(db, colName, 'settings'));
            const hasAdminPwd = !!(settingsDoc2.exists() && settingsDoc2.data()?.data?.adminPassword);

            return res.status(200).json({ 
                success: true, 
                accounts, 
                hasAdminPassword: hasAdminPwd,
                totalAccounts: accounts.length 
            });
        }

        // Update account in center (change password, role, username)
        if (body.action === 'update_center_account') {
            const { slug, accountId, accountType, newPassword, newRole, newId } = body;
            if (!slug || !accountId || !accountType) {
                return res.status(400).json({ error: 'Thiếu thông tin tài khoản' });
            }

            const colName = `center_${slug}`;
            const docKey = accountType === 'teacher' ? 'teachers' : 'staff';
            const docRef = doc(db, colName, docKey);
            const docSnap = await getDoc(docRef);
            
            if (!docSnap.exists()) {
                return res.status(404).json({ error: 'Không tìm thấy dữ liệu' });
            }

            const items = docSnap.data()?.data || [];
            const idx = items.findIndex((item: any) => item.id === accountId);
            if (idx === -1) {
                return res.status(404).json({ error: `Không tìm thấy tài khoản "${accountId}"` });
            }

            const changes: string[] = [];

            if (newPassword) {
                items[idx].password = hashPassword(newPassword);
                changes.push('mật khẩu');
            }
            if (newRole) {
                items[idx].role = newRole;
                changes.push(`quyền → ${newRole}`);
            }
            if (newId && newId !== accountId) {
                // Check duplicate
                if (items.some((item: any) => item.id === newId)) {
                    return res.status(409).json({ error: `Mã "${newId}" đã tồn tại` });
                }
                items[idx].id = newId;
                changes.push(`mã → ${newId}`);
            }

            await updateDoc(docRef, { data: items });
            return res.status(200).json({ 
                success: true, 
                message: `Đã cập nhật ${changes.join(', ')} cho "${items[idx].name}"` 
            });
        }

        // Backup all centers' data
        if (body.action === 'backup_all') {
            try {
                const querySnapshot = await getDocs(collection(db, REGISTRY_COLLECTION));
                const allBackup: Record<string, any> = {};

                for (const centerDoc of querySnapshot.docs) {
                    const slug = centerDoc.id;
                    const colName = `center_${slug}`;
                    const data: any = {
                        students: [], teachers: [], staff: [], classes: [], attendance: [],
                        invoices: [], progressReports: [], transactions: [], income: [],
                        expenses: [], payrolls: [], announcements: [], settings: {}, auditLogs: [], rooms: []
                    };

                    const docsSnapshot = await getDocs(collection(db, colName));
                    docsSnapshot.forEach((docSnap) => {
                        const id = docSnap.id;
                        if (id === '_sync') return;
                        const docData = docSnap.data().data;

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

                    allBackup[slug] = data;
                }

                return res.status(200).json({
                    backupDate: new Date().toISOString(),
                    version: '1.8.0',
                    centersCount: Object.keys(allBackup).length,
                    centers: allBackup
                });
            } catch (error: any) {
                console.error('Backup All Error:', error);
                return res.status(500).json({ error: 'Sao lưu thất bại: ' + (error.message || 'Unknown') });
            }
        }

        // === RESTORE ALL ===
        if (body.action === 'restore_all') {
            try {
                const { backupData } = body;
                if (!backupData || !backupData.centers) {
                    return res.status(400).json({ error: 'Dữ liệu sao lưu không hợp lệ' });
                }

                const centersData = backupData.centers;
                const slugs = Object.keys(centersData);
                let restored = 0;

                const SHARDED_COLS = ['attendance', 'invoices', 'transactions', 'income', 'expenses', 'payrolls'];
                const NON_SHARDED_COLS = ['students', 'teachers', 'staff', 'classes', 'progressReports', 'announcements', 'settings', 'auditLogs', 'rooms'];

                for (const slug of slugs) {
                    const colName = `center_${slug}`;
                    const centerData = centersData[slug];
                    if (!centerData) continue;

                    // First: delete all existing docs in this center collection
                    const existingDocs = await getDocs(collection(db, colName));
                    const deleteBatches: any[] = [];
                    let deleteBatch = writeBatch(db);
                    let deleteCount = 0;
                    existingDocs.forEach((d) => {
                        deleteBatch.delete(doc(db, colName, d.id));
                        deleteCount++;
                        if (deleteCount >= 450) {
                            deleteBatches.push(deleteBatch);
                            deleteBatch = writeBatch(db);
                            deleteCount = 0;
                        }
                    });
                    if (deleteCount > 0) deleteBatches.push(deleteBatch);
                    for (const b of deleteBatches) await b.commit();

                    // Now write back data
                    let batch = writeBatch(db);
                    let opCount = 0;

                    const flushBatch = async () => {
                        if (opCount > 0) {
                            await batch.commit();
                            batch = writeBatch(db);
                            opCount = 0;
                        }
                    };

                    // Write non-sharded collections
                    for (const col of NON_SHARDED_COLS) {
                        if (centerData[col] !== undefined) {
                            batch.set(doc(db, colName, col), { data: centerData[col] });
                            opCount++;
                            if (opCount >= 450) await flushBatch();
                        }
                    }

                    // Write sharded collections — group items by shard key
                    for (const col of SHARDED_COLS) {
                        const items = centerData[col];
                        if (!Array.isArray(items) || items.length === 0) continue;

                        // Group by shard key
                        const shards: Record<string, any[]> = {};
                        for (const item of items) {
                            let shardKey = col; // fallback
                            try {
                                if (['transactions', 'income', 'expenses'].includes(col) && item.date) {
                                    const match = item.date.match(/^(\d{4})-(\d{2})/);
                                    if (match) shardKey = `${col}_${match[1]}_${match[2]}`;
                                } else if (['attendance', 'invoices', 'payrolls'].includes(col) && item.date) {
                                    const match = item.date.match(/^(\d{4})-(\d{2})/);
                                    if (match) shardKey = `${col}_${match[1]}_${match[2]}`;
                                }
                            } catch {}
                            if (!shards[shardKey]) shards[shardKey] = [];
                            shards[shardKey].push(item);
                        }

                        for (const [shardKey, shardItems] of Object.entries(shards)) {
                            batch.set(doc(db, colName, shardKey), { data: shardItems });
                            opCount++;
                            if (opCount >= 450) await flushBatch();
                        }
                    }

                    // Write sync doc
                    const newSyncId = Date.now().toString() + '_restore_' + Math.random().toString(36).substring(2);
                    batch.set(doc(db, colName, '_sync'), { syncId: newSyncId, lastUpdatedAt: Date.now() });
                    opCount++;
                    await flushBatch();

                    restored++;
                }

                return res.status(200).json({
                    message: `Đã khôi phục ${restored}/${slugs.length} trung tâm thành công.`
                });
            } catch (error: any) {
                console.error('Restore All Error:', error);
                return res.status(500).json({ error: 'Khôi phục thất bại: ' + (error.message || 'Unknown') });
            }
        }

        // === UPDATE SITE CONTENT (super admin only — auth already checked above) ===
        if (body.action === 'update_site_content') {
            const { landing, guide } = body;
            try {
                await setDoc(doc(db, SUPER_ADMIN_COLLECTION, 'site_content'), {
                    landing: landing || null,
                    guide: guide || null,
                    updatedAt: new Date().toISOString(),
                });
                return res.status(200).json({ success: true, message: 'Đã cập nhật nội dung trang chủ & hướng dẫn' });
            } catch (error: any) {
                return res.status(500).json({ error: 'Lỗi lưu nội dung: ' + error.message });
            }
        }

        return res.status(400).json({ error: 'Action không hợp lệ' });
    }

    // === GET: List centers (requires super admin) ===
    if (req.method === 'GET') {
        const authPayload = await getAuthPayload(req);
        if (!authPayload || !isSuperAdmin(authPayload)) {
            return res.status(403).json({ error: 'Chỉ Super Admin mới xem được' });
        }

        const querySnapshot = await getDocs(collection(db, REGISTRY_COLLECTION));
        const centers: any[] = [];
        const now = new Date();

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            // Auto-lock expired centers
            const isExpired = data.expiresAt && new Date(data.expiresAt) < now;
            centers.push({
                id: docSnap.id,
                ...data,
                isExpired,
                effectiveStatus: isExpired ? 'EXPIRED' : data.status
            });
        });

        return res.status(200).json({ centers });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Centers API Error:', error);
    return res.status(500).json({ error: 'A server error occurred: ' + (error.message || 'Unknown') });
  }
}
