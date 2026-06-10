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
    val viewerAccountActive: Boolean = true
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
    val createdBy: String = ""
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

data class AppData(
    val settings: Settings? = null,
    val students: List<Student> = emptyList(),
    val teachers: List<Teacher> = emptyList(),
    val staff: List<Staff> = emptyList(),
    val classes: List<ClassModel> = emptyList(),
    val transactions: List<Transaction> = emptyList(),
    val attendance: List<AttendanceRecord> = emptyList(),
    val announcements: List<Announcement> = emptyList()
)
