import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useData } from '../../hooks/useDataContext';
import { UserRole } from '../../types';
import { ROUTES, ICONS } from '../../constants';

const adminNavLinks = [
  { to: ROUTES.DASHBOARD, icon: ICONS.dashboard, label: 'Bảng điều khiển' },
  { to: ROUTES.STUDENTS, icon: ICONS.students, label: 'Học viên' },
  { to: ROUTES.TEACHERS, icon: ICONS.teachers, label: 'Giáo viên' },
  { to: ROUTES.STAFF, icon: ICONS.staff, label: 'Nhân viên' },
  { to: ROUTES.CLASSES, icon: ICONS.classes, label: 'Lớp học' },
  { to: ROUTES.ATTENDANCE_HUB, icon: ICONS.calendar, label: 'Lịch điểm danh' },
  { to: ROUTES.FINANCE, icon: ICONS.finance, label: 'Tài chính' },
  { to: ROUTES.ANNOUNCEMENTS, icon: ICONS.announcement, label: 'Tiến độ học tập' },
  { to: ROUTES.REPORTS, icon: ICONS.reports, label: 'Báo cáo' },
  { to: ROUTES.SETTINGS, icon: ICONS.settings, label: 'Cài đặt' },
];

const managerNavLinks = [
  { to: ROUTES.DASHBOARD, icon: ICONS.dashboard, label: 'Bảng điều khiển' },
  { to: ROUTES.STUDENTS, icon: ICONS.students, label: 'Học viên' },
  { to: ROUTES.TEACHERS, icon: ICONS.teachers, label: 'Giáo viên' },
  { to: ROUTES.STAFF, icon: ICONS.staff, label: 'Nhân viên' },
  { to: ROUTES.CLASSES, icon: ICONS.classes, label: 'Lớp học' },
  { to: ROUTES.ATTENDANCE_HUB, icon: ICONS.calendar, label: 'Lịch điểm danh' },
  { to: ROUTES.ANNOUNCEMENTS, icon: ICONS.announcement, label: 'Tiến độ học tập' },
  { to: ROUTES.REPORTS, icon: ICONS.reports, label: 'Báo cáo' },
];

const accountantNavLinks = [
    { to: ROUTES.DASHBOARD, icon: ICONS.dashboard, label: 'Bảng điều khiển' },
    { to: ROUTES.FINANCE, icon: ICONS.finance, label: 'Tài chính' },
];

const teacherNavLinks = [
    { to: ROUTES.DASHBOARD, icon: ICONS.dashboard, label: 'Bảng điều khiển' },
    { to: ROUTES.CLASSES, icon: ICONS.classes, label: 'Lớp học của tôi' },
    { to: ROUTES.ANNOUNCEMENTS, icon: ICONS.announcement, label: 'Tiến độ học tập' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { role } = useAuth();
  const { state } = useData();
  
  const getNavLinks = () => {
      switch (role) {
          case UserRole.ADMIN:
          case UserRole.VIEWER:
            return adminNavLinks;
          case UserRole.MANAGER: return managerNavLinks;
          case UserRole.ACCOUNTANT: return accountantNavLinks;
          case UserRole.TEACHER: return teacherNavLinks;
          default: return [];
      }
  }
  
  const navLinks = getNavLinks();

  const getLinkClass = ({ isActive }: { isActive: boolean }) => {
    const baseClasses = "flex items-center px-4 py-3 rounded-xl transition-all duration-200 font-medium mb-1";
    const activeClasses = "bg-primary text-white shadow-md shadow-primary/20";
    const inactiveClasses = "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-100";
    return isActive ? `${baseClasses} ${activeClasses}` : `${baseClasses} ${inactiveClasses}`;
  };

  return (
    <>
      {/* Overlay for mobile */}
      <div 
        className={`fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 md:hidden print:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      <aside 
        className={`fixed z-40 top-0 left-0 h-full w-72 flex-col flex-shrink-0 flex transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] md:relative md:translate-x-0 print:hidden ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl text-slate-800 dark:text-slate-200 border-r border-slate-200/60 dark:border-slate-800/60`}
      >
        <div className="h-20 flex items-center justify-center px-6 text-center text-xl font-bold border-b border-slate-200/60 dark:border-slate-800/60 truncate pt-safe">
          {state.settings.logoUrl ? <img src={state.settings.logoUrl} alt="Logo" className="h-10 w-auto" /> : <span className="text-primary text-2xl tracking-tight">{state.settings.name}</span>}
        </div>
        <nav className="flex-1 p-4 overflow-y-auto pb-safe">
          {navLinks.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === ROUTES.DASHBOARD} // Ensure exact match for dashboard
              className={getLinkClass}
              onClick={onClose} // Close sidebar on navigation
            >
              <span className="mr-3 opacity-90">{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
};