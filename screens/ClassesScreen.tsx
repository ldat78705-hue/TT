import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../hooks/useDataContext';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { ICONS } from '../constants';
import { Class, UserRole, FeeType, ClassSchedule, Teacher, Student, Room, PersonStatus } from '../types';
import { CurrencyInput } from '../components/common/CurrencyInput';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { ListItemCard } from '../components/common/ListItemCard';

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
}> = ({ cls, onSubmit, onCancel, teachers, students, rooms }) => {

    const initialSchedule: ClassSchedule = { dayOfWeek: 'Monday', startTime: '18:00', endTime: '19:30' };
    const [formData, setFormData] = useState<Class>(() => {
        const defaults = {
            id: '',
            name: '',
            subject: '',
            teacherIds: [],
            studentIds: [],
            fee: { type: FeeType.MONTHLY, amount: 0 },
            schedule: [initialSchedule],
        };
        const { studentIds, teacherIds, ...restCls } = cls || {};
        return { ...defaults, ...restCls, studentIds: studentIds || [], teacherIds: teacherIds || [] };
    });
     const [errors, setErrors] = useState<Partial<Record<keyof Class, string | string[]>>>({});
    const idInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        idInputRef.current?.focus();
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
                        <input ref={idInputRef} type="text" name="id" value={formData.id} onChange={handleChange} className="form-input mt-1" />
                        {errors.id && <p className="text-red-500 text-xs mt-1">{errors.id}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Tên lớp học <span className="text-red-500">*</span></label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} className="form-input mt-1" />
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Môn học</label>
                        <input type="text" name="subject" value={formData.subject} onChange={handleChange} className="form-input mt-1" required />
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
    const { state, addClass, updateClass, deleteClass } = useData();
    const { toast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();
    const { students, teachers, classes } = state;
    const { user, role } = useAuth();
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingClass, setEditingClass] = useState<Class | undefined>(undefined);
    const [confirmModalState, setConfirmModalState] = useState<{ isOpen: boolean; class: Class | null }>({ isOpen: false, class: null });
    const [searchQuery, setSearchQuery] = useState('');

    const canManage = role === UserRole.ADMIN || role === UserRole.MANAGER;
    const canDoAttendance = role === UserRole.ADMIN || role === UserRole.MANAGER || role === UserRole.TEACHER;

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

    const userClasses = useMemo(() => role === UserRole.TEACHER
        ? classes.filter(c => (c.teacherIds || []).includes((user as Teacher)?.id))
        : classes, [classes, role, user]);

    const filteredClasses = useMemo(() => {
        if (!searchQuery.trim()) return userClasses;
        const queryWords = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
        return userClasses.filter(c => {
            const searchableText = `${c.id} ${c.name} ${c.subject} ${getTeacherNames(c.teacherIds)}`.toLowerCase();
            return queryWords.every(word => searchableText.includes(word));
        });
    }, [userClasses, searchQuery, teachers]);
    
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
             <div className="card-base p-4">
                <input 
                    type="text" 
                    placeholder="Tìm kiếm lớp học (mã, tên, môn, giáo viên)..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="form-input w-full"
                />
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
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">ID: {cls.id}</p>
                                    <p className="font-semibold">{cls.subject}</p>
                                    <p className="text-gray-500 dark:text-gray-400 mt-2">GV: {getTeacherNames(cls.teacherIds)}</p>
                                    <p className="text-gray-500 dark:text-gray-400">Sĩ số: {getActiveStudentCount(cls.studentIds)}</p>
                                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                                        {(cls.schedule || []).map((s, i) => (
                                            <div key={i}>{`${dayMap[s.dayOfWeek]}: ${s.startTime} - ${s.endTime}`}</div>
                                        ))}
                                    </div>
                                </div>
                                <div className="mt-4 flex justify-end items-center gap-2">
                                   {canManage && (
                                       <>
                                        <button onClick={() => handleOpenModal(cls)} className="text-indigo-600 hover:text-indigo-900 p-2 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/50" title="Sửa">{ICONS.edit}</button>
                                        <button onClick={() => handleDeleteClick(cls)} className="text-red-600 hover:text-red-900 p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50" title="Xóa">{ICONS.delete}</button>
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
                                    { label: "Sĩ số", value: getActiveStudentCount(cls.studentIds) },
                                    { label: "GV", value: getTeacherNames(cls.teacherIds) },
                                ]}
                                actions={
                                    <div className="flex items-center justify-end gap-2">
                                        {canDoAttendance && (
                                            <Link to={`/class/${cls.id}`} state={{ defaultTab: 'attendance' }}>
                                                <Button size="sm">Điểm danh</Button>
                                            </Link>
                                        )}
                                        {canManage && (
                                           <>
                                                <button onClick={() => handleOpenModal(cls)} className="p-2 rounded-full text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/50" title="Sửa">{ICONS.edit}</button>
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
                <ClassForm cls={editingClass} onSubmit={handleSubmit} onCancel={handleCloseModal} teachers={teachers} students={students} rooms={state.rooms || []} />
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
        </div>
    );
};