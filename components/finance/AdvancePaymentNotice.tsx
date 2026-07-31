import { useMemo, forwardRef } from 'react';
import { useData } from '../../hooks/useDataContext';
import { FeeType } from '../../types';

interface AdvancePaymentNoticeProps {
    studentId: string;
    months: number;
    discountPercent: number;
    finalAmount: number;
    /** 'print' = fixed A4 width for export; 'preview' = responsive for modal display */
    mode?: 'print' | 'preview';
}

const formatCurrency = (amount: number) => `${Math.round(amount).toLocaleString('vi-VN')} ₫`;

const normalizeAccountName = (name: string) => {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toUpperCase();
};

export const AdvancePaymentNotice = forwardRef<HTMLDivElement, AdvancePaymentNoticeProps>(
    ({ studentId, months, discountPercent, finalAmount, mode = 'print' }, ref) => {
    const { state } = useData();
    const { students, classes, settings } = state;

    const student = useMemo(() => students.find(s => s.id === studentId), [students, studentId]);

    const enrolledClasses = useMemo(() => {
        if (!student) return [];
        return classes.filter(c => c.studentIds.includes(student.id));
    }, [classes, student]);

    // Monthly fee estimate per class
    const classDetails = useMemo(() => {
        if (!student) return [];
        return enrolledClasses.map(cls => {
            let monthlyFee = 0;
            let feeDesc = '';
            if (cls.fee.type === FeeType.MONTHLY) {
                monthlyFee = cls.fee.amount;
                feeDesc = `${Math.round(cls.fee.amount).toLocaleString('vi-VN')}đ/tháng`;
            } else if (cls.fee.type === FeeType.PER_SESSION) {
                const sessionsPerWeek = cls.schedule.length;
                const est = sessionsPerWeek * 4;
                monthlyFee = est * cls.fee.amount;
                feeDesc = `~${est} buổi × ${Math.round(cls.fee.amount).toLocaleString('vi-VN')}đ`;
            } else {
                return null; // PER_COURSE skip
            }
            return { className: cls.name, monthlyFee: Math.round(monthlyFee), feeDesc };
        }).filter(Boolean) as { className: string; monthlyFee: number; feeDesc: string }[];
    }, [student, enrolledClasses]);

    const monthlyTotal = classDetails.reduce((s, c) => s + c.monthlyFee, 0);
    const tuitionBase = monthlyTotal * months;
    const discountAmount = Math.round(tuitionBase * (discountPercent / 100));
    const outstandingDebt = student && student.balance < 0 ? Math.abs(student.balance) : 0;

    // Calculate month range string: e.g. "Tháng 6, 7, 8/2026"
    const monthRangeText = useMemo(() => {
        const now = new Date();
        const startMonth = now.getMonth() + 1; // current month (1-12)
        const startYear = now.getFullYear();
        const monthNames: string[] = [];
        for (let i = 0; i < months; i++) {
            const m = ((startMonth - 1 + i) % 12) + 1;
            const y = startYear + Math.floor((startMonth - 1 + i) / 12);
            if (i === months - 1) {
                monthNames.push(`${m}/${y}`);
            } else {
                monthNames.push(`${m}`);
            }
        }
        return `Tháng ${monthNames.join(', ')}`;
    }, [months]);

    // QR code
    const qrCodeUrl = useMemo(() => {
        const bin = settings.bankBin?.replace(/\s+/g, '');
        const acc = settings.bankAccountNumber?.replace(/\s+/g, '');
        if (!bin || !acc || !student || finalAmount <= 0) return null;
        const desc = `HOC PHI ${student.id}`;
        const params: Record<string, string> = {
            amount: finalAmount.toString(),
            addInfo: desc,
        };
        if (settings.bankAccountHolder) {
            params.accountName = normalizeAccountName(settings.bankAccountHolder);
        }
        return `https://img.vietqr.io/image/${bin}-${acc}-compact2.png?${new URLSearchParams(params).toString()}`;
    }, [settings, student, finalAmount]);

    if (!student) return <div ref={ref}>Học viên không tồn tại.</div>;

    const isPreview = mode === 'preview';

    const containerStyle: React.CSSProperties = isPreview
        ? { width: '100%', maxWidth: '100%', margin: '0 auto', boxSizing: 'border-box' as const }
        : { width: '210mm', margin: '0 auto', boxSizing: 'border-box' as const };

    return (
        <div ref={ref} className="bg-white text-gray-900 font-sans flex flex-col" style={{ ...containerStyle, padding: isPreview ? '20px' : '20px' }}>
            {/* Header */}
            <div className="text-center mb-4">
                <h1 className="text-2xl font-bold uppercase tracking-wide mb-0.5" style={{ color: settings.themeColor || '#4F46E5' }}>
                    {settings.name}
                </h1>
                <div className="text-xs flex flex-col items-center text-gray-500">
                    {settings.address && <span>{settings.address}</span>}
                    {settings.phone && <span>Hotline: <span className="font-medium text-gray-700">{settings.phone}</span></span>}
                </div>
                <div className="mt-3">
                    <h2 className={`font-extrabold uppercase tracking-tight text-gray-800 ${isPreview ? 'text-xl' : 'text-2xl'}`}>
                        PHIẾU THU HỌC PHÍ TRƯỚC
                    </h2>
                    <p className="text-base mt-1 font-medium text-gray-600">
                        Thu trước {months} tháng
                        {discountPercent > 0 && <span className="text-green-600"> (Giảm {discountPercent}%)</span>}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Ngày lập: <strong>{new Date().toLocaleDateString('vi-VN')}</strong>
                    </p>
                </div>
            </div>

            {/* Student Info */}
            <div className="mb-3 border border-gray-300 p-3 rounded">
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2 border-b border-gray-300 pb-1 text-gray-500">Thông tin Học viên</h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <div><span className="text-xs text-gray-500">Họ và tên</span><p className="font-bold text-lg">{student.name}</p></div>
                    <div><span className="text-xs text-gray-500">Lớp đang học</span><p className="font-semibold">{enrolledClasses.map(c => c.name).join(', ')}</p></div>
                    <div><span className="text-xs text-gray-500">Mã học viên</span><p className="font-mono font-semibold">{student.id}</p></div>
                    <div><span className="text-xs text-gray-500">Phụ huynh</span><p className="font-medium">{student.parentName}</p></div>
                </div>
            </div>

            {/* Fee Breakdown Table */}
            <div className="mb-3">
                <table className="w-full text-sm border-collapse border border-gray-300">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="py-2 px-3 text-left font-bold uppercase text-xs tracking-wider border-b-2 border-gray-300">Nội dung</th>
                            <th className="py-2 px-3 text-right font-bold uppercase text-xs tracking-wider border-b-2 border-gray-300 w-40">Thành tiền</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Outstanding Debt */}
                        {outstandingDebt > 0 && (
                            <tr className="border-b border-gray-200 bg-amber-50">
                                <td className="py-2 px-3">
                                    <div className="font-semibold text-amber-800">📖 Học phí kỳ trước chưa hoàn thành</div>
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-amber-800">{formatCurrency(outstandingDebt)}</td>
                            </tr>
                        )}

                        {/* Per-class monthly fees */}
                        <tr className="border-b border-gray-200">
                            <td className="py-2 px-3" colSpan={2}>
                                <div className="font-bold text-base mb-1">Học phí dự kiến {months} tháng tới <span className="font-normal text-sm text-gray-600">({monthRangeText})</span></div>
                                <div className="pl-2 space-y-1">
                                    {classDetails.map((cd, idx) => (
                                        <div key={idx} className="flex justify-between text-sm py-0.5">
                                            <span>
                                                📚 {cd.className}
                                                <span className="text-xs text-gray-500 ml-1">({cd.feeDesc})</span>
                                            </span>
                                            <span>{formatCurrency(cd.monthlyFee)}/tháng</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between font-semibold pt-1 border-t border-gray-200">
                                        <span>Tổng HP/tháng × {months} tháng</span>
                                        <span>{formatCurrency(tuitionBase)}</span>
                                    </div>
                                </div>
                            </td>
                        </tr>

                        {/* Discount */}
                        {discountPercent > 0 && (
                            <tr className="border-b border-gray-200">
                                <td className="py-2 px-3">
                                    <div className="font-medium text-green-700">🎁 Giảm giá đóng trước {discountPercent}%</div>
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-green-700">-{formatCurrency(discountAmount)}</td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Grand Total */}
                <div className="flex justify-end mt-4">
                    <div className="text-right bg-gray-50 px-5 py-3 rounded border border-gray-200">
                        <span className="block text-xs uppercase tracking-widest font-bold text-gray-600">TỔNG SỐ TIỀN CẦN THU</span>
                        <span className="block text-3xl font-extrabold tracking-tight" style={{ color: settings.themeColor || '#4F46E5' }}>
                            {formatCurrency(finalAmount)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Payment Info */}
            <div className="border-t-2 border-dashed border-gray-400 pt-3 mt-auto">
                <h4 className="font-bold text-sm uppercase tracking-widest mb-2 text-center text-gray-700">THÔNG TIN CHUYỂN KHOẢN</h4>
                <div className="flex justify-between items-start gap-4 mt-2">
                    <div className="w-1/2 space-y-3 text-left">
                        <div>
                            <p className="font-semibold text-base">{settings.bankName}</p>
                            <p className="font-bold text-2xl tracking-wider font-mono my-0.5">{settings.bankAccountNumber}</p>
                            <p className="font-semibold uppercase text-sm text-gray-600">{settings.bankAccountHolder}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs uppercase tracking-wider font-bold mb-1 text-gray-600">NỘI DUNG CHUYỂN KHOẢN (BẮT BUỘC)</p>
                            <div className="inline-flex items-center justify-center font-mono font-bold text-lg px-5 py-2 bg-yellow-100 border-2 border-yellow-400 rounded leading-none" style={{ lineHeight: '1' }}>
                                {`HOC PHI ${student.id}`}
                            </div>
                        </div>
                    </div>
                    <div className="w-1/2 flex flex-col items-center justify-start">
                        {qrCodeUrl && (
                            <img
                                src={qrCodeUrl}
                                alt="QR Code"
                                className="w-36 h-36 object-contain"
                                crossOrigin="anonymous"
                            />
                        )}
                        <p className="mt-1 text-xs uppercase tracking-wide font-medium text-gray-500">
                            Quét mã để thanh toán
                        </p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-4 pt-2 border-t border-gray-200 text-xs text-gray-400 text-center">
                Phiếu thu tự động — {settings.name} — {new Date().toLocaleDateString('vi-VN')}
            </div>
        </div>
    );
});
