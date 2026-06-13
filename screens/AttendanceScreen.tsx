
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../hooks/useDataContext';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { AttendanceRecord, AttendanceStatus, PersonStatus, UserRole, Student } from '../types';
import { Button } from '../components/common/Button';
import { ICONS } from '../constants';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { Modal } from '../components/common/Modal';
import { zaloSendAbsence } from '../services/api';

export const AttendanceScreen: React.FC = () => {
    const { classId, date } = useParams<{ classId: string; date: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { state, updateAttendance, deleteAttendanceForDate } = useData();
    const { toast } = useToast();
    const { role } = useAuth();
    const { classes, students, attendance } = state;

    const [attendanceData, setAttendanceData] = useState<Map<string, {status: AttendanceStatus, note: string}>>(new Map());
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmDeleteModalOpen, setConfirmDeleteModalOpen] = useState(false);
    const [unmarkedConfirmModalOpen, setUnmarkedConfirmModalOpen] = useState(false);
    const [zaloNotificationData, setZaloNotificationData] = useState<string[] | null>(null);


    const isViewer = role === UserRole.VIEWER;
    const canTakeAttendance = !isViewer;

    const cls = classes.find(c => c.id === classId);

    // Logic updated to include both currently active students AND any student who has a record for this day
    // This prevents data loss for inactive students when editing past records
    const classStudents = useMemo(() => {
        if (!cls) return [];
        
        const getLastName = (fullName: string) => {
            if (!fullName) return '';
            const parts = fullName.trim().split(/\s+/);
            return parts[parts.length - 1];
        };

        // 1. Students currently enrolled and active
        const activeEnrolledStudents = students.filter(s => cls.studentIds.includes(s.id) && s.status === PersonStatus.ACTIVE);

        // 2. Students who have attendance records for this specific date/class (history)
        // This ensures we don't lose records of students who dropped out but attended this day
        const recordedStudentIds = attendance
            .filter(a => a.classId === classId && a.date === date)
            .map(a => a.studentId);
        
        const recordedStudents = students.filter(s => recordedStudentIds.includes(s.id));

        // Merge and remove duplicates
        const uniqueStudentsMap = new Map<string, Student>();
        activeEnrolledStudents.forEach(s => uniqueStudentsMap.set(s.id, s));
        recordedStudents.forEach(s => uniqueStudentsMap.set(s.id, s));
        
        const combinedStudents = Array.from(uniqueStudentsMap.values());

        return combinedStudents.sort((a, b) => {
            const lastNameA = getLastName(a.name);
            const lastNameB = getLastName(b.name);
            
            const lastNameComparison = lastNameA.localeCompare(lastNameB, 'vi');
            
            if (lastNameComparison !== 0) {
                return lastNameComparison;
            }

            return a.name.localeCompare(b.name, 'vi');
        });
    }, [cls, students, attendance, classId, date]);

    const hasExistingData = useMemo(() => {
        return attendance.some(a => a.classId === classId && a.date === date);
    }, [attendance, classId, date]);

    const attendanceCounts = useMemo(() => {
        if (!classId || !date) return new Map<string, number>();
    
        const monthStr = date.substring(0, 7);
    
        const counts = new Map<string, number>();
        const classAttendanceRecords = attendance.filter(a => a.classId === classId);
    
        classStudents.forEach(student => {
            const studentMonthlyAttendance = classAttendanceRecords.filter(a =>
                a.studentId === student.id &&
                a.date.startsWith(monthStr) &&
                (a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.LATE)
            );
            counts.set(student.id, studentMonthlyAttendance.length);
        });
    
        return counts;
    }, [attendance, classId, date, classStudents]);


    useEffect(() => {
        const initialData = new Map<string, {status: AttendanceStatus, note: string}>();
        classStudents.forEach(student => {
            const record = attendance.find(a => a.classId === classId && a.studentId === student.id && a.date === date);
            initialData.set(student.id, {
                status: record ? record.status : AttendanceStatus.UNMARKED,
                note: record?.note || ''
            });
        });
        setAttendanceData(initialData);
    }, [classId, date, attendance, classStudents]);

    const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
        if (!canTakeAttendance) return;
        setAttendanceData(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(studentId) || { status: AttendanceStatus.UNMARKED, note: '' };
            newMap.set(studentId, { ...current, status });
            return newMap;
        });
    };

    const handleNoteChange = (studentId: string, note: string) => {
        if (!canTakeAttendance) return;
        setAttendanceData(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(studentId) || { status: AttendanceStatus.UNMARKED, note: '' };
            newMap.set(studentId, { ...current, note });
            return newMap;
        });
    };

    const handleBulkChange = (status: AttendanceStatus) => {
        if (!canTakeAttendance) return;
        setAttendanceData(prev => {
            const newMap = new Map(prev);
            classStudents.forEach(student => {
                const current = newMap.get(student.id) || { status: AttendanceStatus.UNMARKED, note: '' };
                newMap.set(student.id, { ...current, status });
            });
            return newMap;
        });
    };

    const handleNavigateBack = () => {
        const returnTo = location.state?.returnTo || `/class/${classId}`;
        const returnState = location.state?.defaultTab ? { state: { defaultTab: location.state.defaultTab } } : {};
        navigate(returnTo, returnState);
    };

    const proceedWithSave = useCallback(async () => {
        if (!canTakeAttendance || !classId || !date) return;

        setIsLoading(true);
        const newRecords: AttendanceRecord[] = [];
        for (const [studentId, data] of attendanceData.entries()) {
            if (data.status !== AttendanceStatus.UNMARKED || (data.note && data.note.trim() !== '')) {
                const existingRecord = attendance.find(a => a.classId === classId && a.studentId === studentId && a.date === date);
                newRecords.push({
                    id: existingRecord?.id || `A-${Date.now()}-${studentId}`,
                    classId: classId!,
                    studentId,
                    date: date!,
                    status: data.status,
                    note: data.note,
                });
            }
        }
        try {
            // If there are no records to save, and there were existing records, we should delete them
            if (newRecords.length === 0 && hasExistingData) {
                await deleteAttendanceForDate({ classId, date });
                toast.success('Đã xóa điểm danh thành công!');
                handleNavigateBack();
                return;
            }
            
            if (newRecords.length > 0) {
                await updateAttendance(newRecords);
                toast.success('Đã lưu điểm danh thành công!');
                
                // Identify unexcused absent students
                const unexcusedIds = Array.from(attendanceData.entries())
                    .filter(([_, data]) => data.status === AttendanceStatus.UNEXCUSED_ABSENT)
                    .map(([id]) => id);
                    
                if (unexcusedIds.length > 0) {
                    const absentStudentsList = classStudents.filter(s => unexcusedIds.includes(s.id));
                    setZaloNotificationData(absentStudentsList.map(s => s.name));
                    return; // Return early, don't navigate back yet
                }
            }
            handleNavigateBack();
        } catch (error) {
            toast.error('Lỗi khi lưu điểm danh. Vui lòng thử lại.');
        } finally {
            setIsLoading(false);
            setUnmarkedConfirmModalOpen(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attendanceData, classId, date, canTakeAttendance, updateAttendance, toast, navigate, location.state]);
    
    const handleSubmit = () => {
        const unmarkedWithoutNoteCount = Array.from(attendanceData.values()).filter(data => data.status === AttendanceStatus.UNMARKED && (!data.note || data.note.trim() === '')).length;
        if (unmarkedWithoutNoteCount > 0) {
            setUnmarkedConfirmModalOpen(true);
        } else {
            proceedWithSave();
        }
    };


    const handleDelete = async () => {
        if (!classId || !date || !canTakeAttendance) return;
        setIsDeleting(true);
        try {
            await deleteAttendanceForDate({ classId, date });
            toast.success(`Đã xóa điểm danh ngày ${date} cho lớp ${cls?.name}.`);
            handleNavigateBack();
        } catch (error) {
            toast.error('Lỗi khi xóa điểm danh.');
        } finally {
            setIsDeleting(false);
            setConfirmDeleteModalOpen(false);
        }
    };

    if (!cls) return <div className="p-6">Lớp học không tồn tại.</div>;
    
    const StatusButton: React.FC<{current: AttendanceStatus, target: AttendanceStatus, onClick: () => void, label: string, color: string, icon: React.ReactElement<React.SVGProps<SVGSVGElement>>}> = ({current, target, onClick, label, color, icon}) => (
        <button
            onClick={onClick}
            title={label}
            disabled={!canTakeAttendance}
            className={`p-3 sm:px-3 sm:py-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 font-semibold text-sm flex-1 ${current === target ? `${color} text-white shadow-md ring-2 ring-offset-1 ring-offset-white dark:ring-offset-gray-800 ring-${color.split('-')[1]}-400` : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            {React.cloneElement(icon, {width: 20, height: 20})}
            <span className="hidden sm:inline">{label}</span>
        </button>
    );

    return (
        <>
            <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="mb-6">
                         <Button variant="secondary" onClick={handleNavigateBack} className="mb-4">
                            {ICONS.chevronLeft} Quay lại
                        </Button>
                        <h1 className="text-2xl md:text-3xl font-bold">Điểm danh lớp {cls.name}</h1>
                        <p className="text-gray-600 dark:text-gray-300">Ngày: {new Date(date || '').toLocaleDateString('vi-VN')}</p>
                    </div>
                    
                    {classStudents.length > 0 && canTakeAttendance && (
                        <div className="mb-4 p-3 bg-blue-50 dark:bg-gray-700 rounded-lg text-blue-800 dark:text-blue-200 text-sm flex flex-col gap-3">
                           <div>
                               <p className="mb-2 font-semibold">Thao tác nhanh:</p>
                               <div className="flex gap-2 w-full overflow-x-auto pb-1">
                                     <Button size="sm" onClick={() => handleBulkChange(AttendanceStatus.PRESENT)} disabled={!canTakeAttendance} className="whitespace-nowrap !bg-green-600 hover:!bg-green-700 !text-white !ring-green-400 !font-bold !shadow-md !shadow-green-500/20">✓ Tất cả có mặt</Button>
                                     <Button size="sm" onClick={() => handleBulkChange(AttendanceStatus.LATE)} disabled={!canTakeAttendance} className="bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-400 text-white whitespace-nowrap">Tất cả đi muộn</Button>
                                     <Button size="sm" variant="danger" onClick={() => handleBulkChange(AttendanceStatus.ABSENT)} disabled={!canTakeAttendance} className="whitespace-nowrap bg-teal-500 hover:bg-teal-600">Tất cả có phép</Button>
                                     <Button size="sm" variant="danger" onClick={() => handleBulkChange(AttendanceStatus.UNEXCUSED_ABSENT)} disabled={!canTakeAttendance} className="whitespace-nowrap">Tất cả không phép</Button>
                               </div>
                           </div>
                           <div>
                               <p className="mb-2 font-semibold">Ghi chú chung cho cả lớp:</p>
                               <div className="flex gap-2">
                                   <input
                                       type="text"
                                       placeholder="Ví dụ: Lớp nghỉ do giáo viên bận họp..."
                                       className="form-input text-sm flex-1"
                                       id="bulk-note-input"
                                   />
                                   <Button size="sm" variant="secondary" onClick={() => {
                                       const note = (document.getElementById('bulk-note-input') as HTMLInputElement)?.value || '';
                                       if (note) {
                                           setAttendanceData(prev => {
                                               const newMap = new Map(prev);
                                               classStudents.forEach(student => {
                                                   const current = newMap.get(student.id) || { status: AttendanceStatus.UNMARKED, note: '' };
                                                   newMap.set(student.id, { ...current, note });
                                               });
                                               return newMap;
                                           });
                                           toast.success('Đã áp dụng ghi chú cho tất cả học viên.');
                                       }
                                   }}>Áp dụng</Button>
                               </div>
                           </div>
                        </div>
                    )}

                    <div className="space-y-3 pb-20">
                        {classStudents.length > 0 ? (
                            classStudents.map(student => {
                                const isInactive = student.status !== PersonStatus.ACTIVE || !cls.studentIds.includes(student.id);
                                return (
                                    <div key={student.id} className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border flex flex-col gap-4 ${isInactive ? 'border-orange-200 dark:border-orange-900/30 bg-orange-50/30 dark:bg-orange-900/10' : 'border-gray-100 dark:border-gray-700'}`}>
                                        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                                            <div className="flex-grow flex justify-between items-start">
                                                <div>
                                                    <span className={`font-bold text-base md:text-lg ${isInactive ? 'text-gray-500' : ''}`}>
                                                        {student.name}
                                                        {isInactive && <span className="text-xs text-orange-500 font-normal ml-2">(Đã nghỉ / Khác)</span>}
                                                    </span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 px-2 py-0.5 rounded-full">
                                                            Tháng này: {attendanceCounts.get(student.id) || 0} buổi
                                                        </span>
                                                        {attendanceData.get(student.id)?.status === AttendanceStatus.UNMARKED && (
                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${attendanceData.get(student.id)?.note?.trim() ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200' : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200 animate-pulse'}`}>
                                                                {attendanceData.get(student.id)?.note?.trim() ? 'Đã ghi chú' : 'Chưa điểm danh'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                <div className="flex gap-2 w-full md:w-auto flex-wrap">
                                                <StatusButton current={attendanceData.get(student.id)?.status!} target={AttendanceStatus.PRESENT} onClick={() => handleStatusChange(student.id, AttendanceStatus.PRESENT)} label="Có mặt" color="bg-green-600" icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>} />
                                                <StatusButton current={attendanceData.get(student.id)?.status!} target={AttendanceStatus.LATE} onClick={() => handleStatusChange(student.id, AttendanceStatus.LATE)} label="Trễ" color="bg-yellow-500" icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
                                                <StatusButton current={attendanceData.get(student.id)?.status!} target={AttendanceStatus.ABSENT} onClick={() => handleStatusChange(student.id, AttendanceStatus.ABSENT)} label="Có phép" color="bg-teal-500" icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>} />
                                                <StatusButton current={attendanceData.get(student.id)?.status!} target={AttendanceStatus.UNEXCUSED_ABSENT} onClick={() => handleStatusChange(student.id, AttendanceStatus.UNEXCUSED_ABSENT)} label="Không phép" color="bg-red-500" icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>} />
                                            </div>
                                        </div>
                                        <div className="w-full">
                                            <input
                                                type="text"
                                                placeholder="Ghi chú (ví dụ: Ốm, bận việc gia đình...)"
                                                className="form-input text-sm w-full"
                                                value={attendanceData.get(student.id)?.note || ''}
                                                onChange={(e) => handleNoteChange(student.id, e.target.value)}
                                                disabled={!canTakeAttendance}
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center p-8 card-base">
                                <p className="text-gray-500 dark:text-gray-400">Không có học viên nào đang hoạt động trong lớp này để điểm danh.</p>
                            </div>
                        )}
                    </div>
                </div>

                 <div className="p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] sticky bottom-0 z-20 pb-safe">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                            {hasExistingData && canTakeAttendance && (
                                <Button
                                    onClick={() => setConfirmDeleteModalOpen(true)}
                                    variant="danger"
                                    isLoading={isDeleting}
                                    disabled={isLoading}
                                    className="w-full sm:w-auto"
                                    title="Xóa Điểm danh"
                                >
                                    {ICONS.delete}
                                    <span className="hidden sm:inline ml-2">Xóa Dữ liệu</span>
                                </Button>
                            )}
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    const statusLabel: Record<string, string> = {
                                        PRESENT: 'Có mặt', ABSENT: 'Có phép', UNEXCUSED_ABSENT: 'Không phép',
                                        LATE: 'Trễ', UNMARKED: 'Chưa ĐD'
                                    };
                                    const rows = classStudents.map((s, i) => {
                                        const data = attendanceData.get(s.id);
                                        const status = data?.status || AttendanceStatus.UNMARKED;
                                        const note = data?.note || '';
                                        return `<tr>
                                            <td style="border:1px solid #ddd;padding:6px 10px;text-align:center">${i + 1}</td>
                                            <td style="border:1px solid #ddd;padding:6px 10px">${s.name}</td>
                                            <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace">${s.id}</td>
                                            <td style="border:1px solid #ddd;padding:6px 10px;text-align:center">${statusLabel[status] || status}</td>
                                            <td style="border:1px solid #ddd;padding:6px 10px;text-align:center">${attendanceCounts.get(s.id) || 0}</td>
                                            <td style="border:1px solid #ddd;padding:6px 10px">${note}</td>
                                        </tr>`;
                                    }).join('');
                                    const summary = classStudents.reduce((acc, s) => {
                                        const st = attendanceData.get(s.id)?.status || AttendanceStatus.UNMARKED;
                                        acc[st] = (acc[st] || 0) + 1;
                                        return acc;
                                    }, {} as Record<string, number>);
                                    const pw = window.open('', '_blank');
                                    if (!pw) return;
                                    pw.document.write(`<!DOCTYPE html><html><head><title>Điểm danh - ${cls?.name} - ${date}</title>
                                        <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;padding:15mm}
                                        @page{size:A4;margin:15mm}
                                        table{border-collapse:collapse;width:100%}th{background:#f3f4f6;font-weight:600}
                                        @media print{body{-webkit-print-color-adjust:exact}}</style>
                                    </head><body>
                                        <h2 style="text-align:center;margin-bottom:4px">${state.settings.name}</h2>
                                        <h3 style="text-align:center;margin-bottom:12px;color:#666">BẢNG ĐIỂM DANH</h3>
                                        <div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:13px">
                                            <span><b>Lớp:</b> ${cls?.name}</span>
                                            <span><b>Ngày:</b> ${date}</span>
                                            <span><b>Sĩ số:</b> ${classStudents.length}</span>
                                        </div>
                                        <table>
                                            <thead><tr>
                                                <th style="border:1px solid #ddd;padding:8px;width:40px">STT</th>
                                                <th style="border:1px solid #ddd;padding:8px">Họ và tên</th>
                                                <th style="border:1px solid #ddd;padding:8px;width:70px">Mã HV</th>
                                                <th style="border:1px solid #ddd;padding:8px;width:90px">Trạng thái</th>
                                                <th style="border:1px solid #ddd;padding:8px;width:60px">Số buổi</th>
                                                <th style="border:1px solid #ddd;padding:8px">Ghi chú</th>
                                            </tr></thead>
                                            <tbody>${rows}</tbody>
                                        </table>
                                        <div style="margin-top:12px;font-size:12px;color:#666">
                                            Có mặt: ${summary[AttendanceStatus.PRESENT] || 0} | 
                                            Có phép: ${summary[AttendanceStatus.ABSENT] || 0} | 
                                            Không phép: ${summary[AttendanceStatus.UNEXCUSED_ABSENT] || 0} | 
                                            Trễ: ${summary[AttendanceStatus.LATE] || 0}
                                        </div>
                                        <div style="display:flex;justify-content:space-between;margin-top:30px;text-align:center;font-size:13px">
                                            <div><b>Giáo viên</b><div style="height:50px"></div><div style="border-top:1px solid #999;padding-top:4px">Ký tên</div></div>
                                            <div><b>Quản lý</b><div style="height:50px"></div><div style="border-top:1px solid #999;padding-top:4px">Ký tên</div></div>
                                        </div>
                                    </body></html>`);
                                    pw.document.close();
                                    setTimeout(() => pw.print(), 500);
                                }}
                                className="print-hidden"
                                title="In bảng điểm danh"
                            >
                                {ICONS.print}
                                <span className="hidden sm:inline ml-2">In</span>
                            </Button>
                        </div>
                        
                        <div className="flex-1 flex justify-end">
                            {classStudents.length > 0 && canTakeAttendance && (
                                <Button
                                    onClick={handleSubmit}
                                    className="w-full sm:w-auto min-w-[120px] py-3 text-base"
                                    isLoading={isLoading}
                                    disabled={isDeleting}
                                >
                                    <span className="mr-2">{ICONS.check}</span>
                                    Lưu
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <ConfirmationModal
                isOpen={confirmDeleteModalOpen}
                onClose={() => setConfirmDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="Xác nhận Xóa Điểm danh"
                message={`Bạn có chắc chắn muốn xóa toàn bộ dữ liệu điểm danh cho lớp ${cls?.name} vào ngày ${date}? Hành động này không thể hoàn tác.`}
            />
             <ConfirmationModal
                isOpen={unmarkedConfirmModalOpen}
                onClose={() => setUnmarkedConfirmModalOpen(false)}
                onConfirm={proceedWithSave}
                title="Xác nhận Lưu Điểm danh"
                message="Có học viên chưa được điểm danh. Nếu tiếp tục, những học viên này sẽ không có bản ghi điểm danh cho ngày hôm nay. Bạn có chắc chắn muốn lưu?"
                confirmButtonText="Vẫn lưu"
                confirmButtonVariant="primary"
            />
            {zaloNotificationData && (
                <Modal
                    isOpen={true}
                    onClose={() => {
                        setZaloNotificationData(null);
                        handleNavigateBack();
                    }}
                    title="📱 Thông báo học sinh vắng mặt"
                >
                    <ZaloAbsenceNotifier
                        absentStudentNames={zaloNotificationData}
                        allStudents={classStudents}
                        attendanceData={attendanceData}
                        className={cls?.name || ''}
                        date={date || ''}
                        centerName={state.settings.name || ''}
                        zaloEnabled={state.settings.zaloOaEnabled || false}
                        onClose={() => {
                            setZaloNotificationData(null);
                            handleNavigateBack();
                        }}
                    />
                </Modal>
            )}
        </>
    );
};

// === Zalo Absence Notifier Component ===
const ZaloAbsenceNotifier: React.FC<{
    absentStudentNames: string[];
    allStudents: Student[];
    attendanceData: Map<string, {status: AttendanceStatus, note: string}>;
    className: string;
    date: string;
    centerName: string;
    zaloEnabled: boolean;
    onClose: () => void;
}> = ({ absentStudentNames, allStudents, attendanceData, className, date, centerName, zaloEnabled, onClose }) => {
    const { toast } = useToast();
    const [isSendingZalo, setIsSendingZalo] = useState(false);
    const [zaloResults, setZaloResults] = useState<any>(null);

    const unexcusedStudents = useMemo(() => {
        return allStudents.filter(s => {
            const data = attendanceData.get(s.id);
            return data?.status === AttendanceStatus.UNEXCUSED_ABSENT;
        });
    }, [allStudents, attendanceData]);

    const copyText = `Kính gửi Quý Phụ huynh, hiện tại đã vào giờ học nhưng chưa thấy các học sinh sau có mặt tại lớp:\n${absentStudentNames.join('\n')}\nQuý Phụ huynh vui lòng kiểm tra và phản hồi lại giúp ạ.\nXin cảm ơn!`;

    const handleSendZalo = async () => {
        const studentsToSend = unexcusedStudents.filter(s => s.parentPhone);
        if (studentsToSend.length === 0) {
            toast.error('Không có học viên nào có SĐT Zalo phụ huynh để gửi.');
            return;
        }

        setIsSendingZalo(true);
        try {
            const result = await zaloSendAbsence(
                studentsToSend.map(s => ({
                    name: s.name,
                    parentName: s.parentName || 'Phụ huynh',
                    parentPhone: s.parentPhone || '',
                })),
                className,
                new Date(date).toLocaleDateString('vi-VN'),
                centerName,
            );
            
            if (result.success) {
                setZaloResults(result);
                toast.success(result.message || 'Đã gửi thông báo!');
            } else {
                toast.error(result.error || 'Lỗi gửi thông báo Zalo');
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi kết nối');
        } finally {
            setIsSendingZalo(false);
        }
    };

    const studentsWithPhone = unexcusedStudents.filter(s => s.parentPhone);
    const studentsWithoutPhone = unexcusedStudents.filter(s => !s.parentPhone);

    return (
        <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-300 text-sm">
                Có <strong>{absentStudentNames.length}</strong> học viên vắng không phép. Bạn có thể:
            </p>

            {/* Copy message section */}
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap select-all border border-gray-200 dark:border-gray-700 max-h-40 overflow-y-auto">
                {copyText}
            </div>

            {/* Zalo OA section */}
            {zaloEnabled && (
                <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50/50 dark:bg-blue-900/20 space-y-3">
                    <h4 className="font-semibold text-sm text-blue-800 dark:text-blue-200 flex items-center gap-2">
                        📱 Gửi thông báo qua Zalo OA
                    </h4>
                    
                    {studentsWithPhone.length > 0 && (
                        <div className="text-xs text-green-700 dark:text-green-300">
                            ✅ Có SĐT Zalo: {studentsWithPhone.map(s => s.name).join(', ')} ({studentsWithPhone.length} người)
                        </div>
                    )}
                    {studentsWithoutPhone.length > 0 && (
                        <div className="text-xs text-orange-600 dark:text-orange-400">
                            ⚠️ Chưa có SĐT: {studentsWithoutPhone.map(s => s.name).join(', ')} — Cần cập nhật SĐT Zalo PH
                        </div>
                    )}
                    
                    {!zaloResults && (
                        <Button
                            onClick={handleSendZalo}
                            isLoading={isSendingZalo}
                            disabled={studentsWithPhone.length === 0}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            📱 Gửi Zalo cho {studentsWithPhone.length} phụ huynh
                        </Button>
                    )}

                    {/* Results */}
                    {zaloResults && (
                        <div className="space-y-2">
                            <div className="text-sm font-medium text-green-700 dark:text-green-300">
                                📊 Kết quả: {zaloResults.summary.sent} gửi thành công / {zaloResults.summary.total} tổng
                            </div>
                            <div className="max-h-32 overflow-y-auto space-y-1">
                                {zaloResults.results.map((r: any, i: number) => (
                                    <div key={i} className={`text-xs px-2 py-1 rounded ${
                                        r.status === 'sent' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                        r.status === 'skipped' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                    }`}>
                                        {r.status === 'sent' ? '✅' : r.status === 'skipped' ? '⏭️' : '❌'} {r.studentName}: {r.reason}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {!zaloEnabled && (
                <p className="text-xs text-gray-400 italic">
                    💡 Bật Zalo OA trong Cài đặt để gửi thông báo trực tiếp cho từng phụ huynh
                </p>
            )}

            <div className="flex justify-end gap-3 mt-4">
                <Button variant="secondary" onClick={onClose}>Đóng</Button>
                <Button onClick={() => {
                    navigator.clipboard.writeText(copyText).then(() => {
                        toast.success('Đã chép nội dung vào khay nhớ tạm!');
                        setTimeout(onClose, 1500);
                    }).catch(() => {
                        toast.error('Lỗi khi chép. Vui lòng thử chép thủ công.');
                    });
                }}>
                    {ICONS.copy} <span className="ml-2">Chép tin nhắn</span>
                </Button>
            </div>
        </div>
    );
};
