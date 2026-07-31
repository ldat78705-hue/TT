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
 * ╔══════════════════════════════════════════════════════════╗
 * ║  DESIGN: Stripe Invoice × Notion × Linear               ║
 * ║  Typography-first, whitespace-driven, max 3 colors       ║
 * ║  html2canvas-safe: TABLE layout, no inline-flex, no SVG  ║
 * ║  in text badges, all text in block-level divs             ║
 * ╚══════════════════════════════════════════════════════════╝
 */

/* ═══ DESIGN TOKENS ═══ */
const T = {
    indigo: '#3B3F99',
    purple: '#6D4CFF',
    pink: '#FF4FA5',
    border: '#E8EAF3',
    bg: '#FFFFFF',
    bgSoft: '#F8F9FC',
    text: '#1A1A2E',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    success: '#00B894',
    font: "'Inter', 'Be Vietnam Pro', 'SF Pro Display', -apple-system, 'Segoe UI', sans-serif",
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
    const monthLabel = `Tháng ${String(parseInt(invoiceMonthStr)).padStart(2, '0')} / ${invoiceYear}`;

    /* ── Shared Styles ── */
    const label: React.CSSProperties = {
        fontSize: '10px', fontWeight: 600, color: T.textMuted,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: '4px',
    };
    const value: React.CSSProperties = {
        fontSize: '14px', fontWeight: 600, color: T.text,
    };
    const divider: React.CSSProperties = {
        height: '1px', background: T.border, margin: '0',
    };

    return (
        <div ref={ref} style={{
            width: mode === 'preview' ? '100%' : '680px',
            maxWidth: mode === 'preview' ? '680px' : undefined,
            margin: '0 auto',
            fontFamily: T.font,
            backgroundColor: T.bg,
            color: T.text,
            lineHeight: 1.6,
        }}>
            <div style={{ padding: '40px 36px 32px' }}>

                {/* ══════════════════════════════════════════════
                    HEADER — Stripe-style: clean, logo left, title right
                   ══════════════════════════════════════════════ */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                        <tr>
                            <td style={{ verticalAlign: 'top' }}>
                                {/* Brand */}
                                <div style={{ fontSize: '16px', fontWeight: 700, color: T.indigo, letterSpacing: '-0.01em' }}>
                                    {settings.name}
                                </div>
                                {settings.address && (
                                    <div style={{ fontSize: '12px', color: T.textSecondary, marginTop: '4px' }}>
                                        {settings.address}
                                    </div>
                                )}
                                {settings.phone && (
                                    <div style={{ fontSize: '12px', color: T.textSecondary, marginTop: '2px' }}>
                                        {settings.phone}
                                    </div>
                                )}
                            </td>
                            <td style={{ verticalAlign: 'top', textAlign: 'right' }}>
                                {/* Title */}
                                <div style={{
                                    fontSize: '22px', fontWeight: 800, color: T.indigo,
                                    letterSpacing: '-0.02em',
                                }}>
                                    PHIẾU THU HỌC PHÍ
                                </div>
                                {/* Month badge — SIMPLE inline-block div, centered text */}
                                <div style={{
                                    display: 'inline-block',
                                    marginTop: '8px',
                                    padding: '5px 20px',
                                    background: T.indigo,
                                    color: T.bg,
                                    borderRadius: '20px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    letterSpacing: '0.04em',
                                    textAlign: 'center',
                                }}>
                                    {monthLabel}
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* Meta — invoice ID + date */}
                <div style={{ ...divider, margin: '20px 0 16px' }}></div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                        <tr>
                            <td style={{ fontSize: '12px', color: T.textSecondary }}>
                                Mã HĐ: <strong style={{ color: T.text, fontFamily: 'monospace' }}>#{invoice.id.slice(-5)}</strong>
                            </td>
                            <td style={{ fontSize: '12px', color: T.textSecondary, textAlign: 'right' }}>
                                Ngày lập: <strong style={{ color: T.text }}>{new Date(invoice.generatedDate).toLocaleDateString('vi-VN')}</strong>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* ══════════════════════════════════════════════
                    STUDENT INFO — Notion-style card
                   ══════════════════════════════════════════════ */}
                <div style={{
                    marginTop: '24px',
                    padding: '20px 24px',
                    background: T.bgSoft,
                    borderRadius: '10px',
                    border: `1px solid ${T.border}`,
                }}>
                    <div style={{
                        fontSize: '11px', fontWeight: 700, color: T.indigo,
                        textTransform: 'uppercase', letterSpacing: '0.1em',
                        marginBottom: '16px',
                    }}>
                        Thông tin học viên
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                            <tr>
                                <td style={{ width: '50%', paddingBottom: '14px', verticalAlign: 'top' }}>
                                    <div style={label}>Họ và tên</div>
                                    <div style={{ ...value, fontSize: '16px', fontWeight: 700 }}>{student.name}</div>
                                </td>
                                <td style={{ width: '50%', paddingBottom: '14px', verticalAlign: 'top' }}>
                                    <div style={label}>Lớp đang học</div>
                                    <div style={value}>{enrolledClasses.map(c => c.name).join(', ') || '—'}</div>
                                </td>
                            </tr>
                            <tr>
                                <td style={{ verticalAlign: 'top' }}>
                                    <div style={label}>Mã học viên</div>
                                    <div style={{ ...value, fontFamily: 'monospace' }}>{student.id}</div>
                                </td>
                                <td style={{ verticalAlign: 'top' }}>
                                    <div style={label}>Phụ huynh</div>
                                    <div style={value}>{student.parentName || '—'}</div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* ══════════════════════════════════════════════
                    LINE ITEMS — Stripe Invoice style
                   ══════════════════════════════════════════════ */}
                <div style={{ marginTop: '28px' }}>
                    {/* Table Header */}
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: `2px solid ${T.indigo}` }}>
                                <th style={{
                                    textAlign: 'left', padding: '10px 0',
                                    fontSize: '10px', fontWeight: 700, color: T.indigo,
                                    textTransform: 'uppercase', letterSpacing: '0.1em',
                                }}>
                                    Nội dung
                                </th>
                                <th style={{
                                    textAlign: 'right', padding: '10px 0',
                                    fontSize: '10px', fontWeight: 700, color: T.indigo,
                                    textTransform: 'uppercase', letterSpacing: '0.1em',
                                }}>
                                    Thành tiền
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {outstandingDebt > 0 && (
                                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                                    <td style={{ padding: '14px 0', fontSize: '14px', color: T.text }}>
                                        Nợ cũ kỳ trước
                                    </td>
                                    <td style={{ padding: '14px 0', fontSize: '14px', fontWeight: 600, color: T.text, textAlign: 'right' }}>
                                        {formatCurrency(outstandingDebt)}
                                    </td>
                                </tr>
                            )}
                            {openingCredit > 0 && (
                                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                                    <td style={{ padding: '14px 0', fontSize: '14px', color: T.text }}>
                                        Số dư kỳ trước
                                    </td>
                                    <td style={{ padding: '14px 0', fontSize: '14px', fontWeight: 600, color: T.success, textAlign: 'right' }}>
                                        -{formatCurrency(openingCredit)}
                                    </td>
                                </tr>
                            )}
                            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                                <td style={{ padding: '14px 0', verticalAlign: 'top' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: T.text }}>
                                        Học phí tháng {invoiceMonthStr}/{invoiceYear}
                                    </div>
                                    {invoice.details && (
                                        <div style={{ fontSize: '12px', color: T.textSecondary, marginTop: '6px', lineHeight: 1.7 }}>
                                            {invoice.details.split('\n').filter(l => l.trim()).map((line, i) => (
                                                <div key={i}>· {line.trim().replace(/^-\s*/, '')}</div>
                                            ))}
                                        </div>
                                    )}
                                </td>
                                <td style={{ padding: '14px 0', fontSize: '14px', fontWeight: 600, color: T.text, textAlign: 'right', verticalAlign: 'top' }}>
                                    {formatCurrency(invoice.amount)}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* TOTAL — prominent */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0' }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '20px 0', verticalAlign: 'bottom' }}>
                                    <div style={{ fontSize: '16px', fontWeight: 800, color: T.text, textTransform: 'uppercase' }}>
                                        Tổng thanh toán
                                    </div>
                                    <div style={{ fontSize: '11px', color: T.textSecondary, fontStyle: 'italic', marginTop: '2px' }}>
                                        ({numberToVietnameseWords(totalDue)})
                                    </div>
                                </td>
                                <td style={{ padding: '20px 0', textAlign: 'right', verticalAlign: 'bottom' }}>
                                    <div style={{
                                        fontSize: '32px', fontWeight: 800, color: T.indigo,
                                        letterSpacing: '-0.02em',
                                    }}>
                                        {formatCurrency(totalDue)}
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* ══════════════════════════════════════════════
                    PAYMENT — Bank transfer info
                   ══════════════════════════════════════════════ */}
                {totalDue > 0 && settings.bankAccountNumber && (
                    <div style={{
                        marginTop: '8px',
                        padding: '24px',
                        background: T.bgSoft,
                        borderRadius: '10px',
                        border: `1px solid ${T.border}`,
                    }}>
                        <div style={{
                            fontSize: '11px', fontWeight: 700, color: T.indigo,
                            textTransform: 'uppercase', letterSpacing: '0.1em',
                            marginBottom: '18px',
                            textAlign: 'center',
                        }}>
                            Thông tin chuyển khoản
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                                <tr>
                                    {/* Bank details */}
                                    <td style={{ verticalAlign: 'top', paddingRight: '16px' }}>
                                        <div style={label}>Ngân hàng</div>
                                        <div style={{ ...value, marginBottom: '12px' }}>{settings.bankName}</div>
                                        <div style={label}>Số tài khoản</div>
                                        <div style={{
                                            fontSize: '20px', fontWeight: 800, color: T.text,
                                            fontFamily: "'Courier New', monospace",
                                            letterSpacing: '0.05em', marginBottom: '12px',
                                        }}>
                                            {settings.bankAccountNumber}
                                        </div>
                                        <div style={label}>Chủ tài khoản</div>
                                        <div style={{ ...value, textTransform: 'uppercase' }}>{settings.bankAccountHolder}</div>
                                    </td>

                                    {/* Transfer content — centered */}
                                    <td style={{ verticalAlign: 'middle', textAlign: 'center', padding: '0 12px' }}>
                                        <div style={{
                                            ...label,
                                            textAlign: 'center',
                                            marginBottom: '8px',
                                        }}>
                                            Nội dung CK (bắt buộc)
                                        </div>
                                        <div style={{
                                            display: 'inline-block',
                                            padding: '10px 24px',
                                            border: `2px dashed ${T.indigo}`,
                                            borderRadius: '8px',
                                            background: T.bg,
                                            fontFamily: "'Courier New', monospace",
                                            fontSize: '15px',
                                            fontWeight: 800,
                                            color: T.indigo,
                                            letterSpacing: '0.08em',
                                            textAlign: 'center',
                                        }}>
                                            HOC PHI {student.id}
                                        </div>
                                    </td>

                                    {/* QR */}
                                    {qrCodeUrl && (
                                        <td style={{ verticalAlign: 'middle', textAlign: 'right', paddingLeft: '12px' }}>
                                            <img
                                                src={qrCodeUrl} alt="QR"
                                                style={{ width: '120px', height: '120px', objectFit: 'contain', borderRadius: '8px' }}
                                                crossOrigin="anonymous"
                                            />
                                        </td>
                                    )}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ══════════════════════════════════════════════
                    FOOTER
                   ══════════════════════════════════════════════ */}
                <div style={{ ...divider, margin: '24px 0 16px' }}></div>
                <div style={{
                    textAlign: 'center',
                    fontSize: '12px',
                    color: T.textMuted,
                    fontStyle: 'italic',
                }}>
                    Cảm ơn Quý phụ huynh và học viên đã tin tưởng đồng hành!
                </div>
            </div>
        </div>
    );
});