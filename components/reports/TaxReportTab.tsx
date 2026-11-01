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
        if (!previewRef.current) return;
        const content = previewRef.current.innerHTML;
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

    /* Header */
    .tax-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .tax-header-left { width: 55%; padding-right: 12px; }
    .tax-header-right { width: 45%; text-align: center; padding-left: 12px; }
    .tax-header-right .form-code { font-weight: bold; font-size: 14px; margin-bottom: 4px; }
    .tax-header-right .form-note { font-style: italic; font-size: 11px; line-height: 1.5; }
    .tax-header-left p { margin-bottom: 3px; }
    .tax-label-bold { font-weight: bold; text-transform: uppercase; }

    /* Title */
    .tax-title { text-align: center; margin-bottom: 18px; }
    .tax-title h1 { font-size: 17px; font-weight: bold; text-transform: uppercase; margin-bottom: 10px; }
    .tax-title .meta { text-align: left; max-width: 480px; margin: 0 auto; font-size: 13px; }
    .tax-title .meta p { margin-bottom: 3px; }

    .tax-unit { font-style: italic; margin-bottom: 6px; font-size: 13px; }

    /* Table */
    table { border-collapse: collapse; width: 100%; font-size: 13px; page-break-inside: auto; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th, td { border: 1px solid #000; padding: 5px 8px; vertical-align: top; }
    th { text-align: center; font-weight: bold; background: #f8f8f8; padding: 8px; }

    .col-stt { text-align: center; width: 35px; }
    .col-date { text-align: center; width: 90px; white-space: nowrap; }
    .col-desc { text-align: left; word-break: break-word; }
    .col-amount { text-align: right; width: 110px; white-space: nowrap; }
    .row-total td { font-weight: bold; }
    .row-total .col-total-label { text-align: center; }

    /* Footer */
    .tax-footer { display: flex; justify-content: flex-end; margin-top: 24px; page-break-inside: avoid; }
    .tax-footer-sign { text-align: center; width: 260px; }
    .tax-footer-sign .date-text { font-style: italic; margin-bottom: 4px; font-size: 13px; }
    .tax-footer-sign .role { font-weight: bold; text-transform: uppercase; font-size: 13px; line-height: 1.4; }
    .tax-footer-sign .note { font-style: italic; font-size: 11px; margin-bottom: 4px; }
    .tax-footer-sign .sig-area { height: 60px; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
    .tax-footer-sign .sig-area img { max-height: 56px; object-fit: contain; }
    .tax-footer-sign .signer-name { font-weight: bold; font-size: 14px; }
</style>
</head><body>${content}</body></html>`;
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
                    contentEditable
                    suppressContentEditableWarning
                    className="w-full max-w-[800px] mx-auto outline-none" 
                    style={{ fontFamily: '"Times New Roman", Times, serif', backgroundColor: 'white', color: 'black', padding: '20px' }}
                >
                    
                    {/* Header */}
                    <div className="tax-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', fontSize: '13px' }}>
                        <div className="tax-header-left" style={{ width: '55%', paddingRight: '12px' }}>
                            <p style={{ marginBottom: '3px' }}><span className="tax-label-bold" style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>HỘ, CÁ NHÂN KINH DOANH:</span> {settings.name || ''}</p>
                            <p style={{ marginBottom: '3px' }}>Địa chỉ: {settings.address || ''}</p>
                            <p>Mã số thuế: {settings.taxId || ''}</p>
                        </div>
                        <div className="tax-header-right" style={{ width: '45%', textAlign: 'center', paddingLeft: '12px' }}>
                            <p className="form-code" style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>Mẫu số S1a-HKD</p>
                            <p className="form-note" style={{ fontStyle: 'italic', fontSize: '11px', lineHeight: '1.5' }}>(Kèm theo Thông tư số 152/2025/TT-BTC<br/>ngày 31 tháng 12 năm 2025 của Bộ trưởng<br/>Bộ Tài chính)</p>
                        </div>
                    </div>

                    {/* Title */}
                    <div className="tax-title" style={{ textAlign: 'center', marginBottom: '18px' }}>
                        <h1 style={{ fontSize: '17px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px' }}>SỔ DOANH THU BÁN HÀNG HÓA,<br/>DỊCH VỤ</h1>
                        <div className="meta" style={{ textAlign: 'left', maxWidth: '480px', margin: '0 auto', fontSize: '13px' }}>
                            <p style={{ marginBottom: '3px' }}>Địa điểm kinh doanh: {settings.address || ''}</p>
                            <p>Kỳ kê khai: {periodText}</p>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="tax-unit" style={{ fontStyle: 'italic', marginBottom: '6px', fontSize: '13px' }}>Đơn vị tính: VNĐ</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '16px' }}>
                        <thead>
                            <tr>
                                <th className="col-stt" style={{ border: '1px solid black', padding: '8px', textAlign: 'center', width: '35px', fontWeight: 'bold' }}>STT</th>
                                <th className="col-date" style={{ border: '1px solid black', padding: '8px', textAlign: 'center', width: '90px', fontWeight: 'bold' }}>Ngày tháng</th>
                                <th className="col-desc" style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Diễn giải</th>
                                <th className="col-amount" style={{ border: '1px solid black', padding: '8px', textAlign: 'center', width: '110px', fontWeight: 'bold' }}>Số tiền</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.length > 0 ? (
                                reportData.map((row, index) => (
                                    <tr key={index}>
                                        <td className="col-stt" style={{ border: '1px solid black', padding: '5px 8px', textAlign: 'center', verticalAlign: 'top' }}>{index + 1}</td>
                                        <td className="col-date" style={{ border: '1px solid black', padding: '5px 8px', textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{formatDate(row.date)}</td>
                                        <td className="col-desc" style={{ border: '1px solid black', padding: '5px 8px', textAlign: 'left', verticalAlign: 'top', wordBreak: 'break-word' }}>{row.description}</td>
                                        <td className="col-amount" style={{ border: '1px solid black', padding: '5px 8px', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{row.amount.toLocaleString('vi-VN')}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td className="col-stt" style={{ border: '1px solid black', padding: '5px 8px', textAlign: 'center', height: '32px' }}></td>
                                    <td className="col-date" style={{ border: '1px solid black', padding: '5px 8px', textAlign: 'center', height: '32px' }}></td>
                                    <td className="col-desc" style={{ border: '1px solid black', padding: '5px 8px', height: '32px' }}></td>
                                    <td className="col-amount" style={{ border: '1px solid black', padding: '5px 8px', height: '32px' }}></td>
                                </tr>
                            )}
                            <tr className="row-total">
                                <td colSpan={3} className="col-total-label" style={{ border: '1px solid black', padding: '5px 8px', fontWeight: 'bold', textAlign: 'center' }}>Tổng cộng</td>
                                <td className="col-amount" style={{ border: '1px solid black', padding: '5px 8px', fontWeight: 'bold', textAlign: 'right' }}>{totalAmount.toLocaleString('vi-VN')}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Footer */}
                    <div className="tax-footer" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                        <div className="tax-footer-sign" style={{ textAlign: 'center', width: '260px' }}>
                            <p className="date-text" style={{ fontStyle: 'italic', marginBottom: '4px', fontSize: '13px' }}>
                                Ngày {vnDate.getDate()} tháng {vnDate.getMonth() + 1} năm {vnDate.getFullYear()}
                            </p>
                            <p className="role" style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '13px', lineHeight: '1.4' }}>NGƯỜI ĐẠI DIỆN HỘ KINH DOANH/<br/>CÁ NHÂN KINH DOANH</p>
                            <p className="note" style={{ fontStyle: 'italic', fontSize: '11px', marginBottom: '4px' }}>(Ký, ghi rõ họ tên, đóng dấu (nếu có))</p>
                            <div className="sig-area" style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
                                {settings.taxSignatureUrl && (
                                    <img src={settings.taxSignatureUrl} alt="Signature" style={{ maxHeight: '56px', objectFit: 'contain' }} />
                                )}
                            </div>
                            <p className="signer-name" style={{ fontWeight: 'bold', fontSize: '14px' }}>{settings.taxSignerName || settings.name}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
