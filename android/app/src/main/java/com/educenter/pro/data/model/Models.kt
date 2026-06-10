package com.educenter.pro.data.model

import com.google.gson.annotations.SerializedName

enum class PersonStatus { ACTIVE, INACTIVE }

data class Settings(
    @SerializedName("name") private val _name: String? = "",
    @SerializedName("address") private val _address: String? = "",
    @SerializedName("phone") private val _phone: String? = "",
    @SerializedName("logoUrl") private val _logoUrl: String? = "",
    @SerializedName("taxId") private val _taxId: String? = "",
    @SerializedName("adminPassword") private val _adminPassword: String? = "",
    @SerializedName("viewerAccountActive") private val _viewerAccountActive: Boolean? = true
) {
    val name: String get() = _name ?: ""
    val address: String get() = _address ?: ""
    val phone: String get() = _phone ?: ""
    val logoUrl: String get() = _logoUrl ?: ""
    val taxId: String get() = _taxId ?: ""
    val adminPassword: String get() = _adminPassword ?: ""
    val viewerAccountActive: Boolean get() = _viewerAccountActive ?: true
}

data class Student(
    val id: String,
    @SerializedName("name") private val _name: String? = "",
    @SerializedName("phone") private val _phone: String? = "",
    @SerializedName("parentName") private val _parentName: String? = "",
    @SerializedName("status") private val _status: PersonStatus? = PersonStatus.ACTIVE,
    @SerializedName("balance") private val _balance: Double? = 0.0,
    @SerializedName("dob") private val _dob: String? = "",
    val password: String? = null
) {
    val name: String get() = _name ?: ""
    val phone: String get() = _phone ?: ""
    val parentName: String get() = _parentName ?: ""
    val status: PersonStatus get() = _status ?: PersonStatus.ACTIVE
    val balance: Double get() = _balance ?: 0.0
    val dob: String get() = _dob ?: ""
}

data class Teacher(
    val id: String,
    @SerializedName("name") private val _name: String? = "",
    @SerializedName("phone") private val _phone: String? = "",
    @SerializedName("subject") private val _subject: String? = "",
    @SerializedName("password") private val _password: String? = "",
    @SerializedName("role") private val _role: UserRole? = UserRole.TEACHER
) {
    val name: String get() = _name ?: ""
    val phone: String get() = _phone ?: ""
    val subject: String get() = _subject ?: ""
    val password: String get() = _password ?: ""
    val role: UserRole get() = _role ?: UserRole.TEACHER
}

data class ClassSchedule(
    @SerializedName("dayOfWeek") private val _dayOfWeek: String? = "",
    @SerializedName("startTime") private val _startTime: String? = "",
    @SerializedName("endTime") private val _endTime: String? = ""
) {
    val dayOfWeek: String get() = _dayOfWeek ?: ""
    val startTime: String get() = _startTime ?: ""
    val endTime: String get() = _endTime ?: ""
}

data class ClassModel(
    val id: String,
    @SerializedName("name") private val _name: String? = "",
    @SerializedName("teacherIds") private val _teacherIds: List<String>? = null,
    @SerializedName("studentIds") private val _studentIds: List<String>? = null,
    @SerializedName("schedule") private val _schedule: List<ClassSchedule>? = null,
    @SerializedName("subject") private val _subject: String? = ""
) {
    val name: String get() = _name ?: ""
    val teacherIds: List<String> get() = _teacherIds ?: emptyList()
    val studentIds: List<String> get() = _studentIds ?: emptyList()
    val schedule: List<ClassSchedule> get() = _schedule ?: emptyList()
    val subject: String get() = _subject ?: ""
}

data class Transaction(
    val id: String,
    @SerializedName("amount") private val _amount: Double? = 0.0,
    @SerializedName("date") private val _date: String? = "",
    @SerializedName("description") private val _description: String? = "",
    @SerializedName("type") private val _type: String? = ""
) {
    val amount: Double get() = _amount ?: 0.0
    val date: String get() = _date ?: ""
    val description: String get() = _description ?: ""
    val type: String get() = _type ?: ""
}

data class AttendanceRecord(
    val id: String,
    @SerializedName("classId") private val _classId: String? = "",
    @SerializedName("studentId") private val _studentId: String? = "",
    @SerializedName("date") private val _date: String? = "",
    @SerializedName("status") private val _status: String? = ""
) {
    val classId: String get() = _classId ?: ""
    val studentId: String get() = _studentId ?: ""
    val date: String get() = _date ?: ""
    val status: String get() = _status ?: ""
}

data class Announcement(
    val id: String,
    @SerializedName("title") private val _title: String? = "",
    @SerializedName("content") private val _content: String? = "",
    @SerializedName("createdAt") private val _createdAt: String? = "",
    @SerializedName("createdBy") private val _createdBy: String? = ""
) {
    val title: String get() = _title ?: ""
    val content: String get() = _content ?: ""
    val createdAt: String get() = _createdAt ?: ""
    val createdBy: String get() = _createdBy ?: ""
}

enum class UserRole {
    ADMIN, TEACHER, MANAGER, ACCOUNTANT, PARENT, VIEWER
}

data class Staff(
    val id: String,
    @SerializedName("name") private val _name: String? = "",
    @SerializedName("email") private val _email: String? = "",
    @SerializedName("role") private val _role: UserRole? = UserRole.VIEWER,
    @SerializedName("password") private val _password: String? = ""
) {
    val name: String get() = _name ?: ""
    val email: String get() = _email ?: ""
    val role: UserRole get() = _role ?: UserRole.VIEWER
    val password: String get() = _password ?: ""
}

data class AppData(
    val settings: Settings? = null,
    @SerializedName("students") private val _students: List<Student>? = null,
    @SerializedName("teachers") private val _teachers: List<Teacher>? = null,
    @SerializedName("staff") private val _staff: List<Staff>? = null,
    @SerializedName("classes") private val _classes: List<ClassModel>? = null,
    @SerializedName("transactions") private val _transactions: List<Transaction>? = null,
    @SerializedName("attendance") private val _attendance: List<AttendanceRecord>? = null,
    @SerializedName("announcements") private val _announcements: List<Announcement>? = null
) {
    val students: List<Student> get() = _students ?: emptyList()
    val teachers: List<Teacher> get() = _teachers ?: emptyList()
    val staff: List<Staff> get() = _staff ?: emptyList()
    val classes: List<ClassModel> get() = _classes ?: emptyList()
    val transactions: List<Transaction> get() = _transactions ?: emptyList()
    val attendance: List<AttendanceRecord> get() = _attendance ?: emptyList()
    val announcements: List<Announcement> get() = _announcements ?: emptyList()
}
