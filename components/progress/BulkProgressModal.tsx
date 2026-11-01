import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Class, Student, ProgressReport } from '../../types';
import { formatVietnamDate } from '../../utils/date';
import { useToast } from '../../hooks/useToast';
import { ExportButton } from '../common/ExportButton';
import { generateAutoComment, ScoreHistory } from '../../utils/autoComment';

interface BulkProgressModalProps {
    isOpen: boolean;
    onClose: () => void;
    classes: Class[];
    students: Student[];
    onSave: (reports: Omit<ProgressReport, 'id'>[]) => Promise<void>;
    onUpdate?: (data: ProgressReport) => Promise<void>;
    currentUserId: string;
    progressReports?: ProgressReport[]; // For auto-comment history lookup
    initialDate?: string;     // Pre-fill date when editing a specific batch
    initialExamName?: string; // Pre-fill exam name when editing a specific batch
}

interface StudentGrade {
    studentId: string;
    studentName: string;
    score: string;
    comments: string;
    existingReportId?: string; // If editing existing report
}

export const BulkProgressModal: React.FC<BulkProgressModalProps> = ({ isOpen, onClose, classes, students, onSave, onUpdate, currentUserId, progressReports, initialDate, initialExamName }) => {
    const today = new Date().toISOString().split('T')[0];
    const [date, setDate] = useState<string>(initialDate || today);
    const [selectedClassId, setSelectedClassId] = useState<string>(classes.length > 0 ? classes[0].id : '');
    const [examName, setExamName] = useState<string>(initialExamName || '');
    const [grades, setGrades] = useState<Record<string, StudentGrade>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const { toast } = useToast();
    const autoLoadDoneRef = React.useRef(false);

    const examSuggestions = ['Khảo sát', 'Giữa kỳ', 'Cuối kỳ', 'Kiểm tra thường xuyên', 'Thi thử'];

    // Reset grades when class changes (user switches class dropdown)
    useEffect(() => {
        if (selectedClassId) {
            setGrades({});
            setIsEditMode(false);
            autoLoadDoneRef.current = false;
        }
    }, [selectedClassId]);

    const enrolledStudents = useMemo(() => {
        if (!selectedClassId) return [];
        const selectedClass = classes.find(c => c.id === selectedClassId);
        if (!selectedClass) return [];
        
        return students
            .filter(s => selectedClass.studentIds.includes(s.id))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [selectedClassId, classes, students]);

    // Initialize grades and auto-load existing scores
    useEffect(() => {
        if (enrolledStudents.length === 0) return;
        if (Object.keys(grades).length > 0) return; // Already initialized
        
        const existingReports = (progressReports || []).filter(r => 
            r.classId === selectedClassId && 
            r.date === date &&
            (examName.trim() ? r.examName === examName.trim() : !r.examName)
        );
        
        const initialGrades: Record<string, StudentGrade> = {};
        let hasExisting = false;
        enrolledStudents.forEach(s => {
            const existing = existingReports.find(r => r.studentId === s.id);
            if (existing) {
                hasExisting = true;
                initialGrades[s.id] = {
                    studentId: s.id,
                    studentName: s.name,
                    score: existing.score != null ? String(existing.score) : '',
                    comments: existing.comments || '',
                    existingReportId: existing.id,
                };
            } else {
                initialGrades[s.id] = {
                    studentId: s.id,
                    studentName: s.name,
                    score: '',
                    comments: '',
                };
            }
        });
        setIsEditMode(hasExisting);
        setGrades(initialGrades);
        
        // Show toast when auto-loading from "Sửa đợt này"
        if (hasExisting && initialDate && !autoLoadDoneRef.current) {
            autoLoadDoneRef.current = true;
            toast.success(`Đã tải ${existingReports.length} bản ghi có sẵn. Sửa và bấm Lưu để cập nhật.`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const handleAutoComment = () => {
        if (!selectedClassId) return;
        
        const updatedGrades = { ...grades };
        let count = 0;
        
        for (const s of enrolledStudents) {
            const grade = updatedGrades[s.id];
            if (!grade) continue;
            
            const scoreVal = parseFloat(grade.score);
            if (isNaN(scoreVal)) continue;
            
            // Build history from the most recent previous entry
            const history: ScoreHistory[] = [];
            if (progressReports) {
                const prevReports = progressReports
                    .filter(r => r.studentId === s.id && r.classId === selectedClassId && r.date && r.score != null && r.date < date)
                    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                
                if (prevReports.length > 0) {
                    const latestDate = prevReports[0].date!;
                    const latestScores = prevReports.filter(r => r.date === latestDate).map(r => r.score!);
                    history.push({
                        month: latestDate,
                        avgScore: latestScores.reduce((a, b) => a + b, 0) / latestScores.length,
                    });
                }
            }
            
            const result = generateAutoComment([scoreVal], history);
            // Only auto-fill if no manual comment exists (don't overwrite teacher's work)
            if (!grade.comments || !grade.comments.trim()) {
                updatedGrades[s.id] = {
                    ...grade,
                    comments: result.comment,
                };
                count++;
            }
        }
        
        setGrades(updatedGrades);
        if (count > 0) {
            toast.success(`Đã tạo nhận xét tự động cho ${count} học sinh.`);
        } else {
            toast.error('Chưa có học sinh nào có điểm để tạo nhận xét.');
        }
    };

    // Re-load existing grades when date or examName changes manually
    const loadExistingGrades = () => {
        if (!selectedClassId || enrolledStudents.length === 0) return;
        
        const existingReports = (progressReports || []).filter(r => 
            r.classId === selectedClassId && 
            r.date === date &&
            (examName.trim() ? r.examName === examName.trim() : !r.examName)
        );
        
        const newGrades: Record<string, StudentGrade> = {};
        let hasExisting = false;
        enrolledStudents.forEach(s => {
            const existing = existingReports.find(r => r.studentId === s.id);
            if (existing) {
                hasExisting = true;
                newGrades[s.id] = {
                    studentId: s.id,
                    studentName: s.name,
                    score: existing.score != null ? String(existing.score) : '',
                    comments: existing.comments || '',
                    existingReportId: existing.id,
                };
            } else {
                newGrades[s.id] = {
                    studentId: s.id,
                    studentName: s.name,
                    score: '',
                    comments: '',
                };
            }
        });
        setIsEditMode(hasExisting);
        setGrades(newGrades);
        if (hasExisting) {
            toast.success(`Đã tải ${existingReports.length} bản ghi có sẵn. Sửa và bấm Lưu để cập nhật.`);
        }
    };

    const handleSave = async () => {
        if (!selectedClassId) {
            toast.error('Vui lòng chọn lớp học.');
            return;
        }

        const reportsToAdd: Omit<ProgressReport, 'id'>[] = [];
        const reportsToUpdate: ProgressReport[] = [];
        
        for (const s of enrolledStudents) {
            const grade = grades[s.id];
            if (grade) {
                const hasScore = grade.score.trim() !== '';
                const hasComment = grade.comments.trim() !== '';
                
                // For new reports: need at least score or comment. For existing: always allow update (even clearing)
                if (hasScore || hasComment || grade.existingReportId) {
                    let numScore: number | null = null;
                    if (hasScore) {
                        numScore = parseFloat(grade.score);
                        if (isNaN(numScore) || numScore < 0 || numScore > 10) {
                            toast.error(`Điểm của học sinh ${s.name} không hợp lệ (từ 0 đến 10).`);
                            return;
                        }
                    }
                    
                    if (grade.existingReportId && onUpdate) {
                        // Update existing report — need full object
                        reportsToUpdate.push({
                            id: grade.existingReportId,
                            classId: selectedClassId,
                            studentId: s.id,
                            date: date,
                            score: numScore,
                            comments: grade.comments.trim(),
                            createdBy: currentUserId,
                            examName: examName.trim() || undefined,
                        });
                    } else {
                        // Add new report
                        reportsToAdd.push({
                            classId: selectedClassId,
                            studentId: s.id,
                            date: date,
                            score: numScore,
                            comments: grade.comments.trim(),
                            createdBy: currentUserId,
                            examName: examName.trim() || undefined,
                        });
                    }
                }
            }
        }

        const totalCount = reportsToAdd.length + reportsToUpdate.length;
        if (totalCount === 0) {
            toast.error('Chưa có học sinh nào được nhập điểm hợp lệ.');
            return;
        }

        setIsSaving(true);
        try {
            // Update existing reports
            for (const report of reportsToUpdate) {
                await onUpdate!(report);
            }
            // Add new reports
            if (reportsToAdd.length > 0) {
                await onSave(reportsToAdd);
            }
            
            const msgs: string[] = [];
            if (reportsToUpdate.length > 0) msgs.push(`cập nhật ${reportsToUpdate.length}`);
            if (reportsToAdd.length > 0) msgs.push(`thêm mới ${reportsToAdd.length}`);
            toast.success(`Đã ${msgs.join(', ')} báo cáo tiến độ.`);
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
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">Đợt thi / Loại KT</label>
                        <input 
                            type="text"
                            list="exam-suggestions"
                            value={examName}
                            onChange={e => setExamName(e.target.value)}
                            className="form-input w-full"
                            placeholder="VD: Khảo sát, Giữa kỳ..."
                        />
                        <datalist id="exam-suggestions">
                            {examSuggestions.map(s => (
                                <option key={s} value={s} />
                            ))}
                        </datalist>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="secondary" onClick={loadExistingGrades} disabled={!selectedClassId || enrolledStudents.length === 0} className="text-sm">
                        🔄 Tải điểm đã nhập
                    </Button>
                    {isEditMode && (
                        <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                            ✏️ Chế độ sửa điểm — thay đổi sẽ cập nhật bản ghi cũ
                        </span>
                    )}
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
                        <Button 
                            variant="secondary" 
                            onClick={handleAutoComment} 
                            disabled={isSaving || !selectedClassId || enrolledStudents.length === 0}
                            title="Tự động sinh nhận xét dựa trên điểm số và lịch sử"
                        >
                            🤖 Nhận xét tự động
                        </Button>
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
