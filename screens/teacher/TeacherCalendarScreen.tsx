import React, { useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useData } from '../../hooks/useDataContext';
import { Class } from '../../types';

const DAYS_VN = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MONTHS_VN = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
const DAY_MAP: Record<number, string> = { 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };

const classColors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#0EA5E9', '#6366F1', '#EF4444'];

const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface ClassForDay {
    cls: Class;
    schedule: { dayOfWeek: string; startTime: string; endTime: string };
    studentCount: number;
}

export const TeacherCalendarScreen: React.FC = () => {
    const { user } = useAuth();
    const { state } = useData();

    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
    });
    const [selectedDate, setSelectedDate] = useState<string>(toDateStr(new Date()));

    const teacherId = user?.id || '';
    const teacherName = (state.teachers as any[])?.find((t: any) => t.id === teacherId)?.name || user?.name || '';

    const myClasses = useMemo(() => {
        return state.classes.filter(c => c.teacherIds?.includes(teacherId));
    }, [state.classes, teacherId]);

    // Build calendar days
    const calendarDays = useMemo(() => {
        const { year, month } = currentMonth;
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0
        const days: { date: Date; day: number; isCurrentMonth: boolean; isToday: boolean; classes: ClassForDay[] }[] = [];
        const today = new Date();

        // Previous month padding
        for (let i = startOffset - 1; i >= 0; i--) {
            const d = new Date(year, month, -i);
            days.push({ date: d, day: d.getDate(), isCurrentMonth: false, isToday: false, classes: [] });
        }

        // Current month
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const date = new Date(year, month, d);
            const dayName = DAY_MAP[date.getDay()];
            const isToday = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();

            const classesForDay: ClassForDay[] = [];
            myClasses.forEach(cls => {
                (cls.schedule || []).forEach((sched: any) => {
                    if (sched.dayOfWeek === dayName) {
                        const activeCount = (cls.studentIds || []).filter(sid => {
                            const st = state.students.find(s => s.id === sid);
                            return st && st.status === 'ACTIVE';
                        }).length;
                        classesForDay.push({ cls, schedule: sched, studentCount: activeCount });
                    }
                });
            });
            classesForDay.sort((a, b) => a.schedule.startTime.localeCompare(b.schedule.startTime));

            days.push({ date, day: d, isCurrentMonth: true, isToday, classes: classesForDay });
        }

        // Next month padding
        const remaining = 7 - (days.length % 7);
        if (remaining < 7) {
            for (let i = 1; i <= remaining; i++) {
                const d = new Date(year, month + 1, i);
                days.push({ date: d, day: d.getDate(), isCurrentMonth: false, isToday: false, classes: [] });
            }
        }
        return days;
    }, [currentMonth, myClasses, state.students]);

    // Stats
    const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const totalWeekSessions = myClasses.reduce((sum, cls) =>
        sum + (cls.schedule || []).filter((s: any) => weekDays.includes(s.dayOfWeek)).length, 0);

    // Selected day
    const selectedDayClasses = useMemo(() => {
        const day = calendarDays.find(d => toDateStr(d.date) === selectedDate);
        return day?.classes || [];
    }, [selectedDate, calendarDays]);

    const prevMonth = () => setCurrentMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
    const nextMonth = () => setCurrentMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });

    // Color map for consistent class colors
    const classColorMap = useMemo(() => {
        const map: Record<string, string> = {};
        myClasses.forEach((c, i) => { map[c.id] = classColors[i % classColors.length]; });
        return map;
    }, [myClasses]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">📅 Lịch dạy của tôi</h1>
                    <p className="text-gray-500 dark:text-gray-400">Xin chào, {teacherName}</p>
                </div>
                <div className="flex gap-3">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl px-4 py-2 text-center">
                        <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">{myClasses.length}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Lớp đang dạy</p>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-4 py-2 text-center">
                        <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{totalWeekSessions}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Buổi / tuần</p>
                    </div>
                </div>
            </div>

            {/* Calendar */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-4 md:p-6">
                {/* Month nav */}
                <div className="flex items-center justify-between mb-4">
                    <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                        {MONTHS_VN[currentMonth.month]} {currentMonth.year}
                    </h2>
                    <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 mb-2">
                    {DAYS_VN.map(d => (
                        <div key={d} className="text-center text-xs font-bold text-gray-400 dark:text-gray-500 py-2">{d}</div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, idx) => {
                        const isSelected = toDateStr(day.date) === selectedDate;
                        return (
                            <button
                                key={idx}
                                onClick={() => setSelectedDate(toDateStr(day.date))}
                                className={`
                                    relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-all duration-200
                                    ${isSelected ? 'bg-primary text-white shadow-md' : ''}
                                    ${day.isToday && !isSelected ? 'ring-2 ring-primary/40 bg-primary/5' : ''}
                                    ${!day.isCurrentMonth ? 'text-gray-300 dark:text-gray-600' : 'text-gray-700 dark:text-gray-200'}
                                    ${day.isCurrentMonth && !isSelected ? 'hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer' : ''}
                                `}
                            >
                                <span className={`${day.isToday || isSelected ? 'font-bold' : ''}`}>{day.day}</span>
                                {day.classes.length > 0 && (
                                    <div className="flex gap-0.5 mt-0.5">
                                        {day.classes.slice(0, 3).map((c, ci) => (
                                            <div
                                                key={ci}
                                                className="w-1.5 h-1.5 rounded-full"
                                                style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.8)' : classColorMap[c.cls.id] || '#3B82F6' }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Legend */}
                {myClasses.length > 0 && (
                    <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        {myClasses.map(cls => (
                            <div key={cls.id} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: classColorMap[cls.id] }} />
                                {cls.name}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Selected day detail */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-4 md:p-6">
                <h3 className="font-bold text-gray-800 dark:text-white mb-3">
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })}
                </h3>
                {selectedDayClasses.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-3xl mb-2">🎉</p>
                        <p className="text-gray-400 dark:text-gray-500">Không có buổi dạy nào</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {selectedDayClasses.map((item, idx) => {
                            const color = classColorMap[item.cls.id] || '#3B82F6';
                            return (
                                <div key={idx} className="flex items-stretch rounded-xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700">
                                    <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: color }} />
                                    <div className="flex-1 p-3 flex items-center justify-between bg-white dark:bg-slate-800">
                                        <div>
                                            <p className="font-bold text-gray-800 dark:text-white">{item.cls.name}</p>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                <span>📚 {item.cls.subject}</span>
                                                <span>👥 {item.studentCount} học viên</span>
                                            </div>
                                        </div>
                                        <div className="rounded-lg px-3 py-1 text-xs font-bold" style={{ backgroundColor: color + '1A', color }}>
                                            {item.schedule.startTime} - {item.schedule.endTime}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
