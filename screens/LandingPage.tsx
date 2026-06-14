import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants';

// Default content - can be overridden by super admin via CMS
const DEFAULT_LANDING = {
    heroTagline: 'Dùng thử miễn phí 3 tháng — Không ràng buộc',
    heroTitle1: 'Giải pháp quản lý',
    heroTitle2: 'trung tâm dạy thêm',
    heroDesc: 'Điểm danh — Thu học phí — Chốt công nợ — Thông báo phụ huynh. Tất cả trong một nền tảng duy nhất, chạy trên cả Web và App Android. Được thiết kế riêng cho mô hình dạy thêm, luyện thi tại Việt Nam.',
    heroCtaPrimary: 'Dùng thử miễn phí',
    heroCtaSecondary: 'Xem hướng dẫn',
    heroFootnote: 'Liên hệ tư vấn: 0822.448.444',
    featuresTitle: 'Tính năng nổi bật',
    featuresSubtitle: 'Giải quyết trọn vẹn mọi vấn đề vận hành trung tâm dạy thêm',
    features: [
        {
            icon: '📋',
            title: 'Điểm danh linh hoạt',
            desc: 'Chấm điểm danh thủ công hoặc quét mã QR trên App. Hệ thống tự động đếm buổi, tính chuyên cần, và gợi ý lớp cần điểm danh theo lịch học hàng ngày.'
        },
        {
            icon: '💰',
            title: 'Thu phí theo buổi hoặc theo khóa',
            desc: 'Hỗ trợ tính học phí theo số buổi thực học hoặc trọn gói theo tháng/khóa. Tự động tổng hợp công nợ, xuất phiếu thu học phí kèm mã QR chuyển khoản ngân hàng.'
        },
        {
            icon: '📄',
            title: 'Chốt công nợ & Xuất phiếu thu',
            desc: 'Chốt công nợ hàng tháng cho từng học viên hoặc cả lớp. Xuất phiếu thông báo học phí dạng ảnh, sao chép nhanh để gửi qua Zalo cho phụ huynh — hoàn toàn miễn phí.'
        },
        {
            icon: '👥',
            title: 'Phân quyền rõ ràng',
            desc: 'Phân quyền Quản trị, Kế toán, Giáo viên, Nhân viên. Kế toán chỉ thấy tài chính. Giáo viên chỉ điểm danh và đánh giá lớp mình dạy. Kiểm soát chặt chẽ, minh bạch.'
        },
        {
            icon: '📱',
            title: 'Thông báo phụ huynh tự động',
            desc: 'Nếu phụ huynh cài App trung tâm: tự động nhận thông báo điểm danh, công nợ, đánh giá. Nếu không cài App: bạn chỉ cần sao chép phiếu và tự gửi qua Zalo nhóm lớp — miễn phí hoàn toàn.'
        },
        {
            icon: '📊',
            title: 'Theo dõi chuyên cần & Báo cáo',
            desc: 'Biểu đồ tỷ lệ chuyên cần, doanh thu, lợi nhuận theo tháng/quý/năm. Lọc theo lớp, xuất Excel toàn bộ dữ liệu bất cứ lúc nào.'
        },
    ],
    whyTitle: 'Tại sao chọn EduCenter Pro?',
    whyItems: [
        {
            icon: '✅',
            title: 'Không phát sinh chi phí ẩn',
            desc: 'Tính năng gửi tin nhắn qua Zalo OA hoặc thu phí tự động qua cổng thanh toán cần trả phí cho nhà cung cấp bên thứ ba. Nhưng bạn hoàn toàn có thể thay thế bằng cách sao chép phiếu công nợ và tự gửi qua Zalo — miễn phí 100%.'
        },
        {
            icon: '✅',
            title: 'Thiết kế cho người Việt',
            desc: 'Giao diện hoàn toàn tiếng Việt, quy trình nghiệp vụ đúng thực tế trung tâm dạy thêm Việt Nam: điểm danh hàng buổi, học phí theo buổi, phiếu thu kèm QR ngân hàng nội địa.'
        },
        {
            icon: '✅',
            title: 'Dùng trên mọi thiết bị',
            desc: 'Web hoạt động trên máy tính, tablet, điện thoại. App Android riêng cho quản lý di động, hỗ trợ offline — điểm danh không cần mạng, tự đồng bộ khi có kết nối.'
        },
        {
            icon: '✅',
            title: 'Hỗ trợ tận tâm',
            desc: 'Liên hệ trực tiếp qua Zalo hoặc gọi 0822.448.444 để được tư vấn, hỗ trợ cài đặt và hướng dẫn sử dụng.'
        },
    ],
    pricingTitle: 'Bảng giá',
    pricingSubtitle: 'Đơn giản, minh bạch. Không phí ẩn. Chọn gói phù hợp với quy mô của bạn.',
    plans: [
        {
            name: 'Dùng thử', price: '0₫', period: '3 tháng đầu', subtitle: 'Trải nghiệm đầy đủ tính năng',
            items: ['Tất cả tính năng', 'Tối đa 50 học viên', 'Web + App Android', 'Cổng phụ huynh', 'Gửi phiếu công nợ qua Zalo (tự gửi)'],
            cta: 'Bắt đầu miễn phí', highlight: false
        },
        {
            name: 'Cơ bản', price: '199K', period: '/tháng', subtitle: 'Chỉ ~6.600₫/ngày',
            items: ['Tất cả tính năng', 'Tối đa 200 học viên', 'Web + App Android', 'Cổng phụ huynh', 'Sao lưu tự động', 'Hỗ trợ qua Zalo'],
            cta: 'Chọn gói này', highlight: true, badge: 'PHỔ BIẾN'
        },
        {
            name: 'Nâng cao', price: '499K', period: '/tháng', subtitle: 'Chỉ ~16.600₫/ngày',
            items: ['Mọi tính năng Cơ bản', 'Không giới hạn học viên', 'Nhiều chi nhánh', 'Zalo OA tự động (phí OA do Zalo thu)', 'Hỗ trợ ưu tiên 24/7', 'Tùy chỉnh theo yêu cầu'],
            cta: 'Liên hệ tư vấn', highlight: false
        },
    ],
    ctaTitle: 'Bạn đang quản lý bằng sổ tay hoặc Excel?',
    ctaDesc: 'Hãy để EduCenter Pro giúp bạn chuyên nghiệp hóa — dùng thử 3 tháng miễn phí, không ràng buộc. Liên hệ 0822.448.444 để được tư vấn.',
    ctaButton: 'Dùng thử miễn phí ngay',
    contactPhone: '0822.448.444',
};

