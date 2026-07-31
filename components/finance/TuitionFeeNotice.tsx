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

/*
 * ╔════════════════════════════════════════════════════════════════╗
 * ║  DESIGN STRATEGY: html2canvas-safe layout                      ║
 * ║  - ALL layout uses <div> + <table> (never inline-flex spans)  ║
 * ║  - NO SVG inside text badges (html2canvas clips them)         ║
 * ║  - Icon circles use <div> with flex (safe in html2canvas)     ║
 * ║  - Text always direct child of <div> (never wrapped in span)  ║
 * ╚════════════════════════════════════════════════════════════════╝
 */

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

    /* ── Color Palette ── */
    const C = {
        coral: '#E8638B',
        purple: '#5B4BB5',
        purpleDark: '#3D2E8C',
        purpleLight: '#EEEDF7',
        orange: '#E8922B',
        white: '#FFFFFF',
        black: '#111111',
        body: '#2D2A45',
        label: '#6B6789',
        green: '#16a34a',
    };

    const W = mode === 'preview' ? '100%' : '700px';
    const maxW = mode === 'preview' ? '700px' : undefined;

    // Icon circle helper — simple div with flex
    const ic = (bg: string, children: React.ReactNode) => (
        <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, minWidth: '40px',
        }}>{children}</div>
    );

    // Section header bar
    const bar = (text: string, rightText?: string) => (
        <div style={{
            background: `linear-gradient(135deg, ${C.purpleDark}, ${C.purple})`,
            color: C.white, fontWeight: 700, fontSize: '13px',
            textTransform: 'uppercase' as const, letterSpacing: '0.08em',
            padding: '9px 22px',
            display: rightText ? 'flex' : 'block',
            justifyContent: rightText ? 'space-between' : undefined,
        }}>
            <div>{text}</div>
            {rightText && <div>{rightText}</div>}
        </div>
    );

    return (
        <div ref={ref} style={{
            width: W, maxWidth: maxW, margin: '0 auto',
            fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
            backgroundColor: C.white, color: C.body, lineHeight: 1.5,
        }}>
            <div style={{ padding: '32px 32px 24px' }}>

                {/* ══════════ HEADER — using TABLE for html2canvas safety ══════════ */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px' }}>
                    <tbody>
                        <tr>
                            {/* Left: Logo + Name */}
                            <td style={{ verticalAlign: 'top', paddingRight: '12px' }}>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                    {settings.logoUrl && (
                                        <img src={settings.logoUrl} alt="" style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'contain' }} crossOrigin="anonymous" />
                                    )}
                                    <div>
                                        <div style={{ fontSize: '17px', fontWeight: 800, color: C.purpleDark, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                            {settings.name}
                                        </div>
                                        {settings.address && (
                                            <div style={{ fontSize: '11px', color: C.label, marginTop: '3px' }}>
                                                <span style={{ color: C.coral, marginRight: '4px' }}>●</span>{settings.address}
                                            </div>
                                        )}
                                        {settings.phone && (
                                            <div style={{ fontSize: '11px', color: C.label, marginTop: '1px' }}>
                                                <span style={{ color: C.coral, marginRight: '4px' }}>●</span>Hotline: <strong style={{ color: C.black }}>{settings.phone}</strong>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </td>
                            {/* Right: Title + Month */}
                            <td style={{ verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <div style={{ fontSize: '24px', fontWeight: 900, color: C.purpleDark, textTransform: 'uppercase' }}>
                                    PHIẾU THU HỌC PHÍ
                                </div>
                                {/* Month badge — SIMPLE div, NO SVG, NO inline-flex */}
                                <div style={{ marginTop: '8px', textAlign: 'center' }}>
                                    <div style={{
                                        display: 'inline-block',
                                        padding: '6px 18px',
                                        background: C.orange, color: C.white, borderRadius: '5px',
                                        fontSize: '13px', fontWeight: 700,
                                        textAlign: 'center',
                                    }}>
                                        📅 Tháng {String(parseInt(invoiceMonthStr)).padStart(2, '0')} năm {invoiceYear}
                                    </div>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* ══════════ META ROW — using TABLE for perfect icon-text alignment ══════════ */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '18px', borderBottom: `1.5px solid ${C.purpleLight}` }}>
                    <tbody>
                        <tr>
                            <td style={{ textAlign: 'center', padding: '10px 0', fontSize: '12px', color: C.label }}>
                                📋 Mã HĐ: <strong style={{ color: C.black, fontFamily: 'monospace' }}>#{invoice.id.slice(-5)}</strong>
                                <span style={{ margin: '0 20px' }}></span>
                                ✏️ Ngày lập: <strong style={{ color: C.black }}>{new Date(invoice.generatedDate).toLocaleDateString('vi-VN')}</strong>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* ══════════ THÔNG TIN HỌC VIÊN ══════════ */}
                <div style={{ marginBottom: '18px', border: `1.5px solid ${C.purpleLight}`, borderRadius: '10px', overflow: 'hidden' }}>
                    {bar('THÔNG TIN HỌC VIÊN')}
                    <div style={{ padding: '16px 22px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                                <tr>
                                    <td style={{ padding: '8px 16px 8px 0', borderRight: `1.5px solid ${C.purpleLight}`, width: '50%', verticalAlign: 'middle' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            {ic(C.coral, <SvgPerson />)}
                                            <div>
                                                <div style={{ fontSize: '10px', color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Họ và tên</div>
                                                <div style={{ fontSize: '16px', fontWeight: 700, color: C.black }}>{student.name}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '8px 0 8px 16px', width: '50%', verticalAlign: 'middle' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            {ic(C.purple, <SvgBook />)}
                                            <div>
                                                <div style={{ fontSize: '10px', color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Lớp đang học</div>
                                                <div style={{ fontSize: '15px', fontWeight: 700, color: C.black }}>{enrolledClasses.map(c => c.name).join(', ') || '—'}</div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '8px 16px 8px 0', borderRight: `1.5px solid ${C.purpleLight}`, verticalAlign: 'middle' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            {ic(C.coral, <SvgCap />)}
                                            <div>
                                                <div style={{ fontSize: '10px', color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Mã học viên</div>
                                                <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'monospace', color: C.black }}>{student.id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '8px 0 8px 16px', verticalAlign: 'middle' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            {ic(C.coral, <SvgFamily />)}
                                            <div>
                                                <div style={{ fontSize: '10px', color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Phụ huynh</div>
                                                <div style={{ fontSize: '15px', fontWeight: 700, color: C.black }}>{student.parentName || '—'}</div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ══════════ NỘI DUNG / DIỄN GIẢI ══════════ */}
                <div style={{ marginBottom: '18px', border: `1.5px solid ${C.purpleLight}`, borderRadius: '10px', overflow: 'hidden' }}>
                    {bar('NỘI DUNG / DIỄN GIẢI', 'THÀNH TIỀN')}

                    {outstandingDebt > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 22px', borderBottom: `1px solid ${C.purpleLight}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {ic(C.coral, <SvgDollar />)}
                                <div style={{ fontWeight: 700, fontSize: '14px', color: C.black }}>Nợ cũ kỳ trước</div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '15px', color: C.black }}>{formatCurrency(outstandingDebt)}</div>
                        </div>
                    )}

                    {openingCredit > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 22px', borderBottom: `1px solid ${C.purpleLight}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {ic(C.green, <SvgDollar />)}
                                <div style={{ fontWeight: 700, fontSize: '14px', color: C.black }}>Đã thanh toán / Số dư kỳ trước</div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '15px', color: C.green }}>-{formatCurrency(openingCredit)}</div>
                        </div>
                    )}

                    <div style={{ padding: '14px 22px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                                <div style={{ marginTop: '2px' }}>{ic(C.purple, <SvgDoc />)}</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '14px', color: C.black, marginBottom: '5px' }}>
                                        Học phí tháng {invoiceMonthStr}/{invoiceYear}
                                    </div>
                                    {invoice.details && (
                                        <div style={{ fontSize: '12.5px', color: C.body, lineHeight: 1.65 }}>
                                            {invoice.details.split('\n').filter(l => l.trim()).map((line, i) => (
                                                <div key={i}>- {line.trim().replace(/^-\s*/, '')}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '15px', whiteSpace: 'nowrap', marginLeft: '14px', color: C.black }}>
                                {formatCurrency(invoice.amount)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ══════════ TỔNG THANH TOÁN ══════════ */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '18px 22px', marginBottom: '18px',
                    border: `1.5px solid ${C.purpleLight}`, borderRadius: '10px',
                    background: C.purpleLight,
                }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '16px', textTransform: 'uppercase', color: C.black }}>TỔNG THANH TOÁN</div>
                        <div style={{ fontSize: '12px', color: C.body, fontStyle: 'italic', marginTop: '3px' }}>
                            (Bằng chữ: {numberToVietnameseWords(totalDue)})
                        </div>
                    </div>
                    <div style={{ fontSize: '34px', fontWeight: 900, color: C.purple }}>
                        {formatCurrency(totalDue)}
                    </div>
                </div>

                {/* ══════════ THÔNG TIN CHUYỂN KHOẢN ══════════ */}
                {totalDue > 0 && settings.bankAccountNumber && (
                    <div style={{ border: `1.5px solid ${C.purpleLight}`, borderRadius: '10px', overflow: 'hidden', marginBottom: '18px' }}>
                        {/* Header pill — centered */}
                        <div style={{ textAlign: 'center', padding: '0', borderBottom: `1.5px solid ${C.purpleLight}` }}>
                            <div style={{
                                display: 'inline-block',
                                background: `linear-gradient(135deg, ${C.purpleDark}, ${C.purple})`, color: C.white,
                                fontWeight: 700, fontSize: '12px', textTransform: 'uppercase',
                                letterSpacing: '0.08em', padding: '8px 28px',
                                borderRadius: '0 0 8px 8px',
                            }}>
                                THÔNG TIN CHUYỂN KHOẢN
                            </div>
                        </div>

                        {/* 3-column using TABLE */}
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                                <tr>
                                    {/* Bank info */}
                                    <td style={{ padding: '16px 14px 16px 22px', verticalAlign: 'middle' }}>
                                        <div style={{ fontSize: '13px', color: C.label, fontWeight: 600 }}>{settings.bankName}</div>
                                        <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: "'Courier New', monospace", letterSpacing: '0.03em', color: C.black, margin: '3px 0' }}>
                                            {settings.bankAccountNumber}
                                        </div>
                                        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: C.body }}>
                                            {settings.bankAccountHolder}
                                        </div>
                                    </td>
                                    {/* Transfer content */}
                                    <td style={{ padding: '16px 10px', verticalAlign: 'middle', textAlign: 'center' }}>
                                        <div style={{ fontSize: '10px', color: C.label, fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' }}>
                                            Nội dung chuyển khoản (bắt buộc)
                                        </div>
                                        <div style={{
                                            display: 'inline-block',
                                            fontFamily: "'Courier New', monospace", fontWeight: 800, fontSize: '14px',
                                            padding: '7px 16px',
                                            border: `2.5px dashed ${C.purple}`,
                                            borderRadius: '6px',
                                            background: C.purpleLight,
                                            color: C.purpleDark,
                                            letterSpacing: '0.06em',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            HOC PHI {student.id}
                                        </div>
                                    </td>
                                    {/* QR */}
                                    {qrCodeUrl && (
                                        <td style={{ padding: '16px 22px 16px 10px', verticalAlign: 'middle', textAlign: 'right' }}>
                                            <img src={qrCodeUrl} alt="QR" style={{ width: '125px', height: '125px', objectFit: 'contain' }} crossOrigin="anonymous" />
                                        </td>
                                    )}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ══════════ FOOTER ══════════ */}
                <div style={{
                    textAlign: 'center', padding: '12px 0 0',
                    borderTop: `1.5px solid ${C.purpleLight}`,
                    fontSize: '13px', color: C.coral, fontWeight: 600, fontStyle: 'italic',
                }}>
                    ❤️ Cảm ơn Quý phụ huynh và học viên đã tin tưởng đồng hành!
                </div>
            </div>
        </div>
    );
});