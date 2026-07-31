import { useMemo, forwardRef } from 'react';
import { useData } from '../../hooks/useDataContext';
import { Invoice, TransactionType } from '../../types';

interface TuitionFeeNoticeProps {
    invoice: Invoice;
    mode?: 'print' | 'preview';
}

const formatCurrency = (amount: number) => `${Math.round(amount).toLocaleString('vi-VN')} ₫`;

const normalizeAccountName = (name: string) => {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase();
};

const numberToVietnameseWords = (n: number): string => {
    if (n === 0) return 'không đồng';
    const ones = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    const units = ['', 'nghìn', 'triệu', 'tỷ'];
    const readGroup = (g: number): string => {
        const h = Math.floor(g / 100), t = Math.floor((g % 100) / 10), o = g % 10;
        let r = '';
        if (h > 0) r += ones[h] + ' trăm ';
        if (t > 1) { r += ones[t] + ' mươi '; if (o === 1) r += 'mốt '; else if (o === 5) r += 'lăm '; else if (o > 0) r += ones[o] + ' '; }
        else if (t === 1) { r += 'mười '; if (o === 5) r += 'lăm '; else if (o > 0) r += ones[o] + ' '; }
        else { if (h > 0 && o > 0) r += 'lẻ '; if (o > 0) r += ones[o] + ' '; }
        return r.trim();
    };
    const groups: number[] = [];
    let num = Math.round(Math.abs(n));
    while (num > 0) { groups.push(num % 1000); num = Math.floor(num / 1000); }
    let result = '';
    for (let i = groups.length - 1; i >= 0; i--) { if (groups[i] > 0) result += readGroup(groups[i]) + ' ' + units[i] + ' '; }
    result = result.trim() + ' đồng';
    return result.charAt(0).toUpperCase() + result.slice(1);
};

/* ═══════════════════════════════════════════════════════════════
   SVG Icons — WHITE strokes/fills on SOLID colored circle backgrounds
   This is the KEY difference from the reference design:
   Icons must be WHITE (#fff) on solid colored backgrounds for contrast
   ═══════════════════════════════════════════════════════════════ */

// Person icon — white on coral circle
const SvgPerson = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="3.5" fill="#fff"/>
        <path d="M5 20c0-3 3.1-5 7-5s7 2 7 5" fill="#fff" opacity="0.85"/>
    </svg>
);

// Book icon — white on purple circle  
const SvgBook = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M5 4.5A2 2 0 017 2.5h13v19H7a2 2 0 01-2-2v-15z" stroke="#fff" strokeWidth="2" fill="none"/>
        <path d="M5 17.5A2 2 0 017 15.5h13" stroke="#fff" strokeWidth="2"/>
        <path d="M9 7h6M9 11h4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
);

// Graduation cap — white on coral circle
const SvgCap = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 3L2 8.5l10 5.5 10-5.5L12 3z" fill="#fff" opacity="0.9"/>
        <path d="M6 11v5c0 1.3 2.7 2.5 6 2.5s6-1.2 6-2.5v-5" stroke="#fff" strokeWidth="1.6" fill="none"/>
        <path d="M20 8.5v5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
);

// Family icon — white on coral circle
const SvgFamily = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="7" r="2.8" fill="#fff"/>
        <circle cx="16" cy="8" r="2.2" fill="#fff" opacity="0.8"/>
        <path d="M3 19c0-2.5 2.7-4.5 6-4.5s6 2 6 4.5" fill="#fff" opacity="0.7"/>
        <path d="M15.5 14.8c.7-.3 1.5-.5 2.5-.5 2 0 3.5 1.2 3.5 3" stroke="#fff" strokeWidth="1.4" fill="none"/>
    </svg>
);

