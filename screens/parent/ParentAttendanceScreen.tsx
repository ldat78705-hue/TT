import React, { useMemo, useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useData } from '../../hooks/useDataContext';
import { Student, AttendanceRecord, AttendanceStatus } from '../../types';
import { Button } from '../../components/common/Button';
import { useToast } from '../../context/ToastContext';


const MONTHS_VN = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

const statusConfig: Record<string, { label: string; dot: string; bg: string; text: string }> = {
    PRESENT: { label: 'Có mặt', dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300' },
    LATE: { label: 'Đi muộn', dot: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300' },
    ABSENT: { label: 'Vắng', dot: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300' },
    UNEXCUSED_ABSENT: { label: 'Vắng KP', dot: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300' },
    EXCUSED_ABSENT: { label: 'Nghỉ phép', dot: 'bg-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300' },
};

const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const ParentAttendanceScreen: React.FC = () => {
    const { user } = useAuth();
    const { state, updateSingleAttendance } = useData();
    const { showToast } = useToast();
    const student = user as Student;

    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
    });
    const [selectedDate, setSelectedDate] = useState<string>(toDateStr(new Date()));
    const [showLeaveDialog, setShowLeaveDialog] = useState(false);
    const [leaveDate, setLeaveDate] = useState('');
    const [leaveClassId, setLeaveClassId] = useState('');
    const [leaveReason, setLeaveReason] = useState('');
    const [leaveLoading, setLeaveLoading] = useState(false);

    const myClasses = useMemo(() => {
        if (!student) return [];
        return state.classes.filter(c => c.studentIds.includes(student.id));
    }, [state.classes, student]);

    const myAttendance = useMemo(() => {
        if (!student) return [];
        return state.attendance.filter(a => a.studentId === student.id);
    }, [state.attendance, student]);

    // Calendar days
    const calendarDays = useMemo(() => {
        const { year, month } = currentMonth;
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0
        const days: { date: Date; day: number; isCurrentMonth: boolean; isToday: boolean; records: AttendanceRecord[] }[] = [];
        const today = new Date();

        // Previous month padding
        for (let i = startOffset - 1; i >= 0; i--) {
            const d = new Date(year, month, -i);
            days.push({ date: d, day: d.getDate(), isCurrentMonth: false, isToday: false, records: [] });
        }

        // Current month
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const date = new Date(year, month, d);
            const dateStr = toDateStr(date);
            const isToday = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
            const records = myAttendance.filter(a => a.date === dateStr);
            days.push({ date, day: d, isCurrentMonth: true, isToday, records });
        }

        // Next month padding
        const remaining = 7 - (days.length % 7);
        if (remaining < 7) {
            for (let i = 1; i <= remaining; i++) {
                const d = new Date(year, month + 1, i);
                days.push({ date: d, day: d.getDate(), isCurrentMonth: false, isToday: false, records: [] });
            }
        }

        return days;
    }, [currentMonth, myAttendance]);

    // Monthly stats
    const monthStats = useMemo(() => {
        const { year, month } = currentMonth;
        const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
        const monthRecords = myAttendance.filter(a => a.date.startsWith(monthStr));
        return {
            present: monthRecords.filter(a => a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.LATE).length,
            absent: monthRecords.filter(a => a.status === AttendanceStatus.ABSENT || a.status === AttendanceStatus.UNEXCUSED_ABSENT || a.status === AttendanceStatus.EXCUSED_ABSENT).length,
            late: monthRecords.filter(a => a.status === AttendanceStatus.LATE).length,
            excused: monthRecords.filter(a => a.status === AttendanceStatus.EXCUSED_ABSENT).length,
        };
    }, [currentMonth, myAttendance]);

    // Selected day records
    const selectedDayRecords = useMemo(() => {
        return myAttendance.filter(a => a.date === selectedDate);
    }, [selectedDate, myAttendance]);

    const prevMonth = () => setCurrentMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
    const nextMonth = () => setCurrentMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });

    const handleSubmitLeave = useCallback(async () => {
        if (!leaveDate || !student) return;
        const classId = leaveClassId || myClasses[0]?.id;
        if (!classId) return;

        setLeaveLoading(true);
        try {
            await updateSingleAttendance({
                classId,
                studentId: student.id,
                date: leaveDate,
                status: 'EXCUSED_ABSENT',
                note: `PHHS xin phép: ${leaveReason || 'Không ghi lý do'}`,
            });
            showToast('Đã gửi xin nghỉ phép thành công!', 'success');
            setShowLeaveDialog(false);
            setLeaveReason('');
        } catch (err: any) {
            showToast(err.message || 'Gửi đơn thất bại', 'error');
        }
        setLeaveLoading(false);
    }, [leaveDate, leaveClassId, leaveReason, student, myClasses, updateSingleAttendance, showToast]);

    if (!student) {
        return <div className="text-center py-20 text-gray-500">Đang tải...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">📅 Lịch điểm danh</h1>
                    <p className="text-gray-500 dark:text-gray-400">{student.name} • Mã HS: {student.id}</p>
                </div>
                <Button onClick={() => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    setLeaveDate(toDateStr(tomorrow));
                    setLeaveClassId(myClasses[0]?.id || '');
                    setLeaveReason('');
                    setShowLeaveDialog(true);
                }}>
                    📝 Xin nghỉ phép
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="✅ Có mặt" value={monthStats.present} color="text-emerald-600 dark:text-emerald-400" bg="bg-emerald-50 dark:bg-emerald-900/20" />
                <StatCard label="❌ Vắng" value={monthStats.absent} color="text-red-600 dark:text-red-400" bg="bg-red-50 dark:bg-red-900/20" />
                <StatCard label="⏰ Đi muộn" value={monthStats.late} color="text-amber-600 dark:text-amber-400" bg="bg-amber-50 dark:bg-amber-900/20" />
                <StatCard label="📝 Nghỉ phép" value={monthStats.excused} color="text-blue-600 dark:text-blue-400" bg="bg-blue-50 dark:bg-blue-900/20" />
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
                    {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
                        <div key={d} className="text-center text-xs font-bold text-gray-400 dark:text-gray-500 py-2">{d}</div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, idx) => {
                        const isSelected = toDateStr(day.date) === selectedDate;
                        const dominantStatus = day.records[0]?.status;
                        const dotColor = dominantStatus ? statusConfig[dominantStatus]?.dot : '';

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
                                {dotColor && (
                                    <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-white/80' : dotColor}`} />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    {Object.entries(statusConfig).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <div className={`w-2.5 h-2.5 rounded-full ${val.dot}`} />
                            {val.label}
                        </div>
                    ))}
                </div>
            </div>

            {/* Selected day detail */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-4 md:p-6">
                <h3 className="font-bold text-gray-800 dark:text-white mb-3">
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })}
                </h3>
                {selectedDayRecords.length === 0 ? (
                    <p className="text-gray-400 dark:text-gray-500 text-center py-6">Không có dữ liệu điểm danh</p>
                ) : (
                    <div className="space-y-3">
                        {selectedDayRecords.map(record => {
                            const cls = myClasses.find(c => c.id === record.classId);
                            const cfg = statusConfig[record.status] || statusConfig.ABSENT;
                            return (
                                <div key={record.id} className={`flex items-center justify-between p-3 rounded-xl ${cfg.bg}`}>
                                    <div>
                                        <p className="font-semibold text-gray-800 dark:text-white">{cls?.name || record.classId}</p>
                                        {record.note && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">📝 {record.note}</p>}
                                    </div>
                                    <span className={`text-sm font-bold ${cfg.text}`}>{cfg.label}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Leave Request Modal */}
            {showLeaveDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowLeaveDialog(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-2xl">📝</div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Xin nghỉ phép cho con</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Gửi đơn xin phép nghỉ học</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ngày nghỉ</label>
                                <input
                                    type="date"
                                    value={leaveDate}
                                    onChange={e => setLeaveDate(e.target.value)}
                                    className="form-input w-full"
                                />
                            </div>

                            {myClasses.length > 1 && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chọn lớp</label>
                                    <select
                                        value={leaveClassId}
                                        onChange={e => setLeaveClassId(e.target.value)}
                                        className="form-input w-full"
                                    >
                                        {myClasses.map(cls => (
                                            <option key={cls.id} value={cls.id}>{cls.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lý do xin nghỉ</label>
                                <textarea
                                    value={leaveReason}
                                    onChange={e => setLeaveReason(e.target.value)}
                                    className="form-input w-full"
                                    rows={3}
                                    placeholder="Ghi lý do xin nghỉ..."
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button
                                    variant="secondary"
                                    className="flex-1"
                                    onClick={() => setShowLeaveDialog(false)}
                                >
                                    Hủy
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={handleSubmitLeave}
                                    isLoading={leaveLoading}
                                    disabled={!leaveDate}
                                >
                                    Gửi xin phép
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard: React.FC<{ label: string; value: number; color: string; bg: string }> = ({ label, value, color, bg }) => (
    <div className={`${bg} rounded-xl p-4 text-center`}>
        <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
);
