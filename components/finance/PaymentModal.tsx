
import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { CurrencyInput } from '../common/CurrencyInput';
import { Student } from '../../types';
import { useData } from '../../hooks/useDataContext';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import { ICONS } from '../../constants';
import { generateQRDataUrl } from '../../utils/vietqr';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: Student | null;
}

import { getVietnamTime } from '../../utils/date';

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, student }) => {
    const { state, addAdjustment } = useData();
    const { toast } = useToast();
    const { user } = useAuth();
    const recorderName = user?.name || 'Không rõ';

    const [amount, setAmount] = useState(0);
    const [date, setDate] = useState(getVietnamTime().substring(0, 16));
    const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'cash'>('transfer');
    const [isLoading, setIsLoading] = useState(false);
    const [showQR, setShowQR] = useState(false);
    // After-payment state
    const [paymentRecorded, setPaymentRecorded] = useState(false);
    const [recordedAmount, setRecordedAmount] = useState(0);
    const [isSendingZalo, setIsSendingZalo] = useState(false);
    const [zaloSent, setZaloSent] = useState(false);

    // Track previous isOpen to detect open transition
    const prevIsOpenRef = React.useRef(false);
    
    // QR state — MUST be before any early return (Rules of Hooks)
    const [qrUrl, setQrUrl] = useState('');

    useEffect(() => {
        // Only reset when modal OPENS (false → true), not when student data updates
        const justOpened = isOpen && !prevIsOpenRef.current;
        prevIsOpenRef.current = isOpen;
        
        if (justOpened && student) {
            if (student.balance < 0) {
                setAmount(Math.abs(student.balance));
            } else {
                setAmount(0);
            }
            setDate(getVietnamTime().substring(0, 16));
            setPaymentMethod('transfer');
            setShowQR(false);
            // Reset after-payment state
            setPaymentRecorded(false);
            setRecordedAmount(0);
            setIsSendingZalo(false);
            setZaloSent(false);
        }
    }, [student, isOpen]);

    // QR generation effect — also before early return
    const { bankBin, bankAccountNumber, bankAccountHolder } = state.settings;
    const studentId = student?.id || '';
    const canGenerateQR = !!(bankBin && bankAccountNumber && paymentMethod === 'transfer' && amount > 0 && student);
    const transferDescription = studentId ? `HOC PHI ${studentId}` : '';

    useEffect(() => {
        if (!canGenerateQR) {
            setQrUrl('');
            return;
        }
        generateQRDataUrl({
            bankBin: bankBin!,
            accountNo: bankAccountNumber!,
            accountName: bankAccountHolder || undefined,
            amount,
            content: transferDescription,
        }).then(url => setQrUrl(url || ''));
    }, [canGenerateQR, bankBin, bankAccountNumber, bankAccountHolder, amount, transferDescription]);

    if (!student) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (amount <= 0) {
            toast.error("Số tiền thanh toán phải lớn hơn 0.");
            return;
        }
        setIsLoading(true);
        try {
            const finalDate = date.length === 16 ? `${date}:00` : date;
            await addAdjustment({
                studentId: student.id,
                amount: amount,
                date: finalDate,
                description: `Thanh toán HP - ghi nhận bởi ${recorderName} (Web)`,
                type: 'CREDIT',
                paymentMethod: paymentMethod,
            });

            toast.success(`Ghi nhận thanh toán ${amount.toLocaleString('vi-VN')} ₫ cho ${student.name}.`);
            setRecordedAmount(amount);
            setPaymentRecorded(true);
        } catch (error) {
            console.error(error);
            toast.error("Lỗi khi ghi nhận thanh toán.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendZaloConfirm = async () => {
        if (!student) return;
        setIsSendingZalo(true);
        try {
            let token = '';
            try {
                const session = JSON.parse(localStorage.getItem('educenter_user_session') || '{}');
                token = session.token || '';
            } catch { /* ignore parse error */ }
            const res = await fetch('/api/zalo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    action: 'sendPaymentConfirm',
                    studentId: student.id,
                    studentName: student.name,
                    parentName: student.parentName || 'Phụ huynh',
                    parentPhone: student.parentPhone || student.phone || '',
                    zaloUserId: student.zaloUserId || '',
                    amount: recordedAmount,
                    className: state.classes.filter(c => c.studentIds?.includes(student.id)).map(c => c.name).join(', '),
                }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Đã gửi xác nhận thanh toán cho PHHS!');
                setZaloSent(true);
            } else {
                toast.error(data.error || 'Không thể gửi xác nhận. Kiểm tra cấu hình Zalo/SLL.');
            }
        } catch (err) {
            console.error(err);
            toast.error('Lỗi kết nối khi gửi xác nhận.');
        } finally {
            setIsSendingZalo(false);
        }
    };

    // Check if can send Zalo (has phone or zaloUserId)
    const canSendZalo = !!(student.parentPhone?.trim() || student.phone?.trim() || student.zaloUserId?.trim());

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={paymentRecorded ? `✅ Đã ghi nhận thanh toán` : `Thanh toán cho ${student.name}`}>
            {paymentRecorded ? (
                /* === AFTER PAYMENT RECORDED === */
                <div className="space-y-4">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
                        <div className="text-3xl mb-2">✅</div>
                        <p className="font-semibold text-green-700 dark:text-green-300">
                            Đã ghi nhận {recordedAmount.toLocaleString('vi-VN')} ₫
                        </p>
                        <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                            Học viên: {student.name}
                        </p>
                    </div>

                    {/* Send Zalo Confirmation */}
                    {canSendZalo && !zaloSent && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                                Gửi tin nhắn xác nhận thanh toán cho phụ huynh qua Zalo?
                            </p>
                            <Button
                                onClick={handleSendZaloConfirm}
                                isLoading={isSendingZalo}
                                className="w-full"
                            >
                                📩 Gửi xác nhận cho PHHS
                            </Button>
                        </div>
                    )}

                    {zaloSent && (
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
                            <p className="text-sm text-green-700 dark:text-green-300">
                                ✅ Đã gửi xác nhận cho phụ huynh
                            </p>
                        </div>
                    )}

                    {!canSendZalo && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                            <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                ⚠️ Học viên chưa có SĐT phụ huynh hoặc Zalo User ID nên không thể gửi xác nhận tự động.
                            </p>
                        </div>
                    )}

                    <div className="flex justify-end pt-2 border-t dark:border-gray-700">
                        <Button onClick={onClose}>Đóng</Button>
                    </div>
                </div>
            ) : (
                /* === PAYMENT FORM === */
                <div className="flex flex-col md:flex-row gap-6">
                    <form onSubmit={handleSubmit} className="flex-1 space-y-4">
                        <div>
                            <label className="block text-sm font-medium">Số tiền thanh toán (VND)</label>
                            <CurrencyInput value={amount} onChange={setAmount} className="form-input mt-1" />
                            <p className="text-xs text-gray-500 mt-1">
                                Hiện tại: <span className={student.balance < 0 ? 'text-red-500' : 'text-green-500'}>{student.balance.toLocaleString('vi-VN')} ₫</span>
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Hình thức thanh toán</label>
                            <select value={paymentMethod} onChange={e => {
                                setPaymentMethod(e.target.value as 'transfer' | 'cash');
                                if (e.target.value === 'cash') setShowQR(false);
                            }} className="form-select mt-1">
                                <option value="transfer">Chuyển khoản</option>
                                <option value="cash">Tiền mặt</option>
                            </select>
                        </div>
                        {paymentMethod === 'transfer' && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-3 rounded-md text-sm border border-blue-200 dark:border-blue-800">
                                <strong>Lưu ý quan trọng:</strong> Khi chuyển khoản, hãy yêu cầu phụ huynh gõ đúng cú pháp <code className="bg-white dark:bg-black px-1 rounded text-primary font-bold">{transferDescription}</code> để hệ thống tự động gạch nợ thành công đúng người.
                                {canGenerateQR && (
                                    <button 
                                        type="button" 
                                        onClick={() => setShowQR(!showQR)}
                                        className="mt-2 text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center gap-1"
                                    >
                                        {ICONS.finance} {showQR ? 'Ẩn mã QR' : 'Sinh mã QR (VietQR) chuẩn cú pháp'}
                                    </button>
                                )}
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium">Ngày thanh toán</label>
                            <input type="datetime-local" step="1" value={date} onChange={e => setDate(e.target.value)} className="form-input mt-1" required />
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                            <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
                            <Button type="submit" isLoading={isLoading}>Xác nhận Ghi sổ</Button>
                        </div>
                    </form>

                    {/* QR Code Column */}
                    {showQR && canGenerateQR && (
                        <div className="md:w-1/3 flex flex-col items-center justify-start border-l dark:border-gray-700 pl-0 md:pl-6 pt-6 md:pt-0">
                            <div className="text-center font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">QUÉT MÃ ĐỂ THANH TOÁN</div>
                            <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200">
                                <img src={qrUrl} alt="VietQR" className="w-[200px] h-auto object-contain" />
                            </div>
                            <div className="mt-4 text-center">
                                <p className="text-xs text-gray-500 mb-1">Cú pháp bắt buộc:</p>
                                <p className="font-mono font-bold text-lg text-primary">{transferDescription}</p>
                                <button 
                                    type="button"
                                    className="mt-2 text-xs text-gray-500 hover:text-gray-800 flex items-center justify-center gap-1 w-full"
                                    onClick={() => {
                                        navigator.clipboard.writeText(transferDescription);
                                        toast.success('Đã copy cú pháp!');
                                    }}
                                >
                                    Copy cú pháp
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
};
