package com.educenter.pro.ui.screens.qrscanner

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.educenter.pro.data.model.AttendanceRecord
import com.educenter.pro.data.model.ClassModel
import com.educenter.pro.data.model.PersonStatus
import com.educenter.pro.data.repository.DataRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject

data class ScanLogEntry(
    val id: String,
    val name: String,
    val time: String,
    val status: String // "success", "duplicate", "error"
)

data class QRScannerUiState(
    val availableClasses: List<ClassModel> = emptyList(),
    val scheduledClassIds: Set<String> = emptySet(),
    val classStudentCounts: Map<String, Int> = emptyMap(),
    val selectedClassId: String = "",
    val selectedClassName: String = "",
    val totalStudents: Int = 0,
    val scannedStudents: Map<String, String> = emptyMap(), // id -> name
    val absentStudents: List<String> = emptyList(),
    val scanLog: List<ScanLogEntry> = emptyList(),
    val lastScannedName: String? = null,
    val isFinished: Boolean = false
)

@HiltViewModel
class QRScannerViewModel @Inject constructor(
    private val repository: DataRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(QRScannerUiState())
    val uiState: StateFlow<QRScannerUiState> = _uiState.asStateFlow()

    private val todayDate: String = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())

    init {
        loadClasses()
    }

    private fun loadClasses() {
        viewModelScope.launch {
            repository.syncData()
            val data = repository.appData.value ?: return@launch
            val students = data.students.filter { it.status == PersonStatus.ACTIVE }

            // Get today's day name
            val dayName = try {
                val today = java.time.LocalDate.now()
                when (today.dayOfWeek) {
                    java.time.DayOfWeek.MONDAY -> "Monday"
                    java.time.DayOfWeek.TUESDAY -> "Tuesday"
                    java.time.DayOfWeek.WEDNESDAY -> "Wednesday"
                    java.time.DayOfWeek.THURSDAY -> "Thursday"
                    java.time.DayOfWeek.FRIDAY -> "Friday"
                    java.time.DayOfWeek.SATURDAY -> "Saturday"
                    java.time.DayOfWeek.SUNDAY -> "Sunday"
                    else -> ""
                }
            } catch (e: Exception) { "" }

            val todayClasses = data.classes.filter { cls ->
                cls.schedule.any { it.dayOfWeek == dayName }
            }

            // Show today's scheduled classes first, then all other classes
            val allClasses = data.classes
            val orderedClasses = todayClasses + allClasses.filter { all -> todayClasses.none { it.id == all.id } }

            val counts = orderedClasses.associate { cls ->
                cls.id to students.count { s -> cls.studentIds.contains(s.id) }
            }

            _uiState.value = _uiState.value.copy(
                availableClasses = orderedClasses,
                classStudentCounts = counts,
                scheduledClassIds = todayClasses.map { it.id }.toSet()
            )
        }
    }

    fun selectClass(classId: String) {
        val data = repository.appData.value ?: return
        val cls = data.classes.find { it.id == classId } ?: return
        val activeStudents = data.students.filter { it.status == PersonStatus.ACTIVE && cls.studentIds.contains(it.id) }

        _uiState.value = _uiState.value.copy(
            selectedClassId = classId,
            selectedClassName = cls.name,
            totalStudents = activeStudents.size,
            scannedStudents = emptyMap(),
            scanLog = emptyList(),
            lastScannedName = null,
            isFinished = false
        )
    }

    fun processQR(studentId: String) {
        val data = repository.appData.value ?: return
        val state = _uiState.value
        val timeStr = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())

        // Already scanned
        if (state.scannedStudents.containsKey(studentId)) {
            val name = state.scannedStudents[studentId] ?: studentId
            _uiState.value = state.copy(
                scanLog = listOf(ScanLogEntry(studentId, "$name (đã quét)", timeStr, "duplicate")) + state.scanLog.take(49)
            )
            return
        }

        // Find student
        val student = data.students.find { it.id == studentId }
        if (student == null) {
            _uiState.value = state.copy(
                scanLog = listOf(ScanLogEntry(studentId, "Mã không hợp lệ: $studentId", timeStr, "error")) + state.scanLog.take(49)
            )
            return
        }

        // Check if student belongs to selected class
        val cls = data.classes.find { it.id == state.selectedClassId }
        if (cls == null || !cls.studentIds.contains(studentId)) {
            _uiState.value = state.copy(
                scanLog = listOf(ScanLogEntry(studentId, "${student.name} (không thuộc lớp)", timeStr, "error")) + state.scanLog.take(49)
            )
            return
        }

        // Success! Record attendance (use single-record API to avoid overwriting other scanned students)
        viewModelScope.launch {
            try {
                repository.recordAttendance(state.selectedClassId, studentId, todayDate, "PRESENT", "QR")
            } catch (e: Exception) {
                // Network error - will need to retry
            }
        }

        val newScanned = state.scannedStudents + (studentId to student.name)
        _uiState.value = state.copy(
            scannedStudents = newScanned,
            lastScannedName = student.name,
            scanLog = listOf(ScanLogEntry(studentId, student.name, timeStr, "success")) + state.scanLog.take(49)
        )

        // Clear lastScannedName after 2 seconds
        viewModelScope.launch {
            kotlinx.coroutines.delay(2000)
            if (_uiState.value.lastScannedName == student.name) {
                _uiState.value = _uiState.value.copy(lastScannedName = null)
            }
        }
    }

    fun finish() {
        val data = repository.appData.value ?: return
        val state = _uiState.value
        val cls = data.classes.find { it.id == state.selectedClassId }
        val activeStudents = data.students.filter { it.status == PersonStatus.ACTIVE && cls?.studentIds?.contains(it.id) == true }
        val absent = activeStudents.filter { !state.scannedStudents.containsKey(it.id) }.map { it.name }

        _uiState.value = state.copy(
            isFinished = true,
            absentStudents = absent
        )
    }

    fun resetSelection() {
        _uiState.value = _uiState.value.copy(
            selectedClassId = "",
            selectedClassName = "",
            scannedStudents = emptyMap(),
            scanLog = emptyList(),
            lastScannedName = null,
            isFinished = false,
            absentStudents = emptyList()
        )
    }
}
