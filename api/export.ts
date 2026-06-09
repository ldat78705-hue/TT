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

    if (authPayload.role !== UserRole.ADMIN && authPayload.role !== UserRole.MANAGER) {
        return res.status(403).send('Forbidden: Only Admin/Manager can export data');
    }

    try {
        const data = await getSplitData();
        const workbook = new ExcelJS.Workbook();
        
        // 1. Doanh thu (Transactions + Income)
        const revenueSheet = workbook.addWorksheet('Doanh thu');
        revenueSheet.columns = [
            { header: 'Ngày', key: 'date', width: 15 },
            { header: 'Loại', key: 'type', width: 20 },
            { header: 'Mô tả', key: 'description', width: 40 },
            { header: 'Số tiền', key: 'amount', width: 15 },
            { header: 'Học sinh', key: 'student', width: 25 },
        ];
        
        const studentsMap = new Map(data.students.map((s: any) => [s.id, s.name]));
        
        const revenueData = [
            ...data.transactions.filter((t: any) => t.type === 'PAYMENT' || t.type === 'ADJUSTMENT_CREDIT').map((t: any) => ({
                date: t.date,
                type: 'Học phí',
                description: t.description,
                amount: t.amount,
                student: studentsMap.get(t.studentId) || 'Không rõ'
            })),
            ...data.income.map((i: any) => ({
                date: i.date,
                type: 'Thu khác',
                description: i.description,
                amount: i.amount,
                student: '-'
            }))
        ].sort((a, b) => a.date.localeCompare(b.date));
        
        revenueSheet.addRows(revenueData);

        // 2. Chi phí (Expenses)
        const expenseSheet = workbook.addWorksheet('Chi phí');
        expenseSheet.columns = [
            { header: 'Ngày', key: 'date', width: 15 },
            { header: 'Danh mục', key: 'category', width: 20 },
            { header: 'Mô tả', key: 'description', width: 40 },
            { header: 'Số tiền', key: 'amount', width: 15 },
        ];
        const expenseData = data.expenses.map((e: any) => ({
            date: e.date,
            category: e.category,
            description: e.description,
            amount: e.amount
        })).sort((a: any, b: any) => a.date.localeCompare(b.date));
        expenseSheet.addRows(expenseData);

        // 3. Công nợ (Invoices)
        const invoiceSheet = workbook.addWorksheet('Công nợ');
        invoiceSheet.columns = [
            { header: 'Tháng/Năm', key: 'period', width: 15 },
            { header: 'Học sinh', key: 'student', width: 25 },
            { header: 'Số tiền', key: 'amount', width: 15 },
            { header: 'Trạng thái', key: 'status', width: 15 },
            { header: 'Ngày đóng', key: 'paidDate', width: 15 },
        ];
        const invoiceData = data.invoices.map((inv: any) => ({
            period: `${inv.month}/${inv.year}`,
            student: studentsMap.get(inv.studentId) || 'Không rõ',
            amount: inv.amount,
            status: inv.status === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán',
            paidDate: inv.paidDate || '-'
        })).sort((a: any, b: any) => a.period.localeCompare(b.period));
        invoiceSheet.addRows(invoiceData);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="BaoCao_ToanThoiGian_${new Date().toISOString().slice(0,10)}.xlsx"`);
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export Error:', error);
        res.status(500).send('Lỗi xuất dữ liệu');
    }
}
