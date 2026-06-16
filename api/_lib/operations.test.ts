import { describe, it, expect, beforeEach } from 'vitest';
import { applyOperation } from './operations';
import { PersonStatus, FeeType, SalaryType, UserRole, AttendanceStatus, TransactionType, ExpenseCategory, IncomeCategory, ClassStatus } from '../../types';

// Helper: create a clean base state for each test
function createBaseState() {
    return {
        students: [],
        teachers: [],
        staff: [],
        classes: [],
        attendance: [],
        invoices: [],
        progressReports: [],
        transactions: [],
        income: [],
        expenses: [],
        settings: {
            name: 'Test Center',
            logoUrl: '',
            themeColor: '#4f46e5',
            theme: 'light' as const,
            onboardingStepsCompleted: [],
        },
        payrolls: [],
        announcements: [],
        auditLogs: [],
        rooms: [],
    };
}

function createStudent(overrides: any = {}) {
    return {
        id: 'HS001', name: 'Nguyễn Văn A', dob: '2010-01-15', phone: '0123456789',
        address: '123 Đường ABC', parentName: 'Nguyễn Văn B', email: 'a@test.com',
        status: PersonStatus.ACTIVE, createdAt: '2024-01-01', balance: 0, gender: 'Nam' as const,
        ...overrides,
    };
}

function createTeacher(overrides: any = {}) {
    return {
        id: 'GV001', name: 'Trần Thị C', dob: '1990-05-20', phone: '0987654321',
        address: '456 Đường XYZ', qualification: 'Cử nhân', subject: 'Toán',
        status: PersonStatus.ACTIVE, role: UserRole.TEACHER, salaryType: SalaryType.PER_SESSION,
        rate: 100000, createdAt: '2024-01-01', email: '',
        ...overrides,
    };
}

function createClass(overrides: any = {}) {
    return {
        id: 'LOP001', name: 'Toán 10', teacherIds: ['GV001'], subject: 'Toán',
        schedule: [{ dayOfWeek: 'Monday' as const, startTime: '08:00', endTime: '10:00' }],
        studentIds: [], fee: { type: FeeType.PER_SESSION, amount: 50000 },
        classStatus: ClassStatus.ACTIVE,
        ...overrides,
    };
}

// =====================================================
// STUDENT OPERATIONS
// =====================================================
describe('Student Operations', () => {
    let state: ReturnType<typeof createBaseState>;

    beforeEach(() => {
        state = createBaseState();
    });

    it('addStudent: should add a student and assign to classes', () => {
        state.classes.push(createClass());
        const result = applyOperation(state, {
            op: 'addStudent',
            payload: { student: createStudent(), classIds: ['LOP001'] },
        });
        expect(result.students).toHaveLength(1);
        expect(result.students[0].id).toBe('HS001');
        expect(result.students[0].balance).toBe(0);
        expect(result.classes[0].studentIds).toContain('HS001');
    });

    it('addStudent: should throw on duplicate ID', () => {
        state.students.push(createStudent() as any);
        expect(() => applyOperation(state, {
            op: 'addStudent',
            payload: { student: createStudent(), classIds: [] },
        })).toThrow();
    });

    it('updateStudent: should update and re-assign classes', () => {
        state.students.push(createStudent() as any);
        state.classes.push(createClass({ studentIds: ['HS001'] }));
        state.classes.push(createClass({ id: 'LOP002', name: 'Lý 10', studentIds: [] }));
        
        const updated = { ...createStudent(), name: 'Nguyễn Văn A Updated' };
        const result = applyOperation(state, {
            op: 'updateStudent',
            payload: { originalId: 'HS001', updatedStudent: updated, classIds: ['LOP002'] },
        });
        expect(result.students[0].name).toBe('Nguyễn Văn A Updated');
        expect(result.classes[0].studentIds).not.toContain('HS001'); // removed from LOP001
        expect(result.classes[1].studentIds).toContain('HS001'); // added to LOP002
    });

    it('updateStudent: should cascade ID change to attendance, invoices, etc.', () => {
        state.students.push(createStudent() as any);
        state.attendance.push({ id: 'A1', classId: 'LOP001', studentId: 'HS001', date: '2024-01-15', status: AttendanceStatus.PRESENT } as any);
        state.invoices.push({ id: 'INV1', studentId: 'HS001', studentName: 'Test', month: '2024-01', amount: 100000, status: 'UNPAID', generatedDate: '2024-01-01', paidDate: null, details: '' } as any);

        const updated = { ...createStudent(), id: 'HS002' };
        const result = applyOperation(state, {
            op: 'updateStudent',
            payload: { originalId: 'HS001', updatedStudent: updated, classIds: [] },
        });
        expect(result.attendance[0].studentId).toBe('HS002');
        expect(result.invoices[0].studentId).toBe('HS002');
    });

    it('deleteStudent: should remove student and clean up classes', () => {
        state.students.push(createStudent() as any);
        state.classes.push(createClass({ studentIds: ['HS001'] }));
        
        const result = applyOperation(state, {
            op: 'deleteStudent',
            payload: { studentId: 'HS001' },
        });
        expect(result.students).toHaveLength(0);
        expect(result.classes[0].studentIds).not.toContain('HS001');
    });

    it('deleteStudent: should throw if student has transactions', () => {
        state.students.push(createStudent() as any);
        state.transactions.push({ id: 'T1', studentId: 'HS001', date: '2024-01-01', type: TransactionType.PAYMENT, description: 'Test', amount: 100000 } as any);
        
        expect(() => applyOperation(state, {
            op: 'deleteStudent',
            payload: { studentId: 'HS001' },
        })).toThrow();
    });

    it('addStudentNote: should add note to student', () => {
        state.students.push(createStudent() as any);
        const result = applyOperation(state, {
            op: 'addStudentNote',
            payload: { studentId: 'HS001', note: { text: 'Test note', createdBy: 'Admin' } },
        });
        expect(result.students[0].internalNotes).toHaveLength(1);
        expect(result.students[0].internalNotes![0].text).toBe('Test note');
    });

    it('updateStudentTags: should update tags', () => {
        state.students.push(createStudent() as any);
        const result = applyOperation(state, {
            op: 'updateStudentTags',
            payload: { studentId: 'HS001', tags: ['VIP', 'Ưu tiên'] },
        });
        expect(result.students[0].tags).toEqual(['VIP', 'Ưu tiên']);
    });
});

