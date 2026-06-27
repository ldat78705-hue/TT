import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../hooks/useDataContext';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Table, SortConfig, Column } from '../common/Table';
import { Button } from '../common/Button';
import { ICONS } from '../../constants';
import { Invoice, UserRole } from '../../types';
import { Pagination } from '../common/Pagination';
import { ListItemCard } from '../common/ListItemCard';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { TuitionFeeNoticeModal } from './TuitionFeeNoticeModal';
import { BulkInvoiceExportModal } from './BulkInvoiceExportModal';
import { AdvancePaymentModal } from './AdvancePaymentModal';
import { BalanceStatementModal } from './BalanceStatementModal';

const ITEMS_PER_PAGE = 10;

import { formatVietnamDate, getVietnamTime } from '../../utils/date';

const GenerateInvoicesModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (month: number, year: number, classIds?: string[]) => Promise<void>;
    classes: { id: string; name: string }[];
}> = ({ isOpen, onClose, onGenerate, classes }) => {
    // Generate dates dynamically based on Vietnam App Time
    const vnTimeStr = getVietnamTime();
    const today = new Date(vnTimeStr);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    
    // Store localized date hooks
    const [year, setYear] = useState(lastMonth.getFullYear());
    const [month, setMonth] = useState(lastMonth.getMonth() + 1);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

    const currentYear = today.getFullYear();
    const years = Array.from({ length: 10 }, (_, i) => currentYear - i + 2);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setSelectedClassIds([]);
            setIsLoading(false);
        }
    }, [isOpen]);

    const handleToggleClass = (classId: string) => {
        setSelectedClassIds(prev => 
            prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
        );
    };

    const handleToggleAll = () => {
        if (selectedClassIds.length === classes.length) {
            setSelectedClassIds([]);
        } else {
            setSelectedClassIds(classes.map(c => c.id));
        }
    };

    const handleGenerate = async () => {
        setIsLoading(true);
        // If all classes or none selected, pass undefined (= all)
        const classIdsToSend = selectedClassIds.length > 0 && selectedClassIds.length < classes.length
            ? selectedClassIds
            : undefined;
        await onGenerate(month, year, classIdsToSend);
        setIsLoading(false);
        setSelectedClassIds([]);
    };

    return (
        <ConfirmationModal
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={handleGenerate}
            title="Chốt & Cập nhật Học phí"
            message={
                <div className="space-y-4">
                    <p>Chọn kỳ để chốt học phí. Hệ thống sẽ tự động:</p>
                    <ul className="list-disc list-inside text-sm space-y-1 pl-2">
                        <li><strong className="font-semibold">Tạo mới</strong> hóa đơn cho những học viên chưa có trong kỳ.</li>
                        <li><strong className="font-semibold">Tính toán & cập nhật lại</strong> số tiền trên các hóa đơn <strong className="text-yellow-600">"Chưa trả"</strong> đã tồn tại nếu có thay đổi về dữ liệu điểm danh.</li>
                        <li><strong className="font-semibold">Bỏ qua</strong> các hóa đơn đã được thanh toán hoặc đã bị hủy.</li>
                    </ul>
                    <div className="flex items-center gap-4 pt-2">
                        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="form-select">
                            {months.map(m => <option key={m} value={m}>Tháng {m}</option>)}
                        </select>
                        <select value={year} onChange={e => setYear(Number(e.target.value))} className="form-select">
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    {/* Class filter */}
                    <div className="border rounded-lg dark:border-gray-700 overflow-hidden">
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                            <span className="text-sm font-medium">Chọn lớp để chốt:</span>
                            {classes.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleToggleAll}
                                    className="text-xs text-primary hover:underline font-medium"
                                >
                                    {selectedClassIds.length === classes.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                </button>
                            )}
                        </div>
                        {selectedClassIds.length === 0 && (
                            <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-700 dark:text-blue-300">
                                💡 Không chọn lớp nào = chốt cho <strong>tất cả các lớp</strong>
                            </div>
                        )}
                        <div className="max-h-40 overflow-y-auto p-2 space-y-1">
                            {classes.map(cls => (
                                <label key={cls.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={selectedClassIds.includes(cls.id)}
                                        onChange={() => handleToggleClass(cls.id)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <span className="text-sm">{cls.name}</span>
                                </label>
                            ))}
                            {classes.length === 0 && (
                                <p className="text-xs text-gray-500 text-center py-2">Chưa có lớp học nào.</p>
                            )}
                        </div>
                        {selectedClassIds.length > 0 && selectedClassIds.length < classes.length && (
                            <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 text-xs text-amber-700 dark:text-amber-300 border-t dark:border-gray-700">
                                ⚡ Chỉ chốt cho học viên thuộc <strong>{selectedClassIds.length}/{classes.length}</strong> lớp đã chọn. Hóa đơn vẫn tính đầy đủ tất cả lớp của mỗi HV.
                            </div>
                        )}
                    </div>
                </div>
            }
            confirmButtonText={isLoading ? 'Đang xử lý...' : 'Xác nhận Chốt & Cập nhật'}
            confirmButtonVariant="primary"
        />
    );
};

