/**
 * Zalo API Proxy — /api/zalo
 * 
 * Supports two channels:
 * 1. OA (Zalo Official Account) — default, existing
 * 2. SLL (Sổ Liên Lạc) — Zalo cá nhân via sll.lienchau.edu.vn
 * 
 * Settings fields:
 * - zaloChannel: 'oa' | 'sll' (default: 'sll')
 * - sllBaseUrl: URL of SLL server (default: https://sll.lienchau.edu.vn)
 * - sllApiKey: API key for SLL server
 * - sllAccountId: Account ID on SLL server
 */

import { verifyToken } from './_lib/jwt.js';
import { UserRole } from '../types.js';
import { aggregateStudentScores, generateAutoComment, ScoreHistory } from '../utils/autoComment.js';
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

export function getCollectionName(centerId?: string): string {
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

export async function sendZaloMessage(accessToken: string, userId: string, message: string) {
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
// ===== SLL (Sổ Liên Lạc) API Helpers =====

export async function sendViaSLL(sllBaseUrl: string, sllApiKey: string, sllAccountId: string, phone: string, message: string, imageUrl?: string): Promise<{ok: boolean, error?: string, msgId?: string}> {
    try {
        const url = `${sllBaseUrl}/api/zalo?p=ext/send&account=${sllAccountId}`;
        const body: any = { phone, message };
        if (imageUrl) body.imageUrl = imageUrl;
        
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': sllApiKey,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(30000),
        });
        const text = await res.text();
        try { return JSON.parse(text); } catch { return { ok: false, error: `SLL phản hồi không hợp lệ (HTTP ${res.status})` }; }
    } catch (err: any) {
        return { ok: false, error: err.name === 'TimeoutError' ? 'SLL timeout (30s)' : (err.message || 'Lỗi kết nối SLL') };
    }
}

