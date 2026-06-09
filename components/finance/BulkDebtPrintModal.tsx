import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { DebtNotice } from './DebtNotice';
import { Student, Transaction } from '../../types';
import { useData } from '../../hooks/useDataContext';
import { ICONS } from '../../constants';
import { useToast } from '../../hooks/useToast';

declare global {
    interface Window {
        html2canvas: any;
        ClipboardItem: any; 
    }
}

interface BulkDebtPrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    students: Student[];
}

export const BulkDebtPrintModal: React.FC<BulkDebtPrintModalProps> = ({ isOpen, onClose, students }) => {
    const { state } = useData();
    const { transactions, settings } = state;
    const { toast } = useToast();
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    
    // For individual download
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadIndex, setDownloadIndex] = useState(0);

    // For automated sequential copy
    const [isCopying, setIsCopying] = useState(false);
    const [copyQueue, setCopyQueue] = useState<Student[]>([]);
    const [currentCopyIndex, setCurrentCopyIndex] = useState(0);

    const noticeRenderRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setSelectedStudentIds(students.map(s => s.id));
        } else {
            // Reset everything on close
            setSelectedStudentIds([]);
            setIsDownloading(false);
            setDownloadIndex(0);
            setIsCopying(false);
            setCopyQueue([]);
            setCurrentCopyIndex(0);
        }
    }, [isOpen, students]);

    const selectedStudents = useMemo(() => {
        const studentMap = new Map(students.map(s => [s.id, s]));
        return selectedStudentIds.map(id => studentMap.get(id)).filter(Boolean) as Student[];
    }, [selectedStudentIds, students]);

    const handleToggleStudent = (id: string) => {
        setSelectedStudentIds(prev =>
            prev.includes(id) ? prev.filter(studentId => studentId !== id) : [...prev, id]
        );
    };

    const handleToggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedStudentIds(students.map(s => s.id));
        } else {
            setSelectedStudentIds([]);
        }
    };

    // --- Image Download Logic ---
    const handleStartDownload = () => {
        if (selectedStudents.length > 0) {
            setIsDownloading(true);
            setDownloadIndex(0);
        }
    };

    useEffect(() => {
        if (!isDownloading || !isOpen) return;

        const processDownloadQueue = async () => {
            if (downloadIndex >= selectedStudents.length) {
                toast.success(`Hoàn tất tải ${selectedStudents.length} phiếu!`);
                setIsDownloading(false);
                return;
            }

            // Process current item
            await new Promise(resolve => setTimeout(resolve, 150));

            const element = noticeRenderRef.current;
            if (element && window.html2canvas) {
                try {
                    const student = selectedStudents[downloadIndex];
                    const canvas = await window.html2canvas(element, { scale: 2.5, useCORS: true });
                    const link = document.createElement('a');
                    link.download = `TBHP_${student.id}_${student.name.replace(/\s/g, '_')}.png`;
                    link.href = canvas.toDataURL('image/png');
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setDownloadIndex(prev => prev + 1);
                } catch(err) {
                    console.error("Failed to export image for student:", selectedStudents[downloadIndex].name, err);
                    toast.error(`Lỗi khi tạo ảnh cho ${selectedStudents[downloadIndex].name}.`);
                    setDownloadIndex(prev => prev + 1);
                }
            } else {
                 setDownloadIndex(prev => prev + 1);
            }
        };

        processDownloadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDownloading, downloadIndex, isOpen, selectedStudents, toast]);

    // --- Sequential Copy Logic ---
    const handleStartSequentialCopy = () => {
        if (selectedStudents.length > 0 && !isCopying) {
            setCopyQueue(selectedStudents);
            setCurrentCopyIndex(0);
            setIsCopying(true);
        }
    };

    useEffect(() => {
        if (!isCopying || currentCopyIndex >= copyQueue.length) {
            if (isCopying) { // Just finished
                toast.success(`Hoàn tất sao chép ${copyQueue.length} phiếu!`);
                setIsCopying(false);
                setCopyQueue([]);
                setCurrentCopyIndex(0);
            }
            return;
        }

        const processCopy = async () => {
            const studentToCopy = copyQueue[currentCopyIndex];
            toast.info(`Đang chuẩn bị phiếu của ${studentToCopy.name} (${currentCopyIndex + 1}/${copyQueue.length})...`);
            
            await new Promise(resolve => setTimeout(resolve, 150));

            const element = noticeRenderRef.current;
            if (element && window.html2canvas && navigator.clipboard) {
                try {
                    const canvas = await window.html2canvas(element, { scale: 2.5, useCORS: true });
                    canvas.toBlob(async (blob: Blob | null) => {
                        if (blob) {
                            await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
                            toast.success(`Đã sao chép phiếu của ${studentToCopy.name}. Bạn có thể dán vào Zalo ngay.`);
                            
                            setTimeout(() => {
                                setCurrentCopyIndex(prev => prev + 1);
                            }, 3000); // 3-second delay for user to paste
                        } else {
                            throw new Error("Canvas toBlob failed.");
                        }
                    });
                } catch(err) {
                    console.error("Copy error:", err);
                    toast.error(`Lỗi khi sao chép phiếu của ${studentToCopy.name}.`);
                    setIsCopying(false); // Stop on error
                }
            } else {
                toast.error("Trình duyệt không hỗ trợ tính năng này.");
                setIsCopying(false);
            }
        };

        processCopy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCopying, currentCopyIndex]);

    
    const getStudentTransactions = (studentId: string): Transaction[] => {
        return transactions.filter(t => t.studentId === studentId);
    }
    
    const studentToRender = useMemo(() => {
        if (isDownloading && downloadIndex < selectedStudents.length) return selectedStudents[downloadIndex];
        if (isCopying && currentCopyIndex < copyQueue.length) return copyQueue[currentCopyIndex];
        return selectedStudents.length > 0 ? selectedStudents[0] : null;
    }, [isDownloading, downloadIndex, isCopying, currentCopyIndex, copyQueue, selectedStudents]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Xuất Thông Báo Học Phí">
            <div ref={noticeRenderRef} style={{ position: 'absolute', left: '-9999px', width: '10.5cm' }}>
                {studentToRender && (
                    <DebtNotice
                        student={studentToRender}
                        transactions={getStudentTransactions(studentToRender.id)}
                        settings={settings}
                    />
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-4">
                    <div>
                        <h3 className="font-semibold mb-2">Chọn học viên ({selectedStudentIds.length}/{students.length})</h3>
                        <div className="border rounded-md dark:border-gray-600 max-h-80 overflow-y-auto">
                            <label className="flex items-center p-2 border-b dark:border-gray-600 bg-gray-50 dark:bg-gray-700 sticky top-0">
                                <input
                                    type="checkbox"
                                    checked={selectedStudentIds.length === students.length && students.length > 0}
                                    onChange={handleToggleAll}
                                    className="h-4 w-4"
                                />
                                <span className="ml-3 text-sm font-semibold">Chọn tất cả</span>
                            </label>
                            {students.map(student => (
                                <label key={student.id} className="flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedStudentIds.includes(student.id)}
                                        onChange={() => handleToggleStudent(student.id)}
                                        className="h-4 w-4"
                                    />
                                    <span className="ml-3 text-sm">{student.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2 pt-4 border-t dark:border-gray-700">
                         <Button onClick={handleStartDownload} isLoading={isDownloading} disabled={selectedStudents.length === 0 || isCopying} className="w-full">
                             {isDownloading ? `Đang tải ${downloadIndex + 1}/${selectedStudents.length}...` : <>{ICONS.download} Tải ảnh ({selectedStudents.length})</>}
                         </Button>
                         <Button onClick={handleStartSequentialCopy} isLoading={isCopying} disabled={selectedStudents.length === 0 || isDownloading} className="w-full" variant="secondary">
                             {isCopying ? `Đang sao chép ${currentCopyIndex + 1}/${copyQueue.length}...` : <>{ICONS.copy} Bắt đầu sao chép tự động ({selectedStudents.length})</>}
                         </Button>
                    </div>
                </div>

                <div className="md:col-span-2 bg-gray-200 dark:bg-gray-900 p-4 rounded-lg">
                    <h3 className="text-center font-semibold mb-2">Xem trước Phiếu báo</h3>
                    <div className="bg-white shadow-lg mx-auto" style={{ width: '10.5cm', minHeight: '14.8cm' }}>
                         {studentToRender ? (
                            <DebtNotice
                                student={studentToRender}
                                transactions={getStudentTransactions(studentToRender.id)}
                                settings={settings}
                            />
                        ) : (
                            <div className="h-64 flex items-center justify-center text-gray-500">
                                Chọn một học viên để xem trước.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};