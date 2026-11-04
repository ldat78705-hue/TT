
import React, { useMemo, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useData } from '../hooks/useDataContext';
import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import { UserRole } from '../types';
import { UnpaidStudentsReport } from '../components/finance/UnpaidStudentsReport';
import { TeacherPayrollTab } from '../components/finance/TeacherPayrollTab';
import { PayrollTab } from '../components/finance/PayrollTab';
import { InvoicesTab } from '../components/finance/InvoicesTab';
import { IncomeTab } from '../components/finance/IncomeTab';
import { ExpenseTab } from '../components/finance/ExpenseTab';

declare global {
    interface Window {
        html2canvas: any;
    }
}

const toLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

type FinanceTab = 'overview' | 'debt_report' | 'invoices' | 'payroll' | 'income' | 'expenses' | 'my_payroll';


type OverviewCardType = 'monthlyTuition' | 'accrualRevenue' | 'cashRevenue' | 'cashFlow' | 'expenses' | 'otherIncome' | 'receivables' | 'credit' | null;

const OverviewTab: React.FC<{startDate: string, endDate: string}> = ({startDate, endDate}) => {
    const { state } = useData();
    const [expandedCard, setExpandedCard] = useState<OverviewCardType>(null);

    const financialSummary = useMemo(() => {
        // 1. Doanh thu ghi nhận (Accrual Revenue): Từ hóa đơn đã tạo trong khoảng thời gian
        const accrualRevenue = state.invoices
            .filter(i => i.generatedDate >= startDate && i.generatedDate <= endDate && i.status !== 'CANCELLED')
            .reduce((sum, i) => sum + i.amount, 0);

        // 1b. Học phí theo tháng học: Tổng hóa đơn thuộc tháng học trong khoảng thời gian
        const startMonth = startDate.substring(0, 7);
        const endMonth = endDate.substring(0, 7);
        const monthlyTuition = state.invoices
            .filter(i => i.month >= startMonth && i.month <= endMonth && i.status !== 'CANCELLED')
            .reduce((sum, i) => sum + i.amount, 0);
        
        const monthlyInvoiceCount = state.invoices
            .filter(i => i.month >= startMonth && i.month <= endMonth && i.status !== 'CANCELLED')
            .length;
        
        const monthlyPaidCount = state.invoices
            .filter(i => i.month >= startMonth && i.month <= endMonth && i.status === 'PAID')
            .length;
        
        const monthlyPaidAmount = state.invoices
            .filter(i => i.month >= startMonth && i.month <= endMonth && i.status === 'PAID')
            .reduce((sum, i) => sum + i.amount, 0);

        // 2. Thực thu từ Học phí (Cash Tuition): Từ giao dịch thanh toán thực tế trong khoảng thời gian
        const tuitionCollected = state.transactions
            .filter(t => t.date.substring(0, 10) >= startDate && t.date.substring(0, 10) <= endDate && t.amount > 0)
            .reduce((sum, t) => sum + t.amount, 0);
        
        // 3. Thực thu từ Nguồn khác (Other Income) trong khoảng thời gian
        const otherIncome = state.income
            .filter(i => i.date >= startDate && i.date <= endDate)
            .reduce((sum, i) => sum + i.amount, 0);

        const cashRevenue = tuitionCollected + otherIncome;
        
        // 4. Tổng chi phí
        const totalExpenses = state.expenses
            .filter(e => e.date >= startDate && e.date <= endDate)
            .reduce((sum, e) => sum + e.amount, 0);
        
        // 5. Công nợ & Số dư ví
        const totalReceivables = state.students
            .filter(s => s.balance < 0)
            .reduce((sum, s) => sum + s.balance, 0);

        const totalCredit = state.students
            .filter(s => s.balance > 0)
            .reduce((sum, s) => sum + s.balance, 0);

        return {
            accrualRevenue,
            monthlyTuition,
            monthlyInvoiceCount,
            monthlyPaidAmount,
            monthlyPaidCount,
            cashRevenue,
            totalExpenses,
            cashFlow: cashRevenue - totalExpenses,
            totalReceivables: Math.abs(totalReceivables),
            totalCredit,
            otherIncome
        };
    }, [state.invoices, state.transactions, state.expenses, state.students, state.income, startDate, endDate]);

    // Detail data
    const detailData = useMemo(() => {
        const startMonth = startDate.substring(0, 7);
        const endMonth = endDate.substring(0, 7);
        return {
            monthlyTuition: state.invoices.filter(i => i.month >= startMonth && i.month <= endMonth && i.status !== 'CANCELLED'),
            accrualRevenue: state.invoices.filter(i => i.generatedDate >= startDate && i.generatedDate <= endDate && i.status !== 'CANCELLED'),
            cashRevenue: state.transactions.filter(t => t.date.substring(0, 10) >= startDate && t.date.substring(0, 10) <= endDate && t.amount > 0),
            expenses: state.expenses.filter(e => e.date >= startDate && e.date <= endDate),
            otherIncome: state.income.filter(i => i.date >= startDate && i.date <= endDate),
            receivables: state.students.filter(s => s.balance < 0),
            credit: state.students.filter(s => s.balance > 0),
        };
    }, [state, startDate, endDate]);

    const toggleCard = (card: OverviewCardType) => setExpandedCard(prev => prev === card ? null : card);
    const fmt = (n: number) => n.toLocaleString('vi-VN');

    const renderDetail = () => {
        if (!expandedCard) return null;
        const headerClass = "text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider";
        const cellClass = "py-2 px-3 text-sm text-slate-700 dark:text-slate-200";
        const wrapClass = "mt-4 bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 overflow-auto max-h-[400px]";
        
        if (expandedCard === 'monthlyTuition' || expandedCard === 'accrualRevenue') {
            const items = expandedCard === 'monthlyTuition' ? detailData.monthlyTuition : detailData.accrualRevenue;
            return (
                <div className={wrapClass}>
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th className={`${headerClass} py-2 px-3`}>Học viên</th>
                                <th className={`${headerClass} py-2 px-3`}>Tháng học</th>
                                <th className={`${headerClass} py-2 px-3`}>Ngày chốt</th>
                                <th className={`${headerClass} py-2 px-3 text-right`}>Số tiền</th>
                                <th className={`${headerClass} py-2 px-3`}>Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700">
                            {items.map(inv => (
                                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className={cellClass}>{inv.studentName}</td>
                                    <td className={cellClass}>{inv.month}</td>
                                    <td className={cellClass}>{inv.generatedDate}</td>
                                    <td className={`${cellClass} text-right font-medium`}>{fmt(inv.amount)} ₫</td>
                                    <td className={cellClass}>
                                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${inv.status === 'PAID' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                                            {inv.status === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="sticky bottom-0 bg-slate-100 dark:bg-slate-700 font-bold">
                            <tr>
                                <td className="py-2 px-3 text-sm" colSpan={3}>Tổng ({items.length} hóa đơn)</td>
                                <td className="py-2 px-3 text-sm text-right">{fmt(items.reduce((s, i) => s + i.amount, 0))} ₫</td>
                                <td className="py-2 px-3 text-sm">{items.filter(i => i.status === 'PAID').length} đã thu</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            );
        }

        if (expandedCard === 'cashRevenue') {
            const items = detailData.cashRevenue;
            return (
                <div className={wrapClass}>
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th className={`${headerClass} py-2 px-3`}>Ngày</th>
                                <th className={`${headerClass} py-2 px-3`}>Học viên</th>
                                <th className={`${headerClass} py-2 px-3`}>Loại</th>
                                <th className={`${headerClass} py-2 px-3`}>Ghi chú</th>
                                <th className={`${headerClass} py-2 px-3 text-right`}>Số tiền</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700">
                            {items.map(t => {
                                const student = state.students.find(s => s.id === t.studentId);
                                return (
                                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <td className={cellClass}>{t.date.substring(0, 10)}</td>
                                        <td className={cellClass}>{student?.name || t.studentId}</td>
                                        <td className={cellClass}>{t.type === 'PAYMENT' ? 'Thanh toán' : t.type === 'ADJUSTMENT_CREDIT' ? 'Điều chỉnh +' : t.type}</td>
                                        <td className={`${cellClass} max-w-[200px] truncate`}>{t.description || ''}</td>
                                        <td className={`${cellClass} text-right font-medium text-green-600`}>+{fmt(t.amount)} ₫</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="sticky bottom-0 bg-slate-100 dark:bg-slate-700 font-bold">
                            <tr>
                                <td className="py-2 px-3 text-sm" colSpan={4}>Tổng ({items.length} giao dịch)</td>
                                <td className="py-2 px-3 text-sm text-right">{fmt(items.reduce((s, t) => s + t.amount, 0))} ₫</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            );
        }

        if (expandedCard === 'expenses') {
            const items = detailData.expenses;
            return (
                <div className={wrapClass}>
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th className={`${headerClass} py-2 px-3`}>Ngày</th>
                                <th className={`${headerClass} py-2 px-3`}>Danh mục</th>
                                <th className={`${headerClass} py-2 px-3`}>Mô tả</th>
                                <th className={`${headerClass} py-2 px-3 text-right`}>Số tiền</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700">
                            {items.map(e => (
                                <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className={cellClass}>{e.date}</td>
                                    <td className={cellClass}>{e.category || 'Khác'}</td>
                                    <td className={`${cellClass} max-w-[250px] truncate`}>{e.description}</td>
                                    <td className={`${cellClass} text-right font-medium text-orange-600`}>{fmt(e.amount)} ₫</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="sticky bottom-0 bg-slate-100 dark:bg-slate-700 font-bold">
                            <tr>
                                <td className="py-2 px-3 text-sm" colSpan={3}>Tổng ({items.length} khoản chi)</td>
                                <td className="py-2 px-3 text-sm text-right">{fmt(items.reduce((s, e) => s + e.amount, 0))} ₫</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            );
        }

        if (expandedCard === 'otherIncome') {
            const items = detailData.otherIncome;
            return (
                <div className={wrapClass}>
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th className={`${headerClass} py-2 px-3`}>Ngày</th>
                                <th className={`${headerClass} py-2 px-3`}>Danh mục</th>
                                <th className={`${headerClass} py-2 px-3`}>Mô tả</th>
                                <th className={`${headerClass} py-2 px-3 text-right`}>Số tiền</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700">
                            {items.map(i => (
                                <tr key={i.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className={cellClass}>{i.date}</td>
                                    <td className={cellClass}>{i.category || 'Khác'}</td>
                                    <td className={`${cellClass} max-w-[250px] truncate`}>{i.description}</td>
                                    <td className={`${cellClass} text-right font-medium text-cyan-600`}>{fmt(i.amount)} ₫</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="sticky bottom-0 bg-slate-100 dark:bg-slate-700 font-bold">
                            <tr>
                                <td className="py-2 px-3 text-sm" colSpan={3}>Tổng ({items.length} khoản thu)</td>
                                <td className="py-2 px-3 text-sm text-right">{fmt(items.reduce((s, i) => s + i.amount, 0))} ₫</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            );
        }

        if (expandedCard === 'receivables' || expandedCard === 'credit') {
            const items = expandedCard === 'receivables' ? detailData.receivables : detailData.credit;
            const isDebt = expandedCard === 'receivables';
            return (
                <div className={wrapClass}>
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th className={`${headerClass} py-2 px-3`}>Mã HV</th>
                                <th className={`${headerClass} py-2 px-3`}>Họ tên</th>
                                <th className={`${headerClass} py-2 px-3`}>Lớp</th>
                                <th className={`${headerClass} py-2 px-3 text-right`}>{isDebt ? 'Số nợ' : 'Số dư'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700">
                            {items.map(s => (
                                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className={cellClass}>{s.id}</td>
                                    <td className={cellClass}>{s.name}</td>
                                    <td className={`${cellClass} max-w-[200px] truncate`}>
                                        {state.classes.filter(c => c.studentIds?.includes(s.id)).map(c => c.name).join(', ') || '—'}
                                    </td>
                                    <td className={`${cellClass} text-right font-medium ${isDebt ? 'text-red-600' : 'text-indigo-600'}`}>
                                        {isDebt ? `-${fmt(Math.abs(s.balance))}` : fmt(s.balance)} ₫
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="sticky bottom-0 bg-slate-100 dark:bg-slate-700 font-bold">
                            <tr>
                                <td className="py-2 px-3 text-sm" colSpan={3}>Tổng ({items.length} học viên)</td>
                                <td className="py-2 px-3 text-sm text-right">{fmt(items.reduce((s, st) => s + Math.abs(st.balance), 0))} ₫</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            );
        }

        return null;
    };
    
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card 
                    title={`Học phí theo tháng học`} 
                    value={`${financialSummary.monthlyTuition.toLocaleString('vi-VN')} ₫`} 
                    icon={ICONS.finance} 
                    color="text-purple-600 dark:text-purple-400"
                    subtitle={`Đã thu: ${financialSummary.monthlyPaidAmount.toLocaleString('vi-VN')} ₫ (${financialSummary.monthlyPaidCount}/${financialSummary.monthlyInvoiceCount} HĐ)`}
                    onClick={() => toggleCard('monthlyTuition')}
                />
                <Card title={`Doanh thu ghi nhận (Hóa đơn)`} value={`${financialSummary.accrualRevenue.toLocaleString('vi-VN')} ₫`} icon={ICONS.reports} color="text-blue-600 dark:text-blue-400" onClick={() => toggleCard('accrualRevenue')} />
                <Card 
                    title={`Tổng Thực thu (Tiền mặt)`} 
                    value={`${financialSummary.cashRevenue.toLocaleString('vi-VN')} ₫`} 
                    icon={ICONS.finance} 
                    color="text-green-600 dark:text-green-400"
                    onClick={() => toggleCard('cashRevenue')}
                />
                <Card 
                    title={`Dòng tiền (Thu - Chi)`} 
                    value={`${financialSummary.cashFlow.toLocaleString('vi-VN')} ₫`} 
                    icon={ICONS.dashboard} 
                    color={financialSummary.cashFlow >= 0 ? "text-teal-600 dark:text-teal-400" : "text-red-600 dark:text-red-400"}
                    onClick={() => toggleCard('cashFlow')}
                />
            </div>
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card title={`Tổng chi phí`} value={`${financialSummary.totalExpenses.toLocaleString('vi-VN')} ₫`} icon={ICONS.logout} color="text-orange-600 dark:text-orange-400" onClick={() => toggleCard('expenses')} />
                <Card title={`Thu khác`} value={`${financialSummary.otherIncome.toLocaleString('vi-VN')} ₫`} icon={ICONS.plus} color="text-cyan-600 dark:text-cyan-400" onClick={() => toggleCard('otherIncome')} />
                <Card title={`Tổng nợ phải thu (Hiện tại)`} value={`${financialSummary.totalReceivables.toLocaleString('vi-VN')} ₫`} icon={ICONS.students} color="text-red-500 dark:text-red-400" onClick={() => toggleCard('receivables')} />
                <Card title={`Số dư ví học viên (Hiện tại)`} value={`${financialSummary.totalCredit.toLocaleString('vi-VN')} ₫`} icon={ICONS.checkCircle} color="text-indigo-500 dark:text-indigo-400" onClick={() => toggleCard('credit')} />
            </div>

            {expandedCard && (
                <div>
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                            📋 Chi tiết: {expandedCard === 'monthlyTuition' ? 'Học phí theo tháng học' : expandedCard === 'accrualRevenue' ? 'Doanh thu ghi nhận (Hóa đơn)' : expandedCard === 'cashRevenue' ? 'Thực thu (Tiền mặt)' : expandedCard === 'cashFlow' ? 'Dòng tiền' : expandedCard === 'expenses' ? 'Chi phí' : expandedCard === 'otherIncome' ? 'Thu khác' : expandedCard === 'receivables' ? 'Nợ phải thu' : 'Số dư ví'}
                        </h3>
                        <button onClick={() => setExpandedCard(null)} className="text-sm text-slate-500 hover:text-red-500 transition-colors">✕ Đóng</button>
                    </div>
                    {expandedCard === 'cashFlow' ? (
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Dòng tiền = Tổng thực thu ({fmt(financialSummary.cashRevenue)} ₫) − Tổng chi phí ({fmt(financialSummary.totalExpenses)} ₫) = <strong className={financialSummary.cashFlow >= 0 ? 'text-teal-600' : 'text-red-600'}>{fmt(financialSummary.cashFlow)} ₫</strong>. Nhấn vào "Tổng Thực thu" hoặc "Tổng chi phí" để xem chi tiết.</p>
                    ) : renderDetail()}
                </div>
            )}
        </div>
    )
}

export const FinanceScreen: React.FC = () => {
    const { role } = useAuth();
    const location = useLocation();
    
    const [activeTab, setActiveTab] = useState<FinanceTab>(role === UserRole.TEACHER ? 'my_payroll' : 'overview');
    
    // Default to current month
    const today = new Date();
    const startOfMonth = toLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1));
    const endOfMonth = toLocalDateString(new Date(today.getFullYear(), today.getMonth() + 1, 0));

    const [startDate, setStartDate] = useState(startOfMonth);
    const [endDate, setEndDate] = useState(endOfMonth);
    
    useEffect(() => {
        if (location.state?.defaultTab) {
            setActiveTab(location.state.defaultTab);
        }
    }, [location.state]);

    const setPeriod = (type: 'this_month' | 'last_month' | 'this_year') => {
        const now = new Date();
        let start, end;
        switch (type) {
            case 'this_month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'last_month':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'this_year':
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date(now.getFullYear(), 11, 31);
                break;
        }
        setStartDate(toLocalDateString(start));
        setEndDate(toLocalDateString(end));
    };


    const TabButton: React.FC<{ tabId: FinanceTab; children: React.ReactNode, hidden?: boolean }> = ({ tabId, children, hidden }) => {
        if (hidden) return null;
        return (
            <button
                onClick={() => setActiveTab(tabId)}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tabId ? 'bg-primary text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
            >
                {children}
            </button>
        );
    }
    
    const canManageFullFinance = role === UserRole.ADMIN || role === UserRole.MANAGER || role === UserRole.ACCOUNTANT;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Quản lý Tài chính</h1>

            <div className="flex flex-wrap items-center gap-2 border-b dark:border-gray-700 pb-2">
                <TabButton tabId="overview" hidden={!canManageFullFinance}>Tổng quan</TabButton>
                <TabButton tabId="invoices" hidden={!canManageFullFinance}>Hóa đơn</TabButton>
                <TabButton tabId="debt_report" hidden={!canManageFullFinance}>Công nợ</TabButton>
                <TabButton tabId="income" hidden={!canManageFullFinance}>Thu khác</TabButton>
                <TabButton tabId="expenses" hidden={!canManageFullFinance}>Chi phí</TabButton>
                <TabButton tabId="payroll" hidden={!canManageFullFinance}>Bảng lương</TabButton>
                <TabButton tabId="my_payroll" hidden={role !== UserRole.TEACHER}>Bảng lương của tôi</TabButton>
            </div>
            
            {(activeTab === 'overview') && (
                <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border dark:border-slate-700">
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium whitespace-nowrap">Từ:</span>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-input py-1 px-2 text-sm w-36" />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium whitespace-nowrap">Đến:</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="form-input py-1 px-2 text-sm w-36" />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setPeriod('this_month')} className="px-3 py-1 text-xs font-medium bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors">Tháng này</button>
                        <button onClick={() => setPeriod('last_month')} className="px-3 py-1 text-xs font-medium bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors">Tháng trước</button>
                        <button onClick={() => setPeriod('this_year')} className="px-3 py-1 text-xs font-medium bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors">Năm nay</button>
                    </div>
                </div>
            )}

            <div>
                {activeTab === 'overview' && canManageFullFinance && <OverviewTab startDate={startDate} endDate={endDate} />}
                {activeTab === 'invoices' && canManageFullFinance && <InvoicesTab />}
                {activeTab === 'debt_report' && canManageFullFinance && <UnpaidStudentsReport />}
                {activeTab === 'income' && canManageFullFinance && <IncomeTab />}
                {activeTab === 'expenses' && canManageFullFinance && <ExpenseTab />}
                {activeTab === 'payroll' && canManageFullFinance && <PayrollTab period={'this_month'} />}
                {activeTab === 'my_payroll' && role === UserRole.TEACHER && <TeacherPayrollTab />}
            </div>
        </div>
    );
};
