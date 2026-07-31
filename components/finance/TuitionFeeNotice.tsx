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
    return result.charAt(0).toUpperCase() + result.slice(1);
};

// ─── SVG Icons (render perfectly in html2canvas unlike emoji) ───
const IconUser = ({ color }: { color: string }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="8" r="4.5" fill={color} opacity="0.2" stroke={color} strokeWidth="1.5"/>
        <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" fill={color} opacity="0.15" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
);
const IconBook = ({ color }: { color: string }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15z" fill={color} opacity="0.12" stroke={color} strokeWidth="1.5"/>
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke={color} strokeWidth="1.5"/>
        <path d="M9 7h6M9 11h4" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
);
const IconGrad = ({ color }: { color: string }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3L2 9l10 6 10-6-10-6z" fill={color} opacity="0.2" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M6 11.5v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" stroke={color} strokeWidth="1.5"/>
        <path d="M20 9v6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
);
const IconFamily = ({ color }: { color: string }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="9" cy="7" r="3" fill={color} opacity="0.2" stroke={color} strokeWidth="1.3"/>
        <circle cx="16" cy="7" r="2.5" fill={color} opacity="0.15" stroke={color} strokeWidth="1.3"/>
        <path d="M3 20c0-2.8 2.7-5 6-5s6 2.2 6 5" fill={color} opacity="0.1" stroke={color} strokeWidth="1.3"/>
        <path d="M15 15.3c1-.5 2.2-.8 3.5-.8 2.5 0 4.5 1.5 4.5 3.5" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
);
const IconMoney = ({ color }: { color: string }) => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="9" fill={color} opacity="0.12" stroke={color} strokeWidth="1.5"/>
        <path d="M12 6v12M9 9.5c0-1 1.3-2 3-2s3 1 3 2-1.3 1.8-3 2.2-3 1.2-3 2.3c0 1 1.3 2 3 2s3-1 3-2" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
);
const IconInvoice = ({ color }: { color: string }) => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="2" width="16" height="20" rx="2" fill={color} opacity="0.1" stroke={color} strokeWidth="1.5"/>
        <path d="M8 7h8M8 11h8M8 15h5" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
);
const IconCalendar = ({ color }: { color: string }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="4" width="18" height="18" rx="3" fill={color} opacity="0.12" stroke={color} strokeWidth="1.5"/>
        <path d="M3 10h18M8 2v4M16 2v4" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
);
const IconPin = ({ color }: { color: string }) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z" fill={color} opacity="0.2" stroke={color} strokeWidth="1.8"/>
        <circle cx="12" cy="9" r="2.5" fill={color} opacity="0.3"/>
    </svg>
);
const IconPhone = ({ color }: { color: string }) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.6a2 2 0 01-.4 2.1L8 9.7a16 16 0 006.3 6.3l1.3-1.3a2 2 0 012.1-.4c.8.3 1.7.5 2.6.7a2 2 0 011.7 2z" fill={color} opacity="0.15" stroke={color} strokeWidth="1.5"/>
    </svg>
);
const IconDoc = ({ color }: { color: string }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="2" width="16" height="20" rx="2" fill={color} opacity="0.12" stroke={color} strokeWidth="1.5"/>
        <path d="M8 7h8M8 11h5" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
);
const IconPen = ({ color }: { color: string }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 3a2.8 2.8 0 014 4L7.5 20.5 2 22l1.5-5.5L17 3z" fill={color} opacity="0.12" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
);
const IconHeart = ({ color }: { color: string }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
);

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
    const tc = settings.themeColor || '#4338CA'; // theme color

    // Parse invoice details for class breakdown
    const classBreakdown = useMemo(() => {
        if (!invoice.details) return [];
        const lines = invoice.details.split('\n');
        const summaries: { className: string; totalSessions: string; sessions: string; rate: string; amount: string }[] = [];
        let currentClass = '';
        let currentRate = '';
        let totalSessionsStr = '';

        for (const line of lines) {
            const classMatch = line.match(/^[📚🎓]*\s*(.+?)\s*\(([^)]+đ\/buổi)\)/);
            if (classMatch) {
                currentClass = classMatch[1].trim();
                currentRate = classMatch[2].trim();
                continue;
            }
            const totalMatch = line.match(/(\d+)\/(\d+)\s*buổi/);
            if (totalMatch) {
                totalSessionsStr = `${totalMatch[1]}/${totalMatch[2]}`;
            }
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

    // ─── Shared styles ───
    const containerWidth: React.CSSProperties = isPreview
        ? { width: '100%', maxWidth: '600px', margin: '0 auto' }
        : { width: '600px', margin: '0 auto' };
    
    const sectionBar: React.CSSProperties = {
        background: tc,
        color: '#fff',
        fontWeight: 700,
        fontSize: '13px',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        padding: '7px 14px',
        borderRadius: '4px',
        marginBottom: '0',
    };

    return (
        <div ref={ref} style={{
            ...containerWidth,
            fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
            backgroundColor: '#fff',
            color: '#1a1a2e',
            lineHeight: 1.5,
        }}>
            <div style={{ padding: '28px 28px 20px' }}>

                {/* ═══ HEADER ═══ */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    {/* Left: logo + name */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flex: 1 }}>
                        {settings.logoUrl && (
                            <img src={settings.logoUrl} alt="" style={{ width: '42px', height: '42px', borderRadius: '6px', objectFit: 'contain' }} crossOrigin="anonymous" />
                        )}
                        <div>
                            <div style={{ fontSize: '17px', fontWeight: 800, color: tc, textTransform: 'uppercase', lineHeight: 1.2 }}>
                                {settings.name}
                            </div>
                            {settings.address && (
                                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <IconPin color={tc} /> {settings.address}
                                </div>
                            )}
                            {settings.phone && (
                                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '1px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <IconPhone color={tc} /> Hotline: <strong style={{ color: '#374151' }}>{settings.phone}</strong>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: title */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '22px', fontWeight: 900, color: tc, textTransform: 'uppercase', letterSpacing: '-0.01em', lineHeight: 1.1, fontStyle: 'italic' }}>
                            PHIẾU THU HỌC PHÍ
                        </div>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            marginTop: '5px', padding: '3px 12px',
                            background: tc, color: '#fff', borderRadius: '4px',
                            fontSize: '13px', fontWeight: 700,
                        }}>
                            <IconCalendar color="#fff" />
                            Tháng {String(invoiceMonthNum).padStart(2, '0')} năm {invoiceYear}
                        </div>
                    </div>
                </div>

                {/* Meta row */}
                <div style={{
                    display: 'flex', justifyContent: 'center', gap: '20px',
                    fontSize: '11px', color: '#9ca3af', padding: '6px 0', marginBottom: '14px',
                    borderBottom: `1px solid ${tc}22`,
                }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <IconDoc color="#9ca3af" /> Mã HĐ: <strong style={{ color: '#374151', fontFamily: 'monospace' }}>#{invoice.id.slice(-5)}</strong>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <IconPen color="#9ca3af" /> Ngày lập: <strong style={{ color: '#374151' }}>{new Date(invoice.generatedDate).toLocaleDateString('vi-VN')}</strong>
                    </span>
                </div>

                {/* ═══ STUDENT INFO ═══ */}
                <div style={{ marginBottom: '14px', border: `1.5px solid ${tc}30`, borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={sectionBar}>THÔNG TIN HỌC VIÊN</div>
                    <div style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
                            {/* Name */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `${tc}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <IconUser color={tc} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Họ và tên</div>
                                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>{student.name}</div>
                                </div>
                            </div>
                            {/* Class */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `${tc}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <IconBook color={tc} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Lớp đang học</div>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{enrolledClasses.map(c => c.name).join(', ')}</div>
                                </div>
                            </div>
                            {/* Student ID */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `${tc}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <IconGrad color={tc} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Mã học viên</div>
                                    <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace', color: '#111827' }}>{student.id}</div>
                                </div>
                            </div>
                            {/* Parent */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `${tc}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <IconFamily color={tc} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Phụ huynh</div>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{student.parentName}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══ FEE BREAKDOWN ═══ */}
                <div style={{ marginBottom: '14px', border: `1.5px solid ${tc}30`, borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ ...sectionBar, display: 'flex', justifyContent: 'space-between' }}>
                        <span>NỘI DUNG / DIỄN GIẢI</span>
                        <span>THÀNH TIỀN</span>
                    </div>

                    {/* Outstanding debt */}
                    {Math.round(outstandingDebt) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <IconMoney color="#dc2626" />
                                <div style={{ fontWeight: 700, fontSize: '14px' }}>Nợ cũ kỳ trước</div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '15px', color: '#111827' }}>
                                {formatCurrency(outstandingDebt)}
                            </div>
                        </div>
                    )}

                    {/* Opening credit */}
                    {Math.round(openingCredit) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <IconMoney color="#16a34a" />
                                <div style={{ fontWeight: 700, fontSize: '14px' }}>Đã thanh toán / Số dư kỳ trước</div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '15px', color: '#16a34a' }}>
                                -{formatCurrency(openingCredit)}
                            </div>
                        </div>
                    )}

                    {/* Tuition fee */}
                    <div style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
                                <div style={{ marginTop: '2px' }}><IconInvoice color={tc} /></div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                                        Học phí tháng {invoiceMonthStr}/{invoiceYear}
                                    </div>
                                    {classBreakdown.length > 0 ? (
                                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                            {classBreakdown.map((cb, idx) => (
                                                <div key={idx} style={{ padding: '2px 0 2px 8px', borderLeft: `2px solid ${tc}40`, marginBottom: '3px' }}>
                                                    - Lớp {cb.className} ({cb.sessions}/{cb.totalSessions} buổi): Tính {cb.sessions} buổi × {cb.rate} = <strong style={{ color: '#111827' }}>{cb.amount}</strong>
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
                            <div style={{ fontWeight: 700, fontSize: '15px', whiteSpace: 'nowrap', marginLeft: '12px', color: '#111827' }}>
                                {formatCurrency(invoice.amount)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══ TOTAL ═══ */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 18px', marginBottom: '14px',
                    border: `2px solid ${tc}`, borderRadius: '6px',
                    background: `${tc}08`,
                }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '15px', textTransform: 'uppercase' }}>TỔNG THANH TOÁN</div>
                        <div style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic', marginTop: '1px' }}>
                            (Bằng chữ: {numberToVietnameseWords(totalDue)})
                        </div>
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: 900, color: tc }}>
                        {formatCurrency(totalDue)}
                    </div>
                </div>

                {/* ═══ BANK TRANSFER ═══ */}
                {totalDue > 0 && settings.bankAccountNumber && (
                    <div style={{ border: `1.5px solid ${tc}30`, borderRadius: '6px', overflow: 'hidden', marginBottom: '14px' }}>
                        <div style={{ ...sectionBar, textAlign: 'center' }}>THÔNG TIN CHUYỂN KHOẢN</div>
                        <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                            {/* Bank info */}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: '13px', color: '#4b5563' }}>{settings.bankName}</div>
                                <div style={{ fontWeight: 800, fontSize: '20px', fontFamily: 'monospace', letterSpacing: '0.04em', color: '#111827', margin: '3px 0' }}>
                                    {settings.bankAccountNumber}
                                </div>
                                <div style={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', color: '#374151' }}>
                                    {settings.bankAccountHolder}
                                </div>

                                <div style={{ marginTop: '10px' }}>
                                    <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '3px' }}>
                                        Nội dung chuyển khoản (bắt buộc)
                                    </div>
                                    <div style={{
                                        display: 'inline-block',
                                        fontFamily: 'monospace', fontWeight: 800, fontSize: '15px',
                                        padding: '6px 14px',
                                        border: `2px dashed ${tc}`,
                                        borderRadius: '4px',
                                        background: `${tc}10`,
                                        color: tc,
                                        letterSpacing: '0.04em',
                                    }}>
                                        HOC PHI {student.id}
                                    </div>
                                </div>
                            </div>

                            {/* QR */}
                            {qrCodeUrl && (
                                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                                    <img src={qrCodeUrl} alt="QR Code" style={{ width: '130px', height: '130px', objectFit: 'contain' }} crossOrigin="anonymous" />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══ FOOTER ═══ */}
                <div style={{
                    textAlign: 'center', padding: '8px 0',
                    borderTop: `1px solid ${tc}20`,
                    fontSize: '12px', color: tc, fontWeight: 600, fontStyle: 'italic',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                }}>
                    <IconHeart color={tc} /> Cảm ơn Quý phụ huynh và học viên đã tin tưởng đồng hành!
                </div>
            </div>
        </div>
    );
});