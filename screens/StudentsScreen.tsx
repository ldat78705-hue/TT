import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../hooks/useDataContext';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { Table, SortConfig } from '../components/common/Table';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { ICONS } from '../constants';
import { PersonStatus, Student, UserRole, Class } from '../types';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { Pagination } from '../components/common/Pagination';
import { ResetPasswordModal } from '../components/auth/ChangePasswordModal';
import { PaymentModal } from '../components/finance/PaymentModal';
import { ExportButton } from '../components/common/ExportButton';
import { zaloSendTuition, zaloGetFollowersList } from '../services/api';
import { printHtml } from '../utils/html';
import { copyAndOpenZalo, buildDebtMessage } from '../utils/zaloDeepLink';

const removeAccents = (str: string) => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
};

const ClassSelector: React.FC<{
    allClasses: Class[];
    selectedClassIds: string[];
    onChange: (selectedIds: string[]) => void;
}> = ({ allClasses, selectedClassIds, onChange }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredClasses = useMemo(() => {
        const queryWords = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
        if (queryWords.length === 0) return allClasses;
        return allClasses.filter(cls =>
            queryWords.every(word => cls.name.toLowerCase().includes(word))
        );
    }, [allClasses, searchTerm]);

    const handleToggle = (classId: string) => {
        const newSelectedIds = selectedClassIds.includes(classId)
            ? selectedClassIds.filter(id => id !== classId)
            : [...selectedClassIds, classId];
        onChange(newSelectedIds);
    };

    return (
        <div className="border rounded-md dark:border-gray-600 bg-white dark:bg-gray-800">
            <div className="p-2 border-b dark:border-gray-600">
                <input
                    type="text"
                    placeholder="Tìm kiếm lớp học..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="form-input w-full p-2"
                />
            </div>
            <div className="max-h-60 overflow-y-auto p-2">
                {filteredClasses.length > 0 ? (
                    filteredClasses.map(cls => (
                        <label key={cls.id} className="flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedClassIds.includes(cls.id)}
                                onChange={() => handleToggle(cls.id)}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="ml-3 text-sm">{cls.name}</span>
                        </label>
                    ))
                ) : (
                    <p className="text-center text-sm text-gray-500 p-4">Không tìm thấy lớp học.</p>
                )}
            </div>
             <div className="p-2 border-t dark:border-gray-600 text-sm text-gray-500 dark:text-gray-400">
                Đã chọn: {selectedClassIds.length} lớp học
            </div>
        </div>
    );
};


