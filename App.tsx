

import React, { useMemo, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { DataProvider } from './context/DataContext';
import { useData } from './hooks/useDataContext';
import { ToastProvider } from './context/ToastContext';
import { ToastContainer } from './components/common/Toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Layouts
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ParentHeader } from './components/layout/ParentHeader';
import { BottomNav } from './components/layout/BottomNav'; // Import BottomNav

// Screens
const DashboardScreen = React.lazy(() => import('./screens/DashboardScreen').then(m => ({ default: m.DashboardScreen })));
const StudentsScreen = React.lazy(() => import('./screens/StudentsScreen').then(m => ({ default: m.StudentsScreen })));
const TeachersScreen = React.lazy(() => import('./screens/TeachersScreen').then(m => ({ default: m.TeachersScreen })));
const StaffScreen = React.lazy(() => import('./screens/StaffScreen').then(m => ({ default: m.StaffScreen })));
const ClassesScreen = React.lazy(() => import('./screens/ClassesScreen').then(m => ({ default: m.ClassesScreen })));
const LoginScreen = React.lazy(() => import('./screens/LoginScreen').then(m => ({ default: m.LoginScreen })));
const ClassDetailScreen = React.lazy(() => import('./screens/ClassDetailScreen').then(m => ({ default: m.ClassDetailScreen })));
const AttendanceScreen = React.lazy(() => import('./screens/AttendanceScreen').then(m => ({ default: m.AttendanceScreen })));
const AttendanceHubScreen = React.lazy(() => import('./screens/AttendanceHubScreen').then(m => ({ default: m.AttendanceHubScreen })));
const FinanceScreen = React.lazy(() => import('./screens/FinanceScreen').then(m => ({ default: m.FinanceScreen })));
const ReportsScreen = React.lazy(() => import('./screens/ReportsScreen').then(m => ({ default: m.ReportsScreen })));
const StudentDetailScreen = React.lazy(() => import('./screens/StudentDetailScreen').then(m => ({ default: m.StudentDetailScreen })));
const TeacherDetailScreen = React.lazy(() => import('./screens/TeacherDetailScreen').then(m => ({ default: m.TeacherDetailScreen })));
const SettingsScreen = React.lazy(() => import('./screens/SettingsScreen').then(m => ({ default: m.SettingsScreen })));
const AnnouncementsScreen = React.lazy(() => import('./screens/AnnouncementsScreen').then(m => ({ default: m.AnnouncementsScreen })));
const RoomsScreen = React.lazy(() => import('./screens/RoomsScreen').then(m => ({ default: m.RoomsScreen })));
const AuditLogScreen = React.lazy(() => import('./screens/AuditLogScreen').then(m => ({ default: m.AuditLogScreen })));
// Parent Portal Screens
const ParentDashboardScreen = React.lazy(() => import('./screens/parent/ParentDashboardScreen').then(m => ({ default: m.ParentDashboardScreen })));
const ParentReportsScreen = React.lazy(() => import('./screens/parent/ParentReportsScreen').then(m => ({ default: m.ParentReportsScreen })));
const ParentFinanceScreen = React.lazy(() => import('./screens/parent/ParentFinanceScreen').then(m => ({ default: m.ParentFinanceScreen })));
const SuperAdminScreen = React.lazy(() => import('./screens/SuperAdminScreen').then(m => ({ default: m.SuperAdminScreen })));


import { UserRole } from './types';
import { ROUTES, ICONS } from './constants';
import { Button } from './components/common/Button';

// --- Components ---

const ThemeStyle: React.FC<{ themeColor: string; sidebarColor?: string }> = ({ themeColor, sidebarColor }) => {
  const styleContent = `
    :root { 
      --color-primary: ${themeColor}; 
      --color-primary-dark: ${themeColor}dd; 
      --color-sidebar-bg-dark: ${sidebarColor || '#1f2937'};
    }
  `;
  return <style>{styleContent}</style>;
};

