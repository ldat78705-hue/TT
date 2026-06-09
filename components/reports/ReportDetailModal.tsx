import React from 'react';
import { Modal } from '../common/Modal';

interface DetailItem {
    description: string;
    amount?: number;
    date?: string;
    type?: 'credit' | 'debit';
}

interface ReportDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    items: DetailItem[];
}

export const ReportDetailModal: React.FC<ReportDetailModalProps> = ({ isOpen, onClose, title, items }) => {
    // For profit calculation where items can be credit or debit
    const total = items.reduce((sum, item) => {
        const value = item.amount || 0;
        if (item.type === 'debit') {
            return sum - value;
        }
        // credit or undefined type
        return sum + value;
    }, 0);
    
    const hasAmount = items.some(item => typeof item.amount === 'number');

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="space-y-4">
                <div className="max-h-[60vh] overflow-y-auto">
                    <table className="w-full text-sm text-left table-auto">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 sticky top-0">
                            <tr>
                                {items[0]?.date && <th scope="col" className="px-4 py-2 w-1/4">Ngày</th>}
                                <th scope="col" className="px-4 py-2">Mô tả</th>
                                {hasAmount && <th scope="col" className="px-4 py-2 text-right w-1/4">Số tiền</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {items.length > 0 ? items.map((item, index) => (
                                <tr key={index} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                    {item.date && <td className="px-4 py-2">{item.date}</td>}
                                    <td className="px-4 py-2">{item.description}</td>
                                    {hasAmount && (
                                        <td className={`px-4 py-2 text-right font-semibold ${item.type === 'debit' ? 'text-red-500 dark:text-red-400' : (item.type === 'credit' ? 'text-green-600 dark:text-green-400' : '')}`}>
                                            {typeof item.amount === 'number' ? `${item.amount.toLocaleString('vi-VN')} ₫` : ''}
                                        </td>
                                    )}
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={hasAmount ? 3 : 2} className="text-center py-8 text-gray-500">
                                        Không có dữ liệu chi tiết.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {hasAmount && (
                    <div className="flex justify-end items-center pt-4 border-t dark:border-gray-700">
                        <span className="text-lg font-bold">Tổng cộng:</span>
                        <span className="text-lg font-bold ml-4 text-primary">
                            {total.toLocaleString('vi-VN')} ₫
                        </span>
                    </div>
                )}
            </div>
        </Modal>
    );
};