// Dollar sign — white on coral circle (for debt/credit rows)
const SvgDollar = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8.5" stroke="#fff" strokeWidth="1.8" fill="none"/>
        <path d="M12 7v10M9.5 9.5c0-1 1.1-1.8 2.5-1.8s2.5.8 2.5 1.8-1.1 1.6-2.5 2-2.5 1-2.5 2c0 1 1.1 1.8 2.5 1.8s2.5-.8 2.5-1.8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
);

// Document/invoice icon — white on purple circle
const SvgDoc = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="5" y="3" width="14" height="18" rx="2" stroke="#fff" strokeWidth="1.8" fill="none"/>
        <path d="M9 8h6M9 12h6M9 16h4" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
);

// Heart — filled coral
const SvgHeart = ({ color = '#E8638B' }: { color?: string }) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={color}>
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
);

/* ═══════════════════════════════════════
   MAIN COMPONENT  
   ═══════════════════════════════════════ */
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
        const bal = student.balance;
        const rel = transactions.find(t => t.relatedInvoiceId === invoice.id && t.type === TransactionType.INVOICE);
        const debit = rel ? rel.amount : -invoice.amount;
        const before = bal - debit;
        const debt = before < 0 ? -before : 0;
        const credit = before > 0 ? before : 0;
        const due = debt + invoice.amount - credit;
        return { outstandingDebt: Math.round(debt), openingCredit: Math.round(credit), totalDue: Math.max(0, Math.round(due)) };
    }, [student, transactions, invoice]);

    const qrCodeUrl = useMemo(() => {
        const bin = settings.bankBin?.replace(/\s+/g, '');
        const acc = settings.bankAccountNumber?.replace(/\s+/g, '');
        if (!acc || !bin || !student || financialData.totalDue <= 0) return null;
        const p: Record<string, string> = { amount: financialData.totalDue.toString(), addInfo: `HOC PHI ${student.id}` };
        if (settings.bankAccountHolder) p.accountName = normalizeAccountName(settings.bankAccountHolder);
        return `https://img.vietqr.io/image/${bin}-${acc}-compact2.png?${new URLSearchParams(p).toString()}`;
    }, [settings, student, invoice, financialData.totalDue]);

    if (!student) return <div ref={ref}>Không tìm thấy học viên.</div>;

    const { outstandingDebt, openingCredit, totalDue } = financialData;
    const [invoiceYear, invoiceMonthStr] = invoice.month.split('-');

    /* ── Color Palette (matched to reference ảnh 2) ── */
    const CORAL  = '#E8638B';   // Warm coral/rose — icon circles, accents
    const PURPLE = '#5B4BB5';   // Vibrant purple — section bars, title, primary
    const PURPLE_DARK = '#3D2E8C'; // Deep purple — gradients
    const PURPLE_LIGHT = '#EEEDF7'; // Very light lavender — total bg, borders
    const ORANGE = '#E8922B';   // Amber — month badge
    const WHITE  = '#FFFFFF';
    const TEXT_DARK = '#1E1B3A';  // Near-black for body text
    const TEXT_MID = '#5A5775';   // Medium gray-purple
    const TEXT_LIGHT = '#9B97B0'; // Light gray for labels

    const containerW: React.CSSProperties = mode === 'preview'
        ? { width: '100%', maxWidth: '620px', margin: '0 auto' }
        : { width: '620px', margin: '0 auto' };

    /* Solid colored icon circle — the KEY design element */
    const iconCircle = (bg: string): React.CSSProperties => ({
        width: '42px', height: '42px', borderRadius: '50%',
        background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        boxShadow: `0 2px 8px ${bg}40`,
    });

    /* Section header bar */
    const sectionBar: React.CSSProperties = {
        background: `linear-gradient(135deg, ${PURPLE_DARK}, ${PURPLE})`,
        color: WHITE,
        fontWeight: 700,
        fontSize: '13px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        padding: '9px 20px',
    };

    return (
        <div ref={ref} style={{
            ...containerW,
            fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
            backgroundColor: WHITE,
            color: TEXT_DARK,
            lineHeight: 1.5,
        }}>
            <div style={{ padding: '30px 30px 22px' }}>

                {/* ═══════════ HEADER ═══════════ */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    {/* Left: Logo + Center info */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flex: 1 }}>
                        {settings.logoUrl && (
                            <img src={settings.logoUrl} alt="" style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'contain' }} crossOrigin="anonymous" />
                        )}
                        <div>
                            <div style={{ fontSize: '18px', fontWeight: 800, color: PURPLE_DARK, textTransform: 'uppercase', lineHeight: 1.25 }}>
                                {settings.name}
                            </div>
                            {settings.address && (
                                <div style={{ fontSize: '11.5px', color: TEXT_MID, marginTop: '3px' }}>
                                    <span style={{ color: PURPLE, marginRight: '4px', fontSize: '8px' }}>●</span>{settings.address}
                                </div>
                            )}
                            {settings.phone && (
                                <div style={{ fontSize: '11.5px', color: TEXT_MID, marginTop: '1px' }}>
                                    <span style={{ color: PURPLE, marginRight: '4px', fontSize: '8px' }}>●</span>Hotline: <strong style={{ color: TEXT_DARK }}>{settings.phone}</strong>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Title + Month badge */}
                    <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '10px' }}>
                        <div style={{
                            fontSize: '28px', fontWeight: 900, color: PURPLE_DARK,
                            textTransform: 'uppercase', lineHeight: 1.0,
                        }}>
                            PHIẾU THU HỌC PHÍ
                        </div>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            marginTop: '8px', padding: '5px 16px',
                            background: ORANGE, color: WHITE, borderRadius: '5px',
                            fontSize: '13px', fontWeight: 700,
                        }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <rect x="3" y="4" width="18" height="18" rx="3" fill={WHITE} opacity="0.35" stroke={WHITE} strokeWidth="1.5"/>
                                <path d="M3 10h18M8 2v4M16 2v4" stroke={WHITE} strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            Tháng {String(parseInt(invoiceMonthStr)).padStart(2, '0')} năm {invoiceYear}
                        </div>
                    </div>
                </div>

                {/* Meta row */}
                <div style={{
                    display: 'flex', justifyContent: 'center', gap: '28px',
                    fontSize: '11.5px', color: TEXT_LIGHT, padding: '8px 0 10px',
                    marginBottom: '16px', borderBottom: `1.5px solid ${PURPLE_LIGHT}`,
                }}>
                    <span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ verticalAlign: 'middle', marginRight: '3px' }}>
                            <rect x="4" y="2" width="16" height="20" rx="2" stroke={TEXT_LIGHT} strokeWidth="1.4" fill="none"/>
                            <path d="M8 7h8M8 11h5" stroke={TEXT_LIGHT} strokeWidth="1.1" strokeLinecap="round"/>
                        </svg>
                        Mã HĐ: <strong style={{ color: TEXT_DARK, fontFamily: 'monospace' }}>#{invoice.id.slice(-5)}</strong>
                    </span>
                    <span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ verticalAlign: 'middle', marginRight: '3px' }}>
                            <path d="M17 3a2.8 2.8 0 014 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke={TEXT_LIGHT} strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
                        </svg>
                        Ngày lập: <strong style={{ color: TEXT_DARK }}>{new Date(invoice.generatedDate).toLocaleDateString('vi-VN')}</strong>
                    </span>
                </div>

                {/* ═══════════ THÔNG TIN HỌC VIÊN ═══════════ */}
                <div style={{ marginBottom: '18px', border: `1.5px solid ${PURPLE_LIGHT}`, borderRadius: '10px', overflow: 'hidden', background: WHITE }}>
                    <div style={sectionBar}>THÔNG TIN HỌC VIÊN</div>
                    <div style={{ padding: '18px 24px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 0' }}>
                            {/* Row 1: Họ tên | Lớp */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingRight: '20px', borderRight: `1.5px solid ${PURPLE_LIGHT}` }}>
                                <div style={iconCircle(CORAL)}><SvgPerson /></div>
                                <div>
                                    <div style={{ fontSize: '10px', color: TEXT_LIGHT, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Họ và tên</div>
                                    <div style={{ fontSize: '16px', fontWeight: 700, color: TEXT_DARK }}>{student.name}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '20px' }}>
                                <div style={iconCircle(PURPLE)}><SvgBook /></div>
                                <div>
                                    <div style={{ fontSize: '10px', color: TEXT_LIGHT, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Lớp đang học</div>
                                    <div style={{ fontSize: '15px', fontWeight: 700, color: TEXT_DARK }}>{enrolledClasses.map(c => c.name).join(', ') || '—'}</div>
                                </div>
                            </div>

                            {/* Row 2: Mã HV | Phụ huynh */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingRight: '20px', borderRight: `1.5px solid ${PURPLE_LIGHT}` }}>
                                <div style={iconCircle(CORAL)}><SvgCap /></div>
                                <div>
                                    <div style={{ fontSize: '10px', color: TEXT_LIGHT, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Mã học viên</div>
                                    <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'monospace', color: TEXT_DARK }}>{student.id}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '20px' }}>
                                <div style={iconCircle(CORAL)}><SvgFamily /></div>
                                <div>
                                    <div style={{ fontSize: '10px', color: TEXT_LIGHT, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Phụ huynh</div>
                                    <div style={{ fontSize: '15px', fontWeight: 700, color: TEXT_DARK }}>{student.parentName || '—'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════ NỘI DUNG / DIỄN GIẢI ═══════════ */}
                <div style={{ marginBottom: '18px', border: `1.5px solid ${PURPLE_LIGHT}`, borderRadius: '10px', overflow: 'hidden', background: WHITE }}>
                    <div style={{ ...sectionBar, display: 'flex', justifyContent: 'space-between' }}>
                        <span>NỘI DUNG / DIỄN GIẢI</span>
                        <span>THÀNH TIỀN</span>
                    </div>

                    {/* Nợ cũ kỳ trước */}
                    {outstandingDebt > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: `1px solid ${PURPLE_LIGHT}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={iconCircle(CORAL)}><SvgDollar /></div>
                                <div style={{ fontWeight: 700, fontSize: '14px', color: TEXT_DARK }}>Nợ cũ kỳ trước</div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '15px', color: TEXT_DARK }}>{formatCurrency(outstandingDebt)}</div>
                        </div>
                    )}

                    {/* Số dư kỳ trước */}
                    {openingCredit > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: `1px solid ${PURPLE_LIGHT}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={iconCircle('#22c55e')}><SvgDollar /></div>
                                <div style={{ fontWeight: 700, fontSize: '14px', color: TEXT_DARK }}>Đã thanh toán / Số dư kỳ trước</div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '15px', color: '#16a34a' }}>-{formatCurrency(openingCredit)}</div>
                        </div>
                    )}

                    {/* Học phí tháng */}
                    <div style={{ padding: '14px 24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                                <div style={{ ...iconCircle(PURPLE), marginTop: '2px' }}><SvgDoc /></div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '14px', color: TEXT_DARK, marginBottom: '5px' }}>
                                        Học phí tháng {invoiceMonthStr}/{invoiceYear}
                                    </div>
                                    {invoice.details && (
                                        <div style={{ fontSize: '12px', color: TEXT_MID, lineHeight: 1.65 }}>
                                            {invoice.details.split('\n').filter(l => l.trim()).map((line, i) => (
                                                <div key={i}>- {line.trim().replace(/^-\s*/, '')}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '15px', whiteSpace: 'nowrap', marginLeft: '14px', color: TEXT_DARK }}>
                                {formatCurrency(invoice.amount)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════ TỔNG THANH TOÁN ═══════════ */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '18px 24px', marginBottom: '18px',
                    border: `1.5px solid ${PURPLE_LIGHT}`, borderRadius: '10px',
                    background: PURPLE_LIGHT,
                }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '16px', textTransform: 'uppercase', color: TEXT_DARK }}>TỔNG THANH TOÁN</div>
                        <div style={{ fontSize: '11.5px', color: TEXT_MID, fontStyle: 'italic', marginTop: '3px' }}>
                            (Bằng chữ: {numberToVietnameseWords(totalDue)})
                        </div>
                    </div>
                    <div style={{ fontSize: '34px', fontWeight: 900, color: PURPLE, letterSpacing: '-0.02em' }}>
                        {formatCurrency(totalDue)}
                    </div>
                </div>

                {/* ═══════════ THÔNG TIN CHUYỂN KHOẢN ═══════════ */}
                {totalDue > 0 && settings.bankAccountNumber && (
                    <div style={{ border: `1.5px solid ${PURPLE_LIGHT}`, borderRadius: '10px', overflow: 'hidden', marginBottom: '18px', background: WHITE }}>
                        {/* Centered pill header with decorative side lines */}
                        <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px' }}>
                            <div style={{ flex: 1, height: '1.5px', background: PURPLE_LIGHT }}></div>
                            <div style={{
                                background: `linear-gradient(135deg, ${PURPLE_DARK}, ${PURPLE})`, color: WHITE,
                                fontWeight: 700, fontSize: '12px', textTransform: 'uppercase',
                                letterSpacing: '0.08em', padding: '8px 24px',
                                borderRadius: '0 0 8px 8px', whiteSpace: 'nowrap',
                            }}>
                                THÔNG TIN CHUYỂN KHOẢN
                            </div>
                            <div style={{ flex: 1, height: '1.5px', background: PURPLE_LIGHT }}></div>
                        </div>

                        {/* 3-column: Bank info | Transfer content | QR */}
                        <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                            {/* Col 1: Bank details */}
                            <div style={{ flex: '0 0 auto' }}>
                                <div style={{ fontSize: '13px', color: TEXT_MID, fontWeight: 600 }}>{settings.bankName}</div>
                                <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: "'Courier New', monospace", letterSpacing: '0.04em', color: TEXT_DARK, margin: '3px 0' }}>
                                    {settings.bankAccountNumber}
                                </div>
                                <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: TEXT_MID }}>
                                    {settings.bankAccountHolder}
                                </div>
                            </div>

                            {/* Col 2: Transfer content (centered) */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80px' }}>
                                <div style={{ fontSize: '10px', color: TEXT_LIGHT, fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' }}>
                                    Nội dung chuyển khoản (bắt buộc)
                                </div>
                                <div style={{
                                    fontFamily: "'Courier New', monospace", fontWeight: 800, fontSize: '15px',
                                    padding: '8px 18px',
                                    border: `2.5px dashed ${PURPLE}`,
                                    borderRadius: '6px',
                                    background: PURPLE_LIGHT,
                                    color: PURPLE_DARK,
                                    letterSpacing: '0.06em',
                                    whiteSpace: 'nowrap',
                                }}>
                                    HOC PHI {student.id}
                                </div>
                            </div>

                            {/* Col 3: QR */}
                            {qrCodeUrl && (
                                <div style={{ flexShrink: 0 }}>
                                    <img src={qrCodeUrl} alt="QR" style={{ width: '130px', height: '130px', objectFit: 'contain' }} crossOrigin="anonymous" />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══════════ FOOTER ═══════════ */}
                <div style={{
                    textAlign: 'center', padding: '10px 0 0',
                    borderTop: `1.5px solid ${PURPLE_LIGHT}`,
                    fontSize: '13px', color: CORAL, fontWeight: 600, fontStyle: 'italic',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}>
                    <SvgHeart color={CORAL} /> Cảm ơn Quý phụ huynh và học viên đã tin tưởng đồng hành!
                </div>
            </div>
        </div>
    );
});