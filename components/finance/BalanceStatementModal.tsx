import React, { useRef, useState, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { BalanceStatement } from './BalanceStatement';
import { useData } from '../../hooks/useDataContext';
import { useToast } from '../../hooks/useToast';
import { ICONS } from '../../constants';
import { getVietnamTime } from '../../utils/date';

declare global {
    interface Window {
        html2canvas: any;
    }
}

interface BalanceStatementModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const formatCurrency = (amount: number) => `${Math.round(amount).toLocaleString('vi-VN')} ₫`;

export const BalanceStatementModal: React.FC<BalanceStatementModalProps> = ({ isOpen, onClose }) => {
    const { state } = useData();
    const { toast } = useToast();
    const noticeRef = useRef<HTMLDivElement>(null);

    const vnTime = getVietnamTime();
    const today = new Date(vnTime);
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    const [filterMonth, setFilterMonth] = useState(currentMonth);
    const [filterYear, setFilterYear] = useState(currentYear);
    const [filterClass, setFilterClass] = useState('all');
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);
    const [isBulkExporting, setIsBulkExporting] = useState(false);
    const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

    const displayMonth = `${filterYear}-${String(filterMonth).padStart(2, '0')}`;

    const filteredStudents = useMemo(() => {
        let students = state.students.filter(s => s.status === 'ACTIVE');

        if (filterClass !== 'all') {
            const cls = state.classes.find(c => c.id === filterClass);
            if (cls) {
                const studentIdsInClass = new Set(cls.studentIds);
                students = students.filter(s => studentIdsInClass.has(s.id));
            }
        }

        return students.sort((a, b) => a.name.localeCompare(b.name));
    }, [state.students, state.classes, filterClass]);

    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

    const handleDownloadImage = async () => {
        if (!noticeRef.current || !selectedStudentId || !window.html2canvas) {
            toast.error('Không thể tải ảnh. Vui lòng thử lại.');
            return;
        }
        setIsDownloading(true);
        try {
            const canvas = await window.html2canvas(noticeRef.current, { scale: 3, useCORS: true });
            const link = document.createElement('a');
            link.download = `PhieuSoDu_${selectedStudentId}_${displayMonth}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            toast.success('Đã tải ảnh phiếu số dư!');
        } catch (error) {
            console.error('Lỗi xuất ảnh:', error);
            toast.error('Lỗi khi xuất ảnh phiếu.');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleBulkExport = async () => {
        if (!window.html2canvas || filteredStudents.length === 0) {
            toast.error('Không có học viên để xuất.');
            return;
        }

        setIsBulkExporting(true);
        setBulkProgress({ current: 0, total: filteredStudents.length });

        for (let i = 0; i < filteredStudents.length; i++) {
            const student = filteredStudents[i];
            setSelectedStudentId(student.id);
            setBulkProgress({ current: i + 1, total: filteredStudents.length });

            // Wait for render
            await new Promise(resolve => setTimeout(resolve, 200));

            if (!noticeRef.current) continue;

            try {
                const canvas = await window.html2canvas(noticeRef.current, { scale: 2, useCORS: true });
                const link = document.createElement('a');
                link.download = `PhieuSoDu_${student.id}_${displayMonth}.png`;
                link.href = canvas.toDataURL('image/png');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (error) {
                console.error(`Lỗi xuất phiếu cho ${student.id}:`, error);
            }
        }

        setIsBulkExporting(false);
        toast.success(`Đã xuất ${filteredStudents.length} phiếu số dư!`);
    };

    const selectedStudent = useMemo(() =>
        state.students.find(s => s.id === selectedStudentId) || null,
        [state.students, selectedStudentId]
    );

    return (
        <>
            {/* Hidden render target */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                {selectedStudentId && <BalanceStatement ref={noticeRef} studentId={selectedStudentId} upToMonth={displayMonth} />}
            </div>

            <Modal isOpen={isOpen} onClose={isBulkExporting ? () => {} : onClose} title="📋 Phiếu Thông Báo Số Dư Học Phí">
                <div className="space-y-4">
                    {/* Filters */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="form-select">
                            {months.map(m => <option key={m} value={m}>Tháng {m}</option>)}
                        </select>
                        <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="form-select">
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="form-select">
                            <option value="all">Tất cả lớp</option>
                            {state.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select
                            value={selectedStudentId}
                            onChange={e => setSelectedStudentId(e.target.value)}
                            className="form-select"
                        >
                            <option value="">-- Chọn HV --</option>
                            {filteredStudents.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.name} ({formatCurrency(s.balance)})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Info Banner */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 p-3 rounded-lg text-sm border border-blue-200 dark:border-blue-800">
                        <strong>Lưu ý:</strong> Phiếu số dư tính <strong>real-time</strong> từ dữ liệu điểm danh đến buổi học gần nhất, khác với chức năng "Chốt học phí" (tính theo toàn bộ tháng đã khóa sổ).
                    </div>

                    {/* Bulk Export Progress */}
                    {isBulkExporting && (
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="flex justify-center items-center mb-2">{ICONS.loading}</div>
                            <p className="font-semibold">Đang xuất phiếu...</p>
                            <p className="text-gray-500">{bulkProgress.current} / {bulkProgress.total}</p>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                                <div
                                    className="bg-indigo-500 h-2 rounded-full transition-all"
                                    style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Preview */}
                    {selectedStudent && !isBulkExporting && (
                        <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                            <div className="p-4 bg-gray-50 dark:bg-gray-800 flex justify-between items-center">
                                <div>
                                    <h3 className="font-semibold">{selectedStudent.name}</h3>
                                    <p className="text-sm text-gray-500">Mã: {selectedStudent.id}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500">Số dư hiện tại</p>
                                    <p className={`text-lg font-bold ${selectedStudent.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatCurrency(selectedStudent.balance)}
                                    </p>
                                </div>
                            </div>
                            <div className="max-h-[400px] overflow-y-auto p-2 bg-white">
                                <div className="transform scale-[0.5] origin-top-left" style={{ width: '200%' }}>
                                    <BalanceStatement studentId={selectedStudentId} upToMonth={displayMonth} />
                                </div>
                            </div>
                        </div>
                    )}

                    {!selectedStudentId && !isBulkExporting && (
                        <div className="text-center py-8 text-gray-400">
                            <p className="text-lg">Chọn học viên để xem phiếu số dư</p>
                            <p className="text-sm mt-1">Hoặc bấm "Xuất hàng loạt" để tải phiếu cho tất cả HV</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap justify-end gap-3 pt-4 border-t dark:border-gray-700">
                        <Button variant="secondary" onClick={onClose} disabled={isBulkExporting}>Đóng</Button>
                        <Button
                            variant="secondary"
                            onClick={handleBulkExport}
                            disabled={isBulkExporting || filteredStudents.length === 0}
                        >
                            {ICONS.download} Xuất hàng loạt ({filteredStudents.length} HV)
                        </Button>
                        {selectedStudentId && (
                            <Button onClick={handleDownloadImage} isLoading={isDownloading} disabled={isDownloading || isBulkExporting}>
                                {ICONS.download} Tải ảnh phiếu
                            </Button>
                        )}
                    </div>
                </div>
            </Modal>
        </>
    );
};
