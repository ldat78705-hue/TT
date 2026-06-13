
import React, { useMemo, useState } from 'react';
import { Card } from '../components/common/Card';
import { ICONS, ROUTES } from '../constants';
import { useData } from '../hooks/useDataContext';
import { useAuth } from '../hooks/useAuth';
import { PersonStatus, UserRole, Teacher, Announcement, Class, Student, AttendanceRecord, AttendanceStatus, TransactionType } from '../types';
import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { getVietnamTime } from '../utils/date';

const toLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const TodaysScheduleWidget: React.FC<{ classes: Class[], teachers: Teacher[] }> = ({ classes, teachers }) => {
    // Get current Vietnam time to ensure accurate schedule display regardless of user's local timezone
    const vnTimeStr = getVietnamTime();
    const todayDateString = vnTimeStr.split('T')[0];
    const vnDateObj = new Date(vnTimeStr);
    const dayOfWeekEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][vnDateObj.getDay()];

    const sessionsToday = useMemo(() => {
        const sessions: (Class & { singleSchedule: Class['schedule'][0] })[] = [];
        classes.forEach(cls => {
            (cls.schedule || []).forEach(s => {
                if (s.dayOfWeek === dayOfWeekEn) {
                    sessions.push({ ...cls, singleSchedule: s });
                }
            });
        });
        return sessions.sort((a, b) => a.singleSchedule.startTime.localeCompare(b.singleSchedule.startTime));
    }, [classes, dayOfWeekEn]);

    const getTeacherNames = (teacherIds: string[]) => {
        if (!teacherIds || teacherIds.length === 0) return 'N/A';
        return teacherIds.map(id => teachers.find(t => t.id === id)?.name || 'N/A').join(', ');
    };

    return (
        <div className="card-base h-full">
            <h2 className="text-xl font-bold mb-4">Lịch học Hôm nay</h2>
            <div className="space-y-3 max-h-[40rem] overflow-y-auto">
                {sessionsToday.length > 0 ? (
                    sessionsToday.map(session => (
                        <div key={`${session.id}-${session.singleSchedule.startTime}`} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <div>
                                <Link to={`/class/${session.id}`} className="font-semibold text-primary hover:underline">{session.name}</Link>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {session.singleSchedule.startTime} - {session.singleSchedule.endTime} • GV: {getTeacherNames(session.teacherIds)}
                                </p>
                            </div>
                            <Link to={ROUTES.ATTENDANCE_DETAIL.replace(':classId', session.id).replace(':date', todayDateString)} state={{ returnTo: ROUTES.DASHBOARD }} className="w-full sm:w-auto">
                                <Button variant="secondary" className="w-full">Điểm danh</Button>
                            </Link>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-10">
                        <p className="text-gray-500 dark:text-gray-400">Không có lớp học nào diễn ra hôm nay.</p>
                    </div>
                )}
            </div>
        </div>
    );
};


const AlertsAndAnnouncementsWidget: React.FC<{
    students: Student[];
    attendance: AttendanceRecord[];
    announcements: Announcement[];
}> = ({ students, attendance, announcements }) => {
    const [activeTab, setActiveTab] = useState<'alerts' | 'announcements'>('alerts');

    const highDebtStudents = useMemo(() => students.filter(s => s.balance < 0).sort((a, b) => a.balance - b.balance).slice(0, 5), [students]);

    const highAbsenceStudents = useMemo(() => {
        const thirtyDaysAgo = new Date(getVietnamTime());
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = toLocalDateString(thirtyDaysAgo);
        const absenceCounts = new Map<string, number>();
        const activeStudentIds = new Set(students.filter(s => s.status === PersonStatus.ACTIVE).map(s => s.id));

        attendance.forEach(record => {
            if (activeStudentIds.has(record.studentId) && (record.status === AttendanceStatus.ABSENT || record.status === AttendanceStatus.UNEXCUSED_ABSENT) && record.date >= thirtyDaysAgoStr) {
                absenceCounts.set(record.studentId, (absenceCounts.get(record.studentId) || 0) + 1);
            }
        });
        
        const studentMap = new Map(students.map(s => [s.id, s.name]));

        return Array.from(absenceCounts.entries())
            .map(([studentId, count]) => ({ studentId, studentName: studentMap.get(studentId), count }))
            .filter(item => item.studentName && item.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }, [students, attendance]);

    const highLateArrivalsStudents = useMemo(() => {
        const thirtyDaysAgo = new Date(getVietnamTime());
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = toLocalDateString(thirtyDaysAgo);
        const lateCounts = new Map<string, number>();
        const activeStudentIds = new Set(students.filter(s => s.status === PersonStatus.ACTIVE).map(s => s.id));

        attendance.forEach(record => {
            if (activeStudentIds.has(record.studentId) && record.status === AttendanceStatus.LATE && record.date >= thirtyDaysAgoStr) {
                lateCounts.set(record.studentId, (lateCounts.get(record.studentId) || 0) + 1);
            }
        });
        
        const studentMap = new Map(students.map(s => [s.id, s.name]));

        return Array.from(lateCounts.entries())
            .map(([studentId, count]) => ({ studentId, studentName: studentMap.get(studentId), count }))
            .filter(item => item.studentName && item.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }, [students, attendance]);


    const TabButton: React.FC<{ tab: 'alerts' | 'announcements', label: string }> = ({ tab, label }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === tab 
                ? 'border-primary text-primary' 
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
        >
            {label}
        </button>
    );

    const AlertItem: React.FC<{ linkTo: string; linkState?: object; title: string; items: { id: string; name: string | undefined; value: React.ReactNode }[]; emptyText: string }> = ({ linkTo, linkState, title, items, emptyText }) => (
        <div>
            <Link to={linkTo} state={linkState}>
                <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-2 hover:text-primary transition-colors">{title}</h3>
            </Link>
            {items.length > 0 ? (
                <ul className="space-y-2 text-sm">
                    {items.map(item => (
                        <li key={item.id} className="flex justify-between items-center p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <span>{item.name}</span>
                            <span className="font-semibold">{item.value}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-gray-500 px-2">{emptyText}</p>
            )}
        </div>
    );

    return (
        <div className="card-base h-full flex flex-col">
            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4 flex-shrink-0">
                <TabButton tab="alerts" label="Cảnh báo" />
                <TabButton tab="announcements" label="Thông báo" />
            </div>
            
            <div className="flex-grow overflow-y-auto">
                {activeTab === 'alerts' && (
                    <div className="space-y-6">
                       <AlertItem 
                            linkTo="/finance" 
                            linkState={{ defaultTab: 'debt_report' }}
                            title="Học viên nợ nhiều"
                            items={highDebtStudents.map(s => ({ id: s.id, name: s.name, value: <span className="text-red-500">{Math.abs(s.balance).toLocaleString('vi-VN')} ₫</span> }))}
                            emptyText="Không có học viên nào có công nợ."
                       />
                       <AlertItem 
                            linkTo="/reports" 
                            linkState={{ defaultReport: 'attendance' }}
                            title="Học viên vắng nhiều (30 ngày qua)"
                            items={highAbsenceStudents.map(s => ({ id: s.studentId, name: s.studentName, value: <span className="text-yellow-600">{s.count} buổi</span> }))}
                            emptyText="Không có học viên nào vắng trong 30 ngày qua."
                       />
                       <AlertItem 
                            linkTo="/reports" 
                            linkState={{ defaultReport: 'attendance' }}
                            title="Học viên đi muộn (30 ngày qua)"
                            items={highLateArrivalsStudents.map(s => ({ id: s.studentId, name: s.studentName, value: <span className="text-orange-600">{s.count} buổi</span> }))}
                            emptyText="Không có học viên nào đi muộn trong 30 ngày qua."
                       />
                    </div>
                )}

                {activeTab === 'announcements' && (
                     <div className="space-y-4">
                        {announcements.length > 0 ? (
                            announcements.slice(0, 5).map(ann => (
                                <div key={ann.id} className="p-3 bg-indigo-50 dark:bg-slate-700/50 rounded-lg">
                                    <h3 className="font-semibold text-indigo-800 dark:text-indigo-300">{ann.title}</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{ann.content.substring(0, 100)}...</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 text-right mt-2">{ann.createdAt} - {ann.createdBy}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400">Chưa có thông báo nào.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};


const AdminDashboard: React.FC = () => {
    const { state } = useData();
    const { role } = useAuth();
    const { students, classes, announcements, income, teachers, attendance, transactions } = state;

    const totalStudents = students.filter(s => s.status === PersonStatus.ACTIVE).length;
    const activeClasses = classes.length;
    
    const canViewFinancials = role === UserRole.ADMIN || role === UserRole.MANAGER || role === UserRole.ACCOUNTANT;

    const monthlyRevenue = useMemo(() => {
        if (!canViewFinancials) return 0;
        
        const today = new Date(getVietnamTime());
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        const monthStr = `${year}-${String(month).padStart(2, '0')}`;

        const tuitionCollected = (transactions || [])
            .filter(t => {
                const isPayment = t.type === TransactionType.PAYMENT || t.type === TransactionType.ADJUSTMENT_CREDIT;
                const isWithinMonth = t.date.startsWith(monthStr);
                const isNotRefund = !t.description.toLowerCase().includes('hủy hóa đơn');
                return isPayment && isWithinMonth && isNotRefund && t.amount > 0;
            })
            .reduce((sum, t) => sum + t.amount, 0);
            
        const otherIncomeThisMonth = (income || [])
            .filter(i => i.date.startsWith(monthStr))
            .reduce((sum, i) => sum + i.amount, 0);

        return tuitionCollected + otherIncomeThisMonth;
    }, [transactions, income, canViewFinancials]);
    
    const totalReceivables = useMemo(() => {
        if (!canViewFinancials) return 0;
        return students
            .filter(s => s.balance < 0)
            .reduce((sum, s) => sum + s.balance, 0);
    }, [students, canViewFinancials]);


    const WeeklyCalendarWidget: React.FC<{ classes: Class[], teachers: Teacher[] }> = ({ classes, teachers }) => {
        const vnTimeStr = getVietnamTime();
        const vnDateObj = new Date(vnTimeStr);
        const todayDayIdx = vnDateObj.getDay(); // 0=Sun

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
        const dayLabels: Record<string, string> = {
            'Monday': 'Thứ 2', 'Tuesday': 'Thứ 3', 'Wednesday': 'Thứ 4', 'Thursday': 'Thứ 5',
            'Friday': 'Thứ 6', 'Saturday': 'Thứ 7', 'Sunday': 'CN'
        };
        const dayToNum: Record<string, number> = {
            'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6
        };

        const colors = ['bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700',
                        'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700',
                        'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-700',
                        'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-700',
                        'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-200 border-pink-300 dark:border-pink-700',
                        'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'];

        const classColorMap = useMemo(() => {
            const map = new Map<string, string>();
            classes.forEach((cls, i) => map.set(cls.id, colors[i % colors.length]));
            return map;
        }, [classes]);

        const weekData = useMemo(() => {
            return days.map(day => {
                const sessions: { cls: Class, schedule: Class['schedule'][0] }[] = [];
                classes.forEach(cls => {
                    (cls.schedule || []).forEach(s => {
                        if (s.dayOfWeek === day) sessions.push({ cls, schedule: s });
                    });
                });
                return {
                    day,
                    label: dayLabels[day],
                    isToday: dayToNum[day] === todayDayIdx,
                    sessions: sessions.sort((a, b) => a.schedule.startTime.localeCompare(b.schedule.startTime))
                };
            });
        }, [classes, todayDayIdx]);

        const getTeacherName = (ids: string[]) => {
            if (!ids || ids.length === 0) return '';
            return ids.map(id => teachers.find(t => t.id === id)?.name?.split(' ').pop() || '').join(', ');
        };

        return (
            <div className="card-base">
                <h2 className="text-xl font-bold mb-4">📅 Lịch học Tuần</h2>
                <div className="grid grid-cols-7 gap-1.5">
                    {weekData.map(d => (
                        <div key={d.day} className="min-w-0">
                            <div className={`text-center text-xs font-bold py-1.5 rounded-t-lg ${d.isToday ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                {d.label}
                            </div>
                            <div className="min-h-[120px] bg-slate-50 dark:bg-slate-800/50 rounded-b-lg p-1 space-y-1">
                                {d.sessions.length > 0 ? d.sessions.map((s, i) => (
                                    <Link key={i} to={`/class/${s.cls.id}`}
                                        className={`block p-1.5 rounded-md border text-[10px] leading-tight hover:opacity-80 transition-opacity ${classColorMap.get(s.cls.id) || colors[0]}`}>
                                        <div className="font-bold truncate">{s.cls.name}</div>
                                        <div className="opacity-70">{s.schedule.startTime}-{s.schedule.endTime}</div>
                                        <div className="opacity-60 truncate">{getTeacherName(s.cls.teacherIds)}</div>
                                    </Link>
                                )) : (
                                    <div className="flex items-center justify-center h-full text-[10px] text-gray-400">—</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card title="Học viên đang học" value={totalStudents} icon={ICONS.students} color="text-blue-600 dark:text-blue-400" />
                <Card title="Lớp học hoạt động" value={activeClasses} icon={ICONS.classes} color="text-green-600 dark:text-green-400" />
                {canViewFinancials && (
                    <>
                        <Card title="Doanh thu tháng này" value={`${monthlyRevenue.toLocaleString('vi-VN')} ₫`} icon={ICONS.finance} color="text-yellow-600 dark:text-yellow-400" />
                        <Card title="Tổng nợ phải thu" value={`${Math.abs(totalReceivables).toLocaleString('vi-VN')} ₫`} icon={ICONS.dashboard} color="text-red-600 dark:text-red-400" />
                    </>
                )}
            </div>

            {/* Weekly Calendar */}
            <WeeklyCalendarWidget classes={classes} teachers={teachers} />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-1">
                     <TodaysScheduleWidget classes={classes} teachers={teachers} />
                </div>
                <div className="lg:col-span-1">
                    <AlertsAndAnnouncementsWidget 
                        students={students} 
                        attendance={attendance} 
                        announcements={announcements} 
                    />
                </div>
            </div>
        </div>
    );
};

const TeacherDashboard: React.FC = () => {
    const { state } = useData();
    const { user } = useAuth();
    const { classes, announcements, students } = state;
    
    // Get current Vietnam time
    const vnTimeStr = getVietnamTime();
    const todayDateString = vnTimeStr.split('T')[0];
    const vnDateObj = new Date(vnTimeStr);
    const dayOfWeekEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][vnDateObj.getDay()];

    const dayMap: Record<string, string> = {
        'Monday': 'T2', 'Tuesday': 'T3', 'Wednesday': 'T4', 'Thursday': 'T5',
        'Friday': 'T6', 'Saturday': 'T7', 'Sunday': 'CN'
    };

    const getActiveStudentCount = (studentIds: string[] | undefined) => {
        if (!studentIds) return 0;
        return studentIds.filter(id => {
            const student = students.find(s => s.id === id);
            return student && student.status === PersonStatus.ACTIVE;
        }).length;
    };

    const assignedClasses = useMemo(() => {
        const teacherId = (user as Teacher)?.id;
        if (!teacherId) return [];
        return classes.filter(cls => (cls.teacherIds || []).includes(teacherId))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [classes, user]);
    
    const relevantAnnouncements = useMemo(() => {
        const teacherId = (user as Teacher)?.id;
        const now = new Date(getVietnamTime());
        
        // Filter out future scheduled announcements
        const visibleAnnouncements = announcements.filter(a => {
            if (!a.scheduledFor) return true;
            return new Date(a.scheduledFor) <= now;
        });

        if (!teacherId) {
            // For Admin/Manager, show ALL announcements, or those targeted to them
            return visibleAnnouncements
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }

        const teacherClassIds = new Set(
            classes.filter(cls => (cls.teacherIds || []).includes(teacherId)).map(c => c.id)
        );

        return visibleAnnouncements
            .filter(ann => {
                // Show if targeted to ALL or TEACHERS
                if (!ann.targetAudience || ann.targetAudience === 'ALL' || ann.targetAudience === 'TEACHERS') return true;
                
                // Show if targeted to a CLASS the teacher teaches
                if ((ann.targetAudience === 'CLASS' || ann.targetAudience === 'SPECIFIC_STUDENTS') && ann.classId) {
                    return teacherClassIds.has(ann.classId);
                }
                
                return false;
            })
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [classes, user, announcements]);


    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <h1 className="text-2xl font-bold">Lớp học của tôi</h1>
                {assignedClasses.length > 0 ? (
                    <div className="space-y-4">
                        {assignedClasses.map(cls => {
                            const hasSessionToday = (cls.schedule || []).some(s => s.dayOfWeek === dayOfWeekEn);
                            return (
                                <div key={cls.id} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex-grow">
                                        <Link to={`/class/${cls.id}`} className="font-bold text-lg text-primary hover:underline">{cls.name}</Link>
                                        <p className="text-sm text-gray-600 dark:text-gray-300">{cls.subject} • Sĩ số: {getActiveStudentCount(cls.studentIds)}</p>
                                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-3 gap-y-1">
                                            {(cls.schedule || []).map((s, i) => (
                                                <span key={i}>{`${dayMap[s.dayOfWeek]}: ${s.startTime}-${s.endTime}`}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0 w-full sm:w-auto">
                                        <Link 
                                          to={hasSessionToday ? ROUTES.ATTENDANCE_DETAIL.replace(':classId', cls.id).replace(':date', todayDateString) : `/class/${cls.id}`}
                                          state={{ defaultTab: 'attendance', returnTo: ROUTES.DASHBOARD }} 
                                          className="w-full"
                                        >
                                             <Button variant="secondary" className="w-full">
                                                {hasSessionToday ? 'Điểm danh hôm nay' : 'Xem điểm danh'}
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="card-base text-center py-10">
                        <p className="text-gray-500 dark:text-gray-400">Bạn chưa được phân công vào lớp học nào.</p>
                    </div>
                )}
            </div>
            <div className="lg:col-span-1">
                <div className="card-base h-full">
                    <h2 className="text-xl font-bold mb-4">Thông báo</h2>
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                        {relevantAnnouncements.length > 0 ? (
                            relevantAnnouncements.slice(0, 5).map(ann => (
                                <div key={ann.id} className="p-3 bg-indigo-50 dark:bg-slate-700/50 rounded-lg">
                                    <h3 className="font-semibold text-indigo-800 dark:text-indigo-300">{ann.title}</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{ann.content.substring(0, 100)}...</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 text-right mt-2">{ann.createdAt} - {ann.createdBy}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400">Chưa có thông báo nào.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export const DashboardScreen: React.FC = () => {
    const { role } = useAuth();
    
    if (role === UserRole.TEACHER) {
        return <TeacherDashboard />;
    }
    
    // Admin, Manager, Accountant all see the main dashboard, but with different cards
    return <AdminDashboard />;
};
