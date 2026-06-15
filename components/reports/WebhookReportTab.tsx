import React, { useState, useMemo } from 'react';
import { useData } from '../../hooks/useDataContext';
import { useAuth } from '../../hooks/useAuth';
import { Table, SortConfig, Column } from '../common/Table';
import { Transaction, TransactionType, Class, Student, UserRole } from '../../types';
import { ExportButton } from '../common/ExportButton';
import { Pagination } from '../common/Pagination';
import { ListItemCard } from '../common/ListItemCard';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { formatVietnamDate } from '../../utils/date';
import { useToast } from '../../context/ToastContext';
import { ICONS } from '../../constants';

const ITEMS_PER_PAGE = 15;

interface TransactionWithDetails extends Transaction {
    studentName: string;
    classNames: string;
}

interface WebhookReportTabProps {
    startDate: string;
    endDate: string;
    classFilter: string;
}

export const WebhookReportTab: React.FC<WebhookReportTabProps> = ({ startDate, endDate, classFilter }) => {
    const { state, deleteTransaction } = useData();
    const { role } = useAuth();
    const { showToast } = useToast();
    const { transactions, students, classes } = state;
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<SortConfig<TransactionWithDetails> | null>({ key: 'date', direction: 'descending' });
    const [deleteTarget, setDeleteTarget] = useState<TransactionWithDetails | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const canDelete = role === UserRole.ADMIN || role === UserRole.MANAGER || role === UserRole.ACCOUNTANT;

    const reportData = useMemo(() => {
        let relevantTransactions = transactions.filter(t => 
            t.date.substring(0, 10) >= startDate && 
            t.date.substring(0, 10) <= endDate &&
            t.type === TransactionType.PAYMENT &&
            (t.description.startsWith('MBBank:') || t.description.toLowerCase().includes('webhook'))
        );

        const studentMap: Map<string, Student> = new Map(students.map((s: Student) => [s.id, s]));
        const studentClassMap = new Map<string, string[]>();
        students.forEach((student: Student) => {
            const enrolledClasses = (classes as Class[])
                .filter((c: Class) => c.studentIds.includes(student.id))
                .map((c: Class) => c.name);
            studentClassMap.set(student.id, enrolledClasses);
        });
        
        if (classFilter !== 'all') {
            const classStudentIds = new Set(classes.find((c: Class) => c.id === classFilter)?.studentIds || []);
            relevantTransactions = relevantTransactions.filter(t => classStudentIds.has(t.studentId));
        }

        let processedData: TransactionWithDetails[] = relevantTransactions.map(t => ({
            ...t,
            studentName: studentMap.get(t.studentId)?.name || 'N/A',
            classNames: studentClassMap.get(t.studentId)?.join(', ') || 'N/A',
        }));

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            processedData = processedData.filter(t => t.studentName.toLowerCase().includes(lowerQuery));
        }

        return processedData;

    }, [transactions, students, classes, startDate, endDate, classFilter, searchQuery]);
    
    const sortedData = useMemo(() => {
        let sortableItems = [...reportData];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                
                if (aValue == null || bValue == null) return 0;
    
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                
                return b.id.localeCompare(a.id);
            });
        }
        return sortableItems;
    }, [reportData, sortConfig]);

    const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
    const paginatedData = sortedData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    
    React.useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    const handleSort = (key: keyof TransactionWithDetails) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handleDeleteSingle = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await deleteTransaction(deleteTarget.id);
            showToast(`Đã xóa giao dịch webhook của ${deleteTarget.studentName} (${Math.abs(deleteTarget.amount).toLocaleString('vi-VN')}₫). Số dư học viên đã được hoàn trả.`, 'success');
            setDeleteTarget(null);
        } catch (err: any) {
            showToast(`Lỗi xóa giao dịch: ${err.message}`, 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0) return;
        setIsDeleting(true);
        let successCount = 0;
        let errorCount = 0;
        
        for (const id of selectedIds) {
            try {
                await deleteTransaction(id);
                successCount++;
            } catch {
                errorCount++;
            }
        }
        
        if (successCount > 0) {
            showToast(`Đã xóa ${successCount} giao dịch webhook. Số dư học viên đã được hoàn trả.`, 'success');
        }
        if (errorCount > 0) {
            showToast(`${errorCount} giao dịch không xóa được.`, 'error');
        }
        setSelectedIds([]);
        setIsDeleting(false);
    };



    const exportData = useMemo(() => sortedData.map(item => ({
        date: formatVietnamDate(item.date),
        studentName: item.studentName,
        studentId: item.studentId,
        classNames: item.classNames,
        amount: item.amount,
        description: item.description
    })), [sortedData]);

    const exportColumns = {
        date: 'Ngày',
        studentName: 'Học viên',
        studentId: 'Mã Học viên',
        classNames: 'Lớp học',
        amount: 'Số tiền (VND)',
        description: 'Nội dung'
    };

    const columns: Column<TransactionWithDetails>[] = [
        { header: 'Ngày', accessor: (item) => formatVietnamDate(item.date), sortable: true, sortKey: 'date' as keyof TransactionWithDetails },
        { header: 'Học viên', accessor: 'studentName' as keyof TransactionWithDetails, sortable: true },
        { header: 'Mã HV', accessor: 'studentId' as keyof TransactionWithDetails },
        { header: 'Lớp học', accessor: 'classNames' as keyof TransactionWithDetails },
        { 
            header: 'Số tiền', 
            accessor: (item) => <span className="font-semibold text-green-600 dark:text-green-400">+{item.amount.toLocaleString('vi-VN')} ₫</span>, 
            sortable: true, 
            sortKey: 'amount' as keyof TransactionWithDetails
        },
        { header: 'Nội dung', accessor: 'description' as keyof TransactionWithDetails },
    ];

    const tableActions = canDelete ? (item: TransactionWithDetails) => (
        <button
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); }}
            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            title="Xóa giao dịch này"
        >
            {React.cloneElement(ICONS.delete, { className: 'w-4 h-4' })}
        </button>
    ) : undefined;

    const totalWebhookAmount = reportData.reduce((sum, t) => sum + t.amount, 0);

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <input
                        type="text"
                        placeholder="Tìm kiếm học viên..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-full sm:w-64"
                    />
                    {canDelete && selectedIds.length > 0 && (
                        <button
                            onClick={handleDeleteSelected}
                            disabled={isDeleting}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                            {React.cloneElement(ICONS.delete, { className: 'w-4 h-4' })}
                            Xóa {selectedIds.length} mục
                        </button>
                    )}
                </div>
                
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 w-full sm:w-auto">
                    <div className="text-right">
                        <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">Tổng thu Webhook:</span>
                        <span className="text-xl font-bold text-green-600 dark:text-green-400">
                            {totalWebhookAmount.toLocaleString('vi-VN')} ₫
                        </span>
                    </div>
                    <ExportButton data={exportData} columns={exportColumns} filenameBase={`Bao_Cao_Webhook_${startDate}_${endDate}`} />
                </div>
            </div>

            <div className="hidden md:block">
                <Table<TransactionWithDetails>
                    columns={columns}
                    data={paginatedData}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    actions={tableActions}
                    selectedIds={canDelete ? selectedIds : undefined}
                    onSelectionChange={canDelete ? setSelectedIds : undefined}
                    fullDataIds={canDelete ? sortedData.map(t => t.id) : undefined}
                />
            </div>

            <div className="md:hidden space-y-4">
                {paginatedData.map(item => (
                    <ListItemCard
                        key={item.id}
                        title={
                            <div className="flex items-center justify-between w-full">
                                <div>
                                    <div className="font-semibold">{item.studentName}</div>
                                    <div className="text-sm text-gray-500">{formatVietnamDate(item.date)}</div>
                                </div>
                                {canDelete && (
                                    <button
                                        onClick={() => setDeleteTarget(item)}
                                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                    >
                                        {React.cloneElement(ICONS.delete, { className: 'w-5 h-5' })}
                                    </button>
                                )}
                            </div>
                        }
                        details={[
                            { label: "Số tiền", value: <span className="font-semibold text-green-600 dark:text-green-400">{item.amount.toLocaleString('vi-VN')} ₫</span> },
                            { label: "Nội dung", value: item.description },
                        ]}
                    />
                ))}
            </div>

            {totalPages > 1 && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalItems={sortedData.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                />
            )}
            
            {reportData.length === 0 && (
                <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-500 dark:text-gray-400">
                    Không có giao dịch Webhook nào trong khoảng thời gian này.
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmationModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDeleteSingle}
                title="Xóa giao dịch Webhook"
                message={deleteTarget ? (
                    <div className="space-y-3">
                        <p>Bạn có chắc muốn xóa giao dịch này?</p>
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 space-y-1 text-sm">
                            <div><strong>Học viên:</strong> {deleteTarget.studentName} ({deleteTarget.studentId})</div>
                            <div><strong>Số tiền:</strong> <span className="text-green-600 font-semibold">+{deleteTarget.amount.toLocaleString('vi-VN')} ₫</span></div>
                            <div><strong>Ngày:</strong> {formatVietnamDate(deleteTarget.date)}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate"><strong>Nội dung:</strong> {deleteTarget.description}</div>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
                            ⚠️ <strong>Lưu ý:</strong> Số dư của học viên <strong>{deleteTarget.studentName}</strong> sẽ bị trừ lại <strong>{deleteTarget.amount.toLocaleString('vi-VN')} ₫</strong>. 
                            Trạng thái hóa đơn liên quan cũng sẽ được cập nhật.
                        </div>
                    </div>
                ) : ''}
                confirmButtonText={isDeleting ? 'Đang xóa...' : 'Xóa giao dịch'}
                confirmButtonVariant="danger"
            />
        </div>
    );
};
