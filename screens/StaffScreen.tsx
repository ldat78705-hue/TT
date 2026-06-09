import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useData } from '../hooks/useDataContext';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { Table, SortConfig } from '../components/common/Table';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { ICONS } from '../constants';
import { PersonStatus, Staff, UserRole } from '../types';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { Pagination } from '../components/common/Pagination';
import { ListItemCard } from '../components/common/ListItemCard';
import { ResetPasswordModal } from '../components/auth/ChangePasswordModal';

const StaffForm: React.FC<{ staff?: Staff; onSubmit: (staff: Staff) => void; onCancel: () => void; }> = ({ staff, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState<Partial<Staff>>({
        id: '',
        name: '',
        email: '',
        phone: '',
        address: '',
        position: '',
        status: PersonStatus.ACTIVE,
        role: UserRole.MANAGER,
        dob: '',
        createdAt: '',
        password: '',
        ...staff,
    });
    const [errors, setErrors] = useState<Partial<Record<keyof Staff, string>>>({});
    const idInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        idInputRef.current?.focus();
    }, []);
    
     const validate = () => {
        const newErrors: Partial<Record<keyof Staff, string>> = {};
        if (!formData.id?.trim()) newErrors.id = "Mã nhân viên là bắt buộc.";
        if (!formData.name?.trim()) newErrors.name = "Họ tên là bắt buộc.";
        if (!formData.position?.trim()) newErrors.position = "Chức vụ là bắt buộc.";
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(!validate()) return;
        
        const dataToSubmit: Partial<Staff> = { ...formData };
        if (!dataToSubmit.password) {
            delete dataToSubmit.password;
        }
        onSubmit(dataToSubmit as Staff);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <fieldset className="form-fieldset">
                <legend className="form-legend">Thông tin Tài khoản</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <label className="block text-sm font-medium">Mã Nhân viên <span className="text-red-500">*</span></label>
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
                <legend className="form-legend">Thông tin Công việc</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <label className="block text-sm font-medium">Chức vụ <span className="text-red-500">*</span></label>
                        <input type="text" name="position" value={formData.position} onChange={handleChange} className="form-input mt-1" />
                        {errors.position && <p className="text-red-500 text-xs mt-1">{errors.position}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Vai trò</label>
                        <select name="role" value={formData.role} onChange={handleChange} className="form-select mt-1">
                            <option value={UserRole.MANAGER}>Quản lý</option>
                            <option value={UserRole.ACCOUNTANT}>Kế toán</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Trạng thái</label>
                        <select name="status" value={formData.status} onChange={handleChange} className="form-select mt-1">
                            <option value={PersonStatus.ACTIVE}>Đang làm việc</option>
                            <option value={PersonStatus.INACTIVE}>Đã nghỉ</option>
                        </select>
                    </div>
                </div>
            </fieldset>

            <fieldset className="form-fieldset">
                <legend className="form-legend">Thông tin Liên lạc</legend>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
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

            <div className="flex justify-end space-x-4 pt-4 border-t dark:border-gray-700">
                <Button type="button" variant="secondary" onClick={onCancel}>Hủy</Button>
                <Button type="submit">{staff ? 'Lưu thay đổi' : 'Thêm nhân viên'}</Button>
            </div>
        </form>
    );
};


