import React, { useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useData } from '../hooks/useDataContext';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { PersonStatus, SalaryType, UserRole } from '../types';
import { Button } from '../components/common/Button';
import { ICONS, ROUTES } from '../constants';
import { ConfirmationModal } from '../components/common/ConfirmationModal';

export const TeacherDetailScreen: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { state, deleteTeacher } = useData();
    const { role } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const { teachers, classes } = state;
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    const canManage = role === UserRole.ADMIN || role === UserRole.MANAGER;

    const teacher = useMemo(() => teachers.find(t => t.id === id), [teachers, id]);
    
    const assignedClasses = useMemo(() => 
        classes.filter(c => (c.teacherIds || []).includes(id!)),
    [classes, id]);

    if (!teacher) {
        return <div className="p-6 text-center text-red-500">Không tìm thấy giáo viên.</div>;
    }

    const handleEdit = () => {
        navigate(ROUTES.TEACHERS, { state: { editTeacherId: teacher.id, returnTo: `/teacher/${teacher.id}` } });
    };

    const handleDelete = async () => {
        try {
            await deleteTeacher(teacher.id);
            toast.success(`Đã xoá giáo viên ${teacher.name}`);
            navigate(ROUTES.TEACHERS, { replace: true });
        } catch (error: any) {
            toast.error(error.message || 'Lỗi khi xoá giáo viên.');
        }
        setDeleteConfirmOpen(false);
    };

    const handleDeleteClick = () => {
        const teacherHasClasses = state.classes.some(c => (c.teacherIds || []).includes(teacher.id));
        if (teacherHasClasses) {
            toast.error(`Không thể xóa giáo viên ${teacher.name} vì họ vẫn đang phụ trách lớp học.`);
            return;
        }
        setDeleteConfirmOpen(true);
    };

    return (
        <>
            <div className="space-y-6">
                <div className="card-base">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="flex-grow">
                            <h1 className="text-3xl font-bold">{teacher.name}</h1>
                            <p className="text-lg text-gray-500 dark:text-gray-400">{teacher.subject}</p>
                            <span className={`mt-1 px-2 inline-flex text-sm leading-5 font-semibold rounded-full ${teacher.status === PersonStatus.ACTIVE ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {teacher.status === PersonStatus.ACTIVE ? 'Đang hoạt động' : 'Đã nghỉ'}
                            </span>
                        </div>
                         {canManage && (
                            <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                                <Button variant="secondary" onClick={handleEdit} className="flex-1 sm:flex-none">{ICONS.edit} Sửa</Button>
                                <Button variant="danger" onClick={handleDeleteClick} className="flex-1 sm:flex-none">{ICONS.delete} Xóa</Button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6 text-gray-600 dark:text-gray-300 border-t pt-6 dark:border-gray-700">
                        <div>
                            <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider">Thông tin Liên hệ</h3>
                            <p><strong>Email:</strong> {teacher.email}</p>
                            <p><strong>Điện thoại:</strong> {teacher.phone}</p>
                            <p><strong>Địa chỉ:</strong> {teacher.address}</p>
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider">Thông tin Chuyên môn</h3>
                            <p><strong>Bằng cấp:</strong> {teacher.qualification}</p>
                            <p><strong>Chuyên môn:</strong> {teacher.subject}</p>
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider">Thông tin Lương</h3>
                            <p><strong>Hình thức:</strong> {teacher.salaryType === SalaryType.MONTHLY ? 'Lương cứng (tháng)' : 'Lương theo buổi'}</p>
                            <p><strong>Mức lương:</strong> {teacher.rate.toLocaleString('vi-VN')} VND</p>
                        </div>
                    </div>
                </div>

                <div className="card-base">
                    <h2 className="text-xl font-semibold mb-4">Các lớp đang phụ trách</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {assignedClasses.length > 0 ? (
                            assignedClasses.map(c => (
                                <Link key={c.id} to={`/class/${c.id}`} className="block p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors shadow-sm">
                                    <p className="font-semibold text-primary">{c.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{c.subject} - Sĩ số: {(c.studentIds || []).length}</p>
                                </Link>
                            ))
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 col-span-full text-center py-4">Giáo viên chưa được phân công vào lớp học nào.</p>
                        )}
                    </div>
                </div>
            </div>
            <ConfirmationModal
                isOpen={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                onConfirm={handleDelete}
                title="Xác nhận Xóa Giáo viên"
                message={<p>Bạn có chắc chắn muốn xóa giáo viên <strong>{teacher?.name}</strong>?</p>}
            />
        </>
    );
};