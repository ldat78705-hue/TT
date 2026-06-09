
import React, { useMemo, useState } from 'react';
import { useData } from '../../hooks/useDataContext';
import { useAuth } from '../../hooks/useAuth';
import { Table, SortConfig, Column } from '../common/Table';
import { Button } from '../common/Button';
import { Student, UserRole, PersonStatus } from '../../types';
import { downloadAsCSV } from '../../services/csvExport';
import { ICONS } from '../../constants';
import { ListItemCard } from '../common/ListItemCard';
import { BulkDebtPrintModal } from './BulkDebtPrintModal';
import { PaymentModal } from './PaymentModal';
import { ClassDebtReportModal } from './ClassDebtReportModal';

export const UnpaidStudentsReport: React.FC = () => {
    const { state } = useData();
    const { role } = useAuth();
    const { students, classes } = state;
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [sortConfig, setSortConfig] = useState<SortConfig<Student & { classNames: string }> | null>({ key: 'balance', direction: 'ascending' });
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [isClassReportModalOpen, setIsClassReportModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [classFilter, setClassFilter] = useState('all');
    const [paymentModalState, setPaymentModalState] = useState<{ isOpen: boolean; student: Student | null }>({ isOpen: false, student: null });
    const [showStats, setShowStats] = useState(false);

    const isViewer = role === UserRole.VIEWER;

    const handleSort = (key: keyof (Student & { classNames: string })) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handleSelectOne = (id: string) => {
        setSelectedStudentIds(prev =>
            prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
        );
    };

    // --- Statistics by Class Logic ---
    const classTuitionStats = useMemo(() => {
        return classes.map(cls => {
            let paidCount = 0;
            let unpaidCount = 0;
            let totalDebt = 0;

            cls.studentIds.forEach(studentId => {
                const student = students.find(s => s.id === studentId);
                // Only count active students or students with debt
                if (student && (student.status === PersonStatus.ACTIVE || student.balance < 0)) {
                    if (student.balance < 0) {
                        unpaidCount++;
                        totalDebt += student.balance;
                    } else {
                        paidCount++;
                    }
                }
            });

            return {
                id: cls.id,
                name: cls.name,
                paidCount,
                unpaidCount,
                totalDebt
            };
        }).sort((a, b) => b.unpaidCount - a.unpaidCount); // Sort by highest number of unpaid students
    }, [classes, students]);


    const unpaidStudents = useMemo(() => {
        let studentsToFilter = students;

        if (classFilter !== 'all') {
            const selectedClass = classes.find(c => c.id === classFilter);
            if (selectedClass) {
                const studentIdsInClass = new Set(selectedClass.studentIds);
                studentsToFilter = studentsToFilter.filter(s => studentIdsInClass.has(s.id));
            }
        }
        
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            studentsToFilter = studentsToFilter.filter(s => 
                s.name.toLowerCase().includes(lowerQuery) || 
                s.id.toLowerCase().includes(lowerQuery)
            );
        }

        return studentsToFilter
            .filter(s => s.balance < 0)
            .map(s => ({
                ...s,
                classNames: classes.filter(c => (c.studentIds || []).includes(s.id)).map(c => c.name).join(', ')
            }));
    }, [students, classes, classFilter, searchQuery]);
    
    const indebtedStudentsInSelectedClass = useMemo(() => {
        if (classFilter === 'all') {
            // Return all students with debt, sorted by class name then student name
            const allIndebted = students.filter(s => s.balance < 0);
            
            // Map to include className
            const withClassName = allIndebted.map(s => {
                const studentClasses = classes.filter(c => c.studentIds.includes(s.id));
                const className = studentClasses.map(c => c.name).join(', ');
                return { ...s, className };
            });

            // Sort by class name, then student name
            return withClassName.sort((a, b) => {
                const classCompare = (a.className || '').localeCompare(b.className || '', 'vi');
                if (classCompare !== 0) return classCompare;
                return a.name.localeCompare(b.name, 'vi');
            });
        }
        const selectedClass = classes.find(c => c.id === classFilter);
        if (!selectedClass) {
            return [];
        }
        const studentIdsInClass = new Set(selectedClass.studentIds);
        // Lấy các học viên CÓ NỢ trong lớp để tạo báo cáo công nợ lớp.
        const studentsInClass = students.filter(s => studentIdsInClass.has(s.id) && s.balance < 0);
        
        // Sort students alphabetically by name for the report
        return studentsInClass.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    }, [students, classes, classFilter]);
    
    const sortedUnpaidStudents = useMemo(() => {
        let sortableItems = [...unpaidStudents];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                if (aValue == null && bValue == null) return 0;
                if (aValue == null) return 1;
                if (bValue == null) return -1;
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [unpaidStudents, sortConfig]);

    const handleToggleAllMobile = () => {
        if (selectedStudentIds.length === sortedUnpaidStudents.length && sortedUnpaidStudents.length > 0) {
            setSelectedStudentIds([]);
        } else {
            setSelectedStudentIds(sortedUnpaidStudents.map(s => s.id));
        }
    };

    const totalDebt = useMemo(() => {
        return unpaidStudents.reduce((sum, s) => sum + s.balance, 0);
    }, [unpaidStudents]);

    const columns: Column<Student & { classNames: string }>[] = [
        { header: 'Họ tên', accessor: 'name', sortable: true },
        { header: 'Các lớp học', accessor: 'classNames' },
        {
            header: 'Số tiền nợ',
            accessor: (item) => {
                const balanceText = <span className="font-bold text-red-600">{Math.abs(item.balance).toLocaleString('vi-VN')} ₫</span>;
                if (isViewer) {
                    return balanceText;
                }
                return (
                    <button
                        onClick={() => setPaymentModalState({ isOpen: true, student: item })}
                        className="font-bold text-red-600 hover:text-red-800 hover:underline"
                        title="Ghi nhận thanh toán"
                    >
                        {Math.abs(item.balance).toLocaleString('vi-VN')} ₫
                    </button>
                );
            },
            sortable: true,
            sortKey: 'balance'
        },
    ];
    
    const handleExport = () => {
        const dataToExport = sortedUnpaidStudents.map(s => ({
            name: s.name,
            classNames: s.classNames,
            balance: Math.abs(s.balance)
        }));
        downloadAsCSV(dataToExport, { name: "Họ Tên", classNames: "Các Lớp Học", balance: "Số Tiền Nợ" }, `BaoCaoCongNo.csv`);
    };
    
    const selectedStudentsForPrint = useMemo(() => {
        return sortedUnpaidStudents.filter(s => selectedStudentIds.includes(s.id));
    }, [sortedUnpaidStudents, selectedStudentIds]);

    return (
        <>
            <div className="card-base mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">Thống kê tình hình Học phí theo Lớp</h3>
                    <button 
                        onClick={() => setShowStats(!showStats)}
                        className="text-sm text-primary hover:underline"
                    >
                        {showStats ? 'Ẩn thống kê' : 'Hiện thống kê'}
                    </button>
                </div>
                
                {showStats && (
                    <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tên Lớp</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Đã hoàn thành</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Chưa hoàn thành</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tổng nợ</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                                {classTuitionStats.map(stat => (
                                    <tr key={stat.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-4 py-2 font-medium">{stat.name}</td>
                                        <td className="px-4 py-2 text-center text-green-600 font-semibold">{stat.paidCount}</td>
                                        <td className="px-4 py-2 text-center text-red-600 font-semibold">{stat.unpaidCount}</td>
                                        <td className="px-4 py-2 text-right text-red-600 font-bold">{Math.abs(stat.totalDebt).toLocaleString('vi-VN')} ₫</td>
                                    </tr>
                                ))}
                                {classTuitionStats.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-4 text-center text-gray-500">Chưa có dữ liệu lớp học.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="card-base">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                    <h2 className="text-xl font-semibold">Báo cáo Công nợ Học phí</h2>
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <Button 
                            onClick={() => setIsPrintModalOpen(true)} 
                            disabled={selectedStudentIds.length === 0}
                        >
                            {ICONS.download} Xuất Thông báo ({selectedStudentIds.length})
                        </Button>
                        <Button 
                            onClick={() => setIsClassReportModalOpen(true)} 
                            disabled={indebtedStudentsInSelectedClass.length === 0}
                            variant="secondary"
                        >
                            {ICONS.download} In Báo Cáo Lớp
                        </Button>
                        <Button onClick={handleExport} variant="secondary">{ICONS.export} Xuất CSV</Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input
                        type="text"
                        placeholder="Tìm kiếm theo tên hoặc mã HV..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="form-input"
                    />
                    <select
                        value={classFilter}
                        onChange={e => setClassFilter(e.target.value)}
                        className="form-select"
                    >
                        <option value="all">Lọc theo lớp - Tất cả</option>
                        {classes.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                <p className="mb-4">
                    Tổng số nợ: <span className="font-bold text-red-600">{Math.abs(totalDebt).toLocaleString('vi-VN')} VND</span>
                </p>
                <div className="hidden md:block">
                    <Table<Student & { classNames: string }> 
                        columns={columns} 
                        data={sortedUnpaidStudents} 
                        sortConfig={sortConfig} 
                        onSort={handleSort} 
                        selectedIds={selectedStudentIds}
                        onSelectionChange={setSelectedStudentIds}
                        fullDataIds={sortedUnpaidStudents.map(s => s.id)}
                    />
                </div>
                <div className="md:hidden space-y-4">
                     {sortedUnpaidStudents.length > 0 && (
                        <div className="flex items-center p-3 border rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                            <input
                                type="checkbox"
                                checked={selectedStudentIds.length === sortedUnpaidStudents.length && sortedUnpaidStudents.length > 0}
                                onChange={handleToggleAllMobile}
                                id="select-all-mobile"
                                className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="select-all-mobile" className="ml-3 text-sm font-medium select-none">
                                Chọn tất cả ({selectedStudentIds.length} / {sortedUnpaidStudents.length})
                            </label>
                        </div>
                    )}
                     {sortedUnpaidStudents.map(s => (
                        <ListItemCard
                            key={s.id}
                            onSelect={() => handleSelectOne(s.id)}
                            isSelected={selectedStudentIds.includes(s.id)}
                            title={<span className="font-semibold">{s.name}</span>}
                            details={[
                                { label: "Mã HV", value: s.id },
                                { 
                                    label: "Nợ", 
                                    value: isViewer ? (
                                        <span className="font-bold text-red-500">{Math.abs(s.balance).toLocaleString('vi-VN')} ₫</span>
                                    ) : (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPaymentModalState({ isOpen: true, student: s });
                                            }}
                                            className="font-bold text-red-500 hover:underline"
                                        >
                                            {Math.abs(s.balance).toLocaleString('vi-VN')} ₫
                                        </button>
                                    )
                                },
                            ]}
                            actions={!isViewer ? (
                                <button 
                                    onClick={() => setPaymentModalState({ isOpen: true, student: s })} 
                                    className="p-2 rounded-full text-green-600 hover:bg-green-100 dark:hover:bg-green-900/50" 
                                    title="Ghi nhận thanh toán"
                                >
                                    {React.cloneElement(ICONS.finance as React.ReactElement<{ width?: number | string; height?: number | string }>, {width: 20, height: 20})}
                                </button>
                            ) : undefined}
                        />
                     ))}
                </div>
            </div>
             <BulkDebtPrintModal 
                isOpen={isPrintModalOpen}
                onClose={() => setIsPrintModalOpen(false)}
                students={selectedStudentsForPrint}
            />
            <PaymentModal
                isOpen={paymentModalState.isOpen}
                onClose={() => setPaymentModalState({ isOpen: false, student: null })}
                student={paymentModalState.student}
            />
            <ClassDebtReportModal 
                isOpen={isClassReportModalOpen}
                onClose={() => setIsClassReportModalOpen(false)}
                students={indebtedStudentsInSelectedClass}
                className={classFilter === 'all' ? 'Tất cả các lớp' : (classes.find(c => c.id === classFilter)?.name || '')}
                showClassColumn={classFilter === 'all'}
            />
        </>
    )
}
