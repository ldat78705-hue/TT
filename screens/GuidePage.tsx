import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants';

// Default guide sections — can be overridden by super admin
const DEFAULT_SECTIONS = [
    {
        id: 'bat-dau', icon: '🚀', title: 'Bắt đầu sử dụng',
        content: [
            { q: 'Đăng ký tài khoản', a: 'Liên hệ admin hệ thống để được tạo tài khoản trung tâm. Bạn sẽ nhận được tên đăng nhập và mật khẩu mặc định. Đăng nhập lần đầu hệ thống sẽ yêu cầu đổi mật khẩu.' },
            { q: 'Cài đặt ban đầu', a: 'Vào **Cài đặt** → điền tên trung tâm, địa chỉ, số điện thoại, logo. Thiết lập tài khoản ngân hàng để hiển thị khi nhắc học phí. Chọn màu theme yêu thích.' },
            { q: 'Thêm giáo viên', a: 'Vào **Giáo viên** → bấm **+ Thêm giáo viên**. Điền tên, SĐT, môn dạy. Mỗi giáo viên được cấp tài khoản đăng nhập riêng để điểm danh trực tiếp.' },
        ]
    },
    {
        id: 'hoc-vien', icon: '👨‍🎓', title: 'Quản lý Học viên',
        content: [
            { q: 'Thêm học viên', a: 'Vào **Học viên** → **+ Thêm học viên**. Điền đầy đủ: tên, SĐT, tên phụ huynh, lớp học. Mã học viên tự động tạo theo dạng HS001, HS002...' },
            { q: 'Phân lớp học viên', a: 'Khi thêm hoặc sửa học viên, chọn các lớp trong phần **Lớp học**. Một học viên có thể học nhiều lớp.' },
            { q: 'Theo dõi công nợ', a: 'Số dư hiển thị ngay trên thẻ học viên. Số âm = **nợ học phí**. Bấm vào tên để xem chi tiết giao dịch, điểm danh, đánh giá.' },
            { q: 'In thẻ QR', a: 'Chọn nhiều học viên bằng checkbox → bấm **🖶 In thẻ QR**. Chọn layout phù hợp (8/10/12 thẻ/trang A4). In ra để quét điểm danh nhanh.' },
        ]
    },
    {
        id: 'lop-hoc', icon: '📚', title: 'Quản lý Lớp học',
        content: [
            { q: 'Tạo lớp học', a: 'Vào **Lớp học** → **+ Tạo lớp**. Điền tên lớp, môn, giáo viên phụ trách, học phí (theo buổi hoặc trọn gói), lịch học hàng tuần.' },
            { q: 'Xếp lịch học', a: 'Trong form tạo lớp, thêm **Lịch học**: chọn ngày trong tuần + giờ bắt đầu/kết thúc. Hệ thống tự động gợi ý lớp cần điểm danh theo ngày.' },
            { q: 'Quản lý danh sách lớp', a: 'Bấm vào tên lớp để xem chi tiết: danh sách học viên, thêm/xóa học viên, xem điểm danh, gửi nhắc công nợ hàng loạt qua Zalo.' },
        ]
    },
    {
        id: 'diem-danh', icon: '📋', title: 'Điểm danh',
        content: [
            { q: 'Điểm danh thủ công', a: 'Vào **Lịch điểm danh** → chọn ngày → chọn lớp. Bấm vào từng nút trạng thái: ✅ Có mặt, ⏰ Đi muộn, 📝 Có phép, ❌ Vắng. Cuối cùng bấm **Lưu điểm danh**.' },
            { q: 'Quét QR điểm danh', a: 'Trên App Android, vào **Điểm danh** → bấm **📷 QR**. Quét thẻ QR của học viên — hệ thống tự ghi nhận "Có mặt". Nhanh và chính xác.' },
            { q: 'Gửi thông báo vắng', a: 'Sau khi lưu điểm danh, nếu có học viên vắng không phép → bấm **📤 Gửi TB**. Hệ thống soạn sẵn nội dung → bạn chỉ cần **Chép tin nhắn** và paste vào Zalo.' },
            { q: 'Đánh dấu nhanh', a: 'Dùng nút **Tất cả Có mặt** để đánh dấu hàng loạt, rồi chỉnh sửa riêng những em vắng. Tiết kiệm thời gian cho lớp đông.' },
        ]
    },
    {
        id: 'tai-chinh', icon: '💰', title: 'Tài chính',
        content: [
            { q: 'Thu học phí', a: 'Vào **Tài chính** hoặc bấm nút **💳 Thu phí** trên thẻ học viên. Nhập số tiền, chọn phương thức (tiền mặt/chuyển khoản). Số dư học viên cập nhật tức thì.' },
            { q: 'Tính học phí tự động', a: 'Hệ thống tự tính học phí dựa trên **số buổi điểm danh × đơn giá/buổi** hoặc trọn gói. Vào **Tài chính** → tab **Hóa đơn** để xem chi tiết.' },
            { q: 'Tính lương giáo viên', a: 'Vào **Tài chính** → tab **Bảng lương**. Hệ thống tự tính dựa trên số buổi dạy × rate. Admin có thể thêm thưởng/khấu trừ.' },
            { q: 'Thu chi khác', a: 'Tab **Thu nhập** và **Chi phí** để ghi nhận các khoản ngoài học phí: bán giáo trình, thuê mặt bằng, điện nước, marketing...' },
            { q: 'Báo cáo tài chính', a: 'Tab **Báo cáo** hiển thị biểu đồ doanh thu 6 tháng, lãi/lỗ, top nợ. Xuất Excel toàn bộ dữ liệu bất cứ lúc nào.' },
        ]
    },
    {
        id: 'phu-huynh', icon: '👨‍👩‍👧', title: 'Cổng Phụ huynh',
        content: [
            { q: 'Cách phụ huynh đăng nhập', a: 'Phụ huynh dùng **mã học viên** (VD: HS001) + mật khẩu để đăng nhập. Admin có thể đặt lại mật khẩu cho từng học viên trong phần quản lý.' },
            { q: 'Phụ huynh xem được gì?', a: 'Sau đăng nhập, phụ huynh thấy: lịch điểm danh con, số dư/công nợ, đánh giá học tập từ giáo viên, thông báo trung tâm. Không thể chỉnh sửa dữ liệu.' },
        ]
    },
    {
        id: 'app', icon: '📱', title: 'App Android',
        content: [
            { q: 'Tải app ở đâu?', a: 'Vào GitHub Releases của trung tâm → tải file **EduCenterPro-v*.apk** → cài đặt. Lần đầu cần cho phép "Cài đặt từ nguồn không xác định" trong cài đặt điện thoại.' },
            { q: 'Tính năng chính trên App', a: 'Điểm danh (kèm QR), quản lý học viên/lớp/giáo viên, thu phí, gửi công nợ qua Zalo, thông báo, báo cáo. Giao diện tối ưu cho điện thoại.' },
            { q: 'Hoạt động offline không?', a: '**Có!** Điểm danh được lưu offline và tự đồng bộ khi có mạng. Trạng thái offline hiển thị rõ ràng trên thanh dưới cùng.' },
        ]
    },
    {
        id: 'nang-cao', icon: '⚙️', title: 'Tính năng nâng cao',
        content: [
            { q: 'Phân quyền nhân viên', a: 'Vào **Nhân viên** → thêm tài khoản với vai trò: **Quản lý** (gần như Admin), **Kế toán** (chỉ xem tài chính + học viên), **Giáo viên** (điểm danh + đánh giá), **Viewer** (chỉ xem).' },
            { q: 'Quản lý phòng học', a: 'Vào **Phòng học** → thêm phòng với tên, sức chứa, mô tả. Phòng có thể gán cho lớp khi tạo lớp.' },
            { q: 'Lịch sử thao tác', a: 'Vào **Lịch sử** → xem toàn bộ hành động của tất cả tài khoản: thêm/sửa/xóa học viên, điểm danh, thu phí... Kiểm soát chặt chẽ.' },
            { q: 'Sao lưu & khôi phục', a: 'Vào **Cài đặt** → tab **Sao lưu**. Xuất file JSON backup về máy. Khi cần khôi phục, upload file backup lên.' },
        ]
    },
];

