import React, { useMemo, useState } from 'react';
import { useData } from '../../hooks/useDataContext';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { Check } from 'lucide-react';

interface OnboardingStep {
    id: string;
    title: string;
    description: string;
    link: string;
    linkText: string;
    icon: string;
    check: () => boolean;
}

export const OnboardingWizard: React.FC = () => {
    const { state } = useData();
    const [isDismissed, setIsDismissed] = useState(() => {
        return sessionStorage.getItem('onboarding_dismissed') === 'true';
    });

    const steps = useMemo<OnboardingStep[]>(() => [
        {
            id: 'settings',
            title: 'Cấu hình Trung tâm',
            description: 'Cập nhật tên, địa chỉ, logo, thông tin ngân hàng',
            link: ROUTES.SETTINGS,
            linkText: 'Cài đặt',
            icon: '⚙️',
            check: () => !!(state.settings.name && state.settings.name !== 'EduCenter Pro' && state.settings.address),
        },
        {
            id: 'teachers',
            title: 'Thêm Giáo viên',
            description: 'Tạo hồ sơ giáo viên để phân lớp',
            link: ROUTES.TEACHERS,
            linkText: 'Giáo viên',
            icon: '👨‍🏫',
            check: () => state.teachers.length > 0,
        },
        {
            id: 'rooms',
            title: 'Tạo Phòng học',
            description: 'Thiết lập phòng học để xếp lịch',
            link: ROUTES.ROOMS,
            linkText: 'Phòng học',
            icon: '🏫',
            check: () => state.rooms.length > 0,
        },
        {
            id: 'classes',
            title: 'Tạo Lớp học',
            description: 'Thiết lập lớp học với lịch và học phí',
            link: ROUTES.CLASSES,
            linkText: 'Lớp học',
            icon: '📚',
            check: () => state.classes.length > 0,
        },
        {
            id: 'students',
            title: 'Thêm Học viên',
            description: 'Nhập danh sách học viên và xếp lớp',
            link: ROUTES.STUDENTS,
            linkText: 'Học viên',
            icon: '🎓',
            check: () => state.students.length > 0,
        },
    ], [state]);

    const completedCount = steps.filter(s => s.check()).length;
    const allDone = completedCount === steps.length;
    const progress = Math.round((completedCount / steps.length) * 100);

    if (isDismissed || allDone) return null;

    return (
        <div className="card-base mb-6 border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        🚀 Bắt đầu sử dụng
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Hoàn thành {completedCount}/{steps.length} bước để sẵn sàng vận hành
                    </p>
                </div>
                <button
                    onClick={() => {
                        setIsDismissed(true);
                        sessionStorage.setItem('onboarding_dismissed', 'true');
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                    Ẩn hướng dẫn
                </button>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-4">
                <div 
                    className="bg-primary h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Steps */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {steps.map((step, index) => {
                    const done = step.check();
                    return (
                        <Link
                            key={step.id}
                            to={step.link}
                            className={`relative p-3 rounded-xl border transition-all hover:shadow-md ${
                                done
                                    ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary/50'
                            }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">{step.icon}</span>
                                <span className="text-xs text-slate-400 font-mono">#{index + 1}</span>
                                {done && (
                                    <span className="ml-auto">
                                        <Check size={16} className="text-green-500" />
                                    </span>
                                )}
                            </div>
                            <h3 className={`font-semibold text-sm ${done ? 'text-green-700 dark:text-green-300 line-through' : ''}`}>
                                {step.title}
                            </h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{step.description}</p>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
};
