import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants';

// Default content - can be overridden by super admin via CMS
const DEFAULT_LANDING = {
    heroTagline: 'Miễn phí 3 tháng đầu — Không cần thẻ tín dụng',
    heroTitle1: 'Quản lý trung tâm',
    heroTitle2: 'dạy thêm chuyên nghiệp',
    heroDesc: 'Từ điểm danh, quản lý học viên, tài chính đến thông báo phụ huynh — tất cả trong một nền tảng duy nhất. Dùng trên Web lẫn App Android.',
    heroCtaPrimary: 'Dùng thử miễn phí',
    heroCtaSecondary: 'Xem hướng dẫn',
    heroFootnote: 'Đang được tin dùng bởi các trung tâm dạy thêm tại Việt Nam',
    featuresTitle: 'Tất cả những gì bạn cần',
    featuresSubtitle: 'Giải pháp toàn diện giúp bạn tập trung vào giảng dạy',
    features: [
        { icon: '📋', title: 'Điểm danh QR', desc: 'Quét mã QR hoặc chấm thủ công. Tự động tính buổi, thông báo vắng.' },
        { icon: '👨‍🎓', title: 'Quản lý học viên', desc: 'Hồ sơ chi tiết, công nợ, phân lớp, in thẻ QR hàng loạt.' },
        { icon: '💰', title: 'Tài chính minh bạch', desc: 'Thu học phí, ghi thu chi, tính lương giáo viên tự động.' },
        { icon: '📊', title: 'Báo cáo chi tiết', desc: 'Biểu đồ doanh thu, chuyên cần, xuất Excel mọi dữ liệu.' },
        { icon: '📱', title: 'App Android', desc: 'Quản lý mọi lúc trên điện thoại, hoạt động offline.' },
        { icon: '👨‍👩‍👧', title: 'Cổng phụ huynh', desc: 'Phụ huynh tự xem điểm danh, công nợ, đánh giá.' },
    ],
    pricingTitle: 'Bảng giá',
    pricingSubtitle: 'Đơn giản, minh bạch. Chọn gói phù hợp với quy mô của bạn.',
    plans: [
        {
            name: 'Dùng thử', price: '0₫', period: '3 tháng đầu', subtitle: 'Trải nghiệm đầy đủ',
            items: ['Tất cả tính năng', 'Tối đa 50 học viên', 'Web + App Android', 'Cổng phụ huynh'],
            cta: 'Bắt đầu miễn phí', highlight: false
        },
        {
            name: 'Cơ bản', price: '199K', period: '/tháng', subtitle: '~6.600₫/ngày',
            items: ['Tất cả tính năng', 'Tối đa 200 học viên', 'Web + App Android', 'Cổng phụ huynh', 'Sao lưu tự động', 'Hỗ trợ qua Zalo'],
            cta: 'Chọn gói này', highlight: true, badge: 'PHỔ BIẾN'
        },
        {
            name: 'Nâng cao', price: '499K', period: '/tháng', subtitle: '~16.600₫/ngày',
            items: ['Mọi tính năng Cơ bản', 'Không giới hạn học viên', 'Nhiều chi nhánh', 'Zalo OA tự động', 'Hỗ trợ ưu tiên 24/7', 'Tùy chỉnh theo yêu cầu'],
            cta: 'Liên hệ tư vấn', highlight: false
        },
    ],
    ctaTitle: 'Sẵn sàng chuyên nghiệp hóa?',
    ctaDesc: 'Đăng ký ngay — 3 tháng miễn phí, không ràng buộc.',
    ctaButton: 'Dùng thử miễn phí ngay',
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
        .catch(() => {});
    }, []);

    const c = content;

    return (
        <div style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }} className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
            {/* Google Font */}
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

            {/* Navigation */}
            <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
                <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-sm">E</div>
                        <span className="font-bold text-base text-slate-900">EduCenter Pro</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link to={ROUTES.GUIDE} className="text-sm text-slate-500 hover:text-slate-900 transition-colors hidden sm:inline-block">Hướng dẫn</Link>
                        <Link to={ROUTES.LOGIN} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors">
                            Đăng nhập
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="pt-20 pb-24 px-5">
                <div className="max-w-3xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-sm text-emerald-700 font-medium mb-8">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        {c.heroTagline}
                    </div>
                    
                    <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight text-slate-900">
                        {c.heroTitle1}{' '}
                        <span className="text-indigo-600">{c.heroTitle2}</span>
                    </h1>
                    
                    <p className="mt-5 text-lg text-slate-500 max-w-xl mx-auto leading-relaxed">
                        {c.heroDesc}
                    </p>

                    <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                        <Link to={ROUTES.LOGIN} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-200 hover:shadow-indigo-300">
                            {c.heroCtaPrimary} →
                        </Link>
                        <Link to={ROUTES.GUIDE} className="px-6 py-3 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl text-sm font-semibold text-slate-700 transition-all">
                            {c.heroCtaSecondary}
                        </Link>
                    </div>

                    <p className="mt-6 text-xs text-slate-400">{c.heroFootnote}</p>
                </div>
            </section>

            {/* Features */}
            <section className="py-20 px-5 bg-slate-50">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{c.featuresTitle}</h2>
                        <p className="mt-3 text-slate-500">{c.featuresSubtitle}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {(c.features || []).map((f: any, i: number) => (
                            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-50 transition-all duration-300">
                                <div className="text-2xl mb-3">{f.icon}</div>
                                <h3 className="text-base font-bold text-slate-900 mb-1.5">{f.title}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing */}
            <section className="py-20 px-5" id="pricing">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{c.pricingTitle}</h2>
                        <p className="mt-3 text-slate-500">{c.pricingSubtitle}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {(c.plans || []).map((plan: any, i: number) => (
                            <div key={i} className={`p-7 rounded-2xl flex flex-col relative ${plan.highlight 
                                ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-200 ring-1 ring-indigo-600 scale-[1.02]'
                                : 'bg-white border border-slate-200'}`}>
                                {plan.badge && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-amber-400 text-amber-950 rounded-full text-xs font-bold tracking-wide">{plan.badge}</div>
                                )}
                                <div className={`text-xs font-semibold uppercase tracking-wider mb-1 ${plan.highlight ? 'text-indigo-200' : 'text-slate-400'}`}>{plan.name}</div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-extrabold">{plan.price}</span>
                                    {plan.period.startsWith('/') && <span className={`text-sm font-medium ${plan.highlight ? 'text-indigo-200' : 'text-slate-400'}`}>{plan.period}</span>}
                                </div>
                                {!plan.period.startsWith('/') && <div className={`text-xs mt-0.5 ${plan.highlight ? 'text-indigo-200' : 'text-slate-400'}`}>{plan.period}</div>}
                                {plan.subtitle && <div className={`text-xs mt-0.5 ${plan.highlight ? 'text-indigo-200' : 'text-slate-400'}`}>{plan.subtitle}</div>}
                                <hr className={`my-5 ${plan.highlight ? 'border-indigo-500' : 'border-slate-100'}`} />
                                <ul className={`space-y-2.5 text-sm flex-1 ${plan.highlight ? 'text-indigo-100' : 'text-slate-600'}`}>
                                    {(plan.items || []).map((item: string, j: number) => (
                                        <li key={j} className="flex items-start gap-2">
                                            <span className={`mt-0.5 text-xs ${plan.highlight ? 'text-indigo-300' : 'text-indigo-500'}`}>✓</span>
                                            <span className={item.includes('Không giới hạn') ? 'font-semibold' : ''}>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Link to={ROUTES.LOGIN} className={`mt-6 block w-full text-center py-2.5 rounded-lg text-sm font-semibold transition-all ${plan.highlight
                                    ? 'bg-white text-indigo-600 hover:bg-indigo-50'
                                    : 'border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'}`}>
                                    {plan.cta}
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 px-5 bg-slate-50">
                <div className="max-w-2xl mx-auto text-center">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{c.ctaTitle}</h2>
                    <p className="mt-3 text-slate-500">{c.ctaDesc}</p>
                    <div className="mt-6">
                        <Link to={ROUTES.LOGIN} className="inline-block px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-200">
                            {c.ctaButton} →
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-slate-100 py-10 px-5">
                <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-xs">E</div>
                        <span className="font-bold text-sm text-slate-900">EduCenter Pro</span>
                    </div>
                    <div className="flex items-center gap-5 text-sm text-slate-400">
                        <Link to={ROUTES.GUIDE} className="hover:text-slate-700 transition-colors">Hướng dẫn</Link>
                        <Link to={ROUTES.LOGIN} className="hover:text-slate-700 transition-colors">Đăng nhập</Link>
                    </div>
                    <p className="text-xs text-slate-300">© 2026 EduCenter Pro</p>
                </div>
            </footer>
        </div>
    );
};

// Export defaults for CMS editor
export const LANDING_DEFAULTS = DEFAULT_LANDING;
