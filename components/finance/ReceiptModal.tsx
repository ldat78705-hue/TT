import React, { useRef, useCallback } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Receipt } from './Receipt';
import { Transaction } from '../../types';

interface ReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    transaction: Transaction | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, transaction }) => {
    const receiptRef = useRef<HTMLDivElement>(null);

    const handlePrint = useCallback(() => {
        if (!receiptRef.current) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const content = receiptRef.current.innerHTML;
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Phiếu thu</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
                    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                    .bg-white { background: white; }
                    .bg-gray-50 { background: #f9fafb; }
                    .bg-blue-100 { background: #dbeafe; }
                    .bg-green-100 { background: #dcfce7; }
                    .text-gray-900 { color: #111; }
                    .text-gray-500 { color: #6b7280; }
                    .text-gray-400 { color: #9ca3af; }
                    .text-gray-800 { color: #1f2937; }
                    .text-blue-800 { color: #1e40af; }
                    .text-green-800 { color: #166534; }
                    .text-green-600 { color: #16a34a; }
                    .text-red-600 { color: #dc2626; }
                    .font-bold { font-weight: 700; }
                    .font-extrabold { font-weight: 800; }
                    .font-semibold { font-weight: 600; }
                    .font-medium { font-weight: 500; }
                    .font-mono { font-family: monospace; }
                    .text-2xl { font-size: 1.5rem; }
                    .text-3xl { font-size: 1.875rem; }
                    .text-lg { font-size: 1.125rem; }
                    .text-sm { font-size: 0.875rem; }
                    .text-xs { font-size: 0.75rem; }
                    .uppercase { text-transform: uppercase; }
                    .tracking-wide { letter-spacing: 0.025em; }
                    .tracking-wider { letter-spacing: 0.05em; }
                    .tracking-widest { letter-spacing: 0.1em; }
                    .tracking-tight { letter-spacing: -0.025em; }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .text-left { text-align: left; }
                    .mb-4 { margin-bottom: 1rem; }
                    .mb-6 { margin-bottom: 1.5rem; }
                    .mt-1 { margin-top: 0.25rem; }
                    .mt-2 { margin-top: 0.5rem; }
                    .mt-6 { margin-top: 1.5rem; }
                    .mt-8 { margin-top: 2rem; }
                    .p-3 { padding: 0.75rem; }
                    .p-4 { padding: 1rem; }
                    .p-6 { padding: 1.5rem; }
                    .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
                    .px-4 { padding-left: 1rem; padding-right: 1rem; }
                    .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
                    .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
                    .py-0\\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
                    .pt-3 { padding-top: 0.75rem; }
                    .border { border: 1px solid #d1d5db; }
                    .border-2 { border: 2px solid; }
                    .border-b-2 { border-bottom: 2px solid #d1d5db; }
                    .border-b { border-bottom: 1px solid #e5e7eb; }
                    .border-t { border-top: 1px solid #e5e7eb; }
                    .border-gray-300 { border-color: #d1d5db; }
                    .border-gray-200 { border-color: #e5e7eb; }
                    .border-gray-800 { border-color: #1f2937; }
                    .rounded-lg { border-radius: 0.5rem; }
                    .rounded { border-radius: 0.25rem; }
                    .inline-block { display: inline-block; }
                    .block { display: block; }
                    .flex { display: flex; }
                    .grid { display: grid; }
                    .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
                    .gap-8 { gap: 2rem; }
                    .gap-x-8 { column-gap: 2rem; }
                    .gap-y-2 { row-gap: 0.5rem; }
                    .gap-4 { gap: 1rem; }
                    .justify-end { justify-content: flex-end; }
                    .justify-center { justify-content: center; }
                    .items-center { align-items: center; }
                    .w-full { width: 100%; }
                    .h-20 { height: 5rem; }
                    .h-12 { height: 3rem; }
                    .mx-auto { margin-left: auto; margin-right: auto; }
                    .opacity-60 { opacity: 0.6; }
                    table { border-collapse: collapse; width: 100%; }
                </style>
            </head>
            <body>${content}</body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
    }, []);

    if (!transaction) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Phiếu thu">
            <div className="max-h-[70vh] overflow-y-auto mb-4">
                <Receipt ref={receiptRef} transaction={transaction} />
            </div>
            <div className="flex justify-end gap-3 border-t dark:border-gray-700 pt-4">
                <Button variant="secondary" onClick={onClose}>Đóng</Button>
                <Button onClick={handlePrint}>🖨️ In phiếu thu</Button>
            </div>
        </Modal>
    );
};
