import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants';

// Default content - can be overridden by super admin via CMS
const DEFAULT_LANDING = {
    heroTagline: 'Miễn phí 3 tháng đầu — Không cần thẻ tín dụng',
    heroTitle1: 'Quản lý trung tâm',
    heroTitle2: 'dạy thêm chuyên nghiệp',
    heroDesc: 'Từ điểm danh, quản lý học viên, tài chính đến thông báo phụ huynh — tất cả trong một nền tảng duy nhất. Dùng trên Web lẫn App Android.',
    heroCtaPrimary: '🚀 Dùng thử miễn phí',
    heroCtaSecondary: '📖 Xem hướng dẫn',
    heroFootnote: 'Đang được tin dùng bởi các trung tâm dạy thêm tại Việt Nam',
    featuresTitle: 'Tất cả những gì bạn cần',
    featuresSubtitle: 'Giải pháp toàn diện cho trung tâm dạy thêm mọi quy mô',
    features: [
        { icon: '📋', title: 'Điểm danh thông minh', desc: 'Quét QR hoặc chấm thủ công. Tự động tính buổi, gửi thông báo vắng cho phụ huynh qua Zalo.' },
        { icon: '👨‍🎓', title: 'Quản lý học viên', desc: 'Hồ sơ chi tiết, theo dõi công nợ, phân lớp, in thẻ QR hàng loạt. Tìm kiếm nhanh chóng.' },
        { icon: '💰', title: 'Tài chính minh bạch', desc: 'Thu học phí, ghi nhận thu chi, tính lương giáo viên tự động. Báo cáo doanh thu trực quan.' },
        { icon: '📊', title: 'Báo cáo chi tiết', desc: 'Biểu đồ doanh thu, chuyên cần, top nợ. Xuất Excel mọi dữ liệu. Nắm bắt toàn cảnh.' },
        { icon: '📱', title: 'App Android', desc: 'Điểm danh, quản lý mọi lúc mọi nơi trên điện thoại. Hoạt động offline, tự đồng bộ.' },
        { icon: '👨‍👩‍👧', title: 'Cổng phụ huynh', desc: 'Phụ huynh tự xem điểm danh, công nợ, đánh giá học tập. Minh bạch, chuyên nghiệp.' },
        { icon: '🔐', title: 'Phân quyền linh hoạt', desc: 'Admin, quản lý, giáo viên, kế toán — mỗi vai trò có quyền truy cập phù hợp.' },
        { icon: '📢', title: 'Thông báo & Lịch', desc: 'Gửi thông báo nhắc học phí, lịch nghỉ. Lịch tuần với giao diện trực quan.' },
        { icon: '☁️', title: 'Dữ liệu an toàn', desc: 'Lưu trữ đám mây Firebase. Tự động sao lưu, đồng bộ real-time giữa Web và App.' },
    ],
    pricingTitle: 'Bảng giá minh bạch',
    pricingSubtitle: 'Bắt đầu miễn phí, nâng cấp khi sẵn sàng',
    plans: [
        {
            name: 'Dùng thử', price: '0₫', period: '3 tháng đầu tiên', subtitle: '',
            items: ['Đầy đủ tính năng', 'Tối đa 50 học viên', 'Web + App Android', 'Cổng phụ huynh', 'Không cần thẻ tín dụng'],
            cta: 'Bắt đầu miễn phí', highlight: false, color: 'emerald'
        },
        {
            name: 'Cơ bản', price: '199K', period: '/tháng', subtitle: 'Khoảng 6.600₫/ngày',
            items: ['Đầy đủ tính năng', 'Tối đa 200 học viên', 'Web + App Android', 'Cổng phụ huynh', 'Hỗ trợ qua Zalo', 'Sao lưu tự động'],
            cta: 'Chọn gói này', highlight: true, color: 'blue', badge: 'PHỔ BIẾN NHẤT'
        },
        {
            name: 'Nâng cao', price: '399K', period: '/tháng', subtitle: 'Khoảng 13.300₫/ngày',
            items: ['Mọi tính năng gói Cơ bản', 'Không giới hạn học viên', 'Nhiều chi nhánh', 'Zalo OA gửi tin tự động', 'Hỗ trợ ưu tiên 24/7', 'Tùy chỉnh theo yêu cầu'],
            cta: 'Liên hệ tư vấn', highlight: false, color: 'violet'
        },
    ],
    ctaTitle: 'Sẵn sàng chuyên nghiệp hóa?',
    ctaDesc: 'Đăng ký ngay để trải nghiệm 3 tháng miễn phí. Không ràng buộc, hủy bất cứ lúc nào.',
    ctaButton: '🚀 Dùng thử miễn phí ngay',
};

