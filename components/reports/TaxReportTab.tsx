import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../../hooks/useDataContext';
import { TransactionType } from '../../types';
import { Button } from '../common/Button';
import { ICONS } from '../../constants';

import { getVietnamTime } from '../../utils/date';

export const TaxReportTab: React.FC = () => {
    const { state } = useData();
    const { transactions, income, settings } = state;
    
    // Use Vietnam Time for all references
    const vnTimeStr = getVietnamTime();
    const vnDate = new Date(vnTimeStr);
    const currentMonthStr = `${vnDate.getFullYear()}-${String(vnDate.getMonth() + 1).padStart(2, '0')}`;
    const currentDateStr = vnTimeStr.split('T')[0];
    
    const [filterMode, setFilterMode] = useState<'month' | 'date'>('month');
    const [startMonth, setStartMonth] = useState(currentMonthStr);
    const [endMonth, setEndMonth] = useState(currentMonthStr);
    const [startDate, setStartDate] = useState(currentDateStr);
    const [endDate, setEndDate] = useState(currentDateStr);
    
    const [reportType, setReportType] = useState<'detailed' | 'daily_summary' | 'monthly_summary'>('detailed');
    
    const previewRef = useRef<HTMLDivElement>(null);
    const [printHtml, setPrintHtml] = useState<string>('');

    const reportData = useMemo(() => {
        let start, end;
        if (filterMode === 'month') {
            const [startYear, startM] = startMonth.split('-');
            start = `${startYear}-${startM}-01`;
            
            const [endYear, endM] = endMonth.split('-');
            end = new Date(parseInt(endYear), parseInt(endM), 0).toISOString().split('T')[0];
        } else {
            start = startDate;
            end = endDate;
        }

        const relevantTransactions = transactions
            .filter(t => {
                const isPayment = t.type === TransactionType.PAYMENT || t.type === TransactionType.ADJUSTMENT_CREDIT;
                const isWithin = t.date.substring(0, 10) >= start && t.date.substring(0, 10) <= end;
                const isNotRefund = !t.description.toLowerCase().includes('hủy hóa đơn');
                return isPayment && isWithin && isNotRefund && t.amount > 0;
            });
        
        const relevantIncome = income
            .filter(i => i.date.substring(0, 10) >= start && i.date.substring(0, 10) <= end);

        const combined = [
            ...relevantTransactions.map(t => ({ 
                date: t.date.substring(0, 10), 
                description: `Thu học phí - ${t.description} (${t.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'})`, 
                amount: t.amount,
                paymentMethod: t.paymentMethod || 'transfer'
            })),
            ...relevantIncome.map(i => ({ 
                date: i.date.substring(0, 10), 
                description: `${i.description} (${i.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'})`, 
                amount: i.amount,
                paymentMethod: i.paymentMethod || 'transfer'
            }))
        ];

        // Sort by date ascending
        combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (reportType === 'monthly_summary') {
            const monthlyMap = new Map<string, number>();
            combined.forEach(item => {
                const [y, m] = item.date.split('-');
                const key = `${y}-${m}|${item.paymentMethod}`;
                monthlyMap.set(key, (monthlyMap.get(key) || 0) + item.amount);
            });

            const summaryData = Array.from(monthlyMap.entries()).map(([key, amount]) => {
                const [datePart, method] = key.split('|');
                const [y, m] = datePart.split('-');
                return {
                    date: `${y}-${m}-01`, // Use 1st of month for sorting/display
                    description: `Doanh thu tháng ${m}/${y} (${method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'})`,
                    amount
                };
            });
            summaryData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            return summaryData;
        } else if (reportType === 'daily_summary') {
            const dailyMap = new Map<string, number>();
            combined.forEach(item => {
                const key = `${item.date}|${item.paymentMethod}`;
                dailyMap.set(key, (dailyMap.get(key) || 0) + item.amount);
            });

            const summaryData = Array.from(dailyMap.entries()).map(([key, amount]) => {
                const [datePart, method] = key.split('|');
                const [y, m, d] = datePart.split('-');
                return {
                    date: datePart,
                    description: `Doanh thu ngày ${d}/${m}/${y} (${method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'})`,
                    amount
                };
            });
            summaryData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            return summaryData;
        }

        return combined;
    }, [transactions, income, startMonth, endMonth, startDate, endDate, filterMode, reportType]);

    const totalAmount = reportData.reduce((sum, item) => sum + item.amount, 0);

    const handlePrint = () => {
        if (previewRef.current) {
            setPrintHtml(previewRef.current.innerHTML);
            setTimeout(() => {
                window.print();
            }, 100);
        }
    };

    const formatDate = (dateStr: string) => {
        const datePart = dateStr.split('T')[0];
        const [y, m, d] = datePart.split('-');
        if (reportType === 'monthly_summary') {
            return `Tháng ${m}/${y}`;
        }
        return `${d}/${m}/${y}`;
    };

    const periodText = filterMode === 'month'
        ? (startMonth === endMonth 
            ? `Tháng ${startMonth.split('-')[1]} năm ${startMonth.split('-')[0]}`
            : `Từ tháng ${startMonth.split('-')[1]}/${startMonth.split('-')[0]} đến tháng ${endMonth.split('-')[1]}/${endMonth.split('-')[0]}`)
        : (startDate === endDate
            ? `Ngày ${formatDate(startDate)}`
            : `Từ ngày ${formatDate(startDate)} đến ngày ${formatDate(endDate)}`);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 print:hidden">
                <div className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Lọc theo
                        </label>
                        <select
                            value={filterMode}
                            onChange={(e) => setFilterMode(e.target.value as 'month' | 'date')}
                            className="form-select w-full sm:w-auto"
                        >
                            <option value="month">Tháng</option>
                            <option value="date">Ngày</option>
                        </select>
                    </div>
                    {filterMode === 'month' ? (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Từ tháng
                                </label>
                                <input
                                    type="month"
                                    value={startMonth}
                                    onChange={(e) => setStartMonth(e.target.value)}
                                    className="form-input w-full sm:w-auto"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Đến tháng
                                </label>
                                <input
                                    type="month"
                                    value={endMonth}
                                    onChange={(e) => setEndMonth(e.target.value)}
                                    className="form-input w-full sm:w-auto"
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Từ ngày
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="form-input w-full sm:w-auto"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Đến ngày
                                </label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="form-input w-full sm:w-auto"
                                />
                            </div>
                        </>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Loại báo cáo
                        </label>
                        <select
                            value={reportType}
                            onChange={(e) => setReportType(e.target.value as 'detailed' | 'daily_summary' | 'monthly_summary')}
                            className="form-select w-full sm:w-auto"
                        >
                            <option value="detailed">Chi tiết từng khoản</option>
                            <option value="daily_summary">Tổng hợp theo ngày</option>
                            <option value="monthly_summary">Tổng hợp theo tháng</option>
                        </select>
                    </div>
                </div>
                <Button onClick={handlePrint} className="flex items-center gap-2">
                    {ICONS.print} In báo cáo
                </Button>
            </div>

            {/* Screen Preview Area */}
            <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 overflow-x-auto text-black print:hidden">
                <div 
                    ref={previewRef}
                    contentEditable
                    suppressContentEditableWarning
                    className="w-full max-w-[800px] mx-auto outline-none" 
                    style={{ fontFamily: '"Times New Roman", Times, serif', backgroundColor: 'white', color: 'black', padding: '20px' }}
                >
                    
                    {/* Header */}
                    <div className="flex justify-between items-start mb-8 text-[15px]">
                        <div className="w-1/2 pr-4">
                            <p className="font-bold uppercase mb-1">HỘ, CÁ NHÂN KINH DOANH: <span className="font-normal">{settings.name || ''}</span></p>
                            <p className="mb-1">Địa chỉ: <span className="whitespace-normal break-words">{settings.address || ''}</span></p>
                            <p>Mã số thuế: <span>{settings.taxId || ''}</span></p>
                        </div>
                        <div className="w-1/2 text-center pl-4">
                            <p className="font-bold mb-1">Mẫu số S1a-HKD</p>
                            <p className="italic text-sm">(Kèm theo Thông tư số 152/2025/TT-BTC<br/>ngày 31 tháng 12 năm 2025 của Bộ trưởng<br/>Bộ Tài chính)</p>
                        </div>
                    </div>

                    {/* Title */}
                    <div className="text-center mb-8">
                        <h1 className="text-xl font-bold uppercase mb-4">SỔ DOANH THU BÁN HÀNG HÓA, DỊCH VỤ</h1>
                        <div className="text-left max-w-[500px] mx-auto text-[15px]">
                            <p className="mb-1">Địa điểm kinh doanh: <span className="whitespace-normal break-words">{settings.address || ''}</span></p>
                            <p>Kỳ kê khai: <span>{periodText}</span></p>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="mb-2 italic text-[15px]">Đơn vị tính: VNĐ</div>
                    <table className="w-full border-collapse border border-black mb-8 table-fixed text-[15px]">
                        <thead>
                            <tr>
                                <th className="border border-black p-2 text-center w-[120px]">Ngày tháng</th>
                                <th className="border border-black p-2 text-center">Diễn giải</th>
                                <th className="border border-black p-2 text-center w-[150px]">Số tiền</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.length > 0 ? (
                                reportData.map((row, index) => (
                                    <tr key={index}>
                                        <td className="border border-black p-2 text-center align-top">{formatDate(row.date)}</td>
                                        <td className="border border-black p-2 align-top whitespace-normal break-words">{row.description}</td>
                                        <td className="border border-black p-2 text-right align-top">{row.amount.toLocaleString('vi-VN')}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td className="border border-black p-2 text-center h-8"></td>
                                    <td className="border border-black p-2 h-8"></td>
                                    <td className="border border-black p-2 h-8"></td>
                                </tr>
                            )}
                            <tr>
                                <td colSpan={2} className="border border-black p-2 font-bold text-center">Tổng cộng</td>
                                <td className="border border-black p-2 font-bold text-right">{totalAmount.toLocaleString('vi-VN')}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Footer */}
                    <div className="flex justify-end mt-8 text-[15px]">
                        <div className="text-center w-[300px]">
                            <p className="italic mb-1">
                                Ngày <span>{vnDate.getDate()}</span> 
                                {' '}tháng <span>{vnDate.getMonth() + 1}</span> 
                                {' '}năm <span>{vnDate.getFullYear()}</span>
                            </p>
                            <p className="font-bold uppercase">NGƯỜI ĐẠI DIỆN HỘ KINH DOANH/<br/>CÁ NHÂN KINH DOANH</p>
                            <p className="italic text-sm mb-2">(Ký, ghi rõ họ tên, đóng dấu (nếu có))</p>
                            <div className="h-16 flex items-center justify-center mb-1">
                                {settings.taxSignatureUrl && (
                                    <img src={settings.taxSignatureUrl} alt="Signature" className="max-h-full object-contain" />
                                )}
                            </div>
                            <p className="font-bold"><span>{settings.name}</span></p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Render Print Portal */}
            {createPortal(
                <div 
                    className="print-area-portal hidden print:block bg-white text-black w-full"
                    dangerouslySetInnerHTML={{ __html: printHtml }}
                />, 
                document.body
            )}
            
            {/* Print Styles */}
            <style>{`
                @media print {
                    body > *:not(.print-area-portal) {
                        display: none !important;
                    }
                    .print-area-portal {
                        display: block !important;
                    }
                    /* Ensure table rows don't break across pages if possible, but allow table to span multiple pages */
                    table { page-break-inside:auto }
                    tr    { page-break-inside:avoid; page-break-after:auto }
                    thead { display:table-header-group }
                    tfoot { display:table-footer-group }
                    
                    @page {
                        size: A4 portrait;
                        margin: 15mm;
                    }
                }
            `}</style>
        </div>
    );
};
