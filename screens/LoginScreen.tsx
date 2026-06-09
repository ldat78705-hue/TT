import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import { useToast } from '../hooks/useToast';
import { UserRole, CenterSettings } from '../types';
import { ROUTES, ICONS } from '../constants';
import { useData } from '../hooks/useDataContext';
import { ForgotPasswordModal } from '../components/auth/ChangePasswordModal';

const BrandHeader: React.FC<{ settings: CenterSettings }> = ({ settings }) => {
    const { loginHeaderContent } = settings;

    const defaultContent = `<p class="text-lg leading-7 text-indigo-200">Hệ thống quản lý dạy thêm, trung tâm thông minh.<br/>Toàn diện, hiệu quả và dễ sử dụng.</p>`;

    return (
        <div className="text-center md:text-left">
            <div 
                className="login-header-content"
                dangerouslySetInnerHTML={{ __html: loginHeaderContent || defaultContent }} 
            />
        </div>
    );
};

export const LoginScreen: React.FC = () => {
    const { login, isAuthenticated, role } = useAuth();
    const { state } = useData();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [isForgotPasswordModalOpen, setForgotPasswordModalOpen] = useState(false);
    
    useEffect(() => {
        if (isAuthenticated) {
            const destination = role === UserRole.PARENT ? ROUTES.PARENT_DASHBOARD : ROUTES.DASHBOARD;
            navigate(destination, { replace: true });
        }
    }, [isAuthenticated, role, navigate]);
    
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        const success = await login(identifier, password);
        if (!success) {
            toast.error("Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.");
        }
        setIsLoading(false);
    };

    return (
      <>
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden" id="login-context">
            <div className="login-area">
                <ul className="circles">
                    <li></li><li></li><li></li><li></li><li></li>
                    <li></li><li></li><li></li><li></li><li></li>
                </ul>
            </div>
            <div className="relative z-10 w-full max-w-6xl mx-auto p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                    
                    {/* Left Visual Panel */}
                    <div className="hidden md:flex flex-col justify-center items-start">
                        <BrandHeader settings={state.settings} />
                    </div>

                    {/* Right Login Form Panel */}
                    <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 sm:p-12 w-full max-w-md mx-auto">
                         <div className="text-center mb-8">
                            {state.settings.logoUrl ? (
                                <img src={state.settings.logoUrl} alt="Logo" className="h-16 w-auto mx-auto mb-4" />
                            ) : (
                                <h1 className="text-3xl font-bold tracking-tight text-primary">{state.settings.name || 'EduCenter Pro'}</h1>
                            )}
                        </div>

                        <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2 text-center">Đăng nhập</h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-8 text-center">Chào mừng bạn quay trở lại!</p>
                        
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div>
                                <label htmlFor="identifier" className="block text-sm font-medium">Tên đăng nhập / Mã số</label>
                                <div className="relative mt-1">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                                        {React.cloneElement(ICONS.user, { className: "w-5 h-5"})}
                                    </span>
                                    <input
                                        id="identifier"
                                        type="text"
                                        value={identifier}
                                        onChange={e => setIdentifier(e.target.value)}
                                        placeholder="Mã số hoặc 'admin'"
                                        className="form-input pl-10"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between items-center">
                                    <label htmlFor="password"className="block text-sm font-medium">Mật khẩu</label>
                                    <button type="button" onClick={() => setForgotPasswordModalOpen(true)} className="text-sm font-medium text-primary hover:underline">
                                        Quên mật khẩu?
                                    </button>
                                </div>
                                <div className="relative mt-1">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                                        {React.cloneElement(ICONS.lock, { className: "w-5 h-5"})}
                                    </span>
                                    <input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="Mật khẩu"
                                        className="form-input pl-10"
                                        required
                                    />
                                </div>
                            </div>
                            <Button type="submit" className="w-full !py-3 text-lg" isLoading={isLoading}>Đăng nhập</Button>
                        </form>
                        
                        <div className="mt-8 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                            <h4 className="font-semibold text-center mb-3 text-gray-600 dark:text-gray-300">Hướng dẫn đăng nhập</h4>
                            <ul className="space-y-3">
                                <li className="flex gap-2">
                                    <strong className="font-bold w-16 text-right flex-shrink-0">Quản trị:</strong>
                                    <span>Dùng tài khoản <code className="font-mono bg-gray-200 dark:bg-gray-600 px-1 rounded">admin</code>, mật khẩu mặc định là <code className="font-mono bg-gray-200 dark:bg-gray-600 px-1 rounded">123456</code>.</span>
                                </li>
                                <li className="flex gap-2">
                                    <strong className="font-bold w-16 text-right flex-shrink-0">GV / NV:</strong>
                                    <span>Dùng mã số được cấp. Mật khẩu mặc định là ngày sinh (định dạng ddmmyyyy).</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <ForgotPasswordModal isOpen={isForgotPasswordModalOpen} onClose={() => setForgotPasswordModalOpen(false)} />
      </>
    );
};