import React, { useState, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Class, Student, ProgressReport, CenterSettings } from '../../types';
import { useToast } from '../../hooks/useToast';
import * as api from '../../services/api';
import { aggregateStudentScores, generateAutoComment, ScoreHistory } from '../../utils/autoComment';

interface SendScoresModalProps {
    isOpen: boolean;
    onClose: () => void;
    classes: Class[];
    students: Student[];
    progressReports: ProgressReport[];
    settings: CenterSettings;
    preselectedClassId?: string;
}

interface StudentScoreSummary {
    studentId: string;
    studentName: string;
    parentName: string;
    parentPhone: string;
    scores: number[];
    avgScore: string;
    comments: string[];
    autoComment: string;
    examNames: string[];
    ready: boolean;
    reason?: string;
    selected: boolean;
}

type SendMode = 'individual' | 'group';
type ModalStep = 'config' | 'preview' | 'sending' | 'results';

export const SendScoresModal: React.FC<SendScoresModalProps> = ({
    isOpen, onClose, classes, students, progressReports, settings, preselectedClassId
}) => {
    const { toast } = useToast();
    
    // Step state
    const [step, setStep] = useState<ModalStep>('config');
    
    // Config
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [selectedClassId, setSelectedClassId] = useState(preselectedClassId || '');
    const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
    const [selectedExamName, setSelectedExamName] = useState<string>('');
    const [sendMode, setSendMode] = useState<SendMode>('individual');
    
    // Selection state
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    
    // Preview message state
    const [previewStudentId, setPreviewStudentId] = useState<string | null>(null);
    
    // Sending state
    const [isSending, setIsSending] = useState(false);
    const [sendResults, setSendResults] = useState<any[]>([]);
    const [sendSummary, setSendSummary] = useState<any>(null);
    const [sendMessage, setSendMessage] = useState('');

    // Reset state when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setStep('config');
            setSendResults([]);
            setSendSummary(null);
            setSendMessage('');
            setIsSending(false);
            setSelectedExamName('');
            setSelectedStudentIds(new Set());
            setPreviewStudentId(null);
            if (preselectedClassId) {
                setSelectedClassId(preselectedClassId);
            }
        }
    }, [isOpen, preselectedClassId]);

    // Generate last 12 months for dropdown
    const monthOptions = useMemo(() => {
        const options: { value: string; label: string }[] = [];
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
            options.push({ value, label });
        }
        return options;
    }, []);

    // Selected class info
    const selectedClass = useMemo(() => classes.find(c => c.id === selectedClassId), [classes, selectedClassId]);

    // Check if SLL channel is active (for group send)
    const isSLLChannel = settings.zaloChannel === 'sll' || !settings.zaloChannel;

    // Available exam names for selected class + month
    const availableExamNames = useMemo<string[]>(() => {
        if (!selectedClassId || !selectedMonth) return [];
        const names = new Set<string>();
        for (const r of progressReports) {
            if (r.classId === selectedClassId && r.date?.startsWith(selectedMonth) && r.examName) {
                names.add(r.examName);
            }
        }
        return Array.from(names).sort();
    }, [selectedClassId, selectedMonth, progressReports]);

    // Build student score summaries for preview
    const scoreSummaries = useMemo<StudentScoreSummary[]>(() => {
        if (!selectedClassId || !selectedMonth) return [];
        
        const cls = classes.find(c => c.id === selectedClassId);
        if (!cls) return [];
        
        // Filter reports for this class + month + optional exam name
        const monthReports = progressReports.filter(r => 
            r.classId === selectedClassId && r.date && r.date.startsWith(selectedMonth)
            && (!selectedExamName || r.examName === selectedExamName)
        );
        
        // Group by student
        const studentMap: Record<string, { score: number | null; comments: string; examName?: string }[]> = {};
        for (const r of monthReports) {
            if (!studentMap[r.studentId]) {
                studentMap[r.studentId] = [];
            }
            studentMap[r.studentId].push({ score: r.score, comments: r.comments, examName: r.examName });
        }
        
        // Build summaries for enrolled students who have scores
        return cls.studentIds
            .map(sid => {
                const student = students.find(s => s.id === sid);
                if (!student) return null;
                
                const reports = studentMap[sid];
                if (!reports) return null; // No scores for this student
                
                // Use DRY helper
                const agg = aggregateStudentScores(reports);
                
                const phone = student.parentPhone || student.phone || '';
                // SLL needs phone, OA needs zaloUserId
                const ready = isSLLChannel ? !!phone : !!(student as any).zaloUserId;
                
                // Collect exam names
                const examNames = [...new Set(reports.map(r => r.examName).filter(Boolean) as string[])];
                
                // Generate auto-comment using history
                let autoComment = '';
                if (agg.scores.length > 0) {
                    const prevMonthReports: Record<string, number[]> = {};
                    for (const r of progressReports) {
                        if (r.studentId === sid && r.classId === selectedClassId && r.date && r.score != null) {
                            const m = r.date.substring(0, 7);
                            if (m < selectedMonth) {  // Only past months
                                if (!prevMonthReports[m]) prevMonthReports[m] = [];
                                prevMonthReports[m].push(r.score);
                            }
                        }
                    }
                    const history: ScoreHistory[] = Object.entries(prevMonthReports).map(([month, scores]) => ({
                        month,
                        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
                    }));
                    autoComment = generateAutoComment(agg.scores, history).comment;
                }
                
                return {
                    studentId: sid,
                    studentName: student.name,
                    parentName: student.parentName || '',
                    parentPhone: phone,
                    scores: agg.scores,
                    avgScore: agg.avgScore,
                    comments: agg.comments,
                    autoComment,
                    examNames,
                    ready,
                    reason: !phone ? 'Chưa có SĐT phụ huynh' : undefined,
                    selected: ready, // Default: select ready students
                } as StudentScoreSummary;
            })
            .filter(Boolean) as StudentScoreSummary[];
    }, [selectedClassId, selectedMonth, selectedExamName, classes, students, progressReports]);

    // Auto-select ready students when summaries change
    React.useEffect(() => {
        const readyIds = new Set(scoreSummaries.filter(s => s.ready).map(s => s.studentId));
        setSelectedStudentIds(readyIds);
    }, [scoreSummaries]);

    const readyCount = scoreSummaries.filter(s => s.ready).length;
    const selectedCount = scoreSummaries.filter(s => selectedStudentIds.has(s.studentId) && s.ready).length;
    const notReadyCount = scoreSummaries.filter(s => !s.ready).length;

    // Toggle student selection
    const toggleStudent = (studentId: string) => {
        setSelectedStudentIds(prev => {
            const next = new Set(prev);
            if (next.has(studentId)) {
                next.delete(studentId);
            } else {
                next.add(studentId);
            }
            return next;
        });
    };

    const toggleAll = () => {
        const readyStudentIds = scoreSummaries.filter(s => s.ready).map(s => s.studentId);
        if (selectedCount === readyCount) {
            // Deselect all
            setSelectedStudentIds(new Set());
        } else {
            // Select all ready
            setSelectedStudentIds(new Set(readyStudentIds));
        }
    };

    // Group send preview text
    const groupPreviewText = useMemo(() => {
        if (sendMode !== 'group' || scoreSummaries.length === 0) return '';
        
        const allAvgs = scoreSummaries
            .filter(s => s.avgScore !== 'N/A')
            .map(s => parseFloat(s.avgScore));
        
        const totalStudents = scoreSummaries.length;
        const classAvg = allAvgs.length > 0
            ? (allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length).toFixed(1)
            : 'N/A';
        const excellent = allAvgs.filter(s => s >= 8.0).length;
        const good = allAvgs.filter(s => s >= 6.5 && s < 8.0).length;
        const avg = allAvgs.filter(s => s >= 4.0 && s < 6.5).length;
        const weak = allAvgs.filter(s => s < 4.0).length;

        const [mYear, mMonth] = selectedMonth.split('-');
        const examLabel = selectedExamName ? ` - ${selectedExamName}` : '';
        
        return `📝 TỔNG KẾT${examLabel} THÁNG ${mMonth}/${mYear} - ${selectedClass?.name || ''}\n\n` +
            `Tổng số HS được đánh giá: ${totalStudents}\n` +
            `📊 Phổ điểm: Giỏi (≥8): ${excellent} | Khá (6.5-7.9): ${good} | TB (4-6.4): ${avg} | Yếu (<4): ${weak}\n` +
            `🎯 ĐTB lớp: ${classAvg === 'N/A' ? 'Chưa có' : classAvg + '/10'}\n\n` +
            `Vui lòng liên hệ trung tâm để nhận chi tiết điểm từng con ạ.\n` +
            `${settings.name || 'Trung tâm'}`;
    }, [sendMode, scoreSummaries, selectedMonth, selectedExamName, selectedClass, settings.name]);

    // Preview message for a specific student
    const getPreviewMessage = (summary: StudentScoreSummary): string => {
        const template = settings.messageTemplates?.scoreReport || 
            '📝 BÁO CÁO HỌC TẬP THÁNG {month}\n\nAnh/Chị phụ huynh {parentName} thân mến,\n{centerName} xin gửi kết quả học tập của con {studentName} tại lớp {className}:\n\n📊 Điểm trung bình: {avgScore}\n📋 Chi tiết: {scoreList}\n📝 Đánh giá: {autoComment}\n\nAnh/Chị vui lòng theo dõi và phối hợp cùng trung tâm giúp con tiến bộ hơn.\nTrân trọng cảm ơn!';
        
        const [mYear, mMonth] = selectedMonth.split('-');
        const monthDisplay = `${mMonth}/${mYear}`;
        const examLabel = selectedExamName || summary.examNames.join(', ') || '';

        const agg = aggregateStudentScores(
            summary.scores.map((s, i) => ({ score: s, comments: summary.comments[i] || '' }))
        );

        // {comments} = nhận xét GV nhập tay, {autoComment} = đánh giá AI — KHÔNG trùng
        const finalComment = summary.comments.length > 0 
            ? summary.comments.join('; ')
            : '';

        return template
            .replace(/{parentName}/g, summary.parentName || 'Phụ huynh')
            .replace(/{studentName}/g, summary.studentName)
            .replace(/{className}/g, selectedClass?.name || '')
            .replace(/{centerName}/g, settings.name || 'Trung tâm')
            .replace(/{month}/g, monthDisplay)
            .replace(/{avgScore}/g, summary.avgScore === 'N/A' ? 'Chưa có điểm số' : `${summary.avgScore}/10`)
            .replace(/{scoreList}/g, agg.scoreList)
            .replace(/{comments}/g, finalComment)
            .replace(/{autoComment}/g, summary.autoComment)
            .replace(/{examName}/g, examLabel)
            .replace(/{date}/g, new Date().toLocaleDateString('vi-VN'));
    };

    const handleSend = async () => {
        if (!selectedClassId || !selectedMonth) {
            toast.error('Vui lòng chọn lớp và tháng.');
            return;
        }
        
        if (scoreSummaries.length === 0) {
            toast.error('Không có điểm nào trong tháng đã chọn.');
            return;
        }

        if (sendMode === 'individual' && selectedCount === 0) {
            toast.error('Vui lòng chọn ít nhất 1 học sinh để gửi.');
            return;
        }
        
        setStep('sending');
        setIsSending(true);
        const selectedIds = Array.from(selectedStudentIds);
        
        try {
            let result: any;
            
            if (sendMode === 'group') {
                result = await api.sendGroupMonthlyScores(selectedClassId, selectedMonth, selectedExamName || undefined);
                if (result.success) {
                    setSendMessage(result.message || 'Đã gửi bảng điểm vào nhóm!');
                    setSendResults([]);
                    setSendSummary({ sent: 1, failed: 0, skipped: 0, total: 1 });
                } else {
                    toast.error(result.error || 'Lỗi gửi bảng điểm nhóm');
                    setSendMessage(result.error || 'Lỗi');
                    setSendSummary({ sent: 0, failed: 1, skipped: 0, total: 1 });
                }
            } else {
                result = await api.sendMonthlyScores(
                    selectedClassId, 
                    selectedMonth, 
                    selectedExamName || undefined,
                    selectedIds
                );
                if (result.success) {
                    setSendResults(result.results || []);
                    setSendSummary(result.summary || {});
                    setSendMessage(result.message || '');
                } else {
                    toast.error(result.error || 'Lỗi gửi điểm');
                    setSendMessage(result.error || 'Lỗi');
                    setSendSummary({ sent: 0, failed: 0, skipped: 0, total: 0 });
                }
            }
            
            setStep('results');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Lỗi khi gửi điểm';
            toast.error(message);
            setSendMessage(message);
            setStep('results');
        } finally {
            setIsSending(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'sent': return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">✅ Đã gửi</span>;
            case 'failed': return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">❌ Thất bại</span>;
            case 'skipped': return <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">⏭️ Bỏ qua</span>;
            default: return null;
        }
    };

    const handleClose = () => {
        if (isSending) return;
        onClose();
    };

    const [mYear, mMonth] = selectedMonth.split('-');
    const monthLabel = `${mMonth}/${mYear}`;

    // Can send to group: requires SLL channel AND group ID
    const canSendGroup = isSLLChannel && !!selectedClass?.zaloGroupId;
    const groupDisabledReason = !isSLLChannel 
        ? 'Gửi nhóm chỉ hỗ trợ kênh SLL (Sổ Liên Lạc)' 
        : !selectedClass?.zaloGroupId 
            ? 'Chưa gán nhóm Zalo cho lớp' 
            : '';

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="📤 Gửi Điểm Qua Sổ Liên Lạc">
            <div className="space-y-4">
                {/* Step 1: Config */}
                {step === 'config' && (
                    <>
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
                                <label className="block text-sm font-medium mb-1">Tháng</label>
                                <select
                                    value={selectedMonth}
                                    onChange={e => setSelectedMonth(e.target.value)}
                                    className="form-select w-full"
                                >
                                    {monthOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium mb-1">Đợt thi</label>
                                <select
                                    value={selectedExamName}
                                    onChange={e => setSelectedExamName(e.target.value)}
                                    className="form-select w-full"
                                >
                                    <option value="">Tất cả đợt thi</option>
                                    {availableExamNames.map(name => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Phương thức gửi</label>
                            <div className="flex gap-4">
                                <label className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg border-2 transition-colors flex-1 text-sm
                                    ${sendMode === 'individual' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                                    <input type="radio" name="sendMode" value="individual" checked={sendMode === 'individual'} onChange={() => setSendMode('individual')} className="text-blue-500" />
                                    <div>
                                        <div className="font-medium">👤 Cá nhân</div>
                                        <div className="text-xs text-gray-500">Gửi riêng cho từng phụ huynh</div>
                                    </div>
                                </label>
                                <label className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg border-2 transition-colors flex-1 text-sm
                                    ${sendMode === 'group' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}
                                    ${!canSendGroup ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    title={groupDisabledReason}
                                >
                                    <input type="radio" name="sendMode" value="group" checked={sendMode === 'group'} onChange={() => setSendMode('group')} disabled={!canSendGroup} className="text-blue-500" />
                                    <div>
                                        <div className="font-medium">👥 Nhóm lớp</div>
                                        <div className="text-xs text-gray-500">
                                            {groupDisabledReason || 'Gửi phổ điểm tổng quan vào nhóm Zalo'}
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {selectedClassId && scoreSummaries.length === 0 && (
                            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-md text-sm">
                                ⚠️ Chưa có điểm nào {selectedExamName ? `đợt "${selectedExamName}"` : ''} trong tháng {monthLabel} cho lớp {selectedClass?.name || ''}. Hãy nhập điểm trước.
                            </div>
                        )}

                        {scoreSummaries.length > 0 && (
                            <div className="flex justify-end">
                                <Button 
                                    onClick={() => setStep('preview')}
                                    disabled={!selectedClassId || scoreSummaries.length === 0}
                                >
                                    Xem trước → ({scoreSummaries.length} HS có điểm)
                                </Button>
                            </div>
                        )}
                    </>
                )}

                {/* Step 2: Preview */}
                {step === 'preview' && (
                    <>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-lg">{selectedClass?.name} — Tháng {monthLabel}{selectedExamName ? ` — ${selectedExamName}` : ''}</h3>
                                <p className="text-sm text-gray-500">
                                    {sendMode === 'individual' ? '👤 Gửi cá nhân' : '👥 Gửi phổ điểm vào nhóm lớp'} 
                                    {sendMode === 'individual' && <> · <span className="text-green-600">{selectedCount}/{readyCount} đã chọn</span>{notReadyCount > 0 && <>, <span className="text-amber-600">{notReadyCount} thiếu SĐT</span></>}</>}
                                </p>
                            </div>
                            <Button variant="secondary" onClick={() => { setStep('config'); setPreviewStudentId(null); }}>← Quay lại</Button>
                        </div>

                        {sendMode === 'individual' && !previewStudentId && (
                            <>
                                <div className="flex items-center gap-2 mb-2">
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedCount === readyCount && readyCount > 0}
                                            onChange={toggleAll}
                                            className="rounded text-blue-500"
                                        />
                                        <span className="font-medium">Chọn tất cả ({readyCount})</span>
                                    </label>
                                </div>
                                <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden overflow-x-auto max-h-[400px] overflow-y-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0">
                                            <tr>
                                                <th className="py-2 px-3 w-10"></th>
                                                <th className="py-2 px-3 font-semibold">Học viên</th>
                                                <th className="py-2 px-3 font-semibold">PH / SĐT</th>
                                                <th className="py-2 px-3 font-semibold text-center">ĐTB</th>
                                                {availableExamNames.length > 0 && <th className="py-2 px-3 font-semibold">Đợt thi</th>}
                                                <th className="py-2 px-3 font-semibold">Nhận xét</th>
                                                <th className="py-2 px-3 font-semibold text-center">Xem</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                            {scoreSummaries.map(s => (
                                                <tr key={s.studentId} className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${!s.ready ? 'opacity-60' : ''}`}>
                                                    <td className="py-2 px-3">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedStudentIds.has(s.studentId)}
                                                            onChange={() => toggleStudent(s.studentId)}
                                                            disabled={!s.ready}
                                                            className="rounded text-blue-500"
                                                        />
                                                    </td>
                                                    <td className="py-2 px-3 font-medium whitespace-nowrap">{s.studentName}</td>
                                                    <td className="py-2 px-3 text-gray-500 text-xs">
                                                        <div>{s.parentName || '—'}</div>
                                                        <div>{s.parentPhone || '—'}</div>
                                                    </td>
                                                    <td className="py-2 px-3 text-center font-bold text-blue-600 dark:text-blue-400">{s.avgScore}</td>
                                                    {availableExamNames.length > 0 && (
                                                        <td className="py-2 px-3 text-xs">
                                                            {s.examNames.length > 0 
                                                                ? s.examNames.map(n => (
                                                                    <span key={n} className="inline-block bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded mr-1 mb-0.5">{n}</span>
                                                                ))
                                                                : <span className="text-gray-400">—</span>
                                                            }
                                                        </td>
                                                    )}
                                                    <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400 max-w-[200px]">
                                                        {s.comments.length > 0 
                                                            ? <span>{s.comments.join('; ').substring(0, 60)}{s.comments.join('; ').length > 60 ? '...' : ''}</span>
                                                            : <span className="italic text-purple-500" title="Nhận xét tự động">🤖 {s.autoComment.substring(0, 40)}...</span>
                                                        }
                                                    </td>
                                                    <td className="py-2 px-3 text-center">
                                                        {s.ready ? (
                                                            <button 
                                                                onClick={() => setPreviewStudentId(s.studentId)}
                                                                className="text-blue-500 hover:text-blue-700 text-xs underline"
                                                            >
                                                                👁️
                                                            </button>
                                                        ) : (
                                                            <span className="text-xs text-amber-600" title={s.reason}>⚠️</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        {/* Message Preview for specific student */}
                        {sendMode === 'individual' && previewStudentId && (() => {
                            const previewStudent = scoreSummaries.find(s => s.studentId === previewStudentId);
                            if (!previewStudent) return null;
                            return (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-medium">📱 Tin nhắn gửi cho PH: <span className="text-blue-600">{previewStudent.parentName || previewStudent.studentName}</span></h4>
                                        <button onClick={() => setPreviewStudentId(null)} className="text-sm text-gray-500 hover:text-gray-700">← Danh sách</button>
                                    </div>
                                    <textarea
                                        readOnly
                                        value={getPreviewMessage(previewStudent)}
                                        className="form-input w-full text-sm font-mono bg-gray-50 dark:bg-gray-900"
                                        rows={10}
                                    />
                                    <p className="text-xs text-gray-400">SĐT: {previewStudent.parentPhone} · ĐTB: {previewStudent.avgScore}</p>
                                </div>
                            );
                        })()}

                        {sendMode === 'group' && (
                            <div className="space-y-2">
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
                                    <p className="font-medium mb-1">📋 Nội dung sẽ gửi vào nhóm Zalo (chỉ phổ điểm, không lộ tên cá nhân)</p>
                                    <p className="text-xs text-gray-500">Nhóm: <code className="bg-white dark:bg-black/30 px-1 rounded">{selectedClass?.zaloGroupId}</code></p>
                                </div>
                                <textarea
                                    readOnly
                                    value={groupPreviewText}
                                    className="form-input w-full text-sm font-mono bg-gray-50 dark:bg-gray-900"
                                    rows={8}
                                />
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2 border-t dark:border-gray-700">
                            <Button variant="secondary" onClick={handleClose}>Hủy</Button>
                            <Button 
                                onClick={handleSend}
                                disabled={isSending || (sendMode === 'individual' && selectedCount === 0)}
                            >
                                📤 {sendMode === 'individual' ? `Gửi cho ${selectedCount} phụ huynh` : 'Gửi phổ điểm vào nhóm'}
                            </Button>
                        </div>
                    </>
                )}

                {/* Step 3: Sending */}
                {step === 'sending' && (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
                        <p className="font-medium">Đang gửi điểm...</p>
                        <p className="text-sm text-gray-500">
                            {sendMode === 'individual' 
                                ? `Gửi cho ${selectedCount} phụ huynh (mỗi tin cách nhau 5 giây)`
                                : 'Đang gửi phổ điểm vào nhóm...'
                            }
                        </p>
                        <p className="text-xs text-gray-400">Vui lòng không đóng cửa sổ này</p>
                    </div>
                )}

                {/* Step 4: Results */}
                {step === 'results' && (
                    <>
                        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                            <h3 className="font-semibold text-lg mb-2">📊 Kết quả gửi điểm</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{sendMessage}</p>
                            {sendSummary && (
                                <div className="flex gap-4 mt-3 text-sm">
                                    <span className="text-green-600 font-medium">✅ Đã gửi: {sendSummary.sent}</span>
                                    {sendSummary.failed > 0 && <span className="text-red-600 font-medium">❌ Thất bại: {sendSummary.failed}</span>}
                                    {sendSummary.skipped > 0 && <span className="text-amber-600 font-medium">⏭️ Bỏ qua: {sendSummary.skipped}</span>}
                                </div>
                            )}
                        </div>

                        {sendResults.length > 0 && (
                            <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden overflow-x-auto max-h-[300px] overflow-y-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0">
                                        <tr>
                                            <th className="py-2 px-3 font-semibold">Học viên</th>
                                            <th className="py-2 px-3 font-semibold">ĐTB</th>
                                            <th className="py-2 px-3 font-semibold">Trạng thái</th>
                                            <th className="py-2 px-3 font-semibold">Chi tiết</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {sendResults.map((r: any, i: number) => (
                                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                                <td className="py-2 px-3 font-medium whitespace-nowrap">{r.studentName}</td>
                                                <td className="py-2 px-3 text-blue-600 font-bold">{r.avgScore || '—'}</td>
                                                <td className="py-2 px-3">{getStatusBadge(r.status)}</td>
                                                <td className="py-2 px-3 text-xs text-gray-500">{r.reason || ''}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2 border-t dark:border-gray-700">
                            <Button variant="secondary" onClick={handleClose}>Đóng</Button>
                            {sendSummary?.failed > 0 && (
                                <Button onClick={() => { setStep('preview'); setSendResults([]); }}>🔄 Thử lại</Button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};
