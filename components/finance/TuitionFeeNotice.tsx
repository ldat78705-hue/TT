import { useMemo, forwardRef } from 'react';
import { useData } from '../../hooks/useDataContext';
import { Invoice, TransactionType } from '../../types';

interface TuitionFeeNoticeProps {
    invoice: Invoice;
    /** 'print' = fixed width for html2canvas export; 'preview' = responsive for modal display */
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

// ─── SVG Icons ───
const IconPerson = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" fill="#E8638B" opacity="0.8"/>
        <path d="M5 20c0-3 3.1-5.5 7-5.5s7 2.5 7 5.5" fill="#E8638B" opacity="0.5"/>
    </svg>
);
const IconBookClass = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M4 4h16v16H4z" rx="2" fill="#7C6AE8" opacity="0.15"/>
        <path d="M4 4.5A2 2 0 016 2.5h14v19H6a2 2 0 01-2-2v-15z" stroke="#7C6AE8" strokeWidth="1.8" fill="none"/>
        <path d="M4 17.5A2 2 0 016 15.5h14" stroke="#7C6AE8" strokeWidth="1.8"/>
        <path d="M9 7h6M9 11h4" stroke="#7C6AE8" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
);
const IconGrad = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 3L2 8.5l10 5.5 10-5.5L12 3z" fill="#E8638B" opacity="0.6" stroke="#E8638B" strokeWidth="1" strokeLinejoin="round"/>
        <path d="M6 11v4.5c0 1.3 2.7 2.5 6 2.5s6-1.2 6-2.5V11" stroke="#E8638B" strokeWidth="1.5"/>
    </svg>
);
const IconFamily = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="7" r="3" fill="#E8638B" opacity="0.6"/>
        <circle cx="16" cy="8" r="2.5" fill="#E8638B" opacity="0.4"/>
        <path d="M3 19c0-2.5 2.7-4.5 6-4.5s6 2 6 4.5" fill="#E8638B" opacity="0.35"/>
        <path d="M15 14.8c.8-.3 1.7-.5 2.7-.5 2.2 0 4 1.3 4 3" stroke="#E8638B" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
    </svg>
);
const IconDollar = () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#E8638B" opacity="0.15" stroke="#E8638B" strokeWidth="1.5"/>
        <path d="M12 6v12M9 9c0-1.1 1.3-2 3-2s3 .9 3 2-1.3 1.8-3 2.2S9 13.4 9 14.5c0 1 1.3 2 3 2s3-1 3-2" stroke="#E8638B" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
);
const IconInvoicePage = () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="2" width="16" height="20" rx="2.5" fill="#3B3486" opacity="0.1" stroke="#3B3486" strokeWidth="1.5"/>
        <path d="M8 7h8M8 11h8M8 15h5" stroke="#3B3486" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
);

