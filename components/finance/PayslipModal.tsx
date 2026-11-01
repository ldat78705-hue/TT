
import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Payroll } from '../../types';
import { CurrencyInput } from '../common/CurrencyInput';
import { useData } from '../../hooks/useDataContext';
import { useToast } from '../../hooks/useToast';
import { PrintablePayslip } from './PrintablePayslip';
import { ICONS } from '../../constants';

interface PayslipModalProps {
    isOpen: boolean;
    onClose: () => void;
    payroll: Payroll | null;
    readOnly?: boolean; // For teachers viewing their own slip
}

export const PayslipModal: React.FC<PayslipModalProps> = ({ isOpen, onClose, payroll, readOnly = false }) => {
    const { updatePayroll, state } = useData();
    const { toast } = useToast();
    
    const [bonus, setBonus] = useState(0);
    const [deduction, setDeduction] = useState(0);
    const [status, setStatus] = useState<'PAID' | 'UNPAID'>('UNPAID');
    const [isDownloading, setIsDownloading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && payroll) {
            setBonus(payroll.bonus || 0);
            setDeduction(payroll.deduction || 0);
            setStatus(payroll.status || 'UNPAID');
        }
    }, [isOpen, payroll]);

    const totalSalary = payroll ? Math.max(0, Math.round(payroll.baseSalary + bonus - deduction)) : 0;

    const handleSave = async () => {
        if (!payroll) return;
        setIsSaving(true);
        try {
            await updatePayroll({
                payrollId: payroll.id,
                bonus,
                deduction,
                status
            });
            toast.success('Cập nhật bảng lương thành công!');
            onClose();
        } catch (error) {
            toast.error('Lỗi khi cập nhật.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownload = async () => {
        if (!printRef.current || !window.html2canvas || !payroll) return;
        setIsDownloading(true);
        try {
            const canvas = await window.html2canvas(printRef.current, { scale: 2, useCORS: true });
            const link = document.createElement('a');
            link.download = `PhieuLuong_${payroll.teacherName.replace(/\s/g, '_')}_${payroll.month}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            toast.error('Lỗi khi tải ảnh.');
        } finally {
            setIsDownloading(false);
        }
    };

    if (!payroll) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Chi tiết Lương: ${payroll.teacherName} (${payroll.month})`}>
            {/* Hidden printable area */}
            <div style={{ position: 'absolute', left: '-9999px' }}>
                <PrintablePayslip ref={printRef} payroll={{...payroll, bonus, deduction, totalSalary, status}} settings={state.settings} />
            </div>

            <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-gray-700 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Lương cơ bản {payroll.sessionsTaught > 0 ? `(${payroll.sessionsTaught} buổi)` : ''}:</span>
                        <span className="font-semibold">{payroll.baseSalary.toLocaleString('vi-VN')} ₫</span>
                    </div>
                    {payroll.classDetails && payroll.classDetails.length > 0 && (
                        <div className="mt-2 border-t border-gray-200 dark:border-gray-600 pt-2">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Chi tiết giảng dạy:</p>
                            <div className="space-y-1">
                                {payroll.classDetails.map((detail, idx) => (
                                    <div key={idx} className="flex justify-between text-xs">
                                        <span>{detail.className}</span>
                                        <span>{detail.sessionsTaught} buổi</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-2 flex justify-between items-center">
                        <span className="text-gray-500 dark:text-gray-400 font-medium">Thực lĩnh:</span>
                        <span className="font-bold text-xl text-primary">{totalSalary.toLocaleString('vi-VN')} ₫</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Thưởng thêm (VNĐ)</label>
                        <CurrencyInput 
                            value={bonus} 
                            onChange={readOnly ? () => {} : setBonus} 
                            className={`form-input ${readOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`} 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Khấu trừ / Phạt (VNĐ)</label>
                        <CurrencyInput 
                            value={deduction} 
                            onChange={readOnly ? () => {} : setDeduction} 
                            className={`form-input ${readOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`} 
                        />
                    </div>
                </div>

                {!readOnly && (
                    <div>
                        <label className="block text-sm font-medium mb-2">Trạng thái thanh toán</label>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <label className="flex items-center cursor-pointer p-3 border rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
                                <input 
                                    type="radio" 
                                    checked={status === 'UNPAID'} 
                                    onChange={() => setStatus('UNPAID')} 
                                    className="form-radio text-yellow-600 w-5 h-5"
                                />
                                <span className="ml-2 text-yellow-700 dark:text-yellow-400 font-medium">Chưa thanh toán</span>
                            </label>
                            <label className="flex items-center cursor-pointer p-3 border rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
                                <input 
                                    type="radio" 
                                    checked={status === 'PAID'} 
                                    onChange={() => setStatus('PAID')} 
                                    className="form-radio text-green-600 w-5 h-5"
                                />
                                <span className="ml-2 text-green-700 dark:text-green-400 font-medium">Đã thanh toán</span>
                            </label>
                        </div>
                        {status === 'PAID' && (
                            <p className="text-xs text-gray-500 mt-2">* Khi chọn "Đã thanh toán", hệ thống sẽ tự động tạo một khoản Chi phí lương.</p>
                        )}
                    </div>
                )}
                
                {readOnly && (
                     <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Trạng thái:</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${payroll.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {payroll.status === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                        </span>
                    </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3 pt-4 border-t dark:border-gray-700">
                    <Button variant="secondary" onClick={handleDownload} isLoading={isDownloading} className="w-full sm:w-auto justify-center">
                        {ICONS.download} Tải phiếu lương
                    </Button>
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto justify-center">Đóng</Button>
                        {!readOnly && <Button onClick={handleSave} isLoading={isSaving} className="w-full sm:w-auto justify-center">Lưu Cập nhật</Button>}
                    </div>
                </div>
            </div>
        </Modal>
    );
};
