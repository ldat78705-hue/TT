import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants';

// Default content - can be overridden by super admin via CMS
const DEFAULT_LANDING = {
    heroTagline: 'Miễn phí 3 tháng đầu — Không ràng buộc',
    heroTitle1: 'Quản lý trung tâm',
    heroTitle2: 'dạy thêm chuyên nghiệp',
    heroDesc: 'Từ điểm danh, quản lý học viên, tài chính đến thông báo phụ huynh qua Sổ Liên Lạc — tất cả trong một nền tảng duy nhất.',
    heroCtaPrimary: 'Dùng thử miễn phí',
    heroCtaSecondary: 'Xem hướng dẫn',
    heroFootnote: 'Đang được tin dùng bởi các trung tâm dạy thêm tại Việt Nam.',
    featuresTitle: 'Tất cả những gì bạn cần',
    featuresSubtitle: 'Giải pháp toàn diện giúp bạn tập trung vào giảng dạy',
    features: [
        {
            icon: '📋',
            title: 'Điểm danh QR',
            desc: 'Quét mã QR hoặc chấm thủ công. Hệ thống tự đếm buổi, tính chuyên cần và gợi ý lớp cần điểm danh theo lịch học hàng ngày.'
        },
        {
            icon: '👥',
            title: 'Quản lý học viên',
            desc: 'Hồ sơ học viên đầy đủ: thông tin cá nhân, lớp học, điểm danh, công nợ, đánh giá. Tìm kiếm nhanh, lọc theo lớp, trạng thái.'
        },
        {
            icon: '💰',
            title: 'Tài chính minh bạch',
            desc: 'Tính học phí theo buổi hoặc trọn gói. Chốt công nợ, ghi nhận thanh toán, xuất phiếu thu kèm QR chuyển khoản ngân hàng.'
        },
        {
            icon: '📨',
            title: 'Thông báo PHHS qua Sổ Liên Lạc',
            desc: 'Tích hợp Sổ Liên Lạc (SLL) gửi tin nhắn tự động cho phụ huynh: thông báo vắng mặt, nhắc học phí, xác nhận thanh toán — tất cả chỉ bằng 1 click.'
        },
        {
            icon: '📊',
            title: 'Báo cáo & Thống kê',
            desc: 'Biểu đồ doanh thu, chuyên cần, lợi nhuận theo tháng/quý/năm. Xuất Excel toàn bộ dữ liệu bất cứ lúc nào.'
        },
        {
            icon: '🔐',
            title: 'Phân quyền & Cổng phụ huynh',
            desc: 'Phân quyền Quản trị, Kế toán, Giáo viên. Phụ huynh đăng nhập xem điểm danh, công nợ, đánh giá con em mình.'
        },
    ],
    whyTitle: 'Tại sao chọn EduCenter Pro?',
    whyItems: [
        {
            icon: '✅',
            title: 'Thiết kế riêng cho dạy thêm Việt Nam',
            desc: 'Giao diện tiếng Việt, quy trình nghiệp vụ đúng thực tế: điểm danh hàng buổi, học phí theo buổi, nhắc nợ qua Zalo/SLL.'
        },
        {
            icon: '✅',
            title: 'Tích hợp Sổ Liên Lạc điện tử',
            desc: 'Gửi tin nhắn thông báo vắng mặt, nhắc học phí, nhắn tin tùy chỉnh cho phụ huynh — tự động ghi lại lịch sử gửi tin để theo dõi.'
        },
        {
            icon: '✅',
            title: 'Dùng trên mọi thiết bị',
            desc: 'Web hoạt động mượt mà trên máy tính, tablet và điện thoại. Không cần cài đặt, mở trình duyệt là dùng ngay.'
        },
        {
            icon: '✅',
            title: 'Hỗ trợ tận tâm',
            desc: 'Liên hệ trực tiếp qua Zalo hoặc gọi 0822.448.444 để được tư vấn, hỗ trợ cài đặt và hướng dẫn sử dụng.'
        },
    ],
    ctaTitle: 'Bạn đang quản lý bằng sổ tay hoặc Excel?',
    ctaDesc: 'Hãy để EduCenter Pro giúp bạn chuyên nghiệp hóa — dùng thử 3 tháng miễn phí, không ràng buộc.',
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