export const LandingPage: React.FC = () => {
    const [content, setContent] = useState(DEFAULT_LANDING);

    useEffect(() => {
        fetch('/api/centers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
            body: JSON.stringify({ action: 'get_site_content', _t: Date.now() })
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

            {/* Why Choose Us */}
            {(c as any).whyItems && (c as any).whyItems.length > 0 && (
                <section className="py-20 px-5">
                    <div className="max-w-4xl mx-auto">
                        <div className="text-center mb-14">
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{(c as any).whyTitle || 'Tại sao chọn EduCenter Pro?'}</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {((c as any).whyItems || []).map((item: any, i: number) => (
                                <div key={i} className="flex gap-3">
                                    <span className="text-xl flex-shrink-0 mt-0.5">{item.icon}</span>
                                    <div>
                                        <h3 className="font-bold text-slate-900 mb-1">{item.title}</h3>
                                        <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Pricing */}
            <section className="py-20 px-5 bg-slate-50" id="pricing">
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
            <section className="py-20 px-5">
                <div className="max-w-2xl mx-auto text-center">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{c.ctaTitle}</h2>
                    <p className="mt-3 text-slate-500">{c.ctaDesc}</p>
                    <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                        <Link to={ROUTES.LOGIN} className="inline-block px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-200">
                            {c.ctaButton} →
                        </Link>
                        {(c as any).contactPhone && (
                            <a href={`tel:${(c as any).contactPhone}`} className="inline-flex items-center gap-2 px-6 py-3 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 rounded-xl text-sm font-semibold text-slate-700 transition-all">
                                📞 Gọi {(c as any).contactPhone}
                            </a>
                        )}
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
                        {(c as any).contactPhone && (
                            <a href={`tel:${(c as any).contactPhone}`} className="hover:text-slate-700 transition-colors">📞 {(c as any).contactPhone}</a>
                        )}
                    </div>
                    <p className="text-xs text-slate-300">© 2026 EduCenter Pro</p>
                </div>
            </footer>
        </div>
    );
};

// Export defaults for CMS editor
export const LANDING_DEFAULTS = DEFAULT_LANDING;
