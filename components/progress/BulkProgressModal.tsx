import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Class, Student, ProgressReport } from '../../types';
import { formatVietnamDate } from '../../utils/date';
import { useToast } from '../../hooks/useToast';
import { ExportButton } from '../common/ExportButton';

interface BulkProgressModalProps {
    isOpen: boolean;
    onClose: () => void;
    classes: Class[];
    students: Student[];
    onSave: (reports: Omit<ProgressReport, 'id'>[]) => Promise<void>;
    currentUserId: string;
}

interface StudentGrade {
    studentId: string;
    studentName: string;
    score: string;
    comments: string;
}

export const BulkProgressModal: React.FC<BulkProgressModalProps> = ({ isOpen, onClose, classes, students, onSave, currentUserId }) => {
    const today = new Date().toISOString().split('T')[0];
    const [date, setDate] = useState<string>(today);
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [grades, setGrades] = useState<Record<string, StudentGrade>>({});
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    // Initialize state when modal opens or selected class changes
    useEffect(() => {
        if (isOpen) {
            if (!selectedClassId && classes.length > 0) {
                setSelectedClassId(classes[0].id);
            }
        }
    }, [isOpen, classes, selectedClassId]);

    // Reset grades only when modal opens or class actually changes
    useEffect(() => {
        if (isOpen) {
            setGrades({});
        }
    }, [isOpen, selectedClassId]);

    const enrolledStudents = useMemo(() => {
        if (!selectedClassId) return [];
        const selectedClass = classes.find(c => c.id === selectedClassId);
        if (!selectedClass) return [];
        
        return students
            .filter(s => selectedClass.studentIds.includes(s.id))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [selectedClassId, classes, students]);

    useEffect(() => {
        if (enrolledStudents.length > 0 && Object.keys(grades).length === 0) {
            const initialGrades: Record<string, StudentGrade> = {};
            enrolledStudents.forEach(s => {
                initialGrades[s.id] = {
                    studentId: s.id,
                    studentName: s.name,
                    score: '',
                    comments: '',
                };
            });
            setGrades(initialGrades);
        }
    }, [enrolledStudents]);

    const handleGradeChange = (studentId: string, field: keyof StudentGrade, value: string) => {
        setGrades(prev => {
            const currentGrade = prev[studentId] || { studentId, studentName: enrolledStudents.find(s => s.id === studentId)?.name || '', score: '', comments: '' };
            return {
                ...prev,
                [studentId]: {
                    ...currentGrade,
                    [field]: value
                }
            };
        });
    };

    const handleSave = async () => {
        if (!selectedClassId) {
            toast.error('Vui lòng chọn lớp học.');
            return;
        }

        const reportsToSave: Omit<ProgressReport, 'id'>[] = [];
        
        for (const s of enrolledStudents) {
            const grade = grades[s.id];
            if (grade) {
                const hasScore = grade.score.trim() !== '';
                const hasComment = grade.comments.trim() !== '';
                
                if (hasScore || hasComment) {
                    let numScore: number | null = null;
                    if (hasScore) {
                        numScore = parseFloat(grade.score);
                        if (isNaN(numScore) || numScore < 0 || numScore > 10) {
                            toast.error(`Điểm của học sinh ${s.name} không hợp lệ (từ 0 đến 10).`);
                            return;
                        }
                    }
                    reportsToSave.push({
                        classId: selectedClassId,
                        studentId: s.id,
                        date: date,
                        score: numScore,
                        comments: grade.comments.trim(),
                        createdBy: currentUserId
                    });
                }
            }
        }

        if (reportsToSave.length === 0) {
            toast.error('Chưa có học sinh nào được nhập điểm hợp lệ.');
            return;
        }

        setIsSaving(true);
        try {
            await onSave(reportsToSave);
            toast.success(`Đã lưu thành công ${reportsToSave.length} báo cáo tiến độ.`);
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Có lỗi xảy ra khi lưu.')
        } finally {
            setIsSaving(false);
        }
    };

    const exportData = useMemo(() => {
        const selectedClass = classes.find(c => c.id === selectedClassId);
        const className = selectedClass ? selectedClass.name : 'Unknown';
        return enrolledStudents.map(s => {
            const grade = grades[s.id];
            return {
                studentId: s.id,
                studentName: s.name,
                className: className,
                date: formatVietnamDate(date),
                score: grade ? grade.score : '',
                comments: grade ? grade.comments : ''
            };
        });
    }, [enrolledStudents, grades, classes, selectedClassId, date]);

    const exportColumns = {
        studentId: 'Mã Học viên',
        studentName: 'Tên Học viên',
        className: 'Lớp học',
        date: 'Ngày',
        score: 'Điểm (Hệ 10)',
        comments: 'Nhận xét'
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Nhập Điểm / Báo cáo Tiến độ Hàng Loạt">
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">Lớp học</label>
                        <select 
                            value={selectedClassId} 
                            onChange={e => setSelectedClassId(e.target.value)} 
                            className="form-select w-full"
                        >
                            <option value="">-- Chọn lớp --</option>
                            {classes.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">Ngày đánh giá</label>
                        <input 
                            type="date" 
                            value={date} 
                            onChange={e => setDate(e.target.value)} 
                            className="form-input w-full"
                            required
                        />
                    </div>
                </div>

                {selectedClassId && enrolledStudents.length === 0 && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-md">
                        Lớp học này hiện chưa có học sinh nào.
                    </div>
                )}

                {enrolledStudents.length > 0 && (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="py-2 px-3 font-semibold">Mã HV</th>
                                    <th className="py-2 px-3 font-semibold">Tên Học Sinh</th>
                                    <th className="py-2 px-3 font-semibold w-32">Điểm (0-10)</th>
                                    <th className="py-2 px-3 font-semibold">Nhận xét</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {enrolledStudents.map(s => (
                                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                        <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{s.id}</td>
                                        <td className="py-2 px-3 font-medium whitespace-nowrap">{s.name}</td>
                                        <td className="py-2 px-3">
                                            <input 
                                                type="number"
                                                min="0" max="10" step="0.5"
                                                className="form-input w-full p-1 text-sm"
                                                placeholder="Điểm..."
                                                value={grades[s.id]?.score || ''}
                                                onChange={(e) => handleGradeChange(s.id, 'score', e.target.value)}
                                            />
                                        </td>
                                        <td className="py-2 px-3">
                                            <input 
                                                type="text"
                                                className="form-input w-full p-1 text-sm"
                                                placeholder="Nhận xét..."
                                                value={grades[s.id]?.comments || ''}
                                                onChange={(e) => handleGradeChange(s.id, 'comments', e.target.value)}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row justify-between items-center pt-4 gap-4 border-t dark:border-gray-700">
                    <ExportButton 
                        data={exportData} 
                        columns={exportColumns} 
                        filenameBase={`BangDiem_${classes.find(c => c.id === selectedClassId)?.name || 'Unknown'}_${date}`}
                        label="Xuất File Điểm"
                    />
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={onClose} disabled={isSaving}>Hủy</Button>
                        <Button variant="primary" onClick={handleSave} disabled={isSaving || !selectedClassId || enrolledStudents.length === 0}>
                            {isSaving ? 'Đang lưu...' : 'Lưu tất cả'}
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
