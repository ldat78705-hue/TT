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

/* ═══════════════════════════════════════════════════════════
   SVG ICONS — inline vector, renders perfectly in html2canvas
   ═══════════════════════════════════════════════════════════ */
const SvgPerson = ({ size = 20, color = '#E8638B' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" fill={color}/>
        <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" fill={color} opacity="0.55"/>
    </svg>
);
const SvgBook = ({ size = 20, color = '#6C63AC' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="4" y="3" width="16" height="18" rx="2" fill={color} opacity="0.18" stroke={color} strokeWidth="1.6"/>
        <path d="M4 17a2 2 0 012-2h14" stroke={color} strokeWidth="1.6"/>
        <path d="M8 7h8M8 11h5" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
);
const SvgCap = ({ size = 20, color = '#E8638B' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M12 3L2 8.5l10 5.5 10-5.5L12 3z" fill={color} opacity="0.7"/>
        <path d="M6 11v5c0 1.3 2.7 2.5 6 2.5s6-1.2 6-2.5v-5" stroke={color} strokeWidth="1.4" fill="none"/>
    </svg>
);
const SvgFamily = ({ size = 20, color = '#E8638B' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="7" r="3" fill={color} opacity="0.7"/>
        <circle cx="16" cy="8" r="2.5" fill={color} opacity="0.5"/>
        <path d="M3 19c0-2.5 2.7-4.5 6-4.5s6 2 6 4.5" fill={color} opacity="0.4"/>
        <path d="M15 14.8c.8-.3 1.7-.5 2.7-.5 2.2 0 4 1.3 4 3" stroke={color} strokeWidth="1.2" fill="none"/>
    </svg>
);
const SvgDollar = ({ size = 24, color = '#E8638B' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill={color} opacity="0.15" stroke={color} strokeWidth="1.4"/>
        <path d="M12 6v12M9 9c0-1.1 1.3-2 3-2s3 .9 3 2-1.3 1.8-3 2.2S9 13.4 9 14.5c0 1 1.3 2 3 2s3-1 3-2" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
);
const SvgDoc = ({ size = 24, color = '#6C63AC' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="4" y="2" width="16" height="20" rx="2.5" fill={color} opacity="0.12" stroke={color} strokeWidth="1.4"/>
        <path d="M8 7h8M8 11h8M8 15h5" stroke={color} strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
);
const SvgHeart = ({ size = 14, color = '#E8638B' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
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

    // ── EXACT color palette from reference design ──
    const P = '#4A3F8F';     // Primary purple (section bars, title)
    const PL = '#EEEDF7';    // Primary light (backgrounds)
    const PM = '#7B72B8';    // Primary medium
    const A = '#E8638B';     // Accent rose/coral (icon circles)
    const AL = '#FDE8EF';    // Accent light bg
    const O = '#E8922B';     // Orange for month tag
    const W = '#FFFFFF';     // White

    const containerW: React.CSSProperties = mode === 'preview'
        ? { width: '100%', maxWidth: '620px', margin: '0 auto' }
        : { width: '620px', margin: '0 auto' };

    // Icon circle
    const ic = (bg: string): React.CSSProperties => ({
        width: '40px', height: '40px', borderRadius: '50%',
        background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    });

    return (
        <div ref={ref} style={{
            ...containerW,
            fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
            backgroundColor: W,
            color: '#1a1a2e',
            lineHeight: 1.5,
        }}>
            <div style={{ padding: '30px 30px 22px' }}>

                {/* ══════════ HEADER ══════════ */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    {/* Left: Logo + Center name */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flex: 1 }}>
                        {settings.logoUrl && (
                            <img src={settings.logoUrl} alt="" style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'contain' }} crossOrigin="anonymous" />
                        )}
                        <div>
                            <div style={{ fontSize: '18px', fontWeight: 800, color: P, textTransform: 'uppercase', lineHeight: 1.25 }}>
                                {settings.name}
                            </div>
                            {settings.address && (
                                <div style={{ fontSize: '11.5px', color: '#7c7c8a', marginTop: '3px' }}>
                                    <span style={{ color: P, marginRight: '4px', fontSize: '9px' }}>●</span>{settings.address}
                                </div>
                            )}
                            {settings.phone && (
                                <div style={{ fontSize: '11.5px', color: '#7c7c8a', marginTop: '1px' }}>
                                    <span style={{ color: P, marginRight: '4px', fontSize: '9px' }}>●</span>Hotline: <strong style={{ color: '#3a3a4a' }}>{settings.phone}</strong>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Title + Month */}
                    <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '12px' }}>
                        <div style={{
                            fontSize: '26px', fontWeight: 900, color: P,
                            textTransform: 'uppercase', lineHeight: 1.0,
                            letterSpacing: '-0.01em',
                        }}>
                            PHIẾU THU HỌC PHÍ
                        </div>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            marginTop: '7px', padding: '4px 16px',
                            background: O, color: W, borderRadius: '4px',
                            fontSize: '13px', fontWeight: 700,
                        }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <rect x="3" y="4" width="18" height="18" rx="3" fill={W} opacity="0.35" stroke={W} strokeWidth="1.5"/>
                                <path d="M3 10h18M8 2v4M16 2v4" stroke={W} strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            Tháng {String(parseInt(invoiceMonthStr)).padStart(2, '0')} năm {invoiceYear}
                        </div>
                    </div>
                </div>

                {/* Meta row */}
                <div style={{
                    display: 'flex', justifyContent: 'center', gap: '28px',
                    fontSize: '11.5px', color: '#9ca3af', padding: '8px 0 10px',
                    marginBottom: '16px', borderBottom: `1px solid #e8e6f2`,
                }}>
                    <span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ verticalAlign: 'middle', marginRight: '3px' }}>
                            <rect x="4" y="2" width="16" height="20" rx="2" fill="#bbb" opacity="0.25" stroke="#bbb" strokeWidth="1.4"/>
                            <path d="M8 7h8M8 11h5" stroke="#bbb" strokeWidth="1.1" strokeLinecap="round"/>
                        </svg>
                        Mã HĐ: <strong style={{ color: '#4a4a5a', fontFamily: 'monospace' }}>#{invoice.id.slice(-5)}</strong>
                    </span>
                    <span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ verticalAlign: 'middle', marginRight: '3px' }}>
                            <path d="M17 3a2.8 2.8 0 014 4L7.5 20.5 2 22l1.5-5.5L17 3z" fill="#bbb" opacity="0.2" stroke="#bbb" strokeWidth="1.4" strokeLinejoin="round"/>
                        </svg>
                        Ngày lập: <strong style={{ color: '#4a4a5a' }}>{new Date(invoice.generatedDate).toLocaleDateString('vi-VN')}</strong>
                    </span>
                </div>

                {/* ══════════ THÔNG TIN HỌC VIÊN ══════════ */}
                <div style={{ marginBottom: '18px', border: `1.5px solid ${PL}`, borderRadius: '10px', overflow: 'hidden', background: W }}>
                    <div style={{
                        background: `linear-gradient(135deg, ${P}, ${PM})`, color: W,
                        fontWeight: 700, fontSize: '13px', textTransform: 'uppercase',
                        letterSpacing: '0.06em', padding: '8px 18px', borderRadius: '0',
                    }}>
                        THÔNG TIN HỌC VIÊN
                    </div>
                    <div style={{ padding: '18px 22px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 0' }}>
                            {/* Họ tên */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingRight: '18px', borderRight: `1.5px solid ${PL}` }}>
                                <div style={ic(AL)}><SvgPerson size={22} /></div>
                                <div>
                                    <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Họ và tên</div>
                                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a2e' }}>{student.name}</div>
                                </div>
                            </div>
                            {/* Lớp */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '18px' }}>
                                <div style={ic('#EDE9F7')}><SvgBook size={22} /></div>
                                <div>
                                    <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Lớp đang học</div>
                                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a2e' }}>{enrolledClasses.map(c => c.name).join(', ') || '—'}</div>
                                </div>
                            </div>
                            {/* Mã HV */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingRight: '18px', borderRight: `1.5px solid ${PL}` }}>
                                <div style={ic(AL)}><SvgCap size={22} /></div>
                                <div>
                                    <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Mã học viên</div>
                                    <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'monospace', color: '#1a1a2e' }}>{student.id}</div>
                                </div>
                            </div>
                            {/* Phụ huynh */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '18px' }}>
                                <div style={ic(AL)}><SvgFamily size={22} /></div>
                                <div>
                                    <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Phụ huynh</div>
                                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a2e' }}>{student.parentName || '—'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ══════════ NỘI DUNG / DIỄN GIẢI ══════════ */}
                <div style={{ marginBottom: '18px', border: `1.5px solid ${PL}`, borderRadius: '10px', overflow: 'hidden', background: W }}>
                    <div style={{
                        background: `linear-gradient(135deg, ${P}, ${PM})`, color: W,
                        fontWeight: 700, fontSize: '13px', textTransform: 'uppercase',
                        letterSpacing: '0.06em', padding: '8px 18px',
                        display: 'flex', justifyContent: 'space-between',
                    }}>
                        <span>NỘI DUNG / DIỄN GIẢI</span>
                        <span>THÀNH TIỀN</span>
                    </div>

                    {/* Nợ cũ */}
                    {outstandingDebt > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 22px', borderBottom: `1px solid ${PL}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={ic(AL)}><SvgDollar size={22} color={A} /></div>
                                <div style={{ fontWeight: 700, fontSize: '14px' }}>Nợ cũ kỳ trước</div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '15px' }}>{formatCurrency(outstandingDebt)}</div>
                        </div>
                    )}

                    {/* Số dư kỳ trước */}
                    {openingCredit > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 22px', borderBottom: `1px solid ${PL}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={ic('#e6f9ee')}><SvgDollar size={22} color="#16a34a" /></div>
                                <div style={{ fontWeight: 700, fontSize: '14px' }}>Đã thanh toán / Số dư kỳ trước</div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '15px', color: '#16a34a' }}>-{formatCurrency(openingCredit)}</div>
                        </div>
                    )}

                    {/* Học phí */}
                    <div style={{ padding: '14px 22px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                                <div style={{ ...ic('#EDE9F7'), marginTop: '2px' }}><SvgDoc size={22} /></div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '5px' }}>
                                        Học phí tháng {invoiceMonthStr}/{invoiceYear}
                                    </div>
                                    {invoice.details && (
                                        <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.6 }}>
                                            {invoice.details.split('\n').filter(l => l.trim()).map((line, i) => (
                                                <div key={i} style={{ paddingLeft: '4px' }}>- {line.trim().replace(/^-\s*/, '')}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '15px', whiteSpace: 'nowrap', marginLeft: '14px' }}>
                                {formatCurrency(invoice.amount)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ══════════ TỔNG THANH TOÁN ══════════ */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '16px 22px', marginBottom: '18px',
                    border: `1.5px solid ${PL}`, borderRadius: '10px',
                    background: PL,
                }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '16px', textTransform: 'uppercase', color: '#1a1a2e' }}>TỔNG THANH TOÁN</div>
                        <div style={{ fontSize: '11.5px', color: '#6b7280', fontStyle: 'italic', marginTop: '2px' }}>
                            (Bằng chữ: {numberToVietnameseWords(totalDue)})
                        </div>
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: 900, color: P, letterSpacing: '-0.02em' }}>
                        {formatCurrency(totalDue)}
                    </div>
                </div>

                {/* ══════════ THÔNG TIN CHUYỂN KHOẢN ══════════ */}
                {totalDue > 0 && settings.bankAccountNumber && (
                    <div style={{ border: `1.5px solid ${PL}`, borderRadius: '10px', overflow: 'hidden', marginBottom: '18px', background: W }}>
                        {/* Decorative header — centered pill with side lines */}
                        <div style={{ display: 'flex', alignItems: 'center', padding: '0 22px', marginTop: '0' }}>
                            <div style={{ flex: 1, height: '1.5px', background: PL }}></div>
                            <div style={{
                                background: `linear-gradient(135deg, ${P}, ${PM})`, color: W,
                                fontWeight: 700, fontSize: '12px', textTransform: 'uppercase',
                                letterSpacing: '0.06em', padding: '7px 22px',
                                borderRadius: '0 0 8px 8px', whiteSpace: 'nowrap',
                            }}>
                                THÔNG TIN CHUYỂN KHOẢN
                            </div>
                            <div style={{ flex: 1, height: '1.5px', background: PL }}></div>
                        </div>

                        {/* 3-column layout: Bank info | Transfer content | QR */}
                        <div style={{ padding: '16px 22px', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                            {/* Col 1: Bank info */}
                            <div style={{ flex: '0 0 auto' }}>
                                <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: 600 }}>{settings.bankName}</div>
                                <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: "'Courier New', monospace", letterSpacing: '0.04em', color: '#1a1a2e', margin: '3px 0' }}>
                                    {settings.bankAccountNumber}
                                </div>
                                <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#4a4a5a' }}>
                                    {settings.bankAccountHolder}
                                </div>
                            </div>

                            {/* Col 2: Transfer content */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80px' }}>
                                <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 600, marginBottom: '5px' }}>
                                    Nội dung chuyển khoản (bắt buộc)
                                </div>
                                <div style={{
                                    fontFamily: "'Courier New', monospace", fontWeight: 800, fontSize: '15px',
                                    padding: '7px 16px',
                                    border: `2px dashed ${P}`,
                                    borderRadius: '6px',
                                    background: PL,
                                    color: P,
                                    letterSpacing: '0.06em',
                                    whiteSpace: 'nowrap',
                                }}>
                                    HOC PHI {student.id}
                                </div>
                            </div>

                            {/* Col 3: QR Code */}
                            {qrCodeUrl && (
                                <div style={{ flexShrink: 0, textAlign: 'center' }}>
                                    <img src={qrCodeUrl} alt="QR" style={{ width: '130px', height: '130px', objectFit: 'contain' }} crossOrigin="anonymous" />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ══════════ FOOTER ══════════ */}
                <div style={{
                    textAlign: 'center', padding: '10px 0 0',
                    borderTop: `1px solid ${PL}`,
                    fontSize: '13px', color: A, fontWeight: 600, fontStyle: 'italic',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}>
                    <SvgHeart size={15} color={A} /> Cảm ơn Quý phụ huynh và học viên đã tin tưởng đồng hành!
                </div>
            </div>
        </div>
    );
});