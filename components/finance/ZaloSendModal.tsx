
import React, { useRef, useState, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { DebtNotice } from './DebtNotice';
import { TuitionFeeNotice } from './TuitionFeeNotice';
import { Student, Invoice } from '../../types';
import { useData } from '../../hooks/useDataContext';
import { useToast } from '../../hooks/useToast';
import { copyAndOpenZalo, buildDebtMessage, getStudentZaloPhone } from '../../utils/zaloDeepLink';

declare global {
    interface Window {
        html2canvas: any;
        ClipboardItem: any;
    }
}

interface ZaloSendModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: Student | null;
    /** If provided, uses TuitionFeeNotice for single invoice; otherwise uses DebtNotice for overall debt */
    invoice?: Invoice | null;
}

export const ZaloSendModal: React.FC<ZaloSendModalProps> = ({ isOpen, onClose, student, invoice }) => {
    const { state } = useData();
    const { settings, transactions, invoices, attendance, classes } = state;
    const { toast } = useToast();
    const noticeRef = useRef<HTMLDivElement>(null);
    const [isSendingText, setIsSendingText] = useState(false);
    const [isSendingImage, setIsSendingImage] = useState(false);

    const zaloPhone = useMemo(() => {
        if (!student) return null;
        return getStudentZaloPhone(student);
    }, [student]);

    const unpaidInvoices = useMemo(() => {
        if (!student) return [];
        return invoices
            .filter(inv => inv.studentId === student.id && inv.status === 'UNPAID')
            .sort((a, b) => a.month.localeCompare(b.month));
    }, [student, invoices]);

    const studentTransactions = useMemo(() => {
        if (!student) return [];
        return transactions.filter(t => t.studentId === student.id);
    }, [student, transactions]);

    const handleSendText = async () => {
        if (!student || !zaloPhone) return;
        setIsSendingText(true);
        try {
            const totalDebt = unpaidInvoices.length > 0
                ? unpaidInvoices.reduce((sum, inv) => sum + inv.amount, 0)
                : Math.abs(student.balance);

            const message = buildDebtMessage({
                centerName: settings.name || 'Trung tâm',
                centerPhone: settings.phone,
                bankName: settings.bankName,
                bankAccountNumber: settings.bankAccountNumber,
                bankAccountHolder: settings.bankAccountHolder,
                parentName: student.parentName || 'Phụ huynh',
                studentName: student.name,
                invoices: unpaidInvoices.map(inv => ({ month: inv.month, amount: inv.amount })),
                totalDebt,
                customTemplate: settings.messageTemplates?.tuitionReminder,
            });

            const result = await copyAndOpenZalo(zaloPhone, message);
            if (result.success) {
                toast.success('Đã chép nội dung văn bản. Zalo đang mở — hãy dán (Ctrl+V) và gửi!');
                onClose();
            } else {
                toast.error(result.error || 'Lỗi khi mở Zalo.');
            }
        } finally {
            setIsSendingText(false);
        }
    };

    const handleSendImage = async () => {
        if (!student || !zaloPhone || !noticeRef.current) return;
        setIsSendingImage(true);
        try {
            // Wait for QR image to load
            await new Promise(resolve => setTimeout(resolve, 300));

            if (!window.html2canvas) {
                toast.error('Không tìm thấy thư viện tạo ảnh. Vui lòng tải lại trang.');
                return;
            }

            const canvas = await window.html2canvas(noticeRef.current, { scale: 2.5, useCORS: true });

            // Try clipboard copy first
            let copiedToClipboard = false;
            try {
                const blob = await new Promise<Blob | null>((resolve) => {
                    canvas.toBlob((b: Blob | null) => resolve(b), 'image/png');
                });
                if (blob && navigator.clipboard && window.ClipboardItem) {
                    await navigator.clipboard.write([
                        new window.ClipboardItem({ 'image/png': blob })
                    ]);
                    copiedToClipboard = true;
                }
            } catch (clipErr) {
                console.warn('Clipboard copy failed, falling back to download:', clipErr);
            }

            if (!copiedToClipboard) {
                // Fallback: download image
                const link = document.createElement('a');
                link.download = `TBHP_${student.id}_${student.name.replace(/\s/g, '_')}.png`;
                link.href = canvas.toDataURL('image/png');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.info('Ảnh đã tải về. Hãy mở Zalo và gửi ảnh cho phụ huynh.');
            } else {
                toast.success('Đã chép ảnh hóa đơn. Zalo đang mở — hãy dán (Ctrl+V) và gửi!');
            }

            // Open Zalo
            const normalized = zaloPhone.replace(/[\s\-().]/g, '').replace(/^\+84/, '0');
            window.open(`https://zalo.me/${normalized}`, '_blank');
            onClose();
        } catch (error) {
            console.error('Error generating image:', error);
            toast.error('Lỗi khi tạo ảnh hóa đơn.');
        } finally {
            setIsSendingImage(false);
        }
    };

    if (!student) return null;

    const isProcessing = isSendingText || isSendingImage;
    const hasDebt = student.balance < 0;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Gửi Zalo — ${student.name}`}>
            {/* Hidden render area for html2canvas */}
            <div style={{ position: 'absolute', left: '-9999px', width: '10.5cm' }}>
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
                </div>

                {!zaloPhone ? (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg text-center">
                        <p className="text-yellow-800 dark:text-yellow-200 font-semibold">⚠️ Chưa có SĐT để gửi Zalo</p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">Vui lòng cập nhật SĐT phụ huynh hoặc SĐT trong mục Học viên.</p>
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Chọn hình thức gửi:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Text option */}
                            <button
                                onClick={handleSendText}
                                disabled={isProcessing}
                                className="flex flex-col items-center gap-3 p-5 border-2 border-blue-200 dark:border-blue-700 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-400 dark:hover:border-blue-500 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                                    📝
                                </div>
                                <div className="text-center">
                                    <p className="font-semibold text-blue-700 dark:text-blue-300">Gửi văn bản</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Copy tin nhắn → Mở Zalo → Dán & Gửi</p>
                                </div>
                                {isSendingText && <span className="text-xs text-blue-500 animate-pulse">Đang xử lý...</span>}
                            </button>

                            {/* Image option */}
                            <button
                                onClick={handleSendImage}
                                disabled={isProcessing}
                                className="flex flex-col items-center gap-3 p-5 border-2 border-green-200 dark:border-green-700 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/30 hover:border-green-400 dark:hover:border-green-500 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                                    🖼️
                                </div>
                                <div className="text-center">
                                    <p className="font-semibold text-green-700 dark:text-green-300">Gửi ảnh hóa đơn</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Copy ảnh có QR → Mở Zalo → Dán & Gửi</p>
                                </div>
                                {isSendingImage && <span className="text-xs text-green-500 animate-pulse">Đang tạo ảnh...</span>}
                            </button>
                        </div>
                    </>
                )}

                <div className="flex justify-end pt-2 border-t dark:border-gray-700">
                    <Button variant="secondary" onClick={onClose} disabled={isProcessing}>Đóng</Button>
                </div>
            </div>
        </Modal>
    );
};
