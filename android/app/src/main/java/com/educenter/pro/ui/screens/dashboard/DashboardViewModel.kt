package com.educenter.pro.ui.screens.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.educenter.pro.data.model.ClassModel
import com.educenter.pro.data.model.Student
import com.educenter.pro.data.model.UserRole
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
        // Sync fresh data from server
        viewModelScope.launch {
            try { dataRepository.syncData() } catch (_: Exception) { }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isRefreshing = true)
            try {
                dataRepository.syncData(force = true)
            } catch (_: Exception) { }
            _uiState.value = _uiState.value.copy(isRefreshing = false)
        }
    }

    private fun loadDashboardData() {
        viewModelScope.launch {
            dataRepository.appData.collect { appData ->
                if (appData != null) {
                    val role = dataRepository.currentUserRole.value
                    val activeStudents = appData.students.count { it.status.name == "ACTIVE" }
                    val activeStudentIds = appData.students.filter { it.status.name == "ACTIVE" }.map { it.id }.toSet()
                    
                    // Current month revenue
                    val currentMonthPrefix = SimpleDateFormat("yyyy-MM", Locale.getDefault()).format(Date())
                    val currentMonthRevenue = appData.transactions
                        .filter { it.date.startsWith(currentMonthPrefix) && it.type == "PAYMENT" }
                        .sumOf { it.amount }

                    // Last month revenue for comparison
                    val lastMonthCal = Calendar.getInstance()
                    lastMonthCal.add(Calendar.MONTH, -1)
                    val lastMonthPrefix = SimpleDateFormat("yyyy-MM", Locale.getDefault()).format(lastMonthCal.time)
                    val lastMonthRevenue = appData.transactions
                        .filter { it.date.startsWith(lastMonthPrefix) && it.type == "PAYMENT" }
                        .sumOf { it.amount }

                    // Revenue growth percentage
                    val revenueGrowth = if (lastMonthRevenue > 0) {
                        ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100)
                    } else if (currentMonthRevenue > 0) 100.0 else 0.0

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

                    // Monthly revenue for last 6 months (for chart)
                    val monthlyRevenueChart = mutableListOf<Pair<String, Double>>()
                    for (i in 5 downTo 0) {
                        val cal2 = Calendar.getInstance()
                        cal2.add(Calendar.MONTH, -i)
                        val monthKey = SimpleDateFormat("yyyy-MM", Locale.getDefault()).format(cal2.time)
                        val monthLabel = SimpleDateFormat("MM", Locale.getDefault()).format(cal2.time)
                        val rev = appData.transactions
                            .filter { it.date.startsWith(monthKey) && it.type == "PAYMENT" }
                            .sumOf { it.amount }
                        monthlyRevenueChart.add("T$monthLabel" to rev)
                    }

                    // Attendance rate for chart
                    val totalAttRecords = appData.attendance.filter { it.date >= thirtyDaysAgo }.size
                    val presentRecords = appData.attendance.filter { it.date >= thirtyDaysAgo && (it.status == "PRESENT" || it.status == "LATE") }.size
                    val attendanceRate = if (totalAttRecords > 0) (presentRecords.toDouble() / totalAttRecords * 100) else 0.0

                    // === TEACHER-SPECIFIC DATA ===
                    val loggedInEmail = dataRepository.getLoggedInUserEmail()
                    val loggedInId = dataRepository.getLoggedInUserId()
                    val teacher = appData.teachers.find { t ->
                        t.id == loggedInId || t.id == loggedInEmail ||
                        t.email == loggedInEmail || t.email == loggedInId ||
                        t.phone == loggedInEmail || t.phone == loggedInId
                    }
                    val teacherId = teacher?.id ?: ""
                    val teacherName = teacher?.name ?: loggedInEmail

                    val myTeacherClasses = if (role == UserRole.TEACHER && teacherId.isNotEmpty()) {
                        appData.classes.filter { it.teacherIds.contains(teacherId) }
                    } else emptyList()

                    val myTodayClasses = if (role == UserRole.TEACHER) {
                        myTeacherClasses.filter { c ->
                            c.schedule.any { it.dayOfWeek.equals(todayDayOfWeek, ignoreCase = true) }
                        }
                    } else emptyList()

                    // This week sessions for teacher
                    val weekDays = listOf("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
                    val myWeekSessions = if (role == UserRole.TEACHER) {
                        myTeacherClasses.sumOf { cls ->
                            cls.schedule.count { sched -> weekDays.any { it.equals(sched.dayOfWeek, ignoreCase = true) } }
                        }
                    } else 0

                    _uiState.value = DashboardUiState(
                        currentUserRole = role,
                        totalStudents = activeStudents,
                        totalClasses = appData.classes.size,
                        totalTeachers = appData.teachers.size,
                        monthlyRevenue = currentMonthRevenue,
                        lastMonthRevenue = lastMonthRevenue,
                        revenueGrowth = revenueGrowth,
                        totalUncollected = totalUncollected,
                        topDebtors = topDebtors,
                        topAbsent = topAbsent,
                        topLate = topLate,
                        todayClasses = todayClasses,
                        announcements = recentAnnouncements,
                        allStudents = appData.students,
                        allTeachers = appData.teachers,
                        allClasses = appData.classes,
                        revenueChartData = monthlyRevenueChart,
                        attendanceRate = attendanceRate,
                        teacherName = teacherName,
                        myTeacherClasses = myTeacherClasses,
                        myTodayClasses = myTodayClasses,
                        myWeekSessions = myWeekSessions,
                        isLoading = false
                    )
                }
            }
        }
    }
}

data class DashboardUiState(
    val currentUserRole: UserRole = UserRole.VIEWER,
    val totalStudents: Int = 0,
    val totalClasses: Int = 0,
    val totalTeachers: Int = 0,
    val monthlyRevenue: Double = 0.0,
    val lastMonthRevenue: Double = 0.0,
    val revenueGrowth: Double = 0.0,
    val totalUncollected: Double = 0.0,
    val topDebtors: List<StudentDebt> = emptyList(),
    val topAbsent: List<StudentAbsent> = emptyList(),
    val topLate: List<StudentAbsent> = emptyList(),
    val todayClasses: List<ClassModel> = emptyList(),
    val announcements: List<com.educenter.pro.data.model.Announcement> = emptyList(),
    val allStudents: List<Student> = emptyList(),
    val allTeachers: List<com.educenter.pro.data.model.Teacher> = emptyList(),
    val allClasses: List<ClassModel> = emptyList(),
    val revenueChartData: List<Pair<String, Double>> = emptyList(),
    val attendanceRate: Double = 0.0,
    // Teacher-specific
    val teacherName: String = "",
    val myTeacherClasses: List<ClassModel> = emptyList(),
    val myTodayClasses: List<ClassModel> = emptyList(),
    val myWeekSessions: Int = 0,
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false
)
