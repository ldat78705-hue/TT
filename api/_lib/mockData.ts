import type { AppData, CenterSettings, Student, Teacher, Staff, Class, AttendanceRecord, Invoice, ProgressReport, Income, Expense, Transaction, Payroll, Announcement, AuditLog, Room } from '../../types.js';

const MOCK_STUDENTS: Student[] = [];
const MOCK_TEACHERS: Teacher[] = [];
const MOCK_STAFF: Staff[] = [];
const MOCK_CLASSES: Class[] = [];
const MOCK_ATTENDANCE: AttendanceRecord[] = [];
const MOCK_INVOICES: Invoice[] = [];
const MOCK_PROGRESS_REPORTS: ProgressReport[] = [];
const MOCK_TRANSACTIONS: Transaction[] = [];
const MOCK_INCOME: Income[] = [];
const MOCK_EXPENSES: Expense[] = [];
const MOCK_PAYROLLS: Payroll[] = [];
const MOCK_ANNOUNCEMENTS: Announcement[] = [];

export const MOCK_SETTINGS: CenterSettings = {
    name: "EduCenter Pro",
    address: "Địa chỉ của bạn",
    phone: "Số điện thoại của bạn",
    logoUrl: "",
    themeColor: "#4f46e5",
    sidebarColor: "#111827",
    theme: "light",
    onboardingStepsCompleted: [],
    bankName: "",
    bankAccountNumber: "",
    bankAccountHolder: "",
    bankBin: "",
    qrCodeUrl: "",
    adminPassword: "123456",
    viewerAccountActive: true,
    loginHeaderContent: "<p class=\"text-lg leading-7 text-indigo-200\">Hệ thống quản lý dạy thêm, trung tâm thông minh.<br/>Toàn diện, hiệu quả và dễ sử dụng.</p>",
    taxId: "001092019830",
    taxSignatureUrl: ""
};

export function getMockDataState(): Omit<AppData, 'loading'> {
    return {
        students: MOCK_STUDENTS,
        teachers: MOCK_TEACHERS,
        staff: MOCK_STAFF,
        classes: MOCK_CLASSES,
        attendance: MOCK_ATTENDANCE,
        invoices: MOCK_INVOICES,
        progressReports: MOCK_PROGRESS_REPORTS,
        transactions: MOCK_TRANSACTIONS,
        income: MOCK_INCOME,
        expenses: MOCK_EXPENSES,
        payrolls: MOCK_PAYROLLS,
        announcements: MOCK_ANNOUNCEMENTS,
        settings: MOCK_SETTINGS,
        auditLogs: [],
        rooms: [],
    };
}
