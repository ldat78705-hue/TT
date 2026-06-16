import React, { useMemo } from 'react';
import { Transaction, TransactionType, Income, Expense, AttendanceRecord, AttendanceStatus } from '../../types';
import { getVietnamTime } from '../../utils/date';

interface Props {
    transactions: Transaction[];
    income: Income[];
    expenses: Expense[];
    attendance: AttendanceRecord[];
}

const MONTHS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

export const DashboardCharts: React.FC<Props> = ({ transactions, income, expenses, attendance }) => {
    const today = new Date(getVietnamTime());
    const currentYear = today.getFullYear();

    // Revenue data: 12 months of current year
    const revenueData = useMemo(() => {
        const monthly = new Array(12).fill(0);

        // Tuition payments
        (transactions || []).forEach(t => {
            if (!t.date.startsWith(String(currentYear))) return;
            const m = parseInt(t.date.substring(5, 7)) - 1;
            if (t.type === TransactionType.PAYMENT || t.type === TransactionType.ADJUSTMENT_CREDIT) {
                if (!t.description.toLowerCase().includes('hủy hóa đơn') && t.amount > 0) {
                    monthly[m] += t.amount;
                }
            }
        });

        // Other income
        (income || []).forEach(i => {
            if (!i.date.startsWith(String(currentYear))) return;
            const m = parseInt(i.date.substring(5, 7)) - 1;
            monthly[m] += i.amount;
        });

        return monthly;
    }, [transactions, income, currentYear]);

    // Expense data: 12 months
    const expenseData = useMemo(() => {
        const monthly = new Array(12).fill(0);
        (expenses || []).forEach(e => {
            if (!e.date.startsWith(String(currentYear))) return;
            const m = parseInt(e.date.substring(5, 7)) - 1;
            monthly[m] += e.amount;
        });
        return monthly;
    }, [expenses, currentYear]);

    // Attendance rate: 12 months
    const attendanceData = useMemo(() => {
        const presentByMonth = new Array(12).fill(0);
        const totalByMonth = new Array(12).fill(0);

        (attendance || []).forEach(a => {
            if (!a.date.startsWith(String(currentYear))) return;
            const m = parseInt(a.date.substring(5, 7)) - 1;
            if (a.status !== AttendanceStatus.UNMARKED) {
                totalByMonth[m]++;
                if (a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.LATE) {
                    presentByMonth[m]++;
                }
            }
        });

        return Array.from({ length: 12 }, (_, i) =>
            totalByMonth[i] > 0 ? Math.round((presentByMonth[i] / totalByMonth[i]) * 100) : 0
        );
    }, [attendance, currentYear]);

    const maxRevenue = Math.max(...revenueData, ...expenseData, 1);
    const currentMonth = today.getMonth();

    const formatAmount = (amount: number) => {
        if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
        if (amount >= 1_000) return `${Math.round(amount / 1_000)}K`;
        return amount.toString();
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue vs Expense Bar Chart */}
            <div className="card-base">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold">📊 Thu - Chi {currentYear}</h2>
                    <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm bg-emerald-500"></span> Thu
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm bg-rose-400"></span> Chi
                        </span>
                    </div>
                </div>
                <div className="flex items-end gap-1 h-48">
                    {MONTHS.map((label, i) => {
                        const revH = maxRevenue > 0 ? (revenueData[i] / maxRevenue) * 100 : 0;
                        const expH = maxRevenue > 0 ? (expenseData[i] / maxRevenue) * 100 : 0;
                        const isCurrentMonth = i === currentMonth;
                        return (
                            <div key={label} className="flex-1 flex flex-col items-center gap-0.5 group relative" title={`${label}: Thu ${formatAmount(revenueData[i])} | Chi ${formatAmount(expenseData[i])}`}>
                                <div className="flex items-end gap-px w-full h-40">
                                    <div
                                        className={`flex-1 rounded-t-sm transition-all duration-300 ${isCurrentMonth ? 'bg-emerald-500' : 'bg-emerald-400/70'} group-hover:bg-emerald-500`}
                                        style={{ height: `${Math.max(revH, 2)}%` }}
                                    />
                                    <div
                                        className={`flex-1 rounded-t-sm transition-all duration-300 ${isCurrentMonth ? 'bg-rose-400' : 'bg-rose-300/70'} group-hover:bg-rose-400`}
                                        style={{ height: `${Math.max(expH, 2)}%` }}
                                    />
                                </div>
                                <span className={`text-[10px] ${isCurrentMonth ? 'font-bold text-primary' : 'text-gray-400'}`}>{label}</span>
                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-2 hidden group-hover:block z-20">
                                    <div className="bg-gray-900 text-white text-[10px] rounded-lg px-2 py-1.5 whitespace-nowrap shadow-lg">
                                        <p className="text-emerald-300">Thu: {revenueData[i].toLocaleString('vi-VN')}₫</p>
                                        <p className="text-rose-300">Chi: {expenseData[i].toLocaleString('vi-VN')}₫</p>
                                        <p className="text-gray-300 border-t border-gray-700 mt-1 pt-1">
                                            Lợi nhuận: {(revenueData[i] - expenseData[i]).toLocaleString('vi-VN')}₫
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {/* Summary bar */}
                <div className="flex justify-between mt-3 pt-3 border-t dark:border-gray-700 text-xs">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        Tổng thu: {revenueData.reduce((a, b) => a + b, 0).toLocaleString('vi-VN')}₫
                    </span>
                    <span className="text-rose-500 font-semibold">
                        Tổng chi: {expenseData.reduce((a, b) => a + b, 0).toLocaleString('vi-VN')}₫
                    </span>
                </div>
            </div>

            {/* Attendance Rate Line Chart */}
            <div className="card-base">
                <h2 className="text-lg font-bold mb-4">📈 Tỉ lệ chuyên cần {currentYear}</h2>
                <div className="relative h-48">
                    {/* Grid lines */}
                    {[0, 25, 50, 75, 100].map(val => (
                        <div key={val} className="absolute w-full border-t border-dashed border-gray-200 dark:border-gray-700" style={{ bottom: `${(val / 100) * 100}%` }}>
                            <span className="absolute -left-1 -translate-y-1/2 text-[9px] text-gray-400">{val}%</span>
                        </div>
                    ))}
                    {/* Line + dots */}
                    <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${12 * 60} 200`} preserveAspectRatio="none">
                        {/* Area fill */}
                        <path
                            d={`M${attendanceData.map((val, i) => `${i * 60 + 30},${200 - val * 2}`).join(' L')} L${11 * 60 + 30},200 L30,200 Z`}
                            fill="url(#attendanceGradient)"
                            opacity="0.3"
                        />
                        {/* Line */}
                        <polyline
                            points={attendanceData.map((val, i) => `${i * 60 + 30},${200 - val * 2}`).join(' ')}
                            fill="none"
                            stroke="#6366f1"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        {/* Dots */}
                        {attendanceData.map((val, i) => (
                            <circle
                                key={i}
                                cx={i * 60 + 30}
                                cy={200 - val * 2}
                                r={i === currentMonth ? 6 : 4}
                                fill={i === currentMonth ? '#6366f1' : '#a5b4fc'}
                                stroke="white"
                                strokeWidth="2"
                            />
                        ))}
                        <defs>
                            <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6366f1" />
                                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                    </svg>
                </div>
                {/* Labels */}
                <div className="flex mt-2">
                    {MONTHS.map((label, i) => (
                        <div key={label} className="flex-1 text-center">
                            <span className={`text-[10px] ${i === currentMonth ? 'font-bold text-primary' : 'text-gray-400'}`}>{label}</span>
                            {attendanceData[i] > 0 && (
                                <p className={`text-[9px] ${attendanceData[i] >= 80 ? 'text-green-600 dark:text-green-400' : attendanceData[i] >= 60 ? 'text-amber-600' : 'text-red-500'} font-semibold`}>
                                    {attendanceData[i]}%
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
