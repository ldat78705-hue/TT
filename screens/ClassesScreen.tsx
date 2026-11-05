import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../hooks/useDataContext';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { ICONS } from '../constants';
import { Class, UserRole, FeeType, ClassSchedule, Teacher, Student, Room, PersonStatus, ClassStatus, Invoice } from '../types';
import { CurrencyInput } from '../components/common/CurrencyInput';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { ListItemCard } from '../components/common/ListItemCard';
import { TuitionFeeNotice } from '../components/finance/TuitionFeeNotice';
import { uploadDebtNoticeImage, deleteDebtNoticeImage } from '../utils/firebaseStorage';
import { sllScanGroups, markGroupReminder } from '../services/api';
import { addReminderEntry, getGroupReminderLabel } from '../utils/zaloReminderHistory';

declare global {
    interface Window {
        html2canvas: any;
    }
}

// New Component: TeacherSelector
const TeacherSelector: React.FC<{
    teachers: Teacher[];
    selectedTeacherIds: string[];
    onChange: (selectedIds: string[]) => void;
}> = ({ teachers, selectedTeacherIds, onChange }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredTeachers = useMemo(() => {
        if (!searchTerm.trim()) return teachers;
        const queryWords = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
        return teachers.filter(teacher =>
            queryWords.every(word => teacher.name.toLowerCase().includes(word))
        );
    }, [teachers, searchTerm]);

    const handleToggle = (teacherId: string) => {
        const newSelectedIds = selectedTeacherIds.includes(teacherId)
            ? selectedTeacherIds.filter(id => id !== teacherId)
            : [...selectedTeacherIds, teacherId];
        onChange(newSelectedIds);
    };

    return (
        <div className="border rounded-md dark:border-gray-600">
            <div className="p-2 border-b dark:border-gray-600">
                <input
                    type="text"
                    placeholder="Tìm kiếm giáo viên..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="form-input w-full p-2"
                />
            </div>
            <div className="max-h-60 overflow-y-auto p-2">
                {filteredTeachers.length > 0 ? (
                    filteredTeachers.map(teacher => (
                        <label key={teacher.id} className="flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedTeacherIds.includes(teacher.id)}
                                onChange={() => handleToggle(teacher.id)}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="ml-3 text-sm">{teacher.name}</span>
                        </label>
                    ))
                ) : (
                    <p className="text-center text-sm text-gray-500 p-4">Không tìm thấy giáo viên.</p>
                )}
            </div>
             <div className="p-2 border-t dark:border-gray-600 text-sm text-gray-500 dark:text-gray-400">
                Đã chọn: {selectedTeacherIds.length} giáo viên
            </div>
        </div>
    );
};


// New Component: Advanced Student Selector
const StudentSelector: React.FC<{
    students: Student[];
    selectedStudentIds: string[];
    onChange: (selectedIds: string[]) => void;
}> = ({ students, selectedStudentIds, onChange }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredStudents = useMemo(() => {
        if (!searchTerm.trim()) return students;
        const queryWords = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
        return students.filter(student =>
            queryWords.every(word => student.name.toLowerCase().includes(word))
        );
    }, [students, searchTerm]);

    const handleToggle = (studentId: string) => {
        const newSelectedIds = selectedStudentIds.includes(studentId)
            ? selectedStudentIds.filter(id => id !== studentId)
            : [...selectedStudentIds, studentId];
        onChange(newSelectedIds);
    };

    return (
        <div className="border rounded-md dark:border-gray-600">
            <div className="p-2 border-b dark:border-gray-600">
                <input
                    type="text"
                    placeholder="Tìm kiếm học viên..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="form-input w-full p-2"
                />
            </div>
            <div className="max-h-60 overflow-y-auto p-2">
                {filteredStudents.length > 0 ? (
                    filteredStudents.map(student => (
                        <label key={student.id} className="flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedStudentIds.includes(student.id)}
                                onChange={() => handleToggle(student.id)}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="ml-3 text-sm">{student.name}</span>
                        </label>
                    ))
                ) : (
                    <p className="text-center text-sm text-gray-500 p-4">Không tìm thấy học viên.</p>
                )}
            </div>
             <div className="p-2 border-t dark:border-gray-600 text-sm text-gray-500 dark:text-gray-400">
                Đã chọn: {selectedStudentIds.length} học viên
            </div>
        </div>
    );
};

