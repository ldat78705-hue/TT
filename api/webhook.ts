import { executeOperationInternal, getSplitData, getFirestoreDb, getCollectionNameFromCenterId } from './data.js';
import { getVietnamTime } from '../utils/date.js';
import { createHash } from 'crypto';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// === Duplicate Transaction Detection v2 ===
// Chống gạch nợ trùng khi app Android retry (timeout mạng) hoặc InboxStyle duplicate.
//
// Nguyên tắc phân biệt:
// - RETRY TRÙNG: App gửi lại cùng rawText y hệt → hash trùng → CHẶN
// - PHHS CK 2 LẦN: SMS ngân hàng KHÁC nhau (khác thời gian GD, số dư SD, mã FT) → hash khác → GHI
//
// RAW TEXT MODE: Hash từ toàn bộ SMS gốc (chứa thời gian GD, SD, FT code)
// STRUCTURED JSON: Ưu tiên transactionId/ref; fallback hash toàn bộ payload
const recentTransactions = new Map<string, number>(); // hash -> timestamp(ms)
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 phút

function cleanupDedupCache() {
    const now = Date.now();
    for (const [hash, time] of recentTransactions) {
        if (now - time > DEDUP_WINDOW_MS) {
            recentTransactions.delete(hash);
        }
    }
}

function hashKey(str: string): string {
    return createHash('sha256').update(str).digest('hex').substring(0, 16);
}

function isDuplicateTransaction(centerId: string, rawText: string | null, payload: any, studentId: string, amount: number): boolean {
    cleanupDedupCache();

    let key: string;

    if (rawText) {
        // RAW TEXT MODE (GachNo app, MacroDroid, Tasker, SMS forwarder)
        // Dùng toàn bộ SMS gốc — chính xác nhất vì:
        // - Retry: cùng rawText y hệt → chặn ✅
        // - PHHS CK 2 lần: rawText khác (khác GD time, SD, FT code) → cho qua ✅
        key = `${centerId}|RAW|${rawText.trim()}`;
    } else {
        // STRUCTURED JSON MODE (SePay, Cass.vn, PayOS)
        const txId = payload.transactionId || payload.id || payload.referenceCode || payload.ref || '';
        if (txId) {
            // Có mã giao dịch riêng → dùng làm key (chính xác nhất)
            key = `${centerId}|TXN|${String(txId)}`;
        } else {
            // Fallback: hash toàn bộ payload (2 request giống hệt = retry)
            key = `${centerId}|JSON|${JSON.stringify(payload)}`;
        }
    }

    const hash = hashKey(key);
    if (recentTransactions.has(hash)) {
        console.log(`[Webhook] DUPLICATE BLOCKED: ${studentId} ${amount.toLocaleString('vi-VN')}đ (hash=${hash})`);
        return true;
    }
    recentTransactions.set(hash, Date.now());
    return false;
}

// === Webhook Event Logger ===
// Ghi trực tiếp vào Firestore document riêng ('webhookLogs')
// KHÔNG qua executeOperationInternal → tránh bị ghi đè bởi cache stale
const MAX_WEBHOOK_LOGS = 200;

