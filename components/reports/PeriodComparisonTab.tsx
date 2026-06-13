import React, { useMemo } from 'react';
import { useData } from '../../hooks/useDataContext';
import { TransactionType } from '../../types';
import { getVietnamTime } from '../../utils/date';

const formatCurrency = (amount: number) => `${amount.toLocaleString('vi-VN')} ₫`;

interface ComparisonItem {
    label: string;
    current: number;
    previous: number;
}

const ComparisonRow: React.FC<{ item: ComparisonItem }> = ({ item }) => {
    const diff = item.current - item.previous;
    const pct = item.previous !== 0 ? Math.round((diff / Math.abs(item.previous)) * 100) : (item.current > 0 ? 100 : 0);
    
    return (
        <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
            <td className="py-3 px-4 font-medium text-sm">{item.label}</td>
            <td className="py-3 px-4 text-right text-sm font-semibold">{formatCurrency(item.previous)}</td>
            <td className="py-3 px-4 text-right text-sm font-semibold">{formatCurrency(item.current)}</td>
            <td className="py-3 px-4 text-right text-sm font-bold">
                <span className={diff >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                </span>
            </td>
            <td className="py-3 px-4 text-right">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                    diff > 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : diff < 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                }`}>
                    {diff > 0 ? '▲' : diff < 0 ? '▼' : '—'} {Math.abs(pct)}%
                </span>
            </td>
        </tr>
    );
};

export const PeriodComparisonTab: React.FC = () => {
    const { state } = useData();
    const { transactions, income, expenses, students, attendance } = state;

    const vnDate = new Date(getVietnamTime());
    const currentMonth = vnDate.getMonth();
    const currentYear = vnDate.getFullYear();

    const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevMonthStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;

    const monthLabel = (m: number, y: number) => `Tháng ${m + 1}/${y}`;

    const calcRevenue = (monthStr: string) => {
        const tuition = transactions
            .filter(t => t.date.startsWith(monthStr) && (t.type === TransactionType.PAYMENT || t.type === TransactionType.ADJUSTMENT_CREDIT) && t.amount > 0 && !t.description.toLowerCase().includes('hủy hóa đơn'))
            .reduce((s, t) => s + t.amount, 0);
        const other = income.filter(i => i.date.startsWith(monthStr)).reduce((s, i) => s + i.amount, 0);
        return { tuition, other, total: tuition + other };
    };

    const calcExpense = (monthStr: string) => 
        expenses.filter(e => e.date.startsWith(monthStr)).reduce((s, e) => s + e.amount, 0);

    const calcNewStudents = (monthStr: string) =>
        students.filter(s => s.createdAt.startsWith(monthStr)).length;

    const calcAttendanceSessions = (monthStr: string) =>
        new Set(attendance.filter(a => a.date.startsWith(monthStr)).map(a => `${a.classId}|${a.date}`)).size;

    const comparison = useMemo<ComparisonItem[]>(() => {
        const curRev = calcRevenue(currentMonthStr);
        const prevRev = calcRevenue(prevMonthStr);
        const curExp = calcExpense(currentMonthStr);
        const prevExp = calcExpense(prevMonthStr);

        return [
            { label: 'Học phí đã thu', current: curRev.tuition, previous: prevRev.tuition },
            { label: 'Thu nhập khác', current: curRev.other, previous: prevRev.other },
            { label: 'Tổng doanh thu', current: curRev.total, previous: prevRev.total },
            { label: 'Tổng chi phí', current: curExp, previous: prevExp },
            { label: 'Lợi nhuận', current: curRev.total - curExp, previous: prevRev.total - prevExp },
            { label: 'Học viên mới', current: calcNewStudents(currentMonthStr), previous: calcNewStudents(prevMonthStr) },
            { label: 'Buổi dạy', current: calcAttendanceSessions(currentMonthStr), previous: calcAttendanceSessions(prevMonthStr) },
        ];
    }, [transactions, income, expenses, students, attendance, currentMonthStr, prevMonthStr]);

    return (
        <div className="card-base">
            <h2 className="text-xl font-bold mb-1">So sánh kỳ</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                {monthLabel(prevMonth, prevYear)} → {monthLabel(currentMonth, currentYear)}
            </p>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {comparison.slice(2, 5).map(item => {
                    const diff = item.current - item.previous;
                    const pct = item.previous !== 0 ? Math.round((diff / Math.abs(item.previous)) * 100) : 0;
                    return (
                        <div key={item.label} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{item.label}</p>
                            <p className="text-2xl font-bold mt-1">{formatCurrency(item.current)}</p>
                            <p className={`text-sm font-semibold mt-1 ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {diff >= 0 ? '▲' : '▼'} {Math.abs(pct)}% so với tháng trước
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* Detail Table */}
            <div className="overflow-x-auto border rounded-xl dark:border-slate-700">
                <table className="min-w-full">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800">
                            <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Chỉ tiêu</th>
                            <th className="py-3 px-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">{monthLabel(prevMonth, prevYear)}</th>
                            <th className="py-3 px-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">{monthLabel(currentMonth, currentYear)}</th>
                            <th className="py-3 px-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Chênh lệch</th>
                            <th className="py-3 px-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">%</th>
                        </tr>
                    </thead>
                    <tbody>
                        {comparison.map(item => (
                            <ComparisonRow key={item.label} item={item} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
