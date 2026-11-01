import { useState, useRef, useEffect } from 'react';
import { ICONS } from '../../constants';
import { downloadAsCSV } from '../../services/csvExport';

interface ExportButtonProps<T extends object> {
    data: T[];
    columns: Record<keyof T, string>;
    filenameBase: string;
    label?: string;
    variant?: 'primary' | 'secondary';
}

export function ExportButton<T extends object>({ data, columns, filenameBase, label = 'Xuất', variant = 'secondary' }: ExportButtonProps<T>) {
    const [isOpen, setIsOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCSV = () => {
        downloadAsCSV(data, columns, `${filenameBase}.csv`);
        setIsOpen(false);
    };

    const handleExcel = async () => {
        setIsExporting(true);
        try {
            const { downloadAsExcel } = await import('../../services/excelExport');
            await downloadAsExcel(data, columns, `${filenameBase}.xlsx`);
        } catch (err) {
            console.error('Excel export error:', err);
            // Fallback to CSV
            downloadAsCSV(data, columns, `${filenameBase}.csv`);
        } finally {
            setIsExporting(false);
            setIsOpen(false);
        }
    };

    const btnClass = variant === 'primary'
        ? 'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors'
        : 'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition-colors';

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={btnClass}
                disabled={isExporting || data.length === 0}
            >
                {isExporting ? (
                    <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                ) : (
                    ICONS.export
                )}
                {label}
                <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 z-20 py-1">
                    <button
                        onClick={handleCSV}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
                    >
                        <span className="text-green-600">📄</span>
                        Xuất CSV
                        <span className="text-xs text-gray-400 ml-auto">.csv</span>
                    </button>
                    <button
                        onClick={handleExcel}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
                    >
                        <span className="text-emerald-600">📊</span>
                        Xuất Excel
                        <span className="text-xs text-gray-400 ml-auto">.xlsx</span>
                    </button>
                </div>
            )}
        </div>
    );
}
