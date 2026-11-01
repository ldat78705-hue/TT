import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { useData } from '../../hooks/useDataContext';
import { useToast } from '../../hooks/useToast';
import { UserRole, Teacher, Staff, Student } from '../../types';

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
    const { user, role, logout } = useAuth();
    const { updateUserPassword } = useData();
    const { toast } = useToast();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setError('');
            setIsLoading(false);
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (!user || !role || role === UserRole.ADMIN) {
            setError('Không thể đổi mật khẩu cho tài khoản này.');
            return;
        }

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
            await updateUserPassword({ userId: user.id, role, newPassword, currentPassword });
            toast.success('Đổi mật khẩu thành công! Vui lòng đăng nhập lại.');
            onClose();
            await logout();
        } catch (err: any) {
            toast.error(err.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
            setError(err.message || 'Không thể cập nhật mật khẩu.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Đổi mật khẩu">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium">Mật khẩu hiện tại</label>
                    <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="form-input mt-1"
                        required
                        autoComplete="current-password"
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
                        autoComplete="new-password"
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
                        autoComplete="new-password"
                    />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <div className="flex justify-end gap-4 pt-4 border-t dark:border-gray-700">
                    <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
                    <Button type="submit" isLoading={isLoading}>Lưu thay đổi</Button>
                </div>
            </form>
        </Modal>
    );
};

interface ResetPasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: { id: string; name: string } | null;
    role: UserRole | null;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ isOpen, onClose, user, role }) => {
    const { updateUserPassword } = useData();
    const { toast } = useToast();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setNewPassword('');
            setConfirmPassword('');
            setError('');
            setIsLoading(false);
        }
    }, [isOpen]);

    if (!user || !role) return null;

    const handleSubmit = async (e: React.FormEvent) => {
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
            await updateUserPassword({ userId: user.id, role, newPassword });
            toast.success(`Đã đặt lại mật khẩu cho ${user.name}.`);
            onClose();
        } catch (err) {
            toast.error('Đã xảy ra lỗi khi đặt lại mật khẩu.');
            setError('Không thể cập nhật mật khẩu.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Đặt lại mật khẩu cho ${user.name}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium">Mật khẩu mới</label>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="form-input mt-1"
                        required
                        autoComplete="new-password"
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
                        autoComplete="new-password"
                    />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <div className="flex justify-end gap-4 pt-4 border-t dark:border-gray-700">
                    <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
                    <Button type="submit" isLoading={isLoading}>Đặt lại</Button>
                </div>
            </form>
        </Modal>
    );
};


interface ForgotPasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}
type VerifiedUser = (Student | Teacher | Staff) & { role: UserRole };
export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose }) => {
    const { state, updateUserPassword } = useData();
    const { toast } = useToast();
    const [step, setStep] = useState(1);
    const [identifier, setIdentifier] = useState('');
    const [dob, setDob] = useState('');
    const [phone, setPhone] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [verifiedUser, setVerifiedUser] = useState<VerifiedUser | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setStep(1); setIdentifier(''); setDob(''); setPhone(''); setNewPassword(''); setConfirmPassword(''); setError(''); setIsLoading(false); setVerifiedUser(null);
        }
    }, [isOpen]);
    
    const findUser = (id: string): VerifiedUser | null => {
        const upperId = id.toUpperCase();
        const student = state.students.find(s => s.id.toUpperCase() === upperId);
        if(student) return {...student, role: UserRole.PARENT };
        const teacher = state.teachers.find(t => t.id.toUpperCase() === upperId);
        if(teacher) return {...teacher, role: UserRole.TEACHER };
        const staff = state.staff.find(s => s.id.toUpperCase() === upperId);
        if(staff) return {...staff, role: staff.role };
        return null;
    }

    const handleStep1 = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const user = findUser(identifier);
        if (user) {
            setVerifiedUser(user);
            setStep(2);
        } else {
            setError('Không tìm thấy người dùng với mã số này.');
        }
    };
    const handleStep2 = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (verifiedUser?.dob === dob && verifiedUser?.phone.slice(-4) === phone.slice(-4)) {
            setStep(3);
        } else {
            setError('Thông tin xác minh không chính xác. Vui lòng thử lại.');
        }
    };
    const handleStep3 = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (newPassword !== confirmPassword) { setError('Mật khẩu không khớp.'); return; }
        if (newPassword.length < 6) { setError('Mật khẩu phải có ít nhất 6 ký tự.'); return; }
        if (!verifiedUser) { setError('Đã xảy ra lỗi. Vui lòng bắt đầu lại.'); return; }

        setIsLoading(true);
        try {
            await updateUserPassword({ userId: verifiedUser.id, role: verifiedUser.role, newPassword });
            toast.success('Đặt lại mật khẩu thành công! Bây giờ bạn có thể đăng nhập.');
            onClose();
        } catch (err) {
            toast.error('Lỗi khi đặt lại mật khẩu.');
        } finally {
            setIsLoading(false);
        }
    };

    const renderContent = () => {
        switch (step) {
            case 1:
                return (
                    <form onSubmit={handleStep1} className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Nhập mã số của bạn (Mã học viên, Mã giáo viên,...) để bắt đầu.</p>
                        <div>
                            <label className="block text-sm font-medium">Mã số</label>
                            <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)} className="form-input mt-1" required />
                        </div>
                        <Button type="submit" className="w-full">Tiếp tục</Button>
                    </form>
                );
            case 2:
                return (
                    <form onSubmit={handleStep2} className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Để xác minh danh tính, vui lòng nhập ngày sinh và 4 số cuối của số điện thoại đã đăng ký.</p>
                        <div>
                            <label className="block text-sm font-medium">Ngày sinh</label>
                            <input type="date" value={dob} onChange={e => setDob(e.target.value)} className="form-input mt-1" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">4 số cuối SĐT</label>
                            <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="form-input mt-1" required maxLength={4} />
                        </div>
                        <Button type="submit" className="w-full">Xác minh</Button>
                    </form>
                );
            case 3:
                return (
                    <form onSubmit={handleStep3} className="space-y-4">
                         <p className="text-sm text-gray-600 dark:text-gray-400">Xác minh thành công! Vui lòng tạo mật khẩu mới.</p>
                        <div>
                            <label className="block text-sm font-medium">Mật khẩu mới</label>
                            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="form-input mt-1" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Xác nhận mật khẩu mới</label>
                            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="form-input mt-1" required />
                        </div>
                        <Button type="submit" isLoading={isLoading} className="w-full">Đặt lại mật khẩu</Button>
                    </form>
                );
            default: return null;
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Quên mật khẩu">
            <div className="space-y-4">
                {error && <p className="text-red-500 text-sm p-3 bg-red-50 dark:bg-red-900/20 rounded-md">{error}</p>}
                {renderContent()}
            </div>
        </Modal>
    );
};