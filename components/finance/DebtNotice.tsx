
import React, { useMemo } from 'react';
import { Student, Transaction, CenterSettings, AttendanceRecord, Class } from '../../types';

interface DebtNoticeProps {
    student: Student;
    transactions: Transaction[];
    settings: CenterSettings;
    attendance?: AttendanceRecord[];
    classes?: Class[];
}

const formatCurrency = (amount: number) => `${Math.round(amount).toLocaleString('vi-VN')} ₫`;

const normalizeAccountName = (name: string) => {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase();
};

export const DebtNotice: React.FC<DebtNoticeProps> = ({ student, transactions: _transactions, settings, attendance = [], classes = [] }) => {
    const totalDue = student.balance < 0 ? Math.abs(student.balance) : 0;

    // Get student's classes
    const studentClasses = useMemo(() => {
        return classes.filter(c => c.studentIds.includes(student.id));
    }, [classes, student.id]);

    // Build monthly summaries from attendance data grouped by class and month
    const monthlySummaries = useMemo(() => {
        const studentAttendance = attendance.filter(a => a.studentId === student.id);
        
        // Group by classId -> month(YYYY-MM) -> records
        const grouped: Record<string, Record<string, AttendanceRecord[]>> = {};
        
        studentAttendance.forEach(record => {
            const classId = record.classId;
            const month = record.date.substring(0, 7);
            if (!grouped[classId]) grouped[classId] = {};
            if (!grouped[classId][month]) grouped[classId][month] = [];
            grouped[classId][month].push(record);
        });

        const result: { month: string; monthLabel: string; className: string; sessions: number; rate: number; feeType: string; total: number }[] = [];

        for (const cls of studentClasses) {
            const classData = grouped[cls.id];
            if (!classData) continue;

            // Get all months, sorted
            const months = Object.keys(classData).sort();
            
            for (const month of months) {
                const records = classData[month];
                const presentCount = records.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
                if (presentCount === 0) continue;
                
                const [y, m] = month.split('-');
                const monthFee = cls.fee.type === 'PER_SESSION' 
                    ? presentCount * cls.fee.amount 
                    : cls.fee.type === 'MONTHLY' 
                        ? cls.fee.amount 
                        : 0;

                result.push({
                    month,
                    monthLabel: `Tháng ${parseInt(m)}/${y}`,
                    className: cls.name,
                    sessions: presentCount,
                    rate: cls.fee.amount,
                    feeType: cls.fee.type,
                    total: monthFee,
                });
            }
        }

        // Sort by month descending (newest first)
        return result.sort((a, b) => b.month.localeCompare(a.month));
    }, [attendance, student.id, studentClasses]);

    const qrCodeUrl = useMemo(() => {
        const { bankAccountNumber, bankBin, bankAccountHolder } = settings;
        if (!bankAccountNumber || !bankBin || totalDue <= 0) {
            return null;
        }
        const description = `HOC PHI ${student.id}`;
        const params: Record<string, string> = {
            amount: Math.round(totalDue).toString(),
            addInfo: description,
        };
        if (bankAccountHolder) {
            params.accountName = normalizeAccountName(bankAccountHolder);
        }
        return `https://img.vietqr.io/image/${bankBin}-${bankAccountNumber}-compact2.png?${new URLSearchParams(params).toString()}`;
    }, [settings, student.id, totalDue]);

    return (
        <div className="bg-white p-3 text-gray-900 border border-gray-300 flex flex-col text-[10px]" style={{ fontFamily: "Arial, sans-serif", maxWidth: '320px', margin: '0 auto' }}>
            <header className="text-center pb-2 border-b border-dashed border-gray-400">
                <h1 className="text-sm font-bold uppercase whitespace-nowrap" style={{ color: settings.themeColor }}>{settings.name}</h1>
                <p>{settings.address}</p>
                <p>ĐT: {settings.phone}</p>
            </header>

            <div className="text-center my-2">
                <h2 className="text-sm font-bold uppercase">THÔNG BÁO HỌC PHÍ</h2>
                <p className="text-gray-600 italic">Ngày: {new Date().toLocaleDateString('vi-VN')}</p>
            </div>

            <div className="mb-2">
                <p><span className="font-bold">Học viên:</span> {student.name}</p>
                {student.parentName && <p><span className="font-bold">Phụ huynh:</span> {student.parentName}</p>}
            </div>

            {/* === GIAO DỊCH - Tích hợp từ điểm danh === */}
            <div className="border-t border-b border-gray-300 py-1 mb-1">
                <p className="font-bold text-[10px] mb-1 uppercase">Giao dịch gần đây:</p>
                {monthlySummaries.length > 0 ? (
                    <div className="space-y-0.5">
                        {monthlySummaries.map((item, idx) => (
                            <div key={idx} className="ml-1 text-[9px] py-0.5">
                                <span className="font-semibold">{item.monthLabel}</span>
                                {' - '}<span style={{ color: settings.themeColor }}>{item.className}</span>
                                {': '}
                                <span className="font-bold">{item.sessions} buổi</span>
                                {item.feeType === 'PER_SESSION' && item.rate > 0 && (
                                    <span> × {formatCurrency(item.rate)} = <span className="font-bold">{formatCurrency(item.total)}</span></span>
                                )}
                                {item.feeType === 'MONTHLY' && item.total > 0 && (
                                    <span> → <span className="font-bold">{formatCurrency(item.total)}</span></span>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 italic ml-1">Chưa có dữ liệu điểm danh.</p>
                )}
            </div>
            
            <div className="flex justify-between items-center my-1 py-2 border-t border-b border-gray-800">
                <span className="font-bold uppercase text-xs">Cần thanh toán</span>
                <span className="font-bold text-lg">{formatCurrency(totalDue)}</span>
            </div>

            <div className="mt-1">
                 <p className="font-bold underline mb-1">Thanh toán qua ngân hàng:</p>
                 <p>{settings.bankName} - {settings.bankAccountNumber}</p>
                 <p>Chủ TK: {settings.bankAccountHolder}</p>
                 <div className="mt-1">
                    <span className="font-bold">Nội dung CK: </span>
                    <span className="font-mono font-bold">{`HOC PHI ${student.id}`}</span>
                </div>
            </div>
            
            {qrCodeUrl && (
                <div className="text-center mt-2 pt-2 border-t border-dashed border-gray-400">
                    <img src={qrCodeUrl} alt="QR Code" className="w-24 h-24 mx-auto" crossOrigin="anonymous" />
                    <p className="mt-1 font-semibold">Quét mã thanh toán</p>
                </div>
            )}
            
            <div className="text-center mt-2 italic text-[9px]">
                <p>Cảm ơn Quý phụ huynh!</p>
            </div>
        </div>
    );
};
