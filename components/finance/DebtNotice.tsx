
import React, { useMemo } from 'react';
import { Student, Transaction, CenterSettings, AttendanceRecord, Class } from '../../types';

interface DebtNoticeProps {
    student: Student;
    transactions: Transaction[];
    settings: CenterSettings;
    attendance?: AttendanceRecord[];
    classes?: Class[];
    /** 'print' = fixed-size for html2canvas export; 'preview' = responsive for modal display */
    mode?: 'print' | 'preview';
}

const formatCurrency = (amount: number) => `${Math.round(amount).toLocaleString('vi-VN')} ₫`;

const normalizeAccountName = (name: string) => {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase();
};

export const DebtNotice: React.FC<DebtNoticeProps> = ({ student, transactions: _transactions, settings, attendance = [], classes = [], mode = 'print' }) => {
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

    const isPreview = mode === 'preview';

    // Container styles
    const containerStyle: React.CSSProperties = isPreview
        ? { fontFamily: "'Segoe UI', system-ui, sans-serif", maxWidth: '100%', margin: '0 auto', color: '#111827', backgroundColor: '#fff' }
        : { fontFamily: "'Segoe UI', system-ui, sans-serif", maxWidth: '480px', margin: '0 auto', color: '#111827', backgroundColor: '#fff' };

    return (
        <div 
            className={isPreview ? "rounded-lg" : ""}
            style={containerStyle}
        >
            {/* Inner wrapper with padding */}
            <div style={{ padding: isPreview ? '20px' : '24px' }}>
                {/* Header */}
                <header style={{ textAlign: 'center', paddingBottom: '12px', borderBottom: '2px dashed #d1d5db' }}>
                    <h1 style={{ fontSize: '16px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.025em', color: settings.themeColor || '#4F46E5', margin: 0, lineHeight: 1.3 }}>
                        {settings.name}
                    </h1>
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>{settings.address}</p>
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>ĐT: {settings.phone}</p>
                </header>

                {/* Title */}
                <div style={{ textAlign: 'center', margin: '14px 0' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 800, textTransform: 'uppercase', margin: 0, color: '#111827' }}>
                        THÔNG BÁO HỌC PHÍ
                    </h2>
                    <p style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic', margin: '4px 0 0' }}>
                        Ngày: {new Date().toLocaleDateString('vi-VN')}
                    </p>
                </div>

                {/* Student Info */}
                <div style={{ marginBottom: '12px', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', backgroundColor: '#f9fafb' }}>
                    <p style={{ fontSize: '13px', margin: '0 0 4px' }}>
                        <span style={{ fontWeight: 700 }}>Học viên:</span> {student.name}
                    </p>
                    {student.parentName && (
                        <p style={{ fontSize: '13px', margin: '0 0 4px' }}>
                            <span style={{ fontWeight: 700 }}>Phụ huynh:</span> {student.parentName}
                        </p>
                    )}
                    {studentClasses.length > 0 && (
                        <p style={{ fontSize: '12px', margin: '0', color: '#6b7280' }}>
                            Lớp: {studentClasses.map(c => c.name).join(', ')}
                        </p>
                    )}
                </div>

                {/* Attendance Breakdown */}
                <div style={{ marginBottom: '12px', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                    <p style={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px', color: '#374151' }}>
                        Chi tiết học phí:
                    </p>
                    {monthlySummaries.length > 0 ? (
                        <div>
                            {monthlySummaries.map((item, idx) => (
                                <div key={idx} style={{ fontSize: '12px', padding: '5px 0', borderBottom: idx < monthlySummaries.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <span style={{ fontWeight: 600 }}>{item.monthLabel}</span>
                                            <span style={{ color: settings.themeColor || '#4F46E5' }}> — {item.className}</span>
                                        </div>
                                        {item.feeType === 'PER_SESSION' && item.rate > 0 && (
                                            <span style={{ fontWeight: 700, whiteSpace: 'nowrap', marginLeft: '8px' }}>
                                                {formatCurrency(item.total)}
                                            </span>
                                        )}
                                        {item.feeType === 'MONTHLY' && item.total > 0 && (
                                            <span style={{ fontWeight: 700, whiteSpace: 'nowrap', marginLeft: '8px' }}>
                                                {formatCurrency(item.total)}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                                        {item.sessions} buổi
                                        {item.feeType === 'PER_SESSION' && item.rate > 0 && ` × ${formatCurrency(item.rate)}`}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '12px', margin: 0 }}>
                            Chưa có dữ liệu điểm danh.
                        </p>
                    )}
                </div>

                {/* Total Due */}
                <div style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                    padding: '12px 14px', margin: '0 0 12px',
                    borderTop: '2px solid #1f2937', borderBottom: '2px solid #1f2937',
                    backgroundColor: totalDue > 0 ? '#fef2f2' : '#f0fdf4'
                }}>
                    <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '13px' }}>
                        Cần thanh toán
                    </span>
                    <span style={{ fontWeight: 800, fontSize: '20px', color: totalDue > 0 ? '#dc2626' : '#16a34a' }}>
                        {formatCurrency(totalDue)}
                    </span>
                </div>

                {/* Bank Transfer Info */}
                {totalDue > 0 && settings.bankAccountNumber && (
                    <div style={{ padding: '12px', border: '1px solid #e5e7eb', borderRadius: '6px', backgroundColor: '#fffbeb' }}>
                        <p style={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', textDecoration: 'underline', margin: '0 0 8px', textAlign: 'center' }}>
                            Thông tin chuyển khoản
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                            <div style={{ flex: 1 }}>
                                <p style={{ fontSize: '12px', margin: '0 0 2px' }}>{settings.bankName}</p>
                                <p style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'monospace', margin: '0 0 2px' }}>
                                    {settings.bankAccountNumber}
                                </p>
                                <p style={{ fontSize: '12px', margin: '0 0 8px' }}>{settings.bankAccountHolder}</p>
                                <div style={{ 
                                    padding: '6px 10px', backgroundColor: '#fef3c7', border: '1.5px solid #f59e0b', 
                                    borderRadius: '4px', textAlign: 'center' 
                                }}>
                                    <p style={{ fontSize: '10px', fontWeight: 700, margin: '0 0 2px', textTransform: 'uppercase' }}>
                                        Nội dung CK:
                                    </p>
                                    <p style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace', margin: 0, color: '#dc2626' }}>
                                        {`HOC PHI ${student.id}`}
                                    </p>
                                </div>
                            </div>
                            {qrCodeUrl && (
                                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                                    <img 
                                        src={qrCodeUrl} alt="QR Code" 
                                        style={{ width: '120px', height: '120px', objectFit: 'contain' }}
                                        crossOrigin="anonymous" 
                                    />
                                    <p style={{ fontSize: '10px', fontWeight: 600, margin: '4px 0 0' }}>
                                        Quét mã thanh toán
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div style={{ textAlign: 'center', marginTop: '12px', fontStyle: 'italic', fontSize: '11px', color: '#9ca3af' }}>
                    <p style={{ margin: 0 }}>Cảm ơn Quý phụ huynh!</p>
                </div>
            </div>
        </div>
    );
};
