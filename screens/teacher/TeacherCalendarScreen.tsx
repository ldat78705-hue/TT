import React, { useMemo, useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useData } from '../../hooks/useDataContext';
import { Calendar } from '../../components/common/Calendar';
import { ClassSchedule, Teacher, UserRole, PersonStatus } from '../../types';
import { ROUTES, ICONS } from '../../constants';
import { Link } from 'react-router-dom';
import { getVietnamTime } from '../../utils/date';
import { printHtml } from '../../utils/html';
import { escapeHtml } from '../../utils/html';
import { Button } from '../../components/common/Button';

const dayOfWeekToNumber: Record<ClassSchedule['dayOfWeek'], number> = {
    'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
    'Thursday': 4, 'Friday': 5, 'Saturday': 6,
};

const dayOfWeekLabels: Record<ClassSchedule['dayOfWeek'], string> = {
    'Monday': 'Thứ 2', 'Tuesday': 'Thứ 3', 'Wednesday': 'Thứ 4',
    'Thursday': 'Thứ 5', 'Friday': 'Thứ 6', 'Saturday': 'Thứ 7', 'Sunday': 'CN',
};

const weekDayOrder: ClassSchedule['dayOfWeek'][] = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/** Get Monday of the week containing the given date */
const getMonday = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d;
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

    // ======== WEEKLY SCHEDULE PRINT ========
    const handlePrintWeekly = useCallback(() => {
        const monday = getMonday(normalizedSelectedDate);
        const weekDates: Date[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            weekDates.push(d);
        }

        const showAllTeachers = isAdmin && selectedTeacherId === 'all';

        // Build schedule data per day
        type SessionInfo = {
            className: string;
            subject: string;
            startTime: string;
            endTime: string;
            teacherNames: string;
            studentCount: number;
        };

        const weekData: Map<string, SessionInfo[]> = new Map();
        weekDayOrder.forEach(day => weekData.set(day, []));

        myClasses.forEach(cls => {
            const activeCount = (cls.studentIds || []).filter(sid => {
                const st = state.students.find(s => s.id === sid);
                return st && st.status === 'ACTIVE';
            }).length;

            const tNames = (cls.teacherIds || [])
                .map(tid => state.teachers.find(t => t.id === tid)?.name)
                .filter(Boolean)
                .join(', ');

            (cls.schedule || []).forEach((sched: ClassSchedule) => {
                const list = weekData.get(sched.dayOfWeek);
                if (list) {
                    list.push({
                        className: cls.name,
                        subject: cls.subject,
                        startTime: sched.startTime,
                        endTime: sched.endTime,
                        teacherNames: tNames,
                        studentCount: activeCount,
                    });
                }
            });
        });

        // Sort each day by startTime
        weekData.forEach(sessions => sessions.sort((a, b) => a.startTime.localeCompare(b.startTime)));

        // Find max sessions in a day for grid height
        const maxSessions = Math.max(...Array.from(weekData.values()).map(s => s.length), 1);

        // Color palette for sessions
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

        // Build HTML grid
        const weekFromStr = formatDateString(weekDates[0]);
        const weekToStr = formatDateString(weekDates[6]);
        const titleText = showAllTeachers
            ? 'LỊCH DẠY TUẦN — TẤT CẢ GIÁO VIÊN'
            : `LỊCH DẠY TUẦN — ${(displayName || '').toUpperCase()}`;

        const headerRow = weekDayOrder.map((day, i) => {
            const dateStr = formatDateString(weekDates[i]);
            const dayLabel = dayOfWeekLabels[day];
            return `<th style="border:1px solid #d1d5db;padding:8px 4px;text-align:center;background:#f1f5f9;font-size:12px;width:${100/7}%;vertical-align:top">
                <div style="font-weight:700;color:#1e293b">${escapeHtml(dayLabel)}</div>
                <div style="font-size:10px;color:#64748b;margin-top:2px">${escapeHtml(dateStr.slice(5))}</div>
            </th>`;
        }).join('');

        // Build cell for each day
        const bodyCells = weekDayOrder.map((day) => {
            const sessions = weekData.get(day) || [];
            if (sessions.length === 0) {
                return `<td style="border:1px solid #e5e7eb;padding:6px;vertical-align:top;text-align:center;color:#94a3b8;font-size:11px;height:${maxSessions * 58}px">—</td>`;
            }
            const sessionHtml = sessions.map((s, si) => {
                const bgColor = colors[si % colors.length];
                const teacherLine = showAllTeachers && s.teacherNames
                    ? `<div style="font-size:10px;color:#475569;margin-top:1px">👨‍🏫 ${escapeHtml(s.teacherNames)}</div>`
                    : '';
                return `<div style="background:${bgColor}12;border-left:3px solid ${bgColor};border-radius:4px;padding:4px 6px;margin-bottom:4px">
                    <div style="font-weight:600;font-size:11px;color:#1e293b">${escapeHtml(s.className)}</div>
                    <div style="font-size:10px;color:#475569">⏰ ${escapeHtml(s.startTime)}-${escapeHtml(s.endTime)} · 👥${s.studentCount}</div>
                    ${teacherLine}
                </div>`;
            }).join('');
            return `<td style="border:1px solid #e5e7eb;padding:4px;vertical-align:top">${sessionHtml}</td>`;
        }).join('');

        const summaryHtml = `<div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:12px;padding:10px;background:#f0f9ff;border-radius:6px;border:1px solid #bae6fd">
            <div style="font-size:12px"><span style="color:#6b7280">Tổng số lớp:</span> <b style="color:#1e40af">${myClasses.length}</b></div>
            <div style="font-size:12px"><span style="color:#6b7280">Tổng buổi/tuần:</span> <b style="color:#1e40af">${totalWeekSessions}</b></div>
            ${showAllTeachers ? `<div style="font-size:12px"><span style="color:#6b7280">Số GV:</span> <b style="color:#1e40af">${activeTeachers.length}</b></div>` : ''}
        </div>`;

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${escapeHtml(titleText)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 10mm 12mm; color: #111; }
        @page { size: A4 landscape; margin: 10mm 12mm; }
        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        table { border-collapse: collapse; width: 100%; }
    </style>
</head>
<body>
    <div style="text-align:center;margin-bottom:4px">
        <h2 style="font-size:16px;color:#1e293b;margin:0">${escapeHtml(state.settings.name)}</h2>
    </div>
    <div style="text-align:center;margin-bottom:6px">
        <h3 style="font-size:14px;color:#334155;margin:0;letter-spacing:0.05em">${escapeHtml(titleText)}</h3>
    </div>
    <div style="text-align:center;font-size:12px;color:#6b7280;margin-bottom:12px">
        Tuần: <b>${escapeHtml(weekFromStr)}</b> đến <b>${escapeHtml(weekToStr)}</b>
    </div>
    ${summaryHtml}
    <table>
        <thead><tr>${headerRow}</tr></thead>
        <tbody><tr>${bodyCells}</tr></tbody>
    </table>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:11px;color:#9ca3af">
        <span>Lịch dạy theo lịch cố định hàng tuần</span>
        <span>Ngày in: ${new Date().toLocaleDateString('vi-VN')}</span>
    </div>
</body>
</html>`;

        printHtml(html);
    }, [normalizedSelectedDate, myClasses, state.students, state.teachers, state.settings.name, isAdmin, selectedTeacherId, displayName, totalWeekSessions, activeTeachers]);

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
                    <div className="flex gap-3 items-center">
                        <Button onClick={handlePrintWeekly} variant="secondary" className="text-xs !py-1.5 !px-3">
                            {ICONS.print} Xuất tuần
                        </Button>
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