export const InvoicesTab: React.FC = () => {
    const { state, generateInvoices, cancelInvoice, updateInvoiceStatus } = useData();
    const { role } = useAuth();
    const { toast } = useToast();
    const [isGenerateModalOpen, setGenerateModalOpen] = useState(false);
    const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
    const [cancelConfirm, setCancelConfirm] = useState<Invoice | null>(null);
    const [updateStatusConfirm, setUpdateStatusConfirm] = useState<{invoice: Invoice, status: 'PAID' | 'UNPAID'} | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [classFilter, setClassFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [filterMonth, setFilterMonth] = useState<number>(0); // 0 = All months
    const [filterYear, setFilterYear] = useState<number>(() => {
        return new Date(getVietnamTime()).getFullYear();
    });

    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<SortConfig<Invoice> | null>({ key: 'generatedDate', direction: 'descending' });
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
    const [isBulkExportModalOpen, setIsBulkExportModalOpen] = useState(false);
    const [isAdvancePaymentOpen, setIsAdvancePaymentOpen] = useState(false);
    const [isBalanceStatementOpen, setIsBalanceStatementOpen] = useState(false);


    const canManage = role === UserRole.ADMIN || role === UserRole.ACCOUNTANT;

    const handleSort = (key: keyof Invoice) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const filteredInvoices = useMemo(() => {
        let invoicesToFilter = state.invoices;

        // 1. Filter by Class
        if (classFilter !== 'all') {
            const selectedClass = state.classes.find(c => c.id === classFilter);
            if (selectedClass) {
                const studentIdsInClass = new Set(selectedClass.studentIds);
                invoicesToFilter = invoicesToFilter.filter(inv => studentIdsInClass.has(inv.studentId));
            }
        }

        // 2. Filter by Status
        if (statusFilter !== 'all') {
            invoicesToFilter = invoicesToFilter.filter(inv => inv.status === statusFilter);
        }

        // 3. Filter by Period (Month/Year)
        if (filterMonth !== 0) {
            invoicesToFilter = invoicesToFilter.filter(inv => {
                const [invYear, invMonth] = inv.month.split('-');
                return Number(invYear) === filterYear && Number(invMonth) === filterMonth;
            });
        } else {
             invoicesToFilter = invoicesToFilter.filter(inv => {
                const [invYear] = inv.month.split('-');
                return Number(invYear) === filterYear;
            });
        }

        // 4. Filter by Search Query
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            invoicesToFilter = invoicesToFilter.filter(inv => 
                inv.id.toLowerCase().includes(lowerQuery) ||
                inv.studentName.toLowerCase().includes(lowerQuery)
            );
        }

        return invoicesToFilter;
    }, [state.invoices, state.classes, searchQuery, classFilter, statusFilter, filterMonth, filterYear]);

    const sortedInvoices = useMemo(() => {
        let sortableItems = [...filteredInvoices];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
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
        return sortableItems;
    }, [filteredInvoices, sortConfig]);

    const totalPages = Math.ceil(sortedInvoices.length / ITEMS_PER_PAGE);
    const paginatedInvoices = sortedInvoices.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );
    
    const allSortedInvoiceIds = useMemo(() => sortedInvoices.map(inv => inv.id), [sortedInvoices]);

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        } else if (currentPage === 0 && totalPages > 0) {
            setCurrentPage(1);
        }
    }, [currentPage, totalPages]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, classFilter, sortConfig, statusFilter, filterMonth, filterYear]);

    const getStatusBadge = (item: Invoice) => {
        switch (item.status) {
            case 'PAID':
                const formattedDate = item.paidDate ? formatVietnamDate(item.paidDate) : '';
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Đã trả ({formattedDate})</span>;
            case 'UNPAID':
                 return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Chưa trả</span>;
            case 'CANCELLED':
                 return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">Đã hủy</span>;
        }
    };

    const columns: Column<Invoice>[] = [
        { header: 'Mã HĐ', accessor: 'id', sortable: true },
        { header: 'Học viên', accessor: 'studentName', sortable: true },
        { header: 'Tháng', accessor: 'month', sortable: true },
        { header: 'Số tiền', accessor: (item) => `${item.amount.toLocaleString('vi-VN')} ₫`, sortable: true, sortKey: 'amount' },
        { header: 'Ngày tạo', accessor: 'generatedDate', sortable: true },
        { header: 'Trạng thái', accessor: getStatusBadge, sortable: true, sortKey: 'status' },
    ];

    const handleGenerate = async (month: number, year: number, classIds?: string[]) => {
        try {
            await generateInvoices({ month, year, classIds });
            const classNote = classIds ? ` (${classIds.length} lớp đã chọn)` : '';
            toast.success(`Đã chốt/cập nhật hóa đơn cho tháng ${month}/${year}${classNote}.`);
        } catch (error) {
            toast.error('Lỗi khi xử lý hóa đơn.');
        }
    };
    
    const handleCancelInvoice = async () => {
        if (cancelConfirm) {
            try {
                await cancelInvoice(cancelConfirm.id);
                toast.success('Hóa đơn đã được hủy.');
            } catch (error: any) {
                toast.error(error.message || 'Lỗi khi hủy hóa đơn.');
            }
        }
    };

    const handleUpdateStatus = async () => {
        if (!updateStatusConfirm) return;
        const { invoice, status } = updateStatusConfirm;
        try {
            await updateInvoiceStatus({ invoiceId: invoice.id, status });
            toast.success(`Đã cập nhật trạng thái hóa đơn thành ${status === 'PAID' ? 'Đã thu' : 'Chưa thu'}.`);
        } catch (error: any) {
            toast.error(error.message || 'Lỗi khi cập nhật trạng thái hóa đơn.');
        } finally {
            setUpdateStatusConfirm(null);
        }
    };

    const selectedInvoicesForExport = useMemo(() => {
        return sortedInvoices.filter(inv => selectedInvoiceIds.includes(inv.id));
    }, [sortedInvoices, selectedInvoiceIds]);

    const handleSelectOne = (id: string) => {
        setSelectedInvoiceIds(prev =>
            prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
        );
    };

    const handleToggleAllMobile = () => {
        if (selectedInvoiceIds.length === sortedInvoices.length && sortedInvoices.length > 0) {
            setSelectedInvoiceIds([]);
        } else {
            setSelectedInvoiceIds(sortedInvoices.map(inv => inv.id));
        }
    };

    const currentYearVal = new Date(getVietnamTime()).getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYearVal - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <div className="card-base">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <h2 className="text-xl font-semibold">Quản lý Hóa đơn</h2>
                {canManage && (
                    <div className="flex flex-wrap gap-2">
                         <Button onClick={() => setIsBulkExportModalOpen(true)} disabled={selectedInvoiceIds.length === 0} variant="secondary">
                            {ICONS.download} Xuất ảnh hàng loạt ({selectedInvoiceIds.length})
                        </Button>
                        <Button onClick={() => setIsBalanceStatementOpen(true)} variant="secondary">
                            📋 Phiếu số dư
                        </Button>
                        <Button onClick={() => setIsAdvancePaymentOpen(true)} variant="secondary">
                            💰 Thu trước
                        </Button>
                        <Button onClick={() => setGenerateModalOpen(true)}>
                            {ICONS.calendar} Chốt & Cập nhật Học phí
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                <div className="col-span-1 lg:col-span-2">
                    <input
                        type="text"
                        placeholder="Tìm kiếm (mã HĐ, tên HV)..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="form-input w-full"
                    />
                </div>
                 <select
                    value={classFilter}
                    onChange={e => setClassFilter(e.target.value)}
                    className="form-select"
                >
                    <option value="all">Lớp - Tất cả</option>
                    {state.classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
                
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="form-select"
                >
                    <option value="all">Trạng thái - Tất cả</option>
                    <option value="UNPAID">Chưa thu</option>
                    <option value="PAID">Đã thu</option>
                    <option value="CANCELLED">Đã hủy</option>
                </select>

                <div className="flex gap-2">
                    <select
                        value={filterMonth}
                        onChange={e => setFilterMonth(Number(e.target.value))}
                        className="form-select w-1/2"
                    >
                        <option value={0}>Tất cả tháng</option>
                        {months.map(m => <option key={m} value={m}>Tháng {m}</option>)}
                    </select>
                    <select
                        value={filterYear}
                        onChange={e => setFilterYear(Number(e.target.value))}
                        className="form-select w-1/2"
                    >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>
            
            <div className="hidden md:block">
                <Table<Invoice>
                    columns={columns}
                    data={paginatedInvoices}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    selectedIds={selectedInvoiceIds}
                    onSelectionChange={setSelectedInvoiceIds}
                    fullDataIds={allSortedInvoiceIds}
                    actions={(item) => (
                        <div className="flex items-center gap-2">
                            <button onClick={() => setViewInvoice(item)} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" title="Xem chi tiết">{ICONS.search}</button>
                            {canManage && item.status === 'UNPAID' && (
                                <button onClick={() => setUpdateStatusConfirm({invoice: item, status: 'PAID'})} className="p-1.5 rounded-md hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600" title="Đánh dấu đã thu">{ICONS.checkCircle}</button>
                            )}
                            {canManage && item.status === 'PAID' && (
                                <button onClick={() => setUpdateStatusConfirm({invoice: item, status: 'UNPAID'})} className="p-1.5 rounded-md hover:bg-yellow-100 dark:hover:bg-yellow-900/30 text-yellow-600" title="Đánh dấu chưa thu">{ICONS.close}</button>
                            )}
                            {canManage && item.status === 'UNPAID' && (
                                <button onClick={() => setCancelConfirm(item)} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500" title="Hủy hóa đơn">{ICONS.delete}</button>
                            )}
                        </div>
                    )}
                />
            </div>
             <div className="md:hidden space-y-4">
                {sortedInvoices.length > 0 && (
                    <div className="flex items-center p-3 border rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <input
                            type="checkbox"
                            checked={selectedInvoiceIds.length === sortedInvoices.length && sortedInvoices.length > 0}
                            onChange={handleToggleAllMobile}
                            id="select-all-invoices-mobile"
                            className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="select-all-invoices-mobile" className="ml-3 text-sm font-medium select-none">
                            Chọn tất cả ({selectedInvoiceIds.length} / {sortedInvoices.length})
                        </label>
                    </div>
                )}
                {paginatedInvoices.map(inv => (
                    <ListItemCard
                        key={inv.id}
                        onSelect={() => handleSelectOne(inv.id)}
                        isSelected={selectedInvoiceIds.includes(inv.id)}
                        title={<span className="font-semibold">{inv.studentName} - {inv.month}</span>}
                        details={[
                            { label: "Mã HĐ", value: inv.id },
                            { label: "Số tiền", value: `${inv.amount.toLocaleString('vi-VN')} ₫` },
                        ]}
                        status={{
                            text: inv.status,
                            colorClasses: inv.status === 'PAID' ? 'bg-green-100 text-green-800' : (inv.status === 'UNPAID' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800')
                        }}
                        actions={(
                             <div className="flex items-center gap-2">
                                <Button onClick={(e) => { e.stopPropagation(); setViewInvoice(inv); }} size="sm" variant="secondary">Xem</Button>
                                {canManage && inv.status === 'UNPAID' && (
                                    <Button onClick={(e) => { e.stopPropagation(); setUpdateStatusConfirm({invoice: inv, status: 'PAID'}); }} size="sm" variant="secondary" className="text-green-600">Đã thu</Button>
                                )}
                                {canManage && inv.status === 'PAID' && (
                                    <Button onClick={(e) => { e.stopPropagation(); setUpdateStatusConfirm({invoice: inv, status: 'UNPAID'}); }} size="sm" variant="secondary" className="text-yellow-600">Chưa thu</Button>
                                )}
                                {canManage && inv.status === 'UNPAID' && (
                                    <Button onClick={(e) => { e.stopPropagation(); setCancelConfirm(inv); }} size="sm" variant="danger">Hủy</Button>
                                )}
                            </div>
                        )}
                    />
                ))}
            </div>

            {paginatedInvoices.length > 0 && (
                 <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalItems={sortedInvoices.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                />
            )}
            
            <GenerateInvoicesModal
                isOpen={isGenerateModalOpen}
                onClose={() => setGenerateModalOpen(false)}
                onGenerate={handleGenerate}
                classes={state.classes}
            />
            <TuitionFeeNoticeModal
                isOpen={!!viewInvoice}
                onClose={() => setViewInvoice(null)}
                invoice={viewInvoice}
            />
            <ConfirmationModal
                isOpen={!!cancelConfirm}
                onClose={() => setCancelConfirm(null)}
                onConfirm={handleCancelInvoice}
                title="Xác nhận Hủy Hóa đơn"
                message={<p>Bạn có chắc chắn muốn hủy hóa đơn <strong>#{cancelConfirm?.id}</strong>? Một giao dịch đảo ngược sẽ được tạo để điều chỉnh lại công nợ của học viên.</p>}
            />
            <ConfirmationModal
                isOpen={!!updateStatusConfirm}
                onClose={() => setUpdateStatusConfirm(null)}
                onConfirm={handleUpdateStatus}
                title={updateStatusConfirm?.status === 'PAID' ? "Xác nhận Thu tiền" : "Xác nhận Hủy thu tiền"}
                message={
                    updateStatusConfirm?.status === 'PAID' 
                    ? <p>Bạn đang đánh dấu hóa đơn <strong>#{updateStatusConfirm.invoice.id}</strong> là Đã thu.<br/><br/><span className="text-yellow-600 font-medium">Lưu ý: Hệ thống quản lý theo "Ví học viên". Số tiền thu sẽ được nạp vào ví và ưu tiên cấn trừ cho các công nợ cũ nhất (nếu có).</span></p>
                    : <p>Bạn có chắc chắn muốn chuyển hóa đơn <strong>#{updateStatusConfirm?.invoice.id}</strong> về trạng thái Chưa thu?</p>
                }
            />
            <BulkInvoiceExportModal
                isOpen={isBulkExportModalOpen}
                onClose={() => setIsBulkExportModalOpen(false)}
                invoices={selectedInvoicesForExport}
            />
            <AdvancePaymentModal
                isOpen={isAdvancePaymentOpen}
                onClose={() => setIsAdvancePaymentOpen(false)}
            />
            <BalanceStatementModal
                isOpen={isBalanceStatementOpen}
                onClose={() => setIsBalanceStatementOpen(false)}
            />
        </div>
    );
};
