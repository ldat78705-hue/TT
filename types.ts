
export enum UserRole {
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER',
  MANAGER = 'MANAGER',
  ACCOUNTANT = 'ACCOUNTANT',
  PARENT = 'PARENT',
  VIEWER = 'VIEWER',
}

export enum PersonStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  UNEXCUSED_ABSENT = 'UNEXCUSED_ABSENT',
  EXCUSED_ABSENT = 'EXCUSED_ABSENT',
  LATE = 'LATE',
  UNMARKED = 'UNMARKED',
}

export enum FeeType {
  PER_SESSION = 'PER_SESSION',
  MONTHLY = 'MONTHLY',
  PER_COURSE = 'PER_COURSE',
}

export enum SalaryType {
  PER_SESSION = 'PER_SESSION',
  MONTHLY = 'MONTHLY',
}

interface BasePerson {
  id: string;
  name: string;
  email?: string;
  phone: string;
  address: string;
  status: PersonStatus;
  statusChangedAt?: string;
  statusHistory?: { status: PersonStatus; changedAt: string }[];
  createdAt: string;
  password?: string;
  gender?: 'Nam' | 'Nữ' | 'Khác';
}

export interface Student extends BasePerson {
  dob: string;
  parentName: string;
  parentPhone?: string; // SĐT Zalo phụ huynh để nhận thông báo
  zaloUserId?: string; // Zalo user_id liên kết trực tiếp từ danh sách followers OA
  email: string;
  balance: number; // Student's account balance. Positive = credit, Negative = debt.
  discountPercentage?: number; // Discount percentage (0-100)
  billedCourses?: string[]; // Array of classIds that have been billed as PER_COURSE
  internalNotes?: { id: string; text: string; createdAt: string; createdBy: string }[]; // Staff-only notes
}

export interface Teacher extends BasePerson {
  dob: string;
  qualification: string;
  subject: string;
  role: UserRole.TEACHER;
  salaryType: SalaryType;
  rate: number; // Amount per hour or fixed monthly salary
}

export interface Staff extends BasePerson {
  dob: string;
  position: string;
  role: UserRole.MANAGER | UserRole.ACCOUNTANT;
}

interface ClassFee {
  type: FeeType;
  amount: number;
}

export interface ClassSchedule {
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  roomId?: string; // Optional room assignment
}

export enum ClassStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ENDED = 'ENDED',
}

export interface Class {
  id: string;
  name: string;
  teacherIds: string[];
  subject: string;
  schedule: ClassSchedule[];
  studentIds: string[];
  fee: ClassFee;
  classStatus?: ClassStatus;
  startDate?: string; // "YYYY-MM-DD"
  endDate?: string;   // "YYYY-MM-DD"
  capacity?: number;  // Max students allowed
}

export interface AttendanceRecord {
  id: string;
  classId: string;
  studentId: string;
  date: string; // "YYYY-MM-DD"
  status: AttendanceStatus;
  note?: string;
  teacherIds?: string[]; // IDs of teachers who taught this session
}

export interface Invoice {
  id: string;
  studentId: string;
  studentName: string;
  month: string; // e.g., "2024-07"
  amount: number;
  details: string;
  status: 'PAID' | 'UNPAID' | 'CANCELLED';
  generatedDate: string; // "YYYY-MM-DD"
  paidDate: string | null; // "YYYY-MM-DD"
}

export enum TransactionType {
    INVOICE = 'INVOICE', // A generated bill (debit)
    PAYMENT = 'PAYMENT', // A payment received (credit)
    ADJUSTMENT_CREDIT = 'ADJUSTMENT_CREDIT', // Manual credit (e.g., refund, bonus)
    ADJUSTMENT_DEBIT = 'ADJUSTMENT_DEBIT', // Manual debit (e.g., fee, penalty)
}

export interface Transaction {
    id: string;
    studentId: string;
    date: string; // "YYYY-MM-DD"
    type: TransactionType;
    description: string;
    amount: number; // Positive for credits/payments, negative for debits/invoices
    relatedInvoiceId?: string;
    paymentMethod?: 'transfer' | 'cash';
}


export interface ProgressReport {
  id: string;
  classId: string;
  studentId: string;
  date: string; // "YYYY-MM-DD"
  score: number | null; // e.g., out of 10
  comments: string;
  createdBy: string; // Teacher's ID
}

export enum IncomeCategory {
  SALE = 'SALE', // Bán tài liệu, đồng phục
  EVENT = 'EVENT', // Phí sự kiện, dã ngoại
  OTHER = 'OTHER', // Thu khác
}

export interface Income {
  id: string;
  description: string;
  amount: number;
  category: IncomeCategory;
  date: string; // "YYYY-MM-DD"
  paymentMethod?: 'transfer' | 'cash';
}

