import React, { useRef, useCallback, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Receipt } from './Receipt';
import { Transaction } from '../../types';
import { ICONS } from '../../constants';
import { useToast } from '../../hooks/useToast';

declare global {
    interface Window {
        html2canvas: any;
    }
}

interface ReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    transaction: Transaction | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, transaction }) => {
    const receiptRef = useRef<HTMLDivElement>(null);
    const printRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const { toast } = useToast();

    const handlePrint = useCallback(() => {
        if (!printRef.current) return;

        // Use html2canvas to generate a faithful print from the A4-sized hidden render
        if (window.html2canvas) {
            window.html2canvas(printRef.current, { scale: 2, useCORS: true }).then((canvas: HTMLCanvasElement) => {
                const imgData = canvas.toDataURL('image/png');
                const html = `<!DOCTYPE html><html><head><title>Phiếu thu</title>
                    <style>
                        * { margin: 0; padding: 0; }
                        body { display: flex; justify-content: center; }
                        img { max-width: 100%; height: auto; }
                        @page { size: A4; margin: 10mm; }
                        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                    </style>
                </head><body><img src="${imgData}" /></body></html>`;
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                    printWindow.document.write(html);
                    printWindow.document.close();
                    setTimeout(() => { printWindow.print(); }, 500);
                }
            }).catch(() => {
                toast.error("Lỗi khi xuất phiếu thu.");
            });
        }
    }, [toast]);

    const handleDownloadImage = async () => {
        if (!printRef.current || !window.html2canvas) {
            toast.error("Không thể tải ảnh.");
            return;
        }
        setIsDownloading(true);
        try {
            const canvas = await window.html2canvas(printRef.current, { scale: 3, useCORS: true });
            const link = document.createElement('a');
            link.download = `PhieuThu_${transaction?.id?.slice(-8) || 'receipt'}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            toast.success('Đã tải ảnh phiếu thu!');
        } catch (error) {
            console.error("Lỗi khi xuất ảnh:", error);
            toast.error("Lỗi khi xuất ảnh phiếu thu.");
        } finally {
            setIsDownloading(false);
        }
    };

    if (!transaction) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Phiếu thu">
            {/* Hidden A4-sized render for print/export */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                <Receipt ref={printRef} transaction={transaction} mode="print" />
            </div>

            {/* Visible preview in modal */}
            <div className="max-h-[70vh] overflow-y-auto mb-4" ref={receiptRef}>
                <Receipt transaction={transaction} mode="preview" />
            </div>
            <div className="flex justify-end gap-3 border-t dark:border-gray-700 pt-4">
                <Button variant="secondary" onClick={onClose}>Đóng</Button>
                <Button variant="secondary" onClick={handleDownloadImage} isLoading={isDownloading} disabled={isDownloading}>
                    {ICONS.download} Tải ảnh
                </Button>
                <Button onClick={handlePrint}>🖨️ In phiếu thu</Button>
            </div>
        </Modal>
    );
};
