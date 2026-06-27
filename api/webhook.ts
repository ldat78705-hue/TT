import { executeOperationInternal, getSplitData } from './data.js';
import { getVietnamTime } from '../utils/date.js';

export default async function webhookHandler(req: any, res: any) {
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
        
        // 1. RAW TEXT MODE (MacroDroid / Tasker / SMS forwarding)
        const rawText = payload.notification_text || payload.text || payload.message || payload.body;
        if (typeof rawText === 'string' && rawText.trim().length > 5) {
            const amountMatch = rawText.match(/\+\s*([\d,.]+)\s*(?:VND|VNĐ|D|Đ)?/i);
            if (amountMatch) {
                amount = Number(amountMatch[1].replace(/[,.]/g, ''));
            } else {
                const fallbackMatch = rawText.match(/(?:GD|Giao dich|So tien|PS(?: CO)?|SD):\s*([\d,.]+)\s*(?:VND|VNĐ)/i);
                if (fallbackMatch) {
                    amount = Number(fallbackMatch[1].replace(/[,.]/g, ''));
                }
            }
            
            const ndMatch = rawText.match(/(?:ND|Nội dung|NOI DUNG):\s*(.*?)(?=\||$)/i);
            content = ndMatch ? ndMatch[1].trim() : rawText.trim();
        } 
        // 2. STRUCTURED JSON MODE (SePay, Cass.vn, PayOS)
        else {
            amount = Number(payload.transferAmount || payload.amount || payload.tien) || 0;
            content = String(payload.content || payload.description || payload.noi_dung || '');
        }
        
        content = content.toUpperCase();
        
        if (!amount || !content) {
            return res.status(200).json({ success: true, message: 'No amount or valid content extracted, ignoring.' });
        }
        
        // Build dynamic regex based on configured prefix
        // Supports "HS001", "HS 001", "hs 1", "HS.001", "HS-001" etc.
        const prefixEscaped = studentIdPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const idRegex = new RegExp(`${prefixEscaped}[\\s.\\-]*0*(\\d+)`, 'i');
        const match = content.match(idRegex);
        
        if (!match) {
            return res.status(200).json({ success: true, message: `No valid student ID matched (prefix: ${studentIdPrefix}) in content: ${content}` });
        }
        
        const studentNum = parseInt(match[1], 10);
        const studentId = `${studentIdPrefix}${String(studentNum).padStart(3, '0')}`;
        
        // Verify student exists
        const studentExists = currentData.students.some((s: any) => s.id === studentId);
        
        if (!studentExists) {
            return res.status(200).json({ success: false, message: `Học viên mang mã ${studentId} không tồn tại trong hệ thống. Đã bỏ qua.` });
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

            // Ghi audit log cho giao dịch tự động
            try {
                const auditEntry = {
                    userId: 'WEBHOOK',
                    userName: 'Thanh toán tự động',
                    action: 'addAdjustment',
                    targetType: 'finance',
                    targetName: studentId,
                    details: `[Webhook] Ghi nhận ${amount.toLocaleString('vi-VN')}đ cho HS ${studentId} — ${content.substring(0, 80)}`,
                    timestamp: new Date().toISOString()
                };
                await executeOperationInternal({ op: 'addAuditLog', payload: auditEntry }, centerId);
            } catch { /* silent — don't fail payment if audit log fails */ }

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

            // Gửi xác nhận thanh toán qua Zalo OA (nếu đã bật)
            if (settings.zaloOaEnabled && studentObj?.zaloUserId) {
                try {
                    const { getValidAccessToken, processTemplate, sendZaloMessage } = await import('./zalo.js');
                    const { accessToken } = await getValidAccessToken(centerId, settings);
                    const template = settings.messageTemplates?.paymentConfirm || 
                        'Kính gửi PH {parentName},\n\nTrung tâm {centerName} xác nhận đã nhận thanh toán {amount} cho học viên {studentName}.\n\nCảm ơn quý phụ huynh!\nTrân trọng!';
                    const message = processTemplate(template, {
                        parentName: studentObj.parentName || 'Phụ huynh',
                        studentName: studentName,
                        amount: `${amount.toLocaleString('vi-VN')}đ`,
                        centerName: settings.name || 'Trung tâm',
                    });
                    await sendZaloMessage(accessToken, studentObj.zaloUserId, message);
                } catch (zaloErr) {
                    console.error('Zalo payment confirm failed (silent):', zaloErr);
                }
            }

            return res.status(200).json({ success: true, message: `Ghi nhận thanh toán ${amount} cho ${studentId} thành công.` });
        } catch (opError) {
            console.error('Data Operation error:', opError);

            // Ghi audit log cho lỗi webhook
            try {
                const errorAudit = {
                    userId: 'WEBHOOK',
                    userName: 'Thanh toán tự động',
                    action: 'addAdjustment',
                    targetType: 'finance',
                    targetName: studentId,
                    details: `[Webhook LỖI] Thất bại ghi nhận ${amount.toLocaleString('vi-VN')}đ cho HS ${studentId}: ${String(opError)}`,
                    timestamp: new Date().toISOString()
                };
                await executeOperationInternal({ op: 'addAuditLog', payload: errorAudit }, centerId).catch(() => {});
            } catch { /* silent */ }

            return res.status(200).json({ success: false, message: `Lỗi xử lý logic cho ${studentId}`, error: String(opError) });
        }

    } catch (error) {
        console.error('Webhook payload error:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
}