const DEFAULT_GUIDE = {
    title: '📖 Hướng dẫn sử dụng',
    subtitle: 'Tất cả những gì bạn cần biết để vận hành trung tâm dạy thêm với EduCenter Pro',
    sections: DEFAULT_SECTIONS,
    ctaTitle: 'Sẵn sàng bắt đầu?',
    ctaDesc: 'Đăng nhập ngay để trải nghiệm 3 tháng miễn phí',
    ctaButton: '🚀 Dùng thử miễn phí',
};

export const GuidePage: React.FC = () => {
    const [activeSection, setActiveSection] = useState('bat-dau');
    const [guide, setGuide] = useState(DEFAULT_GUIDE);

    useEffect(() => {
        fetch('/api/centers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_site_content' })
        })
        .then(r => r.json())
        .then(data => {
            if (data.content?.guide) {
                setGuide(prev => ({ ...prev, ...data.content.guide }));
            }
        })
        .catch(() => {});
    }, []);

    const sections = guide.sections || DEFAULT_SECTIONS;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
            {/* Navigation */}
            <nav className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/70 border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link to={ROUTES.LANDING} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center font-black text-sm shadow-lg shadow-blue-500/25">E</div>
                            <span className="font-bold text-lg tracking-tight">EduCenter Pro</span>
                        </Link>
                        <span className="text-slate-500 hidden sm:inline">/ Hướng dẫn sử dụng</span>
                    </div>
                    <Link to={ROUTES.LOGIN} className="px-5 py-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 rounded-full text-sm font-semibold transition-all shadow-lg shadow-blue-500/25">
                        Đăng nhập →
                    </Link>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex gap-8">
                {/* Sidebar TOC */}
                <aside className="hidden lg:block w-64 flex-shrink-0">
                    <div className="sticky top-24 space-y-1">
                        <h3 className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-4 px-3">Mục lục</h3>
                        {sections.map((s: any) => (
                            <button
                                key={s.id}
                                onClick={() => {
                                    setActiveSection(s.id);
                                    document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }}
                                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2.5 ${
                                    activeSection === s.id
                                        ? 'bg-blue-600/15 text-blue-300 font-semibold border border-blue-500/20'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <span className="text-base">{s.icon}</span>
                                {s.title}
                            </button>
                        ))}
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 min-w-0">
                    <div className="mb-12">
                        <h1 className="text-3xl sm:text-4xl font-black">{guide.title}</h1>
                        <p className="mt-3 text-slate-400 text-lg">{guide.subtitle}</p>
                    </div>

                    <div className="space-y-16">
                        {sections.map((section: any) => (
                            <section key={section.id} id={section.id} className="scroll-mt-24">
                                <h2 className="text-2xl font-black flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                                    <span className="text-2xl">{section.icon}</span>
                                    {section.title}
                                </h2>
                                <div className="space-y-4">
                                    {(section.content || []).map((item: any, i: number) => (
                                        <details key={i} className="group rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors overflow-hidden">
                                            <summary className="cursor-pointer p-5 font-semibold text-sm flex items-center justify-between list-none">
                                                <span>{item.q}</span>
                                                <svg className="w-5 h-5 text-slate-500 group-open:rotate-180 transition-transform flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                            </summary>
                                            <div className="px-5 pb-5 text-sm text-slate-300 leading-relaxed border-t border-white/5 pt-4">
                                                {item.a.split('**').map((part: string, j: number) => 
                                                    j % 2 === 0 
                                                        ? <React.Fragment key={j}>{part}</React.Fragment> 
                                                        : <strong key={j} className="text-white font-semibold">{part}</strong>
                                                )}
                                            </div>
                                        </details>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>

                    {/* Bottom CTA */}
                    <div className="mt-16 p-8 rounded-2xl bg-gradient-to-r from-blue-600/10 to-violet-600/10 border border-blue-500/20 text-center">
                        <h3 className="text-xl font-bold mb-2">{guide.ctaTitle}</h3>
                        <p className="text-slate-400 mb-6">{guide.ctaDesc}</p>
                        <Link to={ROUTES.LOGIN} className="inline-block px-8 py-3 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20">
                            {guide.ctaButton}
                        </Link>
                    </div>
                </main>
            </div>
        </div>
    );
};

// Export defaults for CMS editor
export const GUIDE_DEFAULTS = DEFAULT_GUIDE;
