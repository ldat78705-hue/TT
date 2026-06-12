package com.educenter.pro.ui.screens.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.educenter.pro.data.model.ClassModel
import com.educenter.pro.data.model.Student
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

data class StudentDebt(val student: Student, val debt: Double)
data class StudentAbsent(val student: Student, val absentCount: Int)

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val dataRepository: DataRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        loadDashboardData()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isRefreshing = true)
            try {
                dataRepository.syncData()
            } catch (_: Exception) { }
            _uiState.value = _uiState.value.copy(isRefreshing = false)
        }
    }

    private fun loadDashboardData() {
        viewModelScope.launch {
            dataRepository.appData.collect { appData ->
                if (appData != null) {
                    val activeStudents = appData.students.count { it.status.name == "ACTIVE" }
                    val activeStudentIds = appData.students.filter { it.status.name == "ACTIVE" }.map { it.id }.toSet()
                    
                    // Current month revenue
                    val currentMonthPrefix = SimpleDateFormat("yyyy-MM", Locale.getDefault()).format(Date())
                    val currentMonthRevenue = appData.transactions
                        .filter { it.date.startsWith(currentMonthPrefix) && it.type == "PAYMENT" }
                        .sumOf { it.amount }

                    // Uncollected fees: sum of negative balances
                    val totalUncollected = appData.students
                        .filter { it.balance < 0 && it.status.name == "ACTIVE" }
                        .sumOf { -it.balance }

                    // Top debtors
                    val topDebtors = appData.students
                        .filter { it.balance < 0 }
                        .sortedBy { it.balance }
                        .take(5)
                        .map { StudentDebt(it, -it.balance) }

                    // 30 days ago threshold (matches Web logic)
                    val cal = Calendar.getInstance()
                    cal.add(Calendar.DAY_OF_MONTH, -30)
                    val thirtyDaysAgo = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(cal.time)

                    // Top absent students (ABSENT + UNEXCUSED_ABSENT in last 30 days - matches Web)
                    val topAbsent = appData.students
                        .filter { activeStudentIds.contains(it.id) }
                        .map { student ->
                            val count = appData.attendance.count { a ->
                                a.studentId == student.id &&
                                a.date >= thirtyDaysAgo &&
                                (a.status == "ABSENT" || a.status == "UNEXCUSED_ABSENT")
                            }
                            StudentAbsent(student, count)
                        }
                        .filter { it.absentCount > 0 }
                        .sortedByDescending { it.absentCount }
                        .take(5)

                    // Top late students (LATE in last 30 days - matches Web)
                    val topLate = appData.students
                        .filter { activeStudentIds.contains(it.id) }
                        .map { student ->
                            val count = appData.attendance.count { a ->
                                a.studentId == student.id &&
                                a.date >= thirtyDaysAgo &&
                                a.status == "LATE"
                            }
                            StudentAbsent(student, count)
                        }
                        .filter { it.absentCount > 0 }
                        .sortedByDescending { it.absentCount }
                        .take(5)

                    // Today's classes
                    val todayDayOfWeek = SimpleDateFormat("EEEE", Locale.ENGLISH).format(Date())
                    val todayClasses = appData.classes.filter { c ->
                        c.schedule.any { it.dayOfWeek.equals(todayDayOfWeek, ignoreCase = true) }
                    }

                    // Announcements
                    val recentAnnouncements = appData.announcements
                        .sortedByDescending { it.createdAt }
                        .take(5)

                    _uiState.value = DashboardUiState(
                        totalStudents = activeStudents,
                        totalClasses = appData.classes.size,
                        totalTeachers = appData.teachers.size,
                        monthlyRevenue = currentMonthRevenue,
                        totalUncollected = totalUncollected,
                        topDebtors = topDebtors,
                        topAbsent = topAbsent,
                        topLate = topLate,
                        todayClasses = todayClasses,
                        announcements = recentAnnouncements,
                        allStudents = appData.students,
                        allTeachers = appData.teachers,
                        allClasses = appData.classes,
                        isLoading = false
                    )
                }
            }
        }
    }
}

data class DashboardUiState(
    val totalStudents: Int = 0,
    val totalClasses: Int = 0,
    val totalTeachers: Int = 0,
    val monthlyRevenue: Double = 0.0,
    val totalUncollected: Double = 0.0,
    val topDebtors: List<StudentDebt> = emptyList(),
    val topAbsent: List<StudentAbsent> = emptyList(),
    val topLate: List<StudentAbsent> = emptyList(),
    val todayClasses: List<ClassModel> = emptyList(),
    val announcements: List<com.educenter.pro.data.model.Announcement> = emptyList(),
    val allStudents: List<Student> = emptyList(),
    val allTeachers: List<com.educenter.pro.data.model.Teacher> = emptyList(),
    val allClasses: List<ClassModel> = emptyList(),
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false
)
