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

/* ═══ SVG Icons — WHITE on solid backgrounds ═══ */
const SvgPerson = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="3.5" fill="#fff"/>
        <path d="M5 20c0-3 3.1-5 7-5s7 2 7 5" fill="#fff" opacity="0.85"/>
    </svg>
);
const SvgBook = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M5 4.5A2 2 0 017 2.5h13v19H7a2 2 0 01-2-2v-15z" stroke="#fff" strokeWidth="2" fill="none"/>
        <path d="M5 17.5A2 2 0 017 15.5h13" stroke="#fff" strokeWidth="2"/>
        <path d="M9 7h6M9 11h4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
);
const SvgCap = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 3L2 8.5l10 5.5 10-5.5L12 3z" fill="#fff" opacity="0.9"/>
        <path d="M6 11v5c0 1.3 2.7 2.5 6 2.5s6-1.2 6-2.5v-5" stroke="#fff" strokeWidth="1.6" fill="none"/>
        <path d="M20 8.5v5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
);
const SvgFamily = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="7" r="2.8" fill="#fff"/>
        <circle cx="16" cy="8" r="2.2" fill="#fff" opacity="0.8"/>
        <path d="M3 19c0-2.5 2.7-4.5 6-4.5s6 2 6 4.5" fill="#fff" opacity="0.7"/>
        <path d="M15.5 14.8c.7-.3 1.5-.5 2.5-.5 2 0 3.5 1.2 3.5 3" stroke="#fff" strokeWidth="1.4" fill="none"/>
    </svg>
);
const SvgDollar = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8.5" stroke="#fff" strokeWidth="1.8" fill="none"/>
        <path d="M12 7v10M9.5 9.5c0-1 1.1-1.8 2.5-1.8s2.5.8 2.5 1.8-1.1 1.6-2.5 2-2.5 1-2.5 2c0 1 1.1 1.8 2.5 1.8s2.5-.8 2.5-1.8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
);
const SvgDoc = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="5" y="3" width="14" height="18" rx="2" stroke="#fff" strokeWidth="1.8" fill="none"/>
        <path d="M9 8h6M9 12h6M9 16h4" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
);
const SvgHeart = ({ color = '#E8638B' }: { color?: string }) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={color}>
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
);