async function logWebhookEvent(centerId: string, status: 'success' | 'skipped' | 'error' | 'duplicate' | 'blocked', details: string, extra?: { studentId?: string, amount?: number, rawPreview?: string }) {
    try {
        const db = getFirestoreDb();
        const colName = getCollectionNameFromCenterId(centerId);
        const docRef = doc(db, colName, 'webhookLogs');
        
        const entry = {
            id: `WHL-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            status,
            details: `[${status.toUpperCase()}] ${details}${extra?.amount ? ` | Số tiền: ${extra.amount.toLocaleString('vi-VN')}đ` : ''}${extra?.rawPreview ? ` | SMS: ${extra.rawPreview}` : ''}`,
            studentId: extra?.studentId || '—',
            amount: extra?.amount || 0,
            timestamp: new Date().toISOString()
        };
        
        // Read current logs, prepend new entry, trim to MAX
        const snap = await getDoc(docRef);
        let logs: any[] = [];
        if (snap.exists()) {
            logs = snap.data()?.data || [];
        }
        logs.unshift(entry);
        if (logs.length > MAX_WEBHOOK_LOGS) logs = logs.slice(0, MAX_WEBHOOK_LOGS);
        
        await setDoc(docRef, { data: logs });
    } catch(e) { 
        console.error('[WebhookLog] Failed to write:', e);
    }
}

export default async function webhookHandler(req: any, res: any) {
    // GET /api/webhook?action=logs → trả về webhook logs
    if (req.method === 'GET') {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const action = url.searchParams.get('action');
        if (action === 'logs') {
            try {
                // Auth check via cookie or header
                const { verifyToken } = await import('./_lib/jwt.js');
                const token = req.headers.authorization?.replace('Bearer ', '') || 
                    req.headers.cookie?.split(';').find((c: string) => c.trim().startsWith('authToken='))?.split('=')[1];
                if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });
                
                let auth: any;
                try { auth = await verifyToken(token); } catch { return res.status(401).json({ success: false, error: 'Invalid token' }); }
                if (!auth) return res.status(401).json({ success: false, error: 'Unauthorized' });
                
                const role = auth.role;
                if (role !== 'ADMIN' && role !== 'MANAGER' && role !== 'ACCOUNTANT') {
                    return res.status(403).json({ success: false, error: 'Forbidden' });
                }
                
                const centerId = auth.centerId || '_legacy';
                const db = getFirestoreDb();
                const colName = getCollectionNameFromCenterId(centerId);
                const docRef = doc(db, colName, 'webhookLogs');
                const snap = await getDoc(docRef);
                
                return res.status(200).json({ success: true, logs: snap.exists() ? (snap.data()?.data || []) : [] });
            } catch (e) {
                console.error('Error fetching webhook logs:', e);
                return res.status(500).json({ success: false, error: 'Internal Server Error' });
            }
        }
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const payload = req.body || {};
        
        // Multi-tenant: extract centerId from query param
        const url = new URL(req.url, `http://${req.headers.host}`);
        const centerId = url.searchParams.get('center') || '_legacy';
        
        // Read settings from database
        const currentData = await getSplitData(centerId);
        const settings = currentData.settings || {};
        
        // Check if webhook is enabled
        if (settings.webhookEnabled === false) {
            return res.status(200).json({ success: false, message: 'Webhook is disabled in settings.' });
        }

        // Validate webhook secret key if configured
        if (settings.webhookSecretKey) {
            const providedSecret = url.searchParams.get('secret') || req.headers['x-webhook-secret'];
            if (providedSecret !== settings.webhookSecretKey) {
                return res.status(403).json({ success: false, message: 'Invalid webhook secret key.' });
            }
        }

        const studentIdPrefix = (settings.webhookStudentIdPrefix || 'HS').toUpperCase();
        const bankKeyword = settings.webhookBankKeyword || 'MBBank';
        const autoDescription = settings.webhookAutoDescription || 'Thanh toán HP tự động';

        let amount = 0;
        let content = '';
        let isDebitTransaction = false; // Tiền RA (chuyển đi) — phải bỏ qua
        
        // 1. RAW TEXT MODE (MacroDroid / Tasker / SMS forwarding)
        const rawText = payload.notification_text || payload.text || payload.message || payload.body;
        if (typeof rawText === 'string' && rawText.trim().length > 5) {

            // === FIX #2: Phát hiện giao dịch tiền RA (debit) ===
            // SMS tiền RA có dấu "-": "GD: -200,000VND" hoặc "-200.000VND"
            const debitMatch = rawText.match(/(?:GD|Giao dich)[:\s]*-\s*[\d,.]+/i);
            if (debitMatch) {
                isDebitTransaction = true;
            }

            // === FIX #1: Ưu tiên regex có context GD (Giao dịch) ===
            // Tránh bắt nhầm SD (Số dư) khi format SMS đặt SD trước GD
            // Priority 1: "GD: +250,000VND" — chính xác nhất
            const gdMatch = rawText.match(/(?:GD|Giao dich)[:\s]*\+\s*([\d,.]+)\s*(?:VND|VNĐ|D|Đ)?/i);
            if (gdMatch) {
                amount = Number(gdMatch[1].replace(/[,.]/g, ''));
            } else {
                // Priority 2: Bất kỳ "+số VND" — BẮT BUỘC có đơn vị tiền (tránh bắt nhầm SĐT/múi giờ)
                const plusMatch = rawText.match(/\+\s*([\d,.]+)\s*(?:VND|VNĐ)\b/i);
                if (plusMatch) {
                    amount = Number(plusMatch[1].replace(/[,.]/g, ''));
                } else {
                    // Priority 3: Fallback cho VCB/BIDV format — KHÔNG bắt SD (số dư)
                    const fallbackMatch = rawText.match(/(?:GD|Giao dich|So tien|PS(?: CO)?)[:\s]*([\d,.]+)\s*(?:VND|VNĐ)/i);
                    if (fallbackMatch) {
                        amount = Number(fallbackMatch[1].replace(/[,.]/g, ''));
                    }
                }
            }
            
            // Regex ND: dùng lookbehind để KHÔNG bắt nhầm "VND" (đơn vị tiền)
            // Hỗ trợ: ND:, Nội dung:, NOI DUNG:, NOIDUNG: (viết liền, ACB/Techcombank)
            const ndMatch = rawText.match(/(?<![A-Za-z])(?:ND|N[ộo]i[\s_]*[Dd]ung|NOI[\s_]*DUNG)[:\s]+(.*?)(?=[|;\n]|$)/i);
            content = ndMatch ? ndMatch[1].trim() : rawText.trim();
        } 
        // 2. STRUCTURED JSON MODE (SePay, Cass.vn, PayOS)
        else {
            amount = Number(payload.transferAmount || payload.amount || payload.tien) || 0;
            content = String(payload.content || payload.description || payload.noi_dung || '');
            // SePay/PayOS gửi type: "IN" hoặc "OUT"
            if (payload.transferType === 'OUT' || payload.type === 'OUT' || payload.type === 'debit') {
                isDebitTransaction = true;
            }
        }
        
        content = content.toUpperCase();
        const rawPreview = (typeof rawText === 'string' ? rawText : JSON.stringify(payload)).substring(0, 500);
        
        // === FIX #2: Bỏ qua giao dịch tiền RA ===
        if (isDebitTransaction) {
            await logWebhookEvent(centerId, 'skipped', 'Giao dịch tiền RA (debit)', { amount, rawPreview });
            return res.status(200).json({ success: true, message: 'Giao dịch tiền RA (debit), bỏ qua.' });
        }
        
        if (!amount || !content) {
            await logWebhookEvent(centerId, 'skipped', 'Không trích xuất được số tiền hoặc nội dung', { rawPreview });
            return res.status(200).json({ success: true, message: 'No amount or valid content extracted, ignoring.' });
        }

        // === FIX #3: Giới hạn số tiền tối đa — phòng parse sai ===
        const maxAmount = settings.webhookMaxAmount || 50_000_000; // Mặc định 50 triệu
        if (amount > maxAmount) {
            console.warn(`[Webhook] BLOCKED: Amount ${amount.toLocaleString('vi-VN')}đ exceeds max ${maxAmount.toLocaleString('vi-VN')}đ`);
            await logWebhookEvent(centerId, 'blocked', `Số tiền vượt giới hạn ${maxAmount.toLocaleString('vi-VN')}đ`, { amount, rawPreview });
            return res.status(200).json({ 
                success: false, 
                message: `Số tiền ${amount.toLocaleString('vi-VN')}đ vượt giới hạn ${maxAmount.toLocaleString('vi-VN')}đ. Vui lòng ghi nhận thủ công.` 
            });
        }
        
        // Build dynamic regex based on configured prefix
        // Supports "HS001", "HS 001", "hs 1", "HS.001", "HS-001" etc.
        // Boundary: (?<![A-Za-z0-9]) tránh bắt nhầm HSBC, DHS045; (?!\d) tránh bắt HS219888
        const prefixEscaped = studentIdPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const idRegex = new RegExp(`(?<![A-Za-z0-9])${prefixEscaped}[\\s.\\-]*0*(\\d+)(?!\\d)`, 'i');
        const match = content.match(idRegex);
        
        if (!match) {
            await logWebhookEvent(centerId, 'skipped', `Không tìm thấy mã ${studentIdPrefix} trong nội dung`, { amount, rawPreview });
            return res.status(200).json({ success: true, message: `No valid student ID matched (prefix: ${studentIdPrefix}) in content: ${content}` });
        }
        
        const studentNum = parseInt(match[1], 10);
        const studentId = `${studentIdPrefix}${String(studentNum).padStart(3, '0')}`;
        
        // Verify student exists
        const studentExists = currentData.students.some((s: any) => s.id === studentId);
        
        if (!studentExists) {
            await logWebhookEvent(centerId, 'error', `Mã ${studentId} không tồn tại trong hệ thống`, { studentId, amount, rawPreview });
            return res.status(200).json({ success: false, message: `Học viên mang mã ${studentId} không tồn tại trong hệ thống. Đã bỏ qua.` });
        }

        // === Duplicate Transaction Check v2 ===
        // Lớp 1: In-memory Map (nhanh, chặn retry trong cùng instance)
        const dedupRawText = (typeof rawText === 'string' && rawText.trim().length > 5) ? rawText : null;
        if (isDuplicateTransaction(centerId, dedupRawText, payload, studentId, amount)) {
            await logWebhookEvent(centerId, 'duplicate', 'Trùng lặp (in-memory)', { studentId, amount, rawPreview });
            return res.status(200).json({ 
                success: true, 
                message: `Giao dịch trùng lặp cho ${studentId}, ${amount.toLocaleString('vi-VN')}đ đã được xử lý trước đó. Bỏ qua.` 
            });
        }

        // Lớp 2: Firestore-level dedup (phòng Vercel cold start mất Map)
        // Kiểm tra xem đã có GD cùng studentId + amount + description trong 5 phút gần đây chưa
        // Lưu ý: t.date dùng getVietnamTime() format "YYYY-MM-DDTHH:mm:ss" (không có timezone)
        const descriptionPreview = `${bankKeyword}: ${autoDescription} - ${content.substring(0, 50)}`;
        const nowVN = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
        const fiveMinAgoVN = new Date(nowVN.getTime() - 5 * 60 * 1000);
        const fiveMinAgoStr = `${fiveMinAgoVN.getFullYear()}-${String(fiveMinAgoVN.getMonth()+1).padStart(2,'0')}-${String(fiveMinAgoVN.getDate()).padStart(2,'0')}T${String(fiveMinAgoVN.getHours()).padStart(2,'0')}:${String(fiveMinAgoVN.getMinutes()).padStart(2,'0')}:${String(fiveMinAgoVN.getSeconds()).padStart(2,'0')}`;
        const recentDup = (currentData.transactions || []).find((t: any) =>
            t.studentId === studentId &&
            t.amount === amount &&
            t.description === descriptionPreview &&
            t.date && t.date > fiveMinAgoStr
        );
        if (recentDup) {
            console.log(`[Webhook] FIRESTORE DEDUP: ${studentId} ${amount.toLocaleString('vi-VN')}đ already exists (${recentDup.date})`);
            await logWebhookEvent(centerId, 'duplicate', 'Trùng lặp (DB)', { studentId, amount, rawPreview });
            return res.status(200).json({ 
                success: true, 
                message: `Giao dịch ${studentId} ${amount.toLocaleString('vi-VN')}đ đã tồn tại trong DB. Bỏ qua.` 
            });
        }

        const operation = {
            op: 'addAdjustment',
            payload: {
                studentId: studentId,
                amount: amount,
                date: getVietnamTime(),
                description: `${bankKeyword}: ${autoDescription} - ${content.substring(0, 50)}`,
                type: 'CREDIT',
                paymentMethod: 'transfer'
            }
        };

        try {
            await executeOperationInternal(operation, centerId);

            // Find student name for display
            const studentObj = currentData.students.find((s: any) => s.id === studentId);
            const studentName = studentObj?.name || studentId;

            // Ghi webhook log cho giao dịch thành công
            await logWebhookEvent(centerId, 'success', `Ghi nhận ${amount.toLocaleString('vi-VN')}đ cho HS ${studentId} — ${studentName}`, { studentId, amount, rawPreview });

            // Tạo thông báo cho Admin/Manager/Kế toán
            try {
                await executeOperationInternal({
                    op: 'addAnnouncement',
                    payload: {
                        title: `💰 Nhận thanh toán ${amount.toLocaleString('vi-VN')}đ`,
                        content: `Học viên ${studentName} (${studentId}) đã thanh toán ${amount.toLocaleString('vi-VN')}đ qua ${bankKeyword}.\n\nNội dung CK: ${content.substring(0, 80)}`,
                        targetAudience: 'MANAGEMENT',
                        createdAt: getVietnamTime(),
                        createdBy: 'Hệ thống Webhook',
                    }
                }, centerId);
            } catch { /* silent */ }

            // Gửi xác nhận thanh toán qua Zalo (SLL hoặc OA) + ghi log
            try {
                const { getValidAccessToken, processTemplate, sendZaloMessage, isSLLChannel, getSLLConfig, sendViaSLL, saveMessageLog, normalizePhone } = await import('./zalo.js');
                const template = settings.messageTemplates?.paymentConfirm || 
                    'Anh/Chị phụ huynh con {studentName} thân mến,\n{centerName} xác nhận đã nhận học phí {amount} của con {studentName}.\nCảm ơn Anh/Chị đã đóng học phí đúng hạn!\nChúc con học tập tốt ạ.';
                const message = processTemplate(template, {
                    parentName: studentObj?.parentName || 'Phụ huynh',
                    studentName: studentName,
                    amount: `${amount.toLocaleString('vi-VN')}đ`,
                    centerName: settings.name || 'Trung tâm',
                });

                // Tìm className từ classes
                const studentClasses = (currentData.classes || []).filter((c: any) => (c.studentIds || []).includes(studentId));
                const className = studentClasses.map((c: any) => c.name).join(', ');
                const colName = centerId === '_legacy' ? 'data' : `center_${centerId}`;
                const parentPhone = studentObj?.parentPhone || studentObj?.phone || '';

                if (isSLLChannel(settings)) {
                    // SLL channel — send via parentPhone
                    if (parentPhone) {
                        const sll = getSLLConfig(settings);
                        if (sll.apiKey && sll.accountId) {
                            const phone = normalizePhone(parentPhone);
                            const result = await sendViaSLL(sll.baseUrl, sll.apiKey, sll.accountId, phone, message);
                            // Ghi log
                            await saveMessageLog(colName, [{
                                id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                                timestamp: Date.now(),
                                type: 'paymentConfirm',
                                channel: 'sll',
                                studentName: studentName || '',
                                parentName: studentObj?.parentName || '',
                                phone: phone,
                                message: message,
                                status: result.ok ? 'sent' : 'failed',
                                reason: result.ok ? 'Đã gửi qua SLL (Webhook tự động)' : (result.error || 'Lỗi SLL'),
                                className,
                            }]);
                        }
                    }
                } else if (settings.zaloOaEnabled && studentObj?.zaloUserId) {
                    // OA channel
                    const tokenResult = await getValidAccessToken(centerId, settings);
                    const oaResult = await sendZaloMessage(tokenResult.accessToken, studentObj.zaloUserId, message);
                    const oaOk = !oaResult.error;
                    // Ghi log
                    await saveMessageLog(colName, [{
                        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                        timestamp: Date.now(),
                        type: 'paymentConfirm',
                        channel: 'oa',
                        studentName: studentName || '',
                        parentName: studentObj?.parentName || '',
                        phone: parentPhone,
                        message: message,
                        status: oaOk ? 'sent' : 'failed',
                        reason: oaOk ? 'Đã gửi qua OA (Webhook tự động)' : (oaResult.message || 'Lỗi OA'),
                        className,
                    }]);
                }
            } catch (zaloErr) {
                console.error('Zalo payment confirm failed (silent):', zaloErr);
            }

            return res.status(200).json({ success: true, message: `Ghi nhận thanh toán ${amount} cho ${studentId} thành công.` });
        } catch (opError) {
            console.error('Data Operation error:', opError);

            // Ghi webhook log cho lỗi
            await logWebhookEvent(centerId, 'error', `Thất bại ghi nhận cho HS ${studentId}: ${String(opError)}`, { studentId, amount, rawPreview });

            return res.status(200).json({ success: false, message: `Lỗi xử lý logic cho ${studentId}`, error: String(opError) });
        }

    } catch (error) {
        console.error('Webhook payload error:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
}

