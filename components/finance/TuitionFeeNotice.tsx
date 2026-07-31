import { useMemo, forwardRef } from 'react';
import { useData } from '../../hooks/useDataContext';
import { Invoice, TransactionType } from '../../types';

interface TuitionFeeNoticeProps {
    invoice: Invoice;
    /** 'print' = fixed A4 width for html2canvas export; 'preview' = responsive for modal display */
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

// Convert number to Vietnamese words
const numberToVietnameseWords = (n: number): string => {
    if (n === 0) return 'không đồng';
    const ones = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    const units = ['', 'nghìn', 'triệu', 'tỷ'];

    const readGroup = (g: number): string => {
        const h = Math.floor(g / 100);
        const t = Math.floor((g % 100) / 10);
        const o = g % 10;
        let result = '';
        if (h > 0) result += ones[h] + ' trăm ';
        if (t > 1) {
            result += ones[t] + ' mươi ';
            if (o === 1) result += 'mốt ';
            else if (o === 5) result += 'lăm ';
            else if (o > 0) result += ones[o] + ' ';
        } else if (t === 1) {
            result += 'mười ';
            if (o === 5) result += 'lăm ';
            else if (o > 0) result += ones[o] + ' ';
        } else {
            if (h > 0 && o > 0) result += 'lẻ ';
            if (o > 0) result += ones[o] + ' ';
        }
        return result.trim();
    };

    const groups: number[] = [];
    let num = Math.round(Math.abs(n));
    while (num > 0) {
        groups.push(num % 1000);
        num = Math.floor(num / 1000);
    }

    let result = '';
    for (let i = groups.length - 1; i >= 0; i--) {
        if (groups[i] > 0) {
            result += readGroup(groups[i]) + ' ' + units[i] + ' ';
        }
    }

    result = result.trim() + ' đồng';
    // Capitalize first letter
    return result.charAt(0).toUpperCase() + result.slice(1);
};

export const TuitionFeeNotice = forwardRef<HTMLDivElement, TuitionFeeNoticeProps>(({ invoice, mode = 'print' }, ref) => {
    const { state } = useData();
    const { students, transactions, settings, classes } = state;

    const student = useMemo(() => students.find(s => s.id === invoice.studentId), [students, invoice]);

    const enrolledClasses = useMemo(() => {
        if (!student) return [];
        return classes.filter(c => c.studentIds.includes(student.id));
    }, [classes, student]);

    const financialData = useMemo(() => {
        if (!student) {
            return { outstandingDebt: 0, openingCredit: 0, totalDue: 0 };
        }

        const currentRealTimeBalance = student.balance;
        const relatedTransaction = transactions.find(t => t.relatedInvoiceId === invoice.id && t.type === TransactionType.INVOICE);
        const thisInvoiceDebitAmount = relatedTransaction ? relatedTransaction.amount : -invoice.amount;
        
        const balanceBeforeThisInvoice = currentRealTimeBalance - thisInvoiceDebitAmount;

        const outstandingDebt = balanceBeforeThisInvoice < 0 ? -balanceBeforeThisInvoice : 0;
        const openingCredit = balanceBeforeThisInvoice > 0 ? balanceBeforeThisInvoice : 0;
        
        const totalDue = outstandingDebt + invoice.amount - openingCredit;

        return {
            outstandingDebt: Math.round(outstandingDebt),
            openingCredit: Math.round(openingCredit),
            totalDue: Math.max(0, Math.round(totalDue)),
        };
    }, [student, transactions, invoice]);

    const qrCodeUrl = useMemo(() => {
        const bankBin = settings.bankBin?.replace(/\s+/g, '');
        const bankAccountNumber = settings.bankAccountNumber?.replace(/\s+/g, '');

        if (!bankAccountNumber || !bankBin || !student || financialData.totalDue <= 0) {
            return null;
        }

        const description = `HOC PHI ${student.id}`;
        
        const params: Record<string, string> = {
            amount: financialData.totalDue.toString(),
            addInfo: description,
        };
        
        if (settings.bankAccountHolder) {
            params.accountName = normalizeAccountName(settings.bankAccountHolder);
        }
        
        return `https://img.vietqr.io/image/${bankBin}-${bankAccountNumber}-compact2.png?${new URLSearchParams(params).toString()}`;

    }, [settings, student, invoice, financialData.totalDue]);


    if (!student) return <div ref={ref}>Học viên không tồn tại.</div>;

    const { outstandingDebt, openingCredit, totalDue } = financialData;
    const isPreview = mode === 'preview';
    const themeColor = settings.themeColor || '#4F46E5';
    
    // Parse themeColor to get lighter/darker variants
    const themeColorLight = themeColor + '18'; // ~10% opacity for bg
    const themeColorMid = themeColor + '30'; // ~20% opacity

    // Container: fixed 210mm for print/export, responsive for preview  
    const containerStyle: React.CSSProperties = isPreview
        ? { width: '100%', maxWidth: '100%', margin: '0 auto', boxSizing: 'border-box' as const }
        : { width: '210mm', margin: '0 auto', boxSizing: 'border-box' as const };

    // Section header style (gradient bar like in the design)
    const sectionHeaderStyle: React.CSSProperties = {
        background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)`,
        color: '#fff',
        fontWeight: 700,
        fontSize: '13px',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.08em',
        padding: '8px 16px',
        borderRadius: '6px 6px 0 0',
    };

    // Parse invoice details for class breakdown
    const classBreakdown = useMemo(() => {
        if (!invoice.details) return [];
        const lines = invoice.details.split('\n');
        const summaries: { className: string; totalSessions: string; sessions: string; rate: string; amount: string }[] = [];
        let currentClass = '';
        let currentRate = '';
        let totalSessionsStr = '';

        for (const line of lines) {
            // Match class header: "📚 Toán 9 cơ bản 2026 (50.000 đ/buổi)"
            const classMatch = line.match(/^[📚🎓]*\s*(.+?)\s*\(([^)]+đ\/buổi)\)/);
            if (classMatch) {
                currentClass = classMatch[1].trim();
                currentRate = classMatch[2].trim();
                continue;
            }
            // Match total sessions: "Tổng: 12 buổi" or header with session count
            const totalMatch = line.match(/(\d+)\/(\d+)\s*buổi/);
            if (totalMatch) {
                totalSessionsStr = `${totalMatch[1]}/${totalMatch[2]}`;
            }
            // Match result line: "✔ 6 có mặt → 300.000 đ"
            const resultMatch = line.match(/[✔✓]\s*(\d+)\s*có mặt\s*→\s*([\d.,]+\s*đ?)/);
            if (resultMatch && currentClass) {
                summaries.push({
                    className: currentClass,
                    totalSessions: totalSessionsStr || resultMatch[1],
                    sessions: resultMatch[1],
                    rate: currentRate,
                    amount: resultMatch[2].includes('đ') ? resultMatch[2] : resultMatch[2] + ' đ',
                });
                currentClass = '';
                totalSessionsStr = '';
                continue;
            }
        }
        return summaries;
    }, [invoice.details]);

    const [invoiceYear, invoiceMonthStr] = invoice.month.split('-');
    const invoiceMonthNum = parseInt(invoiceMonthStr);

    return (
        <div ref={ref} style={{ ...containerStyle, fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", backgroundColor: '#fff', color: '#1f2937' }}>
            <div style={{ padding: isPreview ? '20px' : '24px', background: `linear-gradient(180deg, ${themeColorLight} 0%, #ffffff 200px)` }}>

                {/* ═══════════ HEADER ═══════════ */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    {/* Left: Center info */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                        {settings.logoUrl && (
                            <img src={settings.logoUrl} alt="Logo" style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '8px' }} crossOrigin="anonymous" />
                        )}
                        <div>
                            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, textTransform: 'uppercase', color: themeColor, lineHeight: 1.2 }}>
                                {settings.name}
                            </h1>
                            {settings.address && (
                                <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#6b7280' }}>📍 {settings.address}</p>
                            )}
                            {settings.phone && (
                                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#6b7280' }}>📞 Hotline: <strong style={{ color: '#374151' }}>{settings.phone}</strong></p>
                            )}
                        </div>
                    </div>

                    {/* Right: Title */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: themeColor, textTransform: 'uppercase', letterSpacing: '-0.01em', lineHeight: 1.1 }}>
                            PHIẾU THU HỌC PHÍ
                        </h2>
                        <div style={{ 
                            display: 'inline-block', marginTop: '6px', padding: '4px 14px', 
                            background: themeColor, color: '#fff', borderRadius: '4px',
                            fontSize: '14px', fontWeight: 700
                        }}>
                            📅 Tháng {String(invoiceMonthNum).padStart(2, '0')} năm {invoiceYear}
                        </div>
                    </div>
                </div>

