import React, { useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useData } from '../../hooks/useDataContext';
import { Calendar } from '../../components/common/Calendar';
import { ClassSchedule, Teacher, UserRole, PersonStatus } from '../../types';
import { ROUTES, ICONS } from '../../constants';
import { Link } from 'react-router-dom';
import { getVietnamTime } from '../../utils/date';

const dayOfWeekToNumber: Record<ClassSchedule['dayOfWeek'], number> = {
    'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
    'Thursday': 4, 'Friday': 5, 'Saturday': 6,
};

const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const TeacherCalendarScreen: React.FC = () => {
    const { user, role } = useAuth();
    const { state } = useData();
    const [displayMonth, setDisplayMonth] = useState(() => new Date(getVietnamTime()));
    const [selectedDate, setSelectedDate] = useState(() => new Date(getVietnamTime()));

    // Admin/Manager can view all teachers' schedules
    const isAdmin = role === UserRole.ADMIN || role === UserRole.MANAGER;

    // Active teachers list for admin dropdown
    const activeTeachers = useMemo(() => {
        return state.teachers.filter(t => t.status === PersonStatus.ACTIVE);
    }, [state.teachers]);

    // For teacher role: use own ID. For admin: default to 'all', allow selection
    const ownTeacherId = (user as Teacher)?.id || '';
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>(isAdmin ? 'all' : ownTeacherId);

    // Determine which teacher IDs to show schedule for
    const targetTeacherIds = useMemo(() => {
        if (!isAdmin) return [ownTeacherId];
        if (selectedTeacherId === 'all') return activeTeachers.map(t => t.id);
        return [selectedTeacherId];
    }, [isAdmin, ownTeacherId, selectedTeacherId, activeTeachers]);

    // Display name
    const displayName = useMemo(() => {
        if (!isAdmin) {
            return state.teachers.find(t => t.id === ownTeacherId)?.name || (user as any)?.name || '';
        }
        if (selectedTeacherId === 'all') return `Tất cả giáo viên (${activeTeachers.length})`;
        return activeTeachers.find(t => t.id === selectedTeacherId)?.name || '';
    }, [isAdmin, ownTeacherId, selectedTeacherId, activeTeachers, state.teachers, user]);

    // Filter classes for target teachers
    const myClasses = useMemo(() => {
        const idSet = new Set(targetTeacherIds);
        return state.classes.filter(c => (c.teacherIds || []).some(tid => idSet.has(tid)));
    }, [state.classes, targetTeacherIds]);

    // Stats
    const totalWeekSessions = useMemo(() => {
        return myClasses.reduce((sum, cls) =>
            sum + (cls.schedule || []).length, 0);
    }, [myClasses]);

    // Normalized selected date
    const normalizedSelectedDate = useMemo(() => {
        const d = new Date(selectedDate);
        d.setHours(0, 0, 0, 0);
        return d;
    }, [selectedDate]);

    // Events for selected day — classes scheduled on that day of week
    const eventsForSelectedDay = useMemo(() => {
        const dayOfWeek = normalizedSelectedDate.getDay();
        const dateString = formatDateString(normalizedSelectedDate);
        const today = new Date(getVietnamTime());
        today.setHours(0, 0, 0, 0);

        const events: {
            classId: string;
            className: string;
            subject: string;
            startTime: string;
            endTime: string;
            studentCount: number;
            link: string;
            isAttended: boolean;
            isPast: boolean;
            teacherNames: string;
        }[] = [];

        // Check attendance records for this date
        const attendanceByClass = new Map<string, boolean>();
        state.attendance.forEach(record => {
            if (record.date === dateString && record.status !== 'UNMARKED') {
                attendanceByClass.set(record.classId, true);
            }
        });

        myClasses.forEach(cls => {
            (cls.schedule || []).forEach((sched: ClassSchedule) => {
                if (dayOfWeekToNumber[sched.dayOfWeek] === dayOfWeek) {
                    const activeCount = (cls.studentIds || []).filter(sid => {
                        const st = state.students.find(s => s.id === sid);
                        return st && st.status === 'ACTIVE';
                    }).length;

                    // Get teacher names for this class
                    const tNames = (cls.teacherIds || [])
                        .map(tid => state.teachers.find(t => t.id === tid)?.name)
                        .filter(Boolean)
                        .join(', ');

                    events.push({
                        classId: cls.id,
                        className: cls.name,
                        subject: cls.subject,
                        startTime: sched.startTime,
                        endTime: sched.endTime,
                        studentCount: activeCount,
                        link: ROUTES.ATTENDANCE_DETAIL.replace(':classId', cls.id).replace(':date', dateString),
                        isAttended: attendanceByClass.has(cls.id),
                        isPast: normalizedSelectedDate < today,
                        teacherNames: tNames,
                    });
                }
            });
        });

        events.sort((a, b) => a.startTime.localeCompare(b.startTime));
        return events;
    }, [myClasses, normalizedSelectedDate, state.attendance, state.students, state.teachers]);

    return (
        <div className="flex flex-col h-full text-gray-800 dark:text-white">
            {/* Stats Header */}
            <div className="flex-shrink-0 px-4 md:px-6 pt-2 pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex-1 min-w-0">
                        {isAdmin ? (
                            <div className="flex items-center gap-2 flex-wrap">
                                <label className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Giáo viên:</label>
                                <select
                                    value={selectedTeacherId}
                                    onChange={e => setSelectedTeacherId(e.target.value)}
                                    className="form-select text-sm py-1.5 min-w-[180px]"
                                >
                                    <option value="all">📋 Tất cả ({activeTeachers.length} GV)</option>
                                    {activeTeachers.map(t => (
                                        <option key={t.id} value={t.id}>👤 {t.name}{t.subject ? ` (${t.subject})` : ''}</option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">Xin chào, <span className="font-semibold text-gray-700 dark:text-gray-200">{displayName}</span></p>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl px-3 py-1.5 text-center">
                            <p className="text-lg font-extrabold text-blue-600 dark:text-blue-400">{myClasses.length}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">Lớp</p>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-3 py-1.5 text-center">
                            <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{totalWeekSessions}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">Buổi/tuần</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Calendar — same as AttendanceHubScreen */}
            <div className="p-4 md:p-6 flex-shrink-0">
                <div className="card-base p-0 md:p-2">
                    <Calendar
                        displayDate={displayMonth}
                        onMonthChange={setDisplayMonth}
                        selectedDate={selectedDate}
                        onDateSelect={setSelectedDate}
                    />
                </div>
            </div>

            {/* Bottom Schedule List — same layout as AttendanceHub */}
            <div className="flex-grow bg-white dark:bg-slate-700 rounded-t-2xl shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto pt-4">
                    <div className="px-4 pb-24 md:pb-6">
                        <h2 className="text-lg font-bold mb-4">
                            Lịch dạy ngày {formatDateString(normalizedSelectedDate)}
                            {isAdmin && selectedTeacherId === 'all' && eventsForSelectedDay.length > 0 && (
                                <span className="text-sm font-normal text-gray-500 ml-2">({eventsForSelectedDay.length} buổi)</span>
                            )}
                        </h2>

                        {eventsForSelectedDay.length > 0 ? (
                            <div className="space-y-3 pt-2">
                                {eventsForSelectedDay.map((event, idx) => {
                                    let color = '#9ca3af'; // gray - scheduled
                                    let statusText = 'Lịch dạy';
                                    if (event.isAttended) {
                                        color = '#10b981'; // green
                                        statusText = 'Đã điểm danh';
                                    } else if (event.isPast) {
                                        color = '#ef4444'; // red
                                        statusText = 'Chưa điểm danh';
                                    }

                                    return (
                                        <Link
                                            to={event.link}
                                            state={{ returnTo: ROUTES.TEACHER_CALENDAR }}
                                            key={`${event.classId}-${idx}`}
                                            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-600/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-500/50 transition-colors group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-1.5 h-12 rounded-full shrink-0" style={{ backgroundColor: color }}></div>
                                                <div>
                                                    <h3 className="font-bold text-base text-gray-900 dark:text-white">{event.className}</h3>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                                                        {statusText} • {event.startTime} - {event.endTime} • 👥 {event.studentCount}
                                                    </p>
                                                    {/* Show teacher name when viewing all teachers */}
                                                    {isAdmin && selectedTeacherId === 'all' && event.teacherNames && (
                                                        <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">
                                                            👨‍🏫 {event.teacherNames}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-gray-400 group-hover:text-primary transition-colors">
                                                {ICONS.chevronRight}
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center text-center py-8">
                                <div>
                                    <p className="text-3xl mb-2">🎉</p>
                                    <p className="text-gray-500">Không có buổi dạy nào</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
