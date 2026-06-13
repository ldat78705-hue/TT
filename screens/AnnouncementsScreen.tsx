import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../hooks/useDataContext';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { ICONS } from '../constants';
import { Announcement, UserRole, ProgressReport, AnnouncementTarget } from '../types';
import { ConfirmationModal } from '../components/common/ConfirmationModal';

import { getVietnamTime, formatVietnamDate } from '../utils/date';

import { BulkProgressModal } from '../components/progress/BulkProgressModal';

const AnnouncementForm: React.FC<{
    onSubmit: (data: { title: string; content: string; targetAudience: AnnouncementTarget; classId?: string; targetStudentIds?: string[]; scheduledFor?: string }) => void;
    onCancel: () => void;
}> = ({ onSubmit, onCancel }) => {
    const { state } = useData();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [targetAudience, setTargetAudience] = useState<AnnouncementTarget>('ALL');
    const [classId, setClassId] = useState('');
    const [targetStudentIds, setTargetStudentIds] = useState<string[]>([]);
    const [scheduledFor, setScheduledFor] = useState('');
    const titleInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        titleInputRef.current?.focus();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ 
            title, 
            content, 
            targetAudience, 
            classId: (targetAudience === 'CLASS' || targetAudience === 'SPECIFIC_STUDENTS') ? classId : undefined, 
            targetStudentIds: targetAudience === 'SPECIFIC_STUDENTS' ? targetStudentIds : undefined, 
            scheduledFor: scheduledFor || undefined 
        });
    };

    const selectedClass = state.classes.find(c => c.id === classId);
    const studentsInClass = selectedClass ? state.students.filter(s => selectedClass.studentIds.includes(s.id)) : [];

    const handleStudentToggle = (id: string) => {
        setTargetStudentIds(prev => 
            prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
        );
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium">Tiêu đề</label>
                <input
                    ref={titleInputRef}
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="form-input mt-1"
                    required
                />
            </div>
            <div>
                <label className="block text-sm font-medium">Đối tượng nhận thông báo</label>
                <select
                    value={targetAudience}
                    onChange={(e) => {
                        setTargetAudience(e.target.value as AnnouncementTarget);
                        if (e.target.value !== 'CLASS' && e.target.value !== 'SPECIFIC_STUDENTS') {
                            setClassId('');
                            setTargetStudentIds([]);
                        }
                    }}
                    className="form-select mt-1"
                >
                    <option value="ALL">Tất cả mọi người</option>
                    <option value="TEACHERS">Tất cả Giáo viên</option>
                    <option value="STUDENTS">Tất cả Học viên</option>
                    <option value="CLASS">Một lớp học cụ thể</option>
                    <option value="SPECIFIC_STUDENTS">Một số học viên trong lớp</option>
                </select>
            </div>

            {(targetAudience === 'CLASS' || targetAudience === 'SPECIFIC_STUDENTS') && (
                <div>
                    <label className="block text-sm font-medium">Chọn lớp học</label>
                    <select
                        value={classId}
                        onChange={(e) => {
                            setClassId(e.target.value);
                            setTargetStudentIds([]);
                        }}
                        className="form-select mt-1"
                        required
                    >
                        <option value="">-- Chọn lớp học --</option>
                        {state.classes.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {targetAudience === 'SPECIFIC_STUDENTS' && classId && (
                <div>
                    <label className="block text-sm font-medium mb-2">Chọn học viên</label>
                    <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2 dark:border-gray-700">
                        {studentsInClass.map(student => (
                            <label key={student.id} className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={targetStudentIds.includes(student.id)}
                                    onChange={() => handleStudentToggle(student.id)}
                                    className="form-checkbox text-blue-600"
                                />
                                <span>{student.name}</span>
                            </label>
                        ))}
                        {studentsInClass.length === 0 && (
                            <p className="text-sm text-gray-500">Lớp học này chưa có học viên.</p>
                        )}
                    </div>
                </div>
            )}

            <div>
                <label className="block text-sm font-medium">Thời gian hiển thị (Không bắt buộc)</label>
                <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    className="form-input mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Nếu để trống, thông báo sẽ hiển thị ngay lập tức.</p>
            </div>

            <div>
                <label className="block text-sm font-medium">Nội dung</label>
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={6}
                    className="form-textarea mt-1"
                    required
                />
            </div>
            <div className="flex justify-end space-x-4 pt-4 border-t dark:border-gray-700">
                <Button type="button" variant="secondary" onClick={onCancel}>Hủy</Button>
                <Button type="submit">Đăng Thông báo</Button>
            </div>
        </form>
    );
};

const ProgressReportForm: React.FC<{
    onSubmit: (data: Omit<ProgressReport, 'id' | 'createdBy'>) => void;
    onCancel: () => void;
    initialData?: ProgressReport;
}> = ({ onSubmit, onCancel, initialData }) => {
    const { state } = useData();
    const [classId, setClassId] = useState(initialData?.classId || '');
    const [studentId, setStudentId] = useState(initialData?.studentId || '');
    const [date, setDate] = useState(initialData?.date || getVietnamTime().split('T')[0]);
    const [score, setScore] = useState(initialData?.score?.toString() || '');
    const [comments, setComments] = useState(initialData?.comments || '');

    const selectedClass = state.classes.find(c => c.id === classId);
    const studentsInClass = selectedClass ? state.students.filter(s => selectedClass.studentIds.includes(s.id)) : [];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            classId,
            studentId,
            date,
            score: parseFloat(score),
            comments
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium">Lớp học</label>
                <select
                    value={classId}
                    onChange={(e) => { setClassId(e.target.value); setStudentId(''); }}
                    className="form-select mt-1"
                    required
                >
                    <option value="">-- Chọn lớp học --</option>
                    {state.classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium">Học viên</label>
                <select
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="form-select mt-1"
                    required
                    disabled={!classId}
                >
                    <option value="">-- Chọn học viên --</option>
                    {studentsInClass.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium">Ngày đánh giá</label>
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="form-input mt-1"
                    required
                />
            </div>
            <div>
                <label className="block text-sm font-medium">Điểm số (VD: 10)</label>
                <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    className="form-input mt-1"
                    required
                />
            </div>
            <div>
                <label className="block text-sm font-medium">Nhận xét</label>
                <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    rows={4}
                    className="form-textarea mt-1"
                    required
                />
            </div>
            <div className="flex justify-end space-x-4 pt-4 border-t dark:border-gray-700">
                <Button type="button" variant="secondary" onClick={onCancel}>Hủy</Button>
                <Button type="submit">{initialData ? 'Cập nhật' : 'Lưu Báo cáo'}</Button>
            </div>
        </form>
    );
};

export const AnnouncementsScreen: React.FC = () => {
    const { state, addAnnouncement, deleteAnnouncement, addProgressReport, updateProgressReport, deleteProgressReport, addBulkProgressReports } = useData();
    const { user, role } = useAuth();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<'progress' | 'announcements'>('progress');
    
    // Announcements State
    const [isAnnModalOpen, setAnnModalOpen] = useState(false);
    const [confirmAnnModal, setConfirmAnnModal] = useState<{ open: boolean; item?: Announcement }>({ open: false });

    // Progress Reports State
    const [isProgModalOpen, setProgModalOpen] = useState(false);
    const [isBulkProgModalOpen, setBulkProgModalOpen] = useState(false);
    const [editingProg, setEditingProg] = useState<ProgressReport | undefined>(undefined);
    const [confirmProgModal, setConfirmProgModal] = useState<{ open: boolean; item?: ProgressReport }>({ open: false });

    const canManageAnnouncements = role === UserRole.ADMIN || role === UserRole.MANAGER;
    const canManageProgress = role === UserRole.ADMIN || role === UserRole.MANAGER || role === UserRole.TEACHER;

    // --- Announcements Handlers ---
    const handleAddAnnouncement = async (data: { title: string; content: string; targetAudience: AnnouncementTarget; classId?: string; targetStudentIds?: string[]; scheduledFor?: string }) => {
        try {
            await addAnnouncement({
                ...data,
                createdAt: getVietnamTime(),
                createdBy: user?.name || 'Admin',
            });
            toast.success('Đã đăng thông báo mới.');
            setAnnModalOpen(false);
        } catch (error) {
            toast.error("Lỗi khi đăng thông báo.");
        }
    };

    const handleDeleteAnnouncement = async () => {
        if (confirmAnnModal.item) {
            try {
                await deleteAnnouncement(confirmAnnModal.item.id);
                toast.success('Đã xóa thông báo.');
                setConfirmAnnModal({open: false});
            } catch (error) {
                toast.error("Lỗi khi xóa.");
            }
        }
    };

    // --- Progress Reports Handlers ---
    const handleSaveProgress = async (data: Omit<ProgressReport, 'id' | 'createdBy'>) => {
        try {
            if (editingProg) {
                await updateProgressReport({
                    ...editingProg,
                    ...data,
                });
                toast.success('Đã cập nhật báo cáo tiến độ.');
            } else {
                await addProgressReport({
                    ...data,
                    createdBy: user?.id || '',
                });
                toast.success('Đã lưu báo cáo tiến độ.');
            }
            setProgModalOpen(false);
            setEditingProg(undefined);
        } catch (error) {
            toast.error("Lỗi khi lưu báo cáo.");
        }
    };

    const handleDeleteProgress = async () => {
        if (confirmProgModal.item) {
            try {
                await deleteProgressReport(confirmProgModal.item.id);
                toast.success('Đã xóa báo cáo tiến độ.');
                setConfirmProgModal({open: false});
            } catch (error) {
                toast.error("Lỗi khi xóa.");
            }
        }
    };

    const openEditProgress = (report: ProgressReport) => {
        setEditingProg(report);
        setProgModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold">Nhận xét & Đánh giá</h1>
                {activeTab === 'announcements' && canManageAnnouncements && (
                    <Button onClick={() => setAnnModalOpen(true)}>
                        {ICONS.plus} Tạo Thông báo mới
                    </Button>
                )}
                {activeTab === 'progress' && canManageProgress && (
                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => setBulkProgModalOpen(true)}>
                            {ICONS.plus} Nhập Điểm Hàng Loạt
                        </Button>
                        <Button onClick={() => { setEditingProg(undefined); setProgModalOpen(true); }}>
                            {ICONS.plus} Thêm Báo cáo Tiến độ
                        </Button>
                    </div>
                )}
            </div>

            <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                    className={`py-2 px-4 font-medium border-b-2 transition-colors ${activeTab === 'progress' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
                    onClick={() => setActiveTab('progress')}
                >
                    Nhận xét & Đánh giá
                </button>
                <button
                    className={`py-2 px-4 font-medium border-b-2 transition-colors ${activeTab === 'announcements' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
                    onClick={() => setActiveTab('announcements')}
                >
                    Thông báo
                </button>
            </div>
            
            {activeTab === 'announcements' && (
                state.announcements.length === 0 ? (
                    <div className="card-base text-center text-gray-500 dark:text-gray-400">
                        <h3 className="text-lg font-semibold">Chưa có thông báo nào</h3>
                        <p className="mt-1">Hãy tạo thông báo đầu tiên để gửi đến nhân viên và phụ huynh.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {state.announcements.map(ann => {
                            let targetLabel = 'Tất cả';
                            if (ann.targetAudience === 'TEACHERS') targetLabel = 'Giáo viên';
                            else if (ann.targetAudience === 'STUDENTS') targetLabel = 'Học viên';
                            else if (ann.targetAudience === 'CLASS' && ann.classId) {
                                targetLabel = `Lớp: ${state.classes.find(c => c.id === ann.classId)?.name || 'N/A'}`;
                            } else if (ann.targetAudience === 'SPECIFIC_STUDENTS' && ann.classId) {
                                targetLabel = `Một số học viên lớp: ${state.classes.find(c => c.id === ann.classId)?.name || 'N/A'}`;
                            }

                            const isScheduled = ann.scheduledFor && new Date(ann.scheduledFor) > new Date(getVietnamTime());

                            return (
                                <div key={ann.id} className={`card-base ${isScheduled ? 'opacity-70 border-dashed' : ''}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-4 flex-wrap">
                                                <h2 className="text-xl font-bold text-primary">{ann.title}</h2>
                                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                                                    Gửi đến: {targetLabel}
                                                </span>
                                                {isScheduled && (
                                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 flex items-center gap-1">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                                        Lên lịch: {formatVietnamDate(ann.scheduledFor!)}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                                Tạo ngày {formatVietnamDate(ann.createdAt)} bởi {ann.createdBy}
                                            </p>
                                        </div>
                                        {canManageAnnouncements && (
                                            <button
                                                onClick={() => setConfirmAnnModal({open: true, item: ann})}
                                                className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50"
                                                title="Xóa thông báo"
                                            >
                                                {ICONS.delete}
                                            </button>
                                        )}
                                    </div>
                                    <p className="mt-4 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{ann.content}</p>
                                </div>
                            );
                        })}
                    </div>
                )
            )}

            {activeTab === 'progress' && (
                state.progressReports.length === 0 ? (
                    <div className="card-base text-center text-gray-500 dark:text-gray-400">
                        <h3 className="text-lg font-semibold">Chưa có báo cáo tiến độ nào</h3>
                        <p className="mt-1">Hãy thêm báo cáo tiến độ đầu tiên cho học viên.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {state.progressReports.map(report => {
                            const student = state.students.find(s => s.id === report.studentId);
                            const cls = state.classes.find(c => c.id === report.classId);
                            const teacher = state.teachers.find(t => t.id === report.createdBy);
                            
                            return (
                                <div key={report.id} className="card-base">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-4">
                                                <h2 className="text-lg font-bold text-primary">Học viên: {student?.name || 'N/A'}</h2>
                                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                                                    Lớp: {cls?.name || 'N/A'}
                                                </span>
                                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200">
                                                    Điểm: {report.score}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                Ngày đánh giá: {report.date} | Người đánh giá: {teacher?.name || 'Admin'}
                                            </p>
                                        </div>
                                        {canManageProgress && (
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={() => openEditProgress(report)}
                                                    className="text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50"
                                                    title="Sửa báo cáo"
                                                >
                                                    {ICONS.edit}
                                                </button>
                                                <button
                                                    onClick={() => setConfirmProgModal({open: true, item: report})}
                                                    className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50"
                                                    title="Xóa báo cáo"
                                                >
                                                    {ICONS.delete}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-4">
                                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Nhận xét:</p>
                                        <p className="mt-1 text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{report.comments}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            )}

            {/* Modals for Announcements */}
            <Modal isOpen={isAnnModalOpen} onClose={() => setAnnModalOpen(false)} title="Tạo Thông báo mới">
                <AnnouncementForm
                    onSubmit={handleAddAnnouncement}
                    onCancel={() => setAnnModalOpen(false)}
                />
            </Modal>
            <ConfirmationModal
                isOpen={confirmAnnModal.open}
                onClose={() => setConfirmAnnModal({open: false})}
                onConfirm={handleDeleteAnnouncement}
                title="Xác nhận Xóa Thông báo"
                message={<p>Bạn có chắc chắn muốn xóa thông báo "<strong>{confirmAnnModal.item?.title}</strong>"?</p>}
            />

            {/* Modals for Progress Reports */}
            <Modal isOpen={isProgModalOpen} onClose={() => setProgModalOpen(false)} title={editingProg ? "Cập nhật Báo cáo Tiến độ" : "Thêm Báo cáo Tiến độ"}>
                <ProgressReportForm
                    initialData={editingProg}
                    onSubmit={handleSaveProgress}
                    onCancel={() => setProgModalOpen(false)}
                />
            </Modal>
            
            <BulkProgressModal
                isOpen={isBulkProgModalOpen}
                onClose={() => setBulkProgModalOpen(false)}
                classes={state.classes}
                students={state.students}
                onSave={addBulkProgressReports}
                currentUserId={user?.id || ''}
            />

            <ConfirmationModal
                isOpen={confirmProgModal.open}
                onClose={() => setConfirmProgModal({open: false})}
                onConfirm={handleDeleteProgress}
                title="Xác nhận Xóa Báo cáo"
                message={<p>Bạn có chắc chắn muốn xóa báo cáo tiến độ này?</p>}
            />
        </div>
    );
};