                {/* Meta info row */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', fontSize: '11px', color: '#9ca3af', padding: '6px 0', borderBottom: `1px solid ${themeColorMid}`, marginBottom: '16px' }}>
                    <span>📋 Mã HĐ: <strong style={{ color: '#374151', fontFamily: 'monospace' }}>#{invoice.id.slice(-6)}</strong></span>
                    <span>✍️ Ngày lập: <strong style={{ color: '#374151' }}>{new Date(invoice.generatedDate).toLocaleDateString('vi-VN')}</strong></span>
                </div>

                {/* ═══════════ STUDENT INFO ═══════════ */}
                <div style={{ marginBottom: '16px', border: `1.5px solid ${themeColorMid}`, borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={sectionHeaderStyle}>THÔNG TIN HỌC VIÊN</div>
                    <div style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 32px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                <span style={{ fontSize: '20px', lineHeight: 1 }}>👤</span>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>Họ và tên</div>
                                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{student.name}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                <span style={{ fontSize: '20px', lineHeight: 1 }}>📚</span>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>Lớp đang học</div>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{enrolledClasses.map(c => c.name).join(', ')}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                <span style={{ fontSize: '20px', lineHeight: 1 }}>🎓</span>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>Mã học viên</div>
                                    <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace', color: '#111827' }}>{student.id}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                <span style={{ fontSize: '20px', lineHeight: 1 }}>👨‍👩‍👧</span>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>Phụ huynh</div>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{student.parentName}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════ FEE DETAILS ═══════════ */}
                <div style={{ marginBottom: '16px', border: `1.5px solid ${themeColorMid}`, borderRadius: '8px', overflow: 'hidden' }}>
                    {/* Table header */}
                    <div style={{ ...sectionHeaderStyle, borderRadius: 0, display: 'flex', justifyContent: 'space-between' }}>
                        <span>NỘI DUNG / DIỄN GIẢI</span>
                        <span>THÀNH TIỀN</span>
                    </div>

                    <div style={{ padding: '0' }}>
                        {/* Outstanding debt row */}
                        {Math.round(outstandingDebt) > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #e5e7eb' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '28px', lineHeight: 1, opacity: 0.7 }}>💰</span>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '14px' }}>Nợ cũ kỳ trước</div>
                                    </div>
                                </div>
                                <div style={{ fontWeight: 700, fontSize: '16px', color: '#dc2626' }}>
                                    {formatCurrency(outstandingDebt)}
                                </div>
                            </div>
                        )}

                        {/* Opening credit row */}
                        {Math.round(openingCredit) > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #e5e7eb' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '28px', lineHeight: 1, opacity: 0.7 }}>✅</span>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '14px' }}>Đã thanh toán / Số dư kỳ trước</div>
                                    </div>
                                </div>
                                <div style={{ fontWeight: 700, fontSize: '16px', color: '#16a34a' }}>
                                    -{formatCurrency(openingCredit)}
                                </div>
                            </div>
                        )}

                        {/* Tuition fee row */}
                        <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
                                    <span style={{ fontSize: '28px', lineHeight: 1, opacity: 0.7 }}>📖</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>
                                            Học phí tháng {invoiceMonthStr}/{invoiceYear}
                                        </div>
                                        {/* Class breakdown details */}
                                        {classBreakdown.length > 0 ? (
                                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                                {classBreakdown.map((cb, idx) => (
                                                    <div key={idx} style={{ padding: '3px 0', paddingLeft: '4px', borderLeft: `2px solid ${themeColorMid}`, marginBottom: '4px', marginLeft: '2px' }}>
                                                        <span style={{ color: '#374151', fontWeight: 600 }}>- Lớp {cb.className}</span>
                                                        <span> ({cb.sessions}/{cb.totalSessions} buổi): </span>
                                                        <span>Tính {cb.sessions} buổi × {cb.rate} = <strong style={{ color: '#111827' }}>{cb.amount}</strong></span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : invoice.details ? (
                                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                                {invoice.details.split('\n').filter(l => l.trim()).map((line, idx) => (
                                                    <div key={idx} style={{ padding: '1px 0' }}>{line.trim()}</div>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                                <div style={{ fontWeight: 700, fontSize: '16px', whiteSpace: 'nowrap', marginLeft: '16px' }}>
                                    {formatCurrency(invoice.amount)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════ TOTAL ═══════════ */}
                <div style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '16px 20px', marginBottom: '16px',
                    border: `2px solid ${themeColor}`, borderRadius: '8px',
                    background: `linear-gradient(135deg, ${themeColorLight}, ${themeColor}10)`
                }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '15px', textTransform: 'uppercase', color: '#1f2937' }}>
                            TỔNG THANH TOÁN
                        </div>
                        <div style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic', marginTop: '2px' }}>
                            (Bằng chữ: {numberToVietnameseWords(totalDue)})
                        </div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 900, color: themeColor, letterSpacing: '-0.02em' }}>
                        {formatCurrency(totalDue)}
                    </div>
                </div>

                {/* ═══════════ BANK TRANSFER ═══════════ */}
                {totalDue > 0 && settings.bankAccountNumber && (
                    <div style={{ border: `1.5px solid ${themeColorMid}`, borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
                        {/* Section header with centered text */}
                        <div style={{ ...sectionHeaderStyle, textAlign: 'center' as const, borderRadius: 0 }}>
                            THÔNG TIN CHUYỂN KHOẢN
                        </div>
                        <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                            {/* Left: Bank details */}
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '14px', color: '#374151' }}>{settings.bankName}</div>
                                        <div style={{ fontWeight: 800, fontSize: '22px', fontFamily: 'monospace', letterSpacing: '0.05em', color: '#111827', margin: '4px 0' }}>
                                            {settings.bankAccountNumber}
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', color: '#4b5563' }}>
                                            {settings.bankAccountHolder}
                                        </div>
                                    </div>
                                </div>

                                {/* Transfer content */}
                                <div style={{ marginTop: '12px' }}>
                                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
                                        Nội dung chuyển khoản (bắt buộc)
                                    </div>
                                    <div style={{ 
                                        display: 'inline-block',
                                        fontFamily: 'monospace', fontWeight: 800, fontSize: '16px',
                                        padding: '8px 16px', 
                                        border: `2px dashed ${themeColor}`,
                                        borderRadius: '6px',
                                        backgroundColor: themeColorLight,
                                        color: themeColor,
                                        letterSpacing: '0.05em',
                                    }}>
                                        HOC PHI {student.id}
                                    </div>
                                </div>
                            </div>

                            {/* Right: QR Code */}
                            {qrCodeUrl && (
                                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                                    <img 
                                        src={qrCodeUrl} alt="QR Code" 
                                        style={{ width: '140px', height: '140px', objectFit: 'contain', borderRadius: '4px' }}
                                        crossOrigin="anonymous"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══════════ FOOTER ═══════════ */}
                <div style={{ 
                    textAlign: 'center', padding: '10px 0', marginTop: '4px',
                    borderTop: `1.5px solid ${themeColorMid}`,
                    fontSize: '12px', color: themeColor, fontWeight: 600, fontStyle: 'italic'
                }}>
                    ❤️ Cảm ơn Quý phụ huynh và học viên đã tin tưởng đồng hành!
                </div>
            </div>
        </div>
    );
});