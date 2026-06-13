import React, { useState, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useData } from '../../hooks/useDataContext';
import { Class } from '../../types';
import { getVietnamTime } from '../../utils/date';

interface QRAttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const dayOfWeekToNumber: Record<string, number> = {
    'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6,
};

export const QRAttendanceModal: React.FC<QRAttendanceModalProps> = ({ isOpen, onClose }) => {
    const { state } = useData();
    const [selectedClassId, setSelectedClassId] = useState('');
    const [selectedDate, setSelectedDate] = useState(formatDateString(new Date(getVietnamTime())));

    const todayClasses = useMemo(() => {
        const dateObj = new Date(selectedDate + 'T00:00:00');
        const dayIdx = dateObj.getDay();
        return state.classes.filter(cls => 
            (cls.schedule || []).some(s => dayOfWeekToNumber[s.dayOfWeek] === dayIdx)
        );
    }, [state.classes, selectedDate]);

    const selectedClass = useMemo(() => {
        return state.classes.find(c => c.id === selectedClassId) || null;
    }, [state.classes, selectedClassId]);

    // Build a simple attendance link that can be shared
    const attendanceUrl = useMemo(() => {
        if (!selectedClassId || !selectedDate) return '';
        const baseUrl = window.location.origin;
        return `${baseUrl}/attendance/${selectedClassId}/${selectedDate}`;
    }, [selectedClassId, selectedDate]);

    const qrImageUrl = useMemo(() => {
        if (!attendanceUrl) return '';
        return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(attendanceUrl)}&format=png`;
    }, [attendanceUrl]);

    const selectedSchedule = useMemo(() => {
        if (!selectedClass) return null;
        const dateObj = new Date(selectedDate + 'T00:00:00');
        const dayIdx = dateObj.getDay();
        return selectedClass.schedule.find(s => dayOfWeekToNumber[s.dayOfWeek] === dayIdx);
    }, [selectedClass, selectedDate]);

    const copyLink = () => {
        navigator.clipboard.writeText(attendanceUrl);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="📱 Điểm danh QR Code">
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Ngày</label>
                        <input 
                            type="date" 
                            value={selectedDate} 
                            onChange={e => { setSelectedDate(e.target.value); setSelectedClassId(''); }}
                            className="form-input"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Lớp học</label>
                        <select 
                            value={selectedClassId}
                            onChange={e => setSelectedClassId(e.target.value)}
                            className="form-select"
                        >
                            <option value="">-- Chọn lớp --</option>
                            {todayClasses.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {selectedClassId && qrImageUrl && (
                    <div className="text-center space-y-4 pt-4">
                        {/* Class Info */}
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                            <h3 className="text-lg font-bold">{selectedClass?.name}</h3>
                            {selectedSchedule && (
                                <p className="text-sm text-slate-500">
                                    {selectedDate} • {selectedSchedule.startTime} - {selectedSchedule.endTime}
                                </p>
                            )}
                            <p className="text-xs text-slate-400 mt-1">
                                {selectedClass?.studentIds.length || 0} học viên
                            </p>
                        </div>

                        {/* QR Code */}
                        <div className="inline-block p-4 bg-white rounded-2xl shadow-lg border border-slate-200">
                            <img src={qrImageUrl} alt="QR Code điểm danh" className="w-[200px] h-[200px]" />
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Quét mã này hoặc nhấn vào link bên dưới để đến trang điểm danh
                        </p>

                        {/* Share Link */}
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-2">
                            <input
                                type="text"
                                value={attendanceUrl}
                                readOnly
                                className="flex-1 bg-transparent text-xs text-slate-600 dark:text-slate-300 outline-none font-mono"
                            />
                            <Button size="sm" onClick={copyLink}>Copy</Button>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-center gap-3 pt-2">
                            <Button 
                                variant="secondary" 
                                onClick={() => {
                                    const printWindow = window.open('', '_blank');
                                    if (printWindow) {
                                        printWindow.document.write(`
                                            <html><head><title>QR Điểm danh - ${selectedClass?.name}</title></head>
                                            <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;">
                                                <h1>${selectedClass?.name}</h1>
                                                <p>Ngày: ${selectedDate}${selectedSchedule ? ` • ${selectedSchedule.startTime} - ${selectedSchedule.endTime}` : ''}</p>
                                                <img src="${qrImageUrl}" width="300" height="300" />
                                                <p style="margin-top:10px;color:#666;">Quét mã QR để điểm danh</p>
                                            </body></html>
                                        `);
                                        printWindow.document.close();
                                        setTimeout(() => { printWindow.print(); }, 500);
                                    }
                                }}
                            >
                                🖨️ In QR
                            </Button>
                        </div>
                    </div>
                )}

                {!selectedClassId && todayClasses.length === 0 && selectedDate && (
                    <div className="text-center py-8 text-slate-400">
                        <p className="text-lg mb-1">📅</p>
                        <p>Không có lớp học nào vào ngày này</p>
                    </div>
                )}
            </div>
        </Modal>
    );
};