// =====================================================
// TEACHER OPERATIONS
// =====================================================
describe('Teacher Operations', () => {
    let state: ReturnType<typeof createBaseState>;

    beforeEach(() => {
        state = createBaseState();
    });

    it('addTeacher: should add a teacher', () => {
        const result = applyOperation(state, {
            op: 'addTeacher',
            payload: createTeacher(),
        });
        expect(result.teachers).toHaveLength(1);
        expect(result.teachers[0].id).toBe('GV001');
    });

    it('addTeacher: should throw on duplicate ID', () => {
        state.teachers.push(createTeacher() as any);
        expect(() => applyOperation(state, {
            op: 'addTeacher',
            payload: createTeacher(),
        })).toThrow();
    });

    it('updateTeacher: should cascade ID change to classes and attendance', () => {
        state.teachers.push(createTeacher() as any);
        state.classes.push(createClass({ teacherIds: ['GV001'] }));
        state.attendance.push({ id: 'A1', classId: 'LOP001', studentId: 'HS001', date: '2024-01-15', status: AttendanceStatus.PRESENT, teacherIds: ['GV001'] } as any);

        const updated = { ...createTeacher(), id: 'GV002' };
        const result = applyOperation(state, {
            op: 'updateTeacher',
            payload: { originalId: 'GV001', updatedTeacher: updated },
        });
        expect(result.classes[0].teacherIds).toContain('GV002');
        expect(result.attendance[0].teacherIds).toContain('GV002');
    });
});

// =====================================================
// CLASS OPERATIONS
// =====================================================
describe('Class Operations', () => {
    let state: ReturnType<typeof createBaseState>;

    beforeEach(() => {
        state = createBaseState();
    });

    it('addClass: should add a class', () => {
        const result = applyOperation(state, {
            op: 'addClass',
            payload: createClass(),
        });
        expect(result.classes).toHaveLength(1);
    });

    it('addClass: should throw on duplicate ID', () => {
        state.classes.push(createClass() as any);
        expect(() => applyOperation(state, {
            op: 'addClass',
            payload: createClass(),
        })).toThrow();
    });

    it('updateClass: should cascade ID change', () => {
        state.classes.push(createClass() as any);
        state.attendance.push({ id: 'A1', classId: 'LOP001', studentId: 'HS001', date: '2024-01-15', status: AttendanceStatus.PRESENT } as any);
        state.progressReports.push({ id: 'PR1', classId: 'LOP001', studentId: 'HS001', date: '2024-01-15', score: 8, comments: '', createdBy: 'GV001' } as any);

        const updated = { ...createClass(), id: 'LOP002' };
        const result = applyOperation(state, {
            op: 'updateClass',
            payload: { originalId: 'LOP001', updatedClass: updated },
        });
        expect(result.attendance[0].classId).toBe('LOP002');
        expect(result.progressReports[0].classId).toBe('LOP002');
    });

    it('deleteClass: should throw if class has attendance', () => {
        state.classes.push(createClass() as any);
        state.attendance.push({ id: 'A1', classId: 'LOP001', studentId: 'HS001', date: '2024-01-15', status: AttendanceStatus.PRESENT } as any);

        expect(() => applyOperation(state, {
            op: 'deleteClass',
            payload: { classId: 'LOP001' },
        })).toThrow();
    });
});

