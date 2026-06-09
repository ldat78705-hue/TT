import React from 'react';
import { NavLink } from 'react-router-dom';
import { ROUTES, ICONS } from '../../constants';
import { UserRole } from '../../types';
import { useAuth } from '../../hooks/useAuth';

interface BottomNavProps {
  onMenuClick: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onMenuClick }) => {
  const { role } = useAuth();

  const getLinkClass = ({ isActive }: { isActive: boolean }) => {
    const baseClasses = "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-200";
    const activeClasses = "text-primary font-semibold";
    const inactiveClasses = "text-gray-500 dark:text-gray-400 hover:text-primary";
    return isActive ? `${baseClasses} ${activeClasses}` : `${baseClasses} ${inactiveClasses}`;
  };

  const isFinanceVisible = role === UserRole.ADMIN || role === UserRole.MANAGER || role === UserRole.ACCOUNTANT || role === UserRole.VIEWER;

  return (
    <div className="fixed bottom-0 left-0 z-50 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-t border-slate-200/60 dark:border-slate-800/60 md:hidden shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] print:hidden pb-safe">
      <div className="grid h-16 max-w-lg grid-cols-5 mx-auto font-medium">
        <NavLink to={ROUTES.DASHBOARD} className={getLinkClass} end>
          {React.cloneElement(ICONS.dashboard, { className: "w-6 h-6 mb-0.5" })}
          <span className="text-[10px]">Tổng quan</span>
        </NavLink>
        
        <NavLink to={ROUTES.CLASSES} className={getLinkClass}>
          {React.cloneElement(ICONS.classes, { className: "w-6 h-6 mb-0.5" })}
          <span className="text-[10px]">Lớp học</span>
        </NavLink>

        <NavLink to={ROUTES.STUDENTS} className={getLinkClass}>
          {React.cloneElement(ICONS.students, { className: "w-6 h-6 mb-0.5" })}
          <span className="text-[10px]">Học viên</span>
        </NavLink>

        {isFinanceVisible && (
             <NavLink to={ROUTES.FINANCE} className={getLinkClass}>
                {React.cloneElement(ICONS.finance, { className: "w-6 h-6 mb-0.5" })}
                <span className="text-[10px]">Tài chính</span>
            </NavLink>
        )}

        <button type="button" onClick={onMenuClick} className="flex flex-col items-center justify-center w-full h-full text-slate-500 dark:text-slate-400 hover:text-primary transition-colors duration-200">
           {React.cloneElement(ICONS.menu, { className: "w-6 h-6 mb-0.5" })}
           <span className="text-[10px]">Menu</span>
        </button>
      </div>
    </div>
  );
};