const StudentForm: React.FC<{ 
    student?: Student; 
    onSubmit: (payload: { student: Student, classIds: string[] }) => void; 
    onCancel: () => void;
    allClasses: Class[];
    generatedId?: string;
    allTeachers: any[];
    allStaff: any[];
    allStudents: Student[];
}> = ({ student, onSubmit, onCancel, allClasses, generatedId, allTeachers, allStaff, allStudents }) => {
    const [formData, setFormData] = useState<Partial<Student>>({
        id: generatedId || '',
        name: '',
        email: generatedId ? `${generatedId}@thaydat.edu.vn` : '',
        phone: '',
        address: '',
        dob: '',
        parentName: '',
        status: PersonStatus.ACTIVE,
        createdAt: '',
        balance: 0,
        password: '',
        ...student,
    });
    const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
    const [errors, setErrors] = useState<Partial<Record<keyof Student, string>>>({});
    const [idWarning, setIdWarning] = useState('');
    const idInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        idInputRef.current?.focus();
        if (student) {
            const enrolledClassIds = allClasses
                .filter(c => c.studentIds.includes(student.id))
                .map(c => c.id);
            setSelectedClassIds(enrolledClassIds);
        }
    }, [student, allClasses]);

    const checkDuplicateId = (id: string) => {
        if (!id.trim() || (student && student.id === id)) { setIdWarning(''); return; }
        const upper = id.toUpperCase();
        if (upper === 'ADMIN' || upper === 'VIEWER') { setIdWarning('⚠️ Đây là tài khoản hệ thống, không thể sử dụng.'); return; }
        if (allStudents.some(s => s.id.toUpperCase() === upper && s.id !== student?.id)) { setIdWarning('⚠️ Mã này đã được sử dụng cho học viên khác.'); return; }
        if (allTeachers.some(t => t.id.toUpperCase() === upper)) { setIdWarning('⚠️ Mã này đã được sử dụng cho giáo viên.'); return; }
        if (allStaff.some(s => s.id.toUpperCase() === upper)) { setIdWarning('⚠️ Mã này đã được sử dụng cho nhân viên.'); return; }
        setIdWarning('');
    };
    
    const validate = () => {
        const newErrors: Partial<Record<keyof Student, string>> = {};
        if (!formData.id?.trim()) newErrors.id = "Mã học viên là bắt buộc.";
        if (!formData.name?.trim()) newErrors.name = "Họ tên là bắt buộc.";
        if (!formData.email?.trim()) {
            newErrors.email = "Email là bắt buộc.";
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = "Email không hợp lệ.";
        }
        if (idWarning) newErrors.id = idWarning;
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => {
            const newData = { ...prev, [name]: type === 'number' ? (value ? Number(value) : undefined) : value };
            
            // Auto-update email when ID changes, if email matches the pattern of the old ID
            if (name === 'id') {
                const prevId = prev.id || '';
                const currentEmail = prev.email || '';
                const defaultDomain = '@thaydat.edu.vn';
                
                // If email is empty OR exactly matches [prevId]@thaydat.edu.vn
                if (!currentEmail || currentEmail === `${prevId}${defaultDomain}`) {
                    newData.email = `${value}${defaultDomain}`;
                }
            }
            
            return newData;
        });
        if (name === 'id') checkDuplicateId(value);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
            const studentData = { ...formData };
            if (!studentData.password) {
                delete studentData.password;
            }
            onSubmit({ student: studentData as Student, classIds: selectedClassIds });
        }
    };

    const inputGroupClass = "grid grid-cols-1 md:grid-cols-2 gap-4";

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <fieldset className="form-fieldset">
                <legend className="form-legend">Thông tin cá nhân</legend>
                <div className={`${inputGroupClass} mt-2`}>
                    <div>
                        <label className="block text-sm font-medium">Mã Học viên <span className="text-red-500">*</span></label>
                        <input ref={idInputRef} type="text" name="id" value={formData.id} onChange={handleChange} className={`form-input mt-1 ${idWarning ? 'border-orange-400 ring-1 ring-orange-400' : ''}`} />
                        {errors.id && <p className="text-red-500 text-xs mt-1">{errors.id}</p>}
                        {idWarning && !errors.id && <p className="text-orange-500 text-xs mt-1 font-medium">{idWarning}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Họ tên <span className="text-red-500">*</span></label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} className="form-input mt-1" />
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Ngày sinh</label>
                        <input type="date" name="dob" value={formData.dob} onChange={handleChange} className="form-input mt-1" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Trạng thái</label>
                        <select name="status" value={formData.status} onChange={handleChange} className="form-select mt-1">
                            <option value={PersonStatus.ACTIVE}>Hoạt động</option>
                            <option value={PersonStatus.INACTIVE}>Tạm nghỉ</option>
                            <option value={PersonStatus.ARCHIVED}>Lưu trữ</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Miễn giảm học phí (%)</label>
                        <input type="number" name="discountPercentage" min="0" max="100" value={formData.discountPercentage || ''} onChange={handleChange} className="form-input mt-1" placeholder="Ví dụ: 50" />
                    </div>
                </div>
            </fieldset>

             <fieldset className="form-fieldset">
                <legend className="form-legend">Thông tin liên lạc & Tài khoản</legend>
                 <div className={`${inputGroupClass} mt-2`}>
                    <div>
                        <label className="block text-sm font-medium">Email <span className="text-red-500">*</span></label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} className="form-input mt-1" />
                        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Số điện thoại</label>
                        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="form-input mt-1" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Tên phụ huynh</label>
                        <input type="text" name="parentName" value={formData.parentName} onChange={handleChange} className="form-input mt-1" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">📱 SĐT Zalo Phụ huynh</label>
                        <input type="tel" name="parentPhone" value={formData.parentPhone || ''} onChange={handleChange} className="form-input mt-1" placeholder="SĐT đăng ký Zalo của PH" />
                        <p className="text-xs text-gray-400 mt-0.5">Để nhận thông báo vắng/học phí qua Zalo</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Mật khẩu</label>
                        <input type="password" name="password" value={formData.password || ''} onChange={handleChange} className="form-input mt-1" placeholder="Bỏ trống để dùng ngày sinh (ddmmyyyy)" />
                    </div>
                </div>
                 <div className="mt-4">
                    <label className="block text-sm font-medium">Địa chỉ</label>
                    <input type="text" name="address" value={formData.address} onChange={handleChange} className="form-input mt-1" />
                </div>
            </fieldset>

            <fieldset className="form-fieldset">
                <legend className="form-legend">Ghi danh Lớp học</legend>
                 <ClassSelector
                    allClasses={allClasses}
                    selectedClassIds={selectedClassIds}
                    onChange={setSelectedClassIds}
                />
            </fieldset>

            <div className="flex justify-end space-x-4 pt-4 border-t dark:border-gray-700">
                <Button type="button" variant="secondary" onClick={onCancel}>Hủy</Button>
                <Button type="submit">{student ? 'Lưu thay đổi' : 'Thêm học viên'}</Button>
            </div>
        </form>
    );
};


