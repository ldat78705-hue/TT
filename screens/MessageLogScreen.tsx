import React, { useState, useEffect, useMemo } from 'react';
import { getMessageLogs, sendCustomMessage } from '../services/api';
import { useToast } from '../hooks/useToast';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import { Pagination } from '../components/common/Pagination';

const TYPE_MAP: Record<string, { label: string; icon: string; color: string }> = {
    absence: { label: 'Vắng mặt', icon: '🔴', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    tuition: { label: 'Học phí', icon: '💰', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    overdue: { label: 'Nhắc nợ', icon: '⚠️', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
    paymentConfirm: { label: 'Xác nhận TT', icon: '✅', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    custom: { label: 'Tùy chỉnh', icon: '💬', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    group: { label: 'Nhóm lớp', icon: '👥', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
    sent: { label: 'Đã gửi', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    failed: { label: 'Thất bại', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    skipped: { label: 'Bỏ qua', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
};

const PAGE_SIZE = 20;

export const MessageLogScreen: React.FC = () => {
    const { toast } = useToast();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [filterType, setFilterType] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterClass, setFilterClass] = useState('all');
    const [searchStudent, setSearchStudent] = useState('');
    const [viewingMessage, setViewingMessage] = useState<any>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [retryingId, setRetryingId] = useState<string | null>(null);

    const handleRetry = async (log: any) => {
        if (!log.phone || !log.message) {
            toast.error('Thiếu SĐT hoặc nội dung tin nhắn để gửi lại');
            return;
        }
        const logId = log.id || `${log.timestamp}_${log.phone}`;
        setRetryingId(logId);
        try {
            const result = await sendCustomMessage(
                log.studentName || '',
                log.parentName || '',
                log.phone,
                log.message,
                log.zaloUserId || undefined,
                log.className || undefined
            );
            if (result.success || result.message?.includes('thành công')) {
                toast.success(`Đã gửi lại cho ${log.studentName || log.phone}`);
                // Refresh logs
                await fetchLogs();
            } else {
                toast.error(result.error || 'Gửi lại thất bại');
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi khi gửi lại');
        }
        setRetryingId(null);
    };

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const result = await getMessageLogs(selectedMonth);
            if (result.success) {
                setLogs(result.logs || []);
            } else {
                setLogs([]);
            }
        } catch (err) {
            toast.error('Lỗi tải lịch sử gửi tin');
            setLogs([]);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchLogs();
        setCurrentPage(1);
    }, [selectedMonth]);

    // Extract unique class names from logs
    const classOptions = useMemo(() => {
        const classes = new Set<string>();
        logs.forEach(l => {
            if (l.className) classes.add(l.className);
        });
        return Array.from(classes).sort();
    }, [logs]);

    const filteredLogs = useMemo(() => {
        let result = [...logs];
        if (filterType !== 'all') result = result.filter(l => l.type === filterType);
        if (filterStatus !== 'all') result = result.filter(l => l.status === filterStatus);
        if (filterClass !== 'all') result = result.filter(l => l.className === filterClass);
        if (searchStudent.trim()) {
            const keyword = searchStudent.toLowerCase().trim();
            result = result.filter(l => 
                (l.studentName || '').toLowerCase().includes(keyword) ||
                (l.parentName || '').toLowerCase().includes(keyword) ||
                (l.phone || '').includes(keyword)
            );
        }
        return result.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }, [logs, filterType, filterStatus, filterClass, searchStudent]);

    const paginatedLogs = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredLogs.slice(start, start + PAGE_SIZE);
    }, [filteredLogs, currentPage]);

    const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);

    // Stats
    const stats = useMemo(() => {
        const total = logs.length;
        const sent = logs.filter(l => l.status === 'sent').length;
        const failed = logs.filter(l => l.status === 'failed').length;
        const byType = Object.entries(TYPE_MAP).map(([key, val]) => ({
            ...val,
            key,
            count: logs.filter(l => l.type === key).length,
        })).filter(t => t.count > 0);
        return { total, sent, failed, byType, successRate: total > 0 ? Math.round((sent / total) * 100) : 0 };
    }, [logs]);

    // Generate month options (last 12 months)
    const monthOptions = useMemo(() => {
        const options: { value: string; label: string }[] = [];
        const now = new Date();
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            options.push({ value: val, label: `Tháng ${d.getMonth() + 1}/${d.getFullYear()}` });
        }
        return options;
    }, []);

    const formatTime = (ts: number) => {
        if (!ts) return '';
        const d = new Date(ts);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    const resetFilters = () => {
        setFilterType('all');
        setFilterStatus('all');
        setFilterClass('all');
        setSearchStudent('');
        setCurrentPage(1);
    };

    const hasActiveFilters = filterType !== 'all' || filterStatus !== 'all' || filterClass !== 'all' || searchStudent.trim() !== '';

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">📨 Lịch sử gửi tin nhắn</h1>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card-base text-center">
                    <p className="text-3xl font-bold text-primary">{stats.total}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Tổng tin nhắn</p>
                </div>
                <div className="card-base text-center">
                    <p className="text-3xl font-bold text-green-600">{stats.sent}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Đã gửi</p>
                </div>
                <div className="card-base text-center">
                    <p className="text-3xl font-bold text-red-600">{stats.failed}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Thất bại</p>
                </div>
                <div className="card-base text-center">
                    <p className="text-3xl font-bold text-blue-600">{stats.successRate}%</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Tỉ lệ thành công</p>
                </div>
            </div>

            {/* Type breakdown */}
            {stats.byType.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {stats.byType.map(t => (
                        <button key={t.key} onClick={() => { setFilterType(t.key); setCurrentPage(1); }}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${t.color} ${filterType === t.key ? 'ring-2 ring-primary ring-offset-1 dark:ring-offset-gray-900' : 'hover:opacity-80 cursor-pointer'}`}>
                            {t.icon} {t.label}: {t.count}
                        </button>
                    ))}
                    {filterType !== 'all' && (
                        <button onClick={() => { setFilterType('all'); setCurrentPage(1); }}
                            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                            ✕ Bỏ lọc
                        </button>
                    )}
                </div>
            )}

            {/* Filters */}
            <div className="card-base">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end flex-wrap">
                    <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Tháng</label>
                        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="form-select text-sm py-1.5">
                            {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Loại tin</label>
                        <select value={filterType} onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }} className="form-select text-sm py-1.5">
                            <option value="all">Tất cả</option>
                            {Object.entries(TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Trạng thái</label>
                        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }} className="form-select text-sm py-1.5">
                            <option value="all">Tất cả</option>
                            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                    </div>
                    {classOptions.length > 0 && (
                        <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Lớp</label>
                            <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setCurrentPage(1); }} className="form-select text-sm py-1.5">
                                <option value="all">Tất cả lớp</option>
                                {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="flex-1 min-w-[180px]">
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Tìm học viên / PH</label>
                        <input
                            type="text"
                            value={searchStudent}
                            onChange={e => { setSearchStudent(e.target.value); setCurrentPage(1); }}
                            placeholder="Tên HS, PH hoặc SĐT..."
                            className="form-input text-sm py-1.5 w-full"
                        />
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        {hasActiveFilters && (
                            <Button variant="secondary" onClick={resetFilters} className="text-sm">✕ Xóa lọc</Button>
                        )}
                        <Button variant="secondary" onClick={fetchLogs} className="text-sm">🔄 Tải lại</Button>
                    </div>
                </div>
                {hasActiveFilters && (
                    <p className="text-xs text-gray-400 mt-2">Hiển thị {filteredLogs.length}/{logs.length} kết quả</p>
                )}
            </div>

            {/* Table */}
            <div className="card-base overflow-x-auto">
                {loading ? (
                    <div className="text-center py-12 text-gray-400">
                        <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-3"></div>
                        <p>Đang tải...</p>
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <p className="text-4xl mb-3">📭</p>
                        <p className="text-lg font-medium">{hasActiveFilters ? 'Không tìm thấy kết quả' : 'Chưa có lịch sử gửi tin'}</p>
                        <p className="text-sm mt-1">{hasActiveFilters ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.' : 'Tin nhắn sẽ được ghi lại tự động khi bạn gửi cho phụ huynh.'}</p>
                        {hasActiveFilters && (
                            <Button variant="secondary" onClick={resetFilters} className="mt-3 text-sm">Xóa bộ lọc</Button>
                        )}
                    </div>
                ) : (
                    <>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b dark:border-gray-700">
                                    <th className="text-left py-3 px-3 font-semibold text-gray-500 dark:text-gray-400">Thời gian</th>
                                    <th className="text-left py-3 px-3 font-semibold text-gray-500 dark:text-gray-400">Loại</th>
                                    <th className="text-left py-3 px-3 font-semibold text-gray-500 dark:text-gray-400">Học viên</th>
                                    <th className="text-left py-3 px-3 font-semibold text-gray-500 dark:text-gray-400 hidden lg:table-cell">Lớp</th>
                                    <th className="text-left py-3 px-3 font-semibold text-gray-500 dark:text-gray-400 hidden md:table-cell">Phụ huynh</th>
                                    <th className="text-left py-3 px-3 font-semibold text-gray-500 dark:text-gray-400">Trạng thái</th>
                                    <th className="text-left py-3 px-3 font-semibold text-gray-500 dark:text-gray-400"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedLogs.map((log, idx) => {
                                    const typeInfo = TYPE_MAP[log.type] || { label: log.type, icon: '📩', color: 'bg-gray-100 text-gray-600' };
                                    const statusInfo = STATUS_MAP[log.status] || { label: log.status, color: 'bg-gray-100 text-gray-600' };
                                    return (
                                        <tr key={log.id || idx} className="border-b dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                            <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{formatTime(log.timestamp)}</td>
                                            <td className="py-2.5 px-3">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${typeInfo.color}`}>
                                                    {typeInfo.icon} {typeInfo.label}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 font-medium text-gray-800 dark:text-gray-200">{log.studentName || '-'}</td>
                                            <td className="py-2.5 px-3 text-gray-500 dark:text-gray-400 hidden lg:table-cell text-xs">{log.className || '-'}</td>
                                            <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300 hidden md:table-cell">{log.parentName || '-'}</td>
                                            <td className="py-2.5 px-3">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusInfo.color}`}>
                                                    {statusInfo.label}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <div className="flex items-center gap-2">
                                                    {log.status === 'failed' && log.message && log.phone && (
                                                        <button
                                                            onClick={() => handleRetry(log)}
                                                            disabled={retryingId === (log.id || `${log.timestamp}_${log.phone}`)}
                                                            className="text-orange-500 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 text-xs font-medium disabled:opacity-50"
                                                        >
                                                            {retryingId === (log.id || `${log.timestamp}_${log.phone}`) ? '⏳' : '🔄'} Gửi lại
                                                        </button>
                                                    )}
                                                    <button onClick={() => setViewingMessage(log)} className="text-primary hover:text-primary-dark text-xs font-medium underline">
                                                        Xem
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {totalPages > 1 && (
                            <div className="mt-4">
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentPage}
                                    totalItems={filteredLogs.length}
                                    itemsPerPage={PAGE_SIZE}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Message Detail Modal */}
            <Modal isOpen={!!viewingMessage} onClose={() => setViewingMessage(null)} title="📩 Chi tiết tin nhắn">
                {viewingMessage && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <span className="text-gray-500 dark:text-gray-400">Thời gian:</span>
                                <p className="font-medium">{viewingMessage.timestamp ? new Date(viewingMessage.timestamp).toLocaleString('vi-VN') : '-'}</p>
                            </div>
                            <div>
                                <span className="text-gray-500 dark:text-gray-400">Kênh:</span>
                                <p className="font-medium uppercase">{viewingMessage.channel || '-'}</p>
                            </div>
                            <div>
                                <span className="text-gray-500 dark:text-gray-400">Học viên:</span>
                                <p className="font-medium">{viewingMessage.studentName || '-'}</p>
                            </div>
                            <div>
                                <span className="text-gray-500 dark:text-gray-400">Lớp:</span>
                                <p className="font-medium">{viewingMessage.className || '-'}</p>
                            </div>
                            <div>
                                <span className="text-gray-500 dark:text-gray-400">Phụ huynh:</span>
                                <p className="font-medium">{viewingMessage.parentName || '-'}</p>
                            </div>
                            <div>
                                <span className="text-gray-500 dark:text-gray-400">SĐT:</span>
                                <p className="font-medium">{viewingMessage.phone || '-'}</p>
                            </div>
                            <div>
                                <span className="text-gray-500 dark:text-gray-400">Loại:</span>
                                <p className="font-medium">{TYPE_MAP[viewingMessage.type]?.icon} {TYPE_MAP[viewingMessage.type]?.label || viewingMessage.type}</p>
                            </div>
                            <div>
                                <span className="text-gray-500 dark:text-gray-400">Trạng thái:</span>
                                <p className="font-medium">{STATUS_MAP[viewingMessage.status]?.label || viewingMessage.status}</p>
                            </div>
                        </div>
                        {viewingMessage.reason && (
                            <div className="text-sm">
                                <span className="text-gray-500 dark:text-gray-400">Ghi chú:</span>
                                <p className="font-medium">{viewingMessage.reason}</p>
                            </div>
                        )}
                        <div>
                            <span className="text-sm text-gray-500 dark:text-gray-400">Nội dung tin nhắn:</span>
                            <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm whitespace-pre-wrap leading-relaxed border dark:border-gray-700">
                                {viewingMessage.message || '(Không có nội dung)'}
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            {viewingMessage.status === 'failed' && viewingMessage.message && viewingMessage.phone && (
                                <Button
                                    variant="primary"
                                    onClick={() => { handleRetry(viewingMessage); setViewingMessage(null); }}
                                    disabled={retryingId !== null}
                                >
                                    🔄 Gửi lại
                                </Button>
                            )}
                            <Button variant="secondary" onClick={() => setViewingMessage(null)}>Đóng</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