const ProtectedRoute: React.FC<{children: React.ReactNode, allowedRoles: UserRole[]}> = ({ children, allowedRoles }) => {
    const { role, isAuthenticated } = useAuth();
    if (!isAuthenticated || !role || !allowedRoles.includes(role)) {
        return <Navigate to={ROUTES.LOGIN} replace />;
    }
    return <>{children}</>;
};

// --- Layouts ---

const AppLayout: React.FC = () => {
    const location = useLocation();
    const { error, setError, updateUserPassword } = useData();
    const { user, role } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [expiryWarning, setExpiryWarning] = useState<string | null>(null);
    const [showForceChangePwd, setShowForceChangePwd] = useState(false);
    const [newPwd, setNewPwd] = useState('');
    const [confirmPwd, setConfirmPwd] = useState('');
    const [changePwdLoading, setChangePwdLoading] = useState(false);
    const [changePwdError, setChangePwdError] = useState('');

    useEffect(() => {
        const warning = sessionStorage.getItem('center_expiry_warning');
        if (warning) setExpiryWarning(warning);
        const mustChange = sessionStorage.getItem('must_change_password');
        if (mustChange === 'true') setShowForceChangePwd(true);
    }, []);

    const handleForceChangePassword = async () => {
        setChangePwdError('');
        if (newPwd.length < 6) { setChangePwdError('Mật khẩu mới phải có ít nhất 6 ký tự.'); return; }
        if (newPwd !== confirmPwd) { setChangePwdError('Mật khẩu xác nhận không khớp.'); return; }
        setChangePwdLoading(true);
        try {
            await updateUserPassword({ userId: user?.id || '', role: role!, newPassword: newPwd });
            sessionStorage.removeItem('must_change_password');
            setShowForceChangePwd(false);
        } catch (err: any) {
            setChangePwdError(err.message || 'Lỗi đổi mật khẩu');
        }
        setChangePwdLoading(false);
    };
    
    const isAttendanceHub = location.pathname === ROUTES.ATTENDANCE_HUB;

    const pageTitle = useMemo(() => {
        const path = location.pathname;
        if (path.startsWith(ROUTES.CLASS_DETAIL.split('/:')[0])) return 'Chi tiết Lớp học';
        if (path.startsWith(ROUTES.STUDENT_DETAIL.split('/:')[0])) return 'Chi tiết Học viên';
        if (path.startsWith(ROUTES.TEACHER_DETAIL.split('/:')[0])) return 'Chi tiết Giáo viên';
        if (path.startsWith(ROUTES.ATTENDANCE_DETAIL.split('/:')[0])) return 'Điểm danh';

        switch (path) {
            case ROUTES.DASHBOARD: return 'Tổng quan';
            case ROUTES.STUDENTS: return 'Học viên';
            case ROUTES.TEACHERS: return 'Giáo viên';
            case ROUTES.STAFF: return 'Nhân viên';
            case ROUTES.CLASSES: return 'Lớp học';
            case ROUTES.ATTENDANCE_HUB: return 'Điểm danh';
            case ROUTES.FINANCE: return 'Tài chính';
            case ROUTES.ANNOUNCEMENTS: return 'Nhận xét & Đánh giá';
            case ROUTES.REPORTS: return 'Báo cáo';
            case ROUTES.SETTINGS: return 'Cài đặt';
            case ROUTES.ROOMS: return 'Phòng học';
            case ROUTES.AUDIT_LOG: return 'Lịch sử thao tác';
            default: return 'EduCenter Pro';
        }
    }, [location.pathname]);

    return (
        <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-900">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            <div className="flex-1 flex flex-col overflow-hidden relative">
                <Header pageTitle={pageTitle} onMenuClick={() => setIsSidebarOpen(true)} />
                {expiryWarning && (
                    <div className="bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-500 text-amber-800 dark:text-amber-200 p-3 mx-4 mt-2 md:mx-8 rounded-r-lg flex items-center justify-between gap-3" role="alert">
                        <p className="text-sm font-medium">{expiryWarning}</p>
                        <button onClick={() => { setExpiryWarning(null); sessionStorage.removeItem('center_expiry_warning'); }} className="text-amber-600 hover:text-amber-800 flex-shrink-0" aria-label="Đóng">
                            {React.cloneElement(ICONS.close, { className: 'w-4 h-4' })}
                        </button>
                    </div>
                )}
                <main className={`animate-fade-in ${isAttendanceHub ? "flex-1 overflow-hidden" : "flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 pb-28 md:pb-8"}`}>
                    {error && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-800 p-4 mb-6 rounded-xl relative shadow-sm" role="alert">
                            <p className="font-bold">Thao tác thất bại</p>
                            <p className="text-sm">{error}</p>
                            <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3" aria-label="Đóng">
                                {React.cloneElement(ICONS.close, { className: 'w-5 h-5' })}
                            </button>
                        </div>
                    )}
                    <React.Suspense fallback={<div className="flex justify-center items-center h-full p-8">{ICONS.loading}</div>}>
                        <Outlet />
                    </React.Suspense>
                </main>

                {/* Force Change Password Modal */}
                {showForceChangePwd && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 mx-auto bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
                                    <span className="text-3xl">🔐</span>
                                </div>
                                <h2 className="text-xl font-bold">Đổi mật khẩu bắt buộc</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Bạn đang dùng mật khẩu mặc định. Vui lòng đổi mật khẩu mới để bảo mật tài khoản.</p>
                            </div>
                            {changePwdError && <p className="text-red-500 text-sm mb-3 text-center">{changePwdError}</p>}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Mật khẩu mới</label>
                                    <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
                                        className="form-input" placeholder="Ít nhất 6 ký tự" autoFocus />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Xác nhận mật khẩu</label>
                                    <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                                        className="form-input" placeholder="Nhập lại mật khẩu mới" />
                                </div>
                                <Button className="w-full" onClick={handleForceChangePassword} isLoading={changePwdLoading}>Đổi mật khẩu</Button>
                            </div>
                        </div>
                    </div>
                )}
                <BottomNav onMenuClick={() => setIsSidebarOpen(true)} />
            </div>
        </div>
    );
};