export enum ExpenseCategory {
  SALARY = 'SALARY', // Lương
  RENT = 'RENT', // Thuê mặt bằng
  UTILITIES = 'UTILITIES', // Điện, nước, internet
  MARKETING = 'MARKETING', // Tiếp thị
  SUPPLIES = 'SUPPLIES', // Văn phòng phẩm, thiết bị
  OTHER = 'OTHER', // Chi khác
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: string; // "YYYY-MM-DD"
}

export interface CenterSettings {
  name: string;
  address?: string;
  phone?: string;
  logoUrl: string;
  themeColor: string;
  sidebarColor?: string;
  theme: 'light' | 'dark';
  onboardingStepsCompleted: string[];
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  bankBin?: string;
  qrCodeUrl?: string;
  adminPassword?: string;
  adminDisplayName?: string;
  viewerAccountActive?: boolean;
  loginHeaderContent?: string;
  taxId?: string;
  taxSignatureUrl?: string;
  // Zalo OA Integration
  zaloOaEnabled?: boolean;
  zaloAppId?: string;
  zaloSecretKey?: string;
  zaloRefreshToken?: string;
  zaloAccessToken?: string;
  zaloTokenExpiresAt?: number;
  zaloAbsenceTemplate?: string; // Mẫu tin nhắn vắng mặt (legacy)
  zaloTuitionTemplate?: string; // Mẫu tin nhắn học phí (legacy)
  // Message Templates (unified)
  messageTemplates?: {
    absenceNotification?: string;    // Thông báo vắng mặt gửi PHHS
    tuitionReminder?: string;        // Nhắc nhở công nợ/học phí
    attendanceReport?: string;       // Báo cáo điểm danh ngày
    leaveRequestConfirm?: string;    // Xác nhận nghỉ phép
    welcomeStudent?: string;         // Chào mừng HS mới
    paymentConfirm?: string;         // Xác nhận thanh toán
  };
  // Auto Payment / Webhook Settings
  webhookEnabled?: boolean;
  webhookStudentIdPrefix?: string; // Prefix mã HV trong nội dung CK (default: 'HS')
  webhookStudentIdPattern?: string; // Custom regex pattern
  webhookBankKeyword?: string; // Keyword nhận diện nguồn (default: 'MBBank')
  webhookAutoDescription?: string; // Template mô tả GD (default: 'Thanh toán HP tự động')
  webhookSecretKey?: string; // Secret key for webhook authentication
}

export interface PayrollClassDetail {
    classId: string;
    className: string;
    sessionsTaught: number;
}

export interface Payroll {
  id: string;
  teacherId: string;
  teacherName: string;
  month: string; // "YYYY-MM"
  sessionsTaught: number;
  rate: number;
  baseSalary: number;
  bonus: number;
  deduction: number;
  totalSalary: number;
  status: 'PAID' | 'UNPAID';
  paidDate?: string;
  calculationDate: string; // "YYYY-MM-DD"
  classDetails: PayrollClassDetail[];
}

export type AnnouncementTarget = 'ALL' | 'TEACHERS' | 'STUDENTS' | 'CLASS' | 'SPECIFIC_STUDENTS';

export interface Announcement {
    id: string;
    title: string;
    content: string;
    createdAt: string; // "YYYY-MM-DDTHH:mm:ss" or similar
    createdBy: string; // User's name
    targetAudience?: AnnouncementTarget;
    classId?: string; // Used if targetAudience is 'CLASS' or 'SPECIFIC_STUDENTS'
    targetStudentIds?: string[]; // Used if targetAudience is 'SPECIFIC_STUDENTS'
    scheduledFor?: string; // "YYYY-MM-DDTHH:mm"
}

export interface SearchResult {
  id: string;
  name: string;
  type: 'student' | 'teacher' | 'class';
  path: string;
  context?: string; // e.g., "Vật lý" or "Phụ huynh: Trần Văn Bốn"
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;       // operation name e.g. "addClass", "updateStudent"
  targetType: string;   // "student" | "class" | "attendance" | "finance" | ...
  targetName: string;   // Name of the affected object
  details: string;      // Human-readable description
  timestamp: string;    // ISO datetime
}

export interface Room {
  id: string;
  name: string;         // "Phòng 1", "Phòng A2"
  capacity: number;
  description: string;
}

export interface AppData {
  students: Student[];
  teachers: Teacher[];
  staff: Staff[];
  classes: Class[];
  attendance: AttendanceRecord[];
  invoices: Invoice[];
  progressReports: ProgressReport[];
  transactions: Transaction[];
  income: Income[];
  expenses: Expense[];
  settings: CenterSettings;
  payrolls: Payroll[];
  announcements: Announcement[];
  auditLogs: AuditLog[];
  rooms: Room[];
}
