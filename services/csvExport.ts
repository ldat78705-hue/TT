/**
 * Converts an array of objects to a CSV string.
 * @param data - The array of objects to convert.
 * @param columns - An object mapping object keys to CSV header names.
 * @returns The CSV string.
 */
function convertToCSV<T extends object>(data: T[], columns: Record<keyof T, string>): string {
    if (!data || data.length === 0) {
        return '';
    }

    const headers = Object.values(columns);
    const keys = Object.keys(columns) as (keyof T)[];

    const csvRows = [headers.join(',')];

    for (const row of data) {
        const values = keys.map(key => {
            const escaped = ('' + row[key]).replace(/"/g, '\\"');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
}

/**
 * Triggers a browser download for a CSV file.
 * @param csvString - The CSV content.
 * @param filename - The name of the file to download.
 */
function exportToCSV(csvString: string, filename: string): void {
    // Thêm BOM (\uFEFF) để Excel trên máy chủ Windows có thể hiển thị chính xác định dạng tiếng Việt
    const blob = new Blob(['\uFEFF', csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}


/**
 * A helper function that combines conversion and download.
 * @param data The data to export.
 * @param columns The column mapping.
 * @param filename The desired filename for the download.
 */
export function downloadAsCSV<T extends object>(data: T[], columns: Record<keyof T, string>, filename: string): void {
    const csv = convertToCSV(data, columns);
    exportToCSV(csv, filename);
}
