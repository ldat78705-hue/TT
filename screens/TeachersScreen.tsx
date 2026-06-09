import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../hooks/useDataContext';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { Table, SortConfig } from '../components/common/Table';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { ICONS } from '../constants';
import { PersonStatus, Teacher, UserRole, SalaryType } from '../types';
import { CurrencyInput } from '../components/common/CurrencyInput';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { Pagination } from '../components/common/Pagination';
import { ListItemCard } from '../components/common/ListItemCard';
import { ResetPasswordModal } from '../components/auth/ChangePasswordModal';

const TeacherForm: React.FC<{ teacher?: Teacher; onSubmit: (teacher: Teacher) => void; onCancel: () => void; }> = ({ teacher, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState<Partial<Teacher>>({
        id: '',
        name: '',
        email: '',
        phone: '',
        address: '',
        qualification: '',
        subject: '',
        status: PersonStatus.ACTIVE,
        salaryType: SalaryType.MONTHLY,
        rate: 0,
        dob: '',
        role: UserRole.TEACHER,
        createdAt: '',
        password: '',
        ...teacher,
    });
    const [errors, setErrors] = useState<Partial<Record<keyof Teacher, string>>>({});
    const idInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        idInputRef.current?.focus();
    }, []);
    
    const validate = () => {
        const newErrors: Partial<Record<keyof Teacher, string>> = {};
        if (!formData.id?.trim()) newErrors.id = "Mã giáo viên là bắt buộc.";
        if (!formData.name?.trim()) newErrors.name = "Họ tên là bắt buộc.";
        if (!formData.subject?.trim()) newErrors.subject = "Chuyên môn là bắt buộc.";
        if (!formData.dob) newErrors.dob = "Ngày sinh là bắt buộc.";
        if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = "Email không hợp lệ.";
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleRateChange = (amount: number) => {
        setFormData(prev => ({ ...prev, rate: amount }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(!validate()) return;
        
        const dataToSubmit: Partial<Teacher> = { ...formData };
        if (!dataToSubmit.password) {
            delete dataToSubmit.password;
        }
        onSubmit(dataToSubmit as Teacher);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <fieldset className="form-fieldset">
                <legend className="form-legend">Thông tin Tài khoản</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <label className="block text-sm font-medium">Mã Giáo viên <span className="text-red-500">*</span></label>
                        <input ref={idInputRef} type="text" name="id" value={formData.id} onChange={handleChange} className="form-input mt-1" />
                        {errors.id && <p className="text-red-500 text-xs mt-1">{errors.id}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Họ tên <span className="text-red-500">*</span></label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} className="form-input mt-1" />
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                    </div>
                     <div>
                        <label className="block text-sm font-medium">Ngày sinh <span className="text-red-500">*</span></label>
                        <input type="date" name="dob" value={formData.dob} onChange={handleChange} className="form-input mt-1" />
                        {errors.dob && <p className="text-red-500 text-xs mt-1">{errors.dob}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Email</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} className="form-input mt-1" />
                        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Mật khẩu</label>
                        <input type="password" name="password" value={formData.password || ''} onChange={handleChange} className="form-input mt-1" placeholder="Bỏ trống để dùng ngày sinh (ddmmyyyy)" />
                    </div>
                </div>
            </fieldset>

            <fieldset className="form-fieldset">
                <legend className="form-legend">Thông tin Chuyên môn & Liên lạc</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <label className="block text-sm font-medium">Chuyên môn <span className="text-red-500">*</span></label>
                        <input type="text" name="subject" value={formData.subject} onChange={handleChange} className="form-input mt-1" />
                        {errors.subject && <p className="text-red-500 text-xs mt-1">{errors.subject}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Bằng cấp</label>
                        <input type="text" name="qualification" value={formData.qualification} onChange={handleChange} className="form-input mt-1" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Số điện thoại</label>
                        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="form-input mt-1" />
                    </div>
                </div>
                 <div className="mt-4">
                    <label className="block text-sm font-medium">Địa chỉ</label>
                    <input type="text" name="address" value={formData.address} onChange={handleChange} className="form-input mt-1" />
                </div>
            </fieldset>

            <fieldset className="form-fieldset">
                <legend className="form-legend">Thông tin Lương & Trạng thái</legend>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <label className="block text-sm font-medium">Hình thức trả lương</label>
                        <select name="salaryType" value={formData.salaryType} onChange={handleChange} className="form-select mt-1">
                            <option value={SalaryType.MONTHLY}>Lương cứng (tháng)</option>
                            <option value={SalaryType.PER_SESSION}>Lương theo buổi dạy</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Mức lương (VND)</label>
                        <CurrencyInput value={formData.rate || 0} onChange={handleRateChange} className="form-input mt-1" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium">Trạng thái</label>
                        <select name="status" value={formData.status} onChange={handleChange} className="form-select mt-1">
                            <option value={PersonStatus.ACTIVE}>Đang dạy</option>
                            <option value={PersonStatus.INACTIVE}>Đã nghỉ</option>
                        </select>
                    </div>
                </div>
            </fieldset>

            <div className="flex justify-end space-x-4 pt-4 border-t dark:border-gray-700">
                <Button type="button" variant="secondary" onClick={onCancel}>Hủy</Button>
                <Button type="submit">{teacher ? 'Lưu thay đổi' : 'Thêm giáo viên'}</Button>
            </div>
        </form>
    );
};

export const TeachersScreen: React.FC = () => {
    const { state, addTeacher, updateTeacher, deleteTeacher } = useData();
    const { role } = useAuth();
    const { toast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingTeacher, setEditingTeacher] = useState<Teacher | undefined>(undefined);
    const [confirmModalState, setConfirmModalState] = useState<{ isOpen: boolean; teacher: Teacher | null }>({ isOpen: false, teacher: null });
    const [resetPasswordModalState, setResetPasswordModalState] = useState<{ isOpen: boolean; teacher: Teacher | null }>({ isOpen: false, teacher: null });
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<SortConfig<Teacher> | null>({ key: 'createdAt', direction: 'descending' });
    const ITEMS_PER_PAGE = 10;

    const canManage = role === UserRole.ADMIN || role === UserRole.MANAGER;
    
    const handleOpenModal = (teacher?: Teacher) => {
        setEditingTeacher(teacher);
        setModalOpen(true);
    };

    useEffect(() => {
        const { editTeacherId } = location.state || {};
        if (editTeacherId && !isModalOpen) {
            const teacherToEdit = state.teachers.find(t => t.id === editTeacherId);
            if (teacherToEdit) {
                handleOpenModal(teacherToEdit);
            }
        }
    }, [location.state, state.teachers, isModalOpen]);

    const handleSort = (key: keyof Teacher) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const filteredTeachers = useMemo(() => {
        if (!searchQuery.trim()) return state.teachers;
        const queryWords = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
        return state.teachers.filter(t => {
            const searchableText = `${t.id} ${t.name} ${t.email || ''} ${t.subject}`.toLowerCase();
            return queryWords.every(word => searchableText.includes(word));
        });
    }, [state.teachers, searchQuery]);

    const sortedTeachers = useMemo(() => {
        let sortableItems = [...filteredTeachers];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                if (aValue == null || bValue == null) return 0;
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [filteredTeachers, sortConfig]);
    
    const totalPages = Math.ceil(sortedTeachers.length / ITEMS_PER_PAGE);
    const paginatedTeachers = sortedTeachers.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        } else if (currentPage === 0 && totalPages > 0) {
            setCurrentPage(1);
        }
    }, [currentPage, totalPages]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, sortConfig]);


    const columns = [
        { header: 'Mã GV', accessor: 'id' as keyof Teacher, sortable: true },
        { 
            header: 'Họ tên', 
            accessor: (item: Teacher) => (
                <Link to={`/teacher/${item.id}`} className="text-primary dark:text-indigo-400 hover:underline font-semibold">
                    {item.name}
                </Link>
            ),
            sortable: true,
            sortKey: 'name' as keyof Teacher,
        },
        { header: 'Chuyên môn', accessor: 'subject' as keyof Teacher, sortable: true },
        { header: 'Email', accessor: 'email' as keyof Teacher, sortable: true },
        { header: 'Số điện thoại', accessor: 'phone' as keyof Teacher },
        { header: 'Trạng thái', accessor: (item: Teacher) => (
            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                item.status === PersonStatus.ACTIVE ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
                {item.status === PersonStatus.ACTIVE ? 'Đang dạy' : 'Đã nghỉ'}
            </span>
        ), sortable: true, sortKey: 'status' as keyof Teacher},
    ];

    const handleCloseModal = () => {
        setEditingTeacher(undefined);
        setModalOpen(false);
        const { returnTo } = location.state || {};
        if (returnTo) {
            navigate(returnTo, { replace: true, state: {} });
        }
    };

    const handleSubmit = async (data: Teacher) => {
        const { returnTo } = location.state || {};
        try {
            if (editingTeacher) {
                await updateTeacher({ originalId: editingTeacher.id, updatedTeacher: data });
                toast.success(`Đã cập nhật thông tin giáo viên ${data.name}`);
                setModalOpen(false);
                setEditingTeacher(undefined);
                if (returnTo) {
                    navigate(`/teacher/${data.id}`, { replace: true, state: {} });
                }
            } else {
                await addTeacher(data);
                toast.success(`Đã thêm giáo viên mới ${data.name}`);
                handleCloseModal();
            }
        } catch (error: any) {
            toast.error(error.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
        }
    };

    const handleDeleteClick = (teacher: Teacher) => {
        const teacherHasClasses = state.classes.some(c => (c.teacherIds || []).includes(teacher.id));
        if (teacherHasClasses) {
            toast.error(`Không thể xóa giáo viên ${teacher.name} vì họ vẫn đang phụ trách lớp học.`);
            return;
        }
        setConfirmModalState({ isOpen: true, teacher });
    };

    const handleConfirmDelete = async () => {
        if (confirmModalState.teacher) {
            try {
                await deleteTeacher(confirmModalState.teacher.id);
                toast.success(`Đã xóa giáo viên ${confirmModalState.teacher.name}`);
            } catch (error: any) {
                toast.error(error.message || 'Đã xảy ra lỗi khi xóa.');
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold">Quản lý Giáo viên</h1>
                {canManage && (
                    <Button onClick={() => handleOpenModal()}>
                        {ICONS.plus} Thêm giáo viên
                    </Button>
                )}
            </div>
             <div className="mb-4">
                <input 
                    type="text" 
                    placeholder="Tìm kiếm giáo viên (mã, tên, email, chuyên môn)..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="form-input w-full"
                />
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
                <Table<Teacher>
                    columns={columns}
                    data={paginatedTeachers}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    actions={canManage ? (teacher) => (
                        <>
                            <button onClick={() => setResetPasswordModalState({ isOpen: true, teacher: teacher })} className="text-gray-500 hover:text-gray-800" title="Đặt lại mật khẩu">{React.cloneElement(ICONS.key as React.ReactElement<{ width?: number | string; height?: number | string }>, {width: 20, height: 20})}</button>
                            <button onClick={() => handleOpenModal(teacher)} className="text-indigo-600 hover:text-indigo-900">{ICONS.edit}</button>
                            <button onClick={() => handleDeleteClick(teacher)} className="text-red-600 hover:text-red-900">{ICONS.delete}</button>
                        </>
                    ) : undefined}
                />
            </div>
            
            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {paginatedTeachers.map(teacher => (
                    <ListItemCard
                        key={teacher.id}
                        title={
                            <Link to={`/teacher/${teacher.id}`} className="font-semibold text-primary hover:underline">
                                {teacher.name}
                            </Link>
                        }
                        details={[
                            { label: "Mã GV", value: teacher.id },
                            { label: "Môn", value: teacher.subject },
                        ]}
                         status={{
                            text: teacher.status === PersonStatus.ACTIVE ? 'Đang dạy' : 'Đã nghỉ',
                            colorClasses: teacher.status === PersonStatus.ACTIVE ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }}
                        actions={canManage ? (
                           <div className="flex items-center space-x-2">
                                <button onClick={() => setResetPasswordModalState({ isOpen: true, teacher: teacher })} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" title="Đặt lại mật khẩu">{React.cloneElement(ICONS.key as React.ReactElement<{ width?: number | string; height?: number | string }>, {width: 20, height: 20})}</button>
                                <button onClick={() => handleOpenModal(teacher)} className="p-2 rounded-full text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/50" title="Sửa">{ICONS.edit}</button>
                                <button onClick={() => handleDeleteClick(teacher)} className="p-2 rounded-full text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50" title="Xóa">{ICONS.delete}</button>
                           </div>
                        ) : undefined}
                    />
                ))}
            </div>

            {paginatedTeachers.length > 0 && (
                 <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalItems={sortedTeachers.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                />
            )}
           
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingTeacher ? 'Chỉnh sửa Giáo viên' : 'Thêm Giáo viên mới'}>
                <TeacherForm teacher={editingTeacher} onSubmit={handleSubmit} onCancel={handleCloseModal} />
            </Modal>
            <ConfirmationModal
                isOpen={confirmModalState.isOpen}
                onClose={() => setConfirmModalState({ isOpen: false, teacher: null })}
                onConfirm={handleConfirmDelete}
                title="Xác nhận Xóa Giáo viên"
                message={<p>Bạn có chắc chắn muốn xóa giáo viên <strong>{confirmModalState.teacher?.name}</strong>?</p>}
            />
            <ResetPasswordModal
                isOpen={resetPasswordModalState.isOpen}
                onClose={() => setResetPasswordModalState({ isOpen: false, teacher: null })}
                user={resetPasswordModalState.teacher}
                role={UserRole.TEACHER}
            />
        </div>
    );
};