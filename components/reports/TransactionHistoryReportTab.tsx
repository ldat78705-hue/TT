
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../hooks/useDataContext';
import { Table, SortConfig, Column } from '../common/Table';
import { Button } from '../common/Button';
import { ICONS } from '../../constants';
import { Transaction, TransactionType, Class, Student } from '../../types';
import { downloadAsCSV } from '../../services/csvExport';
import { Pagination } from '../common/Pagination';
import { ListItemCard } from '../common/ListItemCard';
import { formatVietnamDate } from '../../utils/date';

const ITEMS_PER_PAGE = 15;

interface TransactionWithDetails extends Transaction {
    studentName: string;
    classNames: string;
    paymentMethodStr: string;
}

interface TransactionHistoryReportTabProps {
    startDate: string;
    endDate: string;
    classFilter: string;
}

const transactionTypeMap: Record<TransactionType, string> = {
    [TransactionType.INVOICE]: 'Hóa đơn',
    [TransactionType.PAYMENT]: 'Thanh toán',
    [TransactionType.ADJUSTMENT_CREDIT]: 'Điều chỉnh Tăng',
    [TransactionType.ADJUSTMENT_DEBIT]: 'Điều chỉnh Giảm',
};

export const TransactionHistoryReportTab: React.FC<TransactionHistoryReportTabProps> = ({ startDate, endDate, classFilter }) => {
    const { state } = useData();
    const { transactions, students, classes } = state;
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<SortConfig<TransactionWithDetails> | null>({ key: 'date', direction: 'descending' });

    const reportData = useMemo(() => {
        let relevantTransactions = transactions.filter(t => t.date.substring(0, 10) >= startDate && t.date.substring(0, 10) <= endDate);

        // Fix: Explicitly type the studentMap to ensure correct type inference from .get()
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
            paymentMethodStr: (t.type === TransactionType.INVOICE || t.type === TransactionType.ADJUSTMENT_CREDIT || t.type === TransactionType.ADJUSTMENT_DEBIT) ? '-' : (t.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'),
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
                
                // If primary sort keys are equal (e.g., same date), sort by ID descending
                // to ensure the newest transaction is always on top.
                return b.id.localeCompare(a.id);
            });
        }
        return sortableItems;
    }, [reportData, sortConfig]);

    const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
    const paginatedData = sortedData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        } else if (currentPage === 0 && totalPages > 0) {
            setCurrentPage(1);
        }
    }, [currentPage, totalPages]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, classFilter, startDate, endDate]);

    const handleSort = (key: keyof TransactionWithDetails) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };
    
    const handleExport = () => {
        const dataToExport = sortedData.map(t => ({
            date: formatVietnamDate(t.date),
            studentName: t.studentName,
            classNames: t.classNames,
            description: t.description,
            type: transactionTypeMap[t.type],
            paymentMethod: t.paymentMethodStr,
            amount: t.amount,
        }));
        downloadAsCSV(dataToExport, {
            date: 'Ngày',
            studentName: 'Họ tên',
            classNames: 'Các lớp học',
            description: 'Diễn giải',
            type: 'Loại Giao dịch',
            paymentMethod: 'Hình thức',
            amount: `Số tiền`
        }, `LichSuGiaoDich_${startDate}_${endDate}.csv`);
    };

    const columns: Column<TransactionWithDetails>[] = [
        { header: 'Ngày', accessor: (item) => formatVietnamDate(item.date), sortable: true, sortKey: 'date' },
        { header: 'Họ tên', accessor: 'studentName', sortable: true },
        { header: 'Lớp học', accessor: 'classNames' },
        { header: 'Diễn giải', accessor: 'description' },
        { header: 'Loại', accessor: (item) => transactionTypeMap[item.type], sortable: true, sortKey: 'type' },
        { header: 'Hình thức', accessor: 'paymentMethodStr', sortable: true },
        { header: 'Số tiền', accessor: (item) => (
            <span className={item.amount >= 0 ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}>
                {item.amount.toLocaleString('vi-VN')} ₫
            </span>
        ), sortable: true, sortKey: 'amount' },
    ];

    return (
        <div className="card-base">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <h2 className="text-xl font-semibold">Lịch sử Giao dịch</h2>
                <Button onClick={handleExport} variant="secondary">{ICONS.export} Xuất CSV</Button>
            </div>
            <input 
                type="text"
                placeholder="Tìm theo tên học viên..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="form-input mb-4"
            />
            <div className="hidden md:block">
                <Table
                    columns={columns}
                    data={paginatedData}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                />
            </div>
            <div className="md:hidden space-y-4">
                 {paginatedData.map(item => (
                    <ListItemCard
                        key={item.id}
                        title={item.studentName}
                        details={[
                            { label: 'Ngày', value: formatVietnamDate(item.date) },
                            { label: 'Diễn giải', value: item.description },
                            { label: 'Hình thức', value: item.paymentMethodStr },
                            { label: 'Số tiền', value: (
                                <span className={item.amount >= 0 ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}>
                                    {item.amount.toLocaleString('vi-VN')} ₫
                                </span>
                            )},
                        ]}
                    />
                ))}
            </div>
             {paginatedData.length > 0 && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalItems={sortedData.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                />
            )}
        </div>
    );
};
