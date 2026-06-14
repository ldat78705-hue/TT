
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../hooks/useDataContext';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { Table, SortConfig } from '../components/common/Table';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Student, ProgressReport, AttendanceRecord, PersonStatus, UserRole, AttendanceStatus } from '../types';
import { ICONS, ROUTES } from '../constants';
import { ListItemCard } from '../components/common/ListItemCard';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { getVietnamTime, formatVietnamDate } from '../utils/date';
import { BulkProgressModal } from '../components/progress/BulkProgressModal';
import { ExportButton } from '../components/common/ExportButton';


const ProgressReportForm: React.FC<{
    classStudents: Student[];
    creatorId: string;
    classId: string;
    report?: ProgressReport;
    onSubmit: (report: Omit<ProgressReport, 'id'>) => void;
    onCancel: () => void;
}> = ({ classStudents, creatorId, classId, report, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState({
        studentId: report?.studentId || classStudents[0]?.id || '',
        score: report?.score !== null && report?.score !== undefined ? report.score.toString() : '',
        comments: report?.comments || '',
        date: report?.date || getVietnamTime().split('T')[0],
    });
    const scoreInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        scoreInputRef.current?.focus();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            ...formData,
            score: formData.score.trim() === '' ? null : parseFloat(formData.score),
            classId,
            createdBy: report ? report.createdBy : creatorId,
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium">Học viên</label>
                <select name="studentId" value={formData.studentId} onChange={handleChange} className="form-select mt-1" disabled={!!report}>
                    {classStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>
             <div>
                <label className="block text-sm font-medium">Điểm số (thang 10)</label>
                <input ref={scoreInputRef} type="number" name="score" value={formData.score} onChange={handleChange} className="form-input mt-1" min="0" max="10" step="0.1" />
            </div>
            <div>
                <label className="block text-sm font-medium">Nhận xét của giáo viên</label>
                <textarea name="comments" value={formData.comments} onChange={handleChange} rows={5} className="form-textarea mt-1" required />
            </div>
            <div>
                <label className="block text-sm font-medium">Ngày báo cáo</label>
                <input type="date" name="date" value={formData.date} onChange={handleChange} className="form-input mt-1" required />
            </div>
             <div className="flex justify-end space-x-4 pt-4 border-t dark:border-gray-700">
                <Button type="button" variant="secondary" onClick={onCancel}>Hủy</Button>
                <Button type="submit">{report ? 'Cập nhật' : 'Lưu Báo cáo'}</Button>
            </div>
        </form>
    );
};

type ClassDetailTab = 'students' | 'attendance' | 'reports' | 'announcements';


const AttendanceTab: React.FC<{ cls: any, attendance: AttendanceRecord[] }> = ({ cls, attendance }) => {
    const [selectedDate, setSelectedDate] = useState(getVietnamTime().split('T')[0]);
    const navigate = useNavigate();
    const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

    const monthlyAttendanceHistory = useMemo(() => {
        // First, get daily summaries like before
        const dailyHistoryMap = new Map<string, { present: number, absent: number, unexcusedAbsent: number, late: number, total: number }>();
        const classAttendance = attendance.filter(a => a.classId === cls.id);

        classAttendance.forEach(a => {
            if (!dailyHistoryMap.has(a.date)) {
                dailyHistoryMap.set(a.date, { present: 0, absent: 0, unexcusedAbsent: 0, late: 0, total: 0 });
            }
            const summary = dailyHistoryMap.get(a.date)!;
            summary.total++;
            if (a.status === AttendanceStatus.PRESENT) summary.present++;
            if (a.status === AttendanceStatus.ABSENT) summary.absent++;
            if (a.status === AttendanceStatus.UNEXCUSED_ABSENT) summary.unexcusedAbsent++;
            if (a.status === AttendanceStatus.LATE) summary.late++;
        });

        const dailySummaries = Array.from(dailyHistoryMap.entries())
            .map(([date, summary]) => ({ date, summary }))
            .sort((a, b) => b.date.localeCompare(a.date)); // Sort dates within month descending

        // Now group daily summaries by month
        const monthlyMap = new Map<string, { date: string; summary: any }[]>(); // Map<"YYYY-MM", [dailySummary, ...]>
        dailySummaries.forEach(daySummary => {
            const month = daySummary.date.substring(0, 7); // "YYYY-MM"
            if (!monthlyMap.has(month)) {
                monthlyMap.set(month, []);
            }
            monthlyMap.get(month)!.push(daySummary);
        });

        // Format for rendering, sorted by month descending
        return Array.from(monthlyMap.entries())
            .map(([month, dates]) => ({
                month,
                sessionCount: dates.length,
                dates: dates, // Already sorted descending
            }))
            .sort((a, b) => b.month.localeCompare(a.month));

    }, [attendance, cls.id]);
    
    const toggleMonth = (month: string) => {
        setExpandedMonth(prev => (prev === month ? null : month));
    };
    
    return (
        <div className="space-y-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <p className="font-semibold">Chọn ngày để điểm danh hoặc xem lại:</p>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={e => setSelectedDate(e.target.value)}
                        className="form-input flex-grow"
                    />
                    <Button onClick={() => navigate(ROUTES.ATTENDANCE_DETAIL.replace(':classId', cls.id).replace(':date', selectedDate), { state: { returnTo: `/class/${cls.id}`, defaultTab: 'attendance' } })} className="flex-shrink-0">
                        Điểm danh
                    </Button>
                </div>
            </div>
            <div>
                <h3 className="text-lg font-semibold mb-2">Lịch sử điểm danh</h3>
                {monthlyAttendanceHistory.length > 0 ? (
                     <div className="space-y-2">
                        {monthlyAttendanceHistory.map(({ month, sessionCount, dates }) => {
                            const [year, monthNum] = month.split('-');
                            const isExpanded = expandedMonth === month;
                            return (
                                <div key={month} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg transition-shadow hover:shadow-md">
                                    <button
                                        onClick={() => toggleMonth(month)}
                                        className="w-full p-3 flex justify-between items-center text-left"
                                        aria-expanded={isExpanded}
                                    >
                                        <div>
                                            <p className="font-semibold text-base">Tháng {monthNum}/{year}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Tổng số buổi: <span className="font-bold">{sessionCount}</span>
                                            </p>
                                        </div>
                                        <span className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                        </span>
                                    </button>
                                    
                                    {isExpanded && (
                                        <div className="px-3 pb-3 space-y-2 border-t border-slate-200 dark:border-slate-600">
                                            {dates.map(({ date, summary }) => (
                                                <div key={date} className="p-3 bg-white dark:bg-slate-800 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                                    <div>
                                                        <p className="font-semibold">{new Date(date + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                                            {summary.present + summary.late + summary.absent + summary.unexcusedAbsent > 0 ? (
                                                                <>
                                                                    Có mặt: <span className="text-green-600 font-semibold">{summary.present + summary.late}</span>, 
                                                                    Có phép: <span className="text-teal-600 font-semibold">{summary.absent}</span>,
                                                                    Không phép: <span className="text-red-600 font-semibold">{summary.unexcusedAbsent}</span>
                                                                </>
                                                            ) : (
                                                                <span className="text-yellow-600 font-semibold">Đã ghi chú (Nghỉ đột xuất)</span>
                                                            )}
                                                        </p>
                                                    </div>
                                                    <Link to={ROUTES.ATTENDANCE_DETAIL.replace(':classId', cls.id).replace(':date', date)} state={{ returnTo: `/class/${cls.id}`, defaultTab: 'attendance' }}>
                                                        <Button variant="secondary" size="sm">Xem / Sửa</Button>
                                                    </Link>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-gray-500 text-center py-4">Chưa có lịch sử điểm danh.</p>
                )}
            </div>
        </div>
    );
}

const ClassAnnouncementForm: React.FC<{
    onSubmit: (data: { title: string; content: string }) => void;
    onCancel: () => void;
}> = ({ onSubmit, onCancel }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const titleInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        titleInputRef.current?.focus();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ title, content });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium">Tiêu đề</label>
                <input
                    ref={titleInputRef}
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="form-input mt-1"
                    required
                />
            </div>
            <div>
                <label className="block text-sm font-medium">Nội dung</label>
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={6}
                    className="form-textarea mt-1"
                    required
                />
            </div>
            <div className="flex justify-end space-x-4 pt-4 border-t dark:border-gray-700">
                <Button type="button" variant="secondary" onClick={onCancel}>Hủy</Button>
                <Button type="submit">Đăng Thông báo</Button>
            </div>
        </form>
    );
};

const AnnouncementsTab: React.FC<{
    classId: string;
}> = ({ classId }) => {
    const { state, addAnnouncement } = useData();
    const { user, role } = useAuth();
    const { toast } = useToast();
    const [isModalOpen, setModalOpen] = useState(false);

    const canManage = role === UserRole.ADMIN || role === UserRole.MANAGER || role === UserRole.TEACHER;

    const classAnnouncements = useMemo(() => {
        return state.announcements
            .filter(ann => ann.classId === classId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [state.announcements, classId]);

    const handleAddAnnouncement = async (data: { title: string; content: string }) => {
        if (!user) return;
        try {
            await addAnnouncement({
                ...data,
                targetAudience: 'CLASS',
                classId: classId,
                createdAt: getVietnamTime(),
                createdBy: user.name,
            });
            toast.success('Đã gửi thông báo đến lớp học.');
            setModalOpen(false);
        } catch (error) {
            toast.error("Lỗi khi gửi thông báo.");
        }
    };

    return (
        <>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Thông báo của Lớp</h2>
                {canManage && (
                    <Button onClick={() => setModalOpen(true)}>
                        {ICONS.plus} Tạo Thông báo
                    </Button>
                )}
            </div>
            {classAnnouncements.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Chưa có thông báo nào cho lớp này.</p>
            ) : (
                <div className="space-y-4">
                    {classAnnouncements.map(ann => (
                        <div key={ann.id} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            <h3 className="font-semibold text-lg">{ann.title}</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Đăng ngày {ann.createdAt} bởi {ann.createdBy}
                            </p>
                            <p className="mt-2 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{ann.content}</p>
                        </div>
                    ))}
                </div>
            )}
             <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Tạo Thông báo Lớp học">
                <ClassAnnouncementForm
                    onSubmit={handleAddAnnouncement}
                    onCancel={() => setModalOpen(false)}
                />
            </Modal>
        </>
    );
}

export const ClassDetailScreen: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const { state, addProgressReport, updateProgressReport, deleteProgressReport, deleteClass, addBulkProgressReports } = useData();
    const { user, role } = useAuth();
    const { toast } = useToast();
    const { classes, students, teachers, progressReports, attendance } = state;
    const [isReportModalOpen, setReportModalOpen] = useState(false);
    const [isBulkProgModalOpen, setBulkProgModalOpen] = useState(false);
    const [editingReport, setEditingReport] = useState<ProgressReport | undefined>(undefined);
    const [activeTab, setActiveTab] = useState<ClassDetailTab>('students');
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteReportConfirm, setDeleteReportConfirm] = useState<{ isOpen: boolean; report: ProgressReport | null }>({ isOpen: false, report: null });

    const canManage = role === UserRole.ADMIN || role === UserRole.MANAGER;
    // Allow teachers to manage reports if they are assigned to this class
    const isAssignedTeacher = role === UserRole.TEACHER && classes.find(c => c.id === id)?.teacherIds.includes(user?.id || '');
    const canManageReports = canManage || isAssignedTeacher;

    useEffect(() => {
        if (location.state?.defaultTab) {
            setActiveTab(location.state.defaultTab);
        }
    }, [location.state]);

    const cls = classes.find(c => c.id === id);

    const teacherNames = useMemo(() => {
        if (!cls) return '';
        return (cls.teacherIds || [])
            .map(id => teachers.find(t => t.id === id)?.name)
            .filter(Boolean)
            .join(', ');
    }, [cls?.teacherIds, teachers, cls]);

    const classStudents = useMemo(() => {
        if (!cls) return [];
        return students.filter(s => (cls.studentIds || []).includes(s.id) && s.status === PersonStatus.ACTIVE);
    }, [students, cls?.studentIds, cls]);
    const classProgressReports = useMemo(() => progressReports.filter(pr => pr.classId === id), [progressReports, id]);
    const classAttendance = useMemo(() => attendance.filter(a => a.classId === id), [attendance, id]);

    const [studentSortConfig, setStudentSortConfig] = useState<SortConfig<Student> | null>({ key: 'name', direction: 'ascending' });
    const handleStudentSort = (key: keyof Student) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (studentSortConfig && studentSortConfig.key === key && studentSortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setStudentSortConfig({ key, direction });
    };
    const sortedClassStudents = useMemo(() => {
        let sortableItems = [...classStudents];
        if (studentSortConfig) {
            const getLastName = (fullName: string) => {
                if (!fullName) return '';
                const parts = fullName.trim().split(/\s+/);
                return parts[parts.length - 1];
            };

            sortableItems.sort((a, b) => {
                if (studentSortConfig.key === 'name') {
                    const lastNameA = getLastName(a.name);
                    const lastNameB = getLastName(b.name);
                    
                    const lastNameComparison = lastNameA.localeCompare(lastNameB, 'vi');
                    
                    if (lastNameComparison !== 0) {
                        return studentSortConfig.direction === 'ascending' ? lastNameComparison : -lastNameComparison;
                    }

                    // If last names are the same, sort by full name for stability
                    const fullNameComparison = a.name.localeCompare(b.name, 'vi');
                    return studentSortConfig.direction === 'ascending' ? fullNameComparison : -fullNameComparison;
                }

                // Fallback for other columns
                const aValue = a[studentSortConfig.key];
                const bValue = b[studentSortConfig.key];
                
                if (aValue == null || bValue == null) return 0;
                
                if (aValue < bValue) return studentSortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return studentSortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [classStudents, studentSortConfig]);

    const [reportSortConfig, setReportSortConfig] = useState<SortConfig<ProgressReport> | null>({ key: 'date', direction: 'descending' });
    const handleReportSort = (key: keyof ProgressReport) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (reportSortConfig && reportSortConfig.key === key && reportSortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setReportSortConfig({ key, direction });
    };
    const sortedClassProgressReports = useMemo(() => {
        let sortableItems = [...classProgressReports];
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
    }, [classProgressReports, reportSortConfig]);

    const getStudentName = (studentId: string) => students.find(s => s.id === studentId)?.name || 'N/A';
        
    const exportReportData = useMemo(() => sortedClassProgressReports.map(r => ({
        date: formatVietnamDate(r.date),
        studentId: r.studentId,
        studentName: getStudentName(r.studentId),
        score: r.score,
        comments: r.comments
    })), [sortedClassProgressReports]);

    const exportReportColumns = {
        date: 'Ngày',
        studentId: 'Mã Học viên',
        studentName: 'Tên Học viên',
        score: 'Điểm',
        comments: 'Nhận xét'
    };

    // Early returns AFTER all hooks
    if (!cls) return <div>Lớp học không tồn tại.</div>;
    if (!user || !user.id) return <div>Lỗi xác thực người dùng.</div>;

    const studentColumns = [
        { header: 'Mã HV', accessor: 'id' as keyof Student, sortable: true },
        { header: 'Họ tên', accessor: 'name' as keyof Student, sortable: true },
        { header: 'Email', accessor: 'email' as keyof Student, sortable: true },
        { header: 'Phụ huynh', accessor: 'parentName' as keyof Student, sortable: true },
    ];
    
    const reportColumns = [
        { header: 'Ngày', accessor: 'date' as keyof ProgressReport, sortable: true },
        { header: 'Học viên', accessor: (item: ProgressReport) => getStudentName(item.studentId) },
        { header: 'Điểm', accessor: (item: ProgressReport) => item.score !== null ? item.score : 'N/A', sortable: true, sortKey: 'score' as keyof ProgressReport },
        { header: 'Nhận xét', accessor: 'comments' as keyof ProgressReport },
    ];
    
    const handleSaveReport = async (reportData: Omit<ProgressReport, 'id'>) => {
        try {
            if (editingReport) {
                await updateProgressReport({ ...reportData, id: editingReport.id });
                toast.success(`Đã cập nhật báo cáo cho học viên ${getStudentName(reportData.studentId)}.`);
            } else {
                await addProgressReport(reportData);
                toast.success(`Đã thêm báo cáo cho học viên ${getStudentName(reportData.studentId)}.`);
            }
            setReportModalOpen(false);
            setEditingReport(undefined);
        } catch (error) {
            toast.error('Đã xảy ra lỗi. Vui lòng thử lại.');
        }
    };

    const handleDeleteReport = async () => {
        if (deleteReportConfirm.report) {
            try {
                await deleteProgressReport(deleteReportConfirm.report.id);
                toast.success('Đã xóa báo cáo tiến độ.');
            } catch (error) {
                toast.error('Lỗi khi xóa báo cáo.');
            } finally {
                setDeleteReportConfirm({ isOpen: false, report: null });
            }
        }
    };

    const handleEdit = () => {
        navigate(ROUTES.CLASSES, { state: { editClassId: cls.id, returnTo: `/class/${cls.id}` } });
    };

    const handleDelete = async () => {
        try {
            await deleteClass(cls.id);
            toast.success(`Đã xoá lớp học ${cls.name}`);
            navigate(ROUTES.CLASSES, { replace: true });
        } catch (error) {
            toast.error('Lỗi khi xoá lớp học.');
        }
        setDeleteConfirmOpen(false);
    };

    const dayMap: Record<string, string> = {
        'Monday': 'Thứ Hai', 'Tuesday': 'Thứ Ba', 'Wednesday': 'Thứ Tư', 'Thursday': 'Thứ Năm',
        'Friday': 'Thứ Sáu', 'Saturday': 'Thứ Bảy', 'Sunday': 'Chủ Nhật'
    };
    
    const TabButton: React.FC<{ tabId: ClassDetailTab; children: React.ReactNode }> = ({ tabId, children }) => (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`px-4 py-2 font-semibold transition-colors duration-200 border-b-2 whitespace-nowrap ${activeTab === tabId ? 'border-primary text-primary' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'}`}
        >
            {children}
        </button>
    );

    return (
        <div className="space-y-6">
            <div className="card-base">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="flex-grow">
                        <h1 className="text-3xl font-bold">{cls.name}</h1>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-sm">
                            <span className="bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full font-mono font-semibold">ID: {cls.id}</span>
                            <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 px-3 py-1 rounded-full font-semibold">Môn: {cls.subject}</span>
                            <span className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 px-3 py-1 rounded-full font-semibold">GV: {teacherNames}</span>
                        </div>
                        <div className="mt-4 text-sm text-gray-600 dark:text-gray-300 flex flex-wrap gap-x-4 gap-y-1">
                            {(cls.schedule || []).map((s, i) => {
                                const room = state.rooms?.find((r: any) => r.id === s.roomId);
                                return (
                                    <div key={i} className="font-semibold">{`${dayMap[s.dayOfWeek]}: ${s.startTime} - ${s.endTime}`}{room ? <span className="ml-1 text-xs font-normal text-indigo-600 dark:text-indigo-400">({room.name})</span> : null}</div>
                                );
                            })}
                        </div>
                    </div>
                    {canManage && (
                        <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                            <Button variant="secondary" onClick={handleEdit} className="flex-1 sm:flex-none">{ICONS.edit} Sửa</Button>
                            <Button variant="danger" onClick={() => setDeleteConfirmOpen(true)} className="flex-1 sm:flex-none">{ICONS.delete} Xóa</Button>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-2 overflow-x-auto" aria-label="Tabs">
                    <TabButton tabId="students">Học viên ({classStudents.length})</TabButton>
                    <TabButton tabId="attendance">Điểm danh</TabButton>
                    <TabButton tabId="reports">Báo cáo ({classProgressReports.length})</TabButton>
                    <TabButton tabId="announcements">Thông báo</TabButton>
                </nav>
            </div>
            
            <div className="card-base">
                {activeTab === 'students' && (
                    <>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                            <h2 className="text-xl font-semibold">Danh sách học viên</h2>
                            {sortedClassStudents.length > 0 && (
                                <Button variant="secondary" onClick={() => {
                                    const cardsPerPage = 10;
                                    const cards = sortedClassStudents.map(s => {
                                        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(s.id)}&format=png`;
                                        return `<div style="width:88mm;height:42mm;border:1px solid #ccc;border-radius:8px;padding:5px;display:inline-flex;align-items:center;gap:6px;background:white;page-break-inside:avoid;box-sizing:border-box;">
                                            <img src="${qrUrl}" style="width:34mm;height:34mm;flex-shrink:0;" />
                                            <div style="flex:1;overflow:hidden;min-width:0;">
                                                <div style="font-weight:bold;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.name}</div>
                                                <div style="font-size:10px;color:#666;font-family:monospace;">${s.id}</div>
                                                <div style="font-size:9px;color:#999;margin-top:1px;">${cls.name}</div>
                                            </div>
                                        </div>`;
                                    });
                                    const pages: string[] = [];
                                    for (let i = 0; i < cards.length; i += cardsPerPage) {
                                        pages.push(`<div style="display:flex;flex-wrap:wrap;gap:3mm;justify-content:center;align-content:flex-start;width:190mm;min-height:277mm;page-break-after:always;">${cards.slice(i, i + cardsPerPage).join('')}</div>`);
                                    }
                                    const pw = window.open('', '_blank');
                                    if (!pw) return;
                                    pw.document.write(`<!DOCTYPE html><html><head><title>Thẻ QR - ${cls.name}</title>
                                        <style>
                                            *{margin:0;padding:0;box-sizing:border-box}
                                            body{font-family:'Segoe UI',Arial,sans-serif}
                                            @page{size:A4;margin:10mm}
                                            @media print{body{-webkit-print-color-adjust:exact}}
                                            .page-container > div:last-child{page-break-after:avoid}
                                        </style>
                                    </head><body>
                                        <div class="page-container">${pages.join('')}</div>
                                    </body></html>`);
                                    pw.document.close();
                                    setTimeout(() => pw.print(), 1000);
                                }}>
                                    🖨️ In thẻ QR cả lớp ({sortedClassStudents.length})
                                </Button>
                            )}
                        </div>
                        <div className="hidden md:block">
                            <Table<Student>
                                columns={[
                                    ...studentColumns,
                                    { header: 'QR', accessor: (item: Student) => (
                                        <button
                                            onClick={() => {
                                                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(item.id)}&format=png`;
                                                const pw = window.open('', '_blank');
                                                if (!pw) return;
                                                pw.document.write(`<!DOCTYPE html><html><head><title>Thẻ QR - ${item.name}</title>
                                                    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;display:flex;justify-content:center;padding:20mm}
                                                    @page{size:A4;margin:10mm}
                                                    @media print{body{-webkit-print-color-adjust:exact}}</style>
                                                </head><body>
                                                    <div style="width:88mm;height:42mm;border:1px solid #ccc;border-radius:8px;padding:5px;display:inline-flex;align-items:center;gap:6px;background:white;box-sizing:border-box;">
                                                        <img src="${qrUrl}" style="width:34mm;height:34mm;flex-shrink:0;" />
                                                        <div style="flex:1;overflow:hidden;min-width:0;">
                                                            <div style="font-weight:bold;font-size:13px;">${item.name}</div>
                                                            <div style="font-size:10px;color:#666;font-family:monospace;">${item.id}</div>
                                                            <div style="font-size:9px;color:#999;margin-top:1px;">${cls.name}</div>
                                                        </div>
                                                    </div>
                                                </body></html>`);
                                                pw.document.close();
                                                setTimeout(() => pw.print(), 800);
                                            }}
                                            className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 text-xs underline whitespace-nowrap"
                                            title="In thẻ QR cho học viên này"
                                        >
                                            🖨️ In QR
                                        </button>
                                    )}
                                ]}
                                data={sortedClassStudents}
                                sortConfig={studentSortConfig}
                                onSort={handleStudentSort}
                            />
                        </div>
                         <div className="md:hidden space-y-4">
                            {sortedClassStudents.map(student => (
                                <ListItemCard
                                    key={student.id}
                                    title={<Link to={`/student/${student.id}`} className="font-semibold text-primary hover:underline">{student.name}</Link>}
                                    details={[
                                        { label: "Mã HV", value: student.id },
                                        { label: "Phụ huynh", value: student.parentName }
                                    ]}
                                    actions={
                                        <button
                                            onClick={() => {
                                                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(student.id)}&format=png`;
                                                const pw = window.open('', '_blank');
                                                if (!pw) return;
                                                pw.document.write(`<!DOCTYPE html><html><head><title>Thẻ QR - ${student.name}</title>
                                                    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;display:flex;justify-content:center;padding:20mm}
                                                    @page{size:A4;margin:10mm}
                                                    @media print{body{-webkit-print-color-adjust:exact}}</style>
                                                </head><body>
                                                    <div style="width:88mm;height:42mm;border:1px solid #ccc;border-radius:8px;padding:5px;display:inline-flex;align-items:center;gap:6px;background:white;box-sizing:border-box;">
                                                        <img src="${qrUrl}" style="width:34mm;height:34mm;flex-shrink:0;" />
                                                        <div style="flex:1;overflow:hidden;min-width:0;">
                                                            <div style="font-weight:bold;font-size:13px;">${student.name}</div>
                                                            <div style="font-size:10px;color:#666;font-family:monospace;">${student.id}</div>
                                                            <div style="font-size:9px;color:#999;margin-top:1px;">${cls.name}</div>
                                                        </div>
                                                    </div>
                                                </body></html>`);
                                                pw.document.close();
                                                setTimeout(() => pw.print(), 800);
                                            }}
                                            className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 underline"
                                        >
                                            🖨️ In QR
                                        </button>
                                    }
                                />
                            ))}
                        </div>
                    </>
                )}

                 {activeTab === 'attendance' && (
                    <AttendanceTab cls={cls} attendance={classAttendance} />
                )}

                {activeTab === 'reports' && (
                    <>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                             <h2 className="text-xl font-semibold">Sổ liên lạc - Báo cáo Tiến độ</h2>
                            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto relative group">
                                <ExportButton 
                                    data={exportReportData} 
                                    columns={exportReportColumns} 
                                    filenameBase={`BaoCaoTienDo_${cls?.name}_${new Date().toISOString().split('T')[0]}`}
                                    label="Xuất Điểm"
                                />
                                <Button 
                                    variant="secondary"
                                    onClick={() => setBulkProgModalOpen(true)}
                                    disabled={classStudents.length === 0 || (!canManageReports)}
                                    className="w-full sm:w-auto"
                                >
                                    {ICONS.plus} Nhập Điểm Hàng Loạt
                                </Button>
                                <Button 
                                    onClick={() => { setEditingReport(undefined); setReportModalOpen(true); }}
                                    disabled={classStudents.length === 0 || (!canManageReports)}
                                    className="w-full sm:w-auto"
                                >
                                    {ICONS.plus} Thêm Cá Nhân
                                </Button>
                                {classStudents.length === 0 && (
                                     <div className="hidden sm:block absolute bottom-full mb-2 w-max px-2 py-1 bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                                        Cần có học viên trong lớp để thêm báo cáo
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="hidden md:block">
                            <Table<ProgressReport>
                                columns={reportColumns}
                                data={sortedClassProgressReports}
                                sortConfig={reportSortConfig}
                                onSort={handleReportSort}
                                actions={canManageReports ? (report) => (
                                    <div className="flex justify-end gap-2">
                                        <button 
                                            onClick={() => { setEditingReport(report); setReportModalOpen(true); }}
                                            className="text-indigo-600 hover:text-indigo-900"
                                            title="Sửa báo cáo"
                                        >
                                            {ICONS.edit}
                                        </button>
                                        <button 
                                            onClick={() => setDeleteReportConfirm({ isOpen: true, report })}
                                            className="text-red-600 hover:text-red-900"
                                            title="Xóa báo cáo"
                                        >
                                            {ICONS.delete}
                                        </button>
                                    </div>
                                ) : undefined}
                            />
                        </div>
                         <div className="md:hidden space-y-4">
                            {sortedClassProgressReports.map(report => (
                                 <ListItemCard
                                    key={report.id}
                                    title={<div className="flex justify-between w-full"><span>{getStudentName(report.studentId)}</span><span className="text-primary font-bold">{report.score !== null ? `${report.score}/10` : 'N/A'}</span></div>}
                                    details={[
                                        { label: "Ngày", value: report.date },
                                        { label: "Nhận xét", value: <i className="block whitespace-normal">{report.comments}</i> },
                                    ]}
                                    actions={canManageReports ? (
                                        <div className="flex justify-end gap-3 mt-2">
                                            <Button size="sm" variant="secondary" onClick={() => { setEditingReport(report); setReportModalOpen(true); }}>Sửa</Button>
                                            <Button size="sm" variant="danger" onClick={() => setDeleteReportConfirm({ isOpen: true, report })}>Xóa</Button>
                                        </div>
                                    ) : undefined}
                                />
                            ))}
                         </div>
                    </>
                )}

                {activeTab === 'announcements' && (
                    <AnnouncementsTab classId={cls.id} />
                )}
            </div>
            
            <Modal isOpen={isReportModalOpen} onClose={() => { setReportModalOpen(false); setEditingReport(undefined); }} title={editingReport ? "Cập nhật Báo cáo Tiến độ" : "Thêm Báo cáo Tiến độ"}>
                <ProgressReportForm
                    classStudents={classStudents}
                    classId={cls.id}
                    creatorId={user.id}
                    report={editingReport}
                    onSubmit={handleSaveReport}
                    onCancel={() => { setReportModalOpen(false); setEditingReport(undefined); }}
                />
            </Modal>

            <BulkProgressModal
                isOpen={isBulkProgModalOpen}
                onClose={() => setBulkProgModalOpen(false)}
                classes={[cls]}
                students={students}
                onSave={addBulkProgressReports}
                currentUserId={user?.id || ''}
            />
            
            <ConfirmationModal
                isOpen={deleteReportConfirm.isOpen}
                onClose={() => setDeleteReportConfirm({ isOpen: false, report: null })}
                onConfirm={handleDeleteReport}
                title="Xác nhận Xóa Báo cáo"
                message={<p>Bạn có chắc chắn muốn xóa báo cáo này của học viên <strong>{deleteReportConfirm.report ? getStudentName(deleteReportConfirm.report.studentId) : ''}</strong>?</p>}
            />

            <ConfirmationModal
                isOpen={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                onConfirm={handleDelete}
                title="Xác nhận Xóa Lớp học"
                message={
                     <p>
                        Bạn có chắc chắn muốn xóa lớp học <strong>{cls?.name}</strong>?
                        <br/><br/>
                        <span className="font-bold text-red-500">CẢNH BÁO:</span> Mọi dữ liệu điểm danh và báo cáo tiến độ của lớp này cũng sẽ bị xóa.
                    </p>
                }
            />
        </div>
    );
};