// ─── Color palette matching reference design (ảnh 2) ───
const COLORS = {
    primary: '#3B3486',        // Deep indigo/navy
    primaryLight: '#E8E6F5',   // Very light lavender
    primaryMid: '#9B93D5',     // Medium lavender
    accent: '#E8638B',         // Warm rose/coral for icon circles
    accentLight: '#FDE8EF',    // Very light pink bg
    orange: '#E8922B',         // Amber/orange for month tag
    orangeLight: '#FEF3E0',    // Light amber bg
    textDark: '#1a1a2e',       // Almost black
    textMid: '#4b5563',        // Gray
    textLight: '#9ca3af',      // Light gray
    green: '#16a34a',
    red: '#dc2626',
    white: '#ffffff',
    border: '#E2DFF4',         // Lavender border
    bgTint: '#FAFAFF',         // Subtle lavender background
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
        if (!student) return { outstandingDebt: 0, openingCredit: 0, totalDue: 0 };
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
        if (!bankAccountNumber || !bankBin || !student || financialData.totalDue <= 0) return null;
        const params: Record<string, string> = {
            amount: financialData.totalDue.toString(),
            addInfo: `HOC PHI ${student.id}`,
        };
        if (settings.bankAccountHolder) params.accountName = normalizeAccountName(settings.bankAccountHolder);
        return `https://img.vietqr.io/image/${bankBin}-${bankAccountNumber}-compact2.png?${new URLSearchParams(params).toString()}`;
    }, [settings, student, invoice, financialData.totalDue]);

    if (!student) return <div ref={ref}>Học viên không tồn tại.</div>;

    const { outstandingDebt, openingCredit, totalDue } = financialData;
    const isPreview = mode === 'preview';
    const C = COLORS;

    // Parse invoice details
    const classBreakdown = useMemo(() => {
        if (!invoice.details) return [];
        const lines = invoice.details.split('\n');
        const summaries: { className: string; totalSessions: string; sessions: string; rate: string; amount: string }[] = [];
        let currentClass = '', currentRate = '', totalSessionsStr = '';
        for (const line of lines) {
            const classMatch = line.match(/^[📚🎓]*\s*(.+?)\s*\(([^)]+đ\/buổi)\)/);
            if (classMatch) { currentClass = classMatch[1].trim(); currentRate = classMatch[2].trim(); continue; }
            const totalMatch = line.match(/(\d+)\/(\d+)\s*buổi/);
            if (totalMatch) totalSessionsStr = `${totalMatch[1]}/${totalMatch[2]}`;
            const resultMatch = line.match(/[✔✓]\s*(\d+)\s*có mặt\s*→\s*([\d.,]+\s*đ?)/);
            if (resultMatch && currentClass) {
                summaries.push({ className: currentClass, totalSessions: totalSessionsStr || resultMatch[1], sessions: resultMatch[1], rate: currentRate, amount: resultMatch[2].includes('đ') ? resultMatch[2] : resultMatch[2] + ' đ' });
                currentClass = ''; totalSessionsStr = ''; continue;
            }
        }
        return summaries;
    }, [invoice.details]);

    const [invoiceYear, invoiceMonthStr] = invoice.month.split('-');
    const invoiceMonthNum = parseInt(invoiceMonthStr);

    const containerStyle: React.CSSProperties = isPreview
        ? { width: '100%', maxWidth: '600px', margin: '0 auto' }
        : { width: '600px', margin: '0 auto' };

    // Section bar style (deep purple, rounded corners)
    const sectionBar: React.CSSProperties = {
        background: `linear-gradient(135deg, ${C.primary}, #4A42A0)`,
        color: C.white,
        fontWeight: 700,
        fontSize: '12.5px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        padding: '7px 16px',
        borderRadius: '5px',
    };

    // Icon circle wrapper
    const iconCircle = (bg: string): React.CSSProperties => ({
        width: '38px', height: '38px', borderRadius: '50%',
        background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    });

    return (
        <div ref={ref} style={{
            ...containerStyle,
            fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
            backgroundColor: C.bgTint,
            color: C.textDark,
            lineHeight: 1.5,
        }}>
            <div style={{ padding: '28px 28px 20px' }}>

                {/* ═══════════ HEADER ═══════════ */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    {/* Left: Logo + center info */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flex: 1 }}>
                        {settings.logoUrl && (
                            <img src={settings.logoUrl} alt="" style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'contain' }} crossOrigin="anonymous" />
                        )}
                        <div>
                            <div style={{ fontSize: '17px', fontWeight: 800, color: C.primary, textTransform: 'uppercase', lineHeight: 1.25 }}>
                                {settings.name}
                            </div>
                            {settings.address && (
                                <div style={{ fontSize: '11px', color: C.textLight, marginTop: '3px' }}>
                                    <span style={{ color: C.primary, marginRight: '3px' }}>●</span> {settings.address}
                                </div>
                            )}
                            {settings.phone && (
                                <div style={{ fontSize: '11px', color: C.textLight, marginTop: '1px' }}>
                                    <span style={{ color: C.primary, marginRight: '3px' }}>●</span> Hotline: <strong style={{ color: C.textMid }}>{settings.phone}</strong>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Title + month tag */}
                    <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '12px' }}>
                        <div style={{ fontSize: '23px', fontWeight: 900, color: C.primary, textTransform: 'uppercase', lineHeight: 1.05, fontFamily: "'Georgia', 'Times New Roman', serif", fontStyle: 'italic' }}>
                            PHIẾU THU HỌC PHÍ
                        </div>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            marginTop: '6px', padding: '4px 14px',
                            background: C.orange, color: C.white, borderRadius: '4px',
                            fontSize: '13px', fontWeight: 700,
                        }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="3" fill="#fff" opacity="0.3" stroke="#fff" strokeWidth="1.5"/><path d="M3 10h18M8 2v4M16 2v4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>
                            Tháng {String(invoiceMonthNum).padStart(2, '0')} năm {invoiceYear}
                        </div>
                    </div>
                </div>

                {/* Meta info row */}
                <div style={{
                    display: 'flex', justifyContent: 'center', gap: '24px',
                    fontSize: '11px', color: C.textLight, padding: '6px 0 8px', marginBottom: '14px',
                    borderBottom: `1px solid ${C.border}`,
                }}>
                    <span>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{verticalAlign:'middle', marginRight:'3px'}}><rect x="4" y="2" width="16" height="20" rx="2" fill={C.textLight} opacity="0.2" stroke={C.textLight} strokeWidth="1.5"/><path d="M8 7h8M8 11h5" stroke={C.textLight} strokeWidth="1.2" strokeLinecap="round"/></svg>
                        Mã HĐ: <strong style={{ color: C.textMid, fontFamily: 'monospace' }}>#{invoice.id.slice(-5)}</strong>
                    </span>
                    <span>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{verticalAlign:'middle', marginRight:'3px'}}><path d="M17 3a2.8 2.8 0 014 4L7.5 20.5 2 22l1.5-5.5L17 3z" fill={C.textLight} opacity="0.2" stroke={C.textLight} strokeWidth="1.5" strokeLinejoin="round"/></svg>
                        Ngày lập: <strong style={{ color: C.textMid }}>{new Date(invoice.generatedDate).toLocaleDateString('vi-VN')}</strong>
                    </span>
                </div>

                {/* ═══════════ STUDENT INFO ═══════════ */}
                <div style={{ marginBottom: '16px', border: `1.5px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden', background: C.white }}>
                    <div style={sectionBar}>THÔNG TIN HỌC VIÊN</div>
                    <div style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 0' }}>
                            {/* Row 1 */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingRight: '16px', borderRight: `1px solid ${C.border}` }}>
                                <div style={iconCircle(C.accentLight)}><IconPerson /></div>
                                <div>
                                    <div style={{ fontSize: '10px', color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Họ và tên</div>
                                    <div style={{ fontSize: '16px', fontWeight: 700, color: C.textDark }}>{student.name}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '16px' }}>
                                <div style={iconCircle('#EDE8F5')}><IconBookClass /></div>
                                <div>
                                    <div style={{ fontSize: '10px', color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Lớp đang học</div>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: C.textDark }}>{enrolledClasses.map(c => c.name).join(', ')}</div>
                                </div>
                            </div>

                            {/* Row 2 */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingRight: '16px', borderRight: `1px solid ${C.border}` }}>
                                <div style={iconCircle(C.accentLight)}><IconGrad /></div>
                                <div>
                                    <div style={{ fontSize: '10px', color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Mã học viên</div>
                                    <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace', color: C.textDark }}>{student.id}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '16px' }}>
                                <div style={iconCircle(C.accentLight)}><IconFamily /></div>
                                <div>
                                    <div style={{ fontSize: '10px', color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Phụ huynh</div>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: C.textDark }}>{student.parentName}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════ FEE BREAKDOWN ═══════════ */}
                <div style={{ marginBottom: '16px', border: `1.5px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden', background: C.white }}>
                    <div style={{ ...sectionBar, display: 'flex', justifyContent: 'space-between' }}>
                        <span>NỘI DUNG / DIỄN GIẢI</span>
                        <span>THÀNH TIỀN</span>
                    </div>

                    {/* Outstanding debt row */}
                    {Math.round(outstandingDebt) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={iconCircle(C.accentLight)}><IconDollar /></div>
                                <div style={{ fontWeight: 700, fontSize: '14px', color: C.textDark }}>Nợ cũ kỳ trước</div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '15px', color: C.textDark }}>{formatCurrency(outstandingDebt)}</div>
                        </div>
                    )}

                    {/* Opening credit row */}
                    {Math.round(openingCredit) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={iconCircle('#E6F9EE')}><IconDollar /></div>
                                <div style={{ fontWeight: 700, fontSize: '14px', color: C.textDark }}>Đã thanh toán / Số dư kỳ trước</div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '15px', color: C.green }}>-{formatCurrency(openingCredit)}</div>
                        </div>
                    )}

                    {/* Tuition fee row */}
                    <div style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                                <div style={{ ...iconCircle('#EDE8F5'), marginTop: '2px' }}><IconInvoicePage /></div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '14px', color: C.textDark, marginBottom: '5px' }}>
                                        Học phí tháng {invoiceMonthStr}/{invoiceYear}
                                    </div>
                                    {classBreakdown.length > 0 ? (
                                        <div style={{ fontSize: '12px', color: C.textMid }}>
                                            {classBreakdown.map((cb, idx) => (
                                                <div key={idx} style={{ paddingLeft: '6px', borderLeft: `2px solid ${C.primaryMid}`, marginBottom: '3px', lineHeight: 1.5 }}>
                                                    - Lớp {cb.className} ({cb.sessions}/{cb.totalSessions} buổi): Tính {cb.sessions} buổi × {cb.rate} = <strong style={{ color: C.textDark }}>{cb.amount}</strong>
                                                </div>
                                            ))}
                                        </div>
                                    ) : invoice.details ? (
                                        <div style={{ fontSize: '12px', color: C.textMid }}>
                                            {invoice.details.split('\n').filter(l => l.trim()).map((line, idx) => (
                                                <div key={idx} style={{ lineHeight: 1.5 }}>{line.trim()}</div>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '15px', whiteSpace: 'nowrap', marginLeft: '12px', color: C.textDark }}>
                                {formatCurrency(invoice.amount)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════ TOTAL ═══════════ */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '16px 20px', marginBottom: '16px',
                    border: `1.5px solid ${C.border}`, borderRadius: '8px',
                    background: C.primaryLight,
                }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '16px', textTransform: 'uppercase', color: C.textDark }}>TỔNG THANH TOÁN</div>
                        <div style={{ fontSize: '11px', color: C.textMid, fontStyle: 'italic', marginTop: '2px' }}>
                            (Bằng chữ: {numberToVietnameseWords(totalDue)})
                        </div>
                    </div>
                    <div style={{ fontSize: '30px', fontWeight: 900, color: C.primary, letterSpacing: '-0.02em' }}>
                        {formatCurrency(totalDue)}
                    </div>
                </div>

                {/* ═══════════ BANK TRANSFER ═══════════ */}
                {totalDue > 0 && settings.bankAccountNumber && (
                    <div style={{ border: `1.5px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden', marginBottom: '16px', background: C.white }}>
                        {/* Decorative header with bracket lines */}
                        <div style={{ textAlign: 'center', padding: '0 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0', margin: '0' }}>
                                <div style={{ flex: 1, height: '1px', background: C.border }}></div>
                                <div style={{
                                    ...sectionBar,
                                    borderRadius: '0 0 8px 8px',
                                    padding: '7px 20px',
                                    display: 'inline-block',
                                    fontSize: '12px',
                                }}>
                                    THÔNG TIN CHUYỂN KHOẢN
                                </div>
                                <div style={{ flex: 1, height: '1px', background: C.border }}></div>
                            </div>
                        </div>

                        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px' }}>
                            {/* Left: Bank info + transfer content */}
                            <div style={{ flex: 1 }}>
                                <div style={{ marginBottom: '4px' }}>
                                    <div style={{ fontWeight: 600, fontSize: '13px', color: C.textMid }}>{settings.bankName}</div>
                                    <div style={{ fontWeight: 800, fontSize: '22px', fontFamily: "'Courier New', monospace", letterSpacing: '0.04em', color: C.textDark, margin: '2px 0' }}>
                                        {settings.bankAccountNumber}
                                    </div>
                                    <div style={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', color: C.textMid }}>
                                        {settings.bankAccountHolder}
                                    </div>
                                </div>

                                <div style={{ marginTop: '10px' }}>
                                    <div style={{ fontSize: '10px', color: C.textLight, marginBottom: '3px', fontWeight: 600 }}>
                                        Nội dung chuyển khoản (bắt buộc)
                                    </div>
                                    <div style={{
                                        display: 'inline-block',
                                        fontFamily: "'Courier New', monospace", fontWeight: 800, fontSize: '15px',
                                        padding: '6px 14px',
                                        border: `2px dashed ${C.primary}`,
                                        borderRadius: '5px',
                                        background: C.primaryLight,
                                        color: C.primary,
                                        letterSpacing: '0.06em',
                                    }}>
                                        HOC PHI {student.id}
                                    </div>
                                </div>
                            </div>

                            {/* Right: QR Code */}
                            {qrCodeUrl && (
                                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                                    <img src={qrCodeUrl} alt="QR Code" style={{ width: '135px', height: '135px', objectFit: 'contain' }} crossOrigin="anonymous" />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══════════ FOOTER ═══════════ */}
                <div style={{
                    textAlign: 'center', padding: '10px 0 2px',
                    borderTop: `1px solid ${C.border}`,
                    fontSize: '12.5px', color: C.accent, fontWeight: 600, fontStyle: 'italic',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={C.accent}><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    Cảm ơn Quý phụ huynh và học viên đã tin tưởng đồng hành!
                </div>
            </div>
        </div>
    );
});