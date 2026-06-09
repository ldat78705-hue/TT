import React, { useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useData } from '../../hooks/useDataContext';
import { Table, SortConfig } from '../../components/common/Table';
import { Invoice, Student } from '../../types';
import { ListItemCard } from '../../components/common/ListItemCard';

import { formatVietnamDate } from '../../utils/date';

export const ParentFinanceScreen: React.FC = () => {
    const { user } = useAuth();
    const { state } = useData();
    const student = user as Student;

    const [sortConfig, setSortConfig] = useState<SortConfig<Invoice> | null>({ key: 'generatedDate', direction: 'descending' });

    const handleSort = (key: keyof Invoice) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedInvoices = useMemo(() => {
        if (!student) return [];
        const studentInvoices = state.invoices.filter(inv => inv.studentId === student.id);
        
        if (sortConfig) {
            studentInvoices.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                
                if (aValue === null && bValue === null) return 0;
                if (aValue === null) return 1;
                if (bValue === null) return -1;

                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return studentInvoices;
    }, [student, state.invoices, sortConfig]);

    const columns = [
        { header: 'Mã Hóa đơn', accessor: 'id' as keyof Invoice, sortable: true },
        { header: 'Kỳ thanh toán', accessor: 'month' as keyof Invoice, sortable: true },
        { header: 'Ngày tạo', accessor: 'generatedDate' as keyof Invoice, sortable: true },
        { header: 'Số tiền', accessor: (item: Invoice) => `${item.amount.toLocaleString('vi-VN')} VND`, sortable: true, sortKey: 'amount' as keyof Invoice },
        { header: 'Trạng thái', accessor: (item: Invoice) => (
            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                item.status === 'PAID' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
            }`}>
                {item.status === 'PAID' ? `Đã trả (${item.paidDate ? formatVietnamDate(item.paidDate).substring(0, 5) : ''})` : 'Chưa trả'}
            </span>
        ), sortable: true, sortKey: 'status' as keyof Invoice },
    ];

    // Compute account balance info & QR Code Logic
    const balance = student.balance || 0;
    const { bankBin, bankAccountNumber, bankAccountHolder } = state.settings;
    const canGenerateQR = bankBin && bankAccountNumber;
    const amountToPay = balance < 0 ? Math.abs(balance) : 0;
    const transferDescription = `HOC PHI ${student.id}`;
    
    const qrUrl = (canGenerateQR && amountToPay > 0)
        ? `https://img.vietqr.io/image/${bankBin}-${bankAccountNumber}-compact2.png?amount=${amountToPay}&addInfo=${encodeURIComponent(transferDescription)}&accountName=${encodeURIComponent(bankAccountHolder || '')}`
        : '';

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Thông tin Tài chính</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <div className="md:bg-white md:dark:bg-gray-800 md:p-6 md:rounded-lg md:shadow-md">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4 hidden md:block">Lịch sử Hóa đơn</h2>
                        {/* Desktop Table */}
                        <div className="hidden md:block">
                            <Table<Invoice>
                                columns={columns}
                                data={sortedInvoices}
                                sortConfig={sortConfig}
                                onSort={handleSort}
                            />
                        </div>
                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-4">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white px-2">Lịch sử Hóa đơn</h2>
                            {sortedInvoices.map(inv => (
                                <ListItemCard 
                                    key={inv.id}
                                    title={<span className="font-semibold">Hóa đơn {inv.month}</span>}
                                    details={[
                                        { label: "Mã HĐ", value: inv.id },
                                        { label: "Số tiền", value: `${inv.amount.toLocaleString('vi-VN')} ₫` }
                                    ]}
                                    status={{
                                        text: inv.status === 'PAID' ? `Đã trả (${inv.paidDate ? formatVietnamDate(inv.paidDate).substring(0, 5) : ''})` : (inv.status === 'CANCELLED' ? 'Đã hủy' : 'Chưa trả'),
                                        colorClasses: inv.status === 'PAID' 
                                            ? 'bg-green-100 text-green-800' 
                                            : (inv.status === 'UNPAID' 
                                                ? 'bg-yellow-100 text-yellow-800' 
                                                : 'bg-gray-100 text-gray-800')
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Phụ huynh Dashboard Right Side: Thanh toán & QR code */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-t-4 border-indigo-500">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Trạng thái Công nợ</h2>
                        <div className="flex flex-col">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                {balance < 0 ? 'Hiện tại cần thanh toán:' : 'Số dư tích lũy hiện có:'}
                            </span>
                            <span className={`text-3xl font-bold mt-1 ${balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                {Math.abs(balance).toLocaleString('vi-VN')} ₫
                            </span>
                        </div>
                    </div>

                    {amountToPay > 0 && canGenerateQR && (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md text-center">
                            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Thanh toán Tự động</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                                Quét mã QR dưới đây bằng ứng dụng Ngân hàng để thanh toán. Luồng tiền sẽ được tự động gạch nợ thành công!
                            </p>
                            
                            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-xl inline-block mx-auto border border-gray-200 dark:border-gray-600 shadow-sm transition-transform hover:scale-105 duration-300">
                                <img src={qrUrl} alt="VietQR Thanh toan" className="w-[200px] h-[200px] object-contain rounded-lg" />
                            </div>

                            <div className="mt-5 text-left bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800">
                                <p className="text-xs text-uppercase font-bold text-indigo-800 dark:text-indigo-400 mb-2">Chuyển khoản thủ công</p>
                                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                    <p className="flex justify-between items-center border-b border-indigo-100 dark:border-indigo-800/50 pb-1">
                                        <span className="text-gray-500 dark:text-gray-400">Ngân hàng:</span>
                                        <span className="font-semibold text-right">{bankNameFromBin(bankBin)}</span>
                                    </p>
                                    <p className="flex justify-between items-center border-b border-indigo-100 dark:border-indigo-800/50 pb-1">
                                        <span className="text-gray-500 dark:text-gray-400">Chủ tài khoản:</span>
                                        <span className="font-semibold">{bankAccountHolder}</span>
                                    </p>
                                    <p className="flex justify-between items-center border-b border-indigo-100 dark:border-indigo-800/50 pb-1">
                                        <span className="text-gray-500 dark:text-gray-400">Số tài khoản:</span>
                                        <span className="font-semibold font-mono tracking-wider text-xl text-primary">{bankAccountNumber}</span>
                                    </p>
                                    <div>
                                        <span className="text-gray-500 dark:text-gray-400 block mb-1">Nội dung chuyển tiền (bắt buộc nhập đúng để tự động tự trừ):</span>
                                        <div 
                                            className="bg-white dark:bg-gray-800 font-mono font-bold text-center text-lg text-primary py-2 px-3 border-2 border-dashed border-indigo-300 dark:border-indigo-700 rounded-md cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                            onClick={() => {
                                                navigator.clipboard.writeText(transferDescription);
                                                alert('Đã copy nội dung chuyển khoản!');
                                            }}
                                            title="Click để Copy"
                                        >
                                            {transferDescription}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Helper function to map Bank BIN to common name for UI display
function bankNameFromBin(bin: string): string {
    const banks: Record<string, string> = {
        '970422': 'MBBank (Quân Đội)',
        '970436': 'Vietcombank',
        '970415': 'VietinBank',
        '970418': 'BIDV',
        '970405': 'Agribank',
        '970416': 'ACB',
        '970407': 'Techcombank',
        '970423': 'TPBank',
        '970432': 'VPBank',
        '970403': 'Sacombank',
    };
    return banks[bin] || 'Ngân hàng nhận';
}