export const StaffScreen: React.FC = () => {
    const { state, addStaff, updateStaff, deleteStaff } = useData();
    const { role } = useAuth();
    const { toast } = useToast();
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<Staff | undefined>(undefined);
    const [confirmModalState, setConfirmModalState] = useState<{ isOpen: boolean; staff: Staff | null }>({ isOpen: false, staff: null });
    const [resetPasswordModalState, setResetPasswordModalState] = useState<{ isOpen: boolean; staff: Staff | null }>({ isOpen: false, staff: null });
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<SortConfig<Staff> | null>({ key: 'createdAt', direction: 'descending' });
    const ITEMS_PER_PAGE = 10;

    const canManage = role === UserRole.ADMIN || role === UserRole.MANAGER;

    const handleSort = (key: keyof Staff) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const filteredStaff = useMemo(() => {
        if (!searchQuery.trim()) return state.staff;
        const queryWords = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
        return state.staff.filter(s => {
            const searchableText = `${s.id} ${s.name} ${s.email || ''} ${s.position}`.toLowerCase();
            return queryWords.every(word => searchableText.includes(word));
        });
    }, [state.staff, searchQuery]);
    
    const sortedStaff = useMemo(() => {
        let sortableItems = [...filteredStaff];
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
    }, [filteredStaff, sortConfig]);

    const totalPages = Math.ceil(sortedStaff.length / ITEMS_PER_PAGE);
    const paginatedStaff = sortedStaff.slice(
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
        { header: 'Mã NV', accessor: 'id' as keyof Staff, sortable: true },
        { header: 'Họ tên', accessor: 'name' as keyof Staff, sortable: true },
        { header: 'Chức vụ', accessor: 'position' as keyof Staff, sortable: true },
        { header: 'Email', accessor: 'email' as keyof Staff, sortable: true },
        { header: 'Số điện thoại', accessor: 'phone' as keyof Staff },
        { header: 'Trạng thái', accessor: (item: Staff) => (
            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                item.status === PersonStatus.ACTIVE ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
                {item.status === PersonStatus.ACTIVE ? 'Đang làm việc' : 'Đã nghỉ'}
            </span>
        ), sortable: true, sortKey: 'status' as keyof Staff},
    ];
    
    const handleOpenModal = (staff?: Staff) => {
        setEditingStaff(staff);
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingStaff(undefined);
        setModalOpen(false);
    };

    const handleSubmit = async (data: Staff) => {
        try {
            if (editingStaff) {
                await updateStaff({ originalId: editingStaff.id, updatedStaff: data });
                toast.success(`Đã cập nhật nhân viên ${data.name}`);
            } else {
                await addStaff(data);
                toast.success(`Đã thêm nhân viên mới ${data.name}`);
            }
            handleCloseModal();
        } catch (error: any) {
            toast.error(error.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
        }
    };

    const handleDeleteClick = (staff: Staff) => {
        setConfirmModalState({ isOpen: true, staff });
    };

    const handleConfirmDelete = async () => {
        if (confirmModalState.staff) {
            try {
                await deleteStaff(confirmModalState.staff.id);
                toast.success(`Đã xóa nhân viên ${confirmModalState.staff.name}`);
            } catch (error) {
                toast.error('Đã xảy ra lỗi khi xóa. Vui lòng thử lại.');
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold">Quản lý Nhân viên</h1>
                {canManage && (
                    <Button onClick={() => handleOpenModal()}>
                        {ICONS.plus} Thêm nhân viên
                    </Button>
                )}
            </div>
             <div className="mb-4">
                <input 
                    type="text" 
                    placeholder="Tìm kiếm nhân viên (mã, tên, email, chức vụ)..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="form-input w-full"
                />
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
                <Table<Staff>
                    columns={columns}
                    data={paginatedStaff}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    actions={canManage ? (staff) => (
                        <>
                            <button onClick={() => setResetPasswordModalState({ isOpen: true, staff: staff })} className="text-gray-500 hover:text-gray-800" title="Đặt lại mật khẩu">{React.cloneElement(ICONS.key as React.ReactElement<{ width?: number | string; height?: number | string }>, {width: 20, height: 20})}</button>
                            <button onClick={() => handleOpenModal(staff)} className="text-indigo-600 hover:text-indigo-900">{ICONS.edit}</button>
                            <button onClick={() => handleDeleteClick(staff)} className="text-red-600 hover:text-red-900">{ICONS.delete}</button>
                        </>
                    ) : undefined}
                />
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {paginatedStaff.map(staff => (
                    <ListItemCard
                        key={staff.id}
                        title={<span className="font-semibold">{staff.name}</span>}
                        details={[
                            { label: "Mã NV", value: staff.id },
                            { label: "Chức vụ", value: staff.position },
                        ]}
                         status={{
                            text: staff.status === PersonStatus.ACTIVE ? 'Làm việc' : 'Đã nghỉ',
                            colorClasses: staff.status === PersonStatus.ACTIVE ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }}
                        actions={canManage ? (
                           <div className="flex items-center space-x-2">
                               <button onClick={() => setResetPasswordModalState({ isOpen: true, staff: staff })} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" title="Đặt lại mật khẩu">{React.cloneElement(ICONS.key as React.ReactElement<{ width?: number | string; height?: number | string }>, {width: 20, height: 20})}</button>
                               <button onClick={() => handleOpenModal(staff)} className="p-2 rounded-full text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/50" title="Sửa">{ICONS.edit}</button>
                               <button onClick={() => handleDeleteClick(staff)} className="p-2 rounded-full text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50" title="Xóa">{ICONS.delete}</button>
                           </div>
                        ) : undefined}
                    />
                ))}
            </div>

            {paginatedStaff.length > 0 && (
                 <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalItems={sortedStaff.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                />
            )}
           
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingStaff ? 'Chỉnh sửa Nhân viên' : 'Thêm Nhân viên mới'}>
                <StaffForm staff={editingStaff} onSubmit={handleSubmit} onCancel={handleCloseModal} />
            </Modal>
            <ConfirmationModal
                isOpen={confirmModalState.isOpen}
                onClose={() => setConfirmModalState({ isOpen: false, staff: null })}
                onConfirm={handleConfirmDelete}
                title="Xác nhận Xóa Nhân viên"
                message={<p>Bạn có chắc chắn muốn xoá nhân viên <strong>{confirmModalState.staff?.name}</strong>?</p>}
            />
            <ResetPasswordModal
                isOpen={resetPasswordModalState.isOpen}
                onClose={() => setResetPasswordModalState({ isOpen: false, staff: null })}
                user={resetPasswordModalState.staff}
                role={resetPasswordModalState.staff?.role || null}
            />
        </div>
    );
};