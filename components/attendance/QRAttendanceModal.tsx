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
    const [isScanning, setIsScanning] = useState(false);
    const [scannedIds, setScannedIds] = useState<Set<string>>(new Set());
    const [lastScanned, setLastScanned] = useState<string | null>(null);

    // Use refs to avoid stale closures in setInterval callback
    const scannedIdsRef = useRef<Set<string>>(scannedIds);
    const processingRef = useRef<Set<string>>(new Set()); // Prevent concurrent processing of same ID
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
        setIsScanning(false);
    }, []);

    const processQRCode = useCallback(async (studentId: string) => {
        const classId = selectedClassIdRef.current;
        const date = selectedDateRef.current;
        if (!classId || !date) return;
        
        // Check using ref (always current) instead of state (stale in setInterval)
        if (scannedIdsRef.current.has(studentId)) return;
        // Prevent concurrent processing of the same ID
        if (processingRef.current.has(studentId)) return;
        processingRef.current.add(studentId);

        const student = students.find(s => s.id === studentId);
        if (!student) {
            processingRef.current.delete(studentId);
            return; // Silently ignore unknown IDs during scanning
        }

        const cls = selectedClassRef.current;
        if (!cls?.studentIds.includes(studentId)) {
            processingRef.current.delete(studentId);
            return; // Silently ignore students not in this class
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
            setScannedIds(prev => {
                const next = new Set(prev);
                next.add(studentId);
                scannedIdsRef.current = next;
                return next;
            });
            setLastScanned(studentId);
            toast.success(`✅ ${student.name} - Có mặt`);
        } catch {
            toast.error(`Lỗi điểm danh cho ${student.name}`);
        } finally {
            processingRef.current.delete(studentId);
        }
    }, [students, updateAttendance, toast]); // No scannedIds dependency!

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

    // Reset when modal closes
    useEffect(() => {
        if (!isOpen) {
            stopScanning();
            setScannedIds(new Set());
            scannedIdsRef.current = new Set();
            processingRef.current = new Set();
            setLastScanned(null);
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

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="📷 Quét QR Điểm danh">
            <div className="space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Quét mã QR trên thẻ học viên để điểm danh nhanh. Thẻ QR được in từ phần <b>Học viên</b> hoặc <b>Chi tiết Lớp học</b>.
                </p>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium mb-1">Ngày</label>
                        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="form-input" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Lớp</label>
                        <select value={selectedClassId} onChange={e => { setSelectedClassId(e.target.value); setScannedIds(new Set()); scannedIdsRef.current = new Set(); processingRef.current = new Set(); }} className="form-select">
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
                                <div className="absolute bottom-2 left-2 right-2 bg-green-500/90 text-white text-sm font-bold px-3 py-2 rounded-lg text-center">
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
        </Modal>
    );
};
