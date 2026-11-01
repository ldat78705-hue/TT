import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useData } from '../../hooks/useDataContext';
import { ROUTES, ICONS } from '../../constants';
import { Student } from '../../types';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';

export const ParentHeader: React.FC = () => {
    const { user, logout } = useAuth();
    const { state } = useData();
    const student = user as Student;
    const [isChangePasswordModalOpen, setChangePasswordModalOpen] = useState(false);

    const navLinks = [
        { to: ROUTES.PARENT_DASHBOARD, label: 'Tổng quan' },
        { to: ROUTES.PARENT_ATTENDANCE, label: 'Điểm danh' },
        { to: ROUTES.PARENT_REPORTS, label: 'Báo cáo' },
        { to: ROUTES.PARENT_FINANCE, label: 'Học phí' },
    ];

    const getLinkClass = ({ isActive }: { isActive: boolean }) => {
        const base = "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200";
        const active = "bg-primary/10 text-primary";
        const inactive = "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800";
        return isActive ? `${base} ${active}` : `${base} ${inactive}`;
    };

    return (
        <>
            <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg shadow-sm border-b border-slate-200/60 dark:border-slate-800/60 pt-safe">
                <div className="container mx-auto px-4">
                    <div className="h-20 flex items-center justify-between">
                        <div className="flex items-center gap-6">
                             <div className="h-10 flex items-center justify-center text-xl font-bold tracking-tight">
                                {state.settings.logoUrl 
                                    ? <img src={state.settings.logoUrl} alt="Logo" className="h-10 w-auto" /> 
                                    : <span className="text-slate-800 dark:text-white">{state.settings.name}</span>
                                }
                            </div>
                            <nav className="hidden md:flex items-center space-x-2">
                                 {navLinks.map(link => (
                                    <NavLink key={link.to} to={link.to} className={getLinkClass} end>
                                        {link.label}
                                    </NavLink>
                                ))}
                            </nav>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="font-semibold text-slate-800 dark:text-white leading-tight">{student?.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Phụ huynh</p>
                            </div>
                            <button
                                onClick={() => setChangePasswordModalOpen(true)}
                                className="p-2.5 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Đổi mật khẩu"
                            >
                                {ICONS.key}
                            </button>
                            <button onClick={logout} className="p-2.5 rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors" title="Đăng xuất">
                                {ICONS.logout}
                            </button>
                        </div>
                    </div>
                    {/* Mobile Navigation */}
                    <nav className="md:hidden flex items-center justify-around border-t border-slate-200/60 dark:border-slate-800/60 py-3 pb-safe">
                        {navLinks.map(link => (
                            <NavLink key={link.to} to={link.to} className={getLinkClass} end>
                                {link.label}
                            </NavLink>
                        ))}
                    </nav>
                </div>
            </header>
            <ChangePasswordModal isOpen={isChangePasswordModalOpen} onClose={() => setChangePasswordModalOpen(false)} />
        </>
    );
};