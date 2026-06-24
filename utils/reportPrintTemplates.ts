import { escapeHtml } from './html';

interface PrintColumn {
    header: string;
    align?: 'left' | 'center' | 'right';
    width?: string;
}

interface PrintOptions {
    title: string;
    subtitle?: string;
    centerName: string;
    columns: PrintColumn[];
    rows: string[][]; // Each row is array of cell HTML strings (can contain inline HTML for coloring)
    footer?: string;
    dateRange?: { from: string; to: string };
    summary?: { label: string; value: string }[];
    orientation?: 'portrait' | 'landscape';
}

/**
 * Build a professional, print-ready HTML report.
 * Outputs a complete HTML document that can be passed to printHtml().
 */
export function buildPrintableReport(opts: PrintOptions): string {
    const {
        title,
        subtitle,
        centerName,
        columns,
        rows,
        footer,
        dateRange,
        summary,
        orientation = 'portrait',
    } = opts;

    const headerCells = columns.map(col =>
        `<th style="border:1px solid #d1d5db;padding:8px 10px;text-align:${col.align || 'left'};background:#f3f4f6;font-weight:600;font-size:12px;white-space:nowrap;${col.width ? `width:${col.width}` : ''}">${escapeHtml(col.header)}</th>`
    ).join('');

    const bodyRows = rows.map((row, idx) => {
        const bgColor = idx % 2 === 0 ? '#fff' : '#fafafa';
        const cells = row.map((cell, ci) =>
            `<td style="border:1px solid #e5e7eb;padding:6px 10px;font-size:12px;text-align:${columns[ci]?.align || 'left'}">${cell}</td>`
        ).join('');
        return `<tr style="background:${bgColor}">${cells}</tr>`;
    }).join('\n');

    const dateRangeHtml = dateRange
        ? `<div style="font-size:12px;color:#6b7280;margin-bottom:8px">Khoảng thời gian: <b>${escapeHtml(dateRange.from)}</b> đến <b>${escapeHtml(dateRange.to)}</b></div>`
        : '';

    const subtitleHtml = subtitle
        ? `<div style="text-align:center;font-size:13px;color:#6b7280;margin-bottom:12px">${escapeHtml(subtitle)}</div>`
        : '';

    const summaryHtml = summary && summary.length > 0
        ? `<div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:12px;padding:10px;background:#f0f9ff;border-radius:6px;border:1px solid #bae6fd">
            ${summary.map(s => `<div style="font-size:12px"><span style="color:#6b7280">${escapeHtml(s.label)}:</span> <b style="color:#1e40af">${s.value}</b></div>`).join('')}
           </div>`
        : '';

    const footerHtml = footer
        ? `<div style="margin-top:12px;font-size:11px;color:#9ca3af;text-align:right">${escapeHtml(footer)}</div>`
        : '';

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)} - ${escapeHtml(centerName)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 12mm 15mm; color: #111; }
        @page { size: A4 ${orientation}; margin: 12mm 15mm; }
        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        table { border-collapse: collapse; width: 100%; }
    </style>
</head>
<body>
    <div style="text-align:center;margin-bottom:4px">
        <h2 style="font-size:18px;color:#1e293b;margin:0">${escapeHtml(centerName)}</h2>
    </div>
    <div style="text-align:center;margin-bottom:16px">
        <h3 style="font-size:15px;color:#334155;margin:0;text-transform:uppercase;letter-spacing:0.05em">${escapeHtml(title)}</h3>
    </div>
    ${subtitleHtml}
    ${dateRangeHtml}
    ${summaryHtml}
    <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
    </table>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:11px;color:#9ca3af">
        <span>Tổng: ${rows.length} dòng</span>
        <span>Ngày in: ${new Date().toLocaleDateString('vi-VN')}</span>
    </div>
    ${footerHtml}
</body>
</html>`;
}
