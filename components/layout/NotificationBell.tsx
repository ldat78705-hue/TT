import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useData } from '../../hooks/useDataContext';
import { useAuth } from '../../hooks/useAuth';
import { PersonStatus, AttendanceStatus, UserRole } from '../../types';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { getVietnamTime } from '../../utils/date';
import { Bell, RefreshCw } from 'lucide-react';

interface Notification {
    id: string;
    type: 'debt' | 'attendance' | 'absence' | 'info';
    title: string;
    message: string;
    link?: string;
    linkState?: object;
    icon: string;
    color: string;
}

export const NotificationBell: React.FC = () => {
    const { state, refreshData } = useData();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const { role, user } = useAuth();
    const canViewFinancials = role === UserRole.ADMIN || role === UserRole.MANAGER || role === UserRole.ACCOUNTANT;
    const [isOpen, setIsOpen] = useState(false);
    const [dismissed, setDismissed] = useState<Set<string>>(() => {
        try {
            const stored = sessionStorage.getItem('dismissed_notifications');
            return stored ? new Set(JSON.parse(stored)) : new Set();
        } catch { return new Set(); }
    });
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const notifications = useMemo<Notification[]>(() => {
        const items: Notification[] = [];
        const vnDate = new Date(getVietnamTime());
        const todayStr = `${vnDate.getFullYear()}-${String(vnDate.getMonth()+1).padStart(2,'0')}-${String(vnDate.getDate()).padStart(2,'0')}`;
        const dayOfWeekEn = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][vnDate.getDay()];

        // 1. Students with high debt (> 500k) — only for financial roles
        if (canViewFinancials) {
            const highDebtStudents = state.students.filter(s => s.status === PersonStatus.ACTIVE && s.balance < -500000);
            if (highDebtStudents.length > 0) {
                items.push({
                    id: 'high-debt',
                    type: 'debt',
                    title: `${highDebtStudents.length} học viên nợ > 500k`,
                    message: highDebtStudents.slice(0, 3).map(s => `${s.name}: ${Math.abs(s.balance).toLocaleString('vi-VN')}₫`).join(', ') + (highDebtStudents.length > 3 ? '...' : ''),
                    link: ROUTES.FINANCE,
                    linkState: { defaultTab: 'debt_report' },
                    icon: '💰',
                    color: 'text-red-500'
                });
            }
        }

        // 2. Classes today that haven't been marked
        let classesToday = state.classes.filter(cls => 
            (cls.schedule || []).some(s => s.dayOfWeek === dayOfWeekEn)
        );
        // Teachers only see their own classes
        if (role === UserRole.TEACHER && user?.id) {
            const teacherId = user.id;
            classesToday = classesToday.filter(cls => (cls.teacherIds || []).includes(teacherId));
        }
        const unmarkedClasses = classesToday.filter(cls => {
            const hasAttendance = state.attendance.some(a => a.classId === cls.id && a.date === todayStr && a.status !== AttendanceStatus.UNMARKED);
            return !hasAttendance;
        });
        if (unmarkedClasses.length > 0 && vnDate.getHours() >= 10) {
            items.push({
                id: 'unmarked-today',
                type: 'attendance',
                title: `${unmarkedClasses.length} lớp chưa điểm danh hôm nay`,
                message: unmarkedClasses.map(c => c.name).join(', '),
                link: ROUTES.ATTENDANCE_HUB,
                icon: '📋',
                color: 'text-orange-500'
            });
        }

        // 3. Students absent >= 3 times in last 30 days
        const thirtyDaysAgo = new Date(vnDate);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth()+1).padStart(2,'0')}-${String(thirtyDaysAgo.getDate()).padStart(2,'0')}`;
        
        // For teachers, only track attendance of their own classes' students
        let relevantAttendance = state.attendance;
        let relevantStudentIds: Set<string> | null = null;
        if (role === UserRole.TEACHER && user?.id) {
            const teacherClassIds = new Set(
                state.classes.filter(cls => (cls.teacherIds || []).includes(user.id)).map(c => c.id)
            );
            relevantAttendance = state.attendance.filter(a => teacherClassIds.has(a.classId));
            relevantStudentIds = new Set(
                state.classes.filter(cls => teacherClassIds.has(cls.id)).flatMap(cls => cls.studentIds)
            );
        }

        const absenceCounts = new Map<string, number>();
        relevantAttendance.forEach(a => {
            if ((a.status === AttendanceStatus.ABSENT || a.status === AttendanceStatus.UNEXCUSED_ABSENT) && a.date >= thirtyDaysAgoStr) {
                if (!relevantStudentIds || relevantStudentIds.has(a.studentId)) {
                    absenceCounts.set(a.studentId, (absenceCounts.get(a.studentId) || 0) + 1);
                }
            }
        });
        
        const frequentAbsentees = Array.from(absenceCounts.entries())
            .filter(([, count]) => count >= 3)
            .map(([id, count]) => ({ name: state.students.find(s => s.id === id)?.name || id, count }))
            .sort((a, b) => b.count - a.count);

        if (frequentAbsentees.length > 0) {
            items.push({
                id: 'frequent-absence',
                type: 'absence',
                title: `${frequentAbsentees.length} học viên nghỉ nhiều (30 ngày)`,
                message: frequentAbsentees.slice(0, 3).map(s => `${s.name}: ${s.count} buổi`).join(', '),
                link: role === UserRole.TEACHER ? ROUTES.ATTENDANCE_HUB : ROUTES.REPORTS,
                linkState: role === UserRole.TEACHER ? undefined : { defaultReport: 'attendance' },
                icon: '⚠️',
                color: 'text-amber-500'
            });
        }

        // 4. Recent webhook payments (from announcements created by webhook in last 24h)
        if (canViewFinancials) {
            const twentyFourHoursAgo = new Date(vnDate.getTime() - 24 * 60 * 60 * 1000);
            const cutoffStr = `${twentyFourHoursAgo.getFullYear()}-${String(twentyFourHoursAgo.getMonth()+1).padStart(2,'0')}-${String(twentyFourHoursAgo.getDate()).padStart(2,'0')}T${String(twentyFourHoursAgo.getHours()).padStart(2,'0')}:${String(twentyFourHoursAgo.getMinutes()).padStart(2,'0')}:${String(twentyFourHoursAgo.getSeconds()).padStart(2,'0')}`;

            const webhookPayments = (state.announcements || [])
                .filter(a => a.createdBy === 'Hệ thống Webhook' && a.createdAt >= cutoffStr)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            webhookPayments.forEach(payment => {
                items.push({
                    id: `webhook-${payment.id}`,
                    type: 'info',
                    title: payment.title,
                    message: payment.content.split('\n')[0],
                    link: ROUTES.REPORTS,
                    linkState: { defaultReport: 'webhook' },
                    icon: '💳',
                    color: 'text-green-500'
                });
            });
        }

        return items;
    }, [state.students, state.classes, state.attendance, state.announcements]);

    const activeNotifications = notifications.filter(n => !dismissed.has(n.id));

    const handleDismiss = (id: string) => {
        setDismissed(prev => {
            const next = new Set(prev);
            next.add(id);
            sessionStorage.setItem('dismissed_notifications', JSON.stringify([...next]));
            return next;
        });
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className="relative p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Thông báo"
            >
                <Bell size={20} />
                {activeNotifications.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                        {activeNotifications.length}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 md:w-96 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-xl shadow-slate-200/20 dark:shadow-none border border-slate-100 dark:border-slate-700 z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                        <h3 className="font-bold text-sm">Thông báo</h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={async () => {
                                    setIsRefreshing(true);
                                    try { await refreshData(); } catch {}
                                    setIsRefreshing(false);
                                }}
                                className="p-1 rounded-full text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                title="Cập nhật"
                                disabled={isRefreshing}
                            >
                                <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                            </button>
                            <span className="text-xs text-slate-400">{activeNotifications.length} mới</span>
                        </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        {activeNotifications.length > 0 ? (
                            activeNotifications.map(n => (
                                <div key={n.id} className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700/50 last:border-b-0 transition-colors">
                                    <div className="flex items-start gap-3">
                                        <span className="text-xl flex-shrink-0">{n.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            {n.link ? (
                                                <Link to={n.link} state={n.linkState} onClick={() => setIsOpen(false)} className="font-semibold text-sm hover:text-primary transition-colors">
                                                    {n.title}
                                                </Link>
                                            ) : (
                                                <p className="font-semibold text-sm">{n.title}</p>
                                            )}
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{n.message}</p>
                                        </div>
                                        <button onClick={() => handleDismiss(n.id)} className="text-slate-300 hover:text-slate-500 flex-shrink-0 text-xs" title="Ẩn">✕</button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="px-4 py-8 text-center text-sm text-slate-400">
                                <span className="text-2xl block mb-2">🔔</span>
                                Không có thông báo mới
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
