import { executeOperationInternal, getSplitData } from './data.js';
import { getVietnamTime } from '../utils/date.js';

export default async function webhookHandler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const payload = req.body || {};
        
        let amount = 0;
        let content = '';
        
        // 1. RAW TEXT MODE (MacroDroid / Tasker / SMS forwarding)
        // Handles cases where MacroDroid sends { "text": "[notification_body]" }
        const rawText = payload.notification_text || payload.text || payload.message || payload.body;
        if (typeof rawText === 'string' && rawText.trim().length > 5) {
            // Extract amount: e.g., "+ 500,000 VND", "+50.000VNĐ"
            const amountMatch = rawText.match(/\+\s*([\d,.]+)\s*(?:VND|VNĐ|D|Đ)?/i);
            if (amountMatch) {
                amount = Number(amountMatch[1].replace(/[,.]/g, ''));
            } else {
                // Fallback for banks or SMS formats that don't have "+"
                const fallbackMatch = rawText.match(/(?:GD|Giao dich|So tien|PS(?: CO)?|SD):\s*([\d,.]+)\s*(?:VND|VNĐ)/i);
                if (fallbackMatch) {
                    amount = Number(fallbackMatch[1].replace(/[,.]/g, ''));
                }
            }
            
            // Extract content: usually after "ND:" or "Nội dung:"
            // If there's no "ND:", we just pass the whole rawText into `content` so the ID regex can still find "HS001".
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
        
        // Extract student code: Supports "HS001", "HS 001", "hs 1", "HS.001", "HS-001"
        // Uses \b and boundaries to avoid matching substrings inside long random strings (e.g. THS001, 123HS001)
        const match = content.match(/HS[\s.\-]*0*(\d+)/i);
        if (!match) {
            return res.status(200).json({ success: true, message: `No valid student ID matched in content: ${content}` });
        }
        
        const studentNum = parseInt(match[1], 10);
        const studentId = `HS${String(studentNum).padStart(3, '0')}`;
        
        // Verify student exists to prevent orphan transactions
        const currentData = await getSplitData();
        const studentExists = currentData.students.some((s: any) => s.id === studentId);
        
        if (!studentExists) {
            return res.status(200).json({ success: false, message: `Học viên mang mã ${studentId} không tồn tại trong hệ thống. Đã bỏ qua.` });
        }

        // Use exactly the same data logic we use for manual payment additions
        const operation = {
            op: 'addAdjustment',
            payload: {
                studentId: studentId,
                amount: amount,
                date: getVietnamTime().substring(0, 10), // Just "YYYY-MM-DD" matching other places
                description: `MBBank: ${content.substring(0, 50)}`,
                type: 'CREDIT',
                paymentMethod: 'transfer'
            }
        };

        try {
            await executeOperationInternal(operation);
            return res.status(200).json({ success: true, message: `Ghi nhận thanh toán ${amount} cho ${studentId} thành công.` });
        } catch (opError) {
            console.error('Data Operation error:', opError);
            return res.status(200).json({ success: false, message: `Lỗi xử lý logic cho ${studentId}`, error: String(opError) });
        }

    } catch (error) {
        console.error('Webhook payload error:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
}
