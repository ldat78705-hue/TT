package com.educenter.pro.ui.screens.parent

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.educenter.pro.data.model.*
import com.educenter.pro.data.repository.DataRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import javax.inject.Inject

data class ParentUiState(
    val student: Student? = null,
    val centerName: String = "",
    val myClasses: List<ClassModel> = emptyList(),
    val myTodayClasses: List<ClassModel> = emptyList(),
    val attendanceRate: Double = 0.0,
    val presentCount: Int = 0,
    val absentCount: Int = 0,
    val lateCount: Int = 0,
    val totalAttendance: Int = 0,
    val recentTransactions: List<Transaction> = emptyList(),
    val recentReports: List<ProgressReport> = emptyList(),
    val announcements: List<Announcement> = emptyList(),
    val allAttendance: List<AttendanceRecord> = emptyList(),
    val allClasses: List<ClassModel> = emptyList(),
    val allTeachers: List<Teacher> = emptyList(),
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false
)

@HiltViewModel
class ParentDashboardViewModel @Inject constructor(
    private val dataRepository: DataRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ParentUiState())
    val uiState: StateFlow<ParentUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isRefreshing = true)
            try { dataRepository.syncData() } catch (_: Exception) {}
            _uiState.value = _uiState.value.copy(isRefreshing = false)
        }
    }

    private fun loadData() {
        viewModelScope.launch {
            dataRepository.appData.collect { appData ->
                if (appData != null) {
                    val studentId = dataRepository.getLoggedInUserId()
                    val student = appData.students.find { it.id == studentId }

                    if (student == null) {
                        _uiState.value = ParentUiState(isLoading = false)
                        return@collect
                    }

                    val centerName = appData.settings?.name ?: ""

                    // Classes this student is enrolled in
                    val myClasses = appData.classes.filter { it.studentIds.contains(studentId) }

                    // Today's classes
                    val todayDayOfWeek = SimpleDateFormat("EEEE", Locale.ENGLISH).format(Date())
                    val myTodayClasses = myClasses.filter { cls ->
                        cls.schedule.any { it.dayOfWeek.equals(todayDayOfWeek, ignoreCase = true) }
                    }

                    // Attendance stats (30 days)
                    val cal = Calendar.getInstance()
                    cal.add(Calendar.DAY_OF_MONTH, -30)
                    val thirtyDaysAgo = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(cal.time)

                    val myAttendance = appData.attendance.filter {
                        it.studentId == studentId && it.date >= thirtyDaysAgo
                    }
                    val presentCount = myAttendance.count { it.status == "PRESENT" || it.status == "LATE" }
                    val absentCount = myAttendance.count { it.status == "ABSENT" || it.status == "UNEXCUSED_ABSENT" || it.status == "EXCUSED_ABSENT" }
                    val lateCount = myAttendance.count { it.status == "LATE" }
                    val totalAtt = myAttendance.size
                    val attendanceRate = if (totalAtt > 0) (presentCount.toDouble() / totalAtt * 100) else 0.0

                    // All attendance for calendar view
                    val allMyAttendance = appData.attendance.filter { it.studentId == studentId }

                    // Recent transactions
                    val myTransactions = appData.transactions
                        .filter { it.studentId == studentId }
                        .sortedByDescending { it.date }
                        .take(10)

                    // Recent progress reports
                    val myReports = appData.progressReports
                        .filter { it.studentId == studentId }
                        .sortedByDescending { it.date }
                        .take(5)

                    // Announcements (ALL or targeted to this student)
                    val myAnnouncements = appData.announcements
                        .filter { ann ->
                            ann.targetAudience == "ALL" ||
                            ann.targetAudience == "STUDENTS" ||
                            ann.targetStudentIds?.contains(studentId) == true ||
                            ann.classId?.let { cid -> myClasses.any { it.id == cid } } == true
                        }
                        .sortedByDescending { it.createdAt }
                        .take(5)

                    _uiState.value = ParentUiState(
                        student = student,
                        centerName = centerName,
                        myClasses = myClasses,
                        myTodayClasses = myTodayClasses,
                        attendanceRate = attendanceRate,
                        presentCount = presentCount,
                        absentCount = absentCount,
                        lateCount = lateCount,
                        totalAttendance = totalAtt,
                        recentTransactions = myTransactions,
                        recentReports = myReports,
                        announcements = myAnnouncements,
                        allAttendance = allMyAttendance,
                        allClasses = myClasses,
                        allTeachers = appData.teachers,
                        isLoading = false
                    )
                }
            }
        }
    }
}
