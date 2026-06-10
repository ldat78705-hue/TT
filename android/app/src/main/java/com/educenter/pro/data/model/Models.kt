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
    val password: String? = null
)

data class Teacher(
    val id: String = "",
    val name: String = "",
    val phone: String = "",
    val subject: String = "",
    val password: String = "",
    val role: UserRole = UserRole.TEACHER
)

data class ClassSchedule(
    val dayOfWeek: String = "",
    val startTime: String = "",
    val endTime: String = ""
)

data class ClassModel(
    val id: String = "",
    val name: String = "",
    val teacherIds: List<String> = emptyList(),
    val studentIds: List<String> = emptyList(),
    val schedule: List<ClassSchedule> = emptyList(),
    val subject: String = ""
)

data class Transaction(
    val id: String = "",
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
    val status: String = ""
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
