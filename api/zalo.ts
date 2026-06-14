/**
 * Zalo OA API Proxy — /api/zalo
 * 
 * Actions:
 * - test_connection: Test OA connection
 * - refresh_token: Refresh access token
 * - get_user_by_phone: Find Zalo user_id by phone number
 * - send_message: Send a message to a Zalo user
 * - send_bulk_absence: Send absence notifications to multiple parents
 * - send_tuition: Send tuition reminder to a parent
 */

import { verifyToken } from './_lib/jwt.js';
import { UserRole } from '../types.js';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { authenticateServer } from './_lib/serverAuth.js';
import fs from 'fs';
import path from 'path';

let firebaseConfig: any;
try {
    firebaseConfig = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
} catch (e) {
    console.error("Could not load firebase config for zalo endpoint.");
}

const fbApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(fbApp, firebaseConfig?.firestoreDatabaseId);

function getCollectionName(centerId?: string): string {
    if (!centerId || centerId === '_legacy') return 'db_core_v2_secure_9a8b7c6d5e4f3g2h1';
    return `center_${centerId}`;
}

async function getAuthPayload(req: any) {
    const authHeader = req.headers.authorization || req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    return await verifyToken(token);
}

// ===== Zalo API Helpers =====

const ZALO_OA_API = 'https://openapi.zalo.me/v3.0/oa';
const ZALO_OAUTH_URL = 'https://oauth.zaloapp.com/v4/oa/access_token';

async function refreshZaloToken(appId: string, secretKey: string, refreshToken: string) {
    const res = await fetch(ZALO_OAUTH_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'secret_key': secretKey,
        },
        body: new URLSearchParams({
            app_id: appId,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }),
    });
    return await res.json();
}

async function sendZaloMessage(accessToken: string, userId: string, message: string) {
    const res = await fetch(`${ZALO_OA_API}/message/cs`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'access_token': accessToken,
        },
        body: JSON.stringify({
            recipient: { user_id: userId },
            message: { text: message },
        }),
    });
    return await res.json();
}

async function getZaloOAInfo(accessToken: string) {
    const res = await fetch(`https://openapi.zalo.me/v2.0/oa/getoa`, {
        headers: { 'access_token': accessToken },
    });
    return await res.json();
}

async function getZaloFollowers(accessToken: string, offset: number = 0, count: number = 50) {
    const data = JSON.stringify({ offset, count });
    const res = await fetch(`${ZALO_OA_API}/getfollowers?data=${encodeURIComponent(data)}`, {
        headers: { 'access_token': accessToken },
    });
    return await res.json();
}

async function getZaloUserProfile(accessToken: string, userId: string) {
    const data = JSON.stringify({ user_id: userId });
    const res = await fetch(`${ZALO_OA_API}/getprofile?data=${encodeURIComponent(data)}`, {
        headers: { 'access_token': accessToken },
    });
    return await res.json();
}

// ===== Helper: Get valid access token, auto-refresh if needed =====
async function getValidAccessToken(centerId: string, settings: any): Promise<{ accessToken: string; newRefreshToken?: string }> {
    const now = Date.now();
    
    // If token still valid (with 5 min buffer)
    if (settings.zaloAccessToken && settings.zaloTokenExpiresAt && settings.zaloTokenExpiresAt > now + 300000) {
        return { accessToken: settings.zaloAccessToken };
    }
    
    // Refresh token
    if (!settings.zaloAppId || !settings.zaloSecretKey || !settings.zaloRefreshToken) {
        throw new Error('Chưa cấu hình đầy đủ thông tin Zalo OA. Vui lòng kiểm tra App ID, Secret Key và Refresh Token.');
    }
    
    const result = await refreshZaloToken(settings.zaloAppId, settings.zaloSecretKey, settings.zaloRefreshToken);
    
    if (result.error) {
        throw new Error(`Lỗi refresh token Zalo: ${result.error_description || result.error}. Vui lòng lấy Refresh Token mới.`);
    }
    
    // Save new tokens to Firestore — must write into 'data' wrapper field
    const colName = getCollectionName(centerId);
    const settingsRef = doc(db, colName, 'settings');
    const updatedSettings = {
        ...settings,
        zaloAccessToken: result.access_token,
        zaloTokenExpiresAt: now + (result.expires_in * 1000), // expires_in is seconds
    };
    if (result.refresh_token) {
        updatedSettings.zaloRefreshToken = result.refresh_token;
    }
    await updateDoc(settingsRef, { data: updatedSettings });
    // Invalidate data.ts cache
    const syncRef = doc(db, colName, '_sync');
    await setDoc(syncRef, { syncId: Date.now().toString() + '_' + Math.random().toString(36).substring(2), lastUpdatedAt: Date.now() });
    
    return { 
        accessToken: result.access_token,
        newRefreshToken: result.refresh_token || settings.zaloRefreshToken,
    };
}

