
import React, { forwardRef } from 'react';
import { Student, CenterSettings, Invoice } from '../../types';

interface PrintableClassDebtReportProps {
    students: (Student & { className?: string })[];
    className: string;
    settings: CenterSettings;
    showClassColumn?: boolean;
    isDetailed?: boolean;
    invoices?: Invoice[];
    /** 'print' = fixed A4 width for html2canvas export; 'preview' = responsive for modal display */
    mode?: 'print' | 'preview';
}

const formatCurrency = (amount: number) => `${Math.abs(Math.round(amount)).toLocaleString('vi-VN')} ₫`;

export const PrintableClassDebtReport = forwardRef<HTMLDivElement, PrintableClassDebtReportProps>(({ students, className, settings, showClassColumn, isDetailed, invoices, mode = 'print' }, ref) => {
    const isPreview = mode === 'preview';
    const containerStyle: React.CSSProperties = isPreview
        ? { width: '100%', maxWidth: '100%', margin: '0 auto', color: '#000', backgroundColor: '#fff' }
        : { width: '210mm', minHeight: '297mm', margin: 'auto', color: '#000', backgroundColor: '#fff' };
    
    const totalDebt = students
        .filter(s => s.balance < 0)
        .reduce((sum, s) => sum + s.balance, 0);

    // Explicitly set text color to black using inline styles to override any potential dark mode inheritance issues during canvas rendering.
    const textStyle = { color: '#000' };

    return (
        <div ref={ref} className="bg-white p-8 font-sans text-sm" style={containerStyle}>
            {/* Header */}
            <header className="text-center pb-2" style={textStyle}>
                <h1 className="text-lg font-bold uppercase">{settings.name}</h1>
                <p className="text-xs">{settings.address}</p>
                {(settings.bankAccountNumber && settings.bankName) && (
                    <p className="text-xs mt-1">
                        STK: <span className="font-semibold">{settings.bankAccountNumber}</span> - {settings.bankName} 
                        {settings.bankAccountHolder && ` (${settings.bankAccountHolder})`}
                    </p>
                )}
                <div className="w-full border-t border-black my-4"></div>
                <h2 className="text-xl font-bold mt-4 uppercase">BÁO CÁO CÔNG NỢ - {className.toUpperCase()}</h2>
                <p className="text-xs">Ngày lập: {new Date().toLocaleDateString('vi-VN')}</p>
            </header>

            {/* Table */}
            <section className="mt-8">
                <table className="w-full text-left text-xs border-collapse" style={textStyle}>
                    <thead>
                        <tr>
                            <th className="py-2 px-2 font-bold border border-black w-12 text-center">STT</th>
                            <th className="py-2 px-2 font-bold border border-black w-24">Mã HV</th>
                            <th className="py-2 px-2 font-bold border border-black">Họ tên</th>
                            {showClassColumn && <th className="py-2 px-2 font-bold border border-black">Lớp</th>}
                            <th className="py-2 px-2 font-bold border border-black text-right w-32">Số dư nợ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((student, index) => {
                            const studentInvoices = invoices?.filter(inv => inv.studentId === student.id && inv.status === 'UNPAID') || [];
                            
                            return (
                                <tr key={student.id}>
                                    <td className="py-2 px-2 border border-black text-center align-top">{index + 1}</td>
                                    <td className="py-2 px-2 border border-black align-top">{student.id}</td>
                                    <td className="py-2 px-2 border border-black align-top">
                                        <div className="font-semibold text-sm">{student.name}</div>
                                        {isDetailed && studentInvoices.length > 0 && (
                                            <div className="mt-2 pl-2 border-l-2 border-gray-300 space-y-1">
                                                {studentInvoices.map((inv) => {
                                                    const [, month] = inv.month.split('-');
                                                            // Rút gọn chi tiết nếu có để trông gọn hơn, cố gắng tìm thông tin "số buổi"
                                                            let detailsCompact = [];
                                                            if (inv.details) {
                                                                const lines = inv.details.split('\n');
                                                                for (const line of lines) {
                                                                    if (!line.trim()) continue;
                                                                    // Thử tìm chuỗi bắt đầu bằng "(Đi học:" tới ")"
                                                                    const match = line.match(/(.*?)(\((?:Đi học:\s*)?.*?buổi.*?\))(.*)/);

                                                                    if (match) {
                                                                        // Giữ lại tên lớp và phần đi học
                                                                        detailsCompact.push(`- ${match[1].replace(/-\s*/, '').trim()} ${match[2]}`);
                                                                    } else {
                                                                        // Nếu không thấy, lấy dòng đó
                                                                        detailsCompact.push(line);
                                                                    }
                                                                }
                                                            }
                                                    
                                                    return (
                                                        <div key={inv.id} className="text-xs text-gray-700">
                                                            <span className="font-bold">Tháng {month}:</span> {formatCurrency(inv.amount)}
                                                            {detailsCompact.length > 0 && (
                                                                <div className="ml-2 italic text-[11px]">
                                                                    {detailsCompact.map((d, i) => <div key={i}>{d}</div>)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </td>
                                    {showClassColumn && <td className="py-2 px-2 border border-black align-top">{student.className}</td>}
                                    <td className={`py-2 px-2 border border-black text-right font-bold align-top`}>
                                        {formatCurrency(student.balance)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="font-bold">
                            <td colSpan={showClassColumn ? 4 : 3} className="py-2 px-2 border border-black text-right">TỔNG CÔNG NỢ</td>
                            <td className="py-2 px-2 border border-black text-right">{formatCurrency(totalDebt)}</td>
                        </tr>
                    </tfoot>
                </table>
            </section>

            {/* Footer */}
            <footer className="text-right text-xs" style={{marginTop: '100px', ...textStyle}}>
                <p className="font-semibold">Người lập báo cáo</p>
                <p className="mt-16">(Ký và ghi rõ họ tên)</p>
            </footer>
        </div>
    );
});
