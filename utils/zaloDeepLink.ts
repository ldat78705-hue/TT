/**
 * Zalo Deep Link Utilities
 * 
 * Mở Zalo (app/web) đến cửa sổ chat với SĐT phụ huynh
 * và copy sẵn nội dung tin nhắn nhắc công nợ vào clipboard.
 */

/**
 * Chuẩn hóa SĐT để dùng với Zalo deep link.
 * Zalo chấp nhận cả format 0xxx và 84xxx.
 * Loại bỏ ký tự không hợp lệ (khoảng trắng, dấu gạch, dấu +).
 */
export function normalizePhoneForZalo(phone: string): string {
    // Loại bỏ tất cả ký tự không phải số
    let cleaned = phone.replace(/\D/g, '');
    
    // Nếu bắt đầu bằng 84 và có 11-12 số → giữ nguyên
    // Nếu bắt đầu bằng 0 và có 10 số → giữ nguyên
    // Zalo.me chấp nhận cả 2 format
    return cleaned;
}

/**
 * Tạo URL deep link Zalo từ SĐT
 */
export function getZaloDeepLink(phone: string): string {
    const normalized = normalizePhoneForZalo(phone);
    return `https://zalo.me/${normalized}`;
}

/**
 * Lấy SĐT Zalo của phụ huynh.
 * Ưu tiên parentPhone (SĐT Zalo PH), nếu không có thì dùng phone (SĐT chính).
 */
export function getStudentZaloPhone(student: { parentPhone?: string; phone?: string }): string | null {
    return student.parentPhone?.trim() || student.phone?.trim() || null;
}

interface ZaloDebtMessageParams {
    centerName: string;
    centerPhone?: string;
    bankName?: string;
    bankAccountNumber?: string;
    bankAccountHolder?: string;
    parentName: string;
    studentName: string;
    invoices: {
        month: string;
        amount: number;
    }[];
    totalDebt: number;
    /** Custom template from settings.messageTemplates.tuitionReminder */
    customTemplate?: string;
    /** Class name(s) for {className} variable in custom template */
    className?: string;
    /** Day of month for tuition deadline (default 10) */
    tuitionDeadlineDay?: number;
}

/**
 * Calculate deadline: Nth of the month AFTER the invoice month.
 * E.g. invoice month "2026-08", deadlineDay=10 → deadline = "10/09/2026"
 */
function calcDeadline(invoiceMonth?: string, deadlineDay: number = 10): string {
    const dDay = deadlineDay || 10;
    if (invoiceMonth) {
        const [invYear, invMonth] = invoiceMonth.split('-').map(Number);
        // Date constructor: month is 0-based, so passing invMonth (1-based) = next month
        const deadlineDate = new Date(invYear, invMonth, dDay);
        return `${String(dDay).padStart(2, '0')}/${String(deadlineDate.getMonth() + 1).padStart(2, '0')}/${deadlineDate.getFullYear()}`;
    }
    // Fallback: Nth of next month from now
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, dDay);
    return `${String(dDay).padStart(2, '0')}/${String(nextMonth.getMonth() + 1).padStart(2, '0')}/${nextMonth.getFullYear()}`;
}

/**
 * Tạo nội dung tin nhắn nhắc công nợ qua Zalo.
 * Nếu có template custom → dùng template.
 * Nếu không → dùng template mặc định chi tiết.
 */
export function buildDebtMessage(params: ZaloDebtMessageParams): string {
    const { centerName, centerPhone, bankName, bankAccountNumber, bankAccountHolder, parentName, studentName, invoices, totalDebt, customTemplate, className, tuitionDeadlineDay } = params;

    // Build bank info string — same format as backend
    const bankInfo = bankAccountNumber 
        ? `\nThông tin CK: ${bankAccountNumber} - ${bankAccountHolder || ''} - ${bankName || ''}`
        : '';

    // Calculate deadline from latest invoice month (most recent unpaid)
    const latestMonth = invoices.length > 0 
        ? invoices.reduce((max, inv) => inv.month > max ? inv.month : max, invoices[0].month)
        : undefined;
    const deadline = calcDeadline(latestMonth, tuitionDeadlineDay);

    // Nếu có custom template → process template
    if (customTemplate) {
        const invoiceLines = invoices.map(inv => 
            `- Tháng ${inv.month}: ${Math.abs(inv.amount).toLocaleString('vi-VN')}đ`
        ).join('\n');
        
        let result = customTemplate
            .replace(/\\n/g, '\n')
            .replace(/{parentName}/g, parentName)
            .replace(/{studentName}/g, studentName)
            .replace(/{centerName}/g, centerName)
            .replace(/{amount}/g, `${totalDebt.toLocaleString('vi-VN')}đ`)
            .replace(/{details}/g, invoiceLines)
            .replace(/{phone}/g, centerPhone || '')
            .replace(/{bankInfo}/g, bankInfo)
            .replace(/{bankName}/g, bankName || '')
            .replace(/{bankAccount}/g, bankAccountNumber || '')
            .replace(/{bankHolder}/g, bankAccountHolder || '')
            .replace(/{deadline}/g, deadline)
            .replace(/{className}/g, className || '')
            .replace(/{date}/g, new Date().toLocaleDateString('vi-VN'));
        
        // Auto-append deadline if template didn't include it
        if (!customTemplate.includes('{deadline}')) {
            result += `\nHạn đóng: trước ngày ${deadline}.`;
        }
        // Auto-append bank info if template didn't include it
        if (bankInfo && !customTemplate.includes('{bankInfo}') && !customTemplate.includes('{bankAccount}')) {
            result += bankInfo;
        }
        return result;
    }

    // Template mặc định — same structure as backend default
    const amountStr = `${totalDebt.toLocaleString('vi-VN')}đ`;

    return [
        `Anh/Chị phụ huynh con ${studentName} thân mến,`,
        `${centerName} xin gửi thông tin học phí của con ${studentName}: ${amountStr}.`,
        `Thời hạn đóng: trước ngày ${deadline}.`,
        `Anh/Chị vui lòng sắp xếp đóng học phí đúng hạn giúp ạ.${bankInfo}`,
        `Mọi thắc mắc xin liên hệ trung tâm.`,
        `Trân trọng cảm ơn!`,
    ].join('\n');
}

/**
 * Copy nội dung vào clipboard và mở Zalo deep link.
 * Returns true nếu thành công.
 */
export async function copyAndOpenZalo(
    phone: string,
    message: string,
): Promise<{ success: boolean; error?: string }> {
    // Validate SĐT
    const normalized = normalizePhoneForZalo(phone);
    if (!normalized || normalized.length < 9) {
        return { success: false, error: 'SĐT phụ huynh không hợp lệ.' };
    }

    // Copy tin nhắn vào clipboard
    try {
        await navigator.clipboard.writeText(message);
    } catch {
        // Fallback cho trình duyệt không hỗ trợ clipboard API
        try {
            const textarea = document.createElement('textarea');
            textarea.value = message;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        } catch {
            return { success: false, error: 'Không thể copy tin nhắn. Vui lòng copy thủ công.' };
        }
    }

    // Mở Zalo deep link
    const url = getZaloDeepLink(normalized);
    window.open(url, '_blank');

    return { success: true };
}
