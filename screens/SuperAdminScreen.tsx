import React, { useState, useEffect } from 'react';
import { Button } from '../components/common/Button';
import { ConfirmationModal } from '../components/common/ConfirmationModal';

const LOCAL_STORAGE_KEY = 'educenter_superadmin_session';
const SA_DRIVE_TOKEN_KEY = 'educenter_sa_drive_token';
const SA_AUTO_BACKUP_KEY = 'educenter_sa_last_auto_backup';
const SA_CLIENT_ID = '182151372613-mj0tk721j82m8kgog01bq3mt1id0hj0u.apps.googleusercontent.com';
const SA_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

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
const getVNDateStr = () => {
    const now = new Date();
    const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(vn.getUTCHours())}-${pad(vn.getUTCMinutes())}_${pad(vn.getUTCDate())}-${pad(vn.getUTCMonth()+1)}-${vn.getUTCFullYear()}`;
};

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
    const [credTab, setCredTab] = useState<'set'|'admin'|'accounts'>('set');
    const [centerAccounts, setCenterAccounts] = useState<any[]>([]);
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [restoreConfirm, setRestoreConfirm] = useState<{open:boolean, data:any, source:string}>({open:false, data:null, source:''});

    // === Google Drive Backup State ===
    const [driveToken, setDriveToken] = useState<string | null>(localStorage.getItem(SA_DRIVE_TOKEN_KEY));
    const [driveTokenClient, setDriveTokenClient] = useState<any>(null);
    const [isGisReady, setIsGisReady] = useState(false);
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [showDriveManager, setShowDriveManager] = useState(false);
    const [driveFiles, setDriveFiles] = useState<{id:string,name:string,modifiedTime?:string}[]>([]);
    const [isDriveLoading, setIsDriveLoading] = useState(false);
    const [driveFileToDelete, setDriveFileToDelete] = useState<{id:string,name:string}|null>(null);

    // Init Google Identity Services
    useEffect(() => {
        if ((window as any).google?.accounts) { setIsGisReady(true); return; }
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true; script.defer = true;
        script.onload = () => setIsGisReady(true);
        document.body.appendChild(script);
    }, []);

    useEffect(() => {
        if (isGisReady && (window as any).google) {
            const client = (window as any).google.accounts.oauth2.initTokenClient({
                client_id: SA_CLIENT_ID, scope: SA_DRIVE_SCOPE,
                callback: (resp: any) => {
                    if (resp?.access_token) {
                        setDriveToken(resp.access_token);
                        localStorage.setItem(SA_DRIVE_TOKEN_KEY, resp.access_token);
                        setMessage('✅ Đã kết nối Google Drive!');
                    }
                },
            });
            setDriveTokenClient(client);
        }
    }, [isGisReady]);

    const handleDriveConnect = () => {
        if (driveTokenClient) driveTokenClient.requestAccessToken();
        else setMessage('❌ Lỗi khởi tạo Google. Vui lòng tải lại trang.');
    };

    const handleDriveDisconnect = () => {
        if (driveToken) {
            (window as any).google?.accounts?.oauth2?.revoke?.(driveToken, () => {});
        }
        setDriveToken(null);
        localStorage.removeItem(SA_DRIVE_TOKEN_KEY);
        setMessage('✅ Đã ngắt kết nối Google Drive.');
    };

    const doBackupToDrive = async (isAuto = false) => {
        if (!driveToken) { setMessage('❌ Chưa kết nối Google Drive.'); return; }
        setIsBackingUp(true);
        if (!isAuto) setMessage('⏳ Đang sao lưu toàn hệ thống lên Google Drive...');
        try {
            const backupData = await apiCall('backup_all', {});
            const fileContent = JSON.stringify(backupData, null, 2);
            const blob = new Blob([fileContent], { type: 'application/json' });
            const dateStr = getVNDateStr();
            const fileName = `EduCenterPro_FULL_${isAuto ? 'Auto_' : ''}Backup_${dateStr}.json`;
            const now = new Date();

            const metadata = { name: fileName, mimeType: 'application/json', parents: ['root'] };
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', blob);

            const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST', headers: { 'Authorization': `Bearer ${driveToken}` }, body: form,
            });
            if (resp.ok) {
                localStorage.setItem(SA_AUTO_BACKUP_KEY, now.toISOString());
                setMessage(`✅ ${isAuto ? 'Tự động sao' : 'Sao'} lưu thành công! (${backupData.centersCount} trung tâm, file: ${fileName})`);
            } else {
                const errText = await resp.text();
                if (errText.includes('invalid_grant') || errText.includes('Invalid Credentials')) {
                    localStorage.removeItem(SA_DRIVE_TOKEN_KEY); setDriveToken(null);
                    setMessage('❌ Token Drive hết hạn. Vui lòng kết nối lại.');
                } else throw new Error(errText);
            }
        } catch (err: any) {
            console.error('Drive Backup Error:', err);
            setMessage('❌ Sao lưu Drive thất bại: ' + (err.message || 'Unknown'));
        } finally { setIsBackingUp(false); }
    };

    const handleDownloadBackup = async () => {
        setMessage('⏳ Đang tải dữ liệu sao lưu...');
        try {
            const backupData = await apiCall('backup_all', {});
            const dataStr = JSON.stringify(backupData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `EduCenterPro_FULL_Backup_${getVNDateStr()}.json`;
            document.body.appendChild(link); link.click();
            document.body.removeChild(link); URL.revokeObjectURL(url);
            setMessage(`✅ Đã tải về bản sao lưu (${backupData.centersCount} trung tâm)`);
        } catch (err: any) { setMessage('❌ Tải sao lưu thất bại: ' + err.message); }
    };

    // Auto-backup weekly
    useEffect(() => {
        if (!driveToken) return;
        const lastBackup = localStorage.getItem(SA_AUTO_BACKUP_KEY);
        const lastDate = lastBackup ? new Date(lastBackup) : null;
        const daysSince = lastDate ? Math.floor((Date.now() - lastDate.getTime()) / (1000*60*60*24)) : 999;
        if (daysSince >= 7) {
            const timer = setTimeout(() => doBackupToDrive(true), 5000);
            return () => clearTimeout(timer);
        }
    }, [driveToken]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleOpenDriveManager = async () => {
        if (!driveToken) { setMessage('❌ Chưa kết nối Google Drive.'); return; }
        setShowDriveManager(true); setIsDriveLoading(true); setDriveFiles([]);
        try {
            const resp = await fetch(
                "https://www.googleapis.com/drive/v3/files?q=mimeType='application/json' and name contains 'EduCenterPro_' and trashed=false&spaces=drive&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc",
                { headers: { 'Authorization': `Bearer ${driveToken}` } }
            );
            if (!resp.ok) throw new Error('Không thể tải danh sách');
            const data = await resp.json();
            setDriveFiles(data.files || []);
        } catch (err: any) {
            setMessage('❌ ' + err.message);
        } finally { setIsDriveLoading(false); }
    };

    const handleDriveDownload = async (fileId: string, fileName: string) => {
        if (!driveToken) return;
        try {
            const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: { 'Authorization': `Bearer ${driveToken}` },
            });
            if (!resp.ok) throw new Error('Tải thất bại');
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a'); link.href = url; link.download = fileName;
            document.body.appendChild(link); link.click();
            document.body.removeChild(link); URL.revokeObjectURL(url);
        } catch (err: any) { setMessage('❌ ' + err.message); }
    };

    const handleDriveDeleteConfirm = async () => {
        if (!driveFileToDelete || !driveToken) return;
        try {
            const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileToDelete.id}`, {
                method: 'DELETE', headers: { 'Authorization': `Bearer ${driveToken}` },
            });
            if (resp.ok) {
                setDriveFiles(prev => prev.filter(f => f.id !== driveFileToDelete.id));
                setMessage('✅ Đã xóa file sao lưu.');
            } else throw new Error('Xóa thất bại');
        } catch (err: any) { setMessage('❌ ' + err.message); }
        finally { setDriveFileToDelete(null); }
    };

    // === RESTORE FUNCTIONS ===
    const handleRestoreFromFile = () => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.json';
        input.onchange = async (e: any) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                if (!data.centersData && !data.students) {
                    setMessage('❌ File không đúng định dạng sao lưu EduCenterPro.'); return;
                }
                setRestoreConfirm({open: true, data, source: `file "${file.name}"`});
            } catch { setMessage('❌ File JSON không hợp lệ.'); }
        };
        input.click();
    };

    const handleRestoreFromDrive = async (fileId: string, fileName: string) => {
        if (!driveToken) return;
        setMessage('⏳ Đang tải file từ Drive...');
        try {
            const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: { 'Authorization': `Bearer ${driveToken}` },
            });
            if (!resp.ok) throw new Error('Tải thất bại');
            const data = await resp.json();
            if (!data.centersData && !data.students) {
                setMessage('❌ File không đúng định dạng sao lưu.'); return;
            }
            setRestoreConfirm({open: true, data, source: `Drive "${fileName}"`});
        } catch (err: any) { setMessage('❌ ' + err.message); }
    };

    const handleConfirmRestore = async () => {
        if (!restoreConfirm.data) return;
        setIsRestoring(true);
        setMessage('⏳ Đang khôi phục dữ liệu...');
        try {
            const result = await apiCall('restore_all', { backupData: restoreConfirm.data });
            setMessage(`✅ Khôi phục thành công! ${result.message || ''}`);
            refresh();
        } catch (err: any) {
            setMessage('❌ Khôi phục thất bại: ' + err.message);
        } finally {
            setIsRestoring(false);
            setRestoreConfirm({open: false, data: null, source: ''});
        }
    };

    const lastAutoBackupStr = localStorage.getItem(SA_AUTO_BACKUP_KEY);

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

    const loadCenterAccounts = async (slug: string) => {
        setIsLoadingAccounts(true);
        try {
            const result = await apiCall('get_center_accounts', { slug });
            setCenterAccounts(result.accounts || []);
        } catch (err: any) {
            setMessage('❌ ' + err.message);
            setCenterAccounts([]);
        } finally {
            setIsLoadingAccounts(false);
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
                    <div className="flex gap-2 flex-wrap">
                        {driveToken ? (
                            <button onClick={handleDriveDisconnect}
                                className="px-3 py-2 text-sm bg-green-500/20 hover:bg-green-500/40 rounded-lg transition-colors">☁️ Drive ✓</button>
                        ) : (
                            <button onClick={handleDriveConnect}
                                className="px-3 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors">☁️ Kết nối Drive</button>
                        )}
                        <button onClick={() => setShowChangePassword(!showChangePassword)}
                            className="px-3 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors">🔑 Đổi mật khẩu</button>
                        <button onClick={onLogout}
                            className="px-3 py-2 text-sm bg-red-500/20 hover:bg-red-500/40 rounded-lg transition-colors">Đăng xuất</button>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border dark:border-slate-700">
                        <p className="text-sm text-purple-500">Sao lưu gần nhất</p>
                        <p className="text-sm font-bold text-purple-600 dark:text-purple-400 mt-1">{lastAutoBackupStr ? new Date(lastAutoBackupStr).toLocaleDateString('vi-VN', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : 'Chưa có'}</p>
                    </div>
                </div>

                {/* Backup Section */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 p-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">💾 Sao lưu Hệ thống</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Sao lưu toàn bộ dữ liệu của tất cả trung tâm ({centers.length} TT)</p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <button onClick={handleDownloadBackup} disabled={isBackingUp || isRestoring}
                                className="px-3 py-2 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50">
                                📥 Tải về máy
                            </button>
                            <button onClick={handleRestoreFromFile} disabled={isBackingUp || isRestoring}
                                className="px-3 py-2 text-sm bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-50">
                                {isRestoring ? '⏳ Đang khôi phục...' : '🔄 Khôi phục từ file'}
                            </button>
                            <button onClick={() => doBackupToDrive(false)} disabled={isBackingUp || !driveToken || isRestoring}
                                className="px-3 py-2 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50"
                                title={!driveToken ? 'Kết nối Google Drive trước' : ''}>
                                {isBackingUp ? '⏳ Đang sao lưu...' : '☁️ Lưu lên Drive'}
                            </button>
                            <button onClick={handleOpenDriveManager} disabled={!driveToken}
                                className="px-3 py-2 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50">
                                📋 Quản lý bản sao lưu
                            </button>
                        </div>
                    </div>
                    {!driveToken && (
                        <p className="mt-3 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                            ⚠️ Chưa kết nối Google Drive. Bấm "☁️ Kết nối Drive" ở thanh trên để kích hoạt sao lưu tự động hàng tuần.
                        </p>
                    )}
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

                {/* === CMS CONTENT EDITOR === */}
                <SiteContentEditor />
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
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[85vh] overflow-y-auto">
                        <h3 className="text-lg font-bold mb-1">🔑 Quản lý tài khoản: {credTarget.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Mã: <code>{credTarget.slug}</code></p>

                        {/* Tabs */}
                        <div className="flex border-b dark:border-slate-600 mb-4 overflow-x-auto">
                            <button onClick={() => setCredTab('set')}
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${credTab === 'set' ? 'border-purple-500 text-purple-600 dark:text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                🔑 Tài khoản đăng nhập
                            </button>
                            <button onClick={() => { setCredTab('accounts' as any); loadCenterAccounts(credTarget.slug); }}
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${credTab === 'accounts' as any ? 'border-purple-500 text-purple-600 dark:text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                👥 Tất cả tài khoản
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

                        {(credTab as any) === 'accounts' && (
                            <CenterAccountsManager 
                                slug={credTarget.slug} 
                                accounts={centerAccounts}
                                isLoading={isLoadingAccounts}
                                onRefresh={() => loadCenterAccounts(credTarget.slug)}
                                onMessage={setMessage}
                            />
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

            {/* Drive Manager Modal */}
            {showDriveManager && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">📋 Bản sao lưu trên Google Drive</h3>
                            <button onClick={() => setShowDriveManager(false)} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
                        </div>
                        {isDriveLoading ? (
                            <div className="text-center py-8 text-gray-500">Đang tải...</div>
                        ) : driveFiles.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">Chưa có bản sao lưu nào trên Drive.</div>
                        ) : (
                            <div className="divide-y dark:divide-slate-700">
                                {driveFiles.map(f => (
                                    <div key={f.id} className="py-3 flex items-center justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{f.name}</p>
                                            {f.modifiedTime && <p className="text-xs text-gray-500">{new Date(f.modifiedTime).toLocaleString('vi-VN')}</p>}
                                        </div>
                                        <div className="flex gap-2 flex-shrink-0">
                                            <button onClick={() => handleDriveDownload(f.id, f.name)}
                                                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded hover:bg-blue-200">📥 Tải</button>
                                            <button onClick={() => handleRestoreFromDrive(f.id, f.name)}
                                                className="px-2 py-1 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 rounded hover:bg-amber-200">🔄 Khôi phục</button>
                                            <button onClick={() => setDriveFileToDelete(f)}
                                                className="px-2 py-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded hover:bg-red-200">🗑️</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Drive File Delete Confirm */}
            <ConfirmationModal
                isOpen={!!driveFileToDelete}
                onClose={() => setDriveFileToDelete(null)}
                onConfirm={handleDriveDeleteConfirm}
                title="Xóa file sao lưu?"
                message={`Bạn có chắc muốn xóa "${driveFileToDelete?.name}" khỏi Google Drive?`}
                confirmButtonVariant="danger"
            />

            {/* Restore Confirmation Modal */}
            <ConfirmationModal
                isOpen={restoreConfirm.open}
                onClose={() => setRestoreConfirm({open:false, data:null, source:''})}
                onConfirm={handleConfirmRestore}
                title="⚠️ Xác nhận Khôi phục dữ liệu"
                message={`Bạn sắp khôi phục dữ liệu từ ${restoreConfirm.source}. Thao tác này sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại của tất cả trung tâm. Hãy chắc chắn đã sao lưu trước khi tiếp tục!`}
                confirmationKeyword="KHÔI PHỤC"
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

// --- CenterAccountsManager Component ---
const CenterAccountsManager: React.FC<{
    slug: string;
    accounts: any[];
    isLoading: boolean;
    onRefresh: () => void;
    onMessage: (msg: string) => void;
}> = ({ slug, accounts, isLoading, onRefresh, onMessage }) => {
    const [editingAccount, setEditingAccount] = useState<any>(null);
    const [editForm, setEditForm] = useState({ newId: '', newPassword: '', newRole: '' });
    const [isSaving, setIsSaving] = useState(false);

    const handleEdit = (acc: any) => {
        setEditingAccount(acc);
        setEditForm({ newId: acc.id, newPassword: '', newRole: acc.role });
    };

    const handleSave = async () => {
        if (!editingAccount) return;
        setIsSaving(true);
        try {
            const payload: any = { slug, accountId: editingAccount.id, accountType: editingAccount.type };
            if (editForm.newPassword) payload.newPassword = editForm.newPassword;
            if (editForm.newRole !== editingAccount.role) payload.newRole = editForm.newRole;
            if (editForm.newId !== editingAccount.id) payload.newId = editForm.newId;

            if (!payload.newPassword && !payload.newRole && !payload.newId) {
                onMessage('❌ Không có thay đổi nào');
                setIsSaving(false);
                return;
            }

            const result = await apiCall('update_center_account', payload);
            onMessage(`✅ ${result.message}`);
            setEditingAccount(null);
            onRefresh();
        } catch (err: any) {
            onMessage('❌ ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const roleOptions = [
        { value: 'TEACHER', label: 'Giáo viên' },
        { value: 'MANAGER', label: 'Quản lý' },
        { value: 'ACCOUNTANT', label: 'Kế toán' },
    ];

    if (isLoading) {
        return <div className="text-center py-8 text-gray-500">Đang tải danh sách tài khoản...</div>;
    }

    if (accounts.length === 0) {
        return <div className="text-center py-8 text-gray-500">Trung tâm chưa có tài khoản GV/NV nào.</div>;
    }

    return (
        <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
                Tổng cộng <strong>{accounts.length}</strong> tài khoản GV/NV
            </p>

            {/* Editing form */}
            {editingAccount && (
                <div className="p-4 border-2 border-purple-300 dark:border-purple-700 rounded-lg bg-purple-50/50 dark:bg-purple-900/20 space-y-3">
                    <h4 className="font-semibold text-sm">✏️ Sửa: {editingAccount.name} ({editingAccount.typeLabel})</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-medium mb-1">Mã đăng nhập</label>
                            <input type="text" value={editForm.newId}
                                onChange={e => setEditForm({...editForm, newId: e.target.value})}
                                className="form-input text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1">Mật khẩu mới</label>
                            <input type="text" value={editForm.newPassword}
                                onChange={e => setEditForm({...editForm, newPassword: e.target.value})}
                                className="form-input text-sm" placeholder="Để trống = giữ nguyên" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1">Quyền</label>
                            <select value={editForm.newRole}
                                onChange={e => setEditForm({...editForm, newRole: e.target.value})}
                                className="form-input text-sm">
                                {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setEditingAccount(null)}>Hủy</Button>
                        <Button size="sm" onClick={handleSave} isLoading={isSaving}>Lưu thay đổi</Button>
                    </div>
                </div>
            )}

            {/* Accounts list */}
            <div className="divide-y dark:divide-slate-700">
                {accounts.map((acc: any) => (
                    <div key={`${acc.type}-${acc.id}`} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm truncate">{acc.name}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    acc.type === 'teacher' 
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                }`}>{acc.typeLabel}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    acc.status === 'ACTIVE'
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                                }`}>{acc.status === 'ACTIVE' ? 'Hoạt động' : 'Ngưng'}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                                <span>🔑 Mã: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{acc.id}</code></span>
                                <span>👤 Quyền: {acc.role}</span>
                                <span>{acc.hasPassword ? '🔒 Có MK' : '🔓 Chưa có MK'}</span>
                            </div>
                        </div>
                        <button onClick={() => handleEdit(acc)}
                            className="px-3 py-1.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 transition-colors whitespace-nowrap">
                            ✏️ Sửa
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ===== SITE CONTENT EDITOR (CMS) =====
const SiteContentEditor: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'landing' | 'guide'>('landing');
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    
    // Landing content state
    const [landingContent, setLandingContent] = useState<string>('');
    // Guide content state
    const [guideContent, setGuideContent] = useState<string>('');

    const loadContent = async () => {
        setIsLoading(true);
        try {
            const resp = await fetch('/api/centers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_site_content' })
            });
            const data = await resp.json();
            if (data.content) {
                if (data.content.landing) setLandingContent(JSON.stringify(data.content.landing, null, 2));
                if (data.content.guide) setGuideContent(JSON.stringify(data.content.guide, null, 2));
            }
        } catch (err: any) {
            setMessage('❌ Lỗi tải nội dung: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpen = () => {
        if (!isOpen) loadContent();
        setIsOpen(!isOpen);
    };

    const handleSave = async () => {
        setIsSaving(true);
        setMessage('');
        try {
            let landing = null;
            let guide = null;
            
            if (landingContent.trim()) {
                try { landing = JSON.parse(landingContent); } 
                catch { setMessage('❌ Nội dung trang chủ JSON không hợp lệ'); setIsSaving(false); return; }
            }
            if (guideContent.trim()) {
                try { guide = JSON.parse(guideContent); }
                catch { setMessage('❌ Nội dung hướng dẫn JSON không hợp lệ'); setIsSaving(false); return; }
            }

            const resp = await fetch('/api/centers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify({ action: 'update_site_content', landing, guide })
            });
            const data = await resp.json();
            if (resp.ok) {
                setMessage('✅ Đã lưu nội dung thành công! Trang chủ & hướng dẫn đã cập nhật.');
            } else {
                setMessage('❌ ' + (data.error || 'Lỗi lưu'));
            }
        } catch (err: any) {
            setMessage('❌ Lỗi: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleLoadDefaults = async (tab: 'landing' | 'guide') => {
        if (tab === 'landing') {
            const { LANDING_DEFAULTS } = await import('./LandingPage');
            setLandingContent(JSON.stringify(LANDING_DEFAULTS, null, 2));
            setMessage('✅ Đã tải nội dung mặc định trang chủ. Nhớ bấm Lưu.');
        } else {
            const { GUIDE_DEFAULTS } = await import('./GuidePage');
            setGuideContent(JSON.stringify(GUIDE_DEFAULTS, null, 2));
            setMessage('✅ Đã tải nội dung mặc định hướng dẫn. Nhớ bấm Lưu.');
        }
    };

    const handleReset = async () => {
        setIsSaving(true);
        try {
            const resp = await fetch('/api/centers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify({ action: 'update_site_content', landing: null, guide: null })
            });
            if (resp.ok) {
                setLandingContent('');
                setGuideContent('');
                setMessage('✅ Đã xóa nội dung tùy chỉnh. Trang sẽ hiển thị nội dung mặc định.');
            }
        } catch (err: any) {
            setMessage('❌ ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700">
            <button onClick={handleOpen} className="w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors rounded-xl">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">📝</span>
                    <div className="text-left">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white">Quản lý nội dung trang chủ & Hướng dẫn</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Chỉnh sửa nội dung giới thiệu, bảng giá, hướng dẫn sử dụng hiển thị cho khách hàng</p>
                    </div>
                </div>
                <svg className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>

            {isOpen && (
                <div className="border-t dark:border-slate-700 p-5 space-y-4">
                    {isLoading ? (
                        <div className="text-center py-8 text-gray-500">Đang tải nội dung...</div>
                    ) : (
                        <>
                            {/* Tabs */}
                            <div className="flex border-b dark:border-slate-600 mb-4">
                                <button onClick={() => setActiveTab('landing')}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'landing' ? 'border-purple-500 text-purple-600 dark:text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                    🏠 Trang chủ
                                </button>
                                <button onClick={() => setActiveTab('guide')}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'guide' ? 'border-purple-500 text-purple-600 dark:text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                    📖 Hướng dẫn
                                </button>
                            </div>

                            {/* Info */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                                <p><strong>💡 Hướng dẫn:</strong> Chỉnh sửa nội dung dạng JSON bên dưới. Bấm <strong>"Tải mặc định"</strong> để lấy cấu trúc mẫu, chỉnh sửa rồi bấm <strong>"Lưu"</strong>.</p>
                                <p className="mt-1">Để trống = hiển thị nội dung mặc định.</p>
                                <div className="mt-2 flex gap-2">
                                    <a href="/" target="_blank" rel="noopener" className="text-xs underline hover:text-blue-500">Xem trang chủ ↗</a>
                                    <a href="/huong-dan" target="_blank" rel="noopener" className="text-xs underline hover:text-blue-500">Xem hướng dẫn ↗</a>
                                </div>
                            </div>

                            {/* Editor */}
                            {activeTab === 'landing' && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-semibold">Nội dung trang chủ (JSON)</label>
                                        <button onClick={() => handleLoadDefaults('landing')}
                                            className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                                            📋 Tải mặc định
                                        </button>
                                    </div>
                                    <textarea
                                        value={landingContent}
                                        onChange={e => setLandingContent(e.target.value)}
                                        className="w-full h-96 px-4 py-3 font-mono text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg resize-y focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        placeholder='Để trống = dùng nội dung mặc định. Bấm "Tải mặc định" để lấy cấu trúc JSON mẫu.'
                                        spellCheck={false}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        Các trường: heroTagline, heroTitle1, heroTitle2, heroDesc, features (icon/title/desc), plans (name/price/period/items/cta), ctaTitle, ctaButton...
                                    </p>
                                </div>
                            )}

                            {activeTab === 'guide' && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-semibold">Nội dung hướng dẫn (JSON)</label>
                                        <button onClick={() => handleLoadDefaults('guide')}
                                            className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                                            📋 Tải mặc định
                                        </button>
                                    </div>
                                    <textarea
                                        value={guideContent}
                                        onChange={e => setGuideContent(e.target.value)}
                                        className="w-full h-96 px-4 py-3 font-mono text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg resize-y focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        placeholder='Để trống = dùng nội dung mặc định. Bấm "Tải mặc định" để lấy cấu trúc JSON mẫu.'
                                        spellCheck={false}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        Các trường: title, subtitle, sections (id/icon/title/content:[q,a]), ctaTitle, ctaButton...
                                    </p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-3 flex-wrap">
                                <button onClick={handleSave} disabled={isSaving}
                                    className="px-4 py-2 text-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 shadow-sm">
                                    {isSaving ? '⏳ Đang lưu...' : '💾 Lưu nội dung'}
                                </button>
                                <button onClick={handleReset} disabled={isSaving}
                                    className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50">
                                    🔄 Xóa tùy chỉnh (dùng mặc định)
                                </button>
                            </div>

                            {/* Message */}
                            {message && (
                                <div className={`p-3 rounded-lg text-sm ${message.startsWith('✅') ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
                                    {message}
                                    <button onClick={() => setMessage('')} className="float-right font-bold">×</button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
