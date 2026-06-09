import React, { useMemo, useState, useEffect } from 'react';
import { useData } from '../../hooks/useDataContext';
import { AttendanceStatus } from '../../types';
import { ICONS } from '../../constants';
import { formatVietnamDate } from '../../utils/date';

interface AbsentStudentsModalProps {
    isOpen: boolean;
    onClose: () => void;
    date: string;
}

export const AbsentStudentsModal: React.FC<AbsentStudentsModalProps> = ({ isOpen, onClose, date }) => {
    const { state } = useData();
    const [startDate, setStartDate] = useState(date);
    const [endDate, setEndDate] = useState(date);
    const [classFilter, setClassFilter] = useState('all');

    useEffect(() => {
        if (isOpen) {
            setStartDate(date);
            setEndDate(date);
            setClassFilter('all');
        }
    }, [isOpen, date]);

    const absentRecords = useMemo(() => {
        const records: { studentName: string; className: string; note: string; phone: string; date: string; status: AttendanceStatus }[] = [];
        
        state.attendance.forEach(record => {
            const isAfterStart = !startDate || record.date >= startDate;
            const isBeforeEnd = !endDate || record.date <= endDate;
            
            if (isAfterStart && isBeforeEnd && (record.status === AttendanceStatus.ABSENT || record.status === AttendanceStatus.UNEXCUSED_ABSENT)) {
                if (classFilter !== 'all' && record.classId !== classFilter) return;

                const student = state.students.find(s => s.id === record.studentId);
                const cls = state.classes.find(c => c.id === record.classId);
                
                if (student && cls) {
                    records.push({
                        studentName: student.name,
                        className: cls.name,
                        note: record.note || '',
                        phone: student.phone || 'Không có',
                        date: record.date,
                        status: record.status,
                    });
                }
            }
        });
        
        return records.sort((a, b) => a.date.localeCompare(b.date) || a.className.localeCompare(b.className) || a.studentName.localeCompare(b.studentName));
    }, [state.attendance, state.students, state.classes, startDate, endDate, classFilter]);

    const handleExport = () => {
        import('../../services/csvExport').then(({ downloadAsCSV }) => {
            const exportData = absentRecords.map(record => ({
                ...record,
                status: record.status === AttendanceStatus.UNEXCUSED_ABSENT ? 'Không phép' : 'Có phép'
            }));
            downloadAsCSV(exportData, {
                studentName: 'Họ tên',
                className: 'Lớp học',
                date: 'Ngày nghỉ',
                status: 'Trạng thái',
                phone: 'Số điện thoại',
                note: 'Lý do'
            }, `BaoCaoHocSinhNghiHoc_${startDate || 'all'}_${endDate || 'all'}.csv`);
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-4 md:p-6 border-b dark:border-slate-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                        Báo cáo học sinh nghỉ học
                    </h2>
                    <div className="flex items-center gap-2">
                        <button onClick={handleExport} className="text-sm font-medium text-primary hover:text-primary-dark mr-2 flex items-center gap-1">
                            {ICONS.export} Xuất CSV
                        </button>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                            {ICONS.close}
                        </button>
                    </div>
                </div>
                
                <div className="p-4 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Từ ngày</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-input w-full" />
                    </div>
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Đến ngày</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="form-input w-full" />
                    </div>
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lớp học</label>
                        <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="form-select w-full">
                            <option value="all">Tất cả các lớp</option>
                            {state.classes.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    {absentRecords.length > 0 ? (
                        <div className="space-y-4">
                            {absentRecords.map((record, idx) => (
                                <div key={idx} className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-100 dark:border-slate-600">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">{record.studentName}</h3>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${record.status === AttendanceStatus.UNEXCUSED_ABSENT ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' : 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200'}`}>
                                                {record.status === AttendanceStatus.UNEXCUSED_ABSENT ? 'Nghỉ không phép' : 'Nghỉ có phép'}
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{formatVietnamDate(record.date)}</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-300">
                                        <p><span className="font-medium">Lớp:</span> {record.className}</p>
                                        <p><span className="font-medium">SĐT:</span> {record.phone}</p>
                                        {record.note && (
                                            <p className="col-span-1 md:col-span-2 text-orange-600 dark:text-orange-400">
                                                <span className="font-medium">Ghi chú:</span> {record.note}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                            Không có học sinh nào nghỉ trong khoảng thời gian này.
                        </div>
                    )}
                </div>
                
                <div className="p-4 border-t dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-200 text-gray-800 dark:bg-slate-700 dark:text-white rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};