export const LandingPage: React.FC = () => {
    const [content, setContent] = useState(DEFAULT_LANDING);

    useEffect(() => {
        fetch('/api/centers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_site_content' })
        })
        .then(r => r.json())
        .then(data => {
            if (data.content?.landing) {
                setContent(prev => ({ ...prev, ...data.content.landing }));
            }
        })
        .catch(() => {}); // silently fall back to defaults
    }, []);

    const c = content;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white overflow-x-hidden">
            {/* Navigation */}
            <nav className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/70 border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center font-black text-sm shadow-lg shadow-blue-500/25">E</div>
                        <span className="font-bold text-lg tracking-tight">EduCenter Pro</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link to={ROUTES.GUIDE} className="text-sm text-slate-300 hover:text-white transition-colors px-3 py-2">Hướng dẫn</Link>
                        <Link to={ROUTES.LOGIN} className="px-5 py-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 rounded-full text-sm font-semibold transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40">
                            Đăng nhập →
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-20 pb-32 px-4">
                <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute top-40 right-1/4 w-80 h-80 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
                
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-sm text-blue-300 mb-8">
                        <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span></span>
                        {c.heroTagline}
                    </div>
                    
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tight">
                        {c.heroTitle1}<br/>
                        <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
                            {c.heroTitle2}
                        </span>
                    </h1>
                    
                    <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
                        {c.heroDesc}
                    </p>

                    <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link to={ROUTES.LOGIN} className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 rounded-2xl text-base font-bold transition-all shadow-2xl shadow-blue-600/30 hover:shadow-blue-500/50 hover:scale-105">
                            {c.heroCtaPrimary}
                        </Link>
                        <Link to={ROUTES.GUIDE} className="px-8 py-3.5 border border-white/10 hover:bg-white/5 rounded-2xl text-base font-semibold transition-all hover:border-white/20">
                            {c.heroCtaSecondary}
                        </Link>
                    </div>

                    <p className="mt-6 text-sm text-slate-500">{c.heroFootnote}</p>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-24 px-4 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/30 to-transparent pointer-events-none" />
                <div className="max-w-6xl mx-auto relative z-10">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl sm:text-4xl font-black">{c.featuresTitle}</h2>
                        <p className="mt-4 text-slate-400 text-lg">{c.featuresSubtitle}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {(c.features || []).map((f: any, i: number) => (
                            <div key={i} className="group p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/5">
                                <div className="text-3xl mb-4">{f.icon}</div>
                                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section className="py-24 px-4" id="pricing">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl sm:text-4xl font-black">{c.pricingTitle}</h2>
                        <p className="mt-4 text-slate-400 text-lg">{c.pricingSubtitle}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {(c.plans || []).map((plan: any, i: number) => (
                            <div key={i} className={`p-8 rounded-2xl flex flex-col ${plan.highlight 
                                ? 'bg-gradient-to-b from-blue-600/10 to-violet-600/10 border-2 border-blue-500/30 relative shadow-xl shadow-blue-500/10'
                                : 'bg-white/[0.03] border border-white/[0.08]'}`}>
                                {plan.badge && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-600 to-violet-600 rounded-full text-xs font-bold">{plan.badge}</div>
                                )}
                                <div className={`text-sm font-semibold uppercase tracking-wider mb-2 text-${plan.color}-400`}>{plan.name}</div>
                                <div className="text-4xl font-black">{plan.price}<span className="text-lg font-medium text-slate-400">{plan.period.startsWith('/') ? plan.period : ''}</span></div>
                                {!plan.period.startsWith('/') && <div className="text-sm text-slate-400 mt-1">{plan.period}</div>}
                                {plan.subtitle && <div className="text-sm text-slate-400 mt-1">{plan.subtitle}</div>}
                                <hr className="border-white/10 my-6" />
                                <ul className="space-y-3 text-sm text-slate-300 flex-1">
                                    {(plan.items || []).map((item: string, j: number) => (
                                        <li key={j} className="flex items-start gap-2">
                                            <span className={`text-${plan.color}-400 mt-0.5`}>✓</span>
                                            {item.includes('Không giới hạn') ? <strong className="text-white">{item}</strong> : item}
                                        </li>
                                    ))}
                                </ul>
                                <Link to={ROUTES.LOGIN} className={`mt-8 block w-full text-center py-3 rounded-xl font-semibold transition-all ${plan.highlight
                                    ? 'bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 font-bold shadow-lg shadow-blue-600/20'
                                    : 'border border-white/10 hover:bg-white/5'}`}>
                                    {plan.cta}
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 px-4 relative">
                <div className="absolute inset-0 bg-gradient-to-t from-blue-950/50 to-transparent pointer-events-none" />
                <div className="max-w-3xl mx-auto text-center relative z-10">
                    <h2 className="text-3xl sm:text-4xl font-black">{c.ctaTitle}</h2>
                    <p className="mt-4 text-slate-400 text-lg">{c.ctaDesc}</p>
                    <div className="mt-8">
                        <Link to={ROUTES.LOGIN} className="inline-block px-10 py-4 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 rounded-2xl text-lg font-bold transition-all shadow-2xl shadow-blue-600/30 hover:shadow-blue-500/50 hover:scale-105">
                            {c.ctaButton}
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/5 py-12 px-4">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-violet-600 rounded-lg flex items-center justify-center font-black text-xs">E</div>
                        <span className="font-bold">EduCenter Pro</span>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-slate-400">
                        <Link to={ROUTES.GUIDE} className="hover:text-white transition-colors">Hướng dẫn sử dụng</Link>
                        <Link to={ROUTES.LOGIN} className="hover:text-white transition-colors">Đăng nhập</Link>
                    </div>
                    <p className="text-xs text-slate-600">© 2026 EduCenter Pro. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

// Export defaults for CMS editor
export const LANDING_DEFAULTS = DEFAULT_LANDING;