// Form for adding/editing a class
const ClassForm: React.FC<{
    cls?: Class;
    onSubmit: (cls: Class) => void;
    onCancel: () => void;
    teachers: Teacher[];
    students: Student[];
    rooms: Room[];
    existingClasses: Class[];
}> = ({ cls, onSubmit, onCancel, teachers, students, rooms, existingClasses }) => {

    const initialSchedule: ClassSchedule = { dayOfWeek: 'Monday', startTime: '18:00', endTime: '19:30' };

    // Auto-generate next class ID: L01, L02, ..., L11, L12, ...
    const generateNextClassId = (): string => {
        const existingNumbers = existingClasses
            .map(c => c.id)
            .filter(id => /^L\d+$/i.test(id))
            .map(id => parseInt(id.substring(1), 10))
            .filter(n => !isNaN(n));
        const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
        const nextNumber = maxNumber + 1;
        return `L${nextNumber.toString().padStart(2, '0')}`;
    };

    const [formData, setFormData] = useState<Class>(() => {
        const defaults: Class = {
            id: cls ? '' : generateNextClassId(),
            name: '',
            subject: '',
            teacherIds: [],
            studentIds: [],
            fee: { type: FeeType.MONTHLY, amount: 0 },
            schedule: [initialSchedule],
            classStatus: ClassStatus.ACTIVE,
            startDate: '',
            endDate: '',
        };
        const { studentIds, teacherIds, ...restCls } = cls || {};
        return { ...defaults, ...restCls, studentIds: studentIds || [], teacherIds: teacherIds || [] };
    });
     const [errors, setErrors] = useState<Partial<Record<keyof Class, string | string[]>>>({});
    const idInputRef = useRef<HTMLInputElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // When adding new class, ID is auto-generated → focus on name field
        // When editing, focus on ID field
        if (cls) {
            idInputRef.current?.focus();
        } else {
            nameInputRef.current?.focus();
        }
    }, []);

    const validate = () => {
        const newErrors: Partial<Record<keyof Class, string | string[]>> = {};
        if (!formData.id.trim()) newErrors.id = "Mã lớp là bắt buộc.";
        if (!formData.name.trim()) newErrors.name = "Tên lớp là bắt buộc.";
        if (formData.teacherIds.length === 0) newErrors.teacherIds = "Vui lòng chọn giáo viên.";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.currentTarget;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFeeTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, fee: { ...prev.fee, type: e.target.value as FeeType } }));
    };

    const handleFeeAmountChange = (amount: number) => {
        setFormData(prev => ({ ...prev, fee: { ...prev.fee, amount } }));
    };

    const handleTeacherSelectChange = (selectedIds: string[]) => {
        setFormData(prev => ({ ...prev, teacherIds: selectedIds }));
    };
    
    const handleStudentSelectChange = (selectedIds: string[]) => {
        setFormData(prev => ({ ...prev, studentIds: selectedIds }));
    };

    const handleScheduleChange = (index: number, field: keyof ClassSchedule, value: string) => {
        const newSchedule = [...formData.schedule];
        const finalValue = field === 'roomId' && value === '' ? undefined : value;
        newSchedule[index] = { ...newSchedule[index], [field]: finalValue };
        setFormData(prev => ({ ...prev, schedule: newSchedule }));
    };

    const addScheduleItem = () => {
        setFormData(prev => ({ ...prev, schedule: [...prev.schedule, initialSchedule] }));
    };

    const removeScheduleItem = (index: number) => {
        setFormData(prev => ({ ...prev, schedule: prev.schedule.filter((_, i) => i !== index) }));
    };


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
            onSubmit(formData);
        }
    };

    const dayOptions: { value: ClassSchedule['dayOfWeek']; label: string }[] = [
        { value: 'Monday', label: 'Thứ Hai' }, { value: 'Tuesday', label: 'Thứ Ba' },
        { value: 'Wednesday', label: 'Thứ Tư' }, { value: 'Thursday', label: 'Thứ Năm' },
        { value: 'Friday', label: 'Thứ Sáu' }, { value: 'Saturday', label: 'Thứ Bảy' },
        { value: 'Sunday', label: 'Chủ Nhật' },
    ];

    return (
         <form onSubmit={handleSubmit} className="space-y-6">
            <fieldset className="form-fieldset">
                <legend className="form-legend">Thông tin cơ bản</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <label className="block text-sm font-medium">Mã Lớp học <span className="text-red-500">*</span></label>
                        <input ref={idInputRef} type="text" name="id" value={formData.id} onChange={handleChange} className={`form-input mt-1 ${!cls ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`} readOnly={!cls} />
                        {!cls && <p className="text-xs text-gray-500 mt-1">Mã tự động sinh theo thứ tự</p>}
                        {errors.id && <p className="text-red-500 text-xs mt-1">{errors.id}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Tên lớp học <span className="text-red-500">*</span></label>
                        <input ref={nameInputRef} type="text" name="name" value={formData.name} onChange={handleChange} className="form-input mt-1" />
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Môn học</label>
                        <input type="text" name="subject" value={formData.subject} onChange={handleChange} className="form-input mt-1" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Trạng thái lớp</label>
                        <select name="classStatus" value={formData.classStatus || ClassStatus.ACTIVE} onChange={e => setFormData(prev => ({ ...prev, classStatus: e.target.value as ClassStatus }))} className="form-select mt-1">
                            <option value={ClassStatus.ACTIVE}>🟢 Đang mở</option>
                            <option value={ClassStatus.PAUSED}>🟡 Tạm dừng</option>
                            <option value={ClassStatus.ENDED}>🔴 Đã kết thúc</option>
                            <option value={ClassStatus.ARCHIVED}>📦 Lưu trữ</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Ngày bắt đầu</label>
                        <input type="date" name="startDate" value={formData.startDate || ''} onChange={handleChange} className="form-input mt-1" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Ngày kết thúc</label>
                        <input type="date" name="endDate" value={formData.endDate || ''} onChange={handleChange} className="form-input mt-1" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Sĩ số tối đa</label>
                        <input type="number" name="capacity" min="0" value={formData.capacity || ''} onChange={e => setFormData(prev => ({ ...prev, capacity: e.target.value ? Number(e.target.value) : undefined }))} className="form-input mt-1" placeholder="Không giới hạn" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Zalo Group ID <span className="text-xs text-gray-400">(nhóm lớp)</span></label>
                        <div className="flex gap-2 mt-1">
                            <input type="text" name="zaloGroupId" value={formData.zaloGroupId || ''} onChange={e => setFormData(prev => ({ ...prev, zaloGroupId: e.target.value || undefined }))} className="form-input flex-1" placeholder="Chọn nhóm hoặc dán ID" />
                            <ZaloGroupPicker onSelect={(id) => setFormData(prev => ({ ...prev, zaloGroupId: id }))} />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Bấm "Quét nhóm" để tìm nhóm Zalo, hoặc dán Group ID thủ công</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Giáo viên <span className="text-red-500">*</span></label>
                        <TeacherSelector
                            teachers={teachers}
                            selectedTeacherIds={formData.teacherIds}
                            onChange={handleTeacherSelectChange}
                        />
                        {errors.teacherIds && <p className="text-red-500 text-xs mt-1">{errors.teacherIds as string}</p>}
                    </div>
                </div>
            </fieldset>

             <fieldset className="form-fieldset">
                <legend className="form-legend">Lịch học</legend>
                <div className="space-y-4 mt-2">
                    {formData.schedule.map((item, index) => (
                        <div key={index} className="flex flex-wrap items-center gap-2 p-2 rounded-md bg-gray-50 dark:bg-gray-700/50">
                            <select value={item.dayOfWeek} onChange={e => handleScheduleChange(index, 'dayOfWeek', e.target.value)} className="form-select">
                                {dayOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                            <input type="time" value={item.startTime} onChange={e => handleScheduleChange(index, 'startTime', e.target.value)} className="form-input" />
                            <span>-</span>
                            <input type="time" value={item.endTime} onChange={e => handleScheduleChange(index, 'endTime', e.target.value)} className="form-input" />
                            <select 
                                value={item.roomId || ''} 
                                onChange={e => handleScheduleChange(index, 'roomId', e.target.value)}
                                className="form-select flex-1 min-w-[120px]"
                            >
                                <option value="">-- Phòng --</option>
                                {rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.capacity} chỗ)</option>)}
                            </select>
                            <Button type="button" variant="danger" onClick={() => removeScheduleItem(index)} className="p-2 h-10 w-10 !rounded-full">
                                {ICONS.delete}
                            </Button>
                        </div>
                    ))}
                    <Button type="button" variant="secondary" onClick={addScheduleItem} className="w-full">
                        {ICONS.plus} Thêm buổi học
                    </Button>
                </div>
            </fieldset>

            <fieldset className="form-fieldset">
                <legend className="form-legend">Học phí</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <label className="block text-sm font-medium">Loại học phí</label>
                        <select name="type" value={formData.fee.type} onChange={handleFeeTypeChange} className="form-select mt-1">
                            <option value={FeeType.MONTHLY}>Theo tháng</option>
                            <option value={FeeType.PER_SESSION}>Theo buổi</option>
                            <option value={FeeType.PER_COURSE}>Theo khóa</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Mức phí (VND)</label>
                        <CurrencyInput
                            value={formData.fee.amount}
                            onChange={handleFeeAmountChange}
                            className="form-input mt-1"
                            required
                        />
                    </div>
                </div>
            </fieldset>

            <fieldset className="form-fieldset">
                <legend className="form-legend">Danh sách Học viên</legend>
                <StudentSelector
                    students={students}
                    selectedStudentIds={formData.studentIds}
                    onChange={handleStudentSelectChange}
                />
            </fieldset>

            <div className="flex justify-end space-x-4 pt-4 border-t dark:border-gray-700">
                <Button type="button" variant="secondary" onClick={onCancel}>Hủy</Button>
                <Button type="submit">{cls ? 'Lưu thay đổi' : 'Thêm lớp học'}</Button>
            </div>
         </form>
    );
}

