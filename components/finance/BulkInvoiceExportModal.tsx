import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { TuitionFeeNotice } from './TuitionFeeNotice';
import { Invoice } from '../../types';
import { ICONS } from '../../constants';

interface BulkInvoiceExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoices: Invoice[];
}

export const BulkInvoiceExportModal: React.FC<BulkInvoiceExportModalProps> = ({ isOpen, onClose, invoices }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isExporting, setIsExporting] = useState(false);
    const noticeRef = useRef<HTMLDivElement>(null);

    // Start export when modal opens
    useEffect(() => {
        if (isOpen && invoices.length > 0) {
            setCurrentIndex(0);
            setIsExporting(true);
        } else if (!isOpen) {
            // Reset state on close
            setIsExporting(false);
            setCurrentIndex(0);
        }
    }, [isOpen, invoices]);

    // Process one item from the queue
    useEffect(() => {
        if (!isExporting || !isOpen) return;

        const processQueue = async () => {
            if (currentIndex >= invoices.length) {
                // Finished processing all items.
                setIsExporting(false); // End of process
                return;
            }

            // Process current item
            // Wait for the component to render with the new invoice data
            await new Promise(resolve => setTimeout(resolve, 150));

            if (!noticeRef.current || !window.html2canvas) {
                console.error("Ref or html2canvas not available.");
                setCurrentIndex(prev => prev + 1); // Skip to next
                return;
            }

            try {
                const invoice = invoices[currentIndex];
                const canvas = await window.html2canvas(noticeRef.current, { scale: 2, useCORS: true });
                
                const link = document.createElement('a');
                link.download = `PhieuHocPhi_${invoice.studentId}_${invoice.month}.png`;
                link.href = canvas.toDataURL('image/png');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Move to the next item in the queue
                setCurrentIndex(prev => prev + 1);
                
            } catch (error) {
                console.error("Error exporting invoice:", error);
                 // Move to the next item even if there's an error
                setCurrentIndex(prev => prev + 1);
            }
        };

        processQueue();
    }, [isExporting, currentIndex, invoices, isOpen]);

    const currentInvoiceForRender = invoices[currentIndex];

    return (
        <>
            {/* Hidden render target for html2canvas */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                {isExporting && currentInvoiceForRender && <TuitionFeeNotice ref={noticeRef} invoice={currentInvoiceForRender} />}
            </div>

            <Modal isOpen={isOpen} onClose={isExporting ? () => {} : onClose} title="Xuất Hàng loạt Hóa đơn">
                <div className="text-center p-8">
                    {isExporting ? (
                        <>
                            <div className="flex justify-center items-center mb-4">
                                {ICONS.loading}
                            </div>
                            <h3 className="text-lg font-semibold">Đang xuất các hóa đơn...</h3>
                            <p className="text-gray-500">
                                Đã xử lý {currentIndex} / {invoices.length} hóa đơn.
                            </p>
                            <p className="text-sm mt-2 text-gray-400">Trình duyệt có thể hỏi xin phép để tải nhiều tệp. Vui lòng không đóng cửa sổ này.</p>
                        </>
                    ) : (
                        <>
                             <div className="flex justify-center items-center mb-4 text-green-500">
                                {React.cloneElement(ICONS.checkCircle, {width: 48, height: 48})}
                            </div>
                            <h3 className="text-lg font-semibold">Hoàn tất!</h3>
                            <p className="text-gray-500">
                                Đã xuất thành công {invoices.length} hóa đơn.
                            </p>
                            <Button onClick={onClose} className="mt-6">Đóng</Button>
                        </>
                    )}
                </div>
            </Modal>
        </>
    );
};