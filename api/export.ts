import { getSplitData } from './data.js';
import { verifyToken } from './_lib/jwt.js';
import { UserRole } from '../types.js';
import ExcelJS from 'exceljs';

// Helper to check JWT
async function getAuthPayload(req: any) {
    const authHeader = req.headers.authorization || req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    return await verifyToken(token);
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
    }

    const authPayload = await getAuthPayload(req);
    if (!authPayload) {
        return res.status(401).send('Unauthorized');
    }

    if (authPayload.role !== UserRole.ADMIN && authPayload.role !== UserRole.MANAGER && authPayload.role !== UserRole.ACCOUNTANT) {
        return res.status(403).send('Forbidden: Only Admin/Manager/Accountant can export data');
    }

    // Extract centerId from JWT — same as data.ts handler
    const centerId = (authPayload as any).centerId || '_legacy';

    try {
        const data = await getSplitData(centerId);
        const workbook = new ExcelJS.Workbook();
        
        const studentsMap = new Map(data.students.map((s: any) => [s.id, s.name]));

        // ===== 1. Sheet: Học viên =====
        const studentSheet = workbook.addWorksheet('Học viên');
        studentSheet.columns = [
            { header: 'Mã HV', key: 'id', width: 12 },
            { header: 'Họ tên', key: 'name', width: 25 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'SĐT', key: 'phone', width: 15 },
            { header: 'Phụ huynh', key: 'parentName', width: 25 },
            { header: 'SĐT PH', key: 'parentPhone', width: 15 },
            { header: 'Trạng thái', key: 'status', width: 15 },
            { header: 'Số dư', key: 'balance', width: 15 },
            { header: 'Ngày tạo', key: 'createdAt', width: 15 },
        ];
        const studentData = data.students.map((s: any) => ({
            id: s.id,
            name: s.name,
            email: s.email || '',
            phone: s.phone || '',
            parentName: s.parentName || '',
            parentPhone: s.parentPhone || '',
            status: s.status === 'ACTIVE' ? 'Đang học' : (s.status === 'INACTIVE' ? 'Tạm nghỉ' : (s.status === 'ARCHIVED' ? 'Lưu trữ' : s.status)),
            balance: s.balance || 0,
            createdAt: s.createdAt ? s.createdAt.substring(0, 10) : '',
        }));
        studentSheet.addRows(studentData);

        // ===== 2. Sheet: Lớp học =====
        const classSheet = workbook.addWorksheet('Lớp học');
        classSheet.columns = [
            { header: 'Mã lớp', key: 'id', width: 12 },
            { header: 'Tên lớp', key: 'name', width: 25 },
            { header: 'Môn', key: 'subject', width: 20 },
            { header: 'Loại phí', key: 'feeType', width: 15 },
            { header: 'Số tiền phí', key: 'feeAmount', width: 15 },
            { header: 'Sĩ số', key: 'studentCount', width: 10 },
            { header: 'Trạng thái', key: 'classStatus', width: 15 },
        ];
        const classData = data.classes.map((c: any) => ({
            id: c.id,
            name: c.name,
            subject: c.subject || '',
            feeType: c.fee?.type === 'PER_SESSION' ? 'Theo buổi' : (c.fee?.type === 'PER_COURSE' ? 'Trọn khóa' : 'Theo tháng'),
            feeAmount: c.fee?.amount || 0,
            studentCount: (c.studentIds || []).length,
            classStatus: c.classStatus === 'ARCHIVED' ? 'Lưu trữ' : (c.classStatus === 'ENDED' ? 'Đã kết thúc' : (c.classStatus === 'PAUSED' ? 'Tạm dừng' : 'Đang mở')),
        }));
        classSheet.addRows(classData);

        // ===== 3. Sheet: Doanh thu =====
        const revenueSheet = workbook.addWorksheet('Doanh thu');
        revenueSheet.columns = [
            { header: 'Ngày', key: 'date', width: 15 },
            { header: 'Loại', key: 'type', width: 20 },
            { header: 'Mô tả', key: 'description', width: 40 },
            { header: 'Số tiền', key: 'amount', width: 15 },
            { header: 'Học sinh', key: 'student', width: 25 },
        ];
        
        const revenueData = [
            ...data.transactions.filter((t: any) => t.type === 'PAYMENT' || t.type === 'ADJUSTMENT_CREDIT').map((t: any) => ({
                date: t.date ? t.date.substring(0, 10) : '',
                type: 'Học phí',
                description: t.description,
                amount: t.amount,
                student: studentsMap.get(t.studentId) || t.studentId || 'Không rõ'
            })),
            ...data.income.map((i: any) => ({
                date: i.date ? i.date.substring(0, 10) : '',
                type: 'Thu khác',
                description: i.description,
                amount: i.amount,
                student: '-'
            }))
        ].sort((a, b) => a.date.localeCompare(b.date));
        
        revenueSheet.addRows(revenueData);

        // ===== 4. Sheet: Chi phí =====
        const expenseSheet = workbook.addWorksheet('Chi phí');
        expenseSheet.columns = [
            { header: 'Ngày', key: 'date', width: 15 },
            { header: 'Danh mục', key: 'category', width: 20 },
            { header: 'Mô tả', key: 'description', width: 40 },
            { header: 'Số tiền', key: 'amount', width: 15 },
        ];
        const expenseData = data.expenses.map((e: any) => ({
            date: e.date ? e.date.substring(0, 10) : '',
            category: e.category || '',
            description: e.description,
            amount: e.amount
        })).sort((a: any, b: any) => a.date.localeCompare(b.date));
        expenseSheet.addRows(expenseData);

        // ===== 5. Sheet: Hóa đơn =====
        const invoiceSheet = workbook.addWorksheet('Hóa đơn');
        invoiceSheet.columns = [
            { header: 'Mã HĐ', key: 'id', width: 30 },
            { header: 'Kỳ', key: 'period', width: 12 },
            { header: 'Học sinh', key: 'student', width: 25 },
            { header: 'Số tiền', key: 'amount', width: 15 },
            { header: 'Trạng thái', key: 'status', width: 18 },
            { header: 'Ngày tạo', key: 'generatedDate', width: 15 },
            { header: 'Ngày đóng', key: 'paidDate', width: 15 },
            { header: 'Chi tiết', key: 'details', width: 50 },
        ];
        const invoiceData = data.invoices.map((inv: any) => ({
            id: inv.id,
            period: inv.month || '',
            student: inv.studentName || studentsMap.get(inv.studentId) || 'Không rõ',
            amount: inv.amount,
            status: inv.status === 'PAID' ? 'Đã thanh toán' : (inv.status === 'CANCELLED' ? 'Đã hủy' : 'Chưa thanh toán'),
            generatedDate: inv.generatedDate ? inv.generatedDate.substring(0, 10) : '',
            paidDate: inv.paidDate ? inv.paidDate.substring(0, 10) : '',
            details: inv.details || '',
        })).sort((a: any, b: any) => a.period.localeCompare(b.period));
        invoiceSheet.addRows(invoiceData);

        // ===== 6. Sheet: Giao dịch (toàn bộ) =====
        const txSheet = workbook.addWorksheet('Giao dịch');
        txSheet.columns = [
            { header: 'Mã GD', key: 'id', width: 25 },
            { header: 'Ngày', key: 'date', width: 15 },
            { header: 'Loại', key: 'type', width: 20 },
            { header: 'Học sinh', key: 'student', width: 25 },
            { header: 'Mô tả', key: 'description', width: 40 },
            { header: 'Số tiền', key: 'amount', width: 15 },
        ];
        const txData = data.transactions.map((t: any) => {
            const typeMap: Record<string, string> = {
                'PAYMENT': 'Thanh toán',
                'INVOICE': 'Hóa đơn',
                'ADJUSTMENT_CREDIT': 'Điều chỉnh (+)',
                'ADJUSTMENT_DEBIT': 'Điều chỉnh (-)',
            };
            return {
                id: t.id,
                date: t.date ? t.date.substring(0, 10) : '',
                type: typeMap[t.type] || t.type,
                student: studentsMap.get(t.studentId) || t.studentId || '',
                description: t.description,
                amount: t.amount,
            };
        }).sort((a: any, b: any) => a.date.localeCompare(b.date));
        txSheet.addRows(txData);

        // ===== 7. Sheet: Điểm danh =====
        const attSheet = workbook.addWorksheet('Điểm danh');
        attSheet.columns = [
            { header: 'Ngày', key: 'date', width: 12 },
            { header: 'Lớp', key: 'className', width: 25 },
            { header: 'Học sinh', key: 'studentName', width: 25 },
            { header: 'Trạng thái', key: 'status', width: 15 },
            { header: 'Ghi chú', key: 'note', width: 30 },
        ];
        const classMap = new Map(data.classes.map((c: any) => [c.id, c.name]));
        const statusMap: Record<string, string> = {
            'PRESENT': 'Có mặt',
            'ABSENT': 'Nghỉ có phép',
            'LATE': 'Đi muộn',
            'UNEXCUSED_ABSENT': 'Nghỉ không phép',
            'UNMARKED': 'Chưa điểm danh',
        };
        const attData = data.attendance.map((a: any) => ({
            date: a.date,
            className: classMap.get(a.classId) || a.classId,
            studentName: studentsMap.get(a.studentId) || a.studentId,
            status: statusMap[a.status] || a.status,
            note: a.note || '',
        })).sort((a: any, b: any) => a.date.localeCompare(b.date));
        attSheet.addRows(attData);

        // Style headers for all sheets
        workbook.eachSheet((sheet) => {
            const headerRow = sheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
            headerRow.height = 22;
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="BaoCao_ToanThoiGian_${new Date().toISOString().slice(0,10)}.xlsx"`);
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export Error:', error);
        res.status(500).send('Lỗi xuất dữ liệu');
    }
}
