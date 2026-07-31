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

    // Generate icon as base64 PNG using OffscreenCanvas / Canvas
    // html2canvas renders <img> tags perfectly — no baseline/flex issues
    const makeIconUrl = (bg: string, drawFn: (ctx: CanvasRenderingContext2D) => void): string => {
        const size = 72; // 2x for retina
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        // Circle background
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();
        // White icon
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        drawFn(ctx);
        return canvas.toDataURL('image/png');
    };

    // Pre-generate all icon URLs
    const iconUrls = useMemo(() => ({
        person: makeIconUrl(C.coral, (ctx) => {
            // Head
            ctx.beginPath(); ctx.arc(36, 24, 8, 0, Math.PI * 2); ctx.fill();
            // Body
            ctx.beginPath(); ctx.arc(36, 58, 18, Math.PI, 0); ctx.fill();
        }),
        book: makeIconUrl(C.purple, (ctx) => {
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = '#fff';
            // Book outline
            ctx.beginPath();
            ctx.moveTo(20, 16); ctx.lineTo(20, 56); ctx.lineTo(52, 56); ctx.lineTo(52, 16); ctx.lineTo(26, 16);
            ctx.stroke();
            // Spine
            ctx.beginPath(); ctx.moveTo(20, 48); ctx.lineTo(52, 48); ctx.stroke();
            // Lines
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(28, 26); ctx.lineTo(44, 26); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(28, 34); ctx.lineTo(40, 34); ctx.stroke();
        }),
        cap: makeIconUrl(C.coral, (ctx) => {
            ctx.fillStyle = '#fff';
            // Cap top
            ctx.beginPath(); ctx.moveTo(36, 16); ctx.lineTo(14, 30); ctx.lineTo(36, 44); ctx.lineTo(58, 30); ctx.closePath(); ctx.fill();
            // Cap bottom
            ctx.lineWidth = 3; ctx.strokeStyle = '#fff';
            ctx.beginPath(); ctx.moveTo(22, 34); ctx.lineTo(22, 46); ctx.quadraticCurveTo(36, 54, 50, 46); ctx.lineTo(50, 34); ctx.stroke();
            // Tassel
            ctx.beginPath(); ctx.moveTo(56, 30); ctx.lineTo(56, 44); ctx.stroke();
        }),
        family: makeIconUrl(C.coral, (ctx) => {
            // Adult 1
            ctx.beginPath(); ctx.arc(28, 22, 7, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(28, 50, 14, Math.PI, 0); ctx.fill();
            // Adult 2 (smaller)
            ctx.beginPath(); ctx.arc(48, 24, 6, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(48, 48, 10, Math.PI, 0); ctx.fill();
        }),
        dollar: makeIconUrl(C.coral, (ctx) => {
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
            // Circle
            ctx.beginPath(); ctx.arc(36, 36, 18, 0, Math.PI * 2); ctx.stroke();
            // $ sign
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(36, 22); ctx.lineTo(36, 50); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(43, 29); ctx.quadraticCurveTo(43, 25, 36, 25);
            ctx.quadraticCurveTo(29, 25, 29, 30); ctx.quadraticCurveTo(29, 35, 36, 36);
            ctx.quadraticCurveTo(43, 37, 43, 42); ctx.quadraticCurveTo(43, 47, 36, 47);
            ctx.quadraticCurveTo(29, 47, 29, 43);
            ctx.stroke();
        }),
        doc: makeIconUrl(C.purple, (ctx) => {
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
            // Document
            ctx.beginPath();
            ctx.moveTo(22, 12); ctx.lineTo(50, 12); ctx.lineTo(54, 16); ctx.lineTo(54, 56);
            ctx.lineTo(18, 56); ctx.lineTo(18, 16); ctx.closePath();
            ctx.stroke();
            // Lines
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(26, 26); ctx.lineTo(46, 26); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(26, 34); ctx.lineTo(46, 34); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(26, 42); ctx.lineTo(38, 42); ctx.stroke();
        }),
        dollarGreen: makeIconUrl(C.green, (ctx) => {
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(36, 36, 18, 0, Math.PI * 2); ctx.stroke();
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(36, 22); ctx.lineTo(36, 50); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(43, 29); ctx.quadraticCurveTo(43, 25, 36, 25);
            ctx.quadraticCurveTo(29, 25, 29, 30); ctx.quadraticCurveTo(29, 35, 36, 36);
            ctx.quadraticCurveTo(43, 37, 43, 42); ctx.quadraticCurveTo(43, 47, 36, 47);
            ctx.quadraticCurveTo(29, 47, 29, 43);
            ctx.stroke();
        }),
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
                    padding: '9px 22px',
                }}>{text}</td>
                {rightText && (
                    <td style={{
                        color: C.white, fontWeight: 700, fontSize: '13px',
                        textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                        padding: '9px 22px', textAlign: 'right',
                    }}>{rightText}</td>
                )}
            </tr></tbody>
        </table>
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
                                                <div style={{ fontSize: '11px', color: C.label, marginTop: '3px' }}>
                                                    {settings.address}
                                                </div>
                                            )}
                                            {settings.phone && (
                                                <div style={{ fontSize: '11px', color: C.label, marginTop: '1px' }}>
                                                    Hotline: <strong style={{ color: C.black }}>{settings.phone}</strong>
                                                </div>
                                            )}
                                        </td>
                                    </tr></tbody>
                                </table>
                            </td>
                            {/* Right: Title + Month */}
                            <td style={{ verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <div style={{ fontSize: '24px', fontWeight: 900, color: C.purpleDark, textTransform: 'uppercase' }}>
                                    PHIẾU THU HỌC PHÍ
                                </div>
                                {/* Month badge — red text, aligned right under title */}
                                <div style={{
                                    marginTop: '8px',
                                    fontSize: '14px', fontWeight: 800,
                                    textAlign: 'right',
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
                                <td style={{ padding: '14px 10px 14px 22px', verticalAlign: 'middle', width: '46px' }}><IconImg src={iconUrls.dollar} /></td>
                                <td style={{ padding: '14px 10px', verticalAlign: 'middle', fontWeight: 700, fontSize: '14px', color: C.black }}>Nợ cũ kỳ trước</td>
                                <td style={{ padding: '14px 22px 14px 10px', verticalAlign: 'middle', textAlign: 'right', fontWeight: 700, fontSize: '15px', color: C.black, whiteSpace: 'nowrap' }}>{formatCurrency(outstandingDebt)}</td>
                            </tr></tbody>
                        </table>
                    )}

                    {openingCredit > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: `1px solid ${C.purpleLight}` }}>
                            <tbody><tr>
                                <td style={{ padding: '14px 10px 14px 22px', verticalAlign: 'middle', width: '46px' }}><IconImg src={iconUrls.dollarGreen} /></td>
                                <td style={{ padding: '14px 10px', verticalAlign: 'middle', fontWeight: 700, fontSize: '14px', color: C.black }}>Đã thanh toán / Số dư kỳ trước</td>
                                <td style={{ padding: '14px 22px 14px 10px', verticalAlign: 'middle', textAlign: 'right', fontWeight: 700, fontSize: '15px', color: C.green, whiteSpace: 'nowrap' }}>-{formatCurrency(openingCredit)}</td>
                            </tr></tbody>
                        </table>
                    )}

                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody><tr>
                            <td style={{ padding: '14px 10px 14px 22px', verticalAlign: 'top', width: '46px', paddingTop: '16px' }}><IconImg src={iconUrls.doc} /></td>
                            <td style={{ padding: '14px 10px', verticalAlign: 'top' }}>
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
                        <td style={{ padding: '18px 22px', verticalAlign: 'middle', textAlign: 'right', fontSize: '34px', fontWeight: 900, color: C.purple, whiteSpace: 'nowrap' }}>
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