const ParentLayout: React.FC = () => {
     const { error, setError } = useData();
    return (
        <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900">
            <ParentHeader />
            <main className="flex-1 container mx-auto px-4 py-6 pb-24 md:pb-6">
                 {error && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-800 p-4 mb-6 rounded-md relative shadow-md" role="alert">
                        <p className="font-bold">Thao tác thất bại</p>
                        <p className="text-sm">{error}</p>
                        <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3" aria-label="Đóng">
                            {React.cloneElement(ICONS.close, { className: 'w-5 h-5' })}
                        </button>
                    </div>
                )}
                <React.Suspense fallback={<div className="flex justify-center items-center h-full p-8">{ICONS.loading}</div>}>
                    <Outlet />
                </React.Suspense>
            </main>
        </div>
    );
};

const AppRoutes: React.FC = () => {
    const { isAuthenticated, role, isAuthLoading } = useAuth();
    const { state, isInitialOffline, error: initialError } = useData();

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove(state.settings.theme === 'dark' ? 'light' : 'dark');
        root.classList.add(state.settings.theme);
    }, [state.settings.theme]);

    useEffect(() => {
        if (state.settings.name) {
            document.title = state.settings.name;
        }
    }, [state.settings.name]);
    
    if (state.loading || isAuthLoading) {
         return (
            <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
                {ICONS.loading}
                <span className="ml-4 text-xl">Đang tải dữ liệu...</span>
            </div>
        )
    }

    if (isInitialOffline) {
        return (
            <div className="flex h-screen w-screen items-center justify-center flex-col p-8 text-center bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                <h1 className="text-2xl font-bold mt-4">Lỗi Tải Dữ liệu</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2 max-w-lg">{initialError}</p>
                <Button onClick={() => window.location.reload()} className="mt-6">
                    Tải lại trang
                </Button>
            </div>
        );
    }
    
    return (
        <>
            <ThemeStyle themeColor={state.settings.themeColor} sidebarColor={state.settings.sidebarColor} />
            <Routes>
                <Route path="/super-admin" element={
                    <React.Suspense fallback={<div className="flex h-screen w-screen items-center justify-center bg-slate-900">{ICONS.loading}</div>}>
                        <SuperAdminScreen />
                    </React.Suspense>
                } />
                <Route path={ROUTES.LOGIN} element={
                    <React.Suspense fallback={<div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-900">{ICONS.loading}</div>}>
                        <LoginScreen />
                    </React.Suspense>
                } />
                
                {/* Admin/Staff Routes */}
                <Route element={
                    <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.TEACHER, UserRole.VIEWER]}>
                        <AppLayout />
                    </ProtectedRoute>
                }>
                    <Route path={ROUTES.DASHBOARD} element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER, UserRole.VIEWER]}><DashboardScreen /></ProtectedRoute>} />
                    <Route path={ROUTES.CLASSES} element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER, UserRole.VIEWER]}><ClassesScreen /></ProtectedRoute>} />
                    <Route path={ROUTES.CLASS_DETAIL} element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER, UserRole.VIEWER]}><ClassDetailScreen /></ProtectedRoute>} />
                    <Route path={ROUTES.ATTENDANCE_DETAIL} element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER, UserRole.VIEWER]}><AttendanceScreen /></ProtectedRoute>} />

                    {/* Role-protected routes */}
                    <Route path={ROUTES.STUDENTS} element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.VIEWER]}><StudentsScreen /></ProtectedRoute>} />
                    <Route path={ROUTES.STUDENT_DETAIL} element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.VIEWER]}><StudentDetailScreen /></ProtectedRoute>} />
                    <Route path={ROUTES.TEACHERS} element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER]}><TeachersScreen /></ProtectedRoute>} />
                    <Route path={ROUTES.TEACHER_DETAIL} element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER]}><TeacherDetailScreen /></ProtectedRoute>} />
                    <Route path={ROUTES.STAFF} element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER]}><StaffScreen /></ProtectedRoute>} />
                    <Route path={ROUTES.ATTENDANCE_HUB} element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER]}><AttendanceHubScreen /></ProtectedRoute>} />
                    <Route path={ROUTES.FINANCE} element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.VIEWER]}><FinanceScreen /></ProtectedRoute>} />
                    <Route path={ROUTES.REPORTS} element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER]}><ReportsScreen /></ProtectedRoute>} />
                    <Route path={ROUTES.SETTINGS} element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.VIEWER]}><SettingsScreen /></ProtectedRoute>} />
                    <Route path={ROUTES.ANNOUNCEMENTS} element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER, UserRole.VIEWER]}><AnnouncementsScreen /></ProtectedRoute>} />
                    <Route path={ROUTES.ROOMS} element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER]}><RoomsScreen /></ProtectedRoute>} />
                    <Route path={ROUTES.AUDIT_LOG} element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.VIEWER]}><AuditLogScreen /></ProtectedRoute>} />
                </Route>

                {/* Parent Portal Routes */}
                <Route element={
                    <ProtectedRoute allowedRoles={[UserRole.PARENT]}>
                        <ParentLayout />
                    </ProtectedRoute>
                }>
                    <Route path={ROUTES.PARENT_DASHBOARD} element={<ParentDashboardScreen />} />
                    <Route path={ROUTES.PARENT_REPORTS} element={<ParentReportsScreen />} />
                    <Route path={ROUTES.PARENT_FINANCE} element={<ParentFinanceScreen />} />
                </Route>

                <Route path="*" element={<Navigate to={isAuthenticated ? (role === UserRole.PARENT ? ROUTES.PARENT_DASHBOARD : (role === UserRole.ACCOUNTANT ? ROUTES.FINANCE : ROUTES.DASHBOARD)) : ROUTES.LOGIN} replace />} />
            </Routes>
        </>
    );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <DataProvider>
          <AuthProvider>
              <ToastProvider>
                  <BrowserRouter>
                      <AppRoutes />
                  </BrowserRouter>
                  <ToastContainer />
              </ToastProvider>
          </AuthProvider>
      </DataProvider>
    </ErrorBoundary>
  );
};

export default App;