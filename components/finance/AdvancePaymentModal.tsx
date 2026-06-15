import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { CurrencyInput } from '../common/CurrencyInput';
import { Student, FeeType } from '../../types';
import { useData } from '../../hooks/useDataContext';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import { ICONS } from '../../constants';
import { getVietnamTime } from '../../utils/date';
import { AdvancePaymentNotice } from './AdvancePaymentNotice';

interface AdvancePaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    preselectedStudent?: Student | null;
}

const formatCurrency = (amount: number) => `${Math.round(amount).toLocaleString('vi-VN')} ₫`;

const normalizeAccountName = (name: string) => {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase();
};

export const AdvancePaymentModal: React.FC<AdvancePaymentModalProps> = ({ isOpen, onClose, preselectedStudent }) => {
    const { state, addAdjustment } = useData();
    const { toast } = useToast();
    const { user } = useAuth();
    const recorderName = user?.name || 'Admin';

    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [months, setMonths] = useState(3);
    const [discountPercent, setDiscountPercent] = useState(0);
    const [customAmount, setCustomAmount] = useState(0);
    const [useCustomAmount, setUseCustomAmount] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'cash'>('transfer');
    const [isLoading, setIsLoading] = useState(false);
    const [showQR, setShowQR] = useState(false);
    const [date, setDate] = useState(getVietnamTime().substring(0, 16));
    const [isDownloading, setIsDownloading] = useState(false);
    const noticeRef = useRef<HTMLDivElement>(null);

    const activeStudents = useMemo(() =>
        state.students.filter(s => s.status === 'ACTIVE').sort((a, b) => a.name.localeCompare(b.name)),
        [state.students]
    );

    useEffect(() => {
        if (isOpen) {
            if (preselectedStudent) {
                setSelectedStudentId(preselectedStudent.id);
            } else {
                setSelectedStudentId('');
            }
            setMonths(3);
            setDiscountPercent(0);
            setCustomAmount(0);
            setUseCustomAmount(false);
            setPaymentMethod('transfer');
            setShowQR(false);
            setDate(getVietnamTime().substring(0, 16));
        }
    }, [isOpen, preselectedStudent]);

    const student = useMemo(() =>
        state.students.find(s => s.id === selectedStudentId) || null,
        [state.students, selectedStudentId]
    );

    // Calculate monthly tuition based on enrolled classes
    const monthlyEstimate = useMemo(() => {
        if (!student) return { total: 0, details: [] as { className: string; fee: number; type: string }[] };

        const enrolledClasses = state.classes.filter(c => c.studentIds.includes(student.id));
        let total = 0;
        const details: { className: string; fee: number; type: string }[] = [];

        for (const cls of enrolledClasses) {
            let fee = 0;
            let type = '';
            if (cls.fee.type === FeeType.MONTHLY) {
                fee = cls.fee.amount;
                type = 'Tháng';
            } else if (cls.fee.type === FeeType.PER_SESSION) {
                // Estimate: count schedule days per month (average ~4 weeks)
                const sessionsPerWeek = cls.schedule.length;
                const estimatedSessions = sessionsPerWeek * 4;
                fee = estimatedSessions * cls.fee.amount;
                type = `~${sessionsPerWeek * 4} buổi × ${Math.round(cls.fee.amount).toLocaleString('vi-VN')}đ`;
            } else if (cls.fee.type === FeeType.PER_COURSE) {
                // PER_COURSE is one-time, skip for monthly estimate
                continue;
            }
            total += fee;
            details.push({ className: cls.name, fee, type });
        }

        return { total: Math.round(total), details };
    }, [student, state.classes]);

    // Outstanding debt: negative balance means student owes money
    const outstandingDebt = useMemo(() => {
        if (!student || student.balance >= 0) return 0;
        return Math.abs(student.balance);
    }, [student]);

    const estimatedTotal = useMemo(() => {
        const base = monthlyEstimate.total * months;
        const discount = Math.round(base * (discountPercent / 100));
        const tuitionAfterDiscount = Math.max(0, base - discount);
        return tuitionAfterDiscount + outstandingDebt;
    }, [monthlyEstimate.total, months, discountPercent, outstandingDebt]);

    const finalAmount = useMemo(() => {
        return useCustomAmount ? customAmount : estimatedTotal;
    }, [useCustomAmount, customAmount, estimatedTotal]);

    // QR
    const transferContent = student ? `HOC PHI ${student.id}` : '';
    const { bankBin, bankAccountNumber, bankAccountHolder } = state.settings;
    const canGenerateQR = bankBin && bankAccountNumber && paymentMethod === 'transfer' && finalAmount > 0;
    const qrUrl = canGenerateQR
        ? `https://img.vietqr.io/image/${bankBin?.replace(/\s+/g, '')}-${bankAccountNumber?.replace(/\s+/g, '')}-compact2.png?amount=${finalAmount}&addInfo=${encodeURIComponent(transferContent)}${bankAccountHolder ? `&accountName=${encodeURIComponent(normalizeAccountName(bankAccountHolder))}` : ''}`
        : '';

    const handleSubmit = async () => {
        if (!student) { toast.error('Vui lòng chọn học viên.'); return; }
        if (finalAmount <= 0) { toast.error('Số tiền phải lớn hơn 0.'); return; }

        setIsLoading(true);
        try {
            const finalDate = date.length === 16 ? `${date}:00` : date;
            const desc = `Thu trước ${months} tháng HP${discountPercent > 0 ? ` (giảm ${discountPercent}%)` : ''} - ${recorderName}`;
            await addAdjustment({
                studentId: student.id,
                amount: finalAmount,
                date: finalDate,
                description: desc,
                type: 'CREDIT',
                paymentMethod,
            });
            toast.success(`Đã ghi nhận thu trước ${formatCurrency(finalAmount)} cho ${student.name}.`);
            onClose();
        } catch (error) {
            toast.error('Lỗi khi ghi nhận thanh toán.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadNotice = async () => {
        if (!noticeRef.current || !student || !window.html2canvas) {
            toast.error('Không thể tải ảnh phiếu thu.');
            return;
        }
        setIsDownloading(true);
        try {
            // Wait for QR image to load
            await new Promise(resolve => setTimeout(resolve, 300));
            const canvas = await window.html2canvas(noticeRef.current, { scale: 3, useCORS: true });
            const link = document.createElement('a');
            link.download = `PhieuThuTruoc_${student.id}_${months}thang.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            toast.success('Đã tải ảnh phiếu thu!');
        } catch (error) {
            console.error('Lỗi xuất phiếu thu:', error);
            toast.error('Lỗi khi xuất ảnh phiếu thu.');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="💰 Thu Học Phí Trước">
            <div className="space-y-5">
                {/* Student Selection */}
                <div>
                    <label className="block text-sm font-medium mb-1">Học viên</label>
                    <select
                        value={selectedStudentId}
                        onChange={e => setSelectedStudentId(e.target.value)}
                        className="form-select w-full"
                    >
                        <option value="">-- Chọn học viên --</option>
                        {activeStudents.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                        ))}
                    </select>
                    {student && (
                        <p className="text-xs mt-1">
                            Số dư hiện tại: <span className={student.balance >= 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>{formatCurrency(student.balance)}</span>
                        </p>
                    )}
                </div>

                {student && (
                    <>
                        {/* Monthly Estimate */}
                        {monthlyEstimate.details.length > 0 && (
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-sm">
                                <p className="font-semibold text-indigo-700 dark:text-indigo-300 mb-2">Ước tính học phí/tháng:</p>
                                {monthlyEstimate.details.map((d, i) => (
                                    <div key={i} className="flex justify-between py-0.5">
                                        <span>{d.className} <span className="text-xs text-gray-500">({d.type})</span></span>
                                        <span className="font-medium">{formatCurrency(d.fee)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between pt-1 mt-1 border-t border-indigo-200 dark:border-indigo-700 font-bold">
                                    <span>Tổng/tháng</span>
                                    <span>{formatCurrency(monthlyEstimate.total)}</span>
                                </div>
                            </div>
                        )}

                        {/* Months & Discount */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Số tháng thu trước</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={24}
                                    value={months}
                                    onChange={e => setMonths(Math.max(1, Math.min(24, parseInt(e.target.value) || 1)))}
                                    className="form-input w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Giảm giá (%)</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={discountPercent}
                                    onChange={e => setDiscountPercent(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                                    className="form-input w-full"
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        {/* Calculated Amount */}
                        <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                            {outstandingDebt > 0 && (
                                <div className="flex justify-between items-center text-sm text-red-600 dark:text-red-400 pb-1">
                                    <span>⚠️ Nợ cũ chưa đóng</span>
                                    <span className="font-semibold">{formatCurrency(outstandingDebt)}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center text-sm">
                                <span>HP {months} tháng ({formatCurrency(monthlyEstimate.total)}/tháng)</span>
                                <span>{formatCurrency(monthlyEstimate.total * months)}</span>
                            </div>
                            {discountPercent > 0 && (
                                <div className="flex justify-between items-center text-sm text-green-600 dark:text-green-400">
                                    <span>Giảm {discountPercent}%</span>
                                    <span>-{formatCurrency(Math.round(monthlyEstimate.total * months * discountPercent / 100))}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center font-bold text-lg mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-700">
                                <span>Tổng cần thu</span>
                                <span className="text-emerald-700 dark:text-emerald-300">{formatCurrency(estimatedTotal)}</span>
                            </div>
                        </div>

                        {/* Custom Amount Override */}
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="useCustomAmount"
                                checked={useCustomAmount}
                                onChange={e => { setUseCustomAmount(e.target.checked); if (e.target.checked) setCustomAmount(estimatedTotal); }}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="useCustomAmount" className="text-sm">Nhập số tiền tùy chỉnh</label>
                        </div>
                        {useCustomAmount && (
                            <div>
                                <label className="block text-sm font-medium mb-1">Số tiền (VND)</label>
                                <CurrencyInput value={customAmount} onChange={setCustomAmount} className="form-input w-full" />
                            </div>
                        )}

                        {/* Payment Method & Date */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Hình thức</label>
                                <select value={paymentMethod} onChange={e => { setPaymentMethod(e.target.value as any); if (e.target.value === 'cash') setShowQR(false); }} className="form-select w-full">
                                    <option value="transfer">Chuyển khoản</option>
                                    <option value="cash">Tiền mặt</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Ngày ghi nhận</label>
                                <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} className="form-input w-full" />
                            </div>
                        </div>

                        {/* QR */}
                        {paymentMethod === 'transfer' && canGenerateQR && (
                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={() => setShowQR(!showQR)}
                                    className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline text-sm inline-flex items-center gap-1"
                                >
                                    {ICONS.finance} {showQR ? 'Ẩn mã QR' : 'Hiện mã QR thanh toán'}
                                </button>
                                {showQR && (
                                    <div className="mt-3 inline-block bg-white p-3 rounded-xl shadow-sm border border-gray-200">
                                        <img src={qrUrl} alt="VietQR" className="w-[200px] h-auto object-contain" />
                                        <p className="text-xs text-gray-500 mt-2">Nội dung CK: <strong className="text-red-600 font-mono">{transferContent}</strong></p>
                                        <button
                                            type="button"
                                            onClick={() => { navigator.clipboard.writeText(transferContent); toast.success('Đã copy!'); }}
                                            className="text-xs text-indigo-500 hover:underline mt-1 inline-flex items-center gap-1"
                                        >
                                            {ICONS.copy} Copy nội dung CK
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* Actions */}
                <div className="flex flex-wrap justify-end gap-3 pt-4 border-t dark:border-gray-700">
                    <Button variant="secondary" onClick={onClose}>Hủy</Button>
                    {student && finalAmount > 0 && (
                        <Button variant="secondary" onClick={handleDownloadNotice} isLoading={isDownloading} disabled={isDownloading}>
                            {ICONS.download} Tải phiếu thu
                        </Button>
                    )}
                    <Button onClick={handleSubmit} isLoading={isLoading} disabled={!student || finalAmount <= 0}>
                        Xác nhận Ghi sổ ({student ? formatCurrency(finalAmount) : '0 ₫'})
                    </Button>
                </div>
            </div>

            {/* Hidden render target for image export */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                {student && (
                    <AdvancePaymentNotice
                        ref={noticeRef}
                        studentId={student.id}
                        months={months}
                        discountPercent={discountPercent}
                        finalAmount={finalAmount}
                    />
                )}
            </div>
        </Modal>
    );
};
