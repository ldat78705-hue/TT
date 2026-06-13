/**
 * Excel Export Service using ExcelJS (already in dependencies).
 * Provides downloadAsExcel function matching the same API as downloadAsCSV.
 */
import ExcelJS from 'exceljs';

export async function downloadAsExcel<T extends object>(
    data: T[], 
    columns: Record<keyof T, string>, 
    filename: string
): Promise<void> {
    if (!data || data.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'EduCenter Pro';
    workbook.created = new Date();

    const sheetName = filename.replace(/\.xlsx$/i, '').substring(0, 31); // Excel sheet name max 31 chars
    const worksheet = workbook.addWorksheet(sheetName);

    const keys = Object.keys(columns) as (keyof T)[];
    const headers = Object.values(columns) as string[];

    // Add header row with styling
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' } // Indigo-600
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 28;

    // Add data rows
    data.forEach((row, index) => {
        const values = keys.map(key => {
            const val = row[key];
            if (val === null || val === undefined) return '';
            return val;
        });
        const dataRow = worksheet.addRow(values);
        
        // Alternate row colors
        if (index % 2 === 1) {
            dataRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF8FAFC' } // Slate-50
            };
        }
    });

    // Auto-fit column widths
    worksheet.columns.forEach((column, i) => {
        let maxLength = headers[i]?.length || 10;
        data.forEach(row => {
            const val = String(row[keys[i]] ?? '');
            if (val.length > maxLength) maxLength = val.length;
        });
        column.width = Math.min(Math.max(maxLength + 2, 10), 50);
    });

    // Add borders to all cells
    worksheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
        });
    });

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename.endsWith('.xlsx') ? filename : filename.replace(/\.csv$/i, '.xlsx'));
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
