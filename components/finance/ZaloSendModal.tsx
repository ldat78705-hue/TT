
import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { DebtNotice } from './DebtNotice';
import { TuitionFeeNotice } from './TuitionFeeNotice';
import { Student, Invoice } from '../../types';
import { useData } from '../../hooks/useDataContext';
import { useToast } from '../../hooks/useToast';
import { copyAndOpenZalo, buildDebtMessage, getStudentZaloPhone, getZaloDeepLink } from '../../utils/zaloDeepLink';
import { addReminderEntry, getLastReminderLabel } from '../../utils/zaloReminderHistory';

declare global {
    interface Window {
        html2canvas: any;
        ClipboardItem: any;
    }
}

type ModalStep = 'choose' | 'preview-text' | 'preview-image';

interface ZaloSendModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: Student | null;
    /** If provided, uses TuitionFeeNotice for single invoice; otherwise uses DebtNotice for overall debt */
    invoice?: Invoice | null;
    /** Source screen for history tracking */
    source?: string;
    /** Callback after sending successfully — used for refresh "đã nhắc" badges */
    onSent?: () => void;
}

export const ZaloSendModal: React.FC<ZaloSendModalProps> = ({ isOpen, onClose, student, invoice, source = 'general', onSent }) => {
    const { state } = useData();
    const { settings, transactions, invoices, attendance, classes } = state;
    const { toast } = useToast();
    const noticeRef = useRef<HTMLDivElement>(null);
    const [step, setStep] = useState<ModalStep>('choose');
    const [isSending, setIsSending] = useState(false);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

    // Reset states when modal opens/closes or student changes (bulk queue)
    useEffect(() => {
        if (isOpen) {
            setStep('choose');
            setIsSending(false);
            setPreviewImageUrl(null);
        }
    }, [isOpen, student]);

    const zaloPhone = useMemo(() => {
        if (!student) return null;
        return getStudentZaloPhone(student);
    }, [student]);

    // Bug #2 fix: When invoice is provided, only use that invoice; otherwise use all unpaid
    const relevantInvoices = useMemo(() => {
        if (!student) return [];
        if (invoice) {
            // Single invoice mode — only this invoice
            return [invoice];
        }
        return invoices
            .filter(inv => inv.studentId === student.id && inv.status === 'UNPAID')
            .sort((a, b) => a.month.localeCompare(b.month));
    }, [student, invoice, invoices]);

    const studentTransactions = useMemo(() => {
        if (!student) return [];
        return transactions.filter(t => t.studentId === student.id);
    }, [student, transactions]);

    // Bug #1 fix: Use consistent debt amount
    const debtAmount = useMemo(() => {
        if (!student) return 0;
        if (invoice) {
            // Single invoice mode — use invoice amount
            return invoice.amount;
        }
        // Debt mode — use |balance| for consistency with DebtNotice
        return student.balance < 0 ? Math.abs(student.balance) : 0;
    }, [student, invoice]);

    // Build text message (used for preview and sending)
    const textMessage = useMemo(() => {
        if (!student) return '';
        return buildDebtMessage({
            centerName: settings.name || 'Trung tâm',
            centerPhone: settings.phone,
            bankName: settings.bankName,
            bankAccountNumber: settings.bankAccountNumber,
            bankAccountHolder: settings.bankAccountHolder,
            parentName: student.parentName || 'Phụ huynh',
            studentName: student.name,
            invoices: relevantInvoices.map(inv => ({ month: inv.month, amount: inv.amount })),
            totalDebt: debtAmount,
            customTemplate: settings.messageTemplates?.tuitionReminder,
        });
    }, [student, settings, relevantInvoices, debtAmount]);

    const lastReminderLabel = useMemo(() => {
        if (!student) return null;
        return getLastReminderLabel(student.id);
    }, [student, isOpen]); // re-check on open

    // Log reminder to history
    const logReminder = useCallback((method: 'text' | 'image') => {
        if (!student || !zaloPhone) return;
        addReminderEntry({
            studentId: student.id,
            studentName: student.name,
            parentName: student.parentName,
            phone: zaloPhone,
            method,
            invoiceId: invoice?.id,
            source,
            amount: debtAmount,
        });
        onSent?.();
    }, [student, zaloPhone, invoice, source, debtAmount, onSent]);

    const handlePreviewText = () => setStep('preview-text');

    const handlePreviewImage = async () => {
        if (!noticeRef.current) return;
        setIsSending(true);
        try {
            if (!window.html2canvas) {
                toast.error('Không tìm thấy thư viện tạo ảnh. Vui lòng tải lại trang.');
                return;
            }

            // Wait for images to load
            const images = noticeRef.current.querySelectorAll('img');
            if (images.length > 0) {
                await Promise.all(
                    Array.from(images).map(img => {
                        if (img.complete) return Promise.resolve();
                        return new Promise<void>((resolve) => {
                            img.onload = () => resolve();
                            img.onerror = () => resolve();
                            setTimeout(resolve, 3000);
                        });
                    })
                );
                await new Promise(resolve => setTimeout(resolve, 200));
            } else {
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            const canvas = await window.html2canvas(noticeRef.current, { scale: 2.5, useCORS: true });
            const dataUrl = canvas.toDataURL('image/png');
            setPreviewImageUrl(dataUrl);
            setStep('preview-image');
        } catch (error) {
            console.error('Error generating preview:', error);
            toast.error('Lỗi khi tạo ảnh xem trước.');
        } finally {
            setIsSending(false);
        }
    };

    const handleConfirmSendText = async () => {
        if (!student || !zaloPhone) return;
        setIsSending(true);
        try {
            const result = await copyAndOpenZalo(zaloPhone, textMessage);
            if (result.success) {
                logReminder('text');
                toast.success('Đã chép nội dung. Zalo đang mở — hãy dán và gửi!');
                onClose();
            } else {
                toast.error(result.error || 'Lỗi khi mở Zalo.');
            }
        } finally {
            setIsSending(false);
        }
    };

    const handleConfirmSendImage = async () => {
        if (!student || !zaloPhone || !previewImageUrl) return;
        setIsSending(true);
        try {
            // Convert data URL back to blob
            const response = await fetch(previewImageUrl);
            const blob = await response.blob();

            let copiedToClipboard = false;
            try {
                if (navigator.clipboard && window.ClipboardItem) {
                    await navigator.clipboard.write([
                        new window.ClipboardItem({ 'image/png': blob })
                    ]);
                    copiedToClipboard = true;
                }
            } catch (clipErr) {
                console.warn('Clipboard copy failed, falling back to download:', clipErr);
            }

            if (!copiedToClipboard) {
                const link = document.createElement('a');
                link.download = `TBHP_${student.id}_${student.name.replace(/\s/g, '_')}.png`;
                link.href = previewImageUrl;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.info('Ảnh đã tải về. Hãy mở Zalo và gửi ảnh cho phụ huynh.');
            } else {
                toast.success('Đã chép ảnh. Zalo đang mở — hãy dán và gửi!');
            }

            logReminder('image');
            window.open(getZaloDeepLink(zaloPhone), '_blank');
            onClose();
        } catch (error) {
            console.error('Error sending image:', error);
            toast.error('Lỗi khi gửi ảnh hóa đơn.');
        } finally {
            setIsSending(false);
        }
    };

    if (!student) return null;

    const isProcessing = isSending;
    const hasDebt = student.balance < 0;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Gửi Zalo — ${student.name}`}>
            {/* Hidden render area for html2canvas */}
            <div style={{ position: 'absolute', left: '-9999px', width: invoice ? '210mm' : '10.5cm' }}>
                <div ref={noticeRef}>
                    {invoice ? (
                        <TuitionFeeNotice invoice={invoice} />
                    ) : (
                        <DebtNotice
                            student={student}
                            transactions={studentTransactions}
                            settings={settings}
                            attendance={attendance}
                            classes={classes}
                        />
                    )}
                </div>
            </div>

            <div className="space-y-4">
                {/* Student info */}
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-sm">
                    <p><span className="font-semibold">Học viên:</span> {student.name}</p>
                    {student.parentName && <p><span className="font-semibold">Phụ huynh:</span> {student.parentName}</p>}
                    <p><span className="font-semibold">SĐT Zalo:</span> {zaloPhone || <span className="text-red-500">Chưa có</span>}</p>
                    {hasDebt && <p><span className="font-semibold">Công nợ:</span> <span className="text-red-600 font-bold">{Math.abs(student.balance).toLocaleString('vi-VN')} ₫</span></p>}
                    {lastReminderLabel && (
                        <p className="mt-1"><span className="font-semibold">Lần nhắc gần nhất:</span> <span className="text-amber-600 dark:text-amber-400 text-xs font-medium">🔔 {lastReminderLabel}</span></p>
                    )}
                </div>

                {!zaloPhone ? (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg text-center">
                        <p className="text-yellow-800 dark:text-yellow-200 font-semibold">⚠️ Chưa có SĐT để gửi Zalo</p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">Vui lòng cập nhật SĐT phụ huynh hoặc SĐT trong mục Học viên.</p>
                    </div>
                ) : step === 'choose' ? (
                    <>
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Chọn hình thức gửi:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Text option */}
                            <button
                                onClick={handlePreviewText}
                                disabled={isProcessing}
                                className="flex flex-col items-center gap-3 p-5 border-2 border-blue-200 dark:border-blue-700 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-400 dark:hover:border-blue-500 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                                    📝
                                </div>
                                <div className="text-center">
                                    <p className="font-semibold text-blue-700 dark:text-blue-300">Gửi văn bản</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Copy tin nhắn → Mở Zalo → Dán &amp; Gửi</p>
                                </div>
                            </button>

                            {/* Image option */}
                            <button
                                onClick={handlePreviewImage}
                                disabled={isProcessing}
                                className="flex flex-col items-center gap-3 p-5 border-2 border-green-200 dark:border-green-700 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/30 hover:border-green-400 dark:hover:border-green-500 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                                    🖼️
                                </div>
                                <div className="text-center">
                                    <p className="font-semibold text-green-700 dark:text-green-300">Gửi ảnh hóa đơn</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Copy ảnh có QR → Mở Zalo → Dán &amp; Gửi</p>
                                </div>
                                {isSending && <span className="text-xs text-green-500 animate-pulse">Đang tạo ảnh...</span>}
                            </button>
                        </div>
                    </>
                ) : step === 'preview-text' ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
                            <span className="text-lg">📝</span> Xem trước nội dung văn bản
                        </div>
                        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 max-h-64 overflow-y-auto">
                            <pre className="text-xs whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-200 leading-relaxed">{textMessage}</pre>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t dark:border-gray-700">
                            <Button variant="secondary" onClick={() => setStep('choose')} disabled={isProcessing} size="sm">← Quay lại</Button>
                            <Button onClick={handleConfirmSendText} disabled={isProcessing} isLoading={isProcessing}>
                                📋 Copy &amp; Mở Zalo
                            </Button>
                        </div>
                    </div>
                ) : step === 'preview-image' ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-300">
                            <span className="text-lg">🖼️</span> Xem trước ảnh hóa đơn
                        </div>
                        {previewImageUrl && (
                            <div className="bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-gray-600 rounded-lg p-2 max-h-72 overflow-y-auto flex justify-center">
                                <img src={previewImageUrl} alt="Preview" className="max-w-full h-auto rounded shadow-sm" style={{ maxHeight: '260px' }} />
                            </div>
                        )}
                        <div className="flex justify-between items-center pt-2 border-t dark:border-gray-700">
                            <Button variant="secondary" onClick={() => setStep('choose')} disabled={isProcessing} size="sm">← Quay lại</Button>
                            <Button onClick={handleConfirmSendImage} disabled={isProcessing} isLoading={isProcessing}>
                                📋 Copy ảnh &amp; Mở Zalo
                            </Button>
                        </div>
                    </div>
                ) : null}

                {step === 'choose' && (
                    <div className="flex justify-end pt-2 border-t dark:border-gray-700">
                        <Button variant="secondary" onClick={onClose} disabled={isProcessing}>Đóng</Button>
                    </div>
                )}
            </div>
        </Modal>
    );
};