export async function sendImageViaSLL(sllBaseUrl: string, sllApiKey: string, sllAccountId: string, phone: string, imageUrl: string, caption?: string): Promise<{ok: boolean, error?: string}> {
    try {
        const url = `${sllBaseUrl}/api/zalo?p=ext/send-image&account=${sllAccountId}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': sllApiKey,
            },
            body: JSON.stringify({ phone, imageUrl, caption }),
            signal: AbortSignal.timeout(30000),
        });
        const text = await res.text();
        try { return JSON.parse(text); } catch { return { ok: false, error: `SLL phản hồi không hợp lệ (HTTP ${res.status})` }; }
    } catch (err: any) {
        return { ok: false, error: err.name === 'TimeoutError' ? 'SLL timeout (30s)' : (err.message || 'Lỗi kết nối SLL') };
    }
}

async function checkSLLStatus(sllBaseUrl: string, sllApiKey: string, sllAccountId: string): Promise<{ok: boolean, zalo?: string, error?: string}> {
    try {
        const url = `${sllBaseUrl}/api/zalo?p=ext/status&account=${sllAccountId}`;
        const res = await fetch(url, {
            headers: { 'x-api-key': sllApiKey },
        });
        return await res.json();
    } catch (err: any) {
        return { ok: false, error: err.message || 'Lỗi kết nối SLL' };
    }
}

async function getSLLAccounts(sllBaseUrl: string, sllApiKey: string): Promise<{ok: boolean, accounts?: any[], error?: string}> {
    try {
        const url = `${sllBaseUrl}/api/zalo?p=ext/accounts`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'x-api-key': sllApiKey },
        });
        return await res.json();
    } catch (err: any) {
        return { ok: false, error: err.message || 'Lỗi kết nối SLL' };
    }
}

export function isSLLChannel(settings: any): boolean {
    return (settings.zaloChannel || 'sll') === 'sll';
}

export function getSLLConfig(settings: any) {
    return {
        baseUrl: settings.sllBaseUrl || 'https://sll.lienchau.edu.vn',
        apiKey: settings.sllApiKey || '',
        accountId: settings.sllAccountId || '',
    };
}

async function getZaloUserProfile(accessToken: string, userId: string) {
    const data = JSON.stringify({ user_id: userId });
    const res = await fetch(`${ZALO_OA_API}/getprofile?data=${encodeURIComponent(data)}`, {
        headers: { 'access_token': accessToken },
    });
    return await res.json();
}

// ===== Helper: Get valid access token, auto-refresh if needed =====
export async function getValidAccessToken(centerId: string, settings: any): Promise<{ accessToken: string; newRefreshToken?: string }> {
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
export function processTemplate(template: string, vars: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
}

// ===== Message Log =====
interface MessageLogEntry {
    id: string;
    timestamp: number;
    type: 'absence' | 'tuition' | 'overdue' | 'paymentConfirm' | 'custom' | 'group' | 'score';
    channel: 'sll' | 'oa';
    studentName: string;
    parentName: string;
    phone: string;
    message: string;
    status: 'sent' | 'failed' | 'skipped';
    reason?: string;
    className?: string;
}

export async function saveMessageLog(colName: string, entries: MessageLogEntry[]) {
    if (!entries.length) return;
    try {
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const logDocRef = doc(db, colName, `_messageLog_${monthKey}`);
        const logDoc = await getDoc(logDocRef);
        const existing: MessageLogEntry[] = logDoc.exists() ? (logDoc.data()?.entries || []) : [];
        const updated = [...existing, ...entries];
        await setDoc(logDocRef, { entries: updated, updatedAt: Date.now() });
    } catch (e) {
        console.error('Failed to save message log:', e);
    }
}

async function getMessageLogs(colName: string, month: string): Promise<MessageLogEntry[]> {
    try {
        const logDocRef = doc(db, colName, `_messageLog_${month}`);
        const logDoc = await getDoc(logDocRef);
        return logDoc.exists() ? (logDoc.data()?.entries || []) : [];
    } catch (e) {
        console.error('Failed to get message logs:', e);
        return [];
    }
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
    
    // Only ADMIN, MANAGER, ACCOUNTANT can use Zalo features
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.MANAGER && userRole !== UserRole.ACCOUNTANT) {
        return res.status(403).json({ error: 'Chỉ quản trị viên hoặc kế toán mới có thể sử dụng tính năng Zalo' });
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
            // ===== TEST SLL CONNECTION =====
            case 'test_sll_connection': {
                const sllUrl = payload.sllBaseUrl || settings.sllBaseUrl || 'https://sll.lienchau.edu.vn';
                const sllKey = payload.sllApiKey || settings.sllApiKey;
                const sllAcc = payload.sllAccountId || settings.sllAccountId;
                
                if (!sllUrl || !sllKey || !sllAcc) {
                    return res.status(400).json({ error: 'Thiếu URL, API Key hoặc Account ID của Sổ Liên Lạc' });
                }
                
                try {
                    const statusResult = await checkSLLStatus(sllUrl, sllKey, sllAcc);
                    
                    if (!statusResult.ok) {
                        return res.status(400).json({ 
                            success: false, 
                            error: statusResult.error || 'Không kết nối được Sổ Liên Lạc'
                        });
                    }
                    
                    // Save SLL settings
                    const settingsRef = doc(db, colName, 'settings');
                    const updatedSettings = {
                        ...settings,
                        sllBaseUrl: sllUrl,
                        sllApiKey: sllKey,
                        sllAccountId: sllAcc,
                        zaloChannel: 'sll',
                    };
                    await updateDoc(settingsRef, { data: updatedSettings });
                    const newSyncId = Date.now().toString() + '_' + Math.random().toString(36).substring(2);
                    await setDoc(doc(db, colName, '_sync'), { syncId: newSyncId, lastUpdatedAt: Date.now() });
                    
                    return res.status(200).json({ 
                        success: true, 
                        zaloStatus: statusResult.zalo,
                        message: `Kết nối SLL thành công! Zalo: ${statusResult.zalo === 'ready' ? 'Đã kết nối' : 'Chưa kết nối Zalo'}`,
                    });
                } catch (err: any) {
                    return res.status(400).json({ 
                        success: false, 
                        error: `Lỗi kết nối SLL: ${err.message}` 
                    });
                }
            }

            // ===== GET SLL ACCOUNTS =====
            case 'get_sll_accounts': {
                const sll = getSLLConfig(settings);
                if (!sll.baseUrl || !sll.apiKey) {
                    return res.status(400).json({ error: 'Chưa cấu hình Sổ Liên Lạc' });
                }
                try {
                    const result = await getSLLAccounts(sll.baseUrl, sll.apiKey);
                    return res.status(200).json(result);
                } catch (err: any) {
                    return res.status(500).json({ error: err.message });
                }
            }

            // ===== SLL CREATE ACCOUNT =====
            case 'sll_create_account': {
                const sll = getSLLConfig(settings);
                if (!sll.baseUrl || !sll.apiKey) {
                    return res.status(400).json({ error: 'Chưa cấu hình Sổ Liên Lạc' });
                }
                const accId = payload.accountId || centerId;
                const label = payload.label || settings.name || centerId;
                try {
                    const r = await fetch(`${sll.baseUrl}/api/zalo?p=ext/create-account`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-api-key': sll.apiKey },
                        body: JSON.stringify({ accountId: accId, label }),
                    });
                    const result = await r.json();
                    if (result.ok) {
                        // Auto-save accountId to settings
                        const settingsRef = doc(db, colName, 'settings');
                        await updateDoc(settingsRef, { data: { ...settings, sllAccountId: accId } });
                        const newSyncId = Date.now().toString() + '_' + Math.random().toString(36).substring(2);
                        await setDoc(doc(db, colName, '_sync'), { syncId: newSyncId, lastUpdatedAt: Date.now() });
                    }
                    return res.status(200).json(result);
                } catch (err: any) {
                    return res.status(500).json({ error: err.message });
                }
            }

            // ===== SLL LOGIN START =====
            case 'sll_login_start': {
                const sll = getSLLConfig(settings);
                if (!sll.baseUrl || !sll.apiKey || !sll.accountId) {
                    return res.status(400).json({ error: 'Chưa cấu hình đầy đủ Sổ Liên Lạc' });
                }
                try {
                    const r = await fetch(`${sll.baseUrl}/api/zalo?p=ext/login-start&account=${sll.accountId}`, {
                        method: 'POST',
                        headers: { 'x-api-key': sll.apiKey },
                    });
                    const result = await r.json();
                    return res.status(200).json(result);
                } catch (err: any) {
                    return res.status(500).json({ error: err.message });
                }
            }

            // ===== SLL LOGIN STATE =====
            case 'sll_login_state': {
                const sll = getSLLConfig(settings);
                if (!sll.baseUrl || !sll.apiKey || !sll.accountId) {
                    return res.status(400).json({ error: 'Chưa cấu hình đầy đủ Sổ Liên Lạc' });
                }
                try {
                    const r = await fetch(`${sll.baseUrl}/api/zalo?p=ext/login-state&account=${sll.accountId}`, {
                        headers: { 'x-api-key': sll.apiKey },
                    });
                    const result = await r.json();
                    return res.status(200).json(result);
                } catch (err: any) {
                    return res.status(200).json({ 
                        error: err.message || 'Lỗi kết nối SLL',
                        zalo: 'unknown'
                    });
                }
            }

            // ===== SLL DISCONNECT =====
            case 'sll_disconnect': {
                const sll = getSLLConfig(settings);
                if (!sll.baseUrl || !sll.apiKey || !sll.accountId) {
                    return res.status(400).json({ error: 'Chưa cấu hình đầy đủ Sổ Liên Lạc' });
                }
                try {
                    const r = await fetch(`${sll.baseUrl}/api/zalo?p=ext/disconnect&account=${sll.accountId}`, {
                        method: 'POST',
                        headers: { 'x-api-key': sll.apiKey },
                    });
                    const result = await r.json();
                    return res.status(200).json(result);
                } catch (err: any) {
                    return res.status(500).json({ error: err.message });
                }
            }

            // ===== SLL SCAN GROUPS =====
            case 'sll_scan_groups': {
                const sll = getSLLConfig(settings);
                if (!sll.baseUrl || !sll.apiKey || !sll.accountId) {
                    return res.status(400).json({ error: 'Chưa cấu hình đầy đủ Sổ Liên Lạc' });
                }
                try {
                    const r = await fetch(`${sll.baseUrl}/api/zalo?p=ext/scan-groups&account=${sll.accountId}`, {
                        method: 'POST',
                        headers: { 'x-api-key': sll.apiKey },
                    });
                    const result = await r.json();
                    return res.status(200).json(result);
                } catch (err: any) {
                    return res.status(500).json({ error: err.message });
                }
            }

            // ===== SET ZALO CHANNEL =====
            case 'set_channel': {
                const channel = payload.channel || 'sll';
                if (channel !== 'oa' && channel !== 'sll') {
                    return res.status(400).json({ error: 'Channel phải là "oa" hoặc "sll"' });
                }
                const settingsRef = doc(db, colName, 'settings');
                await updateDoc(settingsRef, { data: { ...settings, zaloChannel: channel } });
                const newSyncId = Date.now().toString() + '_' + Math.random().toString(36).substring(2);
                await setDoc(doc(db, colName, '_sync'), { syncId: newSyncId, lastUpdatedAt: Date.now() });
                return res.status(200).json({ success: true, channel, message: `Đã chuyển kênh gửi sang: ${channel === 'sll' ? 'Sổ Liên Lạc' : 'Zalo OA'}` });
            }

            // ===== TEST OA CONNECTION =====
            case 'test_connection': {
                const appId = payload.appId || settings.zaloAppId;
                const secretKey = payload.secretKey || settings.zaloSecretKey;
                const refreshToken = payload.refreshToken || settings.zaloRefreshToken;
                
                if (!appId || !secretKey || !refreshToken) {
                    return res.status(400).json({ error: 'Thiếu App ID, Secret Key hoặc Refresh Token' });
                }
                
                const tokenResult = await refreshZaloToken(appId, secretKey, refreshToken);
                
                if (tokenResult.error) {
                    return res.status(400).json({ 
                        success: false, 
                        error: `Kết nối thất bại: ${tokenResult.error_description || tokenResult.error}` 
                    });
                }
                
                const oaInfo = await getZaloOAInfo(tokenResult.access_token);
                
                const settingsRef = doc(db, colName, 'settings');
                const updatedSettings = {
                    ...settings,
                    zaloAppId: appId,
                    zaloSecretKey: secretKey,
                    zaloRefreshToken: tokenResult.refresh_token || refreshToken,
                    zaloAccessToken: tokenResult.access_token,
                    zaloTokenExpiresAt: Date.now() + (tokenResult.expires_in * 1000),
                    zaloOaEnabled: true,
                    zaloChannel: 'oa',
                };
                await updateDoc(settingsRef, { data: updatedSettings });
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
                const { students, className, date, centerName } = payload;
                
                if (!students || !Array.isArray(students) || students.length === 0) {
                    return res.status(400).json({ error: 'Không có học viên để gửi thông báo' });
                }
                
                const template = settings.messageTemplates?.absenceNotification || settings.zaloAbsenceTemplate || 
                    'Anh/Chị phụ huynh con {studentName} thân mến,\n{centerName} xin thông báo: con {studentName} vắng mặt tại lớp {className} ngày {date}.\nAnh/Chị vui lòng phản hồi để thầy cô nắm tình hình của con nhé.\nTrân trọng cảm ơn!';
                
                const results: any[] = [];
                
                if (isSLLChannel(settings)) {
                    // SLL channel — send by phone
                    const sll = getSLLConfig(settings);
                    if (!sll.apiKey || !sll.accountId) {
                        return res.status(400).json({ error: 'Chưa cấu hình Sổ Liên Lạc. Vào Cài đặt → Sổ Liên Lạc.' });
                    }
                    
                    for (let si = 0; si < students.length; si++) {
                        const student = students[si];
                        const phone = student.parentPhone || student.phone;
                        if (!phone) {
                            results.push({ studentName: student.name, parentName: student.parentName || '', phone: '', status: 'skipped', reason: 'Chưa có SĐT phụ huynh' });
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
                            const sendResult = await sendViaSLL(sll.baseUrl, sll.apiKey, sll.accountId, phone, message);
                            if (sendResult.ok) {
                                results.push({ studentName: student.name, parentName: student.parentName || '', phone, status: 'sent', reason: 'Đã gửi qua SLL' });
                            } else {
                                results.push({ studentName: student.name, parentName: student.parentName || '', phone, status: 'failed', reason: sendResult.error || 'Lỗi SLL' });
                            }
                        } catch (err: any) {
                            results.push({ studentName: student.name, parentName: student.parentName || '', phone, status: 'failed', reason: err.message });
                        }
                        // Delay between messages
                        if (si < students.length - 1) {
                            await new Promise(r => setTimeout(r, 2000));
                        }
                    }
                } else {
                    // OA channel
                    if (!settings.zaloOaEnabled) {
                        return res.status(400).json({ error: 'Zalo OA chưa được kích hoạt' });
                    }
                    const { accessToken } = await getValidAccessToken(centerId, settings);
                    
                    for (const student of students) {
                        if (!student.zaloUserId) {
                            results.push({ studentName: student.name, parentName: student.parentName || '', phone: student.parentPhone || student.phone || '', status: 'skipped', reason: 'Chưa liên kết Zalo' });
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
                                results.push({ studentName: student.name, parentName: student.parentName || '', phone: student.parentPhone || student.phone || '', status: 'failed', reason: sendResult.message || `Code: ${sendResult.error}` });
                            } else {
                                results.push({ studentName: student.name, parentName: student.parentName || '', phone: student.parentPhone || student.phone || '', status: 'sent', reason: 'Đã gửi qua Zalo OA' });
                            }
                        } catch (err: any) {
                            results.push({ studentName: student.name, parentName: student.parentName || '', phone: student.parentPhone || student.phone || '', status: 'failed', reason: err.message });
                        }
                    }
                }
                
                const sent = results.filter(r => r.status === 'sent').length;
                const failed = results.filter(r => r.status === 'failed').length;
                const skipped = results.filter(r => r.status === 'skipped').length;
                
                // Save message logs
                const absLogEntries: MessageLogEntry[] = results.filter(r => r.status !== 'skipped').map((r: any, i: number) => ({
                    id: `msg_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 8)}`,
                    timestamp: Date.now(),
                    type: 'absence' as const,
                    channel: (isSLLChannel(settings) ? 'sll' : 'oa') as 'sll' | 'oa',
                    studentName: r.studentName || '',
                    parentName: r.parentName || '',
                    phone: r.phone || '',
                    message: processTemplate(template, {
                        parentName: r.parentName || 'Phụ huynh',
                        studentName: r.studentName || '',
                        className: className || '',
                        date: date || new Date().toLocaleDateString('vi-VN'),
                        centerName: centerName || settings.name || 'Trung tâm',
                    }),
                    status: r.status,
                    reason: r.reason,
                    className: className || '',
                }));
                await saveMessageLog(colName, absLogEntries);
                
                return res.status(200).json({ 
                    success: true, 
                    results,
                    summary: { sent, failed, skipped, total: students.length },
                    message: `Đã gửi: ${sent}/${students.length} | Thất bại: ${failed} | Bỏ qua: ${skipped}`
                });
            }
            
            // ===== SEND TUITION REMINDER =====
            case 'send_tuition': {
                const { studentName, parentName, parentPhone: _parentPhone, zaloUserId: tuitionZaloUserId, amount, centerName: cn, invoiceMonth, imageUrl: tuitionImageUrl } = payload;
                
                const template = settings.messageTemplates?.tuitionReminder || settings.zaloTuitionTemplate || 
                    'Anh/Chị phụ huynh con {studentName} thân mến,\n{centerName} xin gửi thông tin học phí của con {studentName}: {amount}.\nThời hạn đóng: trước ngày {deadline}.\nAnh/Chị vui lòng sắp xếp đóng học phí đúng hạn giúp ạ.{bankInfo}\nMọi thắc mắc xin liên hệ trung tâm.\nTrân trọng cảm ơn!';
                
                const bankInfo = settings.bankAccountNumber 
                    ? `\nThông tin CK: ${settings.bankAccountNumber} - ${settings.bankAccountHolder || ''} - ${settings.bankName || ''}` 
                    : '';
                
                // Calculate deadline: Nth of month after invoice month (N = tuitionDeadlineDay, default 10)
                const dDay = settings.tuitionDeadlineDay || 10;
                let deadline: string;
                if (invoiceMonth) {
                    const [invYear, invMonth] = invoiceMonth.split('-').map(Number);
                    const deadlineDate = new Date(invYear, invMonth, dDay); // invMonth is 1-based, Date 0-based = next month
                    deadline = `${String(dDay).padStart(2, '0')}/${String(deadlineDate.getMonth() + 1).padStart(2, '0')}/${deadlineDate.getFullYear()}`;
                } else {
                    const now2 = new Date();
                    const nextMonth2 = new Date(now2.getFullYear(), now2.getMonth() + 1, dDay);
                    deadline = `${String(dDay).padStart(2, '0')}/${String(nextMonth2.getMonth() + 1).padStart(2, '0')}/${nextMonth2.getFullYear()}`;
                }
                
                const message = processTemplate(template, {
                    parentName: parentName || 'Phụ huynh',
                    studentName: studentName || '',
                    amount: typeof amount === 'number' ? Math.abs(amount).toLocaleString('vi-VN') + 'đ' : (amount || ''),
                    centerName: cn || settings.name || 'Trung tâm',
                    bankInfo,
                    deadline,
                    className: payload.className || '',
                    date: new Date().toLocaleDateString('vi-VN'),
                });
                
                // Auto-append deadline & bank info if template didn't include them
                let finalMessage = message;
                if (!template.includes('{deadline}') && deadline) {
                    finalMessage += `\nHạn đóng: trước ngày ${deadline}.`;
                }
                if (!template.includes('{bankInfo}') && bankInfo) {
                    finalMessage += bankInfo;
                }
                
                if (isSLLChannel(settings)) {
                    const sll = getSLLConfig(settings);
                    if (!sll.apiKey || !sll.accountId) {
                        return res.status(400).json({ error: 'Chưa cấu hình Sổ Liên Lạc' });
                    }
                    if (!_parentPhone) {
                        return res.status(400).json({ error: 'Chưa có SĐT phụ huynh' });
                    }
                    const sendResult = await sendViaSLL(sll.baseUrl, sll.apiKey, sll.accountId, _parentPhone, finalMessage);
                    
                    // Gửi ảnh hóa đơn riêng nếu có
                    if (tuitionImageUrl && sendResult.ok) {
                        try {
                            await new Promise(r => setTimeout(r, 2000)); // Đợi 2s tránh rate limit
                            await sendImageViaSLL(sll.baseUrl, sll.apiKey, sll.accountId, _parentPhone, tuitionImageUrl, `Phiếu thông báo HP - ${studentName}`);
                        } catch (imgErr) {
                            console.warn('Failed to send tuition image:', imgErr);
                        }
                    }
                    
                    const logEntry: MessageLogEntry = { id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`, timestamp: Date.now(), type: 'tuition', channel: 'sll', studentName: studentName || '', parentName: parentName || '', phone: _parentPhone || '', message: finalMessage, status: sendResult.ok ? 'sent' : 'failed', reason: sendResult.ok ? (tuitionImageUrl ? 'Đã gửi qua SLL (kèm ảnh)' : 'Đã gửi qua SLL') : (sendResult.error || 'Lỗi SLL'), className: payload.className || '' };
                    await saveMessageLog(colName, [logEntry]);
                    if (!sendResult.ok) {
                        return res.status(400).json({ error: sendResult.error || 'Lỗi gửi qua SLL' });
                    }
                    return res.status(200).json({ success: true, message: tuitionImageUrl ? `Đã gửi nhắc HP (kèm ảnh) qua SLL cho PH ${parentName || 'phụ huynh'}!` : `Đã gửi nhắc HP qua SLL cho PH ${parentName || 'phụ huynh'}!` });
                } else {
                    if (!settings.zaloOaEnabled) {
                        return res.status(400).json({ error: 'Zalo OA chưa được kích hoạt' });
                    }
                    if (!tuitionZaloUserId) {
                        return res.status(400).json({ error: 'Học viên chưa liên kết Zalo' });
                    }
                    const { accessToken } = await getValidAccessToken(centerId, settings);
                    const sendResult = await sendZaloMessage(accessToken, tuitionZaloUserId, finalMessage);
                    const logEntry: MessageLogEntry = { id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`, timestamp: Date.now(), type: 'tuition', channel: 'oa', studentName: studentName || '', parentName: parentName || '', phone: _parentPhone || '', message: finalMessage, status: sendResult.error ? 'failed' : 'sent', reason: sendResult.error ? (sendResult.message || 'Lỗi OA') : 'Đã gửi qua Zalo OA', className: payload.className || '' };
                    await saveMessageLog(colName, [logEntry]);
                    if (sendResult.error) {
                        return res.status(400).json({ error: sendResult.message || 'Lỗi gửi tin Zalo OA' });
                    }
                    return res.status(200).json({ success: true, message: `Đã gửi nhắc học phí qua OA cho PH ${parentName || 'phụ huynh'}!` });
                }
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
            
            // ===== SEND OVERDUE TUITION REMINDERS (BULK) =====
            case 'send_overdue_reminders': {
                const { students: overdueStudents } = payload;
                
                if (!overdueStudents || !Array.isArray(overdueStudents) || overdueStudents.length === 0) {
                    return res.status(400).json({ error: 'Không có học viên để gửi nhắc nhở' });
                }
                
                const template = settings.messageTemplates?.tuitionReminder || settings.zaloTuitionTemplate || 
                    'Anh/Chị phụ huynh con {studentName} thân mến,\n{centerName} xin gửi thông tin học phí của con {studentName}: {amount}.\nThời hạn đóng: trước ngày {deadline}.\nAnh/Chị vui lòng sắp xếp đóng học phí đúng hạn giúp ạ.{bankInfo}\nMọi thắc mắc xin liên hệ trung tâm.\nTrân trọng cảm ơn!';
                
                const bankInfo = settings.bankAccountNumber 
                    ? `\nThông tin CK: ${settings.bankAccountNumber} - ${settings.bankAccountHolder || ''} - ${settings.bankName || ''}` 
                    : '';
                
                const results: any[] = [];
                
                if (isSLLChannel(settings)) {
                    const sll = getSLLConfig(settings);
                    if (!sll.apiKey || !sll.accountId) {
                        return res.status(400).json({ error: 'Chưa cấu hình Sổ Liên Lạc' });
                    }
                    
                    for (let si = 0; si < overdueStudents.length; si++) {
                        const student = overdueStudents[si];
                        const phone = student.parentPhone || student.phone;
                        if (!phone) {
                            results.push({ studentName: student.name, parentName: student.parentName || '', parentPhone: phone, phone: phone, amount: student.amount, className: student.className || '', status: 'skipped', reason: 'Chưa có SĐT phụ huynh' });
                            continue;
                        }
                        try {
                            // Calculate deadline based on source
                            const dDay = settings.tuitionDeadlineDay || 10;
                            let deadline: string;
                            if (student.invoiceMonth) {
                                const [invYear, invMonth] = student.invoiceMonth.split('-').map(Number);
                                const deadlineDate = new Date(invYear, invMonth, dDay);
                                deadline = `${String(dDay).padStart(2, '0')}/${String(deadlineDate.getMonth() + 1).padStart(2, '0')}/${deadlineDate.getFullYear()}`;
                            } else {
                                const now = new Date();
                                const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, dDay);
                                deadline = `${String(dDay).padStart(2, '0')}/${String(nextMonth.getMonth() + 1).padStart(2, '0')}/${nextMonth.getFullYear()}`;
                            }
                            
                            const message = processTemplate(template, {
                                parentName: student.parentName || 'Phụ huynh',
                                studentName: student.name || '',
                                amount: typeof student.amount === 'number' ? Math.abs(student.amount).toLocaleString('vi-VN') + 'đ' : (student.amount || ''),
                                centerName: settings.name || 'Trung tâm',
                                bankInfo,
                                deadline,
                                className: student.className || '',
                                date: new Date().toLocaleDateString('vi-VN'),
                            });
                            // Auto-append deadline & bank info if template didn't include them
                            let finalMessage = message;
                            if (!template.includes('{deadline}') && deadline) {
                                finalMessage += `\nHạn đóng: trước ngày ${deadline}.`;
                            }
                            if (!template.includes('{bankInfo}') && bankInfo) {
                                finalMessage += bankInfo;
                            }
                            
                            console.log(`[send_overdue] [${si + 1}/${overdueStudents.length}] Gửi cho ${student.name} (${phone})`);
                            
                            // Gửi tin nhắn text (retry 1 lần chỉ khi SLL trả lỗi rõ ràng, KHÔNG retry khi timeout)
                            let sendResult = await sendViaSLL(sll.baseUrl, sll.apiKey, sll.accountId, phone, finalMessage);
                            if (!sendResult.ok && sendResult.error && !sendResult.error.includes('timeout')) {
                                // SLL trả lỗi rõ ràng (không phải timeout) → an toàn retry
                                console.warn(`[send_overdue] Text fail lần 1: ${sendResult.error}. Retry sau 5s...`);
                                await new Promise(r => setTimeout(r, 5000));
                                sendResult = await sendViaSLL(sll.baseUrl, sll.apiKey, sll.accountId, phone, finalMessage);
                                if (!sendResult.ok) {
                                    console.error(`[send_overdue] Text fail lần 2: ${sendResult.error}`);
                                }
                            }
                            
                            // Gửi ảnh riêng sau khi text đã gửi thành công
                            if (student.imageUrl && sendResult.ok) {
                                try {
                                    await new Promise(r => setTimeout(r, 2000)); // Đợi 2s tránh rate limit
                                    await sendImageViaSLL(sll.baseUrl, sll.apiKey, sll.accountId, phone, student.imageUrl, `Phiếu thông báo HP - ${student.name}`);
                                } catch (imgErr) {
                                    console.warn('Failed to send image separately:', imgErr);
                                }
                            }
                            
                            if (sendResult.ok) {
                                results.push({ studentName: student.name, parentName: student.parentName || '', parentPhone: phone, phone: phone, amount: student.amount, className: student.className || '', status: 'sent', reason: student.imageUrl ? 'Đã gửi qua SLL (kèm ảnh)' : 'Đã gửi qua SLL' });
                            } else {
                                results.push({ studentName: student.name, parentName: student.parentName || '', parentPhone: phone, phone: phone, amount: student.amount, className: student.className || '', status: 'failed', reason: sendResult.error || 'Lỗi SLL' });
                            }
                        } catch (err: any) {
                            results.push({ studentName: student.name, parentName: student.parentName || '', parentPhone: phone, phone: phone, amount: student.amount, className: student.className || '', status: 'failed', reason: err.message });
                        }
                        // Đợi 5s giữa mỗi học sinh (tránh Zalo rate limit)
                        if (si < overdueStudents.length - 1) {
                            await new Promise(r => setTimeout(r, 5000));
                        }
                    }
                } else {
                    if (!settings.zaloOaEnabled) {
                        return res.status(400).json({ error: 'Zalo OA chưa được kích hoạt' });
                    }
                    const { accessToken } = await getValidAccessToken(centerId, settings);
                    
                    for (const student of overdueStudents) {
                        if (!student.zaloUserId) {
                            results.push({ studentName: student.name, parentName: student.parentName || '', parentPhone: student.parentPhone || student.phone || '', phone: student.parentPhone || student.phone || '', amount: student.amount, className: student.className || '', status: 'skipped', reason: 'Chưa liên kết Zalo' });
                            continue;
                        }
                        try {
                            // Calculate deadline for OA path
                            const dDay = settings.tuitionDeadlineDay || 10;
                            let deadline: string;
                            if (student.invoiceMonth) {
                                const [invYear, invMonth] = student.invoiceMonth.split('-').map(Number);
                                const deadlineDate = new Date(invYear, invMonth, dDay);
                                deadline = `${String(dDay).padStart(2, '0')}/${String(deadlineDate.getMonth() + 1).padStart(2, '0')}/${deadlineDate.getFullYear()}`;
                            } else {
                                const now = new Date();
                                const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, dDay);
                                deadline = `${String(dDay).padStart(2, '0')}/${String(nextMonth.getMonth() + 1).padStart(2, '0')}/${nextMonth.getFullYear()}`;
                            }
                            const bankInfo = settings.bankAccountNumber 
                                ? `\nThông tin CK: ${settings.bankAccountNumber} - ${settings.bankAccountHolder || ''} - ${settings.bankName || ''}` 
                                : '';
                            const message = processTemplate(template, {
                                parentName: student.parentName || 'Phụ huynh',
                                studentName: student.name || '',
                                amount: typeof student.amount === 'number' ? Math.abs(student.amount).toLocaleString('vi-VN') + 'đ' : (student.amount || ''),
                                centerName: settings.name || 'Trung tâm',
                                bankInfo,
                                deadline,
                                className: student.className || '',
                                date: new Date().toLocaleDateString('vi-VN'),
                            });
                            let finalMessage = message;
                            if (!template.includes('{deadline}') && deadline) {
                                finalMessage += `\nHạn đóng: trước ngày ${deadline}.`;
                            }
                            if (!template.includes('{bankInfo}') && bankInfo) {
                                finalMessage += bankInfo;
                            }
                            const sendResult = await sendZaloMessage(accessToken, student.zaloUserId, finalMessage);
                            if (sendResult.error) {
                                results.push({ studentName: student.name, parentName: student.parentName || '', parentPhone: student.parentPhone || student.phone || '', phone: student.parentPhone || student.phone || '', amount: student.amount, className: student.className || '', status: 'failed', reason: sendResult.message || `Code: ${sendResult.error}` });
                            } else {
                                results.push({ studentName: student.name, parentName: student.parentName || '', parentPhone: student.parentPhone || student.phone || '', phone: student.parentPhone || student.phone || '', amount: student.amount, className: student.className || '', status: 'sent', reason: 'Đã gửi qua Zalo OA' });
                            }
                        } catch (err: any) {
                            results.push({ studentName: student.name, parentName: student.parentName || '', parentPhone: student.parentPhone || student.phone || '', phone: student.parentPhone || student.phone || '', amount: student.amount, className: student.className || '', status: 'failed', reason: err.message });
                        }
                    }
                }
                
                const sent = results.filter(r => r.status === 'sent').length;
                const failed = results.filter(r => r.status === 'failed').length;
                const skipped = results.filter(r => r.status === 'skipped').length;
                
                // Save message logs
                const overdueLogEntries: MessageLogEntry[] = results.filter(r => r.status !== 'skipped').map((r: any, i: number) => ({
                    id: `msg_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 8)}`,
                    timestamp: Date.now(),
                    type: 'overdue' as const,
                    channel: (isSLLChannel(settings) ? 'sll' : 'oa') as 'sll' | 'oa',
                    studentName: r.studentName || '',
                    parentName: r.parentName || '',
                    phone: r.parentPhone || r.phone || '',
                    message: `[Nhắc công nợ] ${r.studentName}: ${r.amount ? Math.abs(r.amount).toLocaleString('vi-VN') + 'đ' : ''}`,
                    status: r.status,
                    reason: r.reason,
                    className: r.className || '',
                }));
                await saveMessageLog(colName, overdueLogEntries);
                
                return res.status(200).json({ 
                    success: true, 
                    results,
                    summary: { sent, failed, skipped, total: overdueStudents.length },
                    message: `Đã gửi nhắc nhở: ${sent}/${overdueStudents.length} | Thất bại: ${failed} | Bỏ qua: ${skipped}`
                });
            }
            
            case 'sendPaymentConfirm': {
                const { studentName, parentName, parentPhone: confirmPhone, zaloUserId: confirmZaloId, amount: confirmAmount } = payload;
                
                const template = settings.messageTemplates?.paymentConfirm || 
                    'Anh/Chị phụ huynh con {studentName} thân mến,\n{centerName} xác nhận đã nhận học phí {amount} của con {studentName}.\nCảm ơn Anh/Chị đã đóng học phí đúng hạn!\nChúc con học tập tốt ạ.';
                
                const message = processTemplate(template, {
                    parentName: parentName || 'Phụ huynh',
                    studentName: studentName || '',
                    amount: typeof confirmAmount === 'number' ? confirmAmount.toLocaleString('vi-VN') + 'đ' : (confirmAmount || ''),
                    centerName: settings.name || 'Trung tâm',
                });
                
                if (isSLLChannel(settings)) {
                    const sll = getSLLConfig(settings);
                    if (!sll.apiKey || !sll.accountId) {
                        return res.status(400).json({ error: 'Chưa cấu hình Sổ Liên Lạc. Vào Cài đặt → Sổ Liên Lạc.' });
                    }
                    const phone = confirmPhone ? normalizePhone(confirmPhone) : '';
                    if (!phone) {
                        return res.status(400).json({ error: 'Học viên chưa có SĐT phụ huynh.' });
                    }
                    const result = await sendViaSLL(sll.baseUrl, sll.apiKey, sll.accountId, phone, message);
                    await saveMessageLog(colName, [{ id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`, timestamp: Date.now(), type: 'paymentConfirm', channel: 'sll', studentName: studentName || '', parentName: parentName || '', phone, message, status: result.ok ? 'sent' : 'failed', reason: result.ok ? 'Đã gửi qua SLL' : (result.error || 'Lỗi SLL'), className: payload.className || '' }]);
                    return res.status(200).json({ success: result.ok, message: result.ok ? 'Đã gửi xác nhận thanh toán' : result.error });
                } else {
                    if (!settings.zaloOaEnabled) {
                        return res.status(400).json({ error: 'Zalo OA chưa được kích hoạt' });
                    }
                    const tokenResult = await getValidAccessToken(centerId, settings);
                    const userId = confirmZaloId;
                    if (!userId) {
                        return res.status(400).json({ error: 'Học viên chưa có Zalo User ID.' });
                    }
                    const oaResult = await sendZaloMessage(tokenResult.accessToken, userId, message);
                    const oaOk = !oaResult.error;
                    await saveMessageLog(colName, [{ id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`, timestamp: Date.now(), type: 'paymentConfirm', channel: 'oa', studentName: studentName || '', parentName: parentName || '', phone: confirmPhone || '', message, status: oaOk ? 'sent' : 'failed', reason: oaOk ? 'Đã gửi qua OA' : (oaResult.message || 'Lỗi OA'), className: payload.className || '' }]);
                    return res.status(200).json({ success: oaOk, message: oaOk ? 'Đã gửi xác nhận thanh toán' : oaResult.message });
                }
            }
            
            // ===== GET MESSAGE LOGS =====
            case 'get_message_logs': {
                const { month } = payload; // YYYY-MM
                if (!month) {
                    return res.status(400).json({ error: 'Thiếu tham số month (YYYY-MM)' });
                }
                const logs = await getMessageLogs(colName, month);
                return res.status(200).json({ success: true, logs });
            }
            
            // ===== SEND CUSTOM MESSAGE =====
            case 'send_custom_message': {
                const { studentName: customStudentName, parentName: customParentName, parentPhone: customPhone, message: customMsg } = payload;
                
                if (!customMsg || !customMsg.trim()) {
                    return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống' });
                }
                
                const channel = isSLLChannel(settings) ? 'sll' : 'oa';
                let sendStatus: 'sent' | 'failed' = 'failed';
                let sendReason = '';
                
                if (channel === 'sll') {
                    const sll = getSLLConfig(settings);
                    if (!sll.apiKey || !sll.accountId) {
                        return res.status(400).json({ error: 'Chưa cấu hình Sổ Liên Lạc' });
                    }
                    if (!customPhone) {
                        return res.status(400).json({ error: 'Chưa có SĐT phụ huynh' });
                    }
                    const phone = normalizePhone(customPhone);
                    const result = await sendViaSLL(sll.baseUrl, sll.apiKey, sll.accountId, phone, customMsg.trim());
                    if (result.ok) {
                        sendStatus = 'sent';
                        sendReason = 'Đã gửi qua SLL';
                    } else {
                        sendReason = result.error || 'Lỗi gửi qua SLL';
                    }
                } else {
                    if (!settings.zaloOaEnabled) {
                        return res.status(400).json({ error: 'Zalo OA chưa được kích hoạt' });
                    }
                    const zaloUserId = payload.zaloUserId;
                    if (!zaloUserId) {
                        return res.status(400).json({ error: 'Học viên chưa liên kết Zalo OA' });
                    }
                    const { accessToken } = await getValidAccessToken(centerId, settings);
                    const result = await sendZaloMessage(accessToken, zaloUserId, customMsg.trim());
                    if (result.error) {
                        sendReason = result.message || 'Lỗi gửi qua OA';
                    } else {
                        sendStatus = 'sent';
                        sendReason = 'Đã gửi qua Zalo OA';
                    }
                }
                
                // Save log
                await saveMessageLog(colName, [{
                    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                    timestamp: Date.now(),
                    type: 'custom',
                    channel,
                    studentName: customStudentName || '',
                    parentName: customParentName || '',
                    phone: customPhone || '',
                    message: customMsg.trim(),
                    status: sendStatus,
                    reason: sendReason,
                    className: payload.className || '',
                }]);
                
                if (sendStatus === 'sent') {
                    return res.status(200).json({ success: true, message: `Đã gửi tin nhắn cho PH ${customParentName || 'phụ huynh'}` });
                } else {
                    return res.status(400).json({ error: sendReason });
                }
            }

            // ===== SEND GROUP TUITION REMINDER (unpaid invoices into class group) =====
            case 'send_group_tuition_reminder': {
                const { groupId, className: grpClassName, unpaidStudents } = payload;
                
                if (!groupId || !unpaidStudents || !Array.isArray(unpaidStudents) || unpaidStudents.length === 0) {
                    return res.status(400).json({ error: 'Thiếu groupId hoặc danh sách học viên' });
                }
                
                if (!isSLLChannel(settings)) {
                    return res.status(400).json({ error: 'Gửi nhóm chỉ hỗ trợ kênh SLL' });
                }
                
                const sll = getSLLConfig(settings);
                if (!sll.apiKey || !sll.accountId) {
                    return res.status(400).json({ error: 'Chưa cấu hình Sổ Liên Lạc' });
                }
                
                // Build bank info — same format as individual messages
                const grpBankInfo = settings.bankAccountNumber 
                    ? `\nThông tin CK: ${settings.bankAccountNumber} - ${settings.bankAccountHolder || ''} - ${settings.bankName || ''}` 
                    : '';
                
                // Build student list text
                let studentListText = '';
                let deadline = '';
                let latestInvoiceMonth = ''; // Track the latest (newest) invoice month
                for (let i = 0; i < unpaidStudents.length; i++) {
                    const st = unpaidStudents[i];
                    const amount = typeof st.amount === 'number' ? Math.abs(st.amount).toLocaleString('vi-VN') + 'đ' : (st.amount || '');
                    studentListText += `${i + 1}. ${st.name}: ${amount}\n`;
                    
                    // Find the latest (newest) invoice month across all students
                    if (st.invoiceMonth && st.invoiceMonth > latestInvoiceMonth) {
                        latestInvoiceMonth = st.invoiceMonth;
                    }
                }
                
                // Calculate deadline from latest invoice month
                const dDay = settings.tuitionDeadlineDay || 10;
                if (latestInvoiceMonth) {
                    const [invYear, invMonth] = latestInvoiceMonth.split('-').map(Number);
                    const deadlineDate = new Date(invYear, invMonth, dDay); // invMonth 1-based + Date 0-based = next month
                    deadline = `${String(dDay).padStart(2, '0')}/${String(deadlineDate.getMonth() + 1).padStart(2, '0')}/${deadlineDate.getFullYear()}`;
                }
                if (!deadline) {
                    const now = new Date();
                    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, dDay);
                    deadline = `${String(dDay).padStart(2, '0')}/${String(nextMonth.getMonth() + 1).padStart(2, '0')}/${nextMonth.getFullYear()}`;
                }
                
                const groupTuitionMsg = `📢 THÔNG BÁO HỌC PHÍ - ${grpClassName || 'LỚP HỌC'}\n\nCác học viên chưa đóng học phí:\n${studentListText}\n⏰ Hạn đóng: trước ngày ${deadline}\nPhụ huynh vui lòng sắp xếp đóng học phí đúng hạn.${grpBankInfo}\n\nTrân trọng cảm ơn!\n${settings.name || 'Trung tâm'}`;
                
                try {
                    // 1. Send summary text
                    const sllUrl = `${sll.baseUrl}/api/zalo?p=ext/send&account=${sll.accountId}`;
                    const textRes = await fetch(sllUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-api-key': sll.apiKey },
                        body: JSON.stringify({ groupId, message: groupTuitionMsg }),
                        signal: AbortSignal.timeout(30000),
                    });
                    const textResult = await textRes.json();
                    
                    if (!textResult.ok) {
                        return res.status(400).json({ error: textResult.error || 'Lỗi gửi tin nhắn text vào nhóm' });
                    }
                    
                    // 2. Send individual invoice images (with retry + adaptive rate limit)
                    const studentsWithImages = unpaidStudents.filter((s: any) => s.imageUrl);
                    // Adaptive delay: fit within ~50s total (Vercel 60s limit minus text send time)
                    // Each image needs: delay + ~2s network = delay + 2
                    // Total: N * (delay + 2) <= 50 → delay = max(1.5, min(3, 50/N - 2))
                    const baseDelay = studentsWithImages.length > 0
                        ? Math.max(1500, Math.min(3000, Math.floor((50000 / studentsWithImages.length) - 2000)))
                        : 3000;
                    
                    let imagesSent = 0;
                    let imagesFailed = 0;
                    const failedStudentNames: string[] = [];
                    const skippedStudentNames: string[] = [];
                    for (const st of unpaidStudents) {
                        if (st.imageUrl) {
                            let success = false;
                            let shouldRetry = false;
                            // Attempt 1
                            try {
                                await new Promise(r => setTimeout(r, baseDelay));
                                const imgRes = await fetch(sllUrl, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'x-api-key': sll.apiKey },
                                    body: JSON.stringify({ groupId, message: `📄 Phiếu HP - ${st.name}`, imageUrl: st.imageUrl }),
                                    signal: AbortSignal.timeout(20000),
                                });
                                const imgResult = await imgRes.json();
                                if (imgResult.ok) {
                                    imagesSent++;
                                    success = true;
                                } else {
                                    // SLL trả lỗi rõ ràng → an toàn để retry (chưa gửi thành công)
                                    shouldRetry = true;
                                }
                            } catch {
                                // Timeout/network error → KHÔNG retry vì có thể SLL đã gửi rồi
                                // Chỉ đánh dấu failed
                            }
                            // Attempt 2 — chỉ retry khi SLL trả ok:false (chưa gửi)
                            if (!success && shouldRetry) {
                                try {
                                    await new Promise(r => setTimeout(r, 4000));
                                    const imgRes2 = await fetch(sllUrl, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', 'x-api-key': sll.apiKey },
                                        body: JSON.stringify({ groupId, message: `📄 Phiếu HP - ${st.name}`, imageUrl: st.imageUrl }),
                                        signal: AbortSignal.timeout(20000),
                                    });
                                    const imgResult2 = await imgRes2.json();
                                    if (imgResult2.ok) {
                                        imagesSent++;
                                        success = true;
                                    }
                                } catch {
                                    // Retry also failed — give up
                                }
                            }
                            if (!success) {
                                imagesFailed++;
                                failedStudentNames.push(st.name || 'N/A');
                            }
                        } else {
                            skippedStudentNames.push(st.name || 'N/A');
                        }
                    }
                    
                    // Build detailed result message
                    let resultMsg = `Đã gửi nhắc HP vào nhóm ${grpClassName}: ${unpaidStudents.length} HS, ${imagesSent} ảnh thành công`;
                    if (imagesFailed > 0) resultMsg += `, ${imagesFailed} ảnh lỗi (${failedStudentNames.join(', ')})`;
                    if (skippedStudentNames.length > 0) resultMsg += `. Thiếu hóa đơn: ${skippedStudentNames.join(', ')}`;
                    
                    // Save log with full message content
                    await saveMessageLog(colName, [{
                        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                        timestamp: Date.now(),
                        type: 'group' as const,
                        channel: 'sll' as const,
                        studentName: '',
                        parentName: '',
                        phone: '',
                        message: groupTuitionMsg,
                        status: 'sent',
                        reason: resultMsg,
                        className: grpClassName || '',
                    }]);
                    
                    return res.status(200).json({ 
                        success: true, 
                        message: resultMsg,
                        failedStudents: failedStudentNames,
                        skippedStudents: skippedStudentNames,
                    });
                } catch (err: any) {
                    return res.status(500).json({ error: err.message || 'Lỗi gửi nhắc HP nhóm' });
                }
            }

            case 'send_group_message': {
                const { groupId, message: groupMsg, className: groupClassName } = payload;
                
                if (!groupId || !groupMsg?.trim()) {
                    return res.status(400).json({ error: 'Thiếu groupId hoặc nội dung tin nhắn' });
                }
                
                if (!isSLLChannel(settings)) {
                    return res.status(400).json({ error: 'Gửi nhóm chỉ hỗ trợ kênh SLL' });
                }
                
                const sll = getSLLConfig(settings);
                if (!sll.apiKey || !sll.accountId) {
                    return res.status(400).json({ error: 'Chưa cấu hình Sổ Liên Lạc' });
                }
                
                const url = `${sll.baseUrl}/api/zalo?p=ext/send&account=${sll.accountId}`;
                const sllRes = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': sll.apiKey },
                    body: JSON.stringify({ groupId, message: groupMsg.trim() }),
                    signal: AbortSignal.timeout(15000),
                });
                const sllResult = await sllRes.json();
                
                // Save log
                await saveMessageLog(colName, [{
                    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                    timestamp: Date.now(),
                    type: 'group',
                    channel: 'sll',
                    studentName: '',
                    parentName: '',
                    phone: '',
                    message: groupMsg.trim(),
                    status: sllResult.ok ? 'sent' : 'failed',
                    reason: sllResult.ok ? 'Đã gửi vào nhóm' : (sllResult.error || 'Lỗi gửi nhóm'),
                    className: groupClassName || '',
                }]);
                
                if (sllResult.ok) {
                    return res.status(200).json({ success: true, message: `Đã gửi tin nhắn vào nhóm ${groupClassName || ''}` });
                } else {
                    return res.status(400).json({ error: sllResult.error || 'Lỗi gửi tin nhắn nhóm' });
                }
            }
            
            // ===== SEND MONTHLY SCORES (individual) =====
            case 'send_monthly_scores': {
                const { classId: scoreClassId, month: scoreMonth, examName: scoreExamName, studentIds: filterStudentIds } = payload;
                
                if (!scoreClassId || !scoreMonth) {
                    return res.status(400).json({ error: 'Thiếu classId hoặc tháng (YYYY-MM)' });
                }
                
                // Load students and progressReports from Firestore
                const studentsDoc = await getDoc(doc(db, colName, 'students'));
                const studentsData: any[] = studentsDoc.exists() ? (studentsDoc.data()?.data || []) : [];
                const classesDoc = await getDoc(doc(db, colName, 'classes'));
                const classesData: any[] = classesDoc.exists() ? (classesDoc.data()?.data || []) : [];
                const prDoc = await getDoc(doc(db, colName, 'progressReports'));
                const prData: any[] = prDoc.exists() ? (prDoc.data()?.data || []) : [];
                
                const targetClass = classesData.find((c: any) => c.id === scoreClassId);
                if (!targetClass) {
                    return res.status(404).json({ error: 'Không tìm thấy lớp học' });
                }
                
                // Filter reports for this class + month + optional exam name
                const monthReports = prData.filter((r: any) => 
                    r.classId === scoreClassId && r.date && r.date.startsWith(scoreMonth)
                    && (!scoreExamName || r.examName === scoreExamName)
                );
                
                if (monthReports.length === 0) {
                    return res.status(400).json({ error: `Chưa có điểm nào trong tháng ${scoreMonth} cho lớp ${targetClass.name}` });
                }
                
                // Group by student — keep raw reports to preserve score-comment pairing
                const studentReports: Record<string, { score: number | null; comments: string }[]> = {};
                const studentExamNames: Record<string, Set<string>> = {};
                for (const r of monthReports) {
                    if (!studentReports[r.studentId]) {
                        studentReports[r.studentId] = [];
                        studentExamNames[r.studentId] = new Set();
                    }
                    studentReports[r.studentId].push({ score: r.score ?? null, comments: r.comments || '' });
                    if (r.examName) studentExamNames[r.studentId].add(r.examName);
                }
                
                const template = settings.messageTemplates?.scoreReport || 
                    '📝 BÁO CÁO HỌC TẬP THÁNG {month}\n\nAnh/Chị phụ huynh {parentName} thân mến,\n{centerName} xin gửi kết quả học tập của con {studentName} tại lớp {className}:\n\n📊 Điểm trung bình: {avgScore}\n📋 Chi tiết: {scoreList}\n📝 Đánh giá: {autoComment}\n\nAnh/Chị vui lòng theo dõi và phối hợp cùng trung tâm giúp con tiến bộ hơn.\nTrân trọng cảm ơn!';
                
                const results: any[] = [];
                // Only send to currently enrolled students (ignore orphan reports from students who left)
                const enrolledIds = new Set(targetClass.studentIds || []);
                let studentIds = Object.keys(studentReports).filter(id => enrolledIds.has(id));
                
                // If specific studentIds provided, only send to those
                if (Array.isArray(filterStudentIds)) {
                    if (filterStudentIds.length === 0) {
                        return res.status(400).json({ error: 'Chưa chọn học sinh nào để gửi' });
                    }
                    const filterSet = new Set(filterStudentIds);
                    studentIds = studentIds.filter(id => filterSet.has(id));
                }
                
                if (isSLLChannel(settings)) {
                    const sll = getSLLConfig(settings);
                    if (!sll.apiKey || !sll.accountId) {
                        return res.status(400).json({ error: 'Chưa cấu hình Sổ Liên Lạc' });
                    }
                    
                    for (let si = 0; si < studentIds.length; si++) {
                        const studentId = studentIds[si];
                        const student = studentsData.find((s: any) => s.id === studentId);
                        if (!student) {
                            results.push({ studentName: studentId, parentName: '', phone: '', status: 'skipped', reason: 'Không tìm thấy HV' });
                            continue;
                        }
                        
                        const phone = normalizePhone(student.parentPhone || student.phone || '');
                        if (!phone) {
                            results.push({ studentName: student.name, parentName: student.parentName || '', phone: '', status: 'skipped', reason: 'Chưa có SĐT phụ huynh' });
                            continue;
                        }
                        
                        const reports = studentReports[studentId];
                        const agg = aggregateStudentScores(reports);
                        const { avgScore, scoreList, commentsText } = agg;

                        // Always generate auto-comment for {autoComment} template variable
                        let autoCommentText = '';
                        if (agg.scores.length > 0) {
                            // Find the most recent previous score entry for this student (before current month)
                            const prevReports = prData
                                .filter((r: any) => r.studentId === studentId && r.classId === scoreClassId && r.date && r.score != null && r.date < scoreMonth)
                                .sort((a: any, b: any) => b.date.localeCompare(a.date));
                            
                            const history: ScoreHistory[] = [];
                            if (prevReports.length > 0) {
                                // Use the most recent entry's date as a group key
                                const latestDate = prevReports[0].date;
                                const latestScores = prevReports.filter((r: any) => r.date === latestDate).map((r: any) => r.score);
                                history.push({
                                    month: latestDate,
                                    avgScore: latestScores.reduce((a: number, b: number) => a + b, 0) / latestScores.length,
                                });
                            }
                            autoCommentText = generateAutoComment(agg.scores, history).comment;
                        }
                        
                        // {comments} = nhận xét thủ công GV nhập (nếu có), KHÔNG dùng auto text
                        // {autoComment} = đánh giá tự động AI — luôn có, KHÔNG trùng với {comments}
                        const finalComment = agg.comments.length > 0 
                            ? commentsText 
                            : '';
                        
                        // Format month display
                        const [mYear, mMonth] = scoreMonth.split('-');
                        const monthDisplay = `${mMonth}/${mYear}`;
                        
                        const message = processTemplate(template, {
                            parentName: student.parentName || 'Phụ huynh',
                            studentName: student.name || '',
                            className: targetClass.name || '',
                            centerName: settings.name || 'Trung tâm',
                            month: monthDisplay,
                            avgScore: avgScore === 'N/A' ? 'Chưa có điểm số' : `${avgScore}/10`,
                            scoreList,
                            comments: finalComment,
                            autoComment: autoCommentText,
                            examName: scoreExamName || [...(studentExamNames[studentId] || [])].join(', '),
                            date: new Date().toLocaleDateString('vi-VN'),
                        });
                        
                        try {
                            const sendResult = await sendViaSLL(sll.baseUrl, sll.apiKey, sll.accountId, phone, message);
                            if (sendResult.ok) {
                                results.push({ studentName: student.name, parentName: student.parentName || '', phone, avgScore, status: 'sent', reason: 'Đã gửi qua SLL' });
                            } else {
                                results.push({ studentName: student.name, parentName: student.parentName || '', phone, avgScore, status: 'failed', reason: sendResult.error || 'Lỗi SLL' });
                            }
                        } catch (err: any) {
                            results.push({ studentName: student.name, parentName: student.parentName || '', phone, avgScore, status: 'failed', reason: err.message });
                        }
                        
                        // Delay 5s between messages
                        if (si < studentIds.length - 1) {
                            await new Promise(r => setTimeout(r, 5000));
                        }
                    }
                } else {
                    // OA channel
                    if (!settings.zaloOaEnabled) {
                        return res.status(400).json({ error: 'Zalo OA chưa được kích hoạt' });
                    }
                    const { accessToken } = await getValidAccessToken(centerId, settings);
                    
                    for (const studentId of studentIds) {
                        const student = studentsData.find((s: any) => s.id === studentId);
                        if (!student) {
                            results.push({ studentName: studentId, parentName: '', phone: '', status: 'skipped', reason: 'Không tìm thấy HV' });
                            continue;
                        }
                        if (!student.zaloUserId) {
                            results.push({ studentName: student.name, parentName: student.parentName || '', phone: student.parentPhone || student.phone || '', status: 'skipped', reason: 'Chưa liên kết Zalo' });
                            continue;
                        }
                        
                        const reports = studentReports[studentId];
                        const agg = aggregateStudentScores(reports);
                        const { avgScore, scoreList, commentsText } = agg;
                        // Always generate auto-comment for {autoComment} template variable
                        let autoCommentText = '';
                        if (agg.scores.length > 0) {
                            // Find the most recent previous score entry for this student (before current month)
                            const prevReports = prData
                                .filter((r: any) => r.studentId === studentId && r.classId === scoreClassId && r.date && r.score != null && r.date < scoreMonth)
                                .sort((a: any, b: any) => b.date.localeCompare(a.date));
                            
                            const history: ScoreHistory[] = [];
                            if (prevReports.length > 0) {
                                const latestDate = prevReports[0].date;
                                const latestScores = prevReports.filter((r: any) => r.date === latestDate).map((r: any) => r.score);
                                history.push({
                                    month: latestDate,
                                    avgScore: latestScores.reduce((a: number, b: number) => a + b, 0) / latestScores.length,
                                });
                            }
                            autoCommentText = generateAutoComment(agg.scores, history).comment;
                        }
                        
                        // {comments} = nhận xét thủ công GV nhập, {autoComment} = AI
                        const finalComment = agg.comments.length > 0 
                            ? commentsText 
                            : '';
                        
                        const [mYear, mMonth] = scoreMonth.split('-');
                        const monthDisplay = `${mMonth}/${mYear}`;
                        
                        const message = processTemplate(template, {
                            parentName: student.parentName || 'Phụ huynh',
                            studentName: student.name || '',
                            className: targetClass.name || '',
                            centerName: settings.name || 'Trung tâm',
                            month: monthDisplay,
                            avgScore: avgScore === 'N/A' ? 'Chưa có điểm số' : `${avgScore}/10`,
                            scoreList,
                            comments: finalComment,
                            autoComment: autoCommentText,
                            examName: scoreExamName || [...(studentExamNames[studentId] || [])].join(', '),
                            date: new Date().toLocaleDateString('vi-VN'),
                        });
                        
                        try {
                            const sendResult = await sendZaloMessage(accessToken, student.zaloUserId, message);
                            if (sendResult.error) {
                                results.push({ studentName: student.name, parentName: student.parentName || '', phone: student.parentPhone || student.phone || '', avgScore, status: 'failed', reason: sendResult.message || `Code: ${sendResult.error}` });
                            } else {
                                results.push({ studentName: student.name, parentName: student.parentName || '', phone: student.parentPhone || student.phone || '', avgScore, status: 'sent', reason: 'Đã gửi qua Zalo OA' });
                            }
                        } catch (err: any) {
                            results.push({ studentName: student.name, parentName: student.parentName || '', phone: student.parentPhone || student.phone || '', avgScore, status: 'failed', reason: err.message });
                        }

                        // Delay 5s between OA messages to avoid rate limiting
                        if (studentIds.indexOf(studentId) < studentIds.length - 1) {
                            await new Promise(r => setTimeout(r, 5000));
                        }
                    }
                }
                
                const sent = results.filter(r => r.status === 'sent').length;
                const failed = results.filter(r => r.status === 'failed').length;
                const skipped = results.filter(r => r.status === 'skipped').length;
                
                // Save message logs
                const scoreLogEntries: MessageLogEntry[] = results.filter(r => r.status !== 'skipped').map((r: any, i: number) => ({
                    id: `msg_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 8)}`,
                    timestamp: Date.now(),
                    type: 'score' as const,
                    channel: (isSLLChannel(settings) ? 'sll' : 'oa') as 'sll' | 'oa',
                    studentName: r.studentName || '',
                    parentName: r.parentName || '',
                    phone: r.phone || '',
                    message: `[Điểm tháng ${scoreMonth}] ${r.studentName}: TB ${r.avgScore || 'N/A'}`,
                    status: r.status,
                    reason: r.reason,
                    className: targetClass.name || '',
                }));
                await saveMessageLog(colName, scoreLogEntries);
                
                return res.status(200).json({
                    success: true,
                    results,
                    summary: { sent, failed, skipped, total: studentIds.length },
                    message: `Đã gửi điểm: ${sent}/${studentIds.length} | Thất bại: ${failed} | Bỏ qua: ${skipped}`,
                });
            }

            // ===== SEND GROUP MONTHLY SCORES =====
            case 'send_group_monthly_scores': {
                const { classId: grpScoreClassId, month: grpScoreMonth, examName: grpScoreExamName } = payload;
                
                if (!grpScoreClassId || !grpScoreMonth) {
                    return res.status(400).json({ error: 'Thiếu classId hoặc tháng (YYYY-MM)' });
                }
                
                if (!isSLLChannel(settings)) {
                    return res.status(400).json({ error: 'Gửi nhóm chỉ hỗ trợ kênh SLL' });
                }
                
                const sll = getSLLConfig(settings);
                if (!sll.apiKey || !sll.accountId) {
                    return res.status(400).json({ error: 'Chưa cấu hình Sổ Liên Lạc' });
                }
                
                // Load data (students not needed — privacy-safe summary only uses scores)
                const grpClassesDoc = await getDoc(doc(db, colName, 'classes'));
                const grpClassesData: any[] = grpClassesDoc.exists() ? (grpClassesDoc.data()?.data || []) : [];
                const grpPrDoc = await getDoc(doc(db, colName, 'progressReports'));
                const grpPrData: any[] = grpPrDoc.exists() ? (grpPrDoc.data()?.data || []) : [];
                
                const grpTargetClass = grpClassesData.find((c: any) => c.id === grpScoreClassId);
                if (!grpTargetClass) {
                    return res.status(404).json({ error: 'Không tìm thấy lớp học' });
                }
                
                if (!grpTargetClass.zaloGroupId) {
                    return res.status(400).json({ error: `Lớp ${grpTargetClass.name} chưa được gán nhóm Zalo. Vào Cài đặt lớp → nhập Group ID.` });
                }
                
                // Filter reports for this class + month + optional exam name
                const grpMonthReports = grpPrData.filter((r: any) => 
                    r.classId === grpScoreClassId && r.date && r.date.startsWith(grpScoreMonth)
                    && (!grpScoreExamName || r.examName === grpScoreExamName)
                );
                
                if (grpMonthReports.length === 0) {
                    return res.status(400).json({ error: `Chưa có điểm nào trong tháng ${grpScoreMonth} cho lớp ${grpTargetClass.name}` });
                }
                
                // Group by student — keep raw reports
                const grpStudentReports: Record<string, { score: number | null; comments: string }[]> = {};
                for (const r of grpMonthReports) {
                    if (!grpStudentReports[r.studentId]) {
                        grpStudentReports[r.studentId] = [];
                    }
                    grpStudentReports[r.studentId].push({ score: r.score ?? null, comments: r.comments || '' });
                }
                
                // Format month display
                const [grpMYear, grpMMonth] = grpScoreMonth.split('-');
                const grpMonthDisplay = `${grpMMonth}/${grpMYear}`;
                
                // Build privacy-safe summary (no individual names/scores)
                const allScores: number[] = [];
                const grpEnrolledIds = new Set(grpTargetClass.studentIds || []);
                for (const sid of Object.keys(grpStudentReports).filter(id => grpEnrolledIds.has(id))) {
                    const agg = aggregateStudentScores(grpStudentReports[sid]);
                    if (agg.scores.length > 0) {
                        const avg = agg.scores.reduce((a, b) => a + b, 0) / agg.scores.length;
                        allScores.push(avg);
                    }
                }
                
                const totalStudents = Object.keys(grpStudentReports).filter(id => grpEnrolledIds.has(id)).length;
                const classAvg = allScores.length > 0 
                    ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) 
                    : 'N/A';
                const excellent = allScores.filter(s => s >= 8.0).length;
                const good = allScores.filter(s => s >= 6.5 && s < 8.0).length;
                const average = allScores.filter(s => s >= 4.0 && s < 6.5).length;
                const weak = allScores.filter(s => s < 4.0).length;
                const grpExamLabel = grpScoreExamName ? ` - ${grpScoreExamName}` : '';
                let summaryText = `📝 TỔNG KẾT${grpExamLabel} THÁNG ${grpMonthDisplay} - ${grpTargetClass.name}\n\n`;
                summaryText += `Tổng số HS được đánh giá: ${totalStudents}\n`;
                summaryText += `📊 Phổ điểm: Giỏi (≥8): ${excellent} | Khá (6.5-7.9): ${good} | TB (4-6.4): ${average} | Yếu (<4): ${weak}\n`;
                summaryText += `🎯 ĐTB lớp: ${classAvg === 'N/A' ? 'Chưa có' : classAvg + '/10'}\n\n`;
                summaryText += `Vui lòng liên hệ trung tâm để nhận chi tiết điểm từng con ạ.\n`;
                summaryText += `${settings.name || 'Trung tâm'}`;
                
                try {
                    const sllUrl = `${sll.baseUrl}/api/zalo?p=ext/send&account=${sll.accountId}`;
                    const textRes = await fetch(sllUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-api-key': sll.apiKey },
                        body: JSON.stringify({ groupId: grpTargetClass.zaloGroupId, message: summaryText }),
                        signal: AbortSignal.timeout(15000),
                    });
                    const textResult = await textRes.json();
                    
                    if (!textResult.ok) {
                        return res.status(400).json({ error: textResult.error || 'Lỗi gửi bảng điểm vào nhóm' });
                    }
                    
                    // Save log
                    await saveMessageLog(colName, [{
                        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                        timestamp: Date.now(),
                        type: 'score' as const,
                        channel: 'sll' as const,
                        studentName: '',
                        parentName: '',
                        phone: '',
                        message: summaryText,
                        status: 'sent',
                        reason: `Đã gửi bảng điểm tháng ${grpMonthDisplay} vào nhóm ${grpTargetClass.name} (${totalStudents} HS)`,
                        className: grpTargetClass.name || '',
                    }]);
                    
                    return res.status(200).json({
                        success: true,
                        message: `Đã gửi bảng điểm tháng ${grpMonthDisplay} vào nhóm ${grpTargetClass.name} (${totalStudents} học sinh)`,
                    });
                } catch (err: any) {
                    return res.status(500).json({ error: err.message || 'Lỗi gửi bảng điểm nhóm' });
                }
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
