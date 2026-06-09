
import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { CurrencyInput } from '../common/CurrencyInput';
import { Student } from '../../types';
import { useData } from '../../hooks/useDataContext';
import { useToast } from '../../hooks/useToast';
import { ICONS } from '../../constants';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: Student | null;
}

import { getVietnamTime } from '../../utils/date';

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, student }) => {
    const { state, addAdjustment } = useData();
    const { toast } = useToast();

    const [amount, setAmount] = useState(0);
    const [date, setDate] = useState(getVietnamTime().substring(0, 16));
    const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'cash'>('transfer');
    const [isLoading, setIsLoading] = useState(false);
    const [showQR, setShowQR] = useState(false);

    useEffect(() => {
        if (isOpen && student) {
            if (student.balance < 0) {
                setAmount(Math.abs(student.balance));
            } else {
                setAmount(0);
            }
            setDate(getVietnamTime().substring(0, 16)); // Reset date on open
            setPaymentMethod('transfer'); // Reset payment method
            setShowQR(false);
        }
    }, [student, isOpen]);

    if (!student) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (amount <= 0) {
            toast.error("Số tiền thanh toán phải lớn hơn 0.");
            return;
        }
        setIsLoading(true);
        try {
            // 1. Record the payment transaction
            const finalDate = date.length === 16 ? `${date}:00` : date;
            await addAdjustment({
                studentId: student.id,
                amount: amount,
                date: finalDate,
                description: `Thanh toán học phí trực tiếp`,
                type: 'CREDIT',
                paymentMethod: paymentMethod,
            });

            toast.success(`Ghi nhận thanh toán ${amount.toLocaleString('vi-VN')} ₫ cho ${student.name}.`);
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Lỗi khi ghi nhận thanh toán.");
        } finally {
            setIsLoading(false);
        }
    };

    // Chuẩn bị URL VietQR
    const { bankBin, bankAccountNumber, bankAccountHolder } = state.settings;
    const canGenerateQR = bankBin && bankAccountNumber && paymentMethod === 'transfer' && amount > 0;
    
    // Yêu cầu bắt buộc phải có cú pháp này để chặn triệt để nhầm lẫn
    const transferDescription = `HOC PHI ${student.id}`;
    
    const qrUrl = canGenerateQR 
        ? `https://img.vietqr.io/image/${bankBin}-${bankAccountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(transferDescription)}&accountName=${encodeURIComponent(bankAccountHolder || '')}`
        : '';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Thanh toán cho ${student.name}`}>
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
        </Modal>
    );
};
