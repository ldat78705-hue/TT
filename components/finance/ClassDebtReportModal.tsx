import React, { useRef, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { PrintableClassDebtReport } from './PrintableClassDebtReport';
import { Student } from '../../types';
import { useData } from '../../hooks/useDataContext';
import { useToast } from '../../hooks/useToast';
import { ICONS } from '../../constants';

interface ClassDebtReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    students: (Student & { className?: string })[];
    className: string;
    showClassColumn?: boolean;
}

export const ClassDebtReportModal: React.FC<ClassDebtReportModalProps> = ({ isOpen, onClose, students, className, showClassColumn }) => {
    const reportRef = useRef<HTMLDivElement>(null);
    const { state } = useData();
    const { toast } = useToast();
    const [isDownloading, setIsDownloading] = useState(false);
    const [isDetailed, setIsDetailed] = useState(false);

    const handleDownload = async () => {
        if (!reportRef.current || !window.html2canvas) {
            toast.error("Không thể tải ảnh, vui lòng thử lại.");
            return;
        }
        setIsDownloading(true);
        try {
            const canvas = await window.html2canvas(reportRef.current, { scale: 2.5, useCORS: true });
            const link = document.createElement('a');
            link.download = `BaoCaoTaiChinh_${className.replace(/\s/g, '_')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error("Lỗi khi xuất ảnh báo cáo:", error);
            toast.error("Lỗi khi xuất báo cáo.");
        } finally {
            setIsDownloading(false);
        }
    };
    
    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Báo cáo Công nợ - ${className}`}
        >
            {/* Hidden off-screen render for html2canvas export */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                <div ref={reportRef}>
                    <PrintableClassDebtReport 
                        students={students}
                        className={className}
                        settings={state.settings}
                        showClassColumn={showClassColumn}
                        isDetailed={isDetailed}
                        invoices={state.invoices}
                        mode="print"
                    />
                </div>
            </div>

            <div className="flex justify-end p-4 bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-700">
                <label className="flex items-center space-x-2 cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={isDetailed} 
                        onChange={(e) => setIsDetailed(e.target.checked)}
                        className="form-checkbox h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Báo cáo chi tiết</span>
                </label>
            </div>
            <div className="bg-gray-200 dark:bg-gray-900 p-4 overflow-y-auto max-h-[60vh]">
                <div className="mx-auto bg-white rounded-lg overflow-hidden shadow">
                    <PrintableClassDebtReport 
                        students={students}
                        className={className}
                        settings={state.settings}
                        showClassColumn={showClassColumn}
                        isDetailed={isDetailed}
                        invoices={state.invoices}
                        mode="preview"
                    />
                </div>
            </div>

            <div className="flex justify-end gap-4 mt-6 pt-4 border-t dark:border-gray-700 p-4">
                <Button variant="secondary" onClick={onClose}>
                    Đóng
                </Button>
                <Button onClick={handleDownload} isLoading={isDownloading}>
                    {ICONS.download} Tải ảnh
                </Button>
            </div>
        </Modal>
    );
};