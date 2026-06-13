
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useData } from '../hooks/useDataContext';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { Table, SortConfig } from '../components/common/Table';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { ICONS, ROUTES } from '../constants';
import { Transaction, ProgressReport, PersonStatus, TransactionType, Class, AttendanceStatus, UserRole, AttendanceRecord } from '../types';
import { CurrencyInput } from '../components/common/CurrencyInput';
import { ListItemCard } from '../components/common/ListItemCard';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { PaymentModal } from '../components/finance/PaymentModal';

const transactionTypeMap: Record<TransactionType, string> = {
    [TransactionType.INVOICE]: 'Hóa đơn',
    [TransactionType.PAYMENT]: 'Thanh toán',
    [TransactionType.ADJUSTMENT_CREDIT]: 'Điều chỉnh Ghi có',
    [TransactionType.ADJUSTMENT_DEBIT]: 'Phí khác',
};

import { formatVietnamDate, getVietnamTime } from '../utils/date';

const AdjustmentForm: React.FC<{
    transactionToEdit?: Transaction;
    onSubmit: (data: { sign: 'CREDIT' | 'DEBIT'; amount: number; date: string; description: string; }) => void;
    onCancel: () => void;
}> = ({ transactionToEdit, onSubmit, onCancel }) => {
    const [sign, setSign] = useState<'CREDIT' | 'DEBIT'>(transactionToEdit && transactionToEdit.amount < 0 ? 'DEBIT' : 'CREDIT');
    const [amount, setAmount] = useState(transactionToEdit ? Math.abs(transactionToEdit.amount) : 0);
    const [description, setDescription] = useState(transactionToEdit?.description || '');
    
    const initialDate = transactionToEdit?.date 
        ? (transactionToEdit.date.includes('T') ? transactionToEdit.date : `${transactionToEdit.date}T00:00:00`)
        : getVietnamTime();

    const [date, setDate] = useState(initialDate);
    
    const descriptionInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        descriptionInputRef.current?.focus();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalDate = date.length === 16 ? `${date}:00` : date;
        onSubmit({ sign, amount, date: finalDate, description });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
             <div>
                <label className="block text-sm font-medium mb-2">Loại giao dịch</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <label className={`flex items-center p-3 rounded-md border-2 cursor-pointer transition-all ${sign === 'CREDIT' ? 'border-primary bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-300 dark:border-gray-600'}`}>
                        <input
                            type="radio"
                            name="sign"
                            value="CREDIT"
                            checked={sign === 'CREDIT'}
                            onChange={() => setSign('CREDIT')}
                            className="h-4 w-4 text-primary focus:ring-primary-dark"
                        />
                        <span className="ml-3 text-sm font-medium">Thanh toán / Ghi có (Tăng số dư)</span>
                    </label>
                    <label className={`flex items-center p-3 rounded-md border-2 cursor-pointer transition-all ${sign === 'DEBIT' ? 'border-primary bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-300 dark:border-gray-600'}`}>
                        <input
                            type="radio"
                            name="sign"
                            value="DEBIT"
                            checked={sign === 'DEBIT'}
                            onChange={() => setSign('DEBIT')}
                            className="h-4 w-4 text-primary focus:ring-primary-dark"
                        />
                        <span className="ml-3 text-sm font-medium">Phí / Ghi nợ (Giảm số dư)</span>
                    </label>
                </div>
            </div>
            
            <div>
                <label className="block text-sm font-medium">Mô tả</label>
                <input
                    ref={descriptionInputRef}
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="form-input mt-1"
                    required
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium">Số tiền (VND)</label>
                    <CurrencyInput value={amount} onChange={setAmount} className="form-input mt-1" required />
                </div>
                <div>
                    <label className="block text-sm font-medium">Ngày</label>
                    <input type="datetime-local" step="1" value={date} onChange={e => setDate(e.target.value)} className="form-input mt-1" required />
                </div>
            </div>
            
            <div className="flex justify-end space-x-4 pt-4 border-t dark:border-gray-700">
                <Button type="button" variant="secondary" onClick={onCancel}>Hủy</Button>
                <Button type="submit">Lưu Giao dịch</Button>
            </div>
        </form>
    );
};

