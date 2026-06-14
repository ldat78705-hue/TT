package com.educenter.pro.data.model

import com.google.gson.annotations.SerializedName

enum class PersonStatus { ACTIVE, INACTIVE }

data class Settings(
    val name: String = "",
    val address: String = "",
    val phone: String = "",
    val logoUrl: String = "",
    val taxId: String = "",
    val adminPassword: String = "",
    val viewerAccountActive: Boolean = true,
    val bankName: String = "",
    val bankAccountNumber: String = "",
    val bankAccountHolder: String = "",
    val zaloTuitionTemplate: String = ""
)

data class Student(
    val id: String = "",
    val name: String = "",
    val phone: String = "",
    val parentName: String = "",
    val email: String = "",
    val address: String = "",
    val gender: String = "Khác",
    val status: PersonStatus = PersonStatus.ACTIVE,
    val balance: Double = 0.0,
    val discountPercentage: Double = 0.0,
    val dob: String = "",
    val password: String? = null,
    // Fields preserved from server - not editable in App UI but must be kept
    val createdAt: String = "",
    val statusChangedAt: String? = null,
    val statusHistory: List<Map<String, String>>? = null,
    val billedCourses: List<String>? = null
)

data class Teacher(
    val id: String = "",
    val name: String = "",
    val phone: String = "",
    val subject: String = "",
    val password: String = "",
    val role: UserRole = UserRole.TEACHER,
    // Additional fields matching Web schema
    val dob: String = "",
    val qualification: String = "",
    val email: String = "",
    val address: String = "",
    val gender: String = "Khác",
    val status: PersonStatus = PersonStatus.ACTIVE,
    val salaryType: String = "PER_SESSION",
    val rate: Double = 0.0,
    val createdAt: String = "",
    val statusChangedAt: String? = null,
    val statusHistory: List<Map<String, String>>? = null
)

data class ClassSchedule(
    val dayOfWeek: String = "",
    val startTime: String = "",
    val endTime: String = ""
)

data class ClassFee(
    val type: String = "PER_SESSION",
    val amount: Double = 0.0
)

data class ClassModel(
    val id: String = "",
    val name: String = "",
    val teacherIds: List<String> = emptyList(),
    val studentIds: List<String> = emptyList(),
    val schedule: List<ClassSchedule> = emptyList(),
    val subject: String = "",
    val fee: ClassFee = ClassFee()
)

data class Transaction(
    val id: String = "",
    val studentId: String? = null,
    val classId: String? = null,
    val amount: Double = 0.0,
    val date: String = "",
    val description: String = "",
    val type: String = "",
    val paymentMethod: String? = null
)

data class AttendanceRecord(
    val id: String = "",
    val classId: String = "",
    val studentId: String = "",
    val date: String = "",
    val status: String = "",
    val note: String = ""
)

data class Announcement(
    val id: String = "",
    val title: String = "",
    val content: String = "",
    val createdAt: String = "",
    val createdBy: String = "",
    val targetAudience: String = "ALL",
    val classId: String? = null,
    val targetStudentIds: List<String>? = null,
    val scheduledFor: String? = null
)

enum class UserRole {
    ADMIN, TEACHER, MANAGER, ACCOUNTANT, PARENT, VIEWER
}

data class Staff(
    val id: String = "",
    val name: String = "",
    val email: String = "",
    val role: UserRole = UserRole.VIEWER,
    val password: String = ""
)

// === Models synced from Web ===

data class Invoice(
    val id: String = "",
    val studentId: String = "",
    val studentName: String = "",
    val month: String = "",
    val amount: Double = 0.0,
    val details: String = "",
    val status: String = "UNPAID", // PAID, UNPAID, CANCELLED
    val generatedDate: String = "",
    val paidDate: String? = null
)

data class ProgressReport(
    val id: String = "",
    val classId: String = "",
    val studentId: String = "",
    val date: String = "",
    val score: Double? = null,
    val comments: String = "",
    val createdBy: String = ""
)

data class Income(
    val id: String = "",
    val description: String = "",
    val amount: Double = 0.0,
    val category: String = "OTHER", // SALE, EVENT, OTHER
    val date: String = "",
    val paymentMethod: String? = null
)

data class Expense(
    val id: String = "",
    val description: String = "",
    val amount: Double = 0.0,
    val category: String = "OTHER", // SALARY, RENT, UTILITIES, MARKETING, SUPPLIES, OTHER
    val date: String = ""
)

data class PayrollClassDetail(
    val classId: String = "",
    val className: String = "",
    val sessionsTaught: Int = 0
)

data class Payroll(
    val id: String = "",
    val teacherId: String = "",
    val teacherName: String = "",
    val month: String = "",
    val sessionsTaught: Int = 0,
    val rate: Double = 0.0,
    val baseSalary: Double = 0.0,
    val bonus: Double = 0.0,
    val deduction: Double = 0.0,
    val totalSalary: Double = 0.0,
    val status: String = "UNPAID", // PAID, UNPAID
    val paidDate: String? = null,
    val calculationDate: String = "",
    val classDetails: List<PayrollClassDetail> = emptyList()
)

data class AuditLog(
    val id: String = "",
    val userId: String = "",
    val userName: String = "",
    val action: String = "",
    val targetType: String = "",
    val targetName: String = "",
    val details: String = "",
    val timestamp: String = ""
)

data class Room(
    val id: String = "",
    val name: String = "",
    val capacity: Int = 0,
    val description: String = ""
)

data class AppData(
    val settings: Settings? = null,
    val students: List<Student> = emptyList(),
    val teachers: List<Teacher> = emptyList(),
    val staff: List<Staff> = emptyList(),
    val classes: List<ClassModel> = emptyList(),
    val transactions: List<Transaction> = emptyList(),
    val attendance: List<AttendanceRecord> = emptyList(),
    val announcements: List<Announcement> = emptyList(),
    val invoices: List<Invoice> = emptyList(),
    val progressReports: List<ProgressReport> = emptyList(),
    val income: List<Income> = emptyList(),
    val expenses: List<Expense> = emptyList(),
    val payrolls: List<Payroll> = emptyList(),
    val auditLogs: List<AuditLog> = emptyList(),
    val rooms: List<Room> = emptyList()
)

