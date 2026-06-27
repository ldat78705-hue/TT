import React, { useState, useEffect } from 'react';
import { useData } from '../hooks/useDataContext';
import { useToast } from '../hooks/useToast';
import { Button } from '../components/common/Button';
import { CenterSettings, UserRole, AppData } from '../types';
import { ICONS } from '../constants';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { useAuth } from '../hooks/useAuth';

import { zaloTestConnection, recalculateAllInvoices as _recalcInvoices } from '../services/api';
const api = { recalculateAllInvoices: _recalcInvoices };




const AdminPasswordSettings: React.FC = () => {
    const { updateUserPassword } = useData();
    const { toast } = useToast();
    const { role, user } = useAuth();
    const isViewer = role === UserRole.VIEWER;

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            setError('Mật khẩu mới không khớp.');
            return;
        }
        if (newPassword.length < 6) {
            setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
            return;
        }

        setIsLoading(true);
        try {
            await updateUserPassword({ 
                userId: user?.id || 'ADMIN_USER', 
                role: UserRole.ADMIN, 
                newPassword, 
                currentPassword 
            });
            toast.success('Đổi mật khẩu Quản trị viên thành công!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            setError(err.message || 'Mật khẩu hiện tại không đúng hoặc có lỗi xảy ra.');
            toast.error('Đã xảy ra lỗi khi đổi mật khẩu.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="card-base">
            <h2 className="text-2xl font-bold mb-6">Đổi mật khẩu Quản trị viên</h2>
            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
                 <div>
                    <label className="block text-sm font-medium">Mật khẩu hiện tại</label>
                    <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="form-input mt-1"
                        required
                        disabled={isViewer}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium">Mật khẩu mới</label>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="form-input mt-1"
                        required
                        disabled={isViewer}
                    />
                </div>
                 <div>
                    <label className="block text-sm font-medium">Xác nhận mật khẩu mới</label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="form-input mt-1"
                        required
                        disabled={isViewer}
                    />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                 <div className="pt-2 flex justify-end">
                    <Button type="submit" isLoading={isLoading} disabled={isViewer}>Lưu Mật khẩu</Button>
                </div>
            </form>
        </div>
    );
};


import { getVietnamTime } from '../utils/date';

export const SettingsScreen: React.FC = () => {
    const { state, updateSettings, backupData, restoreData, resetToMockData, clearCollections, deleteAttendanceByMonth, clearAllTransactions, compactData } = useData();
    const { toast } = useToast();
    const { role } = useAuth();
    const [settings, setSettings] = useState<CenterSettings>(state.settings);
    const [isSaving, setIsSaving] = useState(false);
    const [restoreConfirm, setRestoreConfirm] = useState<{ open: boolean; data: any | null }>({ open: false, data: null });
    const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
    
    const [collectionsToClear, setCollectionsToClear] = useState<('students' | 'teachers' | 'staff' | 'classes')[]>([]);
    const [clearDataModalOpen, setClearDataModalOpen] = useState(false);
    const [confirmDeleteAtt, setConfirmDeleteAtt] = useState(false);
    const [clearTransactionsConfirmOpen, setClearTransactionsConfirmOpen] = useState(false);
    const [isCompacting, setIsCompacting] = useState(false);
    
    const [deleteAttMonth, setDeleteAttMonth] = useState(new Date().getMonth() + 1);
    const [deleteAttYear, setDeleteAttYear] = useState(new Date().getFullYear());




    const isViewer = role === UserRole.VIEWER;

    useEffect(() => {
        setSettings({
            ...state.settings,
            viewerAccountActive: state.settings.viewerAccountActive ?? true,
        });
    }, [state.settings]);



    const handleSignatureUpload = (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Vui lòng chọn file hình ảnh (jpg, png,...)');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) {
                setSettings(prev => ({ ...prev, taxSignatureUrl: e.target!.result as string }));
            }
        };
        reader.readAsDataURL(file);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) handleSignatureUpload(file);
                break;
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
         if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setSettings(prev => ({ ...prev, [name]: checked }));
        } else {
            setSettings(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSettingsSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await updateSettings(settings);
            toast.success('Đã cập nhật cài đặt trung tâm.');
        } catch (error) {
            toast.error("Lỗi khi cập nhật cài đặt.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleViewerToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isViewer) return;
        const { checked } = e.target;
        const oldSettings = { ...settings };
        setSettings(prev => ({ ...prev, viewerAccountActive: checked }));
        try {
            await updateSettings({ ...state.settings, viewerAccountActive: checked });
            toast.success('Cài đặt tài khoản Viewer đã được cập nhật.');
        } catch (error) {
            toast.error("Lỗi khi cập nhật.");
            setSettings(oldSettings);
        }
    };
    
    const handleSaveACopy = async () => {
        try {
            const dataToBackup = await backupData();
            const dataStr = JSON.stringify(dataToBackup, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `EduCenterPro_Backup_${getVietnamTime().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success('Đã tải về bản sao lưu thành công!');
        } catch (error) {
            toast.error('Sao lưu thất bại.');
        }
    };


    
    const handleRestoreFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const restoredData = JSON.parse(text) as Omit<AppData, 'loading'>;
                if (restoredData.students && restoredData.settings && Array.isArray(restoredData.students)) {
                    setRestoreConfirm({ open: true, data: restoredData });
                } else { throw new Error("File sao lưu không hợp lệ hoặc bị lỗi."); }
            } catch (error) {
                toast.error('Phục hồi thất bại. File sao lưu không hợp lệ hoặc bị lỗi.');
            } finally {
                event.target.value = '';
            }
        };
        reader.readAsText(file);
    };



    const handleConfirmRestore = async () => {
        if (restoreConfirm.data) {
            try {
                await restoreData(restoreConfirm.data);
                toast.success('Phục hồi dữ liệu thành công! Ứng dụng sẽ tải lại.');
                setTimeout(() => window.location.reload(), 1500);
            } catch (error) {
                toast.error('Phục hồi thất bại.');
            } finally {
                setRestoreConfirm({ open: false, data: null });
            }
        }
    };
    const handleConfirmReset = async () => {
        try {
            await resetToMockData();
            toast.success('Đã khôi phục dữ liệu mặc định thành công! Ứng dụng sẽ tải lại.');
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            toast.error('Lỗi khi khôi phục dữ liệu mặc định.');
        } finally {
            setResetConfirmOpen(false);
        }
    };
    const handleCheckboxChange = (collection: 'students' | 'teachers' | 'staff' | 'classes') => {
        setCollectionsToClear(prev => 
            prev.includes(collection) 
                ? prev.filter(c => c !== collection) 
                : [...prev, collection]
        );
    };
    const handleClearData = async () => {
        try {
            await clearCollections(collectionsToClear);
            toast.success(`Đã xóa thành công dữ liệu của ${collectionsToClear.length} module.`);
        } catch (error) {
            toast.error('Lỗi khi xóa dữ liệu.');
        } finally {
            setClearDataModalOpen(false);
            setCollectionsToClear([]);
        }
    };
    const handleDeleteAttendanceByMonth = async () => {
        try {
            await deleteAttendanceByMonth({ month: deleteAttMonth, year: deleteAttYear });
            toast.success(`Đã xóa dữ liệu điểm danh tháng ${deleteAttMonth}/${deleteAttYear}.`);
        } catch (error) {
            toast.error('Lỗi khi xóa dữ liệu điểm danh.');
        } finally {
            setConfirmDeleteAtt(false);
        }
    };
    const handleConfirmClearTransactions = async () => {
        try {
            await clearAllTransactions();
            toast.success('Đã xóa toàn bộ lịch sử giao dịch và hóa đơn. Số dư của tất cả học viên đã được đặt lại về 0.');
        } catch (error) {
            toast.error('Lỗi khi xóa dữ liệu giao dịch.');
        } finally {
            setClearTransactionsConfirmOpen(false);
        }
    };

    const handleCompactData = async () => {
        if (!window.confirm("Bạn có chắc chắn muốn Gộp Dữ liệu không? Quá trình này sẽ tổ chức lại toàn bộ hệ thống để tối ưu tốc độ và dung lượng.")) return;
        setIsCompacting(true);
        toast.info("Đang xử lý gộp dữ liệu. Vui lòng không đóng trình duyệt...");
        try {
            await compactData();
            toast.success("Gộp dữ liệu thành công! Hệ thống đã được tối ưu hóa.");
        } catch (error) {
            toast.error("Lỗi khi gộp dữ liệu.");
        } finally {
            setIsCompacting(false);
        }
    };

    const dataTypes: { key: 'students' | 'teachers' | 'staff' | 'classes'; label: string }[] = [
        { key: 'students', label: 'Học viên (bao gồm học phí, điểm danh,...)' },
        { key: 'teachers', label: 'Giáo viên (bao gồm bảng lương)' },
        { key: 'staff', label: 'Nhân viên (Quản lý, Kế toán)' },
        { key: 'classes', label: 'Lớp học (bao gồm điểm danh, báo cáo)' },
    ];
    
    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);


    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold">Cài đặt</h1>

            {isViewer && (
                <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
                    <span className="text-2xl">👁️</span>
                    <div>
                        <p className="font-semibold text-amber-800 dark:text-amber-200">Chế độ Chỉ xem</p>
                        <p className="text-sm text-amber-600 dark:text-amber-400">Bạn đang đăng nhập với vai trò Viewer. Tất cả cài đặt chỉ hiển thị để xem, không thể thay đổi.</p>
                    </div>
                </div>
            )}

            <form onSubmit={handleSettingsSubmit} className="space-y-8">
                <div className="card-base">
                    <h2 className="text-2xl font-bold mb-6">Cài đặt Trung tâm</h2>
                    <div className="space-y-6">
                        <fieldset className="form-fieldset" disabled={isViewer}>
                            <legend className="form-legend">Thông tin chung</legend>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                <div>
                                    <label className="block text-sm font-medium">Tên trung tâm</label>
                                    <input type="text" name="name" value={settings.name} onChange={handleChange} className="form-input mt-1" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Số điện thoại</label>
                                    <input type="text" name="phone" value={settings.phone || ''} onChange={handleChange} className="form-input mt-1" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Tên hiển thị Admin</label>
                                    <input type="text" name="adminDisplayName" value={settings.adminDisplayName || ''} onChange={handleChange} className="form-input mt-1" placeholder="VD: HỘ KINH DOANH THÀNH ĐẠT" />
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Tên hiển thị trong lịch sử thao tác, header và các phiếu thu. Mặc định: "Admin"</p>
                                </div>
                            </div>
                            <div className="mt-4">
                                <label className="block text-sm font-medium">Địa chỉ</label>
                                <input type="text" name="address" value={settings.address || ''} onChange={handleChange} className="form-input mt-1" />
                            </div>
                        </fieldset>
                        
                         <fieldset className="form-fieldset" disabled={isViewer}>
                            <legend className="form-legend">Tùy chỉnh Giao diện</legend>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                 <div>
                                    <label className="block text-sm font-medium">Màu chủ đạo</label>
                                    <input type="color" name="themeColor" value={settings.themeColor} onChange={handleChange} className="form-input mt-1 h-12" />
                                </div>
                                 <div>
                                    <label className="block text-sm font-medium">Màu nền Menu (Dark mode)</label>
                                    <input type="color" name="sidebarColor" value={settings.sidebarColor || '#1f2937'} onChange={handleChange} className="form-input mt-1 h-12" />
                                </div>
                            </div>
                        </fieldset>



                        <fieldset className="form-fieldset" disabled={isViewer}>
                            <legend className="form-legend">Thông tin Thanh toán (cho mã QR)</legend>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                <div>
                                    <label className="block text-sm font-medium">Tên ngân hàng</label>
                                    <input type="text" name="bankName" value={settings.bankName || ''} onChange={handleChange} className="form-input mt-1" placeholder="VD: Vietcombank" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Ngân hàng (Mã BIN)</label>
                                    <input type="text" name="bankBin" value={settings.bankBin || ''} onChange={handleChange} className="form-input mt-1" placeholder="VD: 970436" />
                                </div>
                                 <div>
                                    <label className="block text-sm font-medium">Số tài khoản</label>
                                    <input type="text" name="bankAccountNumber" value={settings.bankAccountNumber || ''} onChange={handleChange} className="form-input mt-1" />
                                </div>
                                 <div>
                                    <label className="block text-sm font-medium">Tên chủ tài khoản</label>
                                    <input type="text" name="bankAccountHolder" value={settings.bankAccountHolder || ''} onChange={handleChange} className="form-input mt-1" placeholder="NGUYEN VAN A" />
                                </div>
                            </div>
                        </fieldset>

                        <fieldset className="form-fieldset" disabled={isViewer}>
                            <legend className="form-legend">Thông tin Thuế (cho Báo cáo)</legend>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                <div>
                                    <label className="block text-sm font-medium">Mã số thuế mặc định</label>
                                    <input type="text" name="taxId" value={settings.taxId || ''} onChange={handleChange} className="form-input mt-1" placeholder="VD: 001092019830" />
                                </div>
                                <div onPaste={handlePaste}>
                                    <label className="block text-sm font-medium mb-1">Chữ ký (Báo cáo Thuế)</label>
                                    <div className="flex items-center gap-4">
                                        <label className="cursor-pointer btn-secondary">
                                            Chọn ảnh chữ ký
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                className="hidden" 
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleSignatureUpload(file);
                                                }}
                                            />
                                        </label>
                                        <span className="text-xs text-gray-500">Hoặc copy và dán ảnh vào vùng này</span>
                                    </div>
                                    {settings.taxSignatureUrl && (
                                        <div className="mt-2 relative inline-block border p-2 rounded bg-white">
                                            <img src={settings.taxSignatureUrl} alt="Signature Preview" className="h-16 object-contain" />
                                            <button 
                                                type="button" 
                                                onClick={() => setSettings(prev => ({ ...prev, taxSignatureUrl: '' }))}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center text-xs"
                                                title="Xóa chữ ký"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </fieldset>

                        {/* Thanh toán tự động (Webhook) */}
                        <fieldset className="form-fieldset" disabled={isViewer}>
                            <legend className="form-legend">💳 Thanh toán tự động (Webhook)</legend>
                            <div className="space-y-4 mt-2">
                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <div>
                                        <h4 className="font-semibold text-sm">Kích hoạt thanh toán tự động</h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Tự động ghi nhận thanh toán khi nhận webhook từ ngân hàng</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer"
                                            checked={settings.webhookEnabled ?? false}
                                            onChange={(e) => setSettings(prev => ({ ...prev, webhookEnabled: e.target.checked }))}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:bg-green-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                                    </label>
                                </div>
                                
                                {settings.webhookEnabled && (
                                    <>
                                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
                                            <p className="font-medium text-blue-800 dark:text-blue-300 mb-1">🔗 URL Webhook của bạn:</p>
                                            <code className="block bg-white dark:bg-black/30 p-2 rounded text-xs font-mono break-all text-blue-700 dark:text-blue-400">
                                                {(() => { try { const s = JSON.parse(localStorage.getItem('educenter_user_session') || '{}'); return `${window.location.origin}/api/webhook${s.centerId ? `?center=${s.centerId}` : ''}`; } catch { return `${window.location.origin}/api/webhook`; } })()}
                                            </code>
                                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                                                Dán URL này vào SePay, CassVN, hoặc cấu hình MacroDroid/Tasker để tự động gửi thông báo chuyển khoản.
                                            </p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium">Prefix mã học viên trong nội dung CK</label>
                                            <input type="text" 
                                                value={settings.webhookStudentIdPrefix ?? 'HS'} 
                                                onChange={e => setSettings(prev => ({...prev, webhookStudentIdPrefix: e.target.value}))}
                                                className="form-input mt-1" 
                                                placeholder="HS" 
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                Khi phụ huynh chuyển khoản ghi "HOC PHI HS001", hệ thống sẽ tìm mã HS001.
                                                Đổi prefix nếu trung tâm dùng mã khác (VD: "HV", "SV").
                                            </p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium">Nguồn nhận diện</label>
                                            <input type="text" 
                                                value={settings.webhookBankKeyword ?? 'MBBank'} 
                                                onChange={e => setSettings(prev => ({...prev, webhookBankKeyword: e.target.value}))}
                                                className="form-input mt-1" 
                                                placeholder="MBBank" 
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Tên ngân hàng/nguồn hiển thị trong mô tả giao dịch (VD: MBBank, VCB, Techcombank)</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium">Mẫu mô tả giao dịch</label>
                                            <input type="text" 
                                                value={settings.webhookAutoDescription ?? 'Thanh toán HP tự động'} 
                                                onChange={e => setSettings(prev => ({...prev, webhookAutoDescription: e.target.value}))}
                                                className="form-input mt-1" 
                                                placeholder="Thanh toán HP tự động" 
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Mô tả sẽ ghi trong lịch sử giao dịch khi webhook ghi nhận tự động</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium">🔐 Secret Key (bảo mật)</label>
                                            <input type="password" 
                                                value={settings.webhookSecretKey ?? ''} 
                                                onChange={e => setSettings(prev => ({...prev, webhookSecretKey: e.target.value}))}
                                                className="form-input mt-1" 
                                                placeholder="Để trống = không yêu cầu xác thực" 
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Nếu đặt Secret Key, URL webhook phải thêm <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">?secret=YOUR_KEY</code> hoặc header <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">X-Webhook-Secret</code></p>
                                        </div>

                                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
                                            <p className="font-medium text-amber-800 dark:text-amber-300 mb-1">📌 Cú pháp chuyển khoản mẫu cho phụ huynh:</p>
                                            <p className="font-mono bg-white dark:bg-black/30 p-2 rounded text-center text-lg font-bold">
                                                HOC PHI {settings.webhookStudentIdPrefix || 'HS'}001
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </fieldset>

                        {/* Zalo OA Integration */}
                        <fieldset className="form-fieldset" disabled={isViewer}>
                            <legend className="form-legend">📱 Tích hợp Zalo OA — Gửi thông báo</legend>
                            <div className="space-y-4 mt-2">
                                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                                    <div>
                                        <h4 className="font-semibold text-sm">Kích hoạt Zalo OA</h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Bật để gửi thông báo vắng mặt và học phí qua Zalo</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                        <input
                                            type="checkbox"
                                            name="zaloOaEnabled"
                                            checked={settings.zaloOaEnabled || false}
                                            onChange={handleChange}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
                                    </label>
                                </div>

                                {(settings.zaloOaEnabled) && (
                                    <>
                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300 space-y-1">
                                            <p className="font-semibold">Hướng dẫn lấy thông tin:</p>
                                            <ol className="list-decimal pl-4 space-y-1">
                                                <li>Đăng ký OA tại <a href="https://oa.zalo.me" target="_blank" rel="noreferrer" className="underline font-medium">oa.zalo.me</a></li>
                                                <li>Tạo ứng dụng tại <a href="https://developers.zalo.me" target="_blank" rel="noreferrer" className="underline font-medium">developers.zalo.me</a></li>
                                                <li>Lấy App ID và Secret Key từ trang ứng dụng</li>
                                                <li>Lấy Refresh Token qua OAuth flow của Zalo</li>
                                            </ol>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium">App ID <span className="text-red-500">*</span></label>
                                                <input type="text" name="zaloAppId" value={settings.zaloAppId || ''} onChange={handleChange} className="form-input mt-1" placeholder="Nhập App ID" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium">Secret Key <span className="text-red-500">*</span></label>
                                                <input type="password" name="zaloSecretKey" value={settings.zaloSecretKey || ''} onChange={handleChange} className="form-input mt-1" placeholder="Nhập Secret Key" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium">Refresh Token <span className="text-red-500">*</span></label>
                                            <input type="password" name="zaloRefreshToken" value={settings.zaloRefreshToken || ''} onChange={handleChange} className="form-input mt-1" placeholder="Nhập Refresh Token" />
                                            <p className="text-xs text-gray-500 mt-1">Token sẽ tự động làm mới khi hết hạn</p>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <Button type="button" variant="secondary" onClick={async () => {
                                                if (!settings.zaloAppId || !settings.zaloSecretKey || !settings.zaloRefreshToken) {
                                                    toast.error('Vui lòng nhập đủ App ID, Secret Key và Refresh Token');
                                                    return;
                                                }
                                                try {
                                                    const result = await zaloTestConnection(settings.zaloAppId, settings.zaloSecretKey, settings.zaloRefreshToken);
                                                    if (result.success) {
                                                        toast.success(result.message || 'Kết nối thành công!');
                                                        // Update local state with connection result
                                                        setSettings(prev => ({
                                                            ...prev,
                                                            zaloOaEnabled: true,
                                                            ...(result.newRefreshToken ? { zaloRefreshToken: result.newRefreshToken } : {}),
                                                        }));
                                                    } else {
                                                        toast.error(result.error || 'Kết nối thất bại');
                                                    }
                                                } catch (e: any) {
                                                    toast.error(e.message || 'Lỗi kết nối');
                                                }
                                            }}>🔗 Test kết nối OA</Button>
                                        </div>

                                        {/* Auto Tuition Reminder via Zalo */}
                                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h4 className="font-semibold text-sm">⏰ Nhắc nhở HP quá hạn qua Zalo</h4>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">Gửi nhắc nhở cho PHHS có HĐ chưa thanh toán quá số ngày quy định</p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                                    <input type="checkbox" className="sr-only peer"
                                                        checked={settings.zaloAutoTuitionReminder ?? false}
                                                        onChange={(e) => setSettings(prev => ({ ...prev, zaloAutoTuitionReminder: e.target.checked }))}
                                                    />
                                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                                                </label>
                                            </div>
                                            {settings.zaloAutoTuitionReminder && (
                                                <div>
                                                    <label className="block text-sm font-medium">Số ngày quá hạn để gửi nhắc</label>
                                                    <input type="number" min="1" max="90"
                                                        value={settings.zaloTuitionReminderDays ?? 7}
                                                        onChange={(e) => setSettings(prev => ({ ...prev, zaloTuitionReminderDays: parseInt(e.target.value) || 7 }))}
                                                        className="form-input mt-1 w-32"
                                                    />
                                                    <p className="text-xs text-gray-500 mt-1">HĐ UNPAID quá {settings.zaloTuitionReminderDays || 7} ngày sẽ được gửi nhắc nhở khi nhấn nút trong tab Công nợ</p>
                                                </div>
                                            )}
                                        </div>

                                        <hr className="dark:border-gray-700" />

                                        <h4 className="font-semibold text-sm">Mẫu tin nhắn (có thể chỉnh sửa)</h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Các biến: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{'}parentName{'}'}</code>, <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{'}studentName{'}'}</code>, <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{'}className{'}'}</code>, <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{'}date{'}'}</code>, <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{'}centerName{'}'}</code>, <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{'}amount{'}'}</code></p>

                                        <div>
                                            <label className="block text-sm font-medium">Mẫu thông báo vắng mặt</label>
                                            <textarea 
                                                name="zaloAbsenceTemplate" 
                                                value={settings.zaloAbsenceTemplate || 'Kính gửi PH {parentName},\n\nTrung tâm {centerName} xin thông báo: Học viên {studentName} đã vắng mặt tại lớp {className} ngày {date}.\n\nVui lòng liên hệ trung tâm nếu cần thêm thông tin.\nTrân trọng!'} 
                                                onChange={(e) => setSettings(prev => ({ ...prev, zaloAbsenceTemplate: e.target.value }))}
                                                className="form-input mt-1" 
                                                rows={4}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium">Mẫu nhắc học phí</label>
                                            <textarea 
                                                name="zaloTuitionTemplate" 
                                                value={settings.zaloTuitionTemplate || 'Kính gửi PH {parentName},\n\nTrung tâm {centerName} xin thông báo: Học viên {studentName} hiện có học phí chưa thanh toán: {amount}.\n\nVui lòng thanh toán để đảm bảo quyền lợi học tập.\nTrân trọng!'} 
                                                onChange={(e) => setSettings(prev => ({ ...prev, zaloTuitionTemplate: e.target.value }))}
                                                className="form-input mt-1" 
                                                rows={4}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </fieldset>

                        {/* Message Templates */}
                        <fieldset className="form-fieldset" disabled={isViewer}>
                            <legend className="form-legend">📝 Tin nhắn mẫu</legend>
                            <div className="space-y-4 mt-2">
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300 space-y-1">
                                    <p className="font-semibold">Biến có thể sử dụng:</p>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {['{parentName}', '{studentName}', '{className}', '{date}', '{centerName}', '{amount}', '{phone}'].map(v => (
                                            <code key={v} className="bg-white dark:bg-black/30 px-1.5 py-0.5 rounded text-xs">{v}</code>
                                        ))}
                                    </div>
                                    <p className="mt-2 text-gray-500 dark:text-gray-400">Các biến sẽ được thay thế bằng dữ liệu thực khi gửi tin nhắn. Cấu hình ở đây sẽ áp dụng cho cả Web và App.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium">🔴 Thông báo vắng mặt</label>
                                    <p className="text-xs text-gray-500 mb-1">Gửi PHHS khi học viên vắng không phép</p>
                                    <textarea 
                                        value={settings.messageTemplates?.absenceNotification || settings.zaloAbsenceTemplate || 'Kính gửi PH {parentName},\n\nTrung tâm {centerName} xin thông báo: Học viên {studentName} đã vắng mặt tại lớp {className} ngày {date}.\n\nVui lòng liên hệ trung tâm nếu cần thêm thông tin.\nTrân trọng!'}
                                        onChange={(e) => setSettings(prev => ({ ...prev, messageTemplates: { ...prev.messageTemplates, absenceNotification: e.target.value } }))}
                                        className="form-input mt-1" 
                                        rows={4}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium">💰 Nhắc nhở công nợ / Học phí</label>
                                    <p className="text-xs text-gray-500 mb-1">Gửi PHHS khi cần nhắc học phí</p>
                                    <textarea 
                                        value={settings.messageTemplates?.tuitionReminder || settings.zaloTuitionTemplate || 'Kính gửi PH {parentName},\n\nTrung tâm {centerName} xin thông báo: Học viên {studentName} hiện có học phí chưa thanh toán: {amount}.\n\nVui lòng thanh toán để đảm bảo quyền lợi học tập.\nTrân trọng!'}
                                        onChange={(e) => setSettings(prev => ({ ...prev, messageTemplates: { ...prev.messageTemplates, tuitionReminder: e.target.value } }))}
                                        className="form-input mt-1" 
                                        rows={4}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium">📋 Báo cáo điểm danh ngày</label>
                                    <p className="text-xs text-gray-500 mb-1">Gửi PHHS khi điểm danh xong</p>
                                    <textarea 
                                        value={settings.messageTemplates?.attendanceReport || 'Kính gửi PH {parentName},\n\nHọc viên {studentName} đã tham gia lớp {className} ngày {date}.\n\nTrân trọng,\n{centerName}'}
                                        onChange={(e) => setSettings(prev => ({ ...prev, messageTemplates: { ...prev.messageTemplates, attendanceReport: e.target.value } }))}
                                        className="form-input mt-1" 
                                        rows={3}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium">📝 Xác nhận nghỉ phép</label>
                                    <p className="text-xs text-gray-500 mb-1">Gửi PHHS khi phụ huynh xin nghỉ cho con</p>
                                    <textarea 
                                        value={settings.messageTemplates?.leaveRequestConfirm || 'Kính gửi PH {parentName},\n\nTrung tâm {centerName} đã ghi nhận đơn xin nghỉ phép cho học viên {studentName} tại lớp {className} ngày {date}.\n\nTrân trọng!'}
                                        onChange={(e) => setSettings(prev => ({ ...prev, messageTemplates: { ...prev.messageTemplates, leaveRequestConfirm: e.target.value } }))}
                                        className="form-input mt-1" 
                                        rows={3}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium">🎉 Chào mừng HS mới</label>
                                    <p className="text-xs text-gray-500 mb-1">Gửi PHHS khi đăng ký HS mới</p>
                                    <textarea 
                                        value={settings.messageTemplates?.welcomeStudent || 'Kính gửi PH {parentName},\n\nTrung tâm {centerName} xin chào mừng học viên {studentName} gia nhập lớp {className}.\n\nChúc em học tập vui vẻ và đạt kết quả tốt!\nTrân trọng!'}
                                        onChange={(e) => setSettings(prev => ({ ...prev, messageTemplates: { ...prev.messageTemplates, welcomeStudent: e.target.value } }))}
                                        className="form-input mt-1" 
                                        rows={3}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium">✅ Xác nhận thanh toán</label>
                                    <p className="text-xs text-gray-500 mb-1">Gửi khi ghi nhận thanh toán thành công</p>
                                    <textarea 
                                        value={settings.messageTemplates?.paymentConfirm || 'Kính gửi PH {parentName},\n\nTrung tâm {centerName} xác nhận đã nhận thanh toán {amount} cho học viên {studentName}.\n\nCảm ơn quý phụ huynh!\nTrân trọng!'}
                                        onChange={(e) => setSettings(prev => ({ ...prev, messageTemplates: { ...prev.messageTemplates, paymentConfirm: e.target.value } }))}
                                        className="form-input mt-1" 
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </fieldset>
                    </div>
                </div>

                 {!isViewer && (
                     <div className="flex justify-end pt-4">
                        <Button type="submit" isLoading={isSaving}>Lưu Cài đặt chung</Button>
                    </div>
                )}
            </form>
            
            <AdminPasswordSettings />

            {role === UserRole.ADMIN && (
                <div className="card-base">
                    <h2 className="text-2xl font-bold mb-6">Quản lý Tài khoản Viewer</h2>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border rounded-lg dark:border-gray-600">
                        <div className="flex-1">
                            <h4 className="font-semibold text-gray-800 dark:text-gray-200">Tài khoản Viewer (Chỉ đọc)</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Cho phép đăng nhập với quyền xem toàn bộ dữ liệu nhưng không thể chỉnh sửa.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                            <input
                                type="checkbox"
                                name="viewerAccountActive"
                                checked={settings.viewerAccountActive}
                                onChange={handleViewerToggle}
                                className="sr-only peer"
                                disabled={isViewer}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                            <span className={`ml-3 text-sm font-medium ${settings.viewerAccountActive ? 'text-green-600' : 'text-gray-500'}`}>
                                {settings.viewerAccountActive ? 'Hoạt động' : 'Vô hiệu hóa'}
                            </span>
                        </label>
                    </div>
                </div>
            )}

            <div className="card-base">
                <h2 className="text-2xl font-bold mb-6">Thao tác Dữ liệu</h2>
                <div className="space-y-6">
                    <div className="p-4 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-gray-700/50 rounded-lg">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Sao lưu & Phục hồi Cục bộ (Thủ công)</h3>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 mb-3">
                           Tạo một bản sao của toàn bộ dữ liệu để lưu trữ an toàn trên máy tính của bạn.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Button onClick={handleSaveACopy} variant="secondary" disabled={isViewer}>
                                {ICONS.download} Tải về Tệp Sao lưu
                            </Button>
                            <label htmlFor="restore-input" className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-semibold bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 ${isViewer ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                {ICONS.restore} Phục hồi từ Tệp
                            </label>
                            <input id="restore-input" type="file" accept=".json" onChange={handleRestoreFileSelect} className="hidden" disabled={isViewer} />
                        </div>
                    </div>

                    <div className="p-4 border border-green-200 dark:border-green-800 bg-green-50 dark:bg-gray-700/50 rounded-lg">
                        <h3 className="font-semibold text-green-800 dark:text-green-200">Tối ưu hóa Hệ thống</h3>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1 mb-3">
                           Gộp các dữ liệu cũ lẻ tẻ (Điểm danh, Thu chi) thành từng khối lớn theo tháng. Điều này giúp hệ thống giảm 80% rác dữ liệu, chạy cực kỳ nhanh và không bao giờ bị quá tải (Vượt Quota Firebase). Nên thực hiện 2-3 tháng 1 lần. Toàn bộ dữ liệu vẫn được giữ nguyên vẹn.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <Button onClick={handleCompactData} isLoading={isCompacting} disabled={isViewer} className="bg-green-600 hover:bg-green-700 text-white">
                                {ICONS.check} Gộp Dữ Liệu Tối Ưu
                            </Button>
                            <Button onClick={async () => {
                                if (!window.confirm("Cập nhật lại trạng thái (Đã trả / Chưa trả) cho tất cả hóa đơn dựa trên số dư hiện tại. Tiếp tục?")) return;
                                setIsCompacting(true);
                                try {
                                    await api.recalculateAllInvoices();
                                    toast.success("Đã cập nhật trạng thái tất cả hóa đơn thành công!");
                                    window.location.reload();
                                } catch (error) {
                                    toast.error("Lỗi khi cập nhật trạng thái hóa đơn.");
                                } finally {
                                    setIsCompacting(false);
                                }
                            }} isLoading={isCompacting} disabled={isViewer} className="bg-blue-600 hover:bg-blue-700 text-white">
                                🔄 Cập nhật trạng thái Hóa đơn
                            </Button>
                        </div>
                    </div>

                    <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-gray-700 rounded-lg">
                        <button type="button" onClick={() => {
                            const el = document.getElementById('danger-zone-content');
                            if (el) el.classList.toggle('hidden');
                            const arrow = document.getElementById('danger-zone-arrow');
                            if (arrow) arrow.classList.toggle('rotate-90');
                        }} className="w-full flex items-center justify-between text-left">
                            <h3 className="font-semibold text-red-800 dark:text-red-200">⚠️ Khu vực Nguy hiểm</h3>
                            <span id="danger-zone-arrow" className="text-red-500 transition-transform duration-200">▶</span>
                        </button>
                        
                        <div id="danger-zone-content" className="hidden">
                        <div className="mt-4">
                            <h4 className="font-semibold">Xóa dữ liệu theo Module</h4>
                            <p className="text-sm text-red-700 dark:text-red-300 mt-1 mb-3">Thao tác này sẽ xóa vĩnh viễn tất cả dữ liệu trong các module được chọn. Hãy cẩn thận.</p>
                            <div className="space-y-2">
                                {dataTypes.map(type => (
                                    <label key={type.key} className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={collectionsToClear.includes(type.key)}
                                            onChange={() => handleCheckboxChange(type.key)}
                                            className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                            disabled={isViewer}
                                        />
                                        <span className="ml-2 text-sm">{type.label}</span>
                                    </label>
                                ))}
                            </div>
                            <Button
                                variant="danger"
                                onClick={() => setClearDataModalOpen(true)}
                                disabled={collectionsToClear.length === 0 || isViewer}
                                className="mt-4"
                            >
                                Xóa {collectionsToClear.length} Module đã chọn
                            </Button>
                        </div>

                        <div className="mt-6 pt-4 border-t border-red-200 dark:border-red-700">
                            <h4 className="font-semibold">Xóa Dữ liệu Điểm danh theo Tháng</h4>
                            <p className="text-sm text-red-700 dark:text-red-300 mt-1 mb-3">Thao tác này sẽ xóa vĩnh viễn toàn bộ dữ liệu điểm danh trong tháng đã chọn. Dùng để dọn dẹp dữ liệu.</p>
                             <div className="flex flex-wrap items-center gap-4">
                                <select value={deleteAttMonth} onChange={e => setDeleteAttMonth(Number(e.target.value))} className="form-select w-auto" disabled={isViewer}>
                                    {months.map(m => <option key={m} value={m}>Tháng {m}</option>)}
                                </select>
                                <select value={deleteAttYear} onChange={e => setDeleteAttYear(Number(e.target.value))} className="form-select w-auto" disabled={isViewer}>
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <Button variant="danger" onClick={() => setConfirmDeleteAtt(true)} disabled={isViewer}>
                                    Xóa Điểm danh
                                </Button>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-red-200 dark:border-red-700">
                            <h4 className="font-semibold">Xóa Toàn bộ Lịch sử Giao dịch</h4>
                            <p className="text-sm text-red-700 dark:text-red-300 mt-1 mb-3">Thao tác này sẽ xóa vĩnh viễn TẤT CẢ giao dịch và hóa đơn của TOÀN BỘ học viên, đồng thời đặt lại số dư của mọi người về 0. Hành động này không thể hoàn tác.</p>
                            <Button variant="danger" onClick={() => setClearTransactionsConfirmOpen(true)} disabled={isViewer}>
                                Xóa Lịch sử Giao dịch
                            </Button>
                        </div>

                        <div className="mt-6 pt-4 border-t border-red-200 dark:border-red-700">
                            <h4 className="font-semibold">Khôi phục Dữ liệu Mặc định</h4>
                            <p className="text-sm text-red-700 dark:text-red-300 mt-1 mb-3">Thao tác này sẽ xóa TẤT CẢ dữ liệu hiện tại và thay thế bằng bộ dữ liệu mặc định của hệ thống. Dùng khi bạn muốn bắt đầu lại.</p>
                            <Button variant="danger" onClick={() => setResetConfirmOpen(true)} disabled={isViewer}>
                                Khôi phục Dữ liệu Mặc định
                            </Button>
                        </div>
                        </div> {/* end danger-zone-content */}
                    </div>
                </div>
            </div>


            <ConfirmationModal
                isOpen={restoreConfirm.open}
                onClose={() => setRestoreConfirm({ open: false, data: null })}
                onConfirm={handleConfirmRestore}
                title="Xác nhận Phục hồi Dữ liệu"
                message={<p>Bạn có chắc chắn muốn phục hồi dữ liệu từ file đã chọn? <span className="font-bold text-red-500">Toàn bộ dữ liệu hiện tại sẽ bị ghi đè.</span></p>}
                confirmButtonText="Xác nhận Phục hồi"
                confirmButtonVariant="danger"
            />
            <ConfirmationModal
                isOpen={resetConfirmOpen}
                onClose={() => setResetConfirmOpen(false)}
                onConfirm={handleConfirmReset}
                title="Xác nhận Khôi phục Dữ liệu Mặc định"
                message="Hành động này không thể hoàn tác. Toàn bộ dữ liệu hiện tại của bạn sẽ bị xóa và thay thế bằng dữ liệu mặc định."
                confirmationKeyword="KHÔI PHỤC"
                confirmButtonVariant="danger"
            />
            <ConfirmationModal
                isOpen={clearDataModalOpen}
                onClose={() => setClearDataModalOpen(false)}
                onConfirm={handleClearData}
                title="Xác nhận Xóa Dữ liệu"
                message={`Bạn có chắc chắn muốn xóa vĩnh viễn toàn bộ dữ liệu của ${collectionsToClear.length} module đã chọn?`}
                confirmationKeyword="XÓA"
                confirmButtonVariant="danger"
            />
             <ConfirmationModal
                isOpen={confirmDeleteAtt}
                onClose={() => setConfirmDeleteAtt(false)}
                onConfirm={handleDeleteAttendanceByMonth}
                title="Xác nhận Xóa Dữ liệu Điểm danh"
                message={`Bạn có chắc chắn muốn xóa vĩnh viễn toàn bộ dữ liệu điểm danh trong tháng ${deleteAttMonth}/${deleteAttYear}? Hành động này không thể hoàn tác.`}
            />
             <ConfirmationModal
                isOpen={clearTransactionsConfirmOpen}
                onClose={() => setClearTransactionsConfirmOpen(false)}
                onConfirm={handleConfirmClearTransactions}
                title="Xác nhận Xóa Toàn bộ Giao dịch"
                message={
                    <p>
                        Bạn có chắc chắn muốn xóa toàn bộ lịch sử giao dịch và hóa đơn không?
                        <br/><br/>
                        <span className="font-bold">Hành động này sẽ đặt lại số dư của TẤT CẢ học viên về 0 và không thể hoàn tác.</span>
                    </p>
                }
                confirmationKeyword="XÓA GIAO DỊCH"
                confirmButtonVariant="danger"
            />
        </div>
    );
};