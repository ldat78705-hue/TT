import React, { useState, useMemo } from 'react';
import { useData } from '../hooks/useDataContext';

const ACTION_ICONS: Record<string, string> = {
    student: '👨‍🎓', teacher: '👨‍🏫', class: '📚', attendance: '📋',
    finance: '💰', announcement: '📢', room: '🏫', settings: '⚙️', system: '🔧'
};

const ACTION_COLORS: Record<string, string> = {
    student: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    teacher: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    class: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    attendance: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    finance: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    announcement: 'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
    room: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    settings: 'bg-gray-50 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    system: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

export const AuditLogScreen: React.FC = () => {
    const { state } = useData();
    const logs = state.auditLogs || [];
    const [filterType, setFilterType] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const types = useMemo(() => {
        const s = new Set(logs.map(l => l.targetType));
        return ['all', ...Array.from(s)];
    }, [logs]);

    const filteredLogs = useMemo(() => {
        let result = logs;
        if (filterType !== 'all') result = result.filter(l => l.targetType === filterType);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(l => l.details.toLowerCase().includes(q) || l.userName.toLowerCase().includes(q) || l.targetName.toLowerCase().includes(q));
        }
        return result;
    }, [logs, filterType, searchQuery]);

    const formatTime = (ts: string) => {
        try {
            const d = new Date(ts);
            return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch { return ts; }
    };

    const typeLabel = (type: string) => {
        const map: Record<string, string> = { student: 'Học viên', teacher: 'Giáo viên', class: 'Lớp học', attendance: 'Điểm danh', finance: 'Tài chính', announcement: 'Thông báo', room: 'Phòng học', settings: 'Cài đặt', system: 'Hệ thống' };
        return map[type] || type;
    };

    return (
        <div className="space-y-4 md:space-y-6">
            <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">📝 Lịch sử thao tác</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Theo dõi mọi thay đổi trên hệ thống (tối đa 500 bản ghi gần nhất)</p>
            </div>

            {/* Filters */}
            <div className="space-y-3">
                <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="🔍 Tìm kiếm..."
                    className="form-input w-full"
                />
                <div className="flex gap-1.5 flex-wrap">
                    {types.map(t => (
                        <button key={t} onClick={() => setFilterType(t)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors ${filterType === t ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}>
                            {t === 'all' ? 'Tất cả' : `${ACTION_ICONS[t] || '📌'} ${typeLabel(t)}`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Log list */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
                {filteredLogs.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <p className="text-5xl mb-4">📝</p>
                        <p className="text-lg font-medium">Chưa có lịch sử thao tác</p>
                        <p className="text-sm mt-1">Các thao tác mới sẽ được ghi lại tự động</p>
                    </div>
                ) : (
                    <div className="divide-y dark:divide-gray-700">
                        {filteredLogs.map(log => (
                            <div key={log.id} className="flex gap-3 p-3 md:p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                <div className={`flex-shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-base md:text-lg ${ACTION_COLORS[log.targetType] || 'bg-gray-100 text-gray-600'}`}>
                                    {ACTION_ICONS[log.targetType] || '📌'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white leading-snug">{log.details}</p>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[log.targetType] || ''}`}>{typeLabel(log.targetType)}</span>
                                        <span className="text-xs text-gray-400">bởi <strong>{log.userName || 'Unknown'}</strong></span>
                                        <span className="text-xs text-gray-400 md:hidden">• {formatTime(log.timestamp)}</span>
                                    </div>
                                </div>
                                <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0 hidden md:block self-start pt-0.5">{formatTime(log.timestamp)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <p className="text-center text-xs text-gray-400 pb-4">Hiển thị {filteredLogs.length} / {logs.length} bản ghi</p>
        </div>
    );
};
