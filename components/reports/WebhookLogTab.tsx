import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Table, SortConfig, Column } from '../common/Table';
import { Pagination } from '../common/Pagination';

const ITEMS_PER_PAGE = 20;

interface WebhookLogEntry {
    id: string;
    timestamp: string;
    status: 'success' | 'skipped' | 'error' | 'duplicate' | 'blocked';
    studentId: string;
    details: string;
    amount: number;
}

function getStatusBadge(status: WebhookLogEntry['status']) {
    const map = {
        success: { label: '✅ Thành công', cls: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
        skipped: { label: '⏭️ Bỏ qua', cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
        error: { label: '❌ Lỗi', cls: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
        duplicate: { label: '🔁 Trùng lặp', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
        blocked: { label: '🚫 Chặn', cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
    };
    const { label, cls } = map[status] || map.skipped;
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

function formatTimestamp(ts: string): string {
    if (!ts) return '—';
    try {
        const d = new Date(ts);
        return d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
    } catch { return ts; }
}

interface WebhookLogTabProps {
    startDate: string;
    endDate: string;
}

export const WebhookLogTab: React.FC<WebhookLogTabProps> = ({ startDate, endDate }) => {
    const [allLogs, setAllLogs] = useState<WebhookLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig<WebhookLogEntry> | null>({ key: 'timestamp', direction: 'descending' });

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Read token from localStorage (same as services/api.ts getHeaders)
            let token = '';
            const sessionStr = localStorage.getItem('educenter_user_session');
            if (sessionStr) {
                try { const session = JSON.parse(sessionStr); token = session.token || ''; } catch {}
            }
            
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            const res = await fetch('/api/webhook?action=logs', { headers });
            const data = await res.json();
            
            if (data.success) {
                setAllLogs(data.logs || []);
            } else {
                setError(data.error || 'Không thể tải nhật ký webhook');
            }
        } catch (e) {
            setError('Lỗi kết nối. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    // Logs filtered by date + search only (for stats cards)
    const dateFilteredLogs = useMemo(() => {
        return allLogs.filter((entry) => {
            const dateStr = entry.timestamp?.substring(0, 10) || '';
            const inRange = dateStr >= startDate && dateStr <= endDate;
            const matchSearch = !searchQuery || 
                entry.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
                entry.studentId.toLowerCase().includes(searchQuery.toLowerCase());
            return inRange && matchSearch;
        });
    }, [allLogs, startDate, endDate, searchQuery]);

    // Logs filtered by date + search + status (for table)
    const webhookLogs = useMemo(() => {
        if (statusFilter === 'all') return dateFilteredLogs;
        return dateFilteredLogs.filter(entry => entry.status === statusFilter);
    }, [dateFilteredLogs, statusFilter]);

    const sortedLogs = useMemo(() => {
        let sorted = [...webhookLogs];
        if (sortConfig) {
            sorted.sort((a, b) => {
                const aVal = a[sortConfig.key] || '';
                const bVal = b[sortConfig.key] || '';
                return sortConfig.direction === 'ascending'
                    ? String(aVal).localeCompare(String(bVal))
                    : String(bVal).localeCompare(String(aVal));
            });
        }
        return sorted;
    }, [webhookLogs, sortConfig]);

    const paginatedLogs = sortedLogs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const totalPages = Math.ceil(sortedLogs.length / ITEMS_PER_PAGE);

    const stats = useMemo(() => {
        const s = { success: 0, skipped: 0, error: 0, duplicate: 0, blocked: 0 };
        dateFilteredLogs.forEach(l => { s[l.status]++; });
        return s;
    }, [dateFilteredLogs]);

    const columns: Column<WebhookLogEntry>[] = [
        {
            header: 'Thời gian',
            accessor: (row: WebhookLogEntry) => formatTimestamp(row.timestamp),
            sortable: true,
            sortKey: 'timestamp',
        },
        {
            header: 'Trạng thái',
            accessor: (row: WebhookLogEntry) => getStatusBadge(row.status),
        },
        {
            header: 'Mã HS',
            accessor: 'studentId',
            sortable: true,
        },
        {
            header: 'Chi tiết',
            accessor: (row: WebhookLogEntry) => (
                <span className="text-xs text-slate-600 dark:text-slate-300 break-all">
                    {row.details}
                </span>
            ),
        },
    ];

    if (loading) {
        return (
            <div className="text-center py-12 text-slate-400">
                <div className="text-2xl mb-2 animate-spin">⏳</div>
                <p>Đang tải nhật ký webhook...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12 text-red-400">
                <div className="text-2xl mb-2">⚠️</div>
                <p>{error}</p>
                <button onClick={fetchLogs} className="mt-2 px-4 py-1 bg-primary text-white rounded text-sm">Thử lại</button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <button onClick={() => { setStatusFilter('all'); setCurrentPage(1); }} 
                    className={`p-3 rounded-lg text-center cursor-pointer transition ${statusFilter === 'all' ? 'ring-2 ring-primary' : ''} bg-slate-50 dark:bg-slate-800`}>
                    <div className="text-lg font-bold">{dateFilteredLogs.length}</div>
                    <div className="text-xs text-slate-500">Tổng</div>
                </button>
                <button onClick={() => { setStatusFilter(statusFilter === 'success' ? 'all' : 'success'); setCurrentPage(1); }}
                    className={`p-3 rounded-lg text-center cursor-pointer transition ${statusFilter === 'success' ? 'ring-2 ring-green-500' : ''} bg-green-50 dark:bg-green-900/20`}>
                    <div className="text-lg font-bold text-green-600">{stats.success}</div>
                    <div className="text-xs text-green-500">✅ Thành công</div>
                </button>
                <button onClick={() => { setStatusFilter(statusFilter === 'skipped' ? 'all' : 'skipped'); setCurrentPage(1); }}
                    className={`p-3 rounded-lg text-center cursor-pointer transition ${statusFilter === 'skipped' ? 'ring-2 ring-yellow-500' : ''} bg-yellow-50 dark:bg-yellow-900/20`}>
                    <div className="text-lg font-bold text-yellow-600">{stats.skipped}</div>
                    <div className="text-xs text-yellow-500">⏭️ Bỏ qua</div>
                </button>
                <button onClick={() => { setStatusFilter(statusFilter === 'duplicate' ? 'all' : 'duplicate'); setCurrentPage(1); }}
                    className={`p-3 rounded-lg text-center cursor-pointer transition ${statusFilter === 'duplicate' ? 'ring-2 ring-blue-500' : ''} bg-blue-50 dark:bg-blue-900/20`}>
                    <div className="text-lg font-bold text-blue-600">{stats.duplicate}</div>
                    <div className="text-xs text-blue-500">🔁 Trùng lặp</div>
                </button>
                <button onClick={() => { setStatusFilter(statusFilter === 'error' ? 'all' : 'error'); setCurrentPage(1); }}
                    className={`p-3 rounded-lg text-center cursor-pointer transition ${statusFilter === 'error' ? 'ring-2 ring-red-500' : ''} bg-red-50 dark:bg-red-900/20`}>
                    <div className="text-lg font-bold text-red-600">{stats.error + stats.blocked}</div>
                    <div className="text-xs text-red-500">❌ Lỗi/Chặn</div>
                </button>
            </div>

            {/* Search + Refresh */}
            <div className="flex gap-2">
                <input
                    type="text"
                    placeholder="🔍 Tìm theo mã HS, nội dung SMS..."
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm"
                />
                <button onClick={fetchLogs} className="px-3 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition" title="Làm mới">
                    🔄
                </button>
            </div>

            {/* Table */}
            {paginatedLogs.length > 0 ? (
                <>
                    <Table
                        data={paginatedLogs}
                        columns={columns}
                        sortConfig={sortConfig}
                        onSort={(key) => {
                            setSortConfig(prev => 
                                prev?.key === key 
                                    ? { key, direction: prev.direction === 'ascending' ? 'descending' : 'ascending' }
                                    : { key, direction: 'descending' }
                            );
                        }}
                    />
                    {totalPages > 1 && (
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                            totalItems={sortedLogs.length}
                            itemsPerPage={ITEMS_PER_PAGE}
                        />
                    )}
                </>
            ) : (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                    <div className="text-4xl mb-2">📋</div>
                    <p>Chưa có nhật ký webhook nào trong khoảng thời gian này.</p>
                    <p className="text-xs mt-1">Nhật ký sẽ tự động xuất hiện khi có giao dịch gửi đến webhook.</p>
                </div>
            )}
        </div>
    );
};