// ===== Template processor =====
function processTemplate(template: string, vars: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
}

// ===== Main Handler =====
export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Authenticate
    const authPayload = await getAuthPayload(req);
    if (!authPayload) {
        return res.status(401).json({ error: 'Không có quyền truy cập' });
    }
    
    const centerId = (authPayload as any).centerId || '_legacy';
    const userRole = (authPayload as any).role;
    
    // Only ADMIN can use Zalo features
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.MANAGER) {
        return res.status(403).json({ error: 'Chỉ quản trị viên mới có thể sử dụng tính năng Zalo' });
    }
    
    const { action, ...payload } = req.body;
    
    try {
        await authenticateServer();
        
        // Get center settings
        // IMPORTANT: data.ts stores settings as { data: { ...fields } } in Firestore
        const colName = getCollectionName(centerId);
        const settingsDoc = await getDoc(doc(db, colName, 'settings'));
        const settings = settingsDoc.exists() ? (settingsDoc.data()?.data || settingsDoc.data() || {}) : {};
        
        switch (action) {
            // ===== TEST CONNECTION =====
            case 'test_connection': {
                const appId = payload.appId || settings.zaloAppId;
                const secretKey = payload.secretKey || settings.zaloSecretKey;
                const refreshToken = payload.refreshToken || settings.zaloRefreshToken;
                
                if (!appId || !secretKey || !refreshToken) {
                    return res.status(400).json({ error: 'Thiếu App ID, Secret Key hoặc Refresh Token' });
                }
                
                // Try to get access token
                const tokenResult = await refreshZaloToken(appId, secretKey, refreshToken);
                
                if (tokenResult.error) {
                    return res.status(400).json({ 
                        success: false, 
                        error: `Kết nối thất bại: ${tokenResult.error_description || tokenResult.error}` 
                    });
                }
                
                // Get OA info
                const oaInfo = await getZaloOAInfo(tokenResult.access_token);
                
                // Save tokens — must write into the 'data' wrapper field to match data.ts format
                const settingsRef = doc(db, colName, 'settings');
                const updatedSettings = {
                    ...settings,
                    zaloAppId: appId,
                    zaloSecretKey: secretKey,
                    zaloRefreshToken: tokenResult.refresh_token || refreshToken,
                    zaloAccessToken: tokenResult.access_token,
                    zaloTokenExpiresAt: Date.now() + (tokenResult.expires_in * 1000),
                    zaloOaEnabled: true,
                };
                await updateDoc(settingsRef, { data: updatedSettings });
                // Invalidate data.ts cache by updating _sync document
                const newSyncId = Date.now().toString() + '_' + Math.random().toString(36).substring(2);
                await setDoc(doc(db, colName, '_sync'), { syncId: newSyncId, lastUpdatedAt: Date.now() });
                
                return res.status(200).json({ 
                    success: true, 
                    oaName: oaInfo?.data?.name || 'Unknown',
                    oaId: oaInfo?.data?.oa_id,
                    message: `Kết nối thành công với OA: ${oaInfo?.data?.name || 'Zalo OA'}`,
                    newRefreshToken: tokenResult.refresh_token || refreshToken,
                });
            }
            
            // ===== SEND ABSENCE NOTIFICATIONS =====
            case 'send_absence': {
                if (!settings.zaloOaEnabled) {
                    return res.status(400).json({ error: 'Zalo OA chưa được kích hoạt' });
                }
                
                const { students, className, date, centerName } = payload;
                // students: [{ name, parentName, parentPhone, zaloUserId }]
                
                if (!students || !Array.isArray(students) || students.length === 0) {
                    return res.status(400).json({ error: 'Không có học viên để gửi thông báo' });
                }
                
                const { accessToken } = await getValidAccessToken(centerId, settings);
                
                const template = settings.messageTemplates?.absenceNotification || settings.zaloAbsenceTemplate || 
                    'Kính gửi PH {parentName},\n\nTrung tâm {centerName} xin thông báo: Học viên {studentName} đã vắng mặt tại lớp {className} ngày {date}.\n\nVui lòng liên hệ trung tâm nếu cần thêm thông tin.\nTrân trọng!';
                
                const results: any[] = [];
                
                for (const student of students) {
                    // Use zaloUserId directly — no more phone matching!
                    if (!student.zaloUserId) {
                        results.push({ 
                            studentName: student.name, 
                            status: 'skipped', 
                            reason: 'Chưa liên kết Zalo (vào Học viên → Liên kết Zalo)' 
                        });
                        continue;
                    }
                    
                    try {
                        const message = processTemplate(template, {
                            parentName: student.parentName || 'Phụ huynh',
                            studentName: student.name,
                            className: className || '',
                            date: date || new Date().toLocaleDateString('vi-VN'),
                            centerName: centerName || settings.name || 'Trung tâm',
                        });
                        
                        const sendResult = await sendZaloMessage(accessToken, student.zaloUserId, message);
                        
                        if (sendResult.error) {
                            results.push({ 
                                studentName: student.name, 
                                status: 'failed', 
                                reason: sendResult.message || `Lỗi gửi tin (code: ${sendResult.error})` 
                            });
                        } else {
                            results.push({ 
                                studentName: student.name, 
                                status: 'sent', 
                                reason: 'Đã gửi thành công' 
                            });
                        }
                    } catch (err: any) {
                        results.push({ 
                            studentName: student.name, 
                            status: 'failed', 
                            reason: err.message || 'Lỗi không xác định' 
                        });
                    }
                }
                
                const sent = results.filter(r => r.status === 'sent').length;
                const failed = results.filter(r => r.status === 'failed').length;
                const skipped = results.filter(r => r.status === 'skipped').length;
                
                return res.status(200).json({ 
                    success: true, 
                    results,
                    summary: { sent, failed, skipped, total: students.length },
                    message: `Đã gửi: ${sent}/${students.length} | Thất bại: ${failed} | Bỏ qua: ${skipped}`
                });
            }
            
            // ===== SEND TUITION REMINDER =====
            case 'send_tuition': {
                if (!settings.zaloOaEnabled) {
                    return res.status(400).json({ error: 'Zalo OA chưa được kích hoạt' });
                }
                
                const { studentName, parentName, parentPhone: _parentPhone, zaloUserId: tuitionZaloUserId, amount, centerName: cn } = payload;
                
                if (!tuitionZaloUserId) {
                    return res.status(400).json({ error: 'Học viên chưa liên kết Zalo. Vào Học viên → Liên kết Zalo trước.' });
                }
                
                const { accessToken } = await getValidAccessToken(centerId, settings);
                
                const template = settings.messageTemplates?.tuitionReminder || settings.zaloTuitionTemplate || 
                    'Kính gửi PH {parentName},\n\nTrung tâm {centerName} xin thông báo: Học viên {studentName} hiện có học phí chưa thanh toán: {amount}.\n\nVui lòng thanh toán để đảm bảo quyền lợi học tập.\nTrân trọng!';
                
                const message = processTemplate(template, {
                    parentName: parentName || 'Phụ huynh',
                    studentName: studentName || '',
                    amount: typeof amount === 'number' ? Math.abs(amount).toLocaleString('vi-VN') + 'đ' : (amount || ''),
                    centerName: cn || settings.name || 'Trung tâm',
                });
                
                const sendResult = await sendZaloMessage(accessToken, tuitionZaloUserId, message);
                
                if (sendResult.error) {
                    return res.status(400).json({ error: sendResult.message || 'Lỗi gửi tin Zalo' });
                }
                
                return res.status(200).json({ 
                    success: true, 
                    message: `Đã gửi nhắc học phí cho PH ${parentName || 'phụ huynh'} thành công!` 
                });
            }
            
            // ===== GET FOLLOWERS LIST (for admin linking) =====
            case 'get_followers_list': {
                if (!settings.zaloOaEnabled) {
                    return res.status(400).json({ error: 'Zalo OA chưa được kích hoạt' });
                }
                
                const { accessToken } = await getValidAccessToken(centerId, settings);
                const allFollowers: any[] = [];
                let flOffset = 0;
                
                while (true) {
                    const result = await getZaloFollowers(accessToken, flOffset, 50);
                    console.log('Zalo getFollowers response:', JSON.stringify(result));
                    
                    // Zalo API returns error=0 for success, non-zero for errors
                    if (result.error !== 0 && result.error !== undefined) {
                        console.error('Zalo getFollowers error:', result.error, result.message);
                        // Return error detail to frontend
                        return res.status(200).json({ 
                            success: true, 
                            followers: [],
                            total: 0,
                            debug: `Zalo API error: ${result.error} - ${result.message || 'Unknown'}`
                        });
                    }
                    
                    const followers = result.data?.followers || [];
                    if (followers.length === 0) break;
                    
                    // Get profile for each follower
                    for (const follower of followers) {
                        try {
                            const profile = await getZaloUserProfile(accessToken, follower.user_id);
                            console.log('Zalo profile for', follower.user_id, ':', JSON.stringify(profile));
                            allFollowers.push({
                                userId: follower.user_id,
                                displayName: profile.data?.display_name || 'Không tên',
                                avatar: profile.data?.avatars?.['120'] || profile.data?.avatar || '',
                                phone: profile.data?.shared_info?.phone || '',
                            });
                        } catch {
                            allFollowers.push({
                                userId: follower.user_id,
                                displayName: 'Không tên',
                                avatar: '',
                                phone: '',
                            });
                        }
                    }
                    
                    flOffset += followers.length;
                    if (result.data.total <= flOffset) break;
                }
                
                return res.status(200).json({ 
                    success: true, 
                    followers: allFollowers,
                    total: allFollowers.length
                });
            }
            
            // ===== GET FOLLOWER COUNT =====
            case 'get_followers': {
                if (!settings.zaloOaEnabled) {
                    return res.status(400).json({ error: 'Zalo OA chưa được kích hoạt' });
                }
                
                const { accessToken: countToken } = await getValidAccessToken(centerId, settings);
                const countResult = await getZaloFollowers(countToken, 0, 1);
                
                return res.status(200).json({ 
                    success: true, 
                    totalFollowers: countResult.data?.total || 0 
                });
            }
            
            default:
                return res.status(400).json({ error: `Action không hợp lệ: ${action}` });
        }
    } catch (error: any) {
        console.error('Zalo API Error:', error);
        return res.status(500).json({ 
            error: error.message || 'Lỗi server khi xử lý yêu cầu Zalo' 
        });
    }
}

export function normalizePhone(phone: string): string {
    let p = phone.replace(/[\s\-\.\(\)]/g, '');
    if (p.startsWith('+84')) p = '0' + p.substring(3);
    if (p.startsWith('84') && p.length > 9) p = '0' + p.substring(2);
    return p;
}
