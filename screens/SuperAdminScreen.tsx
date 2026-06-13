import React, { useState, useEffect } from 'react';
import { Button } from '../components/common/Button';
import { ConfirmationModal } from '../components/common/ConfirmationModal';

const LOCAL_STORAGE_KEY = 'educenter_superadmin_session';

const getToken = () => {
    try {
        const s = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
        return s.token || '';
    } catch { return ''; }
};

const apiCall = async (action: string, body?: any) => {
    const resp = await fetch('/api/centers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ action, ...body })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Lỗi');
    return data;
};

const loadCenters = async () => {
    const resp = await fetch('/api/centers', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (!resp.ok) throw new Error('Không có quyền');
    const data = await resp.json();
    return data.centers || [];
};

// --- Login Screen ---
const SuperAdminLogin: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            const resp = await fetch('/api/centers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'login', username, password })
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Đăng nhập thất bại');
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ token: data.token }));
            onLogin();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8 w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl mx-auto mb-4 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white">Super Admin</h1>
                    <p className="text-purple-200 text-sm mt-1">Quản trị hệ thống EduCenter Pro</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-purple-200">Tên đăng nhập</label>
                        <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                            className="w-full mt-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="superadmin" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-purple-200">Mật khẩu</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                            className="w-full mt-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="••••••••" required />
                    </div>
                    {error && <p className="text-red-400 text-sm bg-red-900/30 p-2 rounded">{error}</p>}
                    <button type="submit" disabled={isLoading}
                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50">
                        {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                    </button>
                </form>
                <div className="mt-6 text-center">
                    <a href="/login" className="text-purple-300 text-sm hover:text-white transition-colors">← Quay lại trang đăng nhập trung tâm</a>
                </div>
            </div>
        </div>
    );
};

