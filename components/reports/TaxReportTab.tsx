import React, { useState, useMemo, useRef } from 'react';
import { useData } from '../../hooks/useDataContext';
import { TransactionType } from '../../types';
import { Button } from '../common/Button';
import { ICONS } from '../../constants';
import { printHtml } from '../../utils/html';

import { getVietnamTime } from '../../utils/date';

export const TaxReportTab: React.FC = () => {
    const { state } = useData();
    const { transactions, income, settings } = state;
    
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
                    date: `${y}-${m}-01`,
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
        const formatAmount = (n: number) => n.toLocaleString('vi-VN');
        
        const rows = reportData.map((row, i) => `
            <tr>
                <td class="stt">${i + 1}</td>
                <td class="date">${formatDate(row.date)}</td>
                <td class="desc">${row.description}</td>
                <td class="amount">${formatAmount(row.amount)}</td>
            </tr>
        `).join('');

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Sổ doanh thu - ${settings.name}</title>
<style>
    @page { size: A4 portrait; margin: 15mm 12mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
        font-family: "Times New Roman", Times, serif; 
        color: #000; background: #fff; 
        font-size: 13px; line-height: 1.4;
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .header-left { width: 55%; padding-right: 12px; }
    .header-right { width: 45%; text-align: center; padding-left: 12px; }
    .header-right .form-code { font-weight: bold; font-size: 14px; margin-bottom: 4px; }
    .header-right .form-note { font-style: italic; font-size: 11px; line-height: 1.5; }
    .header-left p { margin-bottom: 3px; }
    .header-left .label { font-weight: bold; text-transform: uppercase; }

    .title-section { text-align: center; margin-bottom: 18px; }
    .title-section h1 { font-size: 17px; font-weight: bold; text-transform: uppercase; margin-bottom: 10px; }
    .title-section .meta { text-align: left; max-width: 480px; margin: 0 auto; font-size: 13px; }
    .title-section .meta p { margin-bottom: 3px; }

    .unit { font-style: italic; margin-bottom: 6px; font-size: 13px; }

    table { border-collapse: collapse; width: 100%; font-size: 13px; page-break-inside: auto; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th, td { border: 1px solid #000; padding: 5px 8px; vertical-align: top; }
    th { text-align: center; font-weight: bold; background: #f8f8f8; padding: 8px; }
    
    .stt { text-align: center; width: 35px; }
    .date { text-align: center; width: 90px; white-space: nowrap; }
    .desc { text-align: left; word-break: break-word; }
    .amount { text-align: right; width: 110px; white-space: nowrap; }

    .total-row td { font-weight: bold; }
    .total-label { text-align: center; }

    .footer { display: flex; justify-content: flex-end; margin-top: 24px; page-break-inside: avoid; }
    .footer-sign { text-align: center; width: 260px; }
    .footer-sign .date-text { font-style: italic; margin-bottom: 4px; font-size: 13px; }
    .footer-sign .role { font-weight: bold; text-transform: uppercase; font-size: 13px; line-height: 1.4; }
    .footer-sign .note { font-style: italic; font-size: 11px; margin-bottom: 4px; }
    .footer-sign .sig-area { height: 60px; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
    .footer-sign .sig-area img { max-height: 56px; object-fit: contain; }
    .footer-sign .name { font-weight: bold; font-size: 14px; }
</style>
</head><body>

<div class="header">
    <div class="header-left">
        <p><span class="label">Hộ, cá nhân kinh doanh:</span> ${settings.name || ''}</p>
        <p>Địa chỉ: ${settings.address || ''}</p>
        <p>Mã số thuế: ${settings.taxId || ''}</p>
    </div>
    <div class="header-right">
        <p class="form-code">Mẫu số S1a-HKD</p>
        <p class="form-note">(Kèm theo Thông tư số 152/2025/TT-BTC<br>ngày 31 tháng 12 năm 2025 của Bộ trưởng<br>Bộ Tài chính)</p>
    </div>
</div>

<div class="title-section">
    <h1>SỔ DOANH THU BÁN HÀNG HÓA,<br>DỊCH VỤ</h1>
    <div class="meta">
        <p>Địa điểm kinh doanh: ${settings.address || ''}</p>
        <p>Kỳ kê khai: ${periodText}</p>
    </div>
</div>

<p class="unit">Đơn vị tính: VNĐ</p>
<table>
    <thead>
        <tr>
            <th class="stt">STT</th>
            <th class="date">Ngày tháng</th>
            <th class="desc">Diễn giải</th>
            <th class="amount">Số tiền</th>
        </tr>
    </thead>
    <tbody>
        ${rows || '<tr><td class="stt"></td><td class="date"></td><td class="desc"></td><td class="amount"></td></tr>'}
        <tr class="total-row">
            <td colspan="3" class="total-label">Tổng cộng</td>
            <td class="amount">${formatAmount(totalAmount)}</td>
        </tr>
    </tbody>
</table>

<div class="footer">
    <div class="footer-sign">
        <p class="date-text">Ngày ${vnDate.getDate()} tháng ${vnDate.getMonth() + 1} năm ${vnDate.getFullYear()}</p>
        <p class="role">NGƯỜI ĐẠI DIỆN HỘ KINH DOANH/<br>CÁ NHÂN KINH DOANH</p>
        <p class="note">(Ký, ghi rõ họ tên, đóng dấu (nếu có))</p>
        <div class="sig-area">${settings.taxSignatureUrl ? `<img src="${settings.taxSignatureUrl}" alt="Signature">` : ''}</div>
        <p class="name">${settings.name || ''}</p>
    </div>
</div>

</body></html>`;
        printHtml(html);
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
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
            <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 overflow-x-auto text-black">
                <div 
                    ref={previewRef}
                    className="w-full max-w-[800px] mx-auto" 
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
                    <table className="w-full border-collapse border border-black mb-8 text-[15px]">
                        <thead>
                            <tr>
                                <th className="border border-black p-2 text-center w-[45px]">STT</th>
                                <th className="border border-black p-2 text-center w-[100px]">Ngày tháng</th>
                                <th className="border border-black p-2 text-center">Diễn giải</th>
                                <th className="border border-black p-2 text-center w-[130px]">Số tiền</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.length > 0 ? (
                                reportData.map((row, index) => (
                                    <tr key={index}>
                                        <td className="border border-black p-2 text-center align-top">{index + 1}</td>
                                        <td className="border border-black p-2 text-center align-top whitespace-nowrap">{formatDate(row.date)}</td>
                                        <td className="border border-black p-2 align-top break-words">{row.description}</td>
                                        <td className="border border-black p-2 text-right align-top whitespace-nowrap">{row.amount.toLocaleString('vi-VN')}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td className="border border-black p-2 text-center h-8"></td>
                                    <td className="border border-black p-2 text-center h-8"></td>
                                    <td className="border border-black p-2 h-8"></td>
                                    <td className="border border-black p-2 h-8"></td>
                                </tr>
                            )}
                            <tr>
                                <td colSpan={3} className="border border-black p-2 font-bold text-center">Tổng cộng</td>
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
        </div>
    );
};
