import { useMemo, forwardRef } from 'react';
import { useData } from '../../hooks/useDataContext';
import { AttendanceStatus, FeeType } from '../../types';

interface BalanceStatementProps {
    studentId: string;
    /** Optional: if provided, only count attendance up to this month. If omitted, uses real-time (all attendance to date). */
    upToMonth?: string; // "YYYY-MM"
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

export const BalanceStatement = forwardRef<HTMLDivElement, BalanceStatementProps>(({ studentId, upToMonth }, ref) => {
    const { state } = useData();
    const { students, classes, attendance, settings } = state;

    const student = useMemo(() => students.find(s => s.id === studentId), [students, studentId]);

    // Determine display month: use upToMonth or current month
    const displayMonth = useMemo(() => {
        if (upToMonth) return upToMonth;
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }, [upToMonth]);

    const [displayYear, displayMonthNum] = displayMonth.split('-').map(Number);

    const enrolledClasses = useMemo(() => {
        if (!student) return [];
        return classes.filter(c => c.studentIds.includes(student.id));
    }, [classes, student]);

    // Attendance stats per class for the display month - REAL-TIME up to latest session
    const classStats = useMemo(() => {
        if (!student) return [];

        return enrolledClasses.map(cls => {
            // All attendance for this class in the display month
            const monthPrefix = displayMonth;
            const classAttendance = attendance.filter(a =>
                a.classId === cls.id &&
                a.date.startsWith(monthPrefix)
            );

            // Unique dates = total sessions held this month
            const sessionDates = new Set(
                classAttendance
                    .filter(a => a.status !== AttendanceStatus.UNMARKED)
                    .map(a => a.date)
            );

            // Student's attendance
            const studentRecords = classAttendance.filter(a => a.studentId === student.id);
            const present = studentRecords.filter(a => a.status === AttendanceStatus.PRESENT).length;
            const late = studentRecords.filter(a => a.status === AttendanceStatus.LATE).length;
            const excused = studentRecords.filter(a => a.status === AttendanceStatus.EXCUSED_ABSENT).length;
            const unexcused = studentRecords.filter(a => a.status === AttendanceStatus.UNEXCUSED_ABSENT).length;
            const absent = excused + unexcused;
            const attended = present + late;
            const totalSessions = sessionDates.size;

            // Calculate fee for this class this month
            let fee = 0;
            if (cls.fee.type === FeeType.PER_SESSION) {
                const billable = attended + unexcused;
                fee = billable * cls.fee.amount;
            } else if (cls.fee.type === FeeType.MONTHLY) {
                fee = cls.fee.amount;
            }

            // Latest session date
            const latestDate = classAttendance
                .filter(a => a.studentId === student.id && a.status !== AttendanceStatus.UNMARKED)
                .map(a => a.date)
                .sort()
                .pop() || '';

            return {
                classId: cls.id,
                className: cls.name,
                feeType: cls.fee.type,
                feeRate: cls.fee.amount,
                totalSessions,
                attended,
                late,
                absent,
                excused,
                unexcused,
                fee: Math.round(fee),
                latestDate,
            };
        });
    }, [enrolledClasses, attendance, student, displayMonth]);

    // Totals
    const totalFeeThisMonth = useMemo(() =>
        classStats.reduce((sum, c) => sum + c.fee, 0),
        [classStats]
    );

    // Apply student discount
    const discountAmount = useMemo(() => {
        if (!student?.discountPercentage || student.discountPercentage <= 0) return 0;
        return Math.round(totalFeeThisMonth * (student.discountPercentage / 100));
    }, [student, totalFeeThisMonth]);

    const feeAfterDiscount = totalFeeThisMonth - discountAmount;

    // Latest attendance date across all classes
    const latestAttendanceDate = useMemo(() => {
        const dates = classStats.map(c => c.latestDate).filter(Boolean).sort();
        return dates.pop() || '';
    }, [classStats]);

    // Current balance is real-time from student object  
    const currentBalance = student?.balance ?? 0;

    // QR code
    const qrCodeUrl = useMemo(() => {
        const bin = settings.bankBin?.replace(/\s+/g, '');
        const acc = settings.bankAccountNumber?.replace(/\s+/g, '');
        if (!bin || !acc || !student || currentBalance >= 0) return null;

        const amountDue = Math.abs(currentBalance);
        const desc = `HOC PHI ${student.id}`;
        const params: Record<string, string> = {
            amount: amountDue.toString(),
            addInfo: desc,
        };
        if (settings.bankAccountHolder) {
            params.accountName = normalizeAccountName(settings.bankAccountHolder);
        }
        return `https://img.vietqr.io/image/${bin}-${acc}-compact2.png?${new URLSearchParams(params).toString()}`;
    }, [settings, student, currentBalance]);

    if (!student) return <div ref={ref}>Học viên không tồn tại.</div>;

    const monthNames = ['', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

    return (
        <div ref={ref} className="bg-white p-5 text-gray-900 font-sans flex flex-col" style={{ width: '210mm', margin: '0 auto', boxSizing: 'border-box' }}>
            {/* Header */}
            <div className="text-center mb-4">
                <h1 className="text-2xl font-bold uppercase tracking-wide mb-0.5" style={{ color: settings.themeColor || '#4F46E5' }}>
                    {settings.name}
                </h1>
                <div className="text-xs flex flex-col items-center">
                    {settings.address && <span>{settings.address}</span>}
                    {settings.phone && <span>Hotline: <span className="font-medium">{settings.phone}</span></span>}
                </div>
                <div className="mt-3">
                    <h2 className="text-2xl font-extrabold uppercase tracking-tight text-gray-800">
                        PHIẾU THÔNG BÁO SỐ DƯ HỌC PHÍ
                    </h2>
                    <p className="text-base mt-1 font-medium text-gray-600">
                        {monthNames[displayMonthNum]} năm {displayYear}
                    </p>
                    {latestAttendanceDate && (
                        <p className="text-xs text-gray-500 mt-0.5">
                            Cập nhật đến buổi học ngày: <strong>{new Date(latestAttendanceDate).toLocaleDateString('vi-VN')}</strong>
                        </p>
                    )}
                </div>
            </div>

            {/* Student Info */}
            <div className="mb-3 border border-gray-300 p-3">
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2 border-b border-gray-300 pb-1">Thông tin Học viên</h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <div><span className="text-xs text-gray-500">Họ và tên</span><p className="font-bold text-lg">{student.name}</p></div>
                    <div><span className="text-xs text-gray-500">Lớp đang học</span><p className="font-semibold">{enrolledClasses.map(c => c.name).join(', ') || 'Chưa đăng ký lớp'}</p></div>
                    <div><span className="text-xs text-gray-500">Mã học viên</span><p className="font-mono font-semibold">{student.id}</p></div>
                    <div><span className="text-xs text-gray-500">Phụ huynh</span><p className="font-medium">{student.parentName}</p></div>
                </div>
            </div>

            {/* Attendance & Fee Details Table */}
            <div className="mb-3">
                <table className="w-full text-sm border-collapse border border-gray-300">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="py-2 px-2 text-left font-bold uppercase text-xs tracking-wider border-b-2 border-gray-300">Lớp học</th>
                            <th className="py-2 px-2 text-center font-bold uppercase text-xs tracking-wider border-b-2 border-gray-300 w-20">Tổng buổi</th>
                            <th className="py-2 px-2 text-center font-bold uppercase text-xs tracking-wider border-b-2 border-gray-300 w-20">Có mặt</th>
                            <th className="py-2 px-2 text-center font-bold uppercase text-xs tracking-wider border-b-2 border-gray-300 w-20">Vắng</th>
                            <th className="py-2 px-2 text-right font-bold uppercase text-xs tracking-wider border-b-2 border-gray-300 w-36">Học phí</th>
                        </tr>
                    </thead>
                    <tbody>
                        {classStats.map((cs, idx) => (
                            <tr key={idx} className="border-b border-gray-200">
                                <td className="py-2 px-2">
                                    <div className="font-semibold">{cs.className}</div>
                                    <div className="text-xs text-gray-500">
                                        {cs.feeType === FeeType.PER_SESSION
                                            ? `${Math.round(cs.feeRate).toLocaleString('vi-VN')}đ/buổi`
                                            : cs.feeType === FeeType.MONTHLY
                                                ? `${Math.round(cs.feeRate).toLocaleString('vi-VN')}đ/tháng`
                                                : 'Trọn khóa'}
                                    </div>
                                </td>
                                <td className="py-2 px-2 text-center font-medium">{cs.totalSessions}</td>
                                <td className="py-2 px-2 text-center">
                                    <span className="text-green-700 font-medium">{cs.attended}</span>
                                    {cs.late > 0 && <span className="text-yellow-600 text-xs ml-0.5">(+{cs.late} muộn)</span>}
                                </td>
                                <td className="py-2 px-2 text-center">
                                    {cs.absent > 0 ? (
                                        <span className="text-red-600 font-medium">
                                            {cs.absent}
                                            {cs.excused > 0 && <span className="text-xs text-gray-500"> ({cs.excused}CP)</span>}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400">0</span>
                                    )}
                                </td>
                                <td className="py-2 px-2 text-right font-bold">{formatCurrency(cs.fee)}</td>
                            </tr>
                        ))}
                        {classStats.length === 0 && (
                            <tr><td colSpan={5} className="py-4 text-center text-gray-400">Chưa có dữ liệu điểm danh</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Financial Summary */}
            <div className="mb-3 border border-gray-300 p-3">
                <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                        <span>Học phí phát sinh tháng {displayMonthNum}</span>
                        <span className="font-semibold">{formatCurrency(totalFeeThisMonth)}</span>
                    </div>
                    {discountAmount > 0 && (
                        <div className="flex justify-between text-green-700">
                            <span>Miễn giảm ({student.discountPercentage}%)</span>
                            <span className="font-semibold">-{formatCurrency(discountAmount)}</span>
                        </div>
                    )}
                    {discountAmount > 0 && (
                        <div className="flex justify-between border-t border-gray-200 pt-1">
                            <span>Học phí sau giảm</span>
                            <span className="font-semibold">{formatCurrency(feeAfterDiscount)}</span>
                        </div>
                    )}
                </div>

                <div className="mt-4 pt-3 border-t-2 border-gray-800">
                    <div className="flex justify-between items-center">
                        <div>
                            <span className="text-xs uppercase tracking-widest font-bold text-gray-600">SỐ DƯ TÀI KHOẢN</span>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {currentBalance >= 0 ? '(Dương = còn dư, có thể dùng cho kỳ sau)' : '(Âm = còn nợ, cần thanh toán)'}
                            </p>
                        </div>
                        <span className={`text-2xl font-extrabold tracking-tight ${currentBalance >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            {formatCurrency(currentBalance)}
                        </span>
                    </div>
                    {currentBalance > 0 && feeAfterDiscount > 0 && (
                        <p className="text-xs text-green-600 mt-1 text-right">
                            Đủ cho khoảng {Math.floor(currentBalance / feeAfterDiscount)} tháng tới
                        </p>
                    )}
                </div>
            </div>

            {/* Payment Info (only if owing) */}
            {currentBalance < 0 && (
                <div className="border-t-2 border-dashed border-gray-400 pt-3 mt-auto">
                    <h4 className="font-bold text-sm uppercase tracking-widest mb-2 text-center">THÔNG TIN CHUYỂN KHOẢN</h4>
                    <div className="flex justify-between items-start gap-4 mt-2">
                        <div className="w-1/2 space-y-2 text-left">
                            <div>
                                <p className="font-semibold text-base">{settings.bankName}</p>
                                <p className="font-bold text-2xl tracking-wider font-mono my-0.5">{settings.bankAccountNumber}</p>
                                <p className="font-semibold uppercase text-sm">{settings.bankAccountHolder}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs uppercase tracking-wider font-bold mb-1">NỘI DUNG CHUYỂN KHOẢN (BẮT BUỘC)</p>
                                <div className="inline-flex items-center justify-center font-mono font-bold text-lg px-5 py-2 bg-yellow-100 border-2 border-yellow-400 rounded leading-none" style={{ lineHeight: '1' }}>
                                    {`HOC PHI ${student.id}`}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-red-600">
                                    Số tiền cần thanh toán: {formatCurrency(Math.abs(currentBalance))}
                                </p>
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
                            <p className="mt-1 text-xs uppercase tracking-wide font-medium">
                                Quét mã để thanh toán
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer - stamp date */}
            <div className="mt-4 pt-2 border-t border-gray-200 text-xs text-gray-400 text-center">
                Phiếu thông báo tự động — Xuất ngày {new Date().toLocaleDateString('vi-VN')}
            </div>
        </div>
    );
});
