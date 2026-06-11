
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

const statusVN: Record<string, string> = {
    'PRESENT': '✔', 'ABSENT': '✘', 'UNEXCUSED_ABSENT': '✘', 'LATE': '⏰', 'UNMARKED': '?'
};
const statusLabel: Record<string, string> = {
    'PRESENT': 'Có mặt', 'ABSENT': 'Vắng', 'UNEXCUSED_ABSENT': 'Vắng KP', 'LATE': 'Đi muộn', 'UNMARKED': 'Chưa ĐD'
};

export const DebtNotice: React.FC<DebtNoticeProps> = ({ student, transactions, settings, attendance = [], classes = [] }) => {
    const totalDue = student.balance < 0 ? Math.abs(student.balance) : 0;

    // Get student's classes
    const studentClasses = useMemo(() => {
        return classes.filter(c => c.studentIds.includes(student.id));
    }, [classes, student.id]);

    // Get student attendance, group by class then by month
    const attendanceByClass = useMemo(() => {
        const studentAttendance = attendance.filter(a => a.studentId === student.id);
        
        // Group by classId -> month(YYYY-MM) -> records
        const grouped: Record<string, Record<string, AttendanceRecord[]>> = {};
        
        studentAttendance.forEach(record => {
            const classId = record.classId;
            const month = record.date.substring(0, 7); // "YYYY-MM"
            if (!grouped[classId]) grouped[classId] = {};
            if (!grouped[classId][month]) grouped[classId][month] = [];
            grouped[classId][month].push(record);
        });

        // Only show last 2 months of data to keep compact
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
        
        const result: { className: string; classId: string; fee: { type: string; amount: number }; months: { month: string; records: AttendanceRecord[] }[] }[] = [];

        for (const cls of studentClasses) {
            const classData = grouped[cls.id];
            if (!classData) continue;

            const months: { month: string; records: AttendanceRecord[] }[] = [];
            
            // Show current month and previous month
            [prevMonth, currentMonth].forEach(m => {
                if (classData[m] && classData[m].length > 0) {
                    months.push({
                        month: m,
                        records: classData[m].sort((a, b) => a.date.localeCompare(b.date))
                    });
                }
            });

            if (months.length > 0) {
                result.push({
                    className: cls.name,
                    classId: cls.id,
                    fee: cls.fee,
                    months
                });
            }
        }

        return result;
    }, [attendance, student.id, studentClasses]);

    // Recent transactions (last 5 to keep compact)
    const recentTransactions = useMemo(() => {
        return [...transactions]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5);
    }, [transactions]);

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

    const formatMonth = (m: string) => {
        const [y, month] = m.split('-');
        return `Tháng ${parseInt(month)}/${y}`;
    };

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

            {/* === CHI TIẾT CÁC BUỔI HỌC === */}
            {attendanceByClass.length > 0 && (
                <div className="border-t border-gray-300 pt-1 mb-1">
                    <p className="font-bold text-[10px] mb-1 uppercase">Chi tiết điểm danh:</p>
                    {attendanceByClass.map((classInfo, idx) => (
                        <div key={classInfo.classId} className={idx > 0 ? 'mt-1' : ''}>
                            <p className="font-bold text-[10px]" style={{ color: settings.themeColor }}>
                                📚 {classInfo.className}
                                {classInfo.fee.amount > 0 && (
                                    <span className="font-normal text-gray-600">
                                        {' '}({formatCurrency(classInfo.fee.amount)}/{classInfo.fee.type === 'PER_SESSION' ? 'buổi' : classInfo.fee.type === 'MONTHLY' ? 'tháng' : 'khóa'})
                                    </span>
                                )}
                            </p>
                            {classInfo.months.map(monthData => {
                                const presentCount = monthData.records.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
                                const absentCount = monthData.records.filter(r => r.status === 'ABSENT' || r.status === 'UNEXCUSED_ABSENT').length;

                                const totalSessions = monthData.records.length;
                                const monthFee = classInfo.fee.type === 'PER_SESSION' 
                                    ? presentCount * classInfo.fee.amount 
                                    : classInfo.fee.type === 'MONTHLY' 
                                        ? classInfo.fee.amount 
                                        : 0;
                                return (
                                    <div key={monthData.month} className="ml-1 mb-1">
                                        <p className="font-semibold text-[9px] text-gray-700">{formatMonth(monthData.month)} ({totalSessions} buổi):</p>
                                        <table className="w-full text-[9px] ml-1">
                                            <tbody>
                                                <tr>
                                                    <td className="pr-1" style={{ width: '100%' }}>
                                                        <div className="flex flex-wrap gap-x-1">
                                                            {monthData.records.map(r => (
                                                                <span key={r.id} className="inline-block" title={`${r.date} - ${statusLabel[r.status] || r.status}`}>
                                                                    <span className="text-gray-500">{new Date(r.date).getDate()}</span>
                                                                    <span className={
                                                                        r.status === 'PRESENT' ? 'text-green-600 font-bold' :
                                                                        r.status === 'LATE' ? 'text-yellow-600 font-bold' :
                                                                        r.status === 'ABSENT' ? 'text-red-600 font-bold' :
                                                                        'text-blue-600 font-bold'
                                                                    }>{statusVN[r.status] || '?'}</span>
                                                                    {' '}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        <p className="text-[9px] ml-1 text-gray-600">
                                            ✔ {presentCount} có mặt
                                            {absentCount > 0 && <span className="text-red-600"> • ✘ {absentCount} vắng</span>}
                                            {classInfo.fee.type === 'PER_SESSION' && monthFee > 0 && (
                                                <span className="font-bold"> → {formatCurrency(monthFee)}</span>
                                            )}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}

            {/* === GIAO DỊCH GẦN ĐÂY === */}
            <div className="border-t border-b border-gray-200 py-1 mb-1">
                <p className="font-bold text-[10px] mb-1 uppercase">Giao dịch gần đây:</p>
                <table className="w-full text-left">
                    <thead>
                        <tr className="font-bold border-b border-gray-200">
                            <th className="pb-1 w-14">Ngày</th>
                            <th className="pb-1">Nội dung</th>
                            <th className="pb-1 text-right">Tiền</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recentTransactions.map(t => (
                            <tr key={t.id}>
                                <td className="py-0.5 align-top">{new Date(t.date).toLocaleDateString('vi-VN', {day: '2-digit', month:'2-digit'})}</td>
                                <td className="py-0.5 align-top">{t.description.substring(0, 25)}{t.description.length > 25 ? '...' : ''}</td>
                                <td className={`py-0.5 align-top text-right font-semibold ${t.amount >= 0 ? 'text-green-600' : 'text-black'}`}>
                                    {formatCurrency(t.amount)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
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
                <p>Ghi chú: ✔ Có mặt &nbsp; ✘ Vắng &nbsp; ⏰ Muộn</p>
                <p className="mt-1">Cảm ơn Quý phụ huynh!</p>
            </div>
        </div>
    );
};
