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

    private fun loadDashboardData() {
        viewModelScope.launch {
            dataRepository.appData.collect { appData ->
                if (appData != null) {
                    val activeStudents = appData.students.count { it.status.name == "ACTIVE" }
                    
                    // Current month revenue
                    val currentMonthPrefix = SimpleDateFormat("yyyy-MM", Locale.getDefault()).format(Date())
                    val currentMonthRevenue = appData.transactions
                        .filter { it.date.startsWith(currentMonthPrefix) && it.type == "PAYMENT" }
                        .sumOf { it.amount }

                    // Uncollected fees: sum of negative balances
                    val totalUncollected = appData.students
                        .filter { it.balance < 0 && it.status.name == "ACTIVE" }
                        .sumOf { -it.balance }

                    // Top debtors (students with most negative balance)
                    val topDebtors = appData.students
                        .filter { it.balance < 0 }
                        .sortedBy { it.balance }
                        .take(5)
                        .map { StudentDebt(it, -it.balance) }

                    // Top absent students (UNEXCUSED_ABSENT count in current month)
                    val topAbsent = appData.students
                        .map { student ->
                            val count = appData.attendance.count { a ->
                                a.studentId == student.id &&
                                a.date.startsWith(currentMonthPrefix) &&
                                a.status == "UNEXCUSED_ABSENT"
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
                        todayClasses = todayClasses,
                        announcements = recentAnnouncements,
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
    val todayClasses: List<ClassModel> = emptyList(),
    val announcements: List<com.educenter.pro.data.model.Announcement> = emptyList(),
    val isLoading: Boolean = true
)