// =====================================================
// ATTENDANCE
// =====================================================
describe('Attendance Operations', () => {
    let state: ReturnType<typeof createBaseState>;

    beforeEach(() => {
        state = createBaseState();
        state.classes.push(createClass({ studentIds: ['HS001'] }) as any);
        state.students.push(createStudent() as any);
        state.teachers.push(createTeacher() as any);
    });

    it('updateAttendance: should add attendance records', () => {
        const records = [
            { id: '', classId: 'LOP001', studentId: 'HS001', date: '2024-01-15', status: AttendanceStatus.PRESENT },
        ];
        const result = applyOperation(state, {
            op: 'updateAttendance',
            payload: records,
        });
        expect(result.attendance).toHaveLength(1);
        expect(result.attendance[0].studentId).toBe('HS001');
    });

    it('deleteAttendanceForDate: should delete attendance for specific class+date', () => {
        state.attendance.push(
            { id: 'A1', classId: 'LOP001', studentId: 'HS001', date: '2024-01-15', status: AttendanceStatus.PRESENT } as any,
            { id: 'A2', classId: 'LOP001', studentId: 'HS001', date: '2024-01-16', status: AttendanceStatus.PRESENT } as any,
        );
        const result = applyOperation(state, {
            op: 'deleteAttendanceForDate',
            payload: { classId: 'LOP001', date: '2024-01-15' },
        });
        expect(result.attendance).toHaveLength(1);
        expect(result.attendance[0].date).toBe('2024-01-16');
    });
});

// =====================================================
// FINANCE OPERATIONS
// =====================================================
describe('Finance Operations', () => {
    let state: ReturnType<typeof createBaseState>;

    beforeEach(() => {
        state = createBaseState();
        state.students.push(createStudent({ balance: 0 }) as any);
        state.classes.push(createClass({ studentIds: ['HS001'] }) as any);
    });

    it('addAdjustment CREDIT: should increase student balance', () => {
        const result = applyOperation(state, {
            op: 'addAdjustment',
            payload: { studentId: 'HS001', amount: 500000, date: '2024-01-15', description: 'Thanh toán HP', type: 'CREDIT', paymentMethod: 'transfer' },
        });
        expect(result.students[0].balance).toBe(500000);
        expect(result.transactions).toHaveLength(1);
        expect(result.transactions[0].amount).toBe(500000);
    });

    it('addAdjustment DEBIT: should decrease student balance', () => {
        state.students[0].balance = 1000000;
        const result = applyOperation(state, {
            op: 'addAdjustment',
            payload: { studentId: 'HS001', amount: 300000, date: '2024-01-15', description: 'Phí phát sinh', type: 'DEBIT' },
        });
        expect(result.students[0].balance).toBe(700000);
        expect(result.transactions[0].amount).toBe(-300000);
    });

    it('deleteTransaction: should revert student balance', () => {
        state.transactions.push({
            id: 'TRX-001', studentId: 'HS001', date: '2024-01-15',
            type: TransactionType.PAYMENT, description: 'Test', amount: 500000,
        } as any);
        state.students[0].balance = 500000;

        const result = applyOperation(state, {
            op: 'deleteTransaction',
            payload: { transactionId: 'TRX-001' },
        });
        expect(result.transactions).toHaveLength(0);
        expect(result.students[0].balance).toBe(0);
    });

    it('generateInvoices: should create invoices for students in classes', () => {
        state.attendance.push(
            { id: 'A1', classId: 'LOP001', studentId: 'HS001', date: '2024-01-15', status: AttendanceStatus.PRESENT } as any,
            { id: 'A2', classId: 'LOP001', studentId: 'HS001', date: '2024-01-22', status: AttendanceStatus.PRESENT } as any,
        );
        const result = applyOperation(state, {
            op: 'generateInvoices',
            payload: { month: 1, year: 2024 },
        });
        expect(result.invoices.length).toBeGreaterThan(0);
        expect(result.transactions.length).toBeGreaterThan(0);
    });
});

