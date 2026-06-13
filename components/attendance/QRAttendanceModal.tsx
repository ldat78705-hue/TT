import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useData } from '../../hooks/useDataContext';
import { useToast } from '../../hooks/useToast';
import { Class, Student, AttendanceRecord, AttendanceStatus, PersonStatus } from '../../types';
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

// === Tab 1: In thẻ QR cho học sinh ===
const PrintQRTab: React.FC<{ classes: Class[]; students: Student[] }> = ({ classes, students }) => {
    const [selectedClassId, setSelectedClassId] = useState('');

    const classStudents = useMemo(() => {
        if (!selectedClassId) return [];
        const cls = classes.find(c => c.id === selectedClassId);
        if (!cls) return [];
        return students.filter(s => cls.studentIds.includes(s.id) && s.status === PersonStatus.ACTIVE)
            .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    }, [selectedClassId, classes, students]);

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const cls = classes.find(c => c.id === selectedClassId);
        const cards = classStudents.map(s => {
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(s.id)}&format=png`;
            return `
                <div style="width:65mm;height:40mm;border:1px solid #ccc;border-radius:8px;padding:6px;display:inline-flex;align-items:center;gap:8px;margin:4px;page-break-inside:avoid;background:white;">
                    <img src="${qrUrl}" style="width:32mm;height:32mm;" />
                    <div style="flex:1;overflow:hidden;">
                        <div style="font-weight:bold;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.name}</div>
                        <div style="font-size:10px;color:#666;font-family:monospace;">${s.id}</div>
                        <div style="font-size:9px;color:#999;margin-top:2px;">${cls?.name || ''}</div>
                    </div>
                </div>
            `;
        }).join('');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html><head><title>Thẻ QR - ${cls?.name}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', sans-serif; padding: 10mm; }
                @media print { body { -webkit-print-color-adjust: exact; } }
            </style>
            </head><body>
                <h2 style="text-align:center;margin-bottom:8mm;font-size:16px;">Thẻ QR Điểm danh - ${cls?.name}</h2>
                <div style="display:flex;flex-wrap:wrap;justify-content:center;">${cards}</div>
            </body></html>
        `);
        printWindow.document.close();
        setTimeout(() => { printWindow.print(); }, 800);
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium mb-1">Chọn lớp</label>
                <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} className="form-select">
                    <option value="">-- Chọn lớp --</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.studentIds.length} HV)</option>)}
                </select>
            </div>

            {classStudents.length > 0 && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[40vh] overflow-y-auto">
                        {classStudents.map(s => (
                            <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                <img 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(s.id)}`} 
                                    alt={s.id} 
                                    className="w-12 h-12 rounded"
                                />
                                <div className="min-w-0">
                                    <p className="font-semibold text-sm truncate">{s.name}</p>
                                    <p className="text-xs text-slate-400 font-mono">{s.id}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Button onClick={handlePrint} className="w-full">🖨️ In thẻ QR ({classStudents.length} học viên)</Button>
                </>
            )}
        </div>
    );
};

// === Tab 2: Quét QR bằng camera ===
const ScanQRTab: React.FC<{ classes: Class[]; students: Student[] }> = ({ classes, students }) => {
    const { updateAttendance } = useData();
    const { toast } = useToast();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanIntervalRef = useRef<number | null>(null);
    
    const [selectedClassId, setSelectedClassId] = useState('');
    const [selectedDate, setSelectedDate] = useState(formatDateString(new Date(getVietnamTime())));
    const [isScanning, setIsScanning] = useState(false);
    const [scannedIds, setScannedIds] = useState<Set<string>>(new Set());
    const [lastScanned, setLastScanned] = useState<string | null>(null);

    const selectedClass = useMemo(() => classes.find(c => c.id === selectedClassId), [classes, selectedClassId]);

    // Today's classes
    const todayClasses = useMemo(() => {
        const dateObj = new Date(selectedDate + 'T00:00:00');
        const dayIdx = dateObj.getDay();
        return classes.filter(cls => 
            (cls.schedule || []).some(s => dayOfWeekToNumber[s.dayOfWeek] === dayIdx)
        );
    }, [classes, selectedDate]);

    const classStudents = useMemo(() => {
        if (!selectedClass) return [];
        return students.filter(s => selectedClass.studentIds.includes(s.id) && s.status === PersonStatus.ACTIVE);
    }, [selectedClass, students]);

    const stopScanning = useCallback(() => {
        if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current);
            scanIntervalRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setIsScanning(false);
    }, []);

    const processQRCode = useCallback(async (studentId: string) => {
        if (!selectedClassId || !selectedDate) return;
        if (scannedIds.has(studentId)) return; // Already scanned

        const student = students.find(s => s.id === studentId);
        if (!student) {
            toast.error(`Mã ${studentId} không tìm thấy trong hệ thống`);
            return;
        }

        if (!selectedClass?.studentIds.includes(studentId)) {
            toast.error(`${student.name} không thuộc lớp này`);
            return;
        }

        try {
            const record: AttendanceRecord = {
                id: `${selectedClassId}_${studentId}_${selectedDate}`,
                studentId,
                classId: selectedClassId,
                date: selectedDate,
                status: AttendanceStatus.PRESENT,
            };
            await updateAttendance([record]);
            setScannedIds(prev => new Set(prev).add(studentId));
            setLastScanned(studentId);
            toast.success(`✅ ${student.name} - Có mặt`);
        } catch {
            toast.error(`Lỗi điểm danh cho ${student.name}`);
        }
    }, [selectedClassId, selectedDate, scannedIds, students, selectedClass, updateAttendance, toast]);

    const startScanning = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } } 
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setIsScanning(true);

            // Simple QR decode using canvas + periodic check
            // We'll use a lightweight approach: scan for HS### pattern in BarcodeDetector API
            if ('BarcodeDetector' in window) {
                const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
                scanIntervalRef.current = window.setInterval(async () => {
                    if (!videoRef.current || videoRef.current.readyState < 2) return;
                    try {
                        const barcodes = await detector.detect(videoRef.current);
                        for (const barcode of barcodes) {
                            const value = barcode.rawValue?.trim();
                            if (value && /^HS\d+$/i.test(value)) {
                                processQRCode(value.toUpperCase());
                            }
                        }
                    } catch { /* ignore detection errors */ }
                }, 500);
            } else {
                toast.error('Trình duyệt không hỗ trợ quét QR. Vui lòng dùng Chrome trên Android.');
            }
        } catch {
            toast.error('Không thể mở camera. Vui lòng cho phép truy cập camera.');
        }
    }, [processQRCode, toast]);

    useEffect(() => {
        return () => { stopScanning(); };
    }, [stopScanning]);

    // Manual input fallback
    const [manualId, setManualId] = useState('');
    const handleManualSubmit = () => {
        if (manualId.trim()) {
            const id = manualId.trim().toUpperCase();
            processQRCode(id);
            setManualId('');
        }
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-sm font-medium mb-1">Ngày</label>
                    <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="form-input" />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Lớp</label>
                    <select value={selectedClassId} onChange={e => { setSelectedClassId(e.target.value); setScannedIds(new Set()); }} className="form-select">
                        <option value="">-- Chọn --</option>
                        {todayClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            </div>

            {selectedClassId && (
                <>
                    {/* Camera view */}
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                        <canvas ref={canvasRef} className="hidden" />
                        {!isScanning && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                                <Button onClick={startScanning}>📷 Bật camera quét</Button>
                            </div>
                        )}
                        {isScanning && (
                            <div className="absolute top-2 right-2">
                                <button onClick={stopScanning} className="bg-red-500 text-white text-xs px-3 py-1 rounded-full">Tắt</button>
                            </div>
                        )}
                        {lastScanned && (
                            <div className="absolute bottom-2 left-2 right-2 bg-green-500/90 text-white text-sm font-bold px-3 py-2 rounded-lg text-center animate-pulse">
                                ✅ {students.find(s => s.id === lastScanned)?.name} đã điểm danh
                            </div>
                        )}
                    </div>

                    {/* Manual fallback */}
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={manualId} 
                            onChange={e => setManualId(e.target.value)} 
                            onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                            placeholder="Nhập mã HV (VD: HS001)"
                            className="form-input flex-1"
                        />
                        <Button onClick={handleManualSubmit} disabled={!manualId.trim()}>Điểm danh</Button>
                    </div>

                    {/* Status */}
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Đã quét: {scannedIds.size}/{classStudents.length}</span>
                            <span className="text-xs text-slate-400">Chưa: {classStudents.length - scannedIds.size}</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                            <div 
                                className="bg-green-500 h-2 rounded-full transition-all" 
                                style={{ width: `${classStudents.length > 0 ? (scannedIds.size / classStudents.length * 100) : 0}%` }}
                            />
                        </div>
                        {scannedIds.size > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                                {Array.from(scannedIds).map(id => {
                                    const s = students.find(st => st.id === id);
                                    return (
                                        <span key={id} className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                                            ✓ {s?.name || id}
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

// === Main Modal ===
export const QRAttendanceModal: React.FC<QRAttendanceModalProps> = ({ isOpen, onClose }) => {
    const { state } = useData();
    const [activeTab, setActiveTab] = useState<'print' | 'scan'>('print');

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="📱 Điểm danh QR Code">
            <div className="border-b border-slate-200 dark:border-slate-700 mb-4">
                <nav className="flex gap-4">
                    <button 
                        onClick={() => setActiveTab('print')}
                        className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'print' 
                                ? 'border-primary text-primary' 
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        🖨️ In thẻ QR
                    </button>
                    <button 
                        onClick={() => setActiveTab('scan')}
                        className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'scan' 
                                ? 'border-primary text-primary' 
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        📷 Quét điểm danh
                    </button>
                </nav>
            </div>

            {activeTab === 'print' && <PrintQRTab classes={state.classes} students={state.students} />}
            {activeTab === 'scan' && <ScanQRTab classes={state.classes} students={state.students} />}
        </Modal>
    );
};
