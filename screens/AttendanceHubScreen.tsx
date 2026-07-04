

import React, { useMemo, useState } from 'react';
import { useData } from '../hooks/useDataContext';
import { Calendar } from '../components/common/Calendar';
import { ClassSchedule, Class as ClassModel, ClassStatus } from '../types';
import { ROUTES, ICONS } from '../constants';
import { Link } from 'react-router-dom';
import { AbsentStudentsModal } from '../components/attendance/AbsentStudentsModal';
import { QRAttendanceModal } from '../components/attendance/QRAttendanceModal';
import { Button } from '../components/common/Button';
import { useAuth } from '../hooks/useAuth';
import { UserRole, Teacher } from '../types';

const dayOfWeekToNumber: Record<ClassSchedule['dayOfWeek'], number> = {
    'Sunday': 0,
    'Monday': 1,
    'Tuesday': 2,
    'Wednesday': 3,
    'Thursday': 4,
    'Friday': 5,
    'Saturday': 6,
};

interface CalendarEvent {
    date: Date;
    title: string;
    link: string;
    color: string;
    linkState?: object;
    statusText: string;
    startTime: string;
    endTime: string;
}

const formatDateString = (date: Date): string => {
  // Timezone-safe date formatting
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

import { getVietnamTime } from '../utils/date';

export const AttendanceHubScreen: React.FC = () => {
    const { state } = useData();
    const { user, role } = useAuth();
    const [displayMonth, setDisplayMonth] = useState(() => new Date(getVietnamTime()));
    const [selectedDate, setSelectedDate] = useState(() => new Date(getVietnamTime()));
    const [showAbsentModal, setShowAbsentModal] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);

    // Filter classes for teacher role, and always exclude ARCHIVED classes
    const relevantClasses = useMemo(() => {
        let filtered = state.classes.filter(cls => (cls.classStatus || ClassStatus.ACTIVE) !== ClassStatus.ARCHIVED);
        if (role === UserRole.TEACHER) {
            const teacherId = (user as Teacher)?.id;
            if (!teacherId) return [];
            filtered = filtered.filter(cls => (cls.teacherIds || []).includes(teacherId));
        }
        return filtered;
    }, [state.classes, user, role]);

    const normalizedSelectedDate = useMemo(() => {
        const d = new Date(selectedDate);
        d.setHours(0,0,0,0);
        return d;
    }, [selectedDate]);

    const monthlyCalendarEvents = useMemo(() => {
        const eventsMap = new Map<string, CalendarEvent>();
        const today = new Date(getVietnamTime());
        today.setHours(0, 0, 0, 0);

        const selectedYear = displayMonth.getFullYear();
        const selectedMonth = displayMonth.getMonth();
        const startOfMonth = new Date(selectedYear, selectedMonth, 1);
        const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0);

        // 1. Process actual attendance records first (source of truth)
        const attendanceByClassDate = new Map<string, typeof state.attendance>();
        state.attendance.forEach(record => {
            const key = `${record.classId}|${record.date}`;
            if (!attendanceByClassDate.has(key)) {
                attendanceByClassDate.set(key, []);
            }
            attendanceByClassDate.get(key)!.push(record);
        });

        attendanceByClassDate.forEach((records, key) => {
            const [classId, dateStr] = key.split('|');
            const recordDate = new Date(dateStr + 'T00:00:00'); // Ensure local timezone
            if (recordDate >= startOfMonth && recordDate <= endOfMonth) {
                const cls = relevantClasses.find(c => c.id === classId);
                if (cls) {
                    const scheduleForDay = cls.schedule.find(s => dayOfWeekToNumber[s.dayOfWeek] === recordDate.getDay());
                    
                    const hasMarkedRecords = records.some(r => r.status !== 'UNMARKED');
                    const hasNotes = records.some(r => r.note && r.note.trim() !== '');

                    let statusText = 'Đã điểm danh';
                    let color = '#10b981'; // Green

                    if (!hasMarkedRecords && hasNotes) {
                        statusText = 'Đã ghi chú';
                        color = '#eab308'; // Yellow
                    }

                    eventsMap.set(key, {
                        date: recordDate,
                        title: cls.name,
                        link: ROUTES.ATTENDANCE_DETAIL.replace(':classId', cls.id).replace(':date', dateStr),
                        color,
                        linkState: { returnTo: ROUTES.ATTENDANCE_HUB },
                        statusText,
                        startTime: scheduleForDay?.startTime || 'N/A',
                        endTime: scheduleForDay?.endTime || 'N/A',
                    });
                }
            }
        });

        // 2. Fill in the projected schedule for unmarked days
        const loopDate = new Date(startOfMonth);
        while (loopDate <= endOfMonth) {
            const currentDate = new Date(loopDate);
            const dayOfWeek = currentDate.getDay();
            const dateString = formatDateString(currentDate);

            relevantClasses.forEach(cls => {
                cls.schedule?.forEach(s => {
                    if (dayOfWeekToNumber[s.dayOfWeek] === dayOfWeek) {
                        const key = `${cls.id}|${dateString}`;
                        if (!eventsMap.has(key)) {
                            const isPast = currentDate < today;
                            eventsMap.set(key, {
                                date: new Date(currentDate),
                                title: cls.name,
                                link: ROUTES.ATTENDANCE_DETAIL.replace(':classId', cls.id).replace(':date', dateString),
                                color: isPast ? '#ef4444' : '#9ca3af', // Red for "Unmarked" : Gray for "Scheduled"
                                linkState: { returnTo: ROUTES.ATTENDANCE_HUB },
                                statusText: isPast ? 'Chưa điểm danh' : 'Lịch học',
                                startTime: s.startTime,
                                endTime: s.endTime,
                            });
                        }
                    }
                });
            });
            loopDate.setDate(loopDate.getDate() + 1);
        }
        
        return Array.from(eventsMap.values());
    }, [relevantClasses, state.attendance, displayMonth]);
        
    const eventsForSelectedDay = useMemo(() => {
        const selectedDateString = formatDateString(normalizedSelectedDate);
        return monthlyCalendarEvents
            .filter(event => formatDateString(event.date) === selectedDateString)
            .sort((a,b) => a.startTime.localeCompare(b.startTime));
    }, [monthlyCalendarEvents, normalizedSelectedDate]);
    
    return (
        <div className="flex flex-col h-full text-gray-800 dark:text-white">
            {/* Top Calendar part */}
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
            
            {/* Bottom Schedule List */}
            <div className="flex-grow bg-white dark:bg-slate-700 rounded-t-2xl shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto pt-4">
                     <div className="px-4 pb-24 md:pb-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold">Lịch học ngày {formatDateString(normalizedSelectedDate)}</h2>
                            {role !== UserRole.VIEWER && (
                                <div className="flex gap-2">
                                    <Button variant="secondary" size="sm" onClick={() => setShowQRModal(true)}>
                                        📱 QR
                                    </Button>
                                    <Button variant="secondary" size="sm" onClick={() => setShowAbsentModal(true)}>
                                        Học sinh nghỉ
                                    </Button>
                                </div>
                            )}
                        </div>
                        {eventsForSelectedDay.length > 0 ? (
                            <div className="space-y-3 pt-2">
                                {eventsForSelectedDay.map((event, idx) => (
                                    <Link 
                                        to={event.link} 
                                        state={event.linkState} 
                                        key={idx}
                                        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-600/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-500/50 transition-colors group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-1.5 h-12 rounded-full shrink-0" style={{ backgroundColor: event.color }}></div>
                                            <div>
                                                <h3 className="font-bold text-base text-gray-900 dark:text-white">{event.title}</h3>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                                                    {event.statusText} • {event.startTime} - {event.endTime}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-gray-400 group-hover:text-primary transition-colors">
                                            {ICONS.chevronRight}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center text-center py-6">
                                <p className="text-gray-500">Không có lịch học vào ngày này</p>
                            </div>
                        )}

                        {/* Unscheduled Classes - Attend any class on any day */}
                        <UnscheduledClassesSection
                            relevantClasses={relevantClasses}
                            eventsForSelectedDay={eventsForSelectedDay}
                            selectedDate={formatDateString(normalizedSelectedDate)}
                        />
                    </div>
                </div>
            </div>
            <AbsentStudentsModal 
                isOpen={showAbsentModal} 
                onClose={() => setShowAbsentModal(false)} 
                date={formatDateString(normalizedSelectedDate)} 
            />
            <QRAttendanceModal
                isOpen={showQRModal}
                onClose={() => setShowQRModal(false)}
            />
        </div>
    );
};

// Expandable section for unscheduled classes
const UnscheduledClassesSection: React.FC<{
    relevantClasses: ClassModel[];
    eventsForSelectedDay: CalendarEvent[];
    selectedDate: string;
}> = ({ relevantClasses, eventsForSelectedDay, selectedDate }) => {
    const { state } = useData();
    const [isExpanded, setIsExpanded] = useState(false);

    // Find classes NOT in today's scheduled events
    const scheduledClassIds = new Set(eventsForSelectedDay.map(e => {
        // Extract classId from link: /attendance/:classId/:date
        const parts = e.link.split('/');
        return parts[2]; // classId
    }));

    const unscheduledClasses = relevantClasses.filter(cls => !scheduledClassIds.has(cls.id));

    if (unscheduledClasses.length === 0) return null;

    return (
        <div className="mt-4">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-600/30 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-500/30 transition-colors"
            >
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                    📋 Tất cả lớp học ({unscheduledClasses.length})
                </span>
                <svg className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isExpanded && (
                <div className="space-y-2 mt-2">
                    {unscheduledClasses.map(cls => (
                        <Link
                            key={cls.id}
                            to={ROUTES.ATTENDANCE_DETAIL.replace(':classId', cls.id).replace(':date', selectedDate)}
                            state={{ returnTo: ROUTES.ATTENDANCE_HUB }}
                            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-600/30 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-500/30 transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-1 h-8 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0"></div>
                                <div>
                                    <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200">{cls.name}</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {(cls.studentIds || []).filter(id => state.students.some(s => s.id === id && s.status === 'ACTIVE')).length} học viên • Ngoài lịch
                                    </p>
                                </div>
                            </div>
                            <div className="text-gray-400 group-hover:text-primary transition-colors">
                                {ICONS.chevronRight}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};