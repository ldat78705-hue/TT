
import React, { useMemo, useState, useCallback } from 'react';
import { useData } from '../../hooks/useDataContext';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Table, SortConfig, Column } from '../common/Table';
import { Button } from '../common/Button';
import { Student, UserRole, PersonStatus } from '../../types';
import { ExportButton } from '../common/ExportButton';
import { ICONS } from '../../constants';
import { ListItemCard } from '../common/ListItemCard';
import { BulkDebtPrintModal } from './BulkDebtPrintModal';
import { PaymentModal } from './PaymentModal';
import { ClassDebtReportModal } from './ClassDebtReportModal';
import { zaloSendOverdueReminders } from '../../services/api';
import { getStudentZaloPhone } from '../../utils/zaloDeepLink';
import { ZaloSendModal } from './ZaloSendModal';
import { getLastReminderLabel } from '../../utils/zaloReminderHistory';

export const UnpaidStudentsReport: React.FC = () => {
    const { state } = useData();
    const { role } = useAuth();
    const { toast } = useToast();
    const { students, classes, settings } = state;
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [sortConfig, setSortConfig] = useState<SortConfig<Student & { classNames: string }> | null>({ key: 'balance', direction: 'ascending' });
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [isClassReportModalOpen, setIsClassReportModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [classFilter, setClassFilter] = useState('all');
    const [paymentModalState, setPaymentModalState] = useState<{ isOpen: boolean; student: Student | null }>({ isOpen: false, student: null });
    const [showStats, setShowStats] = useState(false);
    const [isSendingZalo, setIsSendingZalo] = useState(false);
    const [zaloModalState, setZaloModalState] = useState<{ isOpen: boolean; student: Student | null }>({ isOpen: false, student: null });
    const [zaloRefreshKey, setZaloRefreshKey] = useState(0);
    const handleZaloSent = useCallback(() => setZaloRefreshKey(k => k + 1), []);
    // Bulk deep link queue
    const [bulkZaloQueue, setBulkZaloQueue] = useState<Student[]>([]);
    const [bulkZaloIndex, setBulkZaloIndex] = useState(0);
    const isBulkZaloMode = bulkZaloQueue.length > 0;


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

    const handleBulkZaloStart = useCallback(() => {
        const studentsWithPhone = sortedUnpaidStudents
            .filter(s => selectedStudentIds.includes(s.id) && getStudentZaloPhone(s));
        if (studentsWithPhone.length === 0) {
            toast.info('Không có học viên nào có SĐT Zalo để gửi.');
            return;
        }
        setBulkZaloQueue(studentsWithPhone);
        setBulkZaloIndex(0);
        setZaloModalState({ isOpen: true, student: studentsWithPhone[0] });
    }, [sortedUnpaidStudents, selectedStudentIds, toast]);

    const handleBulkZaloClose = useCallback(() => {
        if (isBulkZaloMode) {
            const nextIndex = bulkZaloIndex + 1;
            if (nextIndex < bulkZaloQueue.length) {
                setBulkZaloIndex(nextIndex);
                setZaloModalState({ isOpen: true, student: bulkZaloQueue[nextIndex] });
                return;
            }
            setBulkZaloQueue([]);
            setBulkZaloIndex(0);
            toast.success(`Đã hoàn thành nhắc nhở ${bulkZaloQueue.length} học viên.`);
        }
        setZaloModalState({ isOpen: false, student: null });
    }, [isBulkZaloMode, bulkZaloIndex, bulkZaloQueue, toast]);

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

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const columns: Column<Student & { classNames: string }>[] = useMemo(() => [
        { header: 'Họ tên', accessor: (item) => {
            const label = getLastReminderLabel(item.id);
            return (
                <div className="flex items-center gap-2">
                    <span>{item.name}</span>
                    {label && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium whitespace-nowrap" title={`Lần nhắc gần nhất: ${label}`}>🔔 {label}</span>}
                </div>
            );
        }, sortable: true, sortKey: 'name' as keyof (Student & { classNames: string }) },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ], [isViewer, zaloRefreshKey]);
    
    const exportData = useMemo(() => sortedUnpaidStudents.map(s => ({
        name: s.name,
        classNames: s.classNames,
        balance: Math.abs(s.balance)
    })), [sortedUnpaidStudents]);

    const exportColumns = { name: "Họ Tên", classNames: "Các Lớp Học", balance: "Số Tiền Nợ" };
    
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
                        <ExportButton data={exportData} columns={exportColumns} filenameBase="BaoCaoCongNo" />
                        {settings?.zaloOaEnabled && (
                            <Button 
                                onClick={async () => {
                                    const studentsToSend = sortedUnpaidStudents
                                        .filter(s => selectedStudentIds.includes(s.id))
                                        .map(s => ({
                                            name: s.name,
                                            parentName: s.parentName || '',
                                            zaloUserId: s.zaloUserId || '',
                                            amount: Math.abs(s.balance),
                                        }));
                                    if (studentsToSend.length === 0) {
                                        toast.info('Vui lòng chọn ít nhất 1 học viên để gửi nhắc nhở.');
                                        return;
                                    }
                                    setIsSendingZalo(true);
                                    try {
                                        const result = await zaloSendOverdueReminders(studentsToSend);
                                        if (result.success) {
                                            const { sent, failed, skipped } = result.summary;
                                            toast.success(`Gửi nhắc nhở: ${sent} thành công, ${failed} thất bại, ${skipped} bỏ qua (chưa liên kết Zalo)`);
                                        } else {
                                            toast.error(result.error || 'Lỗi gửi nhắc nhở Zalo');
                                        }
                                    } catch (err: any) {
                                        toast.error(err.message || 'Lỗi kết nối');
                                    } finally {
                                        setIsSendingZalo(false);
                                    }
                                }}
                                disabled={selectedStudentIds.length === 0 || isSendingZalo}
                                variant="secondary"
                                isLoading={isSendingZalo}
                            >
                                📱 Nhắc Zalo ({selectedStudentIds.length})
                            </Button>
                        )}
                        <Button 
                            onClick={handleBulkZaloStart}
                            disabled={selectedStudentIds.length === 0}
                            variant="secondary"
                        >
                            💬 Nhắc từng người ({selectedStudentIds.length})
                        </Button>
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
                        actions={!isViewer ? (item) => (
                            <div className="flex items-center gap-1">
                                {getStudentZaloPhone(item) && (
                                    <button onClick={() => setZaloModalState({ isOpen: true, student: item })} className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600" title="Nhắn Zalo nhắc HP">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.04 2 11c0 2.76 1.36 5.22 3.48 6.84L5 22l4.33-2.12C10.2 20.04 11.08 20.12 12 20.12c5.52 0 10-4.04 10-9.06S17.52 2 12 2zm4.5 12.5c-.2.56-1.18 1.08-1.63 1.14-.44.06-.83.2-2.8-.6-2.38-1-3.9-3.44-4.02-3.6-.12-.16-.96-1.28-.96-2.44s.6-1.72.82-1.96c.22-.24.48-.3.64-.3.16 0 .32 0 .46.02.14.02.34-.06.54.42.2.48.68 1.68.74 1.8.06.12.1.26.02.42-.08.16-.12.26-.24.4-.12.14-.24.3-.36.42-.12.12-.24.24-.1.48.14.24.62 1.02 1.32 1.66.9.82 1.66 1.08 1.9 1.2.24.12.38.1.52-.06.14-.16.6-.7.76-.94.16-.24.32-.2.54-.12.22.08 1.38.66 1.62.78.24.12.4.18.46.28.06.1.06.56-.14 1.12z"/></svg>
                                    </button>
                                )}
                                <button onClick={() => setPaymentModalState({ isOpen: true, student: item })} className="p-1.5 rounded-md hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600" title="Ghi nhận thanh toán">
                                    {React.cloneElement(ICONS.finance as React.ReactElement<{ width?: number | string; height?: number | string }>, {width: 18, height: 18})}
                                </button>
                            </div>
                        ) : undefined}
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
                                <div className="flex items-center gap-1">
                                    {getStudentZaloPhone(s) && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setZaloModalState({ isOpen: true, student: s }); }}
                                            className="p-2 rounded-full text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50" 
                                            title="Nhắn Zalo nhắc HP"
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.04 2 11c0 2.76 1.36 5.22 3.48 6.84L5 22l4.33-2.12C10.2 20.04 11.08 20.12 12 20.12c5.52 0 10-4.04 10-9.06S17.52 2 12 2zm4.5 12.5c-.2.56-1.18 1.08-1.63 1.14-.44.06-.83.2-2.8-.6-2.38-1-3.9-3.44-4.02-3.6-.12-.16-.96-1.28-.96-2.44s.6-1.72.82-1.96c.22-.24.48-.3.64-.3.16 0 .32 0 .46.02.14.02.34-.06.54.42.2.48.68 1.68.74 1.8.06.12.1.26.02.42-.08.16-.12.26-.24.4-.12.14-.24.3-.36.42-.12.12-.24.24-.1.48.14.24.62 1.02 1.32 1.66.9.82 1.66 1.08 1.9 1.2.24.12.38.1.52-.06.14-.16.6-.7.76-.94.16-.24.32-.2.54-.12.22.08 1.38.66 1.62.78.24.12.4.18.46.28.06.1.06.56-.14 1.12z"/></svg>
                                        </button>
                                    )}
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setPaymentModalState({ isOpen: true, student: s }); }}
                                        className="p-2 rounded-full text-green-600 hover:bg-green-100 dark:hover:bg-green-900/50" 
                                        title="Ghi nhận thanh toán"
                                    >
                                        {React.cloneElement(ICONS.finance as React.ReactElement<{ width?: number | string; height?: number | string }>, {width: 20, height: 20})}
                                    </button>
                                </div>
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
            <ZaloSendModal
                isOpen={zaloModalState.isOpen}
                onClose={handleBulkZaloClose}
                student={zaloModalState.student}
                source="debt"
                onSent={handleZaloSent}
            />
            {isBulkZaloMode && zaloModalState.isOpen && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium z-50 animate-pulse">
                    📨 {bulkZaloIndex + 1} / {bulkZaloQueue.length}
                </div>
            )}
        </>
    )
}