export const ClassesScreen: React.FC = () => {
    const { state, addClass, updateClass, deleteClass, archiveClass, restoreClass } = useData();
    const { toast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();
    const { students, teachers, classes } = state;
    const { user, role } = useAuth();
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingClass, setEditingClass] = useState<Class | undefined>(undefined);
    const [confirmModalState, setConfirmModalState] = useState<{ isOpen: boolean; class: Class | null }>({ isOpen: false, class: null });
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | ClassStatus>('ALL');
    const [groupMsgModal, setGroupMsgModal] = useState<{ isOpen: boolean; cls: Class | null }>({ isOpen: false, cls: null });
    const [groupMsgText, setGroupMsgText] = useState('');
    const [isSendingGroupMsg, setIsSendingGroupMsg] = useState(false);
    // Group tuition reminder
    const [tuitionReminderModal, setTuitionReminderModal] = useState<{ isOpen: boolean; cls: Class | null }>({ isOpen: false, cls: null });
    const [isSendingTuitionReminder, setIsSendingTuitionReminder] = useState(false);
    const [tuitionProgress, setTuitionProgress] = useState('');
    const tuitionImageRef = useRef<HTMLDivElement>(null);
    const [tuitionImageInvoice, setTuitionImageInvoice] = useState<Invoice | null>(null);

    const canManage = role === UserRole.ADMIN || role === UserRole.MANAGER;
    const canDoAttendance = role === UserRole.ADMIN || role === UserRole.MANAGER || role === UserRole.TEACHER;
    const isSLLChannel = state.settings.zaloChannel === 'sll';

    const handleOpenModal = (cls?: Class) => {
        setEditingClass(cls);
        setModalOpen(true);
    };

    useEffect(() => {
        const { editClassId } = location.state || {};
        if (editClassId && !isModalOpen) {
            const classToEdit = state.classes.find(c => c.id === editClassId);
            if (classToEdit) {
                handleOpenModal(classToEdit);
            }
        }
    }, [location.state, state.classes, isModalOpen]);
    
    const getTeacherNames = (teacherIds: string[]) => {
        if (!teacherIds || teacherIds.length === 0) return 'N/A';
        return teacherIds.map(id => teachers.find(t => t.id === id)?.name || 'N/A').join(', ');
    };
    
    const getActiveStudentCount = (studentIds: string[] | undefined) => {
        if (!studentIds) return 0;
        return studentIds.filter(id => {
            const student = students.find(s => s.id === id);
            return student && student.status === PersonStatus.ACTIVE;
        }).length;
    };

    const getCapacityDisplay = (cls: Class) => {
        const count = getActiveStudentCount(cls.studentIds);
        if (!cls.capacity) return <span>{count}</span>;
        const isFull = count >= cls.capacity;
        const isNearFull = count >= cls.capacity * 0.8;
        return (
            <span className={isFull ? 'text-red-600 dark:text-red-400 font-bold' : isNearFull ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>
                {count}/{cls.capacity}{isFull ? ' ⚠️ Đầy' : ''}
            </span>
        );
    };

    const userClasses = useMemo(() => role === UserRole.TEACHER
        ? classes.filter(c => (c.teacherIds || []).includes((user as Teacher)?.id))
        : classes, [classes, role, user]);

    const filteredClasses = useMemo(() => {
        let result = userClasses;
        // Filter by status — hide ARCHIVED by default (similar to students)
        if (statusFilter === 'ALL') {
            result = result.filter(c => (c.classStatus || ClassStatus.ACTIVE) !== ClassStatus.ARCHIVED);
        } else {
            result = result.filter(c => (c.classStatus || ClassStatus.ACTIVE) === statusFilter);
        }
        // Filter by search query
        if (searchQuery.trim()) {
            const queryWords = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
            result = result.filter(c => {
                const searchableText = `${c.id} ${c.name} ${c.subject} ${getTeacherNames(c.teacherIds)}`.toLowerCase();
                return queryWords.every(word => searchableText.includes(word));
            });
        }
        return result;
    }, [userClasses, searchQuery, statusFilter, teachers]);

    const getStatusBadge = (cls: Class) => {
        const status = cls.classStatus || ClassStatus.ACTIVE;
        switch (status) {
            case ClassStatus.ACTIVE: return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">🟢 Đang mở</span>;
            case ClassStatus.PAUSED: return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">🟡 Tạm dừng</span>;
            case ClassStatus.ENDED: return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">🔴 Đã kết thúc</span>;
            case ClassStatus.ARCHIVED: return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400">📦 Lưu trữ</span>;
        }
    };
    
    const handleCloseModal = () => {
        setEditingClass(undefined);
        setModalOpen(false);
        const { returnTo } = location.state || {};
        if (returnTo) {
            navigate(returnTo, { replace: true, state: {} });
        }
    };

    const handleSubmit = async (data: Class) => {
        const { returnTo } = location.state || {};
        try {
            if (editingClass) {
                await updateClass({ originalId: editingClass.id, updatedClass: data });
                toast.success(`Đã cập nhật lớp học ${data.name}`);
                setModalOpen(false);
                setEditingClass(undefined);
                if (returnTo) {
                    navigate(`/class/${data.id}`, { replace: true, state: {} });
                }
            } else {
                await addClass(data);
                toast.success(`Đã thêm lớp học mới ${data.name}`);
                handleCloseModal();
            }
        } catch (error: any) {
            toast.error(error.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
        }
    };
    
    const handleDeleteClick = (cls: Class) => {
        setConfirmModalState({ isOpen: true, class: cls });
    };

    const handleConfirmDelete = async () => {
        if (confirmModalState.class) {
            try {
                await deleteClass(confirmModalState.class.id);
                toast.success(`Đã xóa lớp học ${confirmModalState.class.name}`);
            } catch (error) {
                 toast.error('Đã xảy ra lỗi khi xóa. Vui lòng thử lại.');
            }
        }
    };

    const dayMap: Record<string, string> = {
        'Monday': 'T2', 'Tuesday': 'T3', 'Wednesday': 'T4', 'Thursday': 'T5',
        'Friday': 'T6', 'Saturday': 'T7', 'Sunday': 'CN'
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold">Quản lý Lớp học</h1>
                {canManage && (
                    <div className="relative group w-full md:w-auto">
                        <Button 
                            onClick={() => handleOpenModal()}
                            disabled={teachers.length === 0}
                            className="w-full"
                        >
                            {ICONS.plus} Thêm lớp học
                        </Button>
                        {teachers.length === 0 && (
                            <div className="absolute bottom-full mb-2 w-max px-2 py-1 bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                                Bạn cần thêm giáo viên trước khi tạo lớp học
                            </div>
                        )}
                    </div>
                )}
            </div>
             <div className="card-base p-4 flex flex-col sm:flex-row gap-3">
                <input 
                    type="text" 
                    placeholder="Tìm kiếm lớp học (mã, tên, môn, giáo viên)..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="form-input flex-1"
                />
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                    className="form-select w-full sm:w-44"
                >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value={ClassStatus.ACTIVE}>🟢 Đang mở</option>
                    <option value={ClassStatus.PAUSED}>🟡 Tạm dừng</option>
                    <option value={ClassStatus.ENDED}>🔴 Đã kết thúc</option>
                    <option value={ClassStatus.ARCHIVED}>📦 Lưu trữ</option>
                </select>
            </div>
            
            {filteredClasses.length === 0 ? (
                 <div className="card-base text-center text-gray-500 dark:text-gray-400">
                    <h3 className="text-lg font-semibold">Không tìm thấy lớp học</h3>
                    <p className="mt-1">{canManage ? 'Hãy thêm lớp học đầu tiên hoặc thử tìm kiếm khác.' : 'Bạn chưa được phân công vào lớp học nào.'}</p>
                </div>
            ) : (
                <>
                    {/* Desktop View */}
                    <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredClasses.map(cls => (
                            <div key={cls.id} className="card-base flex flex-col justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-primary">
                                        <Link to={`/class/${cls.id}`} className="hover:underline">{cls.name}</Link>
                                    </h2>
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">ID: {cls.id}</p>
                                        {getStatusBadge(cls)}
                                    </div>
                                    <p className="font-semibold">{cls.subject}</p>
                                    <p className="text-gray-500 dark:text-gray-400 mt-2">GV: {getTeacherNames(cls.teacherIds)}</p>
                                    <p className="text-gray-500 dark:text-gray-400">Sĩ số: {getCapacityDisplay(cls)}</p>
                                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                                        {(cls.schedule || []).map((s, i) => (
                                            <div key={i}>{`${dayMap[s.dayOfWeek]}: ${s.startTime} - ${s.endTime}`}</div>
                                        ))}
                                    </div>
                                </div>
                                <div className="mt-4 flex justify-end items-center gap-2 flex-wrap">
                                   {canManage && (
                                       <>
                                        <button onClick={() => handleOpenModal(cls)} className="text-indigo-600 hover:text-indigo-900 p-2 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/50" title="Sửa">{ICONS.edit}</button>
                                        {(cls.classStatus || ClassStatus.ACTIVE) === ClassStatus.ARCHIVED ? (
                                            <button onClick={async () => { try { await restoreClass(cls.id); toast.success(`Đã khôi phục lớp ${cls.name}`); } catch (e: any) { toast.error(e.message); } }} className="text-emerald-600 hover:text-emerald-900 p-2 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900/50" title="Khôi phục">↩️</button>
                                        ) : (
                                            <button onClick={async () => { try { await archiveClass(cls.id); toast.success(`Đã lưu trữ lớp ${cls.name}`); } catch (e: any) { toast.error(e.message); } }} className="text-amber-600 hover:text-amber-900 p-2 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/50" title="Lưu trữ">📦</button>
                                        )}
                                        <button onClick={() => handleDeleteClick(cls)} className="text-red-600 hover:text-red-900 p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50" title="Xóa">{ICONS.delete}</button>
                                       </>
                                   )}
                                    {isSLLChannel && cls.zaloGroupId && canManage && (
                                        <>
                                            <button onClick={() => { setGroupMsgModal({ isOpen: true, cls }); setGroupMsgText(''); }} className="text-blue-600 hover:text-blue-900 p-2 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50" title="Nhắn nhóm Zalo">💬</button>
                                            <button onClick={() => setTuitionReminderModal({ isOpen: true, cls })} className="text-orange-600 hover:text-orange-900 p-2 rounded-full hover:bg-orange-100 dark:hover:bg-orange-900/50" title="Nhắc học phí nhóm">📢</button>
                                        </>
                                    )}
                                    {canDoAttendance && (
                                        <Link to={`/class/${cls.id}`} state={{ defaultTab: 'attendance' }}>
                                            <Button>Điểm danh</Button>
                                        </Link>
                                    )}
                                    <Link to={`/class/${cls.id}`}>
                                        <Button variant="secondary">Xem chi tiết</Button>
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Mobile View */}
                    <div className="md:hidden space-y-4">
                        {filteredClasses.map(cls => (
                            <ListItemCard
                                key={cls.id}
                                title={
                                    <Link to={`/class/${cls.id}`} className="font-semibold text-primary hover:underline">
                                        {cls.name}
                                    </Link>
                                }
                                details={[
                                    { label: "Mã Lớp", value: cls.id },
                                    { label: "Môn", value: cls.subject },
                                    { label: "Trạng thái", value: getStatusBadge(cls) },
                                    { label: "Sĩ số", value: getCapacityDisplay(cls) },
                                    { label: "GV", value: getTeacherNames(cls.teacherIds) },
                                ]}
                                actions={
                                    <div className="flex items-center justify-end gap-2 flex-wrap">
                                        {canDoAttendance && (
                                            <Link to={`/class/${cls.id}`} state={{ defaultTab: 'attendance' }}>
                                                <Button size="sm">Điểm danh</Button>
                                            </Link>
                                        )}
                                        {isSLLChannel && cls.zaloGroupId && canManage && (
                                            <>
                                                <button onClick={() => { setGroupMsgModal({ isOpen: true, cls }); setGroupMsgText(''); }} className="p-2 rounded-full text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50" title="Nhắn nhóm Zalo">💬</button>
                                                <button onClick={() => setTuitionReminderModal({ isOpen: true, cls })} className="p-2 rounded-full text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/50" title="Nhắc học phí nhóm">📢</button>
                                            </>
                                        )}
                                        {canManage && (
                                           <>
                                                <button onClick={() => handleOpenModal(cls)} className="p-2 rounded-full text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/50" title="Sửa">{ICONS.edit}</button>
                                                {(cls.classStatus || ClassStatus.ACTIVE) === ClassStatus.ARCHIVED ? (
                                                    <button onClick={async () => { try { await restoreClass(cls.id); toast.success(`Đã khôi phục lớp ${cls.name}`); } catch (e: any) { toast.error(e.message); } }} className="p-2 rounded-full text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/50" title="Khôi phục">↩️</button>
                                                ) : (
                                                    <button onClick={async () => { try { await archiveClass(cls.id); toast.success(`Đã lưu trữ lớp ${cls.name}`); } catch (e: any) { toast.error(e.message); } }} className="p-2 rounded-full text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/50" title="Lưu trữ">📦</button>
                                                )}
                                                <button onClick={() => handleDeleteClick(cls)} className="p-2 rounded-full text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50" title="Xóa">{ICONS.delete}</button>
                                           </>
                                        )}
                                    </div>
                                }
                            />
                        ))}
                    </div>
                </>
            )}

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingClass ? 'Chỉnh sửa Lớp học' : 'Thêm Lớp học mới'}>
                <ClassForm cls={editingClass} onSubmit={handleSubmit} onCancel={handleCloseModal} teachers={teachers} students={students} rooms={state.rooms || []} existingClasses={classes} />
            </Modal>
            <ConfirmationModal
                isOpen={confirmModalState.isOpen}
                onClose={() => setConfirmModalState({ isOpen: false, class: null })}
                onConfirm={handleConfirmDelete}
                title="Xác nhận Xóa Lớp học"
                message={
                     <p>
                        Bạn có chắc chắn muốn xóa lớp học <strong>{confirmModalState.class?.name}</strong>?
                        <br/><br/>
                        <span className="font-bold text-red-500">CẢNH BÁO:</span> Mọi dữ liệu điểm danh và báo cáo tiến độ của lớp này cũng sẽ bị xóa.
                    </p>
                }
            />

            {/* Group Message Modal */}
            <Modal isOpen={groupMsgModal.isOpen} onClose={() => setGroupMsgModal({ isOpen: false, cls: null })} title={`💬 Nhắn nhóm — ${groupMsgModal.cls?.name || ''}`}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Nội dung tin nhắn</label>
                        <textarea
                            value={groupMsgText}
                            onChange={e => setGroupMsgText(e.target.value)}
                            className="form-input w-full h-32 resize-none"
                            placeholder="Nhập nội dung gửi vào nhóm Zalo..."
                        />
                    </div>
                    <div className="text-xs text-gray-500">
                        <p>Group ID: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{groupMsgModal.cls?.zaloGroupId}</code></p>
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setGroupMsgModal({ isOpen: false, cls: null })}>Hủy</Button>
                        <Button
                            disabled={!groupMsgText.trim() || isSendingGroupMsg}
                            onClick={async () => {
                                if (!groupMsgModal.cls?.zaloGroupId || !groupMsgText.trim()) return;
                                setIsSendingGroupMsg(true);
                                try {
                                    const res = await fetch('/api/zalo', {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${JSON.parse(localStorage.getItem('educenter_user_session') || '{}').token || ''}`,
                                        },
                                        body: JSON.stringify({
                                            action: 'send_group_message',
                                            groupId: groupMsgModal.cls.zaloGroupId,
                                            message: groupMsgText,
                                            className: groupMsgModal.cls.name,
                                        }),
                                    });
                                    const result = await res.json();
                                    if (result.success) {
                                        toast.success(`Đã gửi tin nhắn vào nhóm ${groupMsgModal.cls.name}!`);
                                        setGroupMsgModal({ isOpen: false, cls: null });
                                    } else {
                                        toast.error(result.error || 'Lỗi gửi tin nhắn nhóm');
                                    }
                                } catch (err: any) {
                                    toast.error(err.message || 'Lỗi kết nối SLL');
                                } finally {
                                    setIsSendingGroupMsg(false);
                                }
                            }}
                        >
                            {isSendingGroupMsg ? 'Đang gửi...' : '💬 Gửi vào nhóm'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ── Tuition Reminder Modal ── */}
            <Modal isOpen={tuitionReminderModal.isOpen} onClose={() => !isSendingTuitionReminder && setTuitionReminderModal({ isOpen: false, cls: null })} title={`📢 Nhắc HP nhóm — ${tuitionReminderModal.cls?.name || ''}`}>
                <div className="space-y-4">
                    {(() => {
                        const cls = tuitionReminderModal.cls;
                        if (!cls) return <p>Chưa chọn lớp</p>;
                        const classStudents = state.students.filter(s => cls.studentIds?.includes(s.id));
                        const unpaidInvoices = state.invoices.filter(inv => 
                            inv.status === 'UNPAID' && cls.studentIds?.includes(inv.studentId)
                        );
                        // Only keep latest unpaid invoice per student
                        const studentLatestMap = new Map<string, { student: Student; invoice: Invoice }>();
                        for (const inv of unpaidInvoices) {
                            const student = classStudents.find(s => s.id === inv.studentId);
                            if (!student) continue;
                            const existing = studentLatestMap.get(student.id);
                            if (!existing || inv.month > existing.invoice.month) {
                                studentLatestMap.set(student.id, { student, invoice: inv });
                            }
                        }
                        const unpaidList = Array.from(studentLatestMap.values());
                        
                        if (unpaidList.length === 0) {
                            return <p className="text-gray-500">Không có học viên nào có hóa đơn chưa đóng trong lớp này.</p>;
                        }
                        
                        return (
                            <>
                                {/* Nhắc nhóm gần nhất — 1 badge duy nhất */}
                                {(() => {
                                    // Lấy label nhắc nhóm từ bất kỳ HV nào (tất cả cùng 1 lần nhắc)
                                    const firstLabel = getGroupReminderLabel(unpaidList[0].student.id, state.invoices);
                                    if (!firstLabel) return null;
                                    return <div className="flex items-center gap-2 text-xs"><span className="px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium">🔔 Nhắc nhóm gần nhất: {firstLabel}</span></div>;
                                })()}
                                <div className="max-h-60 overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead><tr className="border-b"><th className="text-left p-1">Học viên</th><th className="text-right p-1">Số tiền</th><th className="text-right p-1">Tháng</th></tr></thead>
                                        <tbody>
                                            {unpaidList.map(({ student, invoice: inv }) => (
                                                <tr key={student.id} className="border-b border-gray-100 dark:border-gray-700">
                                                    <td className="p-1">{student.name}</td>
                                                    <td className="p-1 text-right text-red-600 font-medium">{Math.abs(student.balance).toLocaleString('vi-VN')}đ</td>
                                                    <td className="p-1 text-right text-gray-500">{inv.month}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="text-xs text-gray-500">
                                    Tổng: <strong>{unpaidList.length}</strong> HS, <strong>{unpaidList.reduce((sum, u) => sum + Math.abs(u.student.balance), 0).toLocaleString('vi-VN')}đ</strong>
                                    {state.settings?.bankAccountNumber && <> • Kèm TK ngân hàng: <strong>{state.settings.bankAccountNumber}</strong></>}
                                </p>
                                {tuitionProgress && (
                                    <div className="flex items-center gap-2 text-sm text-indigo-600">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                        {tuitionProgress}
                                    </div>
                                )}
                                <Button
                                    disabled={isSendingTuitionReminder}
                                    isLoading={isSendingTuitionReminder}
                                    onClick={async () => {
                                        setIsSendingTuitionReminder(true);
                                        const studentsToSend: any[] = [];
                                        try {
                                            // Generate image for each student's latest unpaid invoice
                                            for (let i = 0; i < unpaidList.length; i++) {
                                                const { student, invoice: latestInv } = unpaidList[i];
                                                
                                                const studentData: any = {
                                                    name: student.name,
                                                    amount: Math.abs(student.balance),
                                                    invoiceMonth: latestInv.month,
                                                };
                                                
                                                // Generate + upload image
                                                if (window.html2canvas) {
                                                    try {
                                                        setTuitionProgress(`Tạo ảnh HĐ ${i + 1}/${unpaidList.length}: ${student.name}...`);
                                                        setTuitionImageInvoice(latestInv);
                                                        await new Promise(r => setTimeout(r, 500));
                                                        
                                                        const el = tuitionImageRef.current;
                                                        if (el) {
                                                            const canvas = await window.html2canvas(el, { scale: 2, useCORS: true });
                                                            setTuitionProgress(`Upload ảnh ${i + 1}/${unpaidList.length}: ${student.name}...`);
                                                            const uploadResult = await uploadDebtNoticeImage(canvas, 'grp', student.id);
                                                            studentData.imageUrl = uploadResult.imageUrl;
                                                            studentData.imageId = uploadResult.imageId;
                                                        }
                                                    } catch (imgErr) {
                                                        console.warn(`Failed to generate image for ${student.name}:`, imgErr);
                                                    }
                                                }
                                                
                                                studentsToSend.push(studentData);
                                            }
                                            
                                            setTuitionImageInvoice(null);
                                            setTuitionProgress('Đang gửi vào nhóm...');
                                            
                                            const token = JSON.parse(localStorage.getItem('educenter_user_session') || '{}').token || '';
                                            const res = await fetch('/api/zalo', {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    'Authorization': `Bearer ${token}`,
                                                },
                                                body: JSON.stringify({
                                                    action: 'send_group_tuition_reminder',
                                                    groupId: cls.zaloGroupId,
                                                    className: cls.name,
                                                    unpaidStudents: studentsToSend,
                                                }),
                                            });
                                            const result = await res.json();
                                            if (result.success) {
                                                // Show warning if some students had issues
                                                if (result.failedStudents?.length > 0 || result.skippedStudents?.length > 0) {
                                                    let warnMsg = result.message;
                                                    toast.info(warnMsg);
                                                } else {
                                                    toast.success(result.message || 'Đã gửi nhắc HP vào nhóm!');
                                                }
                                                // Ghi nhận lần nhắc nhóm — localStorage + DB (lastGroupReminderDate riêng)
                                                const reminderDate = new Date().toISOString();
                                                const allInvIds: string[] = [];
                                                for (const { student, invoice: inv } of unpaidList) {
                                                    addReminderEntry({
                                                        studentId: student.id,
                                                        studentName: student.name,
                                                        parentName: student.parentName,
                                                        phone: student.parentPhone || student.phone || '',
                                                        method: 'text',
                                                        source: 'class_group',
                                                        amount: inv.amount,
                                                    });
                                                    allInvIds.push(inv.id);
                                                }
                                                if (allInvIds.length > 0) {
                                                    markGroupReminder({ invoiceIds: allInvIds, reminderDate }).catch(console.warn);
                                                }
                                                setTuitionReminderModal({ isOpen: false, cls: null });
                                            } else {
                                                toast.error(result.error || 'Lỗi gửi nhắc HP nhóm');
                                            }
                                        } catch (err: any) {
                                            toast.error(err.message || 'Lỗi kết nối');
                                        } finally {
                                            // Cleanup uploaded images
                                            for (const st of studentsToSend) {
                                                if (st.imageId) deleteDebtNoticeImage(st.imageId);
                                            }
                                            setIsSendingTuitionReminder(false);
                                            setTuitionProgress('');
                                            setTuitionImageInvoice(null);
                                        }
                                    }}
                                >
                                    📢 {tuitionProgress || `Gửi nhắc HP vào nhóm (${unpaidList.length} HS)`}
                                </Button>
                            </>
                        );
                    })()}
                </div>
            </Modal>

            {/* Hidden TuitionFeeNotice for group tuition image generation */}
            <div ref={tuitionImageRef} style={{ position: 'absolute', left: '-9999px', width: '700px' }}>
                {tuitionImageInvoice && (
                    <TuitionFeeNotice
                        invoice={tuitionImageInvoice}
                        mode="print"
                    />
                )}
            </div>
        </div>
    );
};

// === Zalo Group Picker ===
const ZaloGroupPicker: React.FC<{ onSelect: (groupId: string) => void }> = ({ onSelect }) => {
    const { toast } = useToast();
    const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleScan = async () => {
        setIsScanning(true);
        try {
            const result = await sllScanGroups();
            if (result.ok && result.groups) {
                setGroups(result.groups);
                setShowDropdown(true);
                if (result.groups.length === 0) {
                    toast.info('Không tìm thấy nhóm Zalo nào');
                }
            } else {
                toast.error(result.error || 'Không quét được nhóm');
            }
        } catch (e: any) {
            toast.error(e.message || 'Lỗi kết nối SLL');
        } finally {
            setIsScanning(false);
        }
    };

    const filtered = groups.filter(g => 
        g.name.toLowerCase().includes(search.toLowerCase()) || g.id.includes(search)
    );

    return (
        <div className="relative" ref={dropdownRef}>
            <Button type="button" variant="secondary" size="sm" onClick={handleScan} isLoading={isScanning}>
                🔍 Quét nhóm
            </Button>
            {showDropdown && groups.length > 0 && (
                <div className="absolute right-0 top-full mt-1 w-80 max-h-64 overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50">
                    <div className="sticky top-0 bg-white dark:bg-gray-800 p-2 border-b">
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="form-input text-xs w-full"
                            placeholder="🔍 Tìm nhóm..."
                            autoFocus
                        />
                    </div>
                    {filtered.map(g => (
                        <button
                            key={g.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border-b border-gray-100 dark:border-gray-700 last:border-0"
                            onClick={() => {
                                onSelect(g.id);
                                setShowDropdown(false);
                                toast.success(`Đã chọn nhóm: ${g.name}`);
                            }}
                        >
                            <div className="font-medium truncate">{g.name}</div>
                            <div className="text-xs text-gray-400 font-mono">{g.id}</div>
                        </button>
                    ))}
                    {filtered.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-3">Không tìm thấy</p>
                    )}
                </div>
            )}
        </div>
    );
};