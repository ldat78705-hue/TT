package com.educenter.pro.ui.screens.attendance

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.educenter.pro.data.model.ClassModel
import com.educenter.pro.data.model.Student
import com.educenter.pro.data.model.AttendanceRecord
import com.educenter.pro.data.model.PersonStatus
import com.educenter.pro.data.repository.DataRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import javax.inject.Inject

data class AttendanceEntry(
    val status: String = "UNMARKED",
    val note: String = ""
)

@HiltViewModel
class AttendanceViewModel @Inject constructor(
    private val dataRepository: DataRepository
) : ViewModel() {

    val classes: StateFlow<List<ClassModel>> = dataRepository.appData
        .map { it?.classes ?: emptyList() }
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    private val allStudents: StateFlow<List<Student>> = dataRepository.appData
        .map { it?.students ?: emptyList() }
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    private val allAttendance: StateFlow<List<AttendanceRecord>> = dataRepository.appData
        .map { it?.attendance ?: emptyList() }
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    private val _selectedClassId = MutableStateFlow<String?>(null)
    val selectedClassId: StateFlow<String?> = _selectedClassId.asStateFlow()

    private val _selectedDate = MutableStateFlow(LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE))
    val selectedDate: StateFlow<String> = _selectedDate.asStateFlow()

    // Local attendance state map - mirrors Web's approach
    private val _attendanceMap = MutableStateFlow<Map<String, AttendanceEntry>>(emptyMap())
    val attendanceMap: StateFlow<Map<String, AttendanceEntry>> = _attendanceMap.asStateFlow()

    private val _isSaving = MutableStateFlow(false)
    val isSaving: StateFlow<Boolean> = _isSaving.asStateFlow()

    private val _saveSuccess = MutableStateFlow<Boolean?>(null)
    val saveSuccess: StateFlow<Boolean?> = _saveSuccess.asStateFlow()

    val scheduledClasses: StateFlow<List<ClassModel>> = combine(
        classes,
        _selectedDate
    ) { clsList, dateStr ->
        try {
            val date = LocalDate.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE)
            val dayOfWeek = date.dayOfWeek
            val dayName = when (dayOfWeek) {
                java.time.DayOfWeek.MONDAY -> "Monday"
                java.time.DayOfWeek.TUESDAY -> "Tuesday"
                java.time.DayOfWeek.WEDNESDAY -> "Wednesday"
                java.time.DayOfWeek.THURSDAY -> "Thursday"
                java.time.DayOfWeek.FRIDAY -> "Friday"
                java.time.DayOfWeek.SATURDAY -> "Saturday"
                java.time.DayOfWeek.SUNDAY -> "Sunday"
                else -> ""
            }
            clsList.filter { c ->
                c.schedule.any { it.dayOfWeek == dayName }
            }
        } catch (e: Exception) {
            emptyList()
        }
    }.stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    // Students in selected class (active + those with existing records)
    val studentsInClass: StateFlow<List<Student>> = combine(
        allStudents,
        allAttendance,
        classes,
        _selectedClassId,
        _selectedDate
    ) { students, attendance, clsList, classId, date ->
        if (classId == null) return@combine emptyList()
        val cls = clsList.find { it.id == classId } ?: return@combine emptyList()

        // Active enrolled students
        val activeEnrolled = students.filter {
            cls.studentIds.contains(it.id) && it.status == PersonStatus.ACTIVE
        }

        // Students with existing records for this date
        val recordedIds = attendance
            .filter { it.classId == classId && it.date == date }
            .map { it.studentId }
        val recordedStudents = students.filter { recordedIds.contains(it.id) }

        // Merge and deduplicate
        val merged = mutableMapOf<String, Student>()
        activeEnrolled.forEach { merged[it.id] = it }
        recordedStudents.forEach { merged[it.id] = it }

        // Sort by last name (Vietnamese style)
        merged.values.toList().sortedWith(compareBy {
            val parts = it.name.trim().split("\\s+".toRegex())
            parts.lastOrNull() ?: ""
        })
    }.stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    // Monthly attendance count per student
    val monthlyAttendanceCounts: StateFlow<Map<String, Int>> = combine(
        allAttendance,
        _selectedClassId,
        _selectedDate,
        studentsInClass
    ) { attendance, classId, date, students ->
        if (classId == null) return@combine emptyMap()
        val monthStr = date.substring(0, 7) // "YYYY-MM"
        val classRecords = attendance.filter { it.classId == classId }

        students.associate { student ->
            val count = classRecords.count { a ->
                a.studentId == student.id &&
                a.date.startsWith(monthStr) &&
                (a.status == "PRESENT" || a.status == "LATE")
            }
            student.id to count
        }
    }.stateIn(viewModelScope, SharingStarted.Lazily, emptyMap())

    // Initialize local attendance map when class/date/data changes
    init {
        viewModelScope.launch {
            combine(
                studentsInClass,
                allAttendance,
                _selectedClassId,
                _selectedDate
            ) { students, attendance, classId, date ->
                val map = mutableMapOf<String, AttendanceEntry>()
                students.forEach { student ->
                    val record = attendance.find {
                        it.classId == classId && it.studentId == student.id && it.date == date
                    }
                    map[student.id] = AttendanceEntry(
                        status = record?.status ?: "UNMARKED",
                        note = record?.note ?: ""
                    )
                }
                map.toMap()
            }.collect { map ->
                // Only update if not currently saving (avoid overwriting user changes mid-save)
                if (!_isSaving.value) {
                    _attendanceMap.value = map
                }
            }
        }
    }

    fun selectClass(classId: String) {
        _selectedClassId.value = if (classId.isEmpty()) null else classId
    }

    fun selectDate(date: String) {
        _selectedDate.value = date
    }

    // Update local state only - no API call
    fun setStudentStatus(studentId: String, status: String) {
        _attendanceMap.value = _attendanceMap.value.toMutableMap().apply {
            val current = this[studentId] ?: AttendanceEntry()
            this[studentId] = current.copy(status = status)
        }
    }

    // Bulk update local state - no API call
    fun setAllStatus(status: String) {
        _attendanceMap.value = _attendanceMap.value.mapValues { (_, entry) ->
            entry.copy(status = status)
        }
    }

    // Update note locally
    fun setStudentNote(studentId: String, note: String) {
        _attendanceMap.value = _attendanceMap.value.toMutableMap().apply {
            val current = this[studentId] ?: AttendanceEntry()
            this[studentId] = current.copy(note = note)
        }
    }

    // Save all attendance at once - single batch to API (like Web's handleSubmit)
    fun saveAttendance() {
        val classId = _selectedClassId.value ?: return
        val date = _selectedDate.value
        val entries = _attendanceMap.value

        viewModelScope.launch {
            _isSaving.value = true
            try {
                // Send each marked student to API
                for ((studentId, entry) in entries) {
                    if (entry.status != "UNMARKED") {
                        dataRepository.recordAttendance(classId, studentId, date, entry.status)
                    }
                }
                _saveSuccess.value = true
            } catch (e: Exception) {
                e.printStackTrace()
                _saveSuccess.value = false
            } finally {
                _isSaving.value = false
            }
        }
    }

    fun clearSaveResult() {
        _saveSuccess.value = null
    }

    // Check if any students are unmarked
    fun hasUnmarkedStudents(): Boolean {
        return _attendanceMap.value.any { it.value.status == "UNMARKED" }
    }

    // Get unexcused absent student names
    fun getUnexcusedAbsentNames(): List<String> {
        val students = studentsInClass.value
        return _attendanceMap.value
            .filter { it.value.status == "UNEXCUSED_ABSENT" }
            .mapNotNull { (id, _) -> students.find { it.id == id }?.name }
    }
}
