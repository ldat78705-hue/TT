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

interface ZaloDebtMessageParams {
    centerName: string;
    centerPhone?: string;
    parentName: string;
    studentName: string;
    invoices: {
        month: string;
        amount: number;
    }[];
    totalDebt: number;
    /** Custom template from settings.messageTemplates.tuitionReminder */
    customTemplate?: string;
}

/**
 * Tạo nội dung tin nhắn nhắc công nợ qua Zalo.
 * Nếu có template custom → dùng template.
 * Nếu không → dùng template mặc định chi tiết.
 */
export function buildDebtMessage(params: ZaloDebtMessageParams): string {
    const { centerName, centerPhone, parentName, studentName, invoices, totalDebt, customTemplate } = params;

    // Nếu có custom template → process template
    if (customTemplate) {
        const invoiceLines = invoices.map(inv => 
            `- Tháng ${inv.month}: ${inv.amount.toLocaleString('vi-VN')}₫`
        ).join('\n');
        
        return customTemplate
            .replace(/\\n/g, '\n')
            .replace(/{parentName}/g, parentName)
            .replace(/{studentName}/g, studentName)
            .replace(/{centerName}/g, centerName)
            .replace(/{amount}/g, `${totalDebt.toLocaleString('vi-VN')}₫`)
            .replace(/{details}/g, invoiceLines)
            .replace(/{phone}/g, centerPhone || '');
    }

    // Template mặc định
    const invoiceLines = invoices.map(inv => 
        `  • Tháng ${inv.month}: ${inv.amount.toLocaleString('vi-VN')}₫`
    ).join('\n');

    return [
        `Kính gửi PH ${parentName},`,
        ``,
        `Trung tâm ${centerName} xin thông báo:`,
        `Học viên ${studentName} hiện có học phí chưa thanh toán:`,
        invoiceLines,
        ``,
        `Tổng cộng: ${totalDebt.toLocaleString('vi-VN')}₫`,
        ``,
        `Vui lòng thanh toán để đảm bảo quyền lợi học tập của con.`,
        `Trân trọng!`,
        centerPhone ? `${centerName} - SĐT: ${centerPhone}` : centerName,
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