const AttendanceSummaryWidget: React.FC<{ 
    studentId: string; 
    enrolledClasses: Class[];
    filterMonth: number;
    filterYear: number;
}> = ({ studentId, enrolledClasses, filterMonth, filterYear }) => {
    const { state } = useData();
    
    // Filter attendance records based on student ID and selected month/year
    const filteredAttendance = useMemo(() => {
        return state.attendance.filter(a => {
            if (a.studentId !== studentId) return false;
            if (filterMonth === 0) return true; // Show all if month is 0 (All)
            
            const monthStr = filterMonth < 10 ? `0${filterMonth}` : `${filterMonth}`;
            const prefix = `${filterYear}-${monthStr}`;
            return a.date.startsWith(prefix);
        });
    }, [state.attendance, studentId, filterMonth, filterYear]);

    const summary = useMemo(() => {
        return enrolledClasses.map(cls => {
            const classAttendance = filteredAttendance.filter(a => a.classId === cls.id);
            const present = classAttendance.filter(a => a.status === AttendanceStatus.PRESENT).length;
            const absent = classAttendance.filter(a => a.status === AttendanceStatus.ABSENT).length;
            const unexcusedAbsent = classAttendance.filter(a => a.status === AttendanceStatus.UNEXCUSED_ABSENT).length;
            const late = classAttendance.filter(a => a.status === AttendanceStatus.LATE).length;
            const total = classAttendance.filter(a => a.status !== AttendanceStatus.UNMARKED).length;
            const percentage = total > 0 ? (((present + late) / total) * 100).toFixed(0) : 'N/A';
            
            // Only show classes that have attendance data for the filtered period, or are currently enrolled
            const hasData = total > 0;
            
            return {
                classId: cls.id,
                className: cls.name,
                present,
                absent,
                unexcusedAbsent,
                late,
                percentage,
                hasData
            };
        }).filter(s => s.hasData || filterMonth === 0); // In monthly view, hide classes with no data to reduce clutter? 
        // Actually, let's show all related classes but with 0s if no data for that month,
        // unless it's an old class with NO data for this month.
        // Let's keep it simple: show all related classes.
    }, [filteredAttendance, enrolledClasses, filterMonth]);

    if (summary.length === 0) {
        return (
            <div className="card-base text-center text-gray-500 py-8">
                Không có dữ liệu điểm danh cho giai đoạn này.
            </div>
        );
    }

    return (
        <div className="card-base">
            <h2 className="text-xl font-semibold mb-4">Thống kê Chuyên cần {filterMonth === 0 ? '(Tất cả)' : `(Tháng ${filterMonth}/${filterYear})`}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {summary.map(s => (
                    <div key={s.classId} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <h3 className="font-semibold text-primary">{s.className}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm mt-2 text-center">
                            <div>
                                <p className="font-bold text-lg text-green-600">{s.present}</p>
                                <p className="text-xs text-gray-500">Có mặt</p>
                            </div>
                             <div>
                                <p className="font-bold text-lg text-teal-600">{s.absent}</p>
                                <p className="text-xs text-gray-500">Có phép</p>
                            </div>
                             <div>
                                <p className="font-bold text-lg text-red-600">{s.unexcusedAbsent}</p>
                                <p className="text-xs text-gray-500">Không phép</p>
                            </div>
                            <div>
                                <p className="font-bold text-lg text-yellow-600">{s.late}</p>
                                <p className="text-xs text-gray-500">Trễ</p>
                            </div>
                            <div>
                                <p className="font-bold text-lg text-blue-600">{s.percentage}%</p>
                                <p className="text-xs text-gray-500">Tỷ lệ</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


export const StudentDetailScreen: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { state, addAdjustment, updateTransaction, deleteTransaction, updateAttendance, deleteStudent } = useData();
    const { toast } = useToast();
    const { role } = useAuth();
    const navigate = useNavigate();
    const { students, classes, progressReports, transactions, attendance } = state;
    
    const [activeTab, setActiveTab] = useState('overview');
    const [transactionModal, setTransactionModal] = useState<{ open: boolean, item?: Transaction }>({ open: false });
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean, item?: Transaction }>({ open: false });
    const [attendanceLogModal, setAttendanceLogModal] = useState<{ isOpen: boolean; classId: string | null; className: string | null }>({ isOpen: false, classId: null, className: null });
    const [deleteStudentConfirmOpen, setDeleteStudentConfirmOpen] = useState(false);
    const [statusHistoryModalOpen, setStatusHistoryModalOpen] = useState(false);

    // Filter State
    const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());

    const canManage = role !== UserRole.VIEWER;
    const student = useMemo(() => students.find(s => s.id === id), [students, id]);
    
    // Updated logic to include both currently enrolled classes AND classes with attendance history
    const relatedClasses = useMemo(() => {
        if (!id) return [];
        const relatedClassIds = new Set<string>();

        // 1. Currently enrolled classes
        classes.forEach(c => {
            if (c.studentIds.includes(id)) {
                relatedClassIds.add(c.id);
            }
        });

        // 2. Classes with attendance records
        attendance.forEach(a => {
            if (a.studentId === id) {
                relatedClassIds.add(a.classId);
            }
        });

        return classes.filter(c => relatedClassIds.has(c.id));
    }, [classes, attendance, id]);
    
    const studentProgressReports = useMemo(() => 
        progressReports.filter(pr => pr.studentId === id),
    [progressReports, id]);

    const studentTransactions = useMemo(() => 
        transactions.filter(t => t.studentId === id),
    [transactions, id]);

    const [transactionSortConfig, setTransactionSortConfig] = useState<SortConfig<Transaction & { endingBalance: number }> | null>({ key: 'date', direction: 'descending' });
    
    const transactionsWithEndingBalance = useMemo(() => {
        if (!studentTransactions) return [];
        let runningBalance = 0;
        return [...studentTransactions]
            .sort((a, b) => {
                const dateComparison = new Date(a.date).getTime() - new Date(b.date).getTime();
                if (dateComparison !== 0) return dateComparison;
                return a.id.localeCompare(b.id);
            })
            .map(t => {
                runningBalance += t.amount;
                return { ...t, endingBalance: runningBalance };
            });
    }, [studentTransactions]);

    const sortedTransactionsWithEndingBalance = useMemo(() => {
        let sortableItems = [...transactionsWithEndingBalance];
        if (transactionSortConfig) {
            sortableItems.sort((a, b) => {
                if (transactionSortConfig.key === 'date') {
                    const aDate = new Date(a.date).getTime();
                    const bDate = new Date(b.date).getTime();
                    if (aDate < bDate) return transactionSortConfig.direction === 'ascending' ? -1 : 1;
                    if (aDate > bDate) return transactionSortConfig.direction === 'ascending' ? 1 : -1;
                    // If dates are also the same, use ID as a tie-breaker for stable sort
                    return transactionSortConfig.direction === 'ascending' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
                }
                
                const aValue = a[transactionSortConfig.key];
                const bValue = b[transactionSortConfig.key];
                
                if (aValue == null || bValue == null) return 0;

                if (aValue < bValue) return transactionSortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return transactionSortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [transactionsWithEndingBalance, transactionSortConfig]);

    const handleTransactionSort = (key: keyof (Transaction & { endingBalance: number })) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (transactionSortConfig && transactionSortConfig.key === key && transactionSortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setTransactionSortConfig({ key, direction });
    };
    
    const [reportSortConfig, setReportSortConfig] = useState<SortConfig<ProgressReport> | null>({ key: 'date', direction: 'descending' });
    const handleReportSort = (key: keyof ProgressReport) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (reportSortConfig && reportSortConfig.key === key && reportSortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setReportSortConfig({ key, direction });
    };
    const sortedStudentProgressReports = useMemo(() => {
        let sortableItems = [...studentProgressReports];
        if (reportSortConfig) {
            sortableItems.sort((a, b) => {
                const aValue = a[reportSortConfig.key];
                const bValue = b[reportSortConfig.key];
                if (aValue == null && bValue == null) return 0;
                if (aValue == null) return reportSortConfig.direction === 'ascending' ? 1 : -1;
                if (bValue == null) return reportSortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue < bValue) return reportSortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return reportSortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [studentProgressReports, reportSortConfig]);
    
    const attendanceLogForModal = useMemo(() => {
        if (!attendanceLogModal.classId || !student) return [];
        return attendance
            .filter(a => {
                if (a.studentId !== student.id || a.classId !== attendanceLogModal.classId) return false;
                if (filterMonth === 0) return true;
                const recordDate = new Date(a.date);
                return recordDate.getMonth() + 1 === filterMonth && recordDate.getFullYear() === filterYear;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [attendance, student, attendanceLogModal.classId, filterMonth, filterYear]);

    const handleAttendanceChange = async (recordToUpdate: AttendanceRecord, updates: Partial<AttendanceRecord>) => {
        const allRecordsForDay = attendance.filter(
            a => a.classId === recordToUpdate.classId && a.date === recordToUpdate.date && a.studentId !== recordToUpdate.studentId
        );
    
        const updatedRecord: AttendanceRecord = {
            ...recordToUpdate,
            ...updates,
        };
    
        const newRecordsForDay = [...allRecordsForDay, updatedRecord];
    
        try {
            await updateAttendance(newRecordsForDay);
            toast.success(`Đã cập nhật điểm danh ngày ${recordToUpdate.date}.`);
        } catch (error) {
            toast.error('Lỗi khi cập nhật điểm danh.');
        }
    };

    const getStatusBadge = (status: AttendanceStatus) => {
        switch (status) {
            case AttendanceStatus.PRESENT:
                return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Có mặt</span>;
            case AttendanceStatus.ABSENT:
                return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-teal-100 text-teal-800">Có phép</span>;
            case AttendanceStatus.UNEXCUSED_ABSENT:
                return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Không phép</span>;
            case AttendanceStatus.LATE:
                return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Trễ</span>;
            default:
                return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Chưa điểm danh</span>;
        }
    };


    if (!student) {
        return <div className="p-6 text-center text-red-500">Không tìm thấy học viên.</div>;
    }
    
    const handleSaveTransaction = async (data: { sign: 'CREDIT' | 'DEBIT'; amount: number; date: string; description: string; }) => {
        try {
            if (transactionModal.item) { // Editing existing transaction
                const updatedTransaction: Transaction = {
                    ...transactionModal.item,
                    date: data.date,
                    description: data.description,
                    amount: data.sign === 'CREDIT' ? data.amount : -data.amount,
                    type: data.sign === 'CREDIT' ? (transactionModal.item.type === TransactionType.PAYMENT ? TransactionType.PAYMENT : TransactionType.ADJUSTMENT_CREDIT) : TransactionType.ADJUSTMENT_DEBIT,
                };
                await updateTransaction(updatedTransaction);
                toast.success('Đã cập nhật giao dịch.');
            } else { // Adding new transaction
                await addAdjustment({
                    studentId: student.id,
                    amount: data.amount,
                    date: data.date,
                    description: data.description,
                    type: data.sign
                });
                toast.success('Đã thêm giao dịch thành công.');
            }
            setTransactionModal({ open: false });
        } catch (error) {
            toast.error("Lỗi khi lưu giao dịch.");
        }
    };

    const handleDeleteTransaction = async () => {
        if (deleteConfirm.item) {
            try {
                await deleteTransaction(deleteConfirm.item.id);
                toast.success('Đã xóa giao dịch.');
            } catch (error) {
                toast.error('Lỗi khi xóa giao dịch.');
            } finally {
                setDeleteConfirm({ open: false });
            }
        }
    };

    const handleEdit = () => {
        navigate(ROUTES.STUDENTS, { state: { editStudentId: student.id, returnTo: `/student/${student.id}` } });
    };

    const handleDelete = async () => {
        try {
            await deleteStudent(student.id);
            toast.success(`Đã xoá học viên ${student.name}`);
            navigate(ROUTES.STUDENTS, { replace: true });
        } catch (error) {
            toast.error('Lỗi khi xoá học viên.');
        }
        setDeleteStudentConfirmOpen(false);
    };

    const isEditable = (type: TransactionType) => type !== TransactionType.INVOICE;

    const transactionColumns = [
        { header: 'Ngày', accessor: (item: Transaction) => formatVietnamDate(item.date), sortable: true, sortKey: 'date' as keyof Transaction },
        { header: 'Loại', accessor: (item: Transaction) => transactionTypeMap[item.type], sortable: true, sortKey: 'type' as keyof Transaction },
        { header: 'Mô tả', accessor: 'description' as keyof Transaction, sortable: true },
        { header: 'Số tiền', accessor: (item: Transaction) => (
            <span className={item.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                {item.amount.toLocaleString('vi-VN')} ₫
            </span>
        ), sortable: true, sortKey: 'amount' as keyof Transaction },
        { header: 'Số dư cuối kỳ', accessor: (item: Transaction & { endingBalance: number }) => (
            <span className={`font-semibold ${item.endingBalance < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                {item.endingBalance.toLocaleString('vi-VN')} ₫
            </span>
        ), sortable: true, sortKey: 'endingBalance' as keyof (Transaction & { endingBalance: number }) },
    ];
    
    const reportColumns = [
        { header: 'Ngày', accessor: 'date' as keyof ProgressReport, sortable: true },
        { header: 'Lớp học', accessor: (item: ProgressReport) => classes.find(c => c.id === item.classId)?.name || 'N/A', sortable: true, sortKey: 'classId' as keyof ProgressReport },
        { header: 'Điểm', accessor: (item: ProgressReport) => item.score !== null ? item.score : 'N/A', sortable: true, sortKey: 'score' as keyof ProgressReport },
        { header: 'Nhận xét', accessor: 'comments' as keyof ProgressReport },
    ];

    const balanceColor = student.balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    const balanceBg = student.balance >= 0 ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20';

    const TabButton: React.FC<{ tabId: string; children: React.ReactNode }> = ({ tabId, children }) => (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`px-4 py-2 font-semibold transition-colors duration-200 border-b-2 whitespace-nowrap ${activeTab === tabId ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'}`}
        >
            {children}
        </button>
    );

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <>
            <div className="space-y-6">
                 <div className="card-base">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                         <div className="flex-grow">
                            <h1 className="text-3xl font-bold">{student.name}</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 inline-flex text-sm leading-5 font-semibold rounded-full ${student.status === PersonStatus.ACTIVE ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {student.status === PersonStatus.ACTIVE ? 'Đang hoạt động' : 'Tạm nghỉ'}
                                </span>
                                {student.statusChangedAt && (
                                    <span className="text-xs text-gray-500">
                                        (Từ: {formatVietnamDate(student.statusChangedAt)})
                                    </span>
                                )}
                                {student.statusHistory && student.statusHistory.length > 0 && (
                                    <button 
                                        onClick={() => setStatusHistoryModalOpen(true)}
                                        className="text-xs text-primary hover:underline ml-2"
                                    >
                                        Xem lịch sử
                                    </button>
                                )}
                            </div>
                        </div>
                        {canManage && (
                            <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                                <Button variant="secondary" onClick={handleEdit} className="flex-1 sm:flex-none">{ICONS.edit} Sửa</Button>
                                <Button variant="danger" onClick={() => setDeleteStudentConfirmOpen(true)} className="flex-1 sm:flex-none">{ICONS.delete} Xóa</Button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="border-b border-gray-200 dark:border-gray-700">
                    <nav className="-mb-px flex space-x-2 overflow-x-auto" aria-label="Tabs">
                        <TabButton tabId="overview">Tổng quan</TabButton>
                        <TabButton tabId="transactions">Lịch sử Giao dịch ({studentTransactions.length})</TabButton>
                        <TabButton tabId="reports">Báo cáo Học tập ({studentProgressReports.length})</TabButton>
                    </nav>
                </div>

                {activeTab === 'overview' && (
                    <div className="space-y-6">
                         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 card-base">
                                <h2 className="text-xl font-bold mb-4">Thông tin Chi tiết</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-600 dark:text-gray-300">
                                    <p><strong>Email:</strong> {student.email}</p>
                                    <p><strong>Điện thoại:</strong> {student.phone}</p>
                                    <p><strong>Ngày sinh:</strong> {student.dob}</p>
                                    <p><strong>Phụ huynh:</strong> {student.parentName}</p>
                                    <p><strong>Miễn giảm học phí:</strong> {student.discountPercentage ? `${student.discountPercentage}%` : 'Không'}</p>
                                    <p className="col-span-1 md:col-span-2"><strong>Địa chỉ:</strong> {student.address}</p>
                                </div>
                            </div>
                             <div 
                                className={`card-base flex flex-col items-center justify-center text-center ${balanceBg} ${canManage && student.balance < 0 ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                                onClick={() => canManage && student.balance < 0 && setPaymentModalOpen(true)}
                                title={canManage && student.balance < 0 ? 'Ghi nhận thanh toán' : ''}
                            >
                                <h2 className={`text-sm font-medium ${balanceColor} uppercase tracking-wider`}>Số dư tài khoản</h2>
                                <p className={`text-4xl font-bold mt-2 ${balanceColor}`}>{student.balance.toLocaleString('vi-VN')} ₫</p>
                                 {canManage && student.balance < 0 && (
                                    <div className="mt-2 text-xs font-semibold p-1 bg-black/10 rounded">
                                        Nhấn để ghi nhận thanh toán
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
                            <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Lọc dữ liệu điểm danh:</span>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="form-select text-sm py-1.5 w-1/2 sm:w-auto">
                                    <option value={0}>Tất cả các tháng</option>
                                    {months.map(m => <option key={m} value={m}>Tháng {m}</option>)}
                                </select>
                                <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="form-select text-sm py-1.5 w-1/2 sm:w-auto">
                                    {years.map(y => <option key={y} value={y}>Năm {y}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="card-base">
                            <h2 className="text-xl font-semibold mb-4">Các lớp tham gia</h2>
                            <div className="space-y-2">
                                {relatedClasses.map(c => {
                                    const isCurrentlyEnrolled = c.studentIds.includes(student.id);
                                    return (
                                        <div key={c.id} className={`flex justify-between items-center p-3 rounded-md border ${isCurrentlyEnrolled ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700' : 'bg-gray-50 dark:bg-gray-700/30 border-dashed border-gray-300 dark:border-gray-600'}`}>
                                            <Link to={`/class/${c.id}`} className="block hover:underline flex-grow">
                                                <p className={`font-semibold ${isCurrentlyEnrolled ? 'text-primary' : 'text-gray-600 dark:text-gray-400'}`}>
                                                    {c.name} {!isCurrentlyEnrolled && <span className="text-xs font-normal italic ml-2">(Lịch sử / Đã nghỉ)</span>}
                                                </p>
                                                <p className="text-sm text-gray-500">{c.subject}</p>
                                            </Link>
                                            <button 
                                                onClick={() => setAttendanceLogModal({ isOpen: true, classId: c.id, className: c.name })}
                                                className="ml-4 text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 underline whitespace-nowrap"
                                            >
                                                Xem điểm danh
                                            </button>
                                        </div>
                                    );
                                })}
                                {relatedClasses.length === 0 && <p className="text-gray-500">Chưa tham gia lớp học nào.</p>}
                            </div>
                        </div>
                        <AttendanceSummaryWidget 
                            studentId={student.id} 
                            enrolledClasses={relatedClasses}
                            filterMonth={filterMonth}
                            filterYear={filterYear}
                        />
                    </div>
                )}
                
                {activeTab === 'transactions' && (
                     <div className="card-base">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                            <h2 className="text-xl font-semibold">Sổ cái Giao dịch</h2>
                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={() => {
                                    const typeMap: Record<string, string> = {
                                        INVOICE: 'Hóa đơn', PAYMENT: 'Thanh toán',
                                        ADJUSTMENT_CREDIT: 'Ghi có', ADJUSTMENT_DEBIT: 'Phí khác'
                                    };
                                    const rows = sortedTransactionsWithEndingBalance.map((t, i) => `<tr>
                                        <td style="border:1px solid #ddd;padding:6px 8px;text-align:center;font-size:12px">${i + 1}</td>
                                        <td style="border:1px solid #ddd;padding:6px 8px;font-size:12px">${formatVietnamDate(t.date)}</td>
                                        <td style="border:1px solid #ddd;padding:6px 8px;font-size:12px">${typeMap[t.type] || t.type}</td>
                                        <td style="border:1px solid #ddd;padding:6px 8px;font-size:12px">${t.description}</td>
                                        <td style="border:1px solid #ddd;padding:6px 8px;text-align:right;font-size:12px;color:${t.amount >= 0 ? '#16a34a' : '#dc2626'}">${t.amount.toLocaleString('vi-VN')} ₫</td>
                                        <td style="border:1px solid #ddd;padding:6px 8px;text-align:right;font-size:12px;font-weight:600;color:${t.endingBalance < 0 ? '#dc2626' : '#111'}">${t.endingBalance.toLocaleString('vi-VN')} ₫</td>
                                    </tr>`).join('');
                                    const pw = window.open('', '_blank');
                                    if (!pw) return;
                                    pw.document.write(`<!DOCTYPE html><html><head><title>Sổ cái - ${student.name}</title>
                                        <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;padding:15mm}
                                        table{border-collapse:collapse;width:100%}th{background:#f3f4f6;font-weight:600}
                                        @media print{body{-webkit-print-color-adjust:exact}}</style>
                                    </head><body>
                                        <h2 style="text-align:center;margin-bottom:4px">${state.settings.name}</h2>
                                        <h3 style="text-align:center;margin-bottom:12px;color:#666">SỔ CÁI GIAO DỊCH</h3>
                                        <div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:13px">
                                            <span><b>Học viên:</b> ${student.name} (${student.id})</span>
                                            <span><b>Số dư:</b> <span style="color:${student.balance >= 0 ? '#16a34a' : '#dc2626'};font-weight:700">${student.balance.toLocaleString('vi-VN')} ₫</span></span>
                                        </div>
                                        <table>
                                            <thead><tr>
                                                <th style="border:1px solid #ddd;padding:8px;width:35px">STT</th>
                                                <th style="border:1px solid #ddd;padding:8px;width:100px">Ngày</th>
                                                <th style="border:1px solid #ddd;padding:8px;width:85px">Loại</th>
                                                <th style="border:1px solid #ddd;padding:8px">Mô tả</th>
                                                <th style="border:1px solid #ddd;padding:8px;width:110px;text-align:right">Số tiền</th>
                                                <th style="border:1px solid #ddd;padding:8px;width:110px;text-align:right">Số dư</th>
                                            </tr></thead>
                                            <tbody>${rows}</tbody>
                                        </table>
                                        <div style="text-align:right;margin-top:10px;font-size:12px;color:#666">
                                            Tổng: ${sortedTransactionsWithEndingBalance.length} giao dịch | Ngày in: ${new Date().toLocaleDateString('vi-VN')}
                                        </div>
                                    </body></html>`);
                                    pw.document.close();
                                    setTimeout(() => pw.print(), 500);
                                }} className="print-hidden">
                                    {ICONS.print} <span className="ml-1">In sổ</span>
                                </Button>
                                {canManage && (
                                    <Button onClick={() => setTransactionModal({ open: true })} className="w-full md:w-auto">
                                        {ICONS.plus} Thêm Giao dịch
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="hidden md:block">
                            <Table<Transaction & { endingBalance: number }>
                                columns={transactionColumns}
                                data={sortedTransactionsWithEndingBalance}
                                sortConfig={transactionSortConfig}
                                onSort={handleTransactionSort as any}
                                actions={(item) => canManage && isEditable(item.type) ? (
                                    <>
                                        <button onClick={() => setTransactionModal({ open: true, item })} className="text-indigo-600 hover:text-indigo-900">{ICONS.edit}</button>
                                        <button onClick={() => setDeleteConfirm({ open: true, item })} className="text-red-600 hover:text-red-900">{ICONS.delete}</button>
                                    </>
                                ) : null}
                            />
                        </div>
                         <div className="md:hidden space-y-4">
                            {sortedTransactionsWithEndingBalance.map(item => (
                                <ListItemCard
                                    key={item.id}
                                    title={<span className="font-semibold">{item.description}</span>}
                                    details={[
                                        { label: "Ngày", value: formatVietnamDate(item.date) },
                                        { label: "Số tiền", value: <span className={item.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{item.amount.toLocaleString('vi-VN')} ₫</span> },
                                        { label: "Số dư cuối kỳ", value: <span className={`font-semibold ${item.endingBalance < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{item.endingBalance.toLocaleString('vi-VN')} ₫</span> },
                                    ]}
                                    actions={canManage && isEditable(item.type) ? (
                                        <><Button variant="secondary" size="sm" onClick={() => setTransactionModal({ open: true, item })}>Sửa</Button><Button variant="danger" size="sm" onClick={() => setDeleteConfirm({ open: true, item })}>Xóa</Button></>
                                    ) : undefined}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'reports' && (
                     <div className="card-base">
                        <h2 className="text-xl font-semibold mb-4">Lịch sử Báo cáo Tiến độ</h2>
                        <div className="hidden md:block">
                            <Table<ProgressReport>
                                columns={reportColumns}
                                data={sortedStudentProgressReports}
                                sortConfig={reportSortConfig}
                                onSort={handleReportSort}
                            />
                        </div>
                        <div className="md:hidden space-y-4">
                            {sortedStudentProgressReports.map(report => (
                                <ListItemCard
                                    key={report.id}
                                    title={<div className="flex justify-between w-full"><span>{classes.find(c => c.id === report.classId)?.name || 'N/A'}</span><span className="text-primary font-bold">{report.score !== null ? `${report.score}/10` : 'N/A'}</span></div>}
                                    details={[
                                        { label: "Ngày", value: report.date },
                                        { label: "Nhận xét", value: <i className="block whitespace-normal">{report.comments}</i> },
                                    ]}
                                />
                            ))}
                         </div>
                    </div>
                )}

                <Modal isOpen={transactionModal.open} onClose={() => setTransactionModal({ open: false })} title={transactionModal.item ? 'Sửa Giao dịch' : 'Thêm Giao dịch Mới'}>
                    <AdjustmentForm
                        transactionToEdit={transactionModal.item}
                        onSubmit={handleSaveTransaction}
                        onCancel={() => setTransactionModal({ open: false })}
                    />
                </Modal>
                <ConfirmationModal
                    isOpen={deleteConfirm.open}
                    onClose={() => setDeleteConfirm({ open: false })}
                    onConfirm={handleDeleteTransaction}
                    title="Xác nhận Xóa Giao dịch"
                    message={<p>Bạn có chắc muốn xóa giao dịch "<strong>{deleteConfirm.item?.description}</strong>"? Hành động này sẽ hoàn lại số tiền vào số dư của học viên.</p>}
                />
                 <PaymentModal
                    isOpen={paymentModalOpen}
                    onClose={() => setPaymentModalOpen(false)}
                    student={student}
                />
                <Modal 
                    isOpen={attendanceLogModal.isOpen} 
                    onClose={() => setAttendanceLogModal({ isOpen: false, classId: null, className: null })}
                    title={`Lịch sử điểm danh: ${attendanceLogModal.className} ${filterMonth === 0 ? '(Tất cả)' : `(Tháng ${filterMonth}/${filterYear})`}`}
                >
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                        {attendanceLogForModal.length > 0 ? (
                            attendanceLogForModal.map(record => (
                                <div key={record.id} className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-md">
                                    <div className="flex items-center justify-between">
                                        <p className="font-semibold">{record.date}</p>
                                        {canManage ? (
                                            <select
                                                value={record.status}
                                                onChange={(e) => handleAttendanceChange(record, { status: e.target.value as AttendanceStatus })}
                                                className="form-select py-1 px-2 text-sm w-32"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <option value={AttendanceStatus.PRESENT}>Có mặt</option>
                                                <option value={AttendanceStatus.ABSENT}>Có phép</option>
                                                <option value={AttendanceStatus.UNEXCUSED_ABSENT}>Không phép</option>
                                                <option value={AttendanceStatus.LATE}>Trễ</option>
                                                <option value={AttendanceStatus.UNMARKED}>Chưa TC</option>
                                            </select>
                                        ) : (
                                            getStatusBadge(record.status)
                                        )}
                                    </div>
                                    <div className="w-full">
                                        <input
                                            key={record.id + '-' + (record.note || '')}
                                            type="text"
                                            placeholder="Ghi chú (ví dụ: Ốm, bận việc gia đình...)"
                                            className="form-input text-sm w-full"
                                            defaultValue={record.note || ''}
                                            onBlur={(e) => {
                                                if (e.target.value !== (record.note || '')) {
                                                    handleAttendanceChange(record, { note: e.target.value });
                                                }
                                            }}
                                            disabled={!canManage}
                                        />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center py-4 text-gray-500">Chưa có dữ liệu điểm danh phù hợp.</p>
                        )}
                    </div>
                </Modal>
                 <ConfirmationModal
                    isOpen={deleteStudentConfirmOpen}
                    onClose={() => setDeleteStudentConfirmOpen(false)}
                    onConfirm={handleDelete}
                    title="Xác nhận Xóa Học viên"
                    message={
                        <p>
                            Bạn có chắc chắn muốn xoá học viên <strong>{student?.name}</strong>?
                            <br /><br />
                            <span className="font-bold text-red-500">CẢNH BÁO:</span> Toàn bộ dữ liệu học phí, điểm danh và báo cáo của học viên này cũng sẽ bị XOÁ VĨNH VIỄN.
                        </p>
                    }
                />
                <Modal
                    isOpen={statusHistoryModalOpen}
                    onClose={() => setStatusHistoryModalOpen(false)}
                    title={`Lịch sử trạng thái: ${student.name}`}
                >
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                        {student.statusHistory && student.statusHistory.length > 0 ? (
                            <div className="relative border-l border-gray-200 dark:border-gray-700 ml-3">
                                {student.statusHistory.slice().reverse().map((history, index) => (
                                    <div key={index} className="mb-6 ml-4">
                                        <div className="absolute w-3 h-3 bg-gray-200 rounded-full mt-1.5 -left-1.5 border border-white dark:border-gray-900 dark:bg-gray-700"></div>
                                        <time className="mb-1 text-sm font-normal leading-none text-gray-400 dark:text-gray-500">
                                            {formatVietnamDate(history.changedAt)}
                                        </time>
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${history.status === PersonStatus.ACTIVE ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {history.status === PersonStatus.ACTIVE ? 'Hoạt động' : 'Tạm nghỉ'}
                                            </span>
                                        </h3>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center py-4 text-gray-500">Chưa có lịch sử thay đổi trạng thái.</p>
                        )}
                    </div>
                </Modal>
            </div>
        </>
    );
};
