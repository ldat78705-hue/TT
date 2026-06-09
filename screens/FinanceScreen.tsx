
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

const OverviewTab: React.FC<{startDate: string, endDate: string}> = ({startDate, endDate}) => {
    const { state } = useData();

    const financialSummary = useMemo(() => {
        // 1. Doanh thu ghi nhận (Accrual Revenue): Từ hóa đơn đã tạo trong khoảng thời gian
        const accrualRevenue = state.invoices
            .filter(i => i.generatedDate >= startDate && i.generatedDate <= endDate && i.status !== 'CANCELLED')
            .reduce((sum, i) => sum + i.amount, 0);

        // 2. Thực thu từ Học phí (Cash Tuition): Từ giao dịch thanh toán thực tế trong khoảng thời gian
        const tuitionCollected = state.transactions
            .filter(t => t.date.substring(0, 10) >= startDate && t.date.substring(0, 10) <= endDate && t.amount > 0)
            .reduce((sum, t) => sum + t.amount, 0);
        
        // 3. Thực thu từ Nguồn khác (Other Income) trong khoảng thời gian
        const otherIncome = state.income
            .filter(i => i.date >= startDate && i.date <= endDate)
            .reduce((sum, i) => sum + i.amount, 0);

        // Tổng thực thu (Cash Revenue)
        const cashRevenue = tuitionCollected + otherIncome;
        
        // 4. Tổng chi phí (Total Expenses): Bao gồm lương và chi phí khác trong khoảng thời gian
        const totalExpenses = state.expenses
            .filter(e => e.date >= startDate && e.date <= endDate)
            .reduce((sum, e) => sum + e.amount, 0);
        
        // 5. Công nợ & Số dư ví (Tính tại thời điểm hiện tại, không theo kỳ lịch sử)
        const totalReceivables = state.students
            .filter(s => s.balance < 0)
            .reduce((sum, s) => sum + s.balance, 0);

        const totalCredit = state.students
            .filter(s => s.balance > 0)
            .reduce((sum, s) => sum + s.balance, 0);

        return {
            accrualRevenue,
            cashRevenue,
            totalExpenses,
            cashFlow: cashRevenue - totalExpenses,
            totalReceivables: Math.abs(totalReceivables),
            totalCredit,
            otherIncome
        };
    }, [state.invoices, state.transactions, state.expenses, state.students, state.income, startDate, endDate]);
    
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card title={`Doanh thu ghi nhận (Hóa đơn)`} value={`${financialSummary.accrualRevenue.toLocaleString('vi-VN')} ₫`} icon={ICONS.reports} color="text-blue-600 dark:text-blue-400" />
                <Card 
                    title={`Tổng Thực thu (Tiền mặt)`} 
                    value={`${financialSummary.cashRevenue.toLocaleString('vi-VN')} ₫`} 
                    icon={ICONS.finance} 
                    color="text-green-600 dark:text-green-400" 
                />
                <Card 
                    title={`Dòng tiền (Thu - Chi)`} 
                    value={`${financialSummary.cashFlow.toLocaleString('vi-VN')} ₫`} 
                    icon={ICONS.dashboard} 
                    color={financialSummary.cashFlow >= 0 ? "text-teal-600 dark:text-teal-400" : "text-red-600 dark:text-red-400"} 
                />
            </div>
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card title={`Tổng chi phí`} value={`${financialSummary.totalExpenses.toLocaleString('vi-VN')} ₫`} icon={ICONS.logout} color="text-orange-600 dark:text-orange-400" />
                <Card title={`Thu khác`} value={`${financialSummary.otherIncome.toLocaleString('vi-VN')} ₫`} icon={ICONS.plus} color="text-cyan-600 dark:text-cyan-400" />
                <Card title={`Tổng nợ phải thu (Hiện tại)`} value={`${financialSummary.totalReceivables.toLocaleString('vi-VN')} ₫`} icon={ICONS.students} color="text-red-500 dark:text-red-400" />
                <Card title={`Số dư ví học viên (Hiện tại)`} value={`${financialSummary.totalCredit.toLocaleString('vi-VN')} ₫`} icon={ICONS.checkCircle} color="text-indigo-500 dark:text-indigo-400" />
            </div>
        </div>
    )
}

export const FinanceScreen: React.FC = () => {
    const { role } = useAuth();
    const location = useLocation();
    
    const [activeTab, setActiveTab] = useState<FinanceTab>('overview');
    
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
    
    const canManageFullFinance = role === UserRole.ADMIN || role === UserRole.ACCOUNTANT;

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
