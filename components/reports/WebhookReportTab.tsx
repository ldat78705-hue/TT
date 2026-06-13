import React, { useState, useMemo } from 'react';
import { useData } from '../../hooks/useDataContext';
import { Table, SortConfig, Column } from '../common/Table';
import { Transaction, TransactionType, Class, Student } from '../../types';
import { ExportButton } from '../common/ExportButton';
import { Pagination } from '../common/Pagination';
import { ListItemCard } from '../common/ListItemCard';
import { formatVietnamDate } from '../../utils/date';

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
    const { state } = useData();
    const { transactions, students, classes } = state;
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<SortConfig<TransactionWithDetails> | null>({ key: 'date', direction: 'descending' });

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
        { header: 'Ngày', accessor: (item) => formatVietnamDate(item.date), sortable: true, sortKey: 'date' },
        { header: 'Học viên', accessor: 'studentName', sortable: true },
        { header: 'Mã HV', accessor: 'studentId' },
        { header: 'Lớp học', accessor: 'classNames' },
        { 
            header: 'Số tiền', 
            accessor: (item) => <span className="font-semibold text-green-600 dark:text-green-400">+{item.amount.toLocaleString('vi-VN')} ₫</span>, 
            sortable: true, 
            sortKey: 'amount'
        },
        { header: 'Nội dung', accessor: 'description' },
    ];

    const totalWebhookAmount = reportData.reduce((sum, t) => sum + t.amount, 0);

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
                />
            </div>

            <div className="md:hidden space-y-4">
                {paginatedData.map(item => (
                    <ListItemCard
                        key={item.id}
                        title={
                            <div>
                                <div className="font-semibold">{item.studentName}</div>
                                <div className="text-sm text-gray-500">{formatVietnamDate(item.date)}</div>
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
        </div>
    );
};