// --- Dashboard ---
const SuperAdminDashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
    const [centers, setCenters] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newCenter, setNewCenter] = useState({ slug: '', name: '', address: '', phone: '', days: 30 });
    const [isCreating, setIsCreating] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [extendTarget, setExtendTarget] = useState<any>(null);
    const [extendDays, setExtendDays] = useState(30);
    const [message, setMessage] = useState('');
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' });
    const [credTarget, setCredTarget] = useState<any>(null);
    const [creds, setCreds] = useState<any>({ loginUsername: '', loginPassword: '', centerAdminPassword: '' });
    const [credTab, setCredTab] = useState<'set'|'admin'>('set');

    const refresh = async () => {
        setIsLoading(true);
        try {
            const list = await loadCenters();
            setCenters(list);
        } catch {
            onLogout();
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { refresh(); }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!/^[a-z0-9_]+$/.test(newCenter.slug)) {
            setMessage('❌ Mã chỉ chứa chữ thường, số, gạch dưới');
            return;
        }
        setIsCreating(true);
        try {
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + (newCenter.days || 30));
            await apiCall('create', { ...newCenter, expiresAt: expiry.toISOString() });
            setMessage(`✅ Đã tạo "${newCenter.name}" thành công!`);
            setNewCenter({ slug: '', name: '', address: '', phone: '', days: 30 });
            setShowCreate(false);
            refresh();
        } catch (err: any) {
            setMessage('❌ ' + err.message);
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await apiCall('delete', { slug: deleteTarget.slug });
            setMessage(`✅ Đã xóa "${deleteTarget.name}"`);
            refresh();
        } catch (err: any) {
            setMessage('❌ ' + err.message);
        }
        setDeleteTarget(null);
    };

    const handleExtend = async () => {
        if (!extendTarget) return;
        try {
            const result = await apiCall('extend', { slug: extendTarget.slug, days: extendDays });
            setMessage(`✅ ${result.message}`);
            refresh();
        } catch (err: any) {
            setMessage('❌ ' + err.message);
        }
        setExtendTarget(null);
    };

    const handleToggleStatus = async (center: any) => {
        const newStatus = center.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
        try {
            await apiCall('toggle_status', { slug: center.slug, status: newStatus });
            setMessage(`✅ ${center.name}: ${newStatus === 'ACTIVE' ? 'Đã mở khóa' : 'Đã khóa'}`);
            refresh();
        } catch (err: any) {
            setMessage('❌ ' + err.message);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwords.newPass !== passwords.confirm) {
            setMessage('❌ Mật khẩu mới không khớp');
            return;
        }
        try {
            await apiCall('change_password', { currentPassword: passwords.current, newPassword: passwords.newPass });
            setMessage('✅ Đã đổi mật khẩu Super Admin');
            setShowChangePassword(false);
            setPasswords({ current: '', newPass: '', confirm: '' });
        } catch (err: any) {
            setMessage('❌ ' + err.message);
        }
    };

    const handleSetCredentials = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!creds.loginUsername || !creds.loginPassword) {
            setMessage('❌ Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu');
            return;
        }
        try {
            await apiCall('set_credentials', { slug: credTarget.slug, ...creds });
            setMessage(`✅ Đã cập nhật tài khoản cho "${credTarget.name}": tên đăng nhập = ${creds.loginUsername}`);
            setCredTarget(null);
            setCreds({ loginUsername: '', loginPassword: '' });
            refresh();
        } catch (err: any) {
            setMessage('❌ ' + err.message);
        }
    };

    const handleRemoveCredentials = async () => {
        if (!credTarget) return;
        try {
            await apiCall('remove_credentials', { slug: credTarget.slug });
            setMessage(`✅ Đã xóa tài khoản đăng nhập của "${credTarget.name}"`);
            setCredTarget(null);
            refresh();
        } catch (err: any) {
            setMessage('❌ ' + err.message);
        }
    };

    const handleChangeCenterAdminPwd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!creds.centerAdminPassword) {
            setMessage('❌ Vui lòng nhập mật khẩu mới');
            return;
        }
        try {
            await apiCall('change_center_admin_password', { slug: credTarget.slug, newAdminPassword: creds.centerAdminPassword });
            setMessage(`✅ Đã đổi mật khẩu quản trị nội bộ cho "${credTarget.name}"`);
            setCredTarget(null);
            setCreds({ loginUsername: '', loginPassword: '' });
            refresh();
        } catch (err: any) {
            setMessage('❌ ' + err.message);
        }
    };

    const getStatusBadge = (center: any) => {
        if (center.effectiveStatus === 'EXPIRED') return { text: '⏰ Hết hạn', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
        if (center.status === 'LOCKED') return { text: '🔒 Đã khóa', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' };
        return { text: '● Hoạt động', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
    };

    const getDaysLeft = (expiresAt: string) => {
        if (!expiresAt) return '∞';
        const diff = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return diff;
    };

    const activeCenters = centers.filter(c => c.effectiveStatus !== 'EXPIRED' && c.status !== 'LOCKED').length;
    const expiredCenters = centers.filter(c => c.effectiveStatus === 'EXPIRED').length;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-800 via-purple-700 to-pink-700 text-white">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">Super Admin Dashboard</h1>
                            <p className="text-purple-200 text-xs">Quản trị hệ thống EduCenter Pro</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowChangePassword(!showChangePassword)}
                            className="px-3 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors">🔑 Đổi mật khẩu</button>
                        <button onClick={onLogout}
                            className="px-3 py-2 text-sm bg-red-500/20 hover:bg-red-500/40 rounded-lg transition-colors">Đăng xuất</button>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border dark:border-slate-700">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Tổng trung tâm</p>
                        <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">{centers.length}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border dark:border-slate-700">
                        <p className="text-sm text-green-600">Đang hoạt động</p>
                        <p className="text-3xl font-bold text-green-600 mt-1">{activeCenters}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border dark:border-slate-700">
                        <p className="text-sm text-red-500">Hết hạn / Khóa</p>
                        <p className="text-3xl font-bold text-red-500 mt-1">{expiredCenters + centers.filter(c => c.status === 'LOCKED').length}</p>
                    </div>
                </div>

                {/* Message */}
                {message && (
                    <div className={`p-3 rounded-lg text-sm ${message.startsWith('✅') ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
                        {message}
                        <button onClick={() => setMessage('')} className="float-right font-bold">×</button>
                    </div>
                )}

                {/* Change Password */}
                {showChangePassword && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border dark:border-slate-700">
                        <h3 className="font-bold text-lg mb-4">🔑 Đổi mật khẩu Super Admin</h3>
                        <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
                            <input type="password" value={passwords.current} onChange={e => setPasswords({...passwords, current: e.target.value})}
                                placeholder="Mật khẩu hiện tại" className="form-input" required />
                            <input type="password" value={passwords.newPass} onChange={e => setPasswords({...passwords, newPass: e.target.value})}
                                placeholder="Mật khẩu mới" className="form-input" required />
                            <input type="password" value={passwords.confirm} onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                                placeholder="Xác nhận mật khẩu mới" className="form-input" required />
                            <div className="flex gap-2">
                                <Button type="submit">Lưu</Button>
                                <Button type="button" variant="secondary" onClick={() => setShowChangePassword(false)}>Hủy</Button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Create Form */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700">
                    <div className="flex items-center justify-between p-5 border-b dark:border-slate-700">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">Danh sách Trung tâm</h2>
                        <Button onClick={() => setShowCreate(!showCreate)}>
                            {showCreate ? '✕ Hủy' : '+ Tạo trung tâm mới'}
                        </Button>
                    </div>

                    {showCreate && (
                        <form onSubmit={handleCreate} className="p-5 bg-blue-50 dark:bg-blue-900/10 border-b dark:border-slate-700 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Mã trung tâm (slug) *</label>
                                    <input type="text" value={newCenter.slug}
                                        onChange={e => setNewCenter({...newCenter, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')})}
                                        className="form-input" placeholder="vd: abc_edu" required />
                                    <p className="text-xs text-gray-500 mt-1">Chữ thường, số, gạch dưới. Không đổi được.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Tên trung tâm *</label>
                                    <input type="text" value={newCenter.name}
                                        onChange={e => setNewCenter({...newCenter, name: e.target.value})}
                                        className="form-input" placeholder="VD: Trung tâm ABC" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Địa chỉ</label>
                                    <input type="text" value={newCenter.address}
                                        onChange={e => setNewCenter({...newCenter, address: e.target.value})}
                                        className="form-input" placeholder="Địa chỉ" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Thời hạn (ngày)</label>
                                    <select value={newCenter.days} onChange={e => setNewCenter({...newCenter, days: Number(e.target.value)})} className="form-input">
                                        <option value={7}>7 ngày (dùng thử)</option>
                                        <option value={30}>30 ngày</option>
                                        <option value={90}>90 ngày (3 tháng)</option>
                                        <option value={180}>180 ngày (6 tháng)</option>
                                        <option value={365}>365 ngày (1 năm)</option>
                                        <option value={3650}>10 năm (vĩnh viễn)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Hủy</Button>
                                <Button type="submit" isLoading={isCreating}>Tạo Trung tâm</Button>
                            </div>
                        </form>
                    )}

                    {/* Centers List */}
                    <div className="divide-y dark:divide-slate-700">
                        {isLoading ? (
                            <div className="p-8 text-center text-gray-500">Đang tải...</div>
                        ) : centers.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">Chưa có trung tâm nào.</div>
                        ) : centers.map(center => {
                            const badge = getStatusBadge(center);
                            const daysLeft = getDaysLeft(center.expiresAt);
                            return (
                                <div key={center.id} className="p-5 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-bold text-lg text-gray-800 dark:text-white">{center.name}</h3>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.text}</span>
                                                <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{center.slug}</code>
                                            </div>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-500 dark:text-gray-400">
                                                {center.address && <span>📍 {center.address}</span>}
                                                <span>📅 Tạo: {new Date(center.createdAt).toLocaleDateString('vi-VN')}</span>
                                                <span className={typeof daysLeft === 'number' && daysLeft <= 7 ? 'text-red-500 font-semibold' : ''}>
                                                    ⏳ {typeof daysLeft === 'number' ? (daysLeft > 0 ? `Còn ${daysLeft} ngày` : 'Đã hết hạn') : 'Vĩnh viễn'}
                                                </span>
                                                {center.expiresAt && <span>🗓️ Hết hạn: {new Date(center.expiresAt).toLocaleDateString('vi-VN')}</span>}
                                            </div>
                                            <div className="mt-1 text-xs">
                                                {center.loginUsername ? (
                                                    <span className="text-emerald-600 dark:text-emerald-400">🔑 Tài khoản: <code className="bg-emerald-100 dark:bg-emerald-900/30 px-1 rounded">{center.loginUsername}</code></span>
                                                ) : (
                                                    <span className="text-orange-500">⚠️ Chưa cấp tài khoản đăng nhập</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 flex-shrink-0 flex-wrap">
                                            <button onClick={() => { setCredTarget(center); setCreds({ loginUsername: center.loginUsername || '', loginPassword: '' }); }}
                                                className="px-3 py-1.5 text-sm bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors">
                                                🔑 Tài khoản
                                            </button>
                                            <button onClick={() => { setExtendTarget(center); setExtendDays(30); }}
                                                className="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                                                ⏳ Gia hạn
                                            </button>
                                            <button onClick={() => handleToggleStatus(center)}
                                                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${center.status === 'ACTIVE' 
                                                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200'
                                                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200'}`}>
                                                {center.status === 'ACTIVE' ? '🔒 Khóa' : '🔓 Mở'}
                                            </button>
                                            <button onClick={() => setDeleteTarget(center)}
                                                className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">
                                                🗑️ Xóa
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Extend Modal */}
            {extendTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
                        <h3 className="text-lg font-bold mb-4">⏳ Gia hạn: {extendTarget.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            Hết hạn hiện tại: {extendTarget.expiresAt ? new Date(extendTarget.expiresAt).toLocaleDateString('vi-VN') : 'Chưa có'}
                        </p>
                        <div className="space-y-3">
                            <label className="block text-sm font-medium">Gia hạn thêm</label>
                            <select value={extendDays} onChange={e => setExtendDays(Number(e.target.value))} className="form-input">
                                <option value={7}>7 ngày</option>
                                <option value={30}>30 ngày (1 tháng)</option>
                                <option value={90}>90 ngày (3 tháng)</option>
                                <option value={180}>180 ngày (6 tháng)</option>
                                <option value={365}>365 ngày (1 năm)</option>
                                <option value={3650}>10 năm (vĩnh viễn)</option>
                            </select>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <Button variant="secondary" onClick={() => setExtendTarget(null)}>Hủy</Button>
                            <Button onClick={handleExtend}>Xác nhận gia hạn</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Credentials Modal */}
            {credTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
                        <h3 className="text-lg font-bold mb-1">🔑 Quản lý tài khoản: {credTarget.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Mã: <code>{credTarget.slug}</code></p>

                        {/* Tabs */}
                        <div className="flex border-b dark:border-slate-600 mb-4">
                            <button onClick={() => setCredTab('set')}
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${credTab === 'set' ? 'border-purple-500 text-purple-600 dark:text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                Tài khoản đăng nhập
                            </button>
                            <button onClick={() => setCredTab('admin')}
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${credTab === 'admin' ? 'border-purple-500 text-purple-600 dark:text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                Mật khẩu Admin nội bộ
                            </button>
                        </div>

                        {credTab === 'set' && (
                            <>
                                {credTarget.loginUsername && (
                                    <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm">
                                        <span className="text-emerald-700 dark:text-emerald-300">🔑 Hiện tại: <strong>{credTarget.loginUsername}</strong></span>
                                        <button onClick={handleRemoveCredentials}
                                            className="ml-3 text-red-500 hover:text-red-700 text-xs underline">Xóa tài khoản</button>
                                    </div>
                                )}
                                <form onSubmit={handleSetCredentials} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">{credTarget.loginUsername ? 'Đổi tên đăng nhập' : 'Tên đăng nhập mới'}</label>
                                        <input type="text" value={creds.loginUsername}
                                            onChange={e => setCreds({...creds, loginUsername: e.target.value})}
                                            className="form-input" placeholder="VD: trungtam_abc" required />
                                        <p className="text-xs text-gray-500 mt-1">Duy nhất, không trùng với trung tâm khác</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">{credTarget.loginUsername ? 'Mật khẩu mới' : 'Mật khẩu'}</label>
                                        <input type="text" value={creds.loginPassword}
                                            onChange={e => setCreds({...creds, loginPassword: e.target.value})}
                                            className="form-input" placeholder="Nhập mật khẩu" required />
                                    </div>
                                    <div className="flex justify-end gap-3">
                                        <Button type="button" variant="secondary" onClick={() => setCredTarget(null)}>Hủy</Button>
                                        <Button type="submit">{credTarget.loginUsername ? 'Cập nhật' : 'Cấp tài khoản'}</Button>
                                    </div>
                                </form>
                            </>
                        )}

                        {credTab === 'admin' && (
                            <>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                    Đổi mật khẩu Admin bên trong trung tâm (mật khẩu mà trung tâm dùng để đăng nhập với tài khoản "admin" nội bộ).
                                </p>
                                <form onSubmit={handleChangeCenterAdminPwd} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Mật khẩu Admin mới</label>
                                        <input type="text" value={creds.centerAdminPassword || ''}
                                            onChange={e => setCreds({...creds, centerAdminPassword: e.target.value})}
                                            className="form-input" placeholder="Nhập mật khẩu mới" required />
                                    </div>
                                    <div className="flex justify-end gap-3">
                                        <Button type="button" variant="secondary" onClick={() => setCredTarget(null)}>Hủy</Button>
                                        <Button type="submit">Đổi mật khẩu</Button>
                                    </div>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            <ConfirmationModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title={`Xóa trung tâm "${deleteTarget?.name}"?`}
                message={`Thao tác này sẽ xóa đăng ký trung tâm "${deleteTarget?.slug}". Dữ liệu (collection) sẽ KHÔNG bị xóa.`}
                confirmationKeyword="XÓA"
                confirmButtonVariant="danger"
            />
        </div>
    );
};

// --- Main Component ---
export const SuperAdminScreen: React.FC = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const token = getToken();
        if (token) setIsLoggedIn(true);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        setIsLoggedIn(false);
    };

    if (!isLoggedIn) return <SuperAdminLogin onLogin={() => setIsLoggedIn(true)} />;
    return <SuperAdminDashboard onLogout={handleLogout} />;
};