export const StudentsScreen: React.FC = () => {
    const { state, addStudent, updateStudent, deleteStudent, archiveStudent, restoreStudent } = useData();
    const { role } = useAuth();
    const { toast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState<Student | undefined>(undefined);
    const [confirmModalState, setConfirmModalState] = useState<{ isOpen: boolean; student: Student | null }>({ isOpen: false, student: null });
    const [resetPasswordModalState, setResetPasswordModalState] = useState<{ isOpen: boolean; student: Student | null }>({ isOpen: false, student: null });
    const [paymentModalState, setPaymentModalState] = useState<{ isOpen: boolean; student: Student | null }>({ isOpen: false, student: null });
    const [searchQuery, setSearchQuery] = useState('');
    const [classFilter, setClassFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState<string>('active_inactive');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<SortConfig<Student> | null>({ key: 'name', direction: 'ascending' });
    const ITEMS_PER_PAGE = 10;

    // QR Print State
    const [selectedForQR, setSelectedForQR] = useState<Set<string>>(new Set());
    const [showQRPrintModal, setShowQRPrintModal] = useState(false);
    const [qrLayout, setQrLayout] = useState<'8' | '10' | '12'>('10'); // cards per A4 page

    // Zalo Link State
    const [zaloLinkStudent, setZaloLinkStudent] = useState<Student | null>(null);
    const [zaloFollowers, setZaloFollowers] = useState<any[]>([]);
    const [zaloFollowersLoading, setZaloFollowersLoading] = useState(false);

    const canManage = role === UserRole.ADMIN || role === UserRole.MANAGER;

    const handleSort = (key: keyof Student) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handleOpenModal = (student?: Student) => {
        setEditingStudent(student);
        setModalOpen(true);
    };

    const generatedStudentId = useMemo(() => {
        let maxId = 0;
        const regex = /^HS(\d+)$/i;
        state.students.forEach(s => {
            const match = s.id.match(regex);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxId) maxId = num;
            }
        });
        return `HS${String(maxId + 1).padStart(3, '0')}`;
    }, [state.students]);

    useEffect(() => {
        const { editStudentId } = location.state || {};
        if (editStudentId && !isModalOpen) {
            const studentToEdit = state.students.find(s => s.id === editStudentId);
            if (studentToEdit) {
                handleOpenModal(studentToEdit);
            }
        }
    }, [location.state, state.students, isModalOpen]);

    const filteredStudents = useMemo(() => {
        let studentsToFilter = state.students;

        // Status filter
        if (statusFilter === 'active_inactive') {
            studentsToFilter = studentsToFilter.filter(s => s.status !== PersonStatus.ARCHIVED);
        } else if (statusFilter !== 'all') {
            studentsToFilter = studentsToFilter.filter(s => s.status === statusFilter);
        }

        if (classFilter !== 'all') {
            const selectedClass = state.classes.find(c => c.id === classFilter);
            if (selectedClass) {
                const studentIdsInClass = new Set(selectedClass.studentIds);
                studentsToFilter = studentsToFilter.filter(s => studentIdsInClass.has(s.id));
            }
        }

        if (!searchQuery.trim()) return studentsToFilter;
        
        const lowerQuery = searchQuery.toLowerCase().trim();
        const normalizedQuery = removeAccents(lowerQuery);
        const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);
        
        return studentsToFilter.filter(s => {
            const normalizedName = removeAccents(s.name.toLowerCase());
            const phoneMatch = (s.phone || '').includes(searchQuery.trim());
            const idMatch = s.id.toLowerCase().includes(lowerQuery);
            
            const nameParts = normalizedName.split(/\s+/);
            const lastName = nameParts[nameParts.length - 1] || '';
            let nameScore = 0;
            if (queryWords.length === 1 && lastName === queryWords[0]) nameScore = 5;
            else if (queryWords.length === 1 && lastName.startsWith(queryWords[0])) nameScore = 4;
            else if (queryWords.every(w => normalizedName.includes(w))) nameScore = 3;
            else if (normalizedName.includes(normalizedQuery)) nameScore = 2;

            // Check class names
            const studentClasses = state.classes.filter(c => c.studentIds.includes(s.id));
            const classMatch = studentClasses.some(c => {
                const normalizedClassName = removeAccents(c.name.toLowerCase());
                return queryWords.every(word => normalizedClassName.includes(word));
            });

            // Check tags
            const tagMatch = (s.tags || []).some(tag => removeAccents(tag.toLowerCase()).includes(normalizedQuery));

            return nameScore > 0 || phoneMatch || idMatch || classMatch || tagMatch;
        });
    }, [state.students, state.classes, searchQuery, classFilter, statusFilter]);
    
    const sortedStudents = useMemo(() => {
        let sortableItems = [...filteredStudents];
        
        if (searchQuery.trim()) {
            const normalizedQuery = removeAccents(searchQuery.toLowerCase().trim());
            const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);

            const getScore = (student: Student) => {
                // Phone match is highest priority
                if ((student.phone || '').includes(searchQuery.trim())) {
                    return 4;
                }
                
                const normalizedName = removeAccents(student.name.toLowerCase());
                const nameParts = normalizedName.split(' ');
                const lastName = nameParts[nameParts.length - 1] || '';

                // Last name match is second priority
                if (queryWords.some(word => lastName.startsWith(word))) {
                    return 3;
                }

                // Any other name match is third priority
                if (queryWords.every(word => normalizedName.includes(word))) {
                    return 2;
                }

                // Class match is lowest priority
                const studentClasses = state.classes.filter(c => c.studentIds.includes(student.id));
                const classMatch = studentClasses.some(c => {
                    const normalizedClassName = removeAccents(c.name.toLowerCase());
                    return queryWords.every(word => normalizedClassName.includes(word));
                });
                if (classMatch) {
                    return 1;
                }

                return 0;
            };

            sortableItems.sort((a, b) => {
                const scoreA = getScore(a);
                const scoreB = getScore(b);

                if (scoreA !== scoreB) {
                    return scoreB - scoreA; // Higher score comes first
                }

                // If scores are equal, sort by name alphabetically
                return a.name.localeCompare(b.name, 'vi');
            });

        } else if (sortConfig !== null) {
            // Original sorting logic when not searching
            const getLastName = (fullName: string) => {
                if (!fullName) return '';
                const parts = fullName.trim().split(/\s+/);
                return parts[parts.length - 1];
            };

            sortableItems.sort((a, b) => {
                if (sortConfig.key === 'name') {
                    const lastNameA = getLastName(a.name);
                    const lastNameB = getLastName(b.name);
                    
                    const lastNameComparison = lastNameA.localeCompare(lastNameB, 'vi');
                    
                    if (lastNameComparison !== 0) {
                        return sortConfig.direction === 'ascending' ? lastNameComparison : -lastNameComparison;
                    }

                    // If last names are the same, sort by full name for stability
                    const fullNameComparison = a.name.localeCompare(b.name, 'vi');
                    return sortConfig.direction === 'ascending' ? fullNameComparison : -fullNameComparison;
                }

                // Fallback for other columns
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                
                if (aValue == null || bValue == null) return 0;

                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [filteredStudents, sortConfig, searchQuery, state.classes]);

    const totalPages = Math.ceil(sortedStudents.length / ITEMS_PER_PAGE);
    const paginatedStudents = sortedStudents.slice(
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
    }, [searchQuery, classFilter, statusFilter, sortConfig]);


    const columns = [
        { header: 'Mã HV', accessor: 'id' as keyof Student, sortable: true },
        { 
            header: 'Họ tên', 
            accessor: (item: Student) => (
                <div>
                    <Link to={`/student/${item.id}`} className="text-primary dark:text-indigo-400 hover:underline font-semibold">
                        {item.name}
                    </Link>
                    {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                            {item.tags.map(tag => (
                                <span key={tag} className="px-1.5 py-0 text-[9px] rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-medium">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            ),
            sortable: true,
            sortKey: 'name' as keyof Student,
        },
        { header: 'Số điện thoại', accessor: 'phone' as keyof Student },
        {
            header: 'Lớp học',
            accessor: (student: Student) => {
                const enrolledClasses = state.classes.filter(c => c.studentIds.includes(student.id));
                if (enrolledClasses.length === 0) return <span className="text-gray-400 italic text-xs">Chưa có lớp</span>;
                return (
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {enrolledClasses.map(c => (
                            <span key={c.id} className="px-2 py-0.5 text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full truncate max-w-full">
                                {c.name}
                            </span>
                        ))}
                    </div>
                );
            }
        },
        { 
            header: 'Số dư', 
            accessor: (item: Student) => {
                const balanceText = (
                    <span className={`font-semibold ${item.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {item.balance.toLocaleString('vi-VN')} ₫
                    </span>
                );

                if (role === UserRole.VIEWER || item.balance >= 0) {
                    return balanceText;
                }

                return (
                    <button 
                        onClick={() => setPaymentModalState({ isOpen: true, student: item })}
                        className="font-semibold text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:underline"
                        title="Ghi nhận thanh toán"
                    >
                        {item.balance.toLocaleString('vi-VN')} ₫
                    </button>
                );
            },
            sortable: true,
            sortKey: 'balance' as keyof Student
        },
        { header: 'Trạng thái', accessor: (item: Student) => (
            <div className="flex flex-col">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full w-fit ${
                    item.status === PersonStatus.ACTIVE ? 'bg-green-100 text-green-800' : item.status === PersonStatus.ARCHIVED ? 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400' : 'bg-red-100 text-red-800'
                }`}>
                    {item.status === PersonStatus.ACTIVE ? 'Hoạt động' : item.status === PersonStatus.ARCHIVED ? 'Lưu trữ' : 'Tạm nghỉ'}
                </span>
                {item.statusChangedAt && (
                    <span className="text-[10px] text-gray-500 mt-1">
                        Từ: {new Date(item.statusChangedAt).toLocaleDateString('vi-VN')}
                    </span>
                )}
            </div>
        ), sortable: true, sortKey: 'status' as keyof Student },
    ];

    const handleCloseModal = () => {
        setEditingStudent(undefined);
        setModalOpen(false);
        const { returnTo } = location.state || {};
        if (returnTo) {
            navigate(returnTo, { replace: true, state: {} });
        }
    };

    const handleSubmit = async (payload: { student: Student; classIds: string[] }) => {
        const { returnTo } = location.state || {};
        try {
            if (editingStudent) {
                await updateStudent({ 
                    originalId: editingStudent.id, 
                    updatedStudent: payload.student,
                    classIds: payload.classIds 
                });
                toast.success(`Đã cập nhật thông tin học viên ${payload.student.name}`);
                setModalOpen(false);
                setEditingStudent(undefined);
                if (returnTo) {
                    navigate(`/student/${payload.student.id}`, { replace: true, state: {} });
                }
            } else {
                await addStudent(payload);
                toast.success(`Đã thêm học viên mới ${payload.student.name}`);
                handleCloseModal();
            }
        } catch (error: any) {
            toast.error(error.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
        }
    };

    const handleDeleteClick = (student: Student) => {
        setConfirmModalState({ isOpen: true, student: student });
    };

    const handleConfirmDelete = async () => {
        if (confirmModalState.student) {
            try {
                await deleteStudent(confirmModalState.student.id);
                toast.success(`Đã xoá học viên ${confirmModalState.student.name}`);
            } catch (error) {
                toast.error('Đã xảy ra lỗi khi xóa. Vui lòng thử lại.');
            }
        }
    };


    const exportData = useMemo(() => sortedStudents.map(s => {
        const enrolledClasses = state.classes.filter(c => c.studentIds.includes(s.id)).map(c => c.name).join(', ');
        return {
            id: s.id,
            name: s.name,
            dob: s.dob || '',
            phone: s.phone || '',
            parentName: s.parentName || '',
            classes: enrolledClasses || 'Chưa xếp lớp',
            status: s.status === PersonStatus.ACTIVE ? 'Hoạt động' : s.status === PersonStatus.ARCHIVED ? 'Lưu trữ' : 'Tạm nghỉ',
            balance: s.balance
        };
    }), [sortedStudents, state.classes]);

    const exportColumns = {
        id: 'Mã HV',
        name: 'Họ tên',
        dob: 'Ngày sinh',
        phone: 'SĐT',
        parentName: 'Tên Phụ huynh',
        classes: 'Lớp học',
        status: 'Trạng thái',
        balance: 'Số dư'
    };

    const handleToggleQRSelect = (id: string) => {
        setSelectedForQR(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleSelectAllQR = () => {
        if (selectedForQR.size === sortedStudents.length) {
            setSelectedForQR(new Set());
        } else {
            setSelectedForQR(new Set(sortedStudents.map(s => s.id)));
        }
    };

    const handlePrintQRCards = () => {
        const selectedStudents = sortedStudents.filter(s => selectedForQR.has(s.id));
        if (selectedStudents.length === 0) return;

        const cardsPerPage = parseInt(qrLayout);
        // Layout configs for A4
        const layouts: Record<string, { cols: number; cardW: string; cardH: string; qrSize: string; fontSize: string; idSize: string; classSize: string; gap: string }> = {
            '8':  { cols: 2, cardW: '88mm', cardH: '52mm', qrSize: '40mm', fontSize: '14px', idSize: '11px', classSize: '10px', gap: '4mm' },
            '10': { cols: 2, cardW: '88mm', cardH: '42mm', qrSize: '34mm', fontSize: '13px', idSize: '10px', classSize: '9px', gap: '3mm' },
            '12': { cols: 3, cardW: '60mm', cardH: '38mm', qrSize: '28mm', fontSize: '11px', idSize: '9px', classSize: '8px', gap: '2mm' },
        };
        const layout = layouts[qrLayout];

        const getStudentClasses = (sId: string) => {
            return state.classes.filter(c => c.studentIds.includes(sId)).map(c => c.name).join(', ');
        };

        const cards = selectedStudents.map(s => {
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(s.id)}&format=png`;
            const classNames = getStudentClasses(s.id);
            return `<div style="width:${layout.cardW};height:${layout.cardH};border:1px solid #ccc;border-radius:8px;padding:5px;display:inline-flex;align-items:center;gap:6px;background:white;page-break-inside:avoid;box-sizing:border-box;">
                <img src="${qrUrl}" style="width:${layout.qrSize};height:${layout.qrSize};flex-shrink:0;" />
                <div style="flex:1;overflow:hidden;min-width:0;">
                    <div style="font-weight:bold;font-size:${layout.fontSize};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.name}</div>
                    <div style="font-size:${layout.idSize};color:#666;font-family:monospace;">${s.id}</div>
                    <div style="font-size:${layout.classSize};color:#999;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${classNames || 'Chưa xếp lớp'}</div>
                </div>
            </div>`;
        });

        // Split into pages
        const pages: string[] = [];
        for (let i = 0; i < cards.length; i += cardsPerPage) {
            const pageCards = cards.slice(i, i + cardsPerPage);
            pages.push(`<div style="display:flex;flex-wrap:wrap;gap:${layout.gap};justify-content:center;align-content:flex-start;width:190mm;min-height:277mm;page-break-after:always;">${pageCards.join('')}</div>`);
        }

        const html = `<!DOCTYPE html><html><head><title>Thẻ QR Điểm danh</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial, sans-serif; }
                @page { size: A4; margin: 10mm; }
                @media print { body { -webkit-print-color-adjust: exact; } }
                .page-container > div:last-child { page-break-after: avoid; }
            </style>
        </head><body>
            <div class="page-container">${pages.join('')}</div>
        </body></html>`;
        printHtml(html, 1000);
        setShowQRPrintModal(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold">Quản lý Học viên</h1>
                {canManage && (
                    <div className="flex items-center gap-2 flex-wrap">
                        {selectedForQR.size > 0 && (
                            <Button variant="secondary" onClick={() => setShowQRPrintModal(true)}>
                                🖶️ In thẻ QR ({selectedForQR.size})
                            </Button>
                        )}
                        <ExportButton data={exportData} columns={exportColumns} filenameBase={`DanhSachHocVien_${new Date().toISOString().split('T')[0]}`} label="Xuất danh sách" />
                        <Button onClick={() => handleOpenModal()}>
                            {ICONS.plus} Thêm học viên
                        </Button>
                    </div>
                )}
            </div>
            <div className="card-base p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input 
                        type="text" 
                        placeholder="Tìm kiếm học viên (tên, SĐT, lớp)..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="form-input"
                    />
                    <select
                        value={classFilter}
                        onChange={e => setClassFilter(e.target.value)}
                        className="form-select"
                    >
                        <option value="all">Lọc theo lớp - Tất cả</option>
                        {state.classes.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="form-select"
                    >
                        <option value="active_inactive">Trạng thái: Đang hoạt động</option>
                        <option value={PersonStatus.ACTIVE}>✅ Hoạt động</option>
                        <option value={PersonStatus.INACTIVE}>⏸️ Tạm nghỉ</option>
                        <option value={PersonStatus.ARCHIVED}>📦 Lưu trữ</option>
                        <option value="all">📋 Tất cả trạng thái</option>
                    </select>
                </div>
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden md:block">
                 <Table<Student>
                    columns={[
                        {
                            header: (
                                <input
                                    type="checkbox"
                                    checked={sortedStudents.length > 0 && selectedForQR.size === sortedStudents.length}
                                    onChange={handleSelectAllQR}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                    title="Chọn tất cả để in QR"
                                />
                            ) as any,
                            accessor: (item: Student) => (
                                <input
                                    type="checkbox"
                                    checked={selectedForQR.has(item.id)}
                                    onChange={() => handleToggleQRSelect(item.id)}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                />
                            )
                        },
                        ...columns
                    ]}
                    data={paginatedStudents}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    actions={canManage ? (student) => (
                        <>
                            {state.settings.zaloOaEnabled && (
                                (student as any).zaloUserId ? (
                                    <span className="text-blue-500 text-xs" title="Đã liên kết Zalo">✅</span>
                                ) : (
                                    <button onClick={() => setZaloLinkStudent(student)} className="text-orange-500 hover:text-orange-700" title="Liên kết Zalo">🔗</button>
                                )
                            )}
                            <button onClick={() => setResetPasswordModalState({ isOpen: true, student: student })} className="text-gray-500 hover:text-gray-800" title="Đặt lại mật khẩu">{React.cloneElement(ICONS.key as React.ReactElement<{ width?: number | string; height?: number | string }>, {width: 20, height: 20})}</button>
                            <button onClick={() => handleOpenModal(student)} className="text-indigo-600 hover:text-indigo-900">{ICONS.edit}</button>
                            {student.status === PersonStatus.ARCHIVED ? (
                                <button onClick={async () => { try { await restoreStudent(student.id); toast.success(`Đã khôi phục ${student.name}`); } catch (e: any) { toast.error(e.message); } }} className="text-emerald-600 hover:text-emerald-900" title="Khôi phục">↩️</button>
                            ) : (
                                <button onClick={async () => { try { await archiveStudent(student.id); toast.success(`Đã lưu trữ ${student.name}`); } catch (e: any) { toast.error(e.message); } }} className="text-amber-600 hover:text-amber-900" title="Lưu trữ">📦</button>
                            )}
                            <button onClick={() => handleDeleteClick(student)} className="text-red-600 hover:text-red-900">{ICONS.delete}</button>
                        </>
                    ) : undefined}
                />
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {paginatedStudents.map(student => (
                    <div key={student.id} className="card-base p-4">
                        <div className="flex justify-between items-start gap-3">
                            <div className="flex items-start gap-3 flex-1">
                                <input
                                    type="checkbox"
                                    checked={selectedForQR.has(student.id)}
                                    onChange={() => handleToggleQRSelect(student.id)}
                                    className="mt-1.5 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <Link to={`/student/${student.id}`} className="block group">
                                    <h3 className="font-bold text-lg text-primary group-hover:underline">{student.name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{student.id}</p>
                                </Link>
                            </div>

                            <div className="flex flex-col items-end">
                                <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-full shadow-sm ${student.status === PersonStatus.ACTIVE ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : student.status === PersonStatus.ARCHIVED ? 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'} whitespace-nowrap mt-1`}>
                                    {student.status === PersonStatus.ACTIVE ? 'Hoạt động' : student.status === PersonStatus.ARCHIVED ? 'Lưu trữ' : 'Tạm nghỉ'}
                                </span>
                                {student.statusChangedAt && (
                                    <span className="text-[10px] text-gray-500 mt-1">
                                        Từ: {new Date(student.statusChangedAt).toLocaleDateString('vi-VN')}
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        <div className="mt-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Lớp học:</p>
                            <div className="flex flex-wrap gap-1">
                                {(() => {
                                    const enrolledClasses = state.classes.filter(c => c.studentIds.includes(student.id));
                                    if (enrolledClasses.length === 0) return <span className="text-xs text-gray-400 italic">Chưa có lớp</span>;
                                    return enrolledClasses.map(c => (
                                        <span key={c.id} className="px-2 py-0.5 text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                                            {c.name}
                                        </span>
                                    ));
                                })()}
                            </div>
                        </div>

                        {/* Zalo link status */}
                        {state.settings.zaloOaEnabled && (
                            <div className="mt-2 flex items-center gap-2">
                                {(student as any).zaloUserId ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                                        ✅ Đã liên kết Zalo
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => setZaloLinkStudent(student)}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 rounded-full hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors cursor-pointer"
                                    >
                                        🔗 Liên kết Zalo
                                    </button>
                                )}
                            </div>
                        )}
                        <div className="mt-4 grid grid-cols-2 gap-4 text-sm border-t border-gray-100 dark:border-gray-700 pt-3">
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Số điện thoại</p>
                                <p className="font-medium text-gray-800 dark:text-gray-200">{student.phone || 'Chưa có'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Số dư</p>
                                <p className={`font-bold text-base ${student.balance < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                    {student.balance.toLocaleString('vi-VN')} ₫
                                </p>
                            </div>
                        </div>

                        {(canManage || student.balance < 0) && (
                            <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3 flex justify-end items-center space-x-1">
                                {student.balance < 0 && (
                                    <>
                                        <button onClick={() => setPaymentModalState({ isOpen: true, student: student })} className="p-2 rounded-full text-green-600 hover:bg-green-100 dark:hover:bg-green-900/50" title="Ghi nhận thanh toán">
                                            {React.cloneElement(ICONS.finance as React.ReactElement, {width: 20, height: 20})}
                                        </button>
                                        {student.parentPhone && (
                                            <button 
                                                onClick={async () => {
                                                    const unpaidInvoices = state.invoices
                                                        .filter(inv => inv.studentId === student.id && inv.status === 'UNPAID')
                                                        .sort((a, b) => a.month.localeCompare(b.month));
                                                    const totalDebt = unpaidInvoices.length > 0 
                                                        ? unpaidInvoices.reduce((sum, inv) => sum + inv.amount, 0)
                                                        : Math.abs(student.balance);
                                                    const message = buildDebtMessage({
                                                        centerName: state.settings.name || 'Trung tâm',
                                                        centerPhone: state.settings.phone,
                                                        parentName: student.parentName || 'Phụ huynh',
                                                        studentName: student.name,
                                                        invoices: unpaidInvoices.map(inv => ({ month: inv.month, amount: inv.amount })),
                                                        totalDebt,
                                                        customTemplate: state.settings.messageTemplates?.tuitionReminder,
                                                    });
                                                    const result = await copyAndOpenZalo(student.parentPhone!, message);
                                                    if (result.success) {
                                                        toast.success('Đã chép nội dung tin nhắn. Zalo đang mở — hãy dán (Ctrl+V) và gửi!');
                                                    } else {
                                                        toast.error(result.error || 'Lỗi khi mở Zalo.');
                                                    }
                                                }}
                                                className="p-2 rounded-full text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50" 
                                                title="Nhắn Zalo nhắc HP (qua SĐT)"
                                            >
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.04 2 11c0 2.76 1.36 5.22 3.48 6.84L5 22l4.33-2.12C10.2 20.04 11.08 20.12 12 20.12c5.52 0 10-4.04 10-9.06S17.52 2 12 2zm4.5 12.5c-.2.56-1.18 1.08-1.63 1.14-.44.06-.83.2-2.8-.6-2.38-1-3.9-3.44-4.02-3.6-.12-.16-.96-1.28-.96-2.44s.6-1.72.82-1.96c.22-.24.48-.3.64-.3.16 0 .32 0 .46.02.14.02.34-.06.54.42.2.48.68 1.68.74 1.8.06.12.1.26.02.42-.08.16-.12.26-.24.4-.12.14-.24.3-.36.42-.12.12-.24.24-.1.48.14.24.62 1.02 1.32 1.66.9.82 1.66 1.08 1.9 1.2.24.12.38.1.52-.06.14-.16.6-.7.76-.94.16-.24.32-.2.54-.12.22.08 1.38.66 1.62.78.24.12.4.18.46.28.06.1.06.56-.14 1.12z"/></svg>
                                            </button>
                                        )}
                                        {state.settings.zaloOaEnabled && (student as any).zaloUserId && (
                                            <button 
                                                onClick={async () => {
                                                    try {
                                                        const result = await zaloSendTuition(student.name, student.parentName || 'Phụ huynh', student.parentPhone || '', (student as any).zaloUserId, student.balance, state.settings.name || '');
                                                        if (result.success) toast.success(result.message);
                                                        else toast.error(result.error || 'Lỗi gửi Zalo');
                                                    } catch (e: any) { toast.error(e.message || 'Lỗi gửi Zalo'); }
                                                }}
                                                className="p-2 rounded-full text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/50" 
                                                title="Gửi tự động qua Zalo OA"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                            </button>
                                        )}
                                    </>
                                )}
                                {canManage && (
                                    <>
                                        <button onClick={() => setResetPasswordModalState({ isOpen: true, student: student })} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" title="Đặt lại mật khẩu">
                                            {React.cloneElement(ICONS.key as React.ReactElement, {width: 20, height: 20})}
                                        </button>
                                        <button onClick={() => handleOpenModal(student)} className="p-2 rounded-full text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/50" title="Sửa">
                                            {ICONS.edit}
                                        </button>
                                        {student.status === PersonStatus.ARCHIVED ? (
                                            <button onClick={async () => { try { await restoreStudent(student.id); toast.success(`Đã khôi phục ${student.name}`); } catch (e: any) { toast.error(e.message); } }} className="p-2 rounded-full text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/50" title="Khôi phục">
                                                ↩️
                                            </button>
                                        ) : (
                                            <button onClick={async () => { try { await archiveStudent(student.id); toast.success(`Đã lưu trữ ${student.name}`); } catch (e: any) { toast.error(e.message); } }} className="p-2 rounded-full text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/50" title="Lưu trữ">
                                                📦
                                            </button>
                                        )}
                                        <button onClick={() => handleDeleteClick(student)} className="p-2 rounded-full text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50" title="Xóa">
                                            {ICONS.delete}
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {paginatedStudents.length > 0 && (
                 <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalItems={sortedStudents.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                />
            )}
           
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingStudent ? 'Chỉnh sửa Học viên' : 'Thêm Học viên mới'}>
                <StudentForm 
                    student={editingStudent} 
                    onSubmit={handleSubmit} 
                    onCancel={handleCloseModal}
                    allClasses={state.classes}
                    generatedId={generatedStudentId}
                    allTeachers={state.teachers}
                    allStaff={state.staff}
                    allStudents={state.students}
                />
            </Modal>
             <ConfirmationModal
                isOpen={confirmModalState.isOpen}
                onClose={() => setConfirmModalState({ isOpen: false, student: null })}
                onConfirm={handleConfirmDelete}
                title="Xác nhận Xóa Học viên"
                message={
                    <p>
                        Bạn có chắc chắn muốn xoá học viên <strong>{confirmModalState.student?.name}</strong>?
                        <br /><br />
                        <span className="font-bold text-red-500">CẢNH BÁO:</span> Toàn bộ dữ liệu học phí, điểm danh và báo cáo của học viên này cũng sẽ bị XOÁ VĨNH VIỄN.
                    </p>
                }
            />
            <ResetPasswordModal
                isOpen={resetPasswordModalState.isOpen}
                onClose={() => setResetPasswordModalState({ isOpen: false, student: null })}
                user={resetPasswordModalState.student}
                role={UserRole.PARENT}
            />
             <PaymentModal
                isOpen={paymentModalState.isOpen}
                onClose={() => setPaymentModalState({ isOpen: false, student: null })}
                student={paymentModalState.student}
            />

            {/* QR Print Modal */}
            <Modal isOpen={showQRPrintModal} onClose={() => setShowQRPrintModal(false)} title="🖶️ In thẻ QR Điểm danh">
                <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                            Đã chọn <strong>{selectedForQR.size}</strong> học viên để in thẻ QR
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Bố cục trên khổ giấy A4</label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { value: '8', label: '8 thẻ/trang', desc: '2 cột × 4 hàng (Lớn)' },
                                { value: '10', label: '10 thẻ/trang', desc: '2 cột × 5 hàng (Vừa)' },
                                { value: '12', label: '12 thẻ/trang', desc: '3 cột × 4 hàng (Nhỏ)' },
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setQrLayout(opt.value as any)}
                                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                                        qrLayout === opt.value 
                                            ? 'border-primary bg-primary/5 shadow-md' 
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                    }`}
                                >
                                    <p className="font-bold text-sm">{opt.label}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">{opt.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-sm">
                        <p>Số trang cần in: <strong>{Math.ceil(selectedForQR.size / parseInt(qrLayout))}</strong> trang A4</p>
                    </div>
                    <div className="flex justify-end gap-3 pt-2 border-t dark:border-slate-700">
                        <Button variant="secondary" onClick={() => setShowQRPrintModal(false)}>Hủy</Button>
                        <Button onClick={handlePrintQRCards}>🖶️ In {selectedForQR.size} thẻ QR</Button>
                    </div>
                </div>
            </Modal>

            {/* Zalo Link Modal */}
            {zaloLinkStudent && (
                <Modal isOpen={true} onClose={() => { setZaloLinkStudent(null); setZaloFollowers([]); }} title={`🔗 Liên kết Zalo cho ${zaloLinkStudent.name}`}>
                    <div className="space-y-4">
                        {zaloFollowersLoading ? (
                            <div className="text-center py-8 text-gray-500">
                                <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mb-2" />
                                <p>Đang tải danh sách followers OA...</p>
                            </div>
                        ) : zaloFollowers.length === 0 ? (
                            <div className="text-center py-4">
                                <Button onClick={async () => {
                                    setZaloFollowersLoading(true);
                                    try {
                                        const result = await zaloGetFollowersList();
                                        if (result.success) {
                                            setZaloFollowers(result.followers || []);
                                            if ((result.followers || []).length === 0) {
                                                toast.error(result.debug || 'OA chưa có follower nào. Phụ huynh cần follow OA trước.');
                                            }
                                        } else {
                                            toast.error(result.error || 'Lỗi tải followers');
                                        }
                                    } catch (e: any) {
                                        toast.error(e.message || 'Lỗi tải followers');
                                    } finally {
                                        setZaloFollowersLoading(false);
                                    }
                                }}>
                                    📥 Tải danh sách followers OA
                                </Button>
                                <p className="text-xs text-gray-500 mt-2">
                                    Hệ thống sẽ lấy danh sách người follow OA của bạn.
                                    <br/>Chọn đúng phụ huynh để liên kết với học viên.
                                </p>
                            </div>
                        ) : (
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                                    Chọn tài khoản Zalo của phụ huynh <strong>{zaloLinkStudent.parentName || zaloLinkStudent.name}</strong>:
                                </p>
                                <div className="max-h-60 overflow-y-auto space-y-2">
                                    {zaloFollowers.map((f: any) => (
                                        <button
                                            key={f.userId}
                                            onClick={async () => {
                                                try {
                                                    await updateStudent({ ...zaloLinkStudent, zaloUserId: f.userId } as any);
                                                    toast.success(`Đã liên kết Zalo "${f.displayName}" cho ${zaloLinkStudent.name}`);
                                                    setZaloLinkStudent(null);
                                                    setZaloFollowers([]);
                                                } catch (e: any) {
                                                    toast.error(e.message || 'Lỗi liên kết');
                                                }
                                            }}
                                            className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 dark:border-gray-600 transition-colors text-left"
                                        >
                                            {f.avatar ? (
                                                <img src={f.avatar} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center flex-shrink-0 text-lg">
                                                    👤
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm truncate">{f.displayName}</p>
                                                {f.phone && <p className="text-xs text-gray-500">{f.phone}</p>}
                                                <p className="text-[10px] text-gray-400 font-mono truncate">{f.userId}</p>
                                            </div>
                                            <span className="text-blue-600 text-xs font-medium flex-shrink-0">Chọn →</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};