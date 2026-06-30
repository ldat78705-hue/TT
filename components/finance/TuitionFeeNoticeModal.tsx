
import React, { useRef, useState, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { TuitionFeeNotice } from './TuitionFeeNotice';
import { Invoice, TransactionType } from '../../types';
import { ICONS } from '../../constants';
import { useData } from '../../hooks/useDataContext';
import { useToast } from '../../hooks/useToast';
import { escapeHtml, printHtml } from '../../utils/html';

declare global {
    interface Window {
        html2canvas: any;
    }
}

interface TuitionFeeNoticeModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: Invoice | null;
}

const formatCurrency = (amount: number) => `${Math.round(amount).toLocaleString('vi-VN')} ₫`;

// For the 'accountName' QR parameter
const normalizeAccountName = (name: string) => {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase();
};

export const TuitionFeeNoticeModal: React.FC<TuitionFeeNoticeModalProps> = ({ isOpen, onClose, invoice }) => {
    const noticeRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const { state } = useData();
    const { students, transactions, settings } = state;
    const { toast } = useToast();

    const student = useMemo(() => {
        if (!invoice) return null;
        return students.find(s => s.id === invoice.studentId);
    }, [students, invoice]);

    const financialData = useMemo(() => {
        if (!student || !invoice) {
            return { outstandingDebt: 0, openingCredit: 0, totalDue: 0 };
        }
        const currentRealTimeBalance = student.balance;
        const relatedTransaction = transactions.find(t => t.relatedInvoiceId === invoice.id && t.type === TransactionType.INVOICE);
        const thisInvoiceDebitAmount = relatedTransaction ? relatedTransaction.amount : -invoice.amount;
        const balanceBeforeThisInvoice = currentRealTimeBalance - thisInvoiceDebitAmount;

        const outstandingDebt = balanceBeforeThisInvoice < 0 ? -balanceBeforeThisInvoice : 0;
        const openingCredit = balanceBeforeThisInvoice > 0 ? balanceBeforeThisInvoice : 0;
        const totalDue = outstandingDebt + invoice.amount - openingCredit;

        return {
            outstandingDebt: Math.round(outstandingDebt),
            openingCredit: Math.round(openingCredit),
            totalDue: Math.max(0, Math.round(totalDue)),
        };
    }, [student, transactions, invoice]);

    const transferContent = useMemo(() => {
        if (!student) return '';
        // CRITICAL UPDATE: Always use `HOC PHI HSXXX` parameter to guarantee Webhook integration works flawlessly 
        // across all invoices, debts, and partial payments
        return `HOC PHI ${student.id}`;
    }, [student]);

    const qrCodeUrl = useMemo(() => {
        // Clean up inputs to prevent QR generation failure
        const bankBin = settings.bankBin?.replace(/\s+/g, '');
        const bankAccountNumber = settings.bankAccountNumber?.replace(/\s+/g, '');

        if (!bankAccountNumber || !bankBin || !student || financialData.totalDue <= 0) {
            return null;
        }
        const params: Record<string, string> = {
            amount: financialData.totalDue.toString(),
            addInfo: transferContent,
        };
        if (settings.bankAccountHolder) {
            params.accountName = normalizeAccountName(settings.bankAccountHolder);
        }
        return `https://img.vietqr.io/image/${bankBin}-${bankAccountNumber}-compact2.png?${new URLSearchParams(params).toString()}`;
    }, [settings, student, financialData.totalDue, transferContent]);

    const handleDownloadImage = async () => {
        if (!noticeRef.current || !invoice || !window.html2canvas) {
            toast.error("Không thể tải ảnh, vui lòng thử lại.");
            return;
        }
        setIsDownloading(true);
        try {
            const canvas = await window.html2canvas(noticeRef.current, { scale: 3, useCORS: true });
            const link = document.createElement('a');
            link.download = `PhieuHocPhi_${invoice.studentId}_${invoice.month}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error("Lỗi khi xuất ảnh hóa đơn:", error);
            toast.error("Lỗi khi xuất ảnh hóa đơn.");
        } finally {
            setIsDownloading(false);
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast.success("Đã sao chép nội dung chuyển khoản!");
        }, () => {
            toast.error("Sao chép thất bại.");
        });
    };

    if (!invoice || !student) return null;

    const { outstandingDebt, openingCredit, totalDue } = financialData;

    const handleExportPdf = () => {
        const { outstandingDebt: od, openingCredit: oc, totalDue: td } = financialData;
        const e = escapeHtml; // shorthand
        const centerName = e(settings.name || 'Trung tâm');
        const centerPhone = e(settings.phone || '');
        const centerAddress = e(settings.address || '');
        const qrUrl = td > 0 && settings.bankAccountNumber
            ? `https://img.vietqr.io/image/${e(settings.bankBin || '970422')}-${e(settings.bankAccountNumber)}-compact2.jpg?amount=${td}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(settings.bankAccountHolder || '')}`
            : '';
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>HoaDon_${e(invoice.id)}</title>
<style>*{margin:0;padding:0;box-sizing:border-box;font-family:'Segoe UI',sans-serif}
body{padding:40px;color:#1e293b}
.header{text-align:center;margin-bottom:24px;border-bottom:2px solid #6366f1;padding-bottom:16px}
.header h1{font-size:22px;color:#6366f1;margin-bottom:4px}
.header p{font-size:12px;color:#64748b}
.section{margin-bottom:20px}
.section h2{font-size:14px;color:#6366f1;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:10px}
.row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px}
.row.border{border-bottom:1px solid #f1f5f9}
.label{color:#64748b}
.value{font-weight:600}
.total-row{display:flex;justify-content:space-between;padding:12px 0;font-size:16px;font-weight:700;color:#6366f1;border-top:2px solid #6366f1;margin-top:8px}
.details{font-size:12px;color:#64748b;padding:8px 12px;background:#f8fafc;border-radius:6px;white-space:pre-wrap;line-height:1.6}
.payment-box{margin-top:20px;padding:16px;border:1px solid #fbbf24;background:#fffbeb;border-radius:8px;text-align:center}
.payment-box h3{color:#92400e;font-size:14px;margin-bottom:8px}
.payment-box p{font-size:12px;color:#78350f}
.transfer-content{font-size:16px;font-weight:700;color:#dc2626;font-family:monospace;margin:8px 0}
.footer{margin-top:32px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px}
@media print{body{padding:20px}}</style></head>
<body>
<div class="header"><h1>${centerName}</h1>
${centerAddress ? `<p>${centerAddress}</p>` : ''}
${centerPhone ? `<p>ĐT: ${centerPhone}</p>` : ''}
<p style="margin-top:8px;font-size:16px;font-weight:700;color:#1e293b">PHIẾU THÔNG BÁO HỌC PHÍ</p></div>
<div class="section"><h2>Thông tin học viên</h2>
<div class="row border"><span class="label">Họ tên:</span><span class="value">${e(student.name)}</span></div>
<div class="row border"><span class="label">Mã HV:</span><span class="value">${e(student.id)}</span></div>
<div class="row border"><span class="label">Kỳ thanh toán:</span><span class="value">${e(invoice.month)}</span></div>
<div class="row"><span class="label">Ngày lập:</span><span class="value">${new Date(invoice.generatedDate).toLocaleDateString('vi-VN')}</span></div></div>
<div class="section"><h2>Chi tiết học phí</h2>
${od > 0 ? `<div class="row border"><span class="label">Dư nợ kỳ trước</span><span class="value">${formatCurrency(od)}</span></div>` : ''}
${oc > 0 ? `<div class="row border"><span class="label">Số dư trả trước</span><span class="value" style="color:#16a34a">-${formatCurrency(oc)}</span></div>` : ''}
<div class="row border"><span class="label">Học phí phát sinh</span><span class="value">${formatCurrency(invoice.amount)}</span></div>
<div class="details">${e(invoice.details)}</div>
<div class="total-row"><span>TỔNG THANH TOÁN</span><span>${formatCurrency(td)}</span></div></div>
${td > 0 && settings.bankAccountNumber ? `<div class="payment-box">
<h3>Thông tin chuyển khoản</h3>
<p>Ngân hàng: <strong>${e(settings.bankName || '')}</strong></p>
<p>Số TK: <strong>${e(settings.bankAccountNumber)}</strong></p>
<p>Chủ TK: <strong>${e(settings.bankAccountHolder || '')}</strong></p>
<p style="margin-top:8px">Nội dung chuyển khoản:</p>
<p class="transfer-content">${e(transferContent)}</p>
${qrUrl ? `<img src="${qrUrl}" style="width:180px;height:180px;margin:8px auto;display:block" alt="QR thanh toán" />` : ''}
</div>` : ''}
<div class="footer"><p>Phiếu được tạo tự động bởi hệ thống ${centerName}</p></div>
</body></html>`;
        printHtml(html);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Chi tiết Hóa đơn #${invoice.id.slice(-6)}`}>
            {/* Hidden component for image download */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                <TuitionFeeNotice ref={noticeRef} invoice={invoice} />
            </div>
            
            <div className="space-y-6">
                {/* Header Info */}
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <h3 className="text-lg font-semibold text-primary">{student.name} ({student.id})</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
                        <p><span className="text-slate-500 dark:text-slate-400">Kỳ thanh toán:</span> {invoice.month}</p>
                        <p><span className="text-slate-500 dark:text-slate-400">Ngày lập:</span> {new Date(invoice.generatedDate).toLocaleDateString('vi-VN')}</p>
                    </div>
                </div>

                {/* Financial Details */}
                <div className="space-y-2 text-sm">
                    {Math.round(outstandingDebt) > 0 && (
                        <div className="flex justify-between items-center py-2 border-b dark:border-slate-700">
                            <span className="text-slate-500 dark:text-slate-400">Dư nợ kỳ trước</span>
                            <span className="font-semibold">{formatCurrency(outstandingDebt)}</span>
                        </div>
                    )}
                    {Math.round(openingCredit) > 0 && (
                         <div className="flex justify-between items-center py-2 border-b dark:border-slate-700">
                            <span className="text-slate-500 dark:text-slate-400">Số dư/Đã trả kỳ trước</span>
                            <span className="font-semibold text-green-600 dark:text-green-400">-{formatCurrency(openingCredit)}</span>
                        </div>
                    )}
                    <div className="py-2 border-b dark:border-slate-700">
                         <div className="flex justify-between items-start">
                             <span className="text-slate-500 dark:text-slate-400">Học phí phát sinh trong kỳ</span>
                             <span className="font-semibold">{formatCurrency(invoice.amount)}</span>
                         </div>
                         <div className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-1 pl-4 space-y-1">
                             {invoice.details.split('\n').map((line, idx) => {
                                 if (!line.trim()) return null;
                                 const match = line.match(/(.*?)(\((?:Đi học:\s+)?\d+\/\d+\s+buổi[^\)]*\))(.*)/);

                                 if (match) {
                                     return <div key={idx}>{match[1]}<strong className="text-indigo-600 dark:text-indigo-400 font-semibold">{match[2]}</strong>{match[3]}</div>;
                                 }
                                 return <div key={idx}>{line}</div>;
                             })}
                         </div>
                    </div>
                    <div className="flex justify-between items-center pt-3">
                         <span className="text-base font-bold text-primary">Tổng thanh toán</span>
                         <span className="text-xl font-bold text-primary">{formatCurrency(totalDue)}</span>
                    </div>
                </div>

                {/* Payment Info */}
                {totalDue > 0 && (
                    <div className="pt-4 border-t dark:border-slate-700">
                        <h3 className="font-semibold mb-3 text-center">Thông tin thanh toán</h3>
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="flex-1 text-sm space-y-2 w-full">
                                <p><span className="font-semibold">Ngân hàng:</span> {settings.bankName}</p>
                                <p><span className="font-semibold">Số tài khoản:</span> {settings.bankAccountNumber}</p>
                                <p><span className="font-semibold">Chủ tài khoản:</span> {settings.bankAccountHolder}</p>
                                <div className="mt-2 p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg text-center">
                                    <p className="font-bold text-yellow-800 dark:text-yellow-200">Nội dung CK:</p>
                                    <div className="flex items-center justify-center gap-2 mt-1">
                                      <p className="text-red-600 font-mono font-bold break-all">{transferContent}</p>
                                      <button onClick={() => handleCopy(transferContent)} className="p-1.5 rounded-full hover:bg-yellow-200 dark:hover:bg-yellow-800/50" title="Sao chép nội dung">
                                          {ICONS.copy}
                                      </button>
                                    </div>
                                </div>
                            </div>
                            {qrCodeUrl && (
                                <div className="text-center bg-white p-2 rounded-lg border border-gray-200 flex-shrink-0">
                                    <img 
                                        src={qrCodeUrl} 
                                        alt="QR Code Thanh toán" 
                                        className="w-32 h-32 object-contain" 
                                        style={{ imageRendering: 'pixelated' }}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-4 mt-6 pt-4 border-t dark:border-gray-700">
                <Button variant="secondary" onClick={onClose}>
                    Đóng
                </Button>
                <Button variant="secondary" onClick={handleExportPdf}>
                    📄 Xuất PDF
                </Button>
                <Button onClick={handleDownloadImage} isLoading={isDownloading} disabled={isDownloading}>
                    {ICONS.download} Tải ảnh phiếu
                </Button>
            </div>
        </Modal>
    );
};
