import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Button } from '../common/Button';
import { useData } from '../../hooks/useDataContext';
import { useToast } from '../../hooks/useToast';
import { AttendanceRecord, AttendanceStatus, PersonStatus } from '../../types';
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

// Beep sound for successful scan
const playBeep = () => {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    } catch { /* silent fallback */ }
};

const playErrorBeep = () => {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 300;
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    } catch { /* silent fallback */ }
};

type ScanStep = 'setup' | 'scanning' | 'done';

export const QRAttendanceModal: React.FC<QRAttendanceModalProps> = ({ isOpen, onClose }) => {
    const { state, updateAttendance } = useData();
    const { toast } = useToast();
    const { classes, students } = state;
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanIntervalRef = useRef<number | null>(null);
    
    const [selectedClassId, setSelectedClassId] = useState('');
    const [selectedDate, setSelectedDate] = useState(formatDateString(new Date(getVietnamTime())));
    const [step, setStep] = useState<ScanStep>('setup');
    const [scannedIds, setScannedIds] = useState<Set<string>>(new Set());
    const [lastScanned, setLastScanned] = useState<{ id: string; name: string; time: string } | null>(null);
    const [scanLog, setScanLog] = useState<Array<{ id: string; name: string; time: string; status: 'success' | 'duplicate' | 'error' }>>([]);

    // Use refs to avoid stale closures in setInterval callback
    const scannedIdsRef = useRef<Set<string>>(scannedIds);
    const processingRef = useRef<Set<string>>(new Set());
    const selectedClassIdRef = useRef(selectedClassId);
    const selectedDateRef = useRef(selectedDate);

    // Keep refs in sync
    useEffect(() => { scannedIdsRef.current = scannedIds; }, [scannedIds]);
    useEffect(() => { selectedClassIdRef.current = selectedClassId; }, [selectedClassId]);
    useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);

    const selectedClass = useMemo(() => classes.find(c => c.id === selectedClassId), [classes, selectedClassId]);
    const selectedClassRef = useRef(selectedClass);
    useEffect(() => { selectedClassRef.current = selectedClass; }, [selectedClass]);

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
    }, []);

    const processQRCode = useCallback(async (studentId: string) => {
        const classId = selectedClassIdRef.current;
        const date = selectedDateRef.current;
        if (!classId || !date) return;
        
        // Check duplicate
        if (scannedIdsRef.current.has(studentId)) {
            // Flash "already scanned" briefly
            const student = students.find(s => s.id === studentId);
            if (student) {
                setScanLog(prev => [{
                    id: studentId,
                    name: student.name,
                    time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    status: 'duplicate'
                }, ...prev.slice(0, 49)]);
            }
            return;
        }
        
        // Prevent concurrent processing
        if (processingRef.current.has(studentId)) return;
        processingRef.current.add(studentId);

        const student = students.find(s => s.id === studentId);
        if (!student) {
            processingRef.current.delete(studentId);
            playErrorBeep();
            setScanLog(prev => [{
                id: studentId,
                name: `Mã không hợp lệ: ${studentId}`,
                time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                status: 'error'
            }, ...prev.slice(0, 49)]);
            return;
        }

        const cls = selectedClassRef.current;
        if (!cls?.studentIds.includes(studentId)) {
            processingRef.current.delete(studentId);
            playErrorBeep();
            setScanLog(prev => [{
                id: studentId,
                name: `${student.name} (không thuộc lớp)`,
                time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                status: 'error'
            }, ...prev.slice(0, 49)]);
            return;
        }

        try {
            const record: AttendanceRecord = {
                id: `${classId}_${studentId}_${date}`,
                studentId,
                classId: classId,
                date: date,
                status: AttendanceStatus.PRESENT,
            };
            await updateAttendance([record]);
            
            const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            setScannedIds(prev => {
                const next = new Set(prev);
                next.add(studentId);
                scannedIdsRef.current = next;
                return next;
            });
            setLastScanned({ id: studentId, name: student.name, time: timeStr });
            setScanLog(prev => [{
                id: studentId,
                name: student.name,
                time: timeStr,
                status: 'success'
            }, ...prev.slice(0, 49)]);
            
            playBeep();
        } catch {
            playErrorBeep();
            toast.error(`Lỗi điểm danh cho ${student.name}`);
            setScanLog(prev => [{
                id: studentId,
                name: student.name,
                time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                status: 'error'
            }, ...prev.slice(0, 49)]);
        } finally {
            processingRef.current.delete(studentId);
        }
    }, [students, updateAttendance, toast]);

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
            setStep('scanning');

            if ('BarcodeDetector' in window) {
                const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
                scanIntervalRef.current = window.setInterval(async () => {
                    if (!videoRef.current || videoRef.current.readyState < 2) return;
                    try {
                        const barcodes = await detector.detect(videoRef.current);
                        for (const barcode of barcodes) {
                            const value = barcode.rawValue?.trim();
                            if (value) {
                                processQRCode(value.toUpperCase());
                            }
                        }
                    } catch { /* ignore detection errors */ }
                }, 400);
            } else {
                toast.error('Trình duyệt không hỗ trợ quét QR. Vui lòng dùng Chrome trên Android hoặc nhập mã thủ công.');
            }
        } catch {
            toast.error('Không thể mở camera. Vui lòng cho phép truy cập camera.');
        }
    }, [processQRCode, toast]);

    useEffect(() => {
        return () => { stopScanning(); };
    }, [stopScanning]);

    // Reset when modal closes
    useEffect(() => {
        if (!isOpen) {
            stopScanning();
            setScannedIds(new Set());
            scannedIdsRef.current = new Set();
            processingRef.current = new Set();
            setLastScanned(null);
            setScanLog([]);
            setStep('setup');
            setSelectedClassId('');
        }
    }, [isOpen, stopScanning]);

    // Manual input fallback
    const [manualId, setManualId] = useState('');
    const handleManualSubmit = () => {
        if (manualId.trim()) {
            const id = manualId.trim().toUpperCase();
            processQRCode(id);
            setManualId('');
        }
    };

    const handleFinish = () => {
        stopScanning();
        setStep('done');
    };

    const handleClose = () => {
        stopScanning();
        onClose();
    };

    const progress = classStudents.length > 0 ? (scannedIds.size / classStudents.length * 100) : 0;
    const remaining = classStudents.length - scannedIds.size;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
            
            {/* Modal */}
            <div className="relative w-full sm:max-w-lg max-h-[95vh] bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            📷 Điểm danh QR
                        </h2>
                        {step === 'scanning' && selectedClass && (
                            <p className="text-sm text-white/80 mt-0.5">
                                {selectedClass.name} • {selectedDate}
                            </p>
                        )}
                    </div>
                    <button 
                        onClick={handleClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5">
                    
                    {/* === STEP 1: SETUP === */}
                    {step === 'setup' && (
                        <div className="space-y-5">
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                    💡 Quét mã QR trên thẻ học viên để điểm danh nhanh. Chọn lớp và ngày bên dưới, sau đó bấm <b>"Bắt đầu quét"</b>.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">📅 Ngày điểm danh</label>
                                <input 
                                    type="date" 
                                    value={selectedDate} 
                                    onChange={e => setSelectedDate(e.target.value)} 
                                    className="form-input w-full text-base"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">📚 Chọn lớp học</label>
                                {todayClasses.length > 0 ? (
                                    <div className="space-y-2">
                                        {todayClasses.map(c => {
                                            const studentCount = students.filter(s => c.studentIds.includes(s.id) && s.status === PersonStatus.ACTIVE).length;
                                            return (
                                                <button
                                                    key={c.id}
                                                    onClick={() => setSelectedClassId(c.id)}
                                                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                                                        selectedClassId === c.id
                                                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-200 dark:ring-indigo-800'
                                                            : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600'
                                                    }`}
                                                >
                                                    <div className="font-semibold text-slate-800 dark:text-white">{c.name}</div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                        {studentCount} học viên • {(c.schedule || []).map(s => s.startTime + '-' + s.endTime).join(', ')}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-slate-400">
                                        Không có lớp học nào vào ngày này.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* === STEP 2: SCANNING === */}
                    {step === 'scanning' && (
                        <div className="space-y-4">
                            {/* Progress bar */}
                            <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                        ✅ Đã quét: <span className="text-green-600 dark:text-green-400">{scannedIds.size}</span>/{classStudents.length}
                                    </span>
                                    <span className="text-sm font-medium text-orange-500">
                                        Còn lại: {remaining}
                                    </span>
                                </div>
                                <div className="w-full bg-slate-300 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                                    <div 
                                        className="bg-gradient-to-r from-green-400 to-emerald-500 h-3 rounded-full transition-all duration-500 ease-out" 
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                {progress === 100 && (
                                    <p className="text-center text-green-600 dark:text-green-400 font-bold mt-2 text-sm animate-pulse">
                                        🎉 Đã điểm danh toàn bộ lớp!
                                    </p>
                                )}
                            </div>

                            {/* Camera view */}
                            <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
                                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                                <canvas ref={canvasRef} className="hidden" />
                                
                                {/* Scan overlay frame */}
                                <div className="absolute inset-0 pointer-events-none">
                                    <div className="absolute inset-[15%] border-2 border-white/40 rounded-2xl">
                                        <div className="absolute -top-0.5 -left-0.5 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl-xl" />
                                        <div className="absolute -top-0.5 -right-0.5 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr-xl" />
                                        <div className="absolute -bottom-0.5 -left-0.5 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl-xl" />
                                        <div className="absolute -bottom-0.5 -right-0.5 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br-xl" />
                                    </div>
                                    {/* Animated scan line */}
                                    <div className="absolute left-[15%] right-[15%] h-0.5 bg-green-400/80 shadow-[0_0_8px_rgba(74,222,128,0.6)] animate-[scanLine_2s_ease-in-out_infinite]" 
                                         style={{ top: '50%' }} />
                                </div>

                                {/* Last scanned notification */}
                                {lastScanned && (
                                    <div className="absolute bottom-3 left-3 right-3 bg-green-500 text-white text-sm font-bold px-4 py-3 rounded-xl text-center shadow-lg animate-[slideUp_0.3s_ease-out]">
                                        <div className="flex items-center justify-center gap-2">
                                            <span className="text-lg">✅</span>
                                            <div>
                                                <div>{lastScanned.name}</div>
                                                <div className="text-xs font-normal text-green-100">{lastScanned.time}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Manual input */}
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={manualId} 
                                    onChange={e => setManualId(e.target.value)} 
                                    onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                                    placeholder="Nhập mã HV thủ công (VD: HS001)"
                                    className="form-input flex-1 text-base"
                                />
                                <Button onClick={handleManualSubmit} disabled={!manualId.trim()}>
                                    Điểm danh
                                </Button>
                            </div>

                            {/* Scan log */}
                            {scanLog.length > 0 && (
                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                                        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Lịch sử quét ({scanLog.length})
                                        </h4>
                                    </div>
                                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
                                        {scanLog.map((log, i) => (
                                            <div key={`${log.id}-${i}`} className="flex items-center gap-3 px-4 py-2 text-sm">
                                                <span className={`text-base flex-shrink-0 ${
                                                    log.status === 'success' ? '' : 
                                                    log.status === 'duplicate' ? '' : ''
                                                }`}>
                                                    {log.status === 'success' ? '✅' : log.status === 'duplicate' ? '🔄' : '❌'}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <span className={`font-medium truncate block ${
                                                        log.status === 'error' ? 'text-red-600 dark:text-red-400' :
                                                        log.status === 'duplicate' ? 'text-yellow-600 dark:text-yellow-400' :
                                                        'text-slate-700 dark:text-slate-200'
                                                    }`}>
                                                        {log.name}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-slate-400 flex-shrink-0">{log.time}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* === STEP 3: DONE === */}
                    {step === 'done' && (
                        <div className="space-y-5">
                            <div className="text-center py-6">
                                <div className="text-5xl mb-3">🎓</div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                                    Điểm danh hoàn tất!
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400 mt-1">
                                    {selectedClass?.name} • {selectedDate}
                                </p>
                            </div>

                            {/* Summary cards */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 text-center">
                                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{scannedIds.size}</div>
                                    <div className="text-xs text-green-700 dark:text-green-300 font-medium mt-1">Có mặt</div>
                                </div>
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
                                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{remaining}</div>
                                    <div className="text-xs text-red-700 dark:text-red-300 font-medium mt-1">Vắng mặt</div>
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-center">
                                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{classStudents.length}</div>
                                    <div className="text-xs text-blue-700 dark:text-blue-300 font-medium mt-1">Tổng sĩ số</div>
                                </div>
                            </div>

                            {/* Absent students list */}
                            {remaining > 0 && (
                                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-4">
                                    <h4 className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2">
                                        Học viên vắng mặt ({remaining})
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {classStudents
                                            .filter(s => !scannedIds.has(s.id))
                                            .map(s => (
                                                <span key={s.id} className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-1.5 rounded-full font-medium">
                                                    {s.name}
                                                </span>
                                            ))
                                        }
                                    </div>
                                </div>
                            )}

                            {/* Present students */}
                            {scannedIds.size > 0 && (
                                <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl p-4">
                                    <h4 className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">
                                        Học viên có mặt ({scannedIds.size})
                                    </h4>
                                    <div className="flex flex-wrap gap-1.5">
                                        {Array.from(scannedIds).map(id => {
                                            const s = students.find(st => st.id === id);
                                            return (
                                                <span key={id} className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2.5 py-1 rounded-full">
                                                    ✓ {s?.name || id}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    {step === 'setup' && (
                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={handleClose} className="flex-1">
                                Hủy
                            </Button>
                            <Button 
                                onClick={startScanning} 
                                disabled={!selectedClassId}
                                className="flex-[2]"
                            >
                                📷 Bắt đầu quét
                            </Button>
                        </div>
                    )}
                    {step === 'scanning' && (
                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={handleClose} className="flex-shrink-0">
                                Hủy
                            </Button>
                            <Button onClick={handleFinish} className="flex-1 !bg-green-600 hover:!bg-green-700">
                                ✅ Hoàn tất điểm danh ({scannedIds.size}/{classStudents.length})
                            </Button>
                        </div>
                    )}
                    {step === 'done' && (
                        <Button onClick={handleClose} className="w-full">
                            Đóng
                        </Button>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes scanLine {
                    0%, 100% { top: 18%; }
                    50% { top: 78%; }
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};