/* ═══ MAIN COMPONENT ═══ */
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

    /* ── VIBRANT Color Palette ── */
    const CORAL = '#E8638B';
    const PURPLE = '#5B4BB5';
    const PURPLE_DARK = '#3D2E8C';
    const PURPLE_LIGHT = '#EEEDF7';
    const ORANGE = '#E8922B';
    const WHITE = '#FFFFFF';
    const BLACK = '#111111';       // Darker text for readability
    const TEXT_BODY = '#2D2A45';   // Dark purple-black for body
    const TEXT_LABEL = '#6B6789';  // Labels - darker than before
    const GREEN = '#16a34a';

    const containerW: React.CSSProperties = mode === 'preview'
        ? { width: '100%', maxWidth: '700px', margin: '0 auto' }
        : { width: '700px', margin: '0 auto' };

    const iconCircle = (bg: string): React.CSSProperties => ({
        width: '42px', height: '42px', borderRadius: '50%',
        background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        boxShadow: `0 2px 8px ${bg}40`,
    });

    const sectionBar: React.CSSProperties = {
        background: `linear-gradient(135deg, ${PURPLE_DARK}, ${PURPLE})`,
        color: WHITE,
        fontWeight: 700,
        fontSize: '13px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        padding: '9px 22px',
    };

    return (
        <div ref={ref} style={{
            ...containerW,
            fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
            backgroundColor: WHITE,
            color: TEXT_BODY,
            lineHeight: 1.5,
        }}>
            <div style={{ padding: '32px 32px 24px' }}>

                {/* ═══════════ HEADER ═══════════ 
                    Layout: 2 columns
                    Left: Logo + Name (1 line) + Address + Phone
                    Right: "PHIẾU THU HỌC PHÍ" on line 1, month tag BELOW on its own line
                */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    {/* Left column */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        {settings.logoUrl && (
                            <img src={settings.logoUrl} alt="" style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'contain' }} crossOrigin="anonymous" />
                        )}
                        <div>
                            <div style={{
                                fontSize: '17px', fontWeight: 800, color: PURPLE_DARK,
                                textTransform: 'uppercase', lineHeight: 1.3,
                                whiteSpace: 'nowrap', // ← PREVENT LINE BREAK
                            }}>
                                {settings.name}
                            </div>
                            {settings.address && (
                                <div style={{ fontSize: '11.5px', color: TEXT_LABEL, marginTop: '3px' }}>
                                    <span style={{ color: CORAL, marginRight: '4px', fontSize: '9px' }}>●</span>{settings.address}
                                </div>
                            )}
                            {settings.phone && (
                                <div style={{ fontSize: '11.5px', color: TEXT_LABEL, marginTop: '1px' }}>
                                    <span style={{ color: CORAL, marginRight: '4px', fontSize: '9px' }}>●</span>Hotline: <strong style={{ color: BLACK }}>{settings.phone}</strong>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right column — title ABOVE, month tag BELOW with spacing */}
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '16px' }}>
                        <div style={{
                            fontSize: '24px', fontWeight: 900, color: PURPLE_DARK,
                            textTransform: 'uppercase', lineHeight: 1.1,
                            whiteSpace: 'nowrap',
                        }}>
                            PHIẾU THU HỌC PHÍ
                        </div>
                        {/* Month badge — separate block, not overlapping */}
                        <div style={{ marginTop: '8px' }}>
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '5px 16px',
                                background: ORANGE, color: WHITE, borderRadius: '5px',
                                fontSize: '13px', fontWeight: 700,
                            }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                    <rect x="3" y="4" width="18" height="18" rx="3" fill={WHITE} opacity="0.35" stroke={WHITE} strokeWidth="1.5"/>
                                    <path d="M3 10h18M8 2v4M16 2v4" stroke={WHITE} strokeWidth="1.5" strokeLinecap="round"/>
                                </svg>
                                Tháng {String(parseInt(invoiceMonthStr)).padStart(2, '0')} năm {invoiceYear}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ═══ Meta row: Mã HĐ + Ngày lập ON SAME LINE ═══ */}
                <div style={{
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '32px',
                    fontSize: '12px', color: TEXT_LABEL, padding: '8px 0 10px',
                    marginBottom: '18px', borderBottom: `1.5px solid ${PURPLE_LIGHT}`,
                }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                            <rect x="4" y="2" width="16" height="20" rx="2" stroke={TEXT_LABEL} strokeWidth="1.4" fill="none"/>
                            <path d="M8 7h8M8 11h5" stroke={TEXT_LABEL} strokeWidth="1.1" strokeLinecap="round"/>
                        </svg>
                        <span>Mã HĐ: <strong style={{ color: BLACK, fontFamily: 'monospace' }}>#{invoice.id.slice(-5)}</strong></span>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                            <path d="M17 3a2.8 2.8 0 014 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke={TEXT_LABEL} strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
                        </svg>
                        <span>Ngày lập: <strong style={{ color: BLACK }}>{new Date(invoice.generatedDate).toLocaleDateString('vi-VN')}</strong></span>
                    </span>
                </div>

                {/* ═══════════ THÔNG TIN HỌC VIÊN ═══════════ */}
                <div style={{ marginBottom: '18px', border: `1.5px solid ${PURPLE_LIGHT}`, borderRadius: '10px', overflow: 'hidden', background: WHITE }}>
                    <div style={sectionBar}>THÔNG TIN HỌC VIÊN</div>
                    <div style={{ padding: '18px 24px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingRight: '20px', borderRight: `1.5px solid ${PURPLE_LIGHT}` }}>
                                <div style={iconCircle(CORAL)}><SvgPerson /></div>
                                <div>
                                    <div style={{ fontSize: '10px', color: TEXT_LABEL, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Họ và tên</div>
                                    <div style={{ fontSize: '16px', fontWeight: 700, color: BLACK }}>{student.name}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '20px' }}>
                                <div style={iconCircle(PURPLE)}><SvgBook /></div>
                                <div>
                                    <div style={{ fontSize: '10px', color: TEXT_LABEL, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Lớp đang học</div>
                                    <div style={{ fontSize: '15px', fontWeight: 700, color: BLACK }}>{enrolledClasses.map(c => c.name).join(', ') || '—'}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingRight: '20px', borderRight: `1.5px solid ${PURPLE_LIGHT}` }}>
                                <div style={iconCircle(CORAL)}><SvgCap /></div>
                                <div>
                                    <div style={{ fontSize: '10px', color: TEXT_LABEL, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Mã học viên</div>
                                    <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'monospace', color: BLACK }}>{student.id}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '20px' }}>
                                <div style={iconCircle(CORAL)}><SvgFamily /></div>
                                <div>
                                    <div style={{ fontSize: '10px', color: TEXT_LABEL, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Phụ huynh</div>
                                    <div style={{ fontSize: '15px', fontWeight: 700, color: BLACK }}>{student.parentName || '—'}</div>
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

                    {outstandingDebt > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: `1px solid ${PURPLE_LIGHT}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={iconCircle(CORAL)}><SvgDollar /></div>
                                <div style={{ fontWeight: 700, fontSize: '14px', color: BLACK }}>Nợ cũ kỳ trước</div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '15px', color: BLACK }}>{formatCurrency(outstandingDebt)}</div>
                        </div>
                    )}

                    {openingCredit > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: `1px solid ${PURPLE_LIGHT}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={iconCircle(GREEN)}><SvgDollar /></div>
                                <div style={{ fontWeight: 700, fontSize: '14px', color: BLACK }}>Đã thanh toán / Số dư kỳ trước</div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '15px', color: GREEN }}>-{formatCurrency(openingCredit)}</div>
                        </div>
                    )}

                    <div style={{ padding: '14px 24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                                <div style={{ ...iconCircle(PURPLE), marginTop: '2px' }}><SvgDoc /></div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '14px', color: BLACK, marginBottom: '5px' }}>
                                        Học phí tháng {invoiceMonthStr}/{invoiceYear}
                                    </div>
                                    {invoice.details && (
                                        <div style={{ fontSize: '12.5px', color: TEXT_BODY, lineHeight: 1.65 }}>
                                            {invoice.details.split('\n').filter(l => l.trim()).map((line, i) => (
                                                <div key={i}>- {line.trim().replace(/^-\s*/, '')}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '15px', whiteSpace: 'nowrap', marginLeft: '14px', color: BLACK }}>
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
                        <div style={{ fontWeight: 800, fontSize: '16px', textTransform: 'uppercase', color: BLACK }}>TỔNG THANH TOÁN</div>
                        <div style={{ fontSize: '12px', color: TEXT_BODY, fontStyle: 'italic', marginTop: '3px' }}>
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

                        <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
                            <div style={{ flex: '0 0 auto' }}>
                                <div style={{ fontSize: '13px', color: TEXT_LABEL, fontWeight: 600 }}>{settings.bankName}</div>
                                <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: "'Courier New', monospace", letterSpacing: '0.04em', color: BLACK, margin: '3px 0' }}>
                                    {settings.bankAccountNumber}
                                </div>
                                <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: TEXT_BODY }}>
                                    {settings.bankAccountHolder}
                                </div>
                            </div>

                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80px' }}>
                                <div style={{ fontSize: '10px', color: TEXT_LABEL, fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' }}>
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