// =====================================================
// INCOME / EXPENSE
// =====================================================
describe('Income & Expense Operations', () => {
    let state: ReturnType<typeof createBaseState>;

    beforeEach(() => {
        state = createBaseState();
    });

    it('addIncome: should add income record', () => {
        const result = applyOperation(state, {
            op: 'addIncome',
            payload: { description: 'Bán tài liệu', amount: 200000, category: IncomeCategory.SALE, date: '2024-01-15' },
        });
        expect(result.income).toHaveLength(1);
        expect(result.income[0].amount).toBe(200000);
    });

    it('addExpense: should add expense record', () => {
        const result = applyOperation(state, {
            op: 'addExpense',
            payload: { description: 'Tiền điện', amount: 500000, category: ExpenseCategory.UTILITIES, date: '2024-01-15' },
        });
        expect(result.expenses).toHaveLength(1);
    });

    it('deleteIncome: should remove income', () => {
        state.income.push({ id: 'INC1', description: 'Test', amount: 100000, category: IncomeCategory.OTHER, date: '2024-01-15' } as any);
        const result = applyOperation(state, {
            op: 'deleteIncome',
            payload: { itemId: 'INC1' },
        });
        expect(result.income).toHaveLength(0);
    });
});

// =====================================================
// ROOMS
// =====================================================
describe('Room Operations', () => {
    let state: ReturnType<typeof createBaseState>;

    beforeEach(() => {
        state = createBaseState();
    });

    it('addRoom: should add a room', () => {
        const result = applyOperation(state, {
            op: 'addRoom',
            payload: { name: 'Phòng 1', capacity: 30, description: 'Phòng lớn' },
        });
        expect(result.rooms).toHaveLength(1);
        expect(result.rooms[0].name).toBe('Phòng 1');
    });

    it('deleteRoom: should remove room and clear roomId from class schedules', () => {
        state.rooms.push({ id: 'R1', name: 'Phòng 1', capacity: 30, description: '' } as any);
        state.classes.push(createClass({
            schedule: [{ dayOfWeek: 'Monday', startTime: '08:00', endTime: '10:00', roomId: 'R1' }],
        }) as any);

        const result = applyOperation(state, {
            op: 'deleteRoom',
            payload: { roomId: 'R1' },
        });
        expect(result.rooms).toHaveLength(0);
        expect(result.classes[0].schedule[0].roomId).toBeUndefined();
    });
});

// =====================================================
// ANNOUNCEMENTS
// =====================================================
describe('Announcement Operations', () => {
    let state: ReturnType<typeof createBaseState>;

    beforeEach(() => {
        state = createBaseState();
    });

    it('addAnnouncement: should add announcement', () => {
        const result = applyOperation(state, {
            op: 'addAnnouncement',
            payload: { title: 'Thông báo nghỉ', content: 'Nghỉ ngày 1/1', createdAt: '2024-01-01T10:00:00', createdBy: 'Admin' },
        });
        expect(result.announcements).toHaveLength(1);
        expect(result.announcements[0].title).toBe('Thông báo nghỉ');
    });

    it('deleteAnnouncement: should remove announcement', () => {
        state.announcements.push({ id: 'ANN1', title: 'Test', content: 'Test', createdAt: '2024-01-01', createdBy: 'Admin' } as any);
        const result = applyOperation(state, {
            op: 'deleteAnnouncement',
            payload: { id: 'ANN1' },
        });
        expect(result.announcements).toHaveLength(0);
    });
});

// =====================================================
// SETTINGS
// =====================================================
describe('Settings Operations', () => {
    let state: ReturnType<typeof createBaseState>;

    beforeEach(() => {
        state = createBaseState();
    });

    it('updateSettings: should update settings', () => {
        const result = applyOperation(state, {
            op: 'updateSettings',
            payload: { ...state.settings, name: 'Updated Center', themeColor: '#ff0000' },
        });
        expect(result.settings.name).toBe('Updated Center');
        expect(result.settings.themeColor).toBe('#ff0000');
    });
});

// =====================================================
// STAFF OPERATIONS
// =====================================================
describe('Staff Operations', () => {
    let state: ReturnType<typeof createBaseState>;

    beforeEach(() => {
        state = createBaseState();
    });

    it('addStaff: should add staff member', () => {
        const result = applyOperation(state, {
            op: 'addStaff',
            payload: { id: 'NV001', name: 'Lê Văn D', dob: '1985-03-10', phone: '0111222333', address: 'Test', position: 'Quản lý', status: PersonStatus.ACTIVE, role: UserRole.MANAGER },
        });
        expect(result.staff).toHaveLength(1);
    });

    it('addStaff: should throw on duplicate with teacher ID', () => {
        state.teachers.push(createTeacher({ id: 'NV001' }) as any);
        expect(() => applyOperation(state, {
            op: 'addStaff',
            payload: { id: 'NV001', name: 'Test', dob: '1985-03-10', phone: '0111', address: '', position: 'Test', status: PersonStatus.ACTIVE, role: UserRole.MANAGER },
        })).toThrow();
    });
});
