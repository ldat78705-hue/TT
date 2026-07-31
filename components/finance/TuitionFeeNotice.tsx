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

/* ═══ No SVG icons — using emoji for html2canvas compatibility ═══ */

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
        coral: '#FF4FA5',
        purple: '#6D4CFF',
        purpleDark: '#3B3F99',
        purpleLight: '#E8EAF3',
        orange: '#E8922B',
        bg: '#FFFFF0',
        white: '#FFFFFF',
        black: '#111111',
        body: '#2D2A45',
        label: '#6B6789',
        green: '#00B894',
    };

    const W = mode === 'preview' ? '100%' : '700px';
    const maxW = mode === 'preview' ? '700px' : undefined;

    // SVG data URL icon system — Lucide-style stroke icons in colored circles
    // All icons centered in 72x72 viewBox, drawn in 20-52 area (32px icon, 20px margin)
    const svgIcon = (bg: string, paths: string) => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72"><circle cx="36" cy="36" r="36" fill="${bg}"/><g fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    };

    const iconUrls = useMemo(() => ({
        // User icon — head circle + shoulders arc (Lucide "User")
        person: svgIcon(C.coral,
            `<circle cx="36" cy="28" r="8"/>
             <path d="M22 52c0-8 6.3-14 14-14s14 6 14 14"/>`
        ),
        // Open book icon (Lucide "BookOpen")
        book: svgIcon(C.purple,
            `<path d="M20 22v28c5-3 9-4 16-4s11 1 16 4V22c-5 3-9 4-16 4s-11-1-16-4z"/>
             <path d="M36 18v28"/>`
        ),
        // ID/Badge icon (Lucide "IdCard" — cleaner than graduation cap)
        cap: svgIcon(C.purple,
            `<rect x="16" y="22" width="40" height="28" rx="4"/>
             <circle cx="30" cy="34" r="4"/>
             <path d="M22 46c0-3 3.6-5 8-5s8 2 8 5"/>
             <path d="M44 32h6M44 38h4"/>`
        ),
        // Users/Family icon (Lucide "Users")
        family: svgIcon(C.coral,
            `<circle cx="30" cy="26" r="7"/>
             <path d="M18 50c0-6.6 5.4-12 12-12 3.3 0 6.3 1.3 8.5 3.5"/>
             <circle cx="48" cy="28" r="5.5"/>
             <path d="M38 50c0-5.5 4.5-10 10-10s10 4.5 10 10"/>`
        ),
        // Alert/Warning circle icon for outstanding debt
        dollar: svgIcon(C.coral,
            `<circle cx="36" cy="36" r="16"/>
             <path d="M36 28v10"/>
             <circle cx="36" cy="44" r="0.5" fill="#fff"/>`
        ),
        // File/Document icon — simple centered document with text lines
        doc: svgIcon(C.purple,
            `<rect x="22" y="17" width="28" height="38" rx="3" stroke-width="2"/>
             <path d="M29 29h14M29 35h14M29 41h8" stroke-width="2"/>`
        ),
        // Checkmark circle icon for credit/payment
        dollarGreen: svgIcon(C.green,
            `<circle cx="36" cy="36" r="16"/>
             <path d="M28 36l5 5 10-10"/>`
        ),
    }), []);

    // Icon image component — html2canvas renders <img> perfectly
    const IconImg = ({ src }: { src: string }) => (
        <img src={src} alt="" style={{ width: '36px', height: '36px', display: 'block' }} />
    );

    // Section header bar — TABLE-based for html2canvas
    const bar = (text: string, rightText?: string) => (
        <table style={{
            width: '100%', borderCollapse: 'collapse',
            background: `linear-gradient(135deg, ${C.purpleDark}, ${C.purple})`,
        }}>
            <tbody><tr>
                <td style={{
                    color: C.white, fontWeight: 700, fontSize: '13px',
                    textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                    padding: '5px 22px 13px',
                    textAlign: rightText ? 'left' : 'center',
                }}>{text}</td>
                {rightText && (
                    <td style={{
                        color: C.white, fontWeight: 700, fontSize: '13px',
                        textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                        padding: '5px 22px 13px', textAlign: 'right',
                    }}>{rightText}</td>
                )}
            </tr></tbody>
        </table>
    );

    return (
        <div ref={ref} style={{
            width: W, maxWidth: maxW, margin: '0 auto',
            fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
            backgroundColor: C.bg, color: C.body, lineHeight: 1.5,
        }}>
            <div style={{ padding: '32px 32px 24px' }}>

                {/* ══════════ HEADER — using TABLE for html2canvas safety ══════════ */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px' }}>
                    <tbody>
                        <tr>
                            {/* Left: Logo + Name */}
                            <td style={{ verticalAlign: 'top', paddingRight: '12px' }}>
                                <table style={{ borderCollapse: 'collapse' }}>
                                    <tbody><tr>
                                        {settings.logoUrl && (
                                            <td style={{ verticalAlign: 'top', paddingRight: '10px' }}>
                                                <img src={settings.logoUrl} alt="" style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'contain' }} crossOrigin="anonymous" />
                                            </td>
                                        )}
                                        <td style={{ verticalAlign: 'top' }}>
                                            <div style={{ fontSize: '17px', fontWeight: 800, color: C.purpleDark, textTransform: 'uppercase', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                                {settings.name}
                                            </div>
                                            {settings.address && (
                                                <div style={{ fontSize: '11px', color: C.green, marginTop: '3px', textAlign: 'center' }}>
                                                    {settings.address}
                                                </div>
                                            )}
                                            {settings.phone && (
                                                <div style={{ fontSize: '11px', color: C.green, marginTop: '1px', textAlign: 'center' }}>
                                                    Hotline: <strong>{settings.phone}</strong>
                                                </div>
                                            )}
                                        </td>
                                    </tr></tbody>
                                </table>
                            </td>
                            {/* Right: Title + Month */}
                            <td style={{ verticalAlign: 'top', textAlign: 'center' }}>
                                <div style={{ fontSize: '24px', fontWeight: 900, color: C.purpleDark, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                    PHIẾU THU HỌC PHÍ
                                </div>
                                <div style={{
                                    marginTop: '8px',
                                    fontSize: '14px', fontWeight: 800,
                                    textAlign: 'center',
                                    color: '#E53935',
                                }}>
                                    Tháng {String(parseInt(invoiceMonthStr)).padStart(2, '0')} năm {invoiceYear}
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* ══════════ META ROW ══════════ */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '18px', borderBottom: `1.5px solid ${C.purpleLight}` }}>
                    <tbody>
                        <tr>
                            <td style={{ textAlign: 'center', padding: '10px 0', fontSize: '12px', color: C.label, verticalAlign: 'middle' }}>
                                Mã HĐ: <strong style={{ color: C.black, fontFamily: 'monospace' }}>#{invoice.id.slice(-5)}</strong>
                                <span style={{ margin: '0 16px', color: C.purpleLight }}>|</span>
                                Ngày lập: <strong style={{ color: C.black }}>{new Date(invoice.generatedDate).toLocaleDateString('vi-VN')}</strong>
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
                                        <table style={{ borderCollapse: 'collapse' }}>
                                            <tbody><tr>
                                <td style={{ verticalAlign: 'middle', paddingRight: '10px' }}><IconImg src={iconUrls.person} /></td>
                                                <td style={{ verticalAlign: 'middle' }}>
                                                    <div style={{ fontSize: '10px', color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Họ và tên</div>
                                                    <div style={{ fontSize: '16px', fontWeight: 700, color: C.black }}>{student.name}</div>
                                                </td>
                                            </tr></tbody>
                                        </table>
                                    </td>
                                    <td style={{ padding: '8px 0 8px 16px', width: '50%', verticalAlign: 'middle' }}>
                                        <table style={{ borderCollapse: 'collapse' }}>
                                            <tbody><tr>
                                                <td style={{ verticalAlign: 'middle', paddingRight: '10px' }}><IconImg src={iconUrls.book} /></td>
                                                <td style={{ verticalAlign: 'middle' }}>
                                                    <div style={{ fontSize: '10px', color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Lớp đang học</div>
                                                    <div style={{ fontSize: '15px', fontWeight: 700, color: C.black }}>{enrolledClasses.map(c => c.name).join(', ') || '—'}</div>
                                                </td>
                                            </tr></tbody>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '8px 16px 8px 0', borderRight: `1.5px solid ${C.purpleLight}`, verticalAlign: 'middle' }}>
                                        <table style={{ borderCollapse: 'collapse' }}>
                                            <tbody><tr>
                                                <td style={{ verticalAlign: 'middle', paddingRight: '10px' }}><IconImg src={iconUrls.cap} /></td>
                                                <td style={{ verticalAlign: 'middle' }}>
                                                    <div style={{ fontSize: '10px', color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Mã học viên</div>
                                                    <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'monospace', color: C.black }}>{student.id}</div>
                                                </td>
                                            </tr></tbody>
                                        </table>
                                    </td>
                                    <td style={{ padding: '8px 0 8px 16px', verticalAlign: 'middle' }}>
                                        <table style={{ borderCollapse: 'collapse' }}>
                                            <tbody><tr>
                                                <td style={{ verticalAlign: 'middle', paddingRight: '10px' }}><IconImg src={iconUrls.family} /></td>
                                                <td style={{ verticalAlign: 'middle' }}>
                                                    <div style={{ fontSize: '10px', color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Phụ huynh</div>
                                                    <div style={{ fontSize: '15px', fontWeight: 700, color: C.black }}>{student.parentName || '—'}</div>
                                                </td>
                                            </tr></tbody>
                                        </table>
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
                        <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: `1px solid ${C.purpleLight}` }}>
                            <tbody><tr>
                                <td style={{ padding: '14px 22px', verticalAlign: 'middle', fontWeight: 700, fontSize: '14px', color: C.black }}>Nợ cũ kỳ trước</td>
                                <td style={{ padding: '14px 22px 14px 10px', verticalAlign: 'middle', textAlign: 'right', fontWeight: 700, fontSize: '15px', color: C.black, whiteSpace: 'nowrap' }}>{formatCurrency(outstandingDebt)}</td>
                            </tr></tbody>
                        </table>
                    )}

                    {openingCredit > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: `1px solid ${C.purpleLight}` }}>
                            <tbody><tr>
                                <td style={{ padding: '14px 22px', verticalAlign: 'middle', fontWeight: 700, fontSize: '14px', color: C.black }}>Đã thanh toán / Số dư kỳ trước</td>
                                <td style={{ padding: '14px 22px 14px 10px', verticalAlign: 'middle', textAlign: 'right', fontWeight: 700, fontSize: '15px', color: C.green, whiteSpace: 'nowrap' }}>-{formatCurrency(openingCredit)}</td>
                            </tr></tbody>
                        </table>
                    )}

                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody><tr>
                            <td style={{ padding: '14px 22px', verticalAlign: 'top' }}>
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
                            </td>
                            <td style={{ padding: '14px 22px 14px 10px', verticalAlign: 'top', textAlign: 'right', fontWeight: 700, fontSize: '15px', whiteSpace: 'nowrap', color: C.black, paddingTop: '16px' }}>
                                {formatCurrency(invoice.amount)}
                            </td>
                        </tr></tbody>
                    </table>
                </div>

                {/* ══════════ TỔNG THANH TOÁN ══════════ */}
                <table style={{
                    width: '100%', borderCollapse: 'collapse', marginBottom: '18px',
                    border: `1.5px solid ${C.purpleLight}`, borderRadius: '10px',
                    background: C.purpleLight,
                }}>
                    <tbody><tr>
                        <td style={{ padding: '18px 22px', verticalAlign: 'middle' }}>
                            <div style={{ fontWeight: 800, fontSize: '16px', textTransform: 'uppercase', color: C.black }}>TỔNG THANH TOÁN</div>
                            <div style={{ fontSize: '12px', color: C.body, fontStyle: 'italic', marginTop: '3px' }}>
                                (Bằng chữ: {numberToVietnameseWords(totalDue)})
                            </div>
                        </td>
                        <td style={{ padding: '6px 22px 28px', verticalAlign: 'middle', textAlign: 'right', fontSize: '34px', fontWeight: 900, color: C.purple, whiteSpace: 'nowrap', lineHeight: 1 }}>
                            {formatCurrency(totalDue)}
                        </td>
                    </tr></tbody>
                </table>

                {/* ══════════ THÔNG TIN CHUYỂN KHOẢN ══════════ */}
                {totalDue > 0 && settings.bankAccountNumber && (
                    <div style={{ border: `1.5px solid ${C.purpleLight}`, borderRadius: '10px', overflow: 'hidden', marginBottom: '18px' }}>
                        {/* Header pill — centered */}
                        <div style={{ textAlign: 'center', padding: '0', borderBottom: `1.5px solid ${C.purpleLight}` }}>
                            <div style={{
                                display: 'inline-block',
                                background: `linear-gradient(135deg, ${C.purpleDark}, ${C.purple})`, color: C.white,
                                fontWeight: 700, fontSize: '12px', textTransform: 'uppercase',
                                letterSpacing: '0.08em', padding: '4px 28px 12px',
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
                                    {/* Transfer content — FULL WIDTH block, text centered */}
                                    <td style={{ padding: '16px 10px', verticalAlign: 'middle' }}>
                                        <div style={{ fontSize: '10px', color: C.label, fontWeight: 600, textTransform: 'uppercase', textAlign: 'center', marginBottom: '6px' }}>
                                            Nội dung chuyển khoản (bắt buộc)
                                        </div>
                                        <div style={{
                                            width: '100%',
                                            fontFamily: "'Courier New', monospace", fontWeight: 800, fontSize: '15px',
                                            padding: '7px 0',
                                            color: '#E53935',
                                            letterSpacing: '0.06em',
                                            textAlign: 'center',
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
                    ❤ Cảm ơn Quý phụ huynh và học viên đã tin tưởng đồng hành!
                </div>
            </div>
        </div>
    );
});