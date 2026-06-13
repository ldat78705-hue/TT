import React, { useState, useMemo } from 'react';
import { useData } from '../hooks/useDataContext';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import { LineChart } from '../components/common/LineChart';
import { PieChart } from '../components/common/PieChart';
import { AttendanceStatus, FeeType, TransactionType, PersonStatus } from '../types';
import { ReportDetailModal } from '../components/reports/ReportDetailModal';
import { AttendanceReportTab } from '../components/reports/AttendanceReportTab';
import { WebhookReportTab } from '../components/reports/WebhookReportTab';
import { AbsentStudentsReportTab } from '../components/reports/AbsentStudentsReportTab';
import { TransactionHistoryReportTab } from '../components/reports/TransactionHistoryReportTab';
import { TaxReportTab } from '../components/reports/TaxReportTab';
import { PeriodComparisonTab } from '../components/reports/PeriodComparisonTab';

const toLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

type ReportTab = 'overview' | 'comparison' | 'attendance' | 'absent' | 'transactions' | 'tax' | 'webhook';

import { formatVietnamDate, getVietnamTime } from '../utils/date';
import { exportFullData } from '../services/api';
import { useToast } from '../context/ToastContext';

export const ReportsScreen: React.FC = () => {
    const { state } = useData();
    const { showToast } = useToast();
    const { students, classes, invoices, income, expenses, attendance, transactions } = state;
    
    // State cho khoảng thời gian tùy chỉnh
    const [startDate, setStartDate] = useState(() => {
        const vnDate = new Date(getVietnamTime());
        return toLocalDateString(new Date(vnDate.getFullYear(), vnDate.getMonth(), 1));
    });
    const [endDate, setEndDate] = useState(() => {
        const vnDate = new Date(getVietnamTime());
        return toLocalDateString(new Date(vnDate.getFullYear(), vnDate.getMonth() + 1, 0));
    });
    
    const [classFilter, setClassFilter] = useState('all');
    const [activeTab, setActiveTab] = useState<ReportTab>('overview');
    const [detailModal, setDetailModal] = useState<{
        isOpen: boolean;
        title: string;
        items: { description: string; date: string; amount?: number; type?: 'credit' | 'debit' }[];
    }>({ isOpen: false, title: '', items: [] });

    const filteredStudentIds = useMemo(() => {
        if (classFilter === 'all') {
            return null; // Represents all students
        }
        const selectedClass = classes.find(c => c.id === classFilter);
        return new Set(selectedClass?.studentIds || []);
    }, [classFilter, classes]);

    // Helper: Nhóm dữ liệu cho biểu đồ đường
    const trendAnalytics = useMemo(() => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        const isDaily = diffDays <= 32;

        const dataMap = new Map<string, { revenue: number, expense: number }>();

        // Init map keys
        if (isDaily) {
            let loop = new Date(start);
            while (loop <= end) {
                const key = toLocalDateString(loop);
                dataMap.set(key, { revenue: 0, expense: 0 });
                loop.setDate(loop.getDate() + 1);
            }
        } else {
            let loop = new Date(start);
            // Set to first day of month to avoid skipping months
            loop.setDate(1); 
            while (loop <= end) {
                const key = loop.toISOString().slice(0, 7); // YYYY-MM
                if (!dataMap.has(key)) dataMap.set(key, { revenue: 0, expense: 0 });
                loop.setMonth(loop.getMonth() + 1);
            }
        }

        // Fill Data
        // 1. Revenue from Transactions (Tuition)
        transactions.forEach(t => {
            if (t.date.substring(0, 10) >= startDate && t.date.substring(0, 10) <= endDate) {
                const isPayment = t.type === TransactionType.PAYMENT || t.type === TransactionType.ADJUSTMENT_CREDIT;
                const isNotRefund = !t.description.toLowerCase().includes('hủy hóa đơn');
                const studentIsInClass = filteredStudentIds ? filteredStudentIds.has(t.studentId) : true;

                if (isPayment && isNotRefund && t.amount > 0 && studentIsInClass) {
                    const key = isDaily ? t.date.substring(0, 10) : t.date.slice(0, 7);
                    if (dataMap.has(key)) {
                        dataMap.get(key)!.revenue += t.amount;
                    }
                }
            }
        });

        // 2. Revenue from Other Income (Only if not filtering by class)
        if (!filteredStudentIds) {
            income.forEach(inc => {
                if (inc.date >= startDate && inc.date <= endDate) {
                    const key = isDaily ? inc.date : inc.date.slice(0, 7);
                    if (dataMap.has(key)) {
                        dataMap.get(key)!.revenue += inc.amount;
                    }
                }
            });
        }

        // 3. Expenses (Global)
        expenses.forEach(exp => {
            if (exp.date >= startDate && exp.date <= endDate) {
                const key = isDaily ? exp.date : exp.date.slice(0, 7);
                if (dataMap.has(key)) {
                    dataMap.get(key)!.expense += exp.amount;
                }
            }
        });

        // Convert Map to Array for Chart
        return Array.from(dataMap.entries()).map(([label, values]) => {
            // Format label
            let displayLabel = label;
            if (isDaily) {
                // FIXED: Ignored first element 'y' to prevent TS unused var error
                const [, m, d] = label.split('-');
                displayLabel = `${d}/${m}`;
            } else {
                const [y, m] = label.split('-');
                displayLabel = `T${m}/${y}`;
            }
            return {
                label: displayLabel,
                values: [values.revenue, values.expense]
            };
        });

    }, [transactions, income, expenses, startDate, endDate, filteredStudentIds]);


    // KPIs trong khoảng thời gian đã chọn
    const periodKpiData = useMemo(() => {
        const tuitionFeesCollected = transactions
            .filter(t => {
                const isPayment = t.type === TransactionType.PAYMENT || t.type === TransactionType.ADJUSTMENT_CREDIT;
                const isWithinPeriod = t.date.substring(0, 10) >= startDate && t.date.substring(0, 10) <= endDate;
                const isNotRefund = !t.description.toLowerCase().includes('hủy hóa đơn');
                const studentIsInClass = filteredStudentIds ? filteredStudentIds.has(t.studentId) : true;
                return isPayment && isWithinPeriod && isNotRefund && t.amount > 0 && studentIsInClass;
            })
            .reduce((sum, t) => sum + t.amount, 0);

        const otherIncome = income
            .filter(i => i.date >= startDate && i.date <= endDate)
            .reduce((sum, i) => sum + i.amount, 0);

        // Revenue depends on filter
        const totalRevenue = tuitionFeesCollected + (filteredStudentIds ? 0 : otherIncome);
        
        // Expenses are always global
        const totalExpense = expenses
            .filter(e => e.date >= startDate && e.date <= endDate)
            .reduce((sum, e) => sum + e.amount, 0);

        let provisionalTuitionFee = 0;
        
        // Count attendance within the period
        const periodAttendance = attendance.filter(a => 
            a.date >= startDate && a.date <= endDate &&
            (a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.LATE || a.status === AttendanceStatus.UNEXCUSED_ABSENT)
        );
        
        const attendanceCountMap = new Map<string, number>();
        periodAttendance.forEach(a => {
            const key = `${a.studentId}-${a.classId}`;
            attendanceCountMap.set(key, (attendanceCountMap.get(key) || 0) + 1);
        });
        
        const studentsForProvisional = students.filter(s => 
            (s.status === PersonStatus.ACTIVE) && 
            (filteredStudentIds ? filteredStudentIds.has(s.id) : true)
        );
        const activeStudentIds = new Set(studentsForProvisional.map(s => s.id));
        
        const classesToCalculate = filteredStudentIds ? classes.filter(c => c.id === classFilter) : classes;

        classesToCalculate.forEach(c => {
            const activeStudentsInClass = c.studentIds.filter(id => activeStudentIds.has(id));

            if (c.fee.type === FeeType.MONTHLY) {
                provisionalTuitionFee += activeStudentsInClass.length * c.fee.amount;
            } else if (c.fee.type === FeeType.PER_SESSION) {
                activeStudentsInClass.forEach(studentId => {
                    const key = `${studentId}-${c.id}`;
                    const attendedSessions = attendanceCountMap.get(key) || 0;
                    provisionalTuitionFee += attendedSessions * c.fee.amount;
                });
            }
        });

        // New Students within period
        const newStudents = students.filter(s => 
            s.createdAt >= startDate && s.createdAt <= endDate &&
            (filteredStudentIds ? filteredStudentIds.has(s.id) : true)
        ).length;

        // Inactive Students within period
        const inactiveStudents = students.filter(s => 
            s.status === PersonStatus.INACTIVE &&
            s.statusChangedAt && s.statusChangedAt >= startDate && s.statusChangedAt <= endDate &&
            (filteredStudentIds ? filteredStudentIds.has(s.id) : true)
        ).length;

        return {
            totalRevenue,
            totalExpense: totalExpense,
            profit: totalRevenue - totalExpense,
            tuitionFeesCollected,
            provisionalTuitionFee,
            newStudents,
            inactiveStudents
        };
    }, [invoices, income, expenses, students, classes, attendance, transactions, startDate, endDate, classFilter, filteredStudentIds]);
    

    const revenueByClass = useMemo(() => {
        const revenueMap = new Map<string, number>();
        const paidInvoices = invoices.filter(inv => 
            inv.status === 'PAID' && 
            inv.paidDate && inv.paidDate >= startDate && inv.paidDate <= endDate &&
            (filteredStudentIds ? filteredStudentIds.has(inv.studentId) : true)
        );

        paidInvoices.forEach(invoice => {
            const studentClasses = classes.filter(c => (c.studentIds || []).includes(invoice.studentId));
            if (studentClasses.length > 0) {
                const amountPerClass = invoice.amount / studentClasses.length;
                studentClasses.forEach(c => {
                    revenueMap.set(c.name, (revenueMap.get(c.name) || 0) + amountPerClass);
                });
            }
        });
        
        let finalData = Array.from(revenueMap.entries())
            .map(([label, value]) => ({ label, value, color: '' }))
            .sort((a,b) => b.value - a.value);

        if (classFilter !== 'all') {
            finalData = finalData.filter(d => {
                const cls = classes.find(c => c.id === classFilter);
                return cls?.name === d.label;
            });
        }
        
        return finalData;

    }, [invoices, classes, startDate, endDate, classFilter, filteredStudentIds]);
    
    // --- Detail Modal Handlers ---

    const handleShowProvisionalTuitionDetails = () => {
        const items: { description: string; date: string; amount: number; type: 'credit' }[] = [];

        // Logic tương tự periodKpiData nhưng push vào items
        const periodAttendance = attendance.filter(a => 
            a.date >= startDate && a.date <= endDate &&
            (a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.LATE || a.status === AttendanceStatus.UNEXCUSED_ABSENT)
        );
        const attendanceCountMap = new Map<string, number>();
        periodAttendance.forEach(a => {
            const key = `${a.studentId}-${a.classId}`;
            attendanceCountMap.set(key, (attendanceCountMap.get(key) || 0) + 1);
        });
        
        const activeStudents = students.filter(s => s.status === PersonStatus.ACTIVE && (filteredStudentIds ? filteredStudentIds.has(s.id) : true));
        const studentMap = new Map(students.map(s => [s.id, s.name]));
        const classesToCalculate = filteredStudentIds ? classes.filter(c => c.id === classFilter) : classes;

        classesToCalculate.forEach(c => {
            const activeStudentsInClass = c.studentIds.filter(id => activeStudents.some(s => s.id === id));
            activeStudentsInClass.forEach(studentId => {
                const studentName = studentMap.get(studentId) || 'Không rõ';
                if (c.fee.type === FeeType.MONTHLY) {
                    items.push({
                        description: `[${c.name}] ${studentName} (HP tháng)`,
                        date: `${startDate} -> ${endDate}`,
                        amount: c.fee.amount,
                        type: 'credit'
                    });
                } else if (c.fee.type === FeeType.PER_SESSION) {
                    const key = `${studentId}-${c.id}`;
                    const attendedSessions = attendanceCountMap.get(key) || 0;
                    if (attendedSessions > 0) {
                        items.push({
                            description: `[${c.name}] ${studentName} (${attendedSessions} buổi)`,
                            date: `${startDate} -> ${endDate}`,
                            amount: attendedSessions * c.fee.amount,
                            type: 'credit'
                        });
                    }
                }
            });
        });

        setDetailModal({
            isOpen: true,
            title: `Chi tiết Học phí Tạm tính`,
            items: items.sort((a,b) => a.description.localeCompare(b.description))
        });
    };

    const handleShowRevenueDetails = () => {
        const relevantTransactions = transactions
            .filter(t => {
                const isPayment = t.type === TransactionType.PAYMENT || t.type === TransactionType.ADJUSTMENT_CREDIT;
                const isWithin = t.date.substring(0, 10) >= startDate && t.date.substring(0, 10) <= endDate;
                const isNotRefund = !t.description.toLowerCase().includes('hủy hóa đơn');
                const studentIsInClass = filteredStudentIds ? filteredStudentIds.has(t.studentId) : true;
                return isPayment && isWithin && isNotRefund && t.amount > 0 && studentIsInClass;
            });
        
        const relevantIncome = classFilter === 'all' ? income
            .filter(i => i.date >= startDate && i.date <= endDate) : [];

        // Combine into a raw array to sort by date then by ID to handle same-day order
        const combined = [
            ...relevantTransactions.map(t => ({ ...t, kind: 'transaction' as const })),
            ...relevantIncome.map(i => ({ ...i, kind: 'income' as const }))
        ];

        // Sort descending by date (Newest first). If same date, sort by ID descending (Last entered first).
        combined.sort((a, b) => {
            const timeA = new Date(a.date).getTime();
            const timeB = new Date(b.date).getTime();
            if (timeA !== timeB) return timeB - timeA;
            return b.id.localeCompare(a.id);
        });

        const items = combined.map(item => {
            if (item.kind === 'transaction') {
                const studentName = students.find(s => s.id === item.studentId)?.name || 'Không rõ';
                return {
                    description: `[HP] ${studentName} - ${item.description}`,
                    date: formatVietnamDate(item.date),
                    amount: item.amount,
                    type: 'credit' as const
                };
            } else {
                return {
                    description: `[Thu khác] ${item.description}`,
                    date: formatVietnamDate(item.date),
                    amount: item.amount,
                    type: 'credit' as const
                };
            }
        });

        setDetailModal({ isOpen: true, title: `Chi tiết Doanh thu`, items });
    };

    const handleShowExpenseDetails = () => {
        const items = expenses
            .filter(e => e.date >= startDate && e.date <= endDate)
            .sort((a, b) => {
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                if (dateA !== dateB) return dateB - dateA;
                return b.id.localeCompare(a.id);
            })
            .map(e => ({
                description: e.description,
                date: formatVietnamDate(e.date),
                amount: e.amount,
                type: 'debit' as const
            }));

        setDetailModal({ isOpen: true, title: `Chi tiết Chi phí`, items });
    };

    const handleShowNewStudentsDetails = () => {
        const items = students
            .filter(s => s.createdAt >= startDate && s.createdAt <= endDate && (filteredStudentIds ? filteredStudentIds.has(s.id) : true))
            .sort((a, b) => {
                const dateA = new Date(a.createdAt).getTime();
                const dateB = new Date(b.createdAt).getTime();
                if (dateA !== dateB) return dateB - dateA;
                return b.id.localeCompare(a.id);
            })
            .map(s => ({
                description: s.name,
                date: formatVietnamDate(s.createdAt),
            }));

        setDetailModal({ isOpen: true, title: `Chi tiết Học viên mới`, items });
    };

    const handleShowInactiveStudentsDetails = () => {
        const items = students
            .filter(s => s.status === PersonStatus.INACTIVE && s.statusChangedAt && s.statusChangedAt >= startDate && s.statusChangedAt <= endDate && (filteredStudentIds ? filteredStudentIds.has(s.id) : true))
            .sort((a, b) => {
                const dateA = new Date(a.statusChangedAt!).getTime();
                const dateB = new Date(b.statusChangedAt!).getTime();
                if (dateA !== dateB) return dateB - dateA;
                return b.id.localeCompare(a.id);
            })
            .map(s => ({
                description: s.name,
                date: formatVietnamDate(s.statusChangedAt!),
            }));

        setDetailModal({ isOpen: true, title: `Chi tiết Học viên tạm nghỉ`, items });
    };
    
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

    const TabButton: React.FC<{ tabId: ReportTab; children: React.ReactNode }> = ({ tabId, children }) => (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`whitespace-nowrap px-3 sm:px-4 py-2 font-semibold text-sm rounded-md transition-colors ${activeTab === tabId ? 'bg-primary text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
        >
            {children}
        </button>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-3xl font-bold">Báo cáo & Phân tích</h1>
                <button 
                    onClick={async () => {
                        try {
                            showToast('Đang tạo báo cáo Excel, vui lòng đợi...', 'info');
                            await exportFullData();
                            showToast('Xuất báo cáo thành công', 'success');
                        } catch (e) {
                            showToast('Lỗi xuất dữ liệu', 'error');
                        }
                    }}
                    className="btn-primary flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Xuất Excel Toàn thời gian
                </button>
            </div>
            
            {/* Filter Section */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border dark:border-slate-700">
                <div className="flex items-center gap-2 flex-wrap">
                    <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="form-select py-1 px-2 text-sm w-40">
                        <option value="all">Tất cả các lớp</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
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
            
            <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="flex flex-wrap items-center gap-2 pb-2" aria-label="Tabs">
                    <TabButton tabId="overview">Tổng quan Tài chính</TabButton>
                    <TabButton tabId="comparison">So sánh kỳ</TabButton>
                    <TabButton tabId="attendance">Báo cáo Chuyên cần</TabButton>
                    <TabButton tabId="absent">Học sinh nghỉ học</TabButton>
                    <TabButton tabId="transactions">Lịch sử Giao dịch</TabButton>
                    <TabButton tabId="webhook">Thanh toán tự động</TabButton>
                    <TabButton tabId="tax">Báo cáo Thuế</TabButton>
                </nav>
            </div>

            <div>
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                            <div className="cursor-pointer transition-transform hover:scale-105" onClick={handleShowProvisionalTuitionDetails}>
                                <Card title={`HP Tạm tính (Kỳ)`} value={`${periodKpiData.provisionalTuitionFee.toLocaleString('vi-VN')} ₫`} icon={ICONS.calendar} color="text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="cursor-pointer transition-transform hover:scale-105" onClick={handleShowRevenueDetails}>
                                <Card title={`HP Đã thu (Kỳ)`} value={`${periodKpiData.tuitionFeesCollected.toLocaleString('vi-VN')} ₫`} icon={ICONS.checkCircle} color="text-teal-600 dark:text-teal-400" />
                            </div>
                            <div className="cursor-pointer transition-transform hover:scale-105" onClick={handleShowRevenueDetails}>
                                <Card title={`Tổng Doanh thu`} value={`${periodKpiData.totalRevenue.toLocaleString('vi-VN')} ₫`} icon={ICONS.finance} color="text-green-600 dark:text-green-400" />
                            </div>
                            <div className="cursor-pointer transition-transform hover:scale-105" onClick={handleShowExpenseDetails}>
                                <Card title={`Tổng Chi phí`} value={`${periodKpiData.totalExpense.toLocaleString('vi-VN')} ₫`} icon={ICONS.logout} color="text-red-600 dark:text-red-400" />
                            </div>
                            <div className="cursor-pointer transition-transform hover:scale-105" onClick={handleShowRevenueDetails}>
                                <Card title={`Lợi nhuận`} value={`${periodKpiData.profit.toLocaleString('vi-VN')} ₫`} icon={ICONS.reports} color="text-blue-600 dark:text-blue-400" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer transition-transform hover:scale-105" onClick={handleShowNewStudentsDetails}>
                                <p className="text-sm font-medium text-gray-500">Học viên mới trong kỳ</p>
                                <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{periodKpiData.newStudents}</p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer transition-transform hover:scale-105" onClick={handleShowInactiveStudentsDetails}>
                                <p className="text-sm font-medium text-gray-500">Học viên tạm nghỉ trong kỳ</p>
                                <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{periodKpiData.inactiveStudents}</p>
                            </div>
                        </div>

                        <div className="card-base">
                            <LineChart
                                title={`Xu hướng Tài chính`}
                                data={trendAnalytics}
                                series={[
                                    { name: 'Doanh thu', color: '#10b981' },
                                    { name: 'Chi phí', color: '#ef4444' },
                                ]}
                            />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="card-base">
                                <PieChart title={`Cơ cấu Doanh thu theo Lớp`} data={revenueByClass} />
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'comparison' && (
                    <PeriodComparisonTab />
                )}
                {activeTab === 'attendance' && (
                     <AttendanceReportTab 
                        startDate={startDate}
                        endDate={endDate}
                        classFilter={classFilter}
                    />
                )}
                {activeTab === 'absent' && (
                     <AbsentStudentsReportTab 
                        classFilter={classFilter}
                        startDate={startDate}
                        endDate={endDate}
                    />
                )}
                {activeTab === 'transactions' && (
                    <TransactionHistoryReportTab
                        startDate={startDate}
                        endDate={endDate}
                        classFilter={classFilter}
                    />
                )}
                {activeTab === 'webhook' && (
                    <WebhookReportTab
                        startDate={startDate}
                        endDate={endDate}
                        classFilter={classFilter}
                    />
                )}
                {activeTab === 'tax' && (
                    <TaxReportTab />
                )}
            </div>
            
            <ReportDetailModal 
                isOpen={detailModal.isOpen}
                onClose={() => setDetailModal({ isOpen: false, title: '', items: [] })}
                title={detailModal.title}
                items={detailModal.items}
            />
        </div>
    );
};