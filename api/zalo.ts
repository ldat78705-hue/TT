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
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
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
    
    // Save new tokens to Firestore
    const colName = getCollectionName(centerId);
    const settingsRef = doc(db, colName, 'settings');
    const updateData: any = {
        zaloAccessToken: result.access_token,
        zaloTokenExpiresAt: now + (result.expires_in * 1000), // expires_in is seconds
    };
    if (result.refresh_token) {
        updateData.zaloRefreshToken = result.refresh_token;
    }
    await updateDoc(settingsRef, updateData);
    
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
        const colName = getCollectionName(centerId);
        const settingsDoc = await getDoc(doc(db, colName, 'settings'));
        const settings = settingsDoc.exists() ? settingsDoc.data() : {};
        
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
                
                // Save tokens
                const settingsRef = doc(db, colName, 'settings');
                const saveData: any = {
                    zaloAppId: appId,
                    zaloSecretKey: secretKey,
                    zaloRefreshToken: tokenResult.refresh_token || refreshToken,
                    zaloAccessToken: tokenResult.access_token,
                    zaloTokenExpiresAt: Date.now() + (tokenResult.expires_in * 1000),
                    zaloOaEnabled: true,
                };
                await updateDoc(settingsRef, saveData);
                
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
                // students: [{ name, parentName, parentPhone }]
                
                if (!students || !Array.isArray(students) || students.length === 0) {
                    return res.status(400).json({ error: 'Không có học viên để gửi thông báo' });
                }
                
                const { accessToken } = await getValidAccessToken(centerId, settings);
                
                const template = settings.zaloAbsenceTemplate || 
                    'Kính gửi PH {parentName},\n\nTrung tâm {centerName} xin thông báo: Học viên {studentName} đã vắng mặt tại lớp {className} ngày {date}.\n\nVui lòng liên hệ trung tâm nếu cần thêm thông tin.\nTrân trọng!';
                
                const results: any[] = [];
                
                for (const student of students) {
                    if (!student.parentPhone) {
                        results.push({ 
                            studentName: student.name, 
                            status: 'skipped', 
                            reason: 'Chưa có SĐT Zalo PH' 
                        });
                        continue;
                    }
                    
                    try {
                        // Try to find user by phone
                        // First get all followers, then match phone
                        let userId = null;
                        
                        // Zalo OA v3: use getfollowers then getprofile to match phone
                        // For now, use a simplified approach - store userId mapping in student data
                        // The phone-to-userId mapping needs to be done via follower list
                        
                        // Attempt: Get followers and match
                        let offset = 0;
                        let found = false;
                        const normalizedPhone = normalizePhone(student.parentPhone);
                        
                        while (!found) {
                            const followersResult = await getZaloFollowers(accessToken, offset, 50);
                            
                            if (followersResult.error || !followersResult.data?.followers) break;
                            
                            const followers = followersResult.data.followers;
                            if (followers.length === 0) break;
                            
                            for (const follower of followers) {
                                const profile = await getZaloUserProfile(accessToken, follower.user_id);
                                if (profile.data) {
                                    const followerPhone = normalizePhone(profile.data.shared_info?.phone || profile.data.phone || '');
                                    if (followerPhone === normalizedPhone) {
                                        userId = follower.user_id;
                                        found = true;
                                        break;
                                    }
                                }
                            }
                            
                            offset += followers.length;
                            if (followersResult.data.total <= offset) break;
                        }
                        
                        if (!userId) {
                            results.push({ 
                                studentName: student.name, 
                                status: 'failed', 
                                reason: `SĐT ${student.parentPhone} chưa follow OA` 
                            });
                            continue;
                        }
                        
                        const message = processTemplate(template, {
                            parentName: student.parentName || 'Phụ huynh',
                            studentName: student.name,
                            className: className || '',
                            date: date || new Date().toLocaleDateString('vi-VN'),
                            centerName: centerName || settings.name || 'Trung tâm',
                        });
                        
                        const sendResult = await sendZaloMessage(accessToken, userId, message);
                        
                        if (sendResult.error) {
                            results.push({ 
                                studentName: student.name, 
                                status: 'failed', 
                                reason: sendResult.message || 'Lỗi gửi tin' 
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
                
                const { studentName, parentName, parentPhone, amount, centerName: cn } = payload;
                
                if (!parentPhone) {
                    return res.status(400).json({ error: 'Chưa có SĐT Zalo phụ huynh' });
                }
                
                const { accessToken } = await getValidAccessToken(centerId, settings);
                
                const template = settings.zaloTuitionTemplate || 
                    'Kính gửi PH {parentName},\n\nTrung tâm {centerName} xin thông báo: Học viên {studentName} hiện có học phí chưa thanh toán: {amount}.\n\nVui lòng thanh toán để đảm bảo quyền lợi học tập.\nTrân trọng!';
                
                // Find user by phone (same logic as above)
                const normalizedPhone = normalizePhone(parentPhone);
                let userId = null;
                let offset = 0;
                
                while (true) {
                    const followersResult = await getZaloFollowers(accessToken, offset, 50);
                    if (followersResult.error || !followersResult.data?.followers) break;
                    
                    const followers = followersResult.data.followers;
                    if (followers.length === 0) break;
                    
                    for (const follower of followers) {
                        const profile = await getZaloUserProfile(accessToken, follower.user_id);
                        if (profile.data) {
                            const followerPhone = normalizePhone(profile.data.shared_info?.phone || profile.data.phone || '');
                            if (followerPhone === normalizedPhone) {
                                userId = follower.user_id;
                                break;
                            }
                        }
                    }
                    if (userId) break;
                    
                    offset += followers.length;
                    if (followersResult.data.total <= offset) break;
                }
                
                if (!userId) {
                    return res.status(400).json({ 
                        error: `SĐT ${parentPhone} chưa follow OA. Phụ huynh cần quét QR để follow OA trước.` 
                    });
                }
                
                const message = processTemplate(template, {
                    parentName: parentName || 'Phụ huynh',
                    studentName: studentName || '',
                    amount: typeof amount === 'number' ? Math.abs(amount).toLocaleString('vi-VN') + 'đ' : (amount || ''),
                    centerName: cn || settings.name || 'Trung tâm',
                });
                
                const sendResult = await sendZaloMessage(accessToken, userId, message);
                
                if (sendResult.error) {
                    return res.status(400).json({ error: sendResult.message || 'Lỗi gửi tin Zalo' });
                }
                
                return res.status(200).json({ 
                    success: true, 
                    message: `Đã gửi nhắc học phí cho PH ${parentName || parentPhone} thành công!` 
                });
            }
            
            // ===== GET FOLLOWER COUNT =====
            case 'get_followers': {
                if (!settings.zaloOaEnabled) {
                    return res.status(400).json({ error: 'Zalo OA chưa được kích hoạt' });
                }
                
                const { accessToken } = await getValidAccessToken(centerId, settings);
                const result = await getZaloFollowers(accessToken, 0, 1);
                
                return res.status(200).json({ 
                    success: true, 
                    totalFollowers: result.data?.total || 0 
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

function normalizePhone(phone: string): string {
    let p = phone.replace(/[\s\-\.\(\)]/g, '');
    if (p.startsWith('+84')) p = '0' + p.substring(3);
    if (p.startsWith('84') && p.length > 9) p = '0' + p.substring(2);
    return p;
}
