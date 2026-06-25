
import type {
    AppData,
    AttendanceRecord,
    Payroll,
    Transaction,
    PayrollClassDetail
} from '../../types.js';

import {
    PersonStatus,
    FeeType,
    AttendanceStatus,
    SalaryType,
    UserRole,
    TransactionType,
    ExpenseCategory
} from '../../types.js';

import { getVietnamTime } from '../../utils/date.js';
import { getMockDataState } from './mockData.js';

const generateUniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

// This function takes the current data and an operation, and returns the new data state.
// All logic is pure and operates on the provided data object.
export function applyOperation(
    data: Omit<AppData, 'loading'>, 
    operation: { op: string, payload: any }
): Omit<AppData, 'loading'> {
    const { op, payload } = operation;

    const recalculateStudentInvoices = (studentId: string, triggerDate?: string) => {
        const student = data.students.find(s => s.id === studentId);
        if (!student) return;

        const studentInvoices = data.invoices.filter(inv => inv.studentId === studentId && inv.status !== 'CANCELLED');
        studentInvoices.sort((a, b) => new Date(a.generatedDate).getTime() - new Date(b.generatedDate).getTime());

        let totalActiveInvoiceAmount = studentInvoices.reduce((sum, inv) => sum + inv.amount, 0);
        let availableFunds = student.balance + totalActiveInvoiceAmount;

        // Pass 1: Deduct funds for already PAID invoices to lock in manual payments
        for (const invoice of studentInvoices) {
            if (invoice.status === 'PAID' && invoice.amount > 0) {
                availableFunds -= invoice.amount;
            }
        }
        
        // Pass 2: If availableFunds is negative, we have PAID invoices that exceed actual cash.
        // We must revoke PAID status from newest invoices until availableFunds >= 0.
        if (availableFunds < -100) { // allow small 100VND buffer
            // Reverse sort to revoke newest first
            const reverseInvoices = [...studentInvoices].reverse();
            for (const invoice of reverseInvoices) {
                if (invoice.status === 'PAID' && invoice.amount > 0) {
                    invoice.status = 'UNPAID';
                    invoice.paidDate = null;
                    availableFunds += invoice.amount;
                    if (availableFunds >= -100) break;
                }
            }
        }

        // Pass 3: Distribute any remaining availableFunds to UNPAID invoices (older first)
        for (const invoice of studentInvoices) {
            if (invoice.amount === 0) {
                if (invoice.status !== 'PAID') {
                    invoice.status = 'PAID';
                    invoice.paidDate = triggerDate || getVietnamTime();
                }
            } else if (invoice.status === 'UNPAID') {
                if (availableFunds >= invoice.amount - 100) {
                    invoice.status = 'PAID';
                    invoice.paidDate = triggerDate || getVietnamTime();
                    // Consume the funds so we can continue paying subsequent invoices if enough is left
                    availableFunds -= invoice.amount;
                }
            }
        }
    };

    switch (op) {
        // SYSTEM OPERATIONS
        case 'compactData': {
            // No-op. The actual compaction happens during sharding in data.ts
            // because getShardKey has been updated to use monthly chunks.
            break;
        }
        
        // STUDENT OPERATIONS
        case 'addStudent': {
            const { student, classIds } = payload;
            const newStudentId = student.id?.toUpperCase();
            if (data.students.some(s => s.id.toUpperCase() === newStudentId)) throw new Error(`Học viên với mã '${student.id}' đã tồn tại.`);
            if (data.teachers.some(t => t.id.toUpperCase() === newStudentId)) throw new Error(`Mã '${student.id}' đã được sử dụng cho giáo viên. Vui lòng chọn mã khác.`);
            if (data.staff.some(s => s.id.toUpperCase() === newStudentId)) throw new Error(`Mã '${student.id}' đã được sử dụng cho nhân viên. Vui lòng chọn mã khác.`);
            if (newStudentId === 'ADMIN' || newStudentId === 'VIEWER') throw new Error(`Mã '${student.id}' là tài khoản hệ thống, không thể sử dụng.`);
            const now = getVietnamTime();
            const newStudent = { 
                ...student, 
                createdAt: now.split('T')[0], 
                balance: 0, 
                statusChangedAt: now,
                statusHistory: [{ status: student.status, changedAt: now }]
            };
            data.students.push(newStudent);
            data.classes.forEach(c => {
                if (classIds.includes(c.id)) c.studentIds.push(newStudent.id);
            });
            break;
        }
        case 'updateStudent': {
            const { originalId, updatedStudent, classIds } = payload;
            if (originalId !== updatedStudent.id && data.students.some(s => s.id === updatedStudent.id)) throw new Error(`Học viên với mã '${updatedStudent.id}' đã tồn tại.`);
            
            const originalStudent = data.students.find(s => s.id === originalId);
            
            // Preserve password if it exists and wasn't provided in the update
            if (originalStudent && originalStudent.password && !updatedStudent.password) {
                updatedStudent.password = originalStudent.password;
            }

            // Preserve existing history or initialize it
            updatedStudent.statusHistory = originalStudent?.statusHistory || [];
            if (originalStudent && !originalStudent.statusHistory && originalStudent.statusChangedAt) {
                 updatedStudent.statusHistory = [{ status: originalStudent.status, changedAt: originalStudent.statusChangedAt }];
            }

            if (originalStudent && originalStudent.status !== updatedStudent.status) {
                const now = getVietnamTime();
                updatedStudent.statusChangedAt = now;
                updatedStudent.statusHistory.push({ status: updatedStudent.status, changedAt: now });
            } else if (originalStudent && originalStudent.statusChangedAt) {
                updatedStudent.statusChangedAt = originalStudent.statusChangedAt;
            }

            data.students = data.students.map(s => s.id === originalId ? updatedStudent : s);
            if (originalId !== updatedStudent.id) {
                data.attendance.forEach(a => { if (a.studentId === originalId) a.studentId = updatedStudent.id; });
                data.invoices.forEach(i => { if (i.studentId === originalId) { i.studentId = updatedStudent.id; i.studentName = updatedStudent.name; } });
                data.progressReports.forEach(p => { if (p.studentId === originalId) p.studentId = updatedStudent.id; });
                data.transactions.forEach(t => { if (t.studentId === originalId) t.studentId = updatedStudent.id; });
            }
            const newClassIds = new Set(classIds);
            data.classes.forEach(c => {
                const studentIds = new Set(c.studentIds);
                if (studentIds.has(originalId)) studentIds.delete(originalId);
                if (newClassIds.has(c.id)) studentIds.add(updatedStudent.id);
                c.studentIds = Array.from(studentIds);
            });
            break;
        }
        case 'deleteStudent': {
            const { studentId } = payload;
            if (data.transactions.some(t => t.studentId === studentId) || data.invoices.some(i => i.studentId === studentId)) {
                throw new Error("Không thể xóa học viên đã có dữ liệu giao dịch hoặc hóa đơn. Hãy sử dụng chức năng Lưu trữ thay vì Xóa.");
            }
            if (data.attendance.some(a => a.studentId === studentId)) {
                throw new Error("Không thể xóa học viên đã có dữ liệu điểm danh. Hãy sử dụng chức năng Lưu trữ thay vì Xóa.");
            }
            data.students = data.students.filter(s => s.id !== studentId);
            data.classes.forEach(c => { c.studentIds = c.studentIds.filter(id => id !== studentId); });
            data.progressReports = data.progressReports.filter(p => p.studentId !== studentId);
            break;
        }
        case 'archiveStudent': {
            const { studentId } = payload;
            const student = data.students.find(s => s.id === studentId);
            if (!student) throw new Error("Không tìm thấy học viên.");
            const now = getVietnamTime();
            student.status = PersonStatus.ARCHIVED;
            student.statusChangedAt = now;
            if (!student.statusHistory) student.statusHistory = [];
            student.statusHistory.push({ status: PersonStatus.ARCHIVED, changedAt: now });
            // Remove from all class enrollments
            data.classes.forEach(c => { c.studentIds = c.studentIds.filter(id => id !== studentId); });
            break;
        }
        case 'restoreStudent': {
            const { studentId } = payload;
            const student = data.students.find(s => s.id === studentId);
            if (!student) throw new Error("Không tìm thấy học viên.");
            const now = getVietnamTime();
            student.status = PersonStatus.INACTIVE;
            student.statusChangedAt = now;
            if (!student.statusHistory) student.statusHistory = [];
            student.statusHistory.push({ status: PersonStatus.INACTIVE, changedAt: now });
            break;
        }
        case 'addStudentNote': {
            const { studentId, note } = payload;
            const student = data.students.find(s => s.id === studentId);
            if (!student) throw new Error('Không tìm thấy học viên');
            if (!student.internalNotes) student.internalNotes = [];
            student.internalNotes.unshift({
                id: generateUniqueId('NOTE'),
                text: note.text,
                createdAt: getVietnamTime(),
                createdBy: note.createdBy || 'Admin',
            });
            break;
        }
        case 'deleteStudentNote': {
            const { studentId, noteId } = payload;
            const student = data.students.find(s => s.id === studentId);
            if (student && student.internalNotes) {
                student.internalNotes = student.internalNotes.filter(n => n.id !== noteId);
            }
            break;
        }
        case 'updateStudentTags': {
            const { studentId, tags } = payload;
            const student = data.students.find(s => s.id === studentId);
            if (student) {
                student.tags = tags;
            }
            break;
        }
        
        // TEACHER OPERATIONS
        case 'addTeacher': {
            const newId = payload.id?.toUpperCase();
            if (data.teachers.some(item => item.id.toUpperCase() === newId)) throw new Error(`Giáo viên với mã '${payload.id}' đã tồn tại.`);
            if (data.staff.some(item => item.id.toUpperCase() === newId)) throw new Error(`Mã '${payload.id}' đã được sử dụng cho nhân viên. Vui lòng chọn mã khác.`);
            if (data.students.some(item => item.id.toUpperCase() === newId)) throw new Error(`Mã '${payload.id}' đã được sử dụng cho học viên. Vui lòng chọn mã khác.`);
            if (newId === 'ADMIN' || newId === 'VIEWER') throw new Error(`Mã '${payload.id}' là tài khoản hệ thống, không thể sử dụng.`);
            data.teachers.push({ ...payload, createdAt: getVietnamTime().split('T')[0] });
            break;
        }
        case 'updateTeacher': {
            const { originalId, updatedTeacher } = payload;
            if (originalId !== updatedTeacher.id && data.teachers.some(t => t.id === updatedTeacher.id)) throw new Error("Mã giáo viên đã tồn tại.");
            
            const originalTeacher = data.teachers.find(t => t.id === originalId);
            
            // Preserve password if it exists and wasn't provided in the update
            if (originalTeacher && originalTeacher.password && !updatedTeacher.password) {
                updatedTeacher.password = originalTeacher.password;
            }

            const nameChanged = originalTeacher && originalTeacher.name !== updatedTeacher.name;

            data.teachers = data.teachers.map(t => t.id === originalId ? updatedTeacher : t);
            
            if (originalId !== updatedTeacher.id) {
                data.classes.forEach(c => { c.teacherIds = c.teacherIds.map(tid => tid === originalId ? updatedTeacher.id : tid); });
                data.attendance.forEach(a => {
                    if (a.teacherIds) {
                        a.teacherIds = a.teacherIds.map(tid => tid === originalId ? updatedTeacher.id : tid);
                    }
                });
                data.payrolls.forEach(p => {
                    if (p.teacherId === originalId) {
                        const oldPayrollId = p.id;
                        p.teacherId = updatedTeacher.id;
                        p.teacherName = updatedTeacher.name;
                        p.id = `PAY-${updatedTeacher.id}-${p.month}`;
                        
                        const expense = data.expenses.find(e => e.id === `EXP-${oldPayrollId}`);
                        if (expense) {
                            expense.id = `EXP-${p.id}`;
                            expense.description = `Lương T${p.month.split('-')[1]} - ${updatedTeacher.name}`;
                        }
                    }
                });
            } else if (nameChanged) {
                data.payrolls.forEach(p => {
                    if (p.teacherId === originalId) {
                        p.teacherName = updatedTeacher.name;
                        const expense = data.expenses.find(e => e.id === `EXP-${p.id}`);
                        if (expense) {
                            expense.description = `Lương T${p.month.split('-')[1]} - ${updatedTeacher.name}`;
                        }
                    }
                });
            }
            break;
        }
        case 'deleteTeacher': {
            const { teacherId } = payload;
            if (data.payrolls.some(p => p.teacherId === teacherId)) {
                throw new Error("Không thể xóa giáo viên đã có dữ liệu bảng lương.");
            }
            if (data.progressReports.some(p => p.createdBy === teacherId)) {
                throw new Error("Không thể xóa giáo viên đã có dữ liệu báo cáo học tập.");
            }
            if (data.attendance.some(a => a.teacherIds?.includes(teacherId))) {
                throw new Error("Không thể xóa giáo viên đã có dữ liệu điểm danh. Vui lòng chuyển trạng thái sang Không hoạt động.");
            }
            data.teachers = data.teachers.filter(t => t.id !== teacherId);
            data.classes.forEach(c => { c.teacherIds = c.teacherIds.filter(id => id !== teacherId); });
            break;
        }

        // STAFF OPERATIONS
        case 'addStaff': {
            const newStaffId = payload.id?.toUpperCase();
            if (data.staff.some(item => item.id.toUpperCase() === newStaffId)) throw new Error(`Nhân viên với mã '${payload.id}' đã tồn tại.`);
            if (data.teachers.some(item => item.id.toUpperCase() === newStaffId)) throw new Error(`Mã '${payload.id}' đã được sử dụng cho giáo viên. Vui lòng chọn mã khác.`);
            if (data.students.some(item => item.id.toUpperCase() === newStaffId)) throw new Error(`Mã '${payload.id}' đã được sử dụng cho học viên. Vui lòng chọn mã khác.`);
            if (newStaffId === 'ADMIN' || newStaffId === 'VIEWER') throw new Error(`Mã '${payload.id}' là tài khoản hệ thống, không thể sử dụng.`);
            data.staff.push({ ...payload, createdAt: getVietnamTime().split('T')[0] });
            break;
        }
        case 'updateStaff': {
            const { originalId, updatedStaff } = payload;
            if (originalId !== updatedStaff.id && data.staff.some(s => s.id === updatedStaff.id)) throw new Error("Mã nhân viên đã tồn tại.");
            
            const originalStaff = data.staff.find(s => s.id === originalId);
            // Preserve password if it exists and wasn't provided in the update
            if (originalStaff && originalStaff.password && !updatedStaff.password) {
                updatedStaff.password = originalStaff.password;
            }

            data.staff = data.staff.map(t => t.id === originalId ? updatedStaff : t);
            break;
        }
        case 'deleteStaff': {
            data.staff = data.staff.filter(item => item.id !== payload.staffId);
            break;
        }

        // CLASS OPERATIONS
        case 'addClass': {
            if (data.classes.some(item => item.id === payload.id)) throw new Error(`Lớp học với mã '${payload.id}' đã tồn tại.`);
            data.classes.push(payload);
            break;
        }
        case 'updateClass': {
            const { originalId, updatedClass } = payload;
            if (originalId !== updatedClass.id && data.classes.some(c => c.id === updatedClass.id)) throw new Error("Mã lớp đã tồn tại.");
            
            const originalClass = data.classes.find(c => c.id === originalId);
            
            data.classes = data.classes.map(c => c.id === originalId ? updatedClass : c);
             if (originalId !== updatedClass.id) {
                data.attendance.forEach(a => { if (a.classId === originalId) a.classId = updatedClass.id; });
                data.progressReports.forEach(p => { if (p.classId === originalId) p.classId = updatedClass.id; });
                data.announcements.forEach(a => { if (a.classId === originalId) a.classId = updatedClass.id; });
            }
            
            if (originalClass && (originalId !== updatedClass.id || originalClass.name !== updatedClass.name)) {
                data.payrolls.forEach(p => {
                    if (p.classDetails) {
                        p.classDetails.forEach(cd => {
                            if (cd.classId === originalId) {
                                cd.classId = updatedClass.id;
                                cd.className = updatedClass.name;
                            }
                        });
                    }
                });
            }
            break;
        }
        case 'deleteClass': {
            const { classId } = payload;
            if (data.attendance.some(a => a.classId === classId)) {
                throw new Error("Không thể xóa lớp học đã có dữ liệu điểm danh.");
            }
            data.classes = data.classes.filter(c => c.id !== classId);
            data.progressReports = data.progressReports.filter(pr => pr.classId !== classId);
            data.announcements = data.announcements.filter(ann => ann.classId !== classId);
            break;
        }

        // ATTENDANCE
        case 'updateAttendance': {
            const records: AttendanceRecord[] = payload;
            const recordsByClassDate = new Map<string, AttendanceRecord[]>();
            records.forEach(r => {
                const key = `${r.classId}|${r.date}`;
                if (!recordsByClassDate.has(key)) recordsByClassDate.set(key, []);
                recordsByClassDate.get(key)!.push(r);
            });

            if (recordsByClassDate.size === 0) break;

            recordsByClassDate.forEach((newRecords, key) => {
                const [classId, date] = key.split('|');
                const cls = data.classes.find(c => c.id === classId);
                const currentTeacherIds = cls ? cls.teacherIds : [];
                
                data.attendance = data.attendance.filter(a => !(a.classId === classId && a.date === date));
                const recordsWithIds = newRecords.map(record => ({
                    ...record, 
                    id: record.id || generateUniqueId('ATT'),
                    teacherIds: record.teacherIds || currentTeacherIds
                }));
                data.attendance.push(...recordsWithIds);
            });
            break;
        }
        case 'updateSingleAttendance': {
            const { classId, studentId, date, status, note } = payload;
            const existingIndex = data.attendance.findIndex(a => a.classId === classId && a.date === date && a.studentId === studentId);
            if (existingIndex >= 0) {
                data.attendance[existingIndex].status = status;
                if (note !== undefined) data.attendance[existingIndex].note = note;
            } else {
                const cls = data.classes.find(c => c.id === classId);
                const currentTeacherIds = cls ? cls.teacherIds : [];
                data.attendance.push({
                    id: generateUniqueId('ATT'),
                    classId,
                    studentId,
                    date,
                    status,
                    note: note || '',
                    teacherIds: currentTeacherIds
                });
            }

            // Auto-notify teachers when parent submits leave request
            if (status === 'EXCUSED_ABSENT' && note && note.startsWith('PHHS xin phép')) {
                const cls = data.classes.find(c => c.id === classId);
                const student = data.students.find(s => s.id === studentId);
                if (cls && student) {
                    const dateFormatted = date.split('-').reverse().join('/');
                    data.announcements.unshift({
                        id: generateUniqueId('ANN'),
                        title: `📝 Xin nghỉ phép: ${student.name}`,
                        content: `PH của học viên ${student.name} (${studentId}) xin phép nghỉ lớp ${cls.name} ngày ${dateFormatted}.\nLý do: ${note.replace('PHHS xin phép: ', '')}`,
                        createdAt: getVietnamTime(),
                        createdBy: 'Hệ thống',
                        targetAudience: 'TEACHERS' as any,
                        classId: classId,
                    });
                }
            }
            break;
        }
        case 'deleteAttendanceForDate': {
            const { classId, date } = payload;
            data.attendance = data.attendance.filter(a => !(a.classId === classId && a.date === date));
            break;
        }
        case 'deleteAttendanceByMonth': {
            const { month, year } = payload;
            const monthStr = `${year}-${String(month).padStart(2, '0')}`;
            data.attendance = data.attendance.filter(a => !a.date.startsWith(monthStr));
            break;
        }

        // FINANCE / INVOICES
        case 'generateInvoices': {
            const { month, year } = payload;
            const monthStr = `${year}-${String(month).padStart(2, '0')}`;
            
            // PRE-CALCULATE ATTENDANCE DATA FOR THIS MONTH ONCE TO AVOID O(N^3) COMPLEXITY
            const monthAttendance = data.attendance.filter(a => a.date.startsWith(monthStr));
            
            const studentsWithAttendanceIds = new Set<string>();
            const classDates = new Map<string, Set<string>>(); // classId -> Set<date> for total sessions
            const studentClassAttendance = new Map<string, { present: number; late: number; unexcused: number; total: number }>();
            
            monthAttendance.forEach(a => {
                studentsWithAttendanceIds.add(a.studentId);
                
                if (a.status !== AttendanceStatus.UNMARKED) {
                    if (!classDates.has(a.classId)) classDates.set(a.classId, new Set());
                    classDates.get(a.classId)!.add(a.date);
                }
                
                const key = `${a.studentId}_${a.classId}`;
                if (!studentClassAttendance.has(key)) {
                    studentClassAttendance.set(key, { present: 0, late: 0, unexcused: 0, total: 0 });
                }
                const stats = studentClassAttendance.get(key)!;
                stats.total++;
                if (a.status === AttendanceStatus.PRESENT) stats.present++;
                else if (a.status === AttendanceStatus.LATE) stats.late++;
                else if (a.status === AttendanceStatus.UNEXCUSED_ABSENT) stats.unexcused++;
            });
            
            const activeStudentIds = new Set(data.students.filter(s => s.status === PersonStatus.ACTIVE).map(s => s.id));
            const studentsToInvoiceIds = new Set([...activeStudentIds, ...studentsWithAttendanceIds]);

            for (const studentId of studentsToInvoiceIds) {
                const student = data.students.find(s => s.id === studentId);
                if (!student) continue;

                let totalAmount = 0;
                let details = '';
                
                const relevantClassIds = new Set<string>();
                
                // Enrolled classes
                data.classes.forEach(c => {
                    if (c.studentIds.includes(student.id)) relevantClassIds.add(c.id);
                });
                
                // Classes with attendance in this month
                monthAttendance.forEach(a => {
                    if (a.studentId === student.id) relevantClassIds.add(a.classId);
                });

                const coursesToMarkBilled: string[] = [];

                for (const classId of relevantClassIds) {
                    const cls = data.classes.find(c => c.id === classId);
                    if (!cls) continue;

                    let classFee = 0;
                    const isEnrolled = cls.studentIds.includes(student.id);
                    
                    const attStats = studentClassAttendance.get(`${student.id}_${classId}`) || { present: 0, late: 0, unexcused: 0, total: 0 };
                    const physicallyAttended = attStats.present + attStats.late;
                    const billableSessions = physicallyAttended + attStats.unexcused;
                    const unexcused = attStats.unexcused;
                    
                    const totalSessionsInMonth = classDates.get(classId)?.size || 0;
                    
                    let attendanceText = `(Đi học: ${physicallyAttended}/${totalSessionsInMonth} buổi`;
                    if (unexcused > 0) attendanceText += `, Nghỉ không phép: ${unexcused} buổi`;
                    attendanceText += ')';

                    if (cls.fee.type === FeeType.MONTHLY) {
                        if (student.status === PersonStatus.ACTIVE && isEnrolled) {
                            classFee = cls.fee.amount;
                            if (classFee > 0) {
                                details += `- Lớp ${cls.name} ${attendanceText}: ${Math.round(classFee).toLocaleString('vi-VN')} ₫\n`;
                            }
                        }
                    } else if (cls.fee.type === FeeType.PER_COURSE) {
                        if (student.status === PersonStatus.ACTIVE && isEnrolled) {
                            if (!student.billedCourses?.includes(cls.id)) {
                                classFee = cls.fee.amount;
                                if (classFee > 0) {
                                    details += `- Lớp ${cls.name} (Trọn khóa) ${attendanceText}: ${Math.round(classFee).toLocaleString('vi-VN')} ₫\n`;
                                }
                                coursesToMarkBilled.push(cls.id);
                            }
                        }
                    } else if (cls.fee.type === FeeType.PER_SESSION) {
                        if (billableSessions > 0) {
                            classFee = billableSessions * cls.fee.amount;
                            details += `- Lớp ${cls.name} ${attendanceText}: Tính ${billableSessions} buổi x ${Math.round(cls.fee.amount).toLocaleString('vi-VN')} ₫ = ${Math.round(classFee).toLocaleString('vi-VN')} ₫\n`;
                        }
                    }
                    totalAmount += classFee;
                }

                // Apply discount if any
                if (student.discountPercentage && student.discountPercentage > 0) {
                    const discountAmount = Math.round(totalAmount * (student.discountPercentage / 100));
                    totalAmount -= discountAmount;
                    details += `- Miễn giảm (${student.discountPercentage}%): -${discountAmount.toLocaleString('vi-VN')} ₫\n`;
                }

                // Round total amount to avoid floating point errors
                totalAmount = Math.round(totalAmount);

                const existingInvoice = data.invoices.find(inv => inv.studentId === student.id && inv.month === monthStr && inv.status !== 'CANCELLED');

                if (existingInvoice) {
                    // Update existing invoice (even if PAID)
                    // Always update generatedDate and details to reflect current 'Generate' action
                    const amountDifference = totalAmount - existingInvoice.amount;
                    const detailsChanged = existingInvoice.details !== details.trim();
                    
                    existingInvoice.amount = totalAmount;
                    existingInvoice.details = details.trim();
                    
                    if (amountDifference !== 0 || detailsChanged) {
                        existingInvoice.generatedDate = getVietnamTime(); // Update date to today only if changed
                    }
                    
                    if (totalAmount === 0 && existingInvoice.status !== 'PAID') {
                        existingInvoice.status = 'PAID';
                        existingInvoice.paidDate = getVietnamTime();
                    }

                    // Update related transaction
                    const relatedTransaction = data.transactions.find(t => t.relatedInvoiceId === existingInvoice.id && t.type === TransactionType.INVOICE);
                    if(relatedTransaction) {
                        relatedTransaction.amount = -totalAmount;
                        relatedTransaction.date = existingInvoice.generatedDate; // Sync transaction date
                    }
                    
                    // Update student balance if amount changed
                    if (amountDifference !== 0) {
                        const studentToUpdate = data.students.find(s => s.id === student.id);
                        if (studentToUpdate) studentToUpdate.balance -= amountDifference;
                    }
                } else if (details.trim() !== '') {
                    // Create new invoice even if amount is 0 (e.g., 100% discount)
                    const invoiceId = generateUniqueId('INV');
                    const isZeroAmount = totalAmount === 0;
                    data.invoices.push({ 
                        id: invoiceId, 
                        studentId: student.id, 
                        studentName: student.name, 
                        month: monthStr, 
                        amount: totalAmount, 
                        details: details.trim(), 
                        status: isZeroAmount ? 'PAID' : 'UNPAID', 
                        generatedDate: getVietnamTime(), 
                        paidDate: isZeroAmount ? getVietnamTime() : null 
                    });
                    
                    // Create debit transaction
                    data.transactions.push({ id: generateUniqueId('TRX'), studentId: student.id, date: getVietnamTime(), type: TransactionType.INVOICE, description: `Hóa đơn học phí tháng ${month}/${year}`, amount: -totalAmount, relatedInvoiceId: invoiceId });
                    
                    // Update student balance
                    const studentToUpdate = data.students.find(s => s.id === student.id);
                    if (studentToUpdate) studentToUpdate.balance -= totalAmount;
                }
                
                // Recalculate invoice statuses for this student to handle pre-payments
                recalculateStudentInvoices(student.id, getVietnamTime());

                if (coursesToMarkBilled.length > 0) {
                    const studentToUpdate = data.students.find(s => s.id === student.id);
                    if (studentToUpdate) {
                        studentToUpdate.billedCourses = [...(studentToUpdate.billedCourses || []), ...coursesToMarkBilled];
                    }
                }
            }
            break;
        }
        case 'cancelInvoice': {
            const { invoiceId } = payload;
            const invoice = data.invoices.find(inv => inv.id === invoiceId);
            if (!invoice || invoice.status === 'CANCELLED') break;
            if (invoice.status === 'PAID' && invoice.amount > 0) throw new Error("Không thể hủy hóa đơn đã thanh toán.");
            invoice.status = 'CANCELLED';
            if (invoice.amount > 0) {
                const student = data.students.find(s => s.id === invoice.studentId);
                if (student) student.balance += invoice.amount;
                data.transactions.push({ id: generateUniqueId('TRX'), studentId: invoice.studentId, date: getVietnamTime(), type: TransactionType.ADJUSTMENT_CREDIT, description: `Hủy hóa đơn #${invoiceId}`, amount: invoice.amount, relatedInvoiceId: invoiceId });
            }
            recalculateStudentInvoices(invoice.studentId, getVietnamTime());
            break;
        }
        case 'updateInvoiceStatus': {
            const { invoiceId, status } = payload;
            const invoice = data.invoices.find(inv => inv.id === invoiceId);
            if (!invoice) throw new Error("Hóa đơn không tồn tại.");
            if (invoice.status === 'CANCELLED') throw new Error("Không thể cập nhật hóa đơn đã hủy.");
            
            const oldStatus = invoice.status;
            invoice.status = status;
            
            if (status === 'PAID' && oldStatus === 'UNPAID') {
                invoice.paidDate = getVietnamTime();
                // Create payment transaction
                data.transactions.push({
                    id: generateUniqueId('TRX'),
                    studentId: invoice.studentId,
                    date: getVietnamTime(),
                    type: TransactionType.PAYMENT,
                    description: `Thanh toán hóa đơn #${invoiceId}`,
                    amount: invoice.amount,
                    relatedInvoiceId: invoiceId,
                    paymentMethod: 'transfer'
                });
                const student = data.students.find(s => s.id === invoice.studentId);
                if (student) student.balance += invoice.amount;
            } else if (status === 'UNPAID' && oldStatus === 'PAID') {
                invoice.paidDate = null;
                // Remove related payment transaction
                const relatedTx = data.transactions.find(t => t.relatedInvoiceId === invoiceId && t.type === TransactionType.PAYMENT);
                if (relatedTx) {
                    data.transactions = data.transactions.filter(t => t.id !== relatedTx.id);
                    const student = data.students.find(s => s.id === invoice.studentId);
                    if (student) student.balance -= relatedTx.amount;
                }
            }
            
            recalculateStudentInvoices(invoice.studentId, getVietnamTime());
            break;
        }

        // TRANSACTIONS
        case 'addAdjustment': {
            const { studentId, amount, date, description, type, paymentMethod } = payload;
            const finalAmount = type === 'CREDIT' ? amount : -amount;
            const student = data.students.find(s => s.id === studentId);
            if (student) {
                student.balance += finalAmount;
                recalculateStudentInvoices(student.id, date);
            }
            data.transactions.push({ id: generateUniqueId('TRX'), studentId, date, type: type === 'CREDIT' ? TransactionType.PAYMENT : TransactionType.ADJUSTMENT_DEBIT, description, amount: finalAmount, paymentMethod: paymentMethod || 'transfer' });
            break;
        }
        case 'addAdvancePayment': {
            const { studentId, amount, date, description, paymentMethod, months: advMonths, details: advDetails } = payload;
            const student = data.students.find(s => s.id === studentId);
            if (!student) throw new Error("Học viên không tồn tại.");
            
            // 1. Create PAID invoice for record keeping
            const invoiceId = generateUniqueId('INV');
            const monthStr = date.substring(0, 7); // "YYYY-MM"
            data.invoices.push({
                id: invoiceId,
                studentId: student.id,
                studentName: student.name,
                month: monthStr,
                amount: amount,
                details: advDetails || `Thu trước ${advMonths || ''} tháng HP`,
                status: 'PAID',
                generatedDate: date,
                paidDate: date,
            });
            
            // 2. Create PAYMENT transaction (credit to student wallet)
            const trxId = generateUniqueId('TRX');
            data.transactions.push({
                id: trxId,
                studentId: student.id,
                date,
                type: TransactionType.PAYMENT,
                description: description || `Thu trước HP`,
                amount: amount, // positive = credit
                relatedInvoiceId: invoiceId,
                paymentMethod: paymentMethod || 'transfer',
            });
            
            // 3. Update student balance
            student.balance += amount;
            
            // 4. Recalculate invoice statuses
            recalculateStudentInvoices(student.id, date);
            break;
        }
        case 'updateTransaction': {
            const transaction: Transaction = payload;
            const oldTransaction = data.transactions.find(t => t.id === transaction.id);
            if (!oldTransaction) throw new Error("Giao dịch không tồn tại.");
            const amountDifference = transaction.amount - oldTransaction.amount;
            data.transactions = data.transactions.map(t => t.id === transaction.id ? transaction : t);
            const student = data.students.find(s => s.id === transaction.studentId);
            if (student) {
                student.balance += amountDifference;
                recalculateStudentInvoices(student.id, transaction.date);
            }
            break;
        }
        case 'deleteTransaction': {
            const { transactionId } = payload;
            const transaction = data.transactions.find(t => t.id === transactionId);
            if (!transaction) throw new Error("Giao dịch không tồn tại hoặc đã bị xóa!");
            data.transactions = data.transactions.filter(t => t.id !== transactionId);
            const student = data.students.find(s => s.id === transaction.studentId);
            if (student) {
                student.balance -= transaction.amount;
                recalculateStudentInvoices(student.id, transaction.date);
            }
            break;
        }
         case 'clearAllTransactions': {
            data.students.forEach(student => student.balance = 0);
            data.transactions = [];
            data.invoices = [];
            break;
        }

        // PAYROLL
        case 'generatePayrolls': {
            const { month, year } = payload;
            const monthStr = `${year}-${String(month).padStart(2, '0')}`;
            const calculationDate = getVietnamTime().split('T')[0];
            
            // Optimization: Pre-calculate sessions per class for the month using a Map
            // Now we need to track sessions per teacher per class
            const teacherClassSessionsMap = new Map<string, Set<string>>(); // "teacherId|classId" -> Set of dates
            
            data.attendance.forEach(a => {
                if (a.date.startsWith(monthStr) && a.status !== AttendanceStatus.UNMARKED) {
                    // If attendance record has teacherIds, use them. Otherwise fallback to current class teachers
                    let tIds = a.teacherIds;
                    if (!tIds || tIds.length === 0) {
                        const cls = data.classes.find(c => c.id === a.classId);
                        tIds = cls ? cls.teacherIds : [];
                    }
                    
                    tIds.forEach(tId => {
                        const key = `${tId}|${a.classId}`;
                        if (!teacherClassSessionsMap.has(key)) {
                            teacherClassSessionsMap.set(key, new Set());
                        }
                        teacherClassSessionsMap.get(key)!.add(a.date);
                    });
                }
            });

            // Get all teachers
            const allTeachers = data.teachers;
            
            for(const teacher of allTeachers) {
                let baseSalary = 0, totalSessionsTaught = 0;
                const classDetails: PayrollClassDetail[] = [];
                
                // Find all classes this teacher taught this month
                const taughtClassIds = new Set<string>();
                for (const key of teacherClassSessionsMap.keys()) {
                    if (key.startsWith(`${teacher.id}|`)) {
                        taughtClassIds.add(key.split('|')[1]);
                    }
                }
                
                for (const classId of taughtClassIds) {
                    const cls = data.classes.find(c => c.id === classId);
                    const className = cls ? cls.name : 'Lớp đã xóa';
                    const sessions = teacherClassSessionsMap.get(`${teacher.id}|${classId}`)?.size || 0;
                    
                    if (sessions > 0) {
                        classDetails.push({
                            classId: classId,
                            className: className,
                            sessionsTaught: sessions
                        });
                        totalSessionsTaught += sessions;
                    }
                }

                // If teacher is inactive and has no sessions, skip
                if (teacher.status === PersonStatus.INACTIVE && totalSessionsTaught === 0) {
                    continue;
                }

                if (teacher.salaryType === SalaryType.MONTHLY) {
                    baseSalary = teacher.rate;
                } else {
                    baseSalary = totalSessionsTaught * teacher.rate;
                }
                
                const payrollId = `PAY-${teacher.id}-${monthStr}`;
                const existingPayroll = data.payrolls.find(p => p.id === payrollId);
                
                // Preserve existing manual edits if they exist
                const bonus = existingPayroll ? existingPayroll.bonus : 0;
                const deduction = existingPayroll ? existingPayroll.deduction : 0;
                const status = existingPayroll ? existingPayroll.status : 'UNPAID';
                const paidDate = existingPayroll ? existingPayroll.paidDate : undefined;
                
                // Ensure total salary is never negative and rounded
                const totalSalary = Math.max(0, Math.round(baseSalary + bonus - deduction));

                const newPayroll: Payroll = { 
                    id: payrollId, 
                    teacherId: teacher.id, 
                    teacherName: teacher.name, 
                    month: monthStr, 
                    sessionsTaught: totalSessionsTaught, 
                    rate: teacher.rate, 
                    baseSalary: Math.round(baseSalary), 
                    bonus,
                    deduction,
                    totalSalary,
                    status,
                    paidDate,
                    calculationDate: calculationDate,
                    classDetails
                };
                
                const existingIndex = data.payrolls.findIndex(p => p.id === payrollId);
                if (existingIndex !== -1) {
                    data.payrolls[existingIndex] = newPayroll;
                    
                    // IMPORTANT: If the payroll was already PAID, we must sync the expense amount
                    if (status === 'PAID') {
                        const expenseId = `EXP-${payrollId}`;
                        const existingExpense = data.expenses.find(e => e.id === expenseId);
                        if (existingExpense) {
                            existingExpense.amount = totalSalary;
                        }
                    }
                } else {
                    data.payrolls.push(newPayroll);
                }
            }
            break;
        }
        case 'updatePayroll': {
            const { payrollId, bonus, deduction, status } = payload;
            const payroll = data.payrolls.find(p => p.id === payrollId);
            if (!payroll) throw new Error("Bảng lương không tồn tại.");

            payroll.bonus = bonus;
            payroll.deduction = deduction;
            payroll.status = status;
            // Recalculate total
            payroll.totalSalary = Math.max(0, Math.round(payroll.baseSalary + bonus - deduction));
            
            const expenseId = `EXP-${payrollId}`;

            if (status === 'PAID') {
                // If marking as paid, set date if missing
                if (!payroll.paidDate) {
                     payroll.paidDate = getVietnamTime();
                }
                
                // Create or Update Expense record automatically
                const existingExpense = data.expenses.find(e => e.id === expenseId);
                if (existingExpense) {
                    existingExpense.amount = payroll.totalSalary;
                    existingExpense.description = `Lương T${payroll.month.split('-')[1]} - ${payroll.teacherName}`;
                    existingExpense.date = payroll.paidDate;
                } else {
                    data.expenses.push({
                        id: expenseId,
                        description: `Lương T${payroll.month.split('-')[1]} - ${payroll.teacherName}`,
                        amount: payroll.totalSalary,
                        category: ExpenseCategory.SALARY,
                        date: payroll.paidDate
                    });
                }
            } else if (status === 'UNPAID') {
                // If marking as unpaid, clear date and remove expense
                payroll.paidDate = undefined;
                data.expenses = data.expenses.filter(e => e.id !== expenseId);
            }
            break;
        }

        // OTHER
        case 'addProgressReport': {
            data.progressReports.push({ ...payload, id: generateUniqueId('PR') });
            break;
        }
        case 'addBulkProgressReports': {
            const records: any[] = payload.records;
            records.forEach(r => {
                data.progressReports.push({ ...r, id: generateUniqueId('PR') });
            });
            break;
        }
        case 'updateProgressReport': {
            const { id, ...updates } = payload;
            data.progressReports = data.progressReports.map(r => r.id === id ? { ...r, ...updates } : r);
            break;
        }
        case 'deleteProgressReport': {
            data.progressReports = data.progressReports.filter(r => r.id !== payload.reportId);
            break;
        }
        case 'addIncome': {
            data.income.push({ ...payload, id: generateUniqueId('INC') });
            break;
        }
        case 'updateIncome': {
            data.income = data.income.map(i => i.id === payload.id ? payload : i);
            break;
        }
        case 'deleteIncome': {
            data.income = data.income.filter(i => i.id !== payload.itemId);
            break;
        }
        case 'addExpense': {
            data.expenses.push({ ...payload, id: generateUniqueId('EXP') });
            break;
        }
        case 'updateExpense': {
            if (payload.id.startsWith('EXP-PAY-')) {
                throw new Error("Không thể sửa phiếu chi tự động từ bảng lương.");
            }
            data.expenses = data.expenses.map(e => e.id === payload.id ? payload : e);
            break;
        }
        case 'deleteExpense': {
            if (payload.itemId.startsWith('EXP-PAY-')) {
                throw new Error("Không thể xóa phiếu chi tự động từ bảng lương.");
            }
            data.expenses = data.expenses.filter(i => i.id !== payload.itemId);
            break;
        }
        case 'addAnnouncement': {
            const newAnnouncement = { 
                ...payload, 
                id: generateUniqueId('ANN'), 
                createdAt: getVietnamTime() 
            };
            data.announcements.unshift(newAnnouncement);
            break;
        }
        case 'deleteAnnouncement': {
            data.announcements = data.announcements.filter(a => a.id !== payload.id);
            break;
        }
        case 'markAnnouncementRead': {
            const { announcementId, userId } = payload;
            const announcement = data.announcements.find(a => a.id === announcementId);
            if (announcement) {
                if (!announcement.readBy) announcement.readBy = {};
                announcement.readBy[userId] = getVietnamTime();
            }
            break;
        }
        case 'markAnnouncementsReadBatch': {
            const { announcementIds, userId } = payload;
            const now = getVietnamTime();
            (announcementIds || []).forEach((annId: string) => {
                const announcement = data.announcements.find(a => a.id === annId);
                if (announcement) {
                    if (!announcement.readBy) announcement.readBy = {};
                    announcement.readBy[userId] = now;
                }
            });
            break;
        }
        
        // SETTINGS & DATA MANAGEMENT
        case 'updateSettings': {
            const originalSettings = data.settings;
            // Merge: preserve existing server-side fields (zaloAccessToken, zaloTokenExpiresAt, etc.)
            data.settings = { ...originalSettings, ...payload };
            // Preserve admin password if not provided
            if (originalSettings && originalSettings.adminPassword && !payload.adminPassword) {
                data.settings.adminPassword = originalSettings.adminPassword;
            }
            break;
        }
        case 'updateUserPassword': {
            const { userId, role, newPassword, currentPassword } = payload;
            
            if (role === UserRole.ADMIN) {
                if (currentPassword === undefined) {
                    throw new Error('Mật khẩu hiện tại là bắt buộc.');
                }
                const correctCurrentPassword = data.settings?.adminPassword || '123456';
                if (currentPassword !== correctCurrentPassword) throw new Error('Mật khẩu hiện tại không đúng.');
                
                if (!data.settings) data.settings = getMockDataState().settings;
                data.settings.adminPassword = newPassword;
                break;
            }

            let userList;
            if (role === UserRole.PARENT) userList = data.students;
            else if (role === UserRole.TEACHER) userList = data.teachers;
            else if (role === UserRole.MANAGER || role === UserRole.ACCOUNTANT) userList = data.staff;
            else throw new Error('Vai trò không hợp lệ.');
            
            const user = userList.find(u => u.id === userId);
            if (!user) throw new Error('Không tìm thấy người dùng.');
            
            if (currentPassword !== undefined) {
                const existingPasswordIsDob = user && 'dob' in user && user.dob ? user.dob.split('-').reverse().join('') : null;
                const correctCurrentPassword = user.password || existingPasswordIsDob;
                if (currentPassword !== correctCurrentPassword) throw new Error('Mật khẩu hiện tại không đúng.');
            }
            user.password = newPassword;
            break;
        }
        case 'clearCollections': {
            const collectionKeys: ('students' | 'teachers' | 'staff' | 'classes')[] = payload;
            for (const key of collectionKeys) { (data as any)[key] = []; }
            if (collectionKeys.includes('students')) {
                data.attendance = []; data.invoices = []; data.progressReports = []; data.transactions = [];
                data.classes.forEach(c => { c.studentIds = []; });
            }
            if (collectionKeys.includes('teachers')) {
                data.payrolls = [];
                data.classes.forEach(c => { c.teacherIds = []; });
            }
            if (collectionKeys.includes('classes')) { data.attendance = []; data.progressReports = []; }
            break;
        }

        // === AUDIT LOG ===
        case 'addAuditLog': {
            if (!data.auditLogs) data.auditLogs = [];
            data.auditLogs.unshift({ ...payload, id: generateUniqueId('LOG') });
            // Keep only last 500 entries
            if (data.auditLogs.length > 500) data.auditLogs = data.auditLogs.slice(0, 500);
            break;
        }

        // === ROOMS ===
        case 'addRoom': {
            if (!data.rooms) data.rooms = [];
            data.rooms.push({ ...payload, id: generateUniqueId('ROOM') });
            break;
        }
        case 'updateRoom': {
            if (!data.rooms) data.rooms = [];
            const roomIdx = data.rooms.findIndex((r: any) => r.id === payload.id);
            if (roomIdx !== -1) {
                data.rooms[roomIdx] = { ...data.rooms[roomIdx], ...payload };
            }
            break;
        }
        case 'deleteRoom': {
            if (!data.rooms) data.rooms = [];
            const roomId = payload.roomId || payload.id;
            data.rooms = data.rooms.filter((r: any) => r.id !== roomId);
            // Remove roomId references from class schedules
            data.classes.forEach(cls => {
                cls.schedule.forEach((s: any) => {
                    if (s.roomId === roomId) delete s.roomId;
                });
            });
            break;
        }

        default:
            throw new Error(`Thao tác không xác định: ${op}`);
    }

    return data;
}
