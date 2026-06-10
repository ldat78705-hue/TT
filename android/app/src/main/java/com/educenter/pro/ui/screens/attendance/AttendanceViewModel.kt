package com.educenter.pro.ui.screens.attendance

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.educenter.pro.data.model.ClassModel
import com.educenter.pro.data.model.Student
import com.educenter.pro.data.model.AttendanceRecord
import com.educenter.pro.data.repository.DataRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import javax.inject.Inject

@HiltViewModel
class AttendanceViewModel @Inject constructor(
    private val dataRepository: DataRepository
) : ViewModel() {

    val classes: StateFlow<List<ClassModel>> = dataRepository.appData
        .map { it?.classes ?: emptyList() }
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    private val _selectedClassId = MutableStateFlow<String?>(null)
    val selectedClassId: StateFlow<String?> = _selectedClassId.asStateFlow()

    private val _selectedDate = MutableStateFlow(LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE))
    val selectedDate: StateFlow<String> = _selectedDate.asStateFlow()

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

    val studentsInClass: StateFlow<List<Student>> = combine(
        dataRepository.appData,
        _selectedClassId
    ) { appData, classId ->
        if (appData == null || classId == null) return@combine emptyList()
        val classModel = appData.classes.find { it.id == classId } ?: return@combine emptyList()
        appData.students.filter { classModel.studentIds.contains(it.id) }
    }.stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    val attendanceForClass: StateFlow<List<AttendanceRecord>> = combine(
        dataRepository.appData,
        _selectedClassId,
        _selectedDate
    ) { appData, classId, date ->
        if (appData == null || classId == null) return@combine emptyList()
        appData.attendance.filter { it.classId == classId && it.date == date }
    }.stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    fun selectClass(classId: String) {
        _selectedClassId.value = classId
    }

    fun selectDate(date: String) {
        _selectedDate.value = date
    }

    fun markAttendance(studentId: String, status: String) {
        val classId = _selectedClassId.value ?: return
        val date = _selectedDate.value
        viewModelScope.launch {
            dataRepository.recordAttendance(classId, studentId, date, status)
        }
    }

    fun markAllAttendance(status: String) {
        val classId = _selectedClassId.value ?: return
        val date = _selectedDate.value
        val students = studentsInClass.value
        viewModelScope.launch {
            students.forEach { student ->
                dataRepository.recordAttendance(classId, student.id, date, status)
            }
        }
    }
}
