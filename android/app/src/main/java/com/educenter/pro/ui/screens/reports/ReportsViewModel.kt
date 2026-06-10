package com.educenter.pro.ui.screens.reports

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.educenter.pro.data.repository.DataRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject

data class ReportPeriod(val startDate: String, val endDate: String, val label: String)

data class ReportsUiState(
    val totalRevenue: Double = 0.0,
    val totalExpenses: Double = 0.0,
    val profit: Double = 0.0,
    val tuitionCollected: Double = 0.0,
    val totalReceivables: Double = 0.0,
    val newStudents: Int = 0,
    val inactiveStudents: Int = 0,
    val attendanceRate: Double = 0.0,
    val totalSessions: Int = 0,
    val presentCount: Int = 0,
    val absentCount: Int = 0,
    val lateCount: Int = 0,
    val classFilter: String = "all",
    val period: ReportPeriod = ReportPeriod("", "", "Tháng này"),
    val isLoading: Boolean = true
)

@HiltViewModel
class ReportsViewModel @Inject constructor(
    private val dataRepository: DataRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ReportsUiState())
    val uiState: StateFlow<ReportsUiState> = _uiState.asStateFlow()

    val classes = dataRepository.appData
        .map { it?.classes ?: emptyList() }
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    init {
        setPeriod("this_month")
    }

    fun setPeriod(type: String) {
        val cal = Calendar.getInstance()
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val start: String
        val end: String
        val label: String

        when (type) {
            "this_month" -> {
                cal.set(Calendar.DAY_OF_MONTH, 1)
                start = sdf.format(cal.time)
                cal.set(Calendar.DAY_OF_MONTH, cal.getActualMaximum(Calendar.DAY_OF_MONTH))
                end = sdf.format(cal.time)
                label = "Tháng này"
            }
            "last_month" -> {
                cal.add(Calendar.MONTH, -1)
                cal.set(Calendar.DAY_OF_MONTH, 1)
                start = sdf.format(cal.time)
                cal.set(Calendar.DAY_OF_MONTH, cal.getActualMaximum(Calendar.DAY_OF_MONTH))
                end = sdf.format(cal.time)
                label = "Tháng trước"
            }
            "this_year" -> {
                cal.set(Calendar.MONTH, 0)
                cal.set(Calendar.DAY_OF_MONTH, 1)
                start = sdf.format(cal.time)
                cal.set(Calendar.MONTH, 11)
                cal.set(Calendar.DAY_OF_MONTH, 31)
                end = sdf.format(cal.time)
                label = "Năm nay"
            }
            else -> return
        }

        _uiState.value = _uiState.value.copy(period = ReportPeriod(start, end, label))
        recalculate()
    }

    fun setClassFilter(classId: String) {
        _uiState.value = _uiState.value.copy(classFilter = classId)
        recalculate()
    }

    private fun recalculate() {
        viewModelScope.launch {
            dataRepository.appData.collect { appData ->
                if (appData == null) return@collect
                val state = _uiState.value
                val start = state.period.startDate
                val end = state.period.endDate
                val classFilter = state.classFilter

                val filteredStudentIds = if (classFilter != "all") {
                    appData.classes.find { it.id == classFilter }?.studentIds?.toSet()
                } else null

                // Revenue
                val tuitionCollected = appData.transactions
                    .filter { t ->
                        val inPeriod = t.date >= start && t.date <= end
                        val isPayment = t.type == "PAYMENT" || t.type == "ADJUSTMENT_CREDIT"
                        val inClass = filteredStudentIds?.contains(t.studentId) ?: true
                        inPeriod && isPayment && t.amount > 0 && inClass
                    }
                    .sumOf { it.amount }

                val totalExpenses = appData.transactions
                    .filter { it.date >= start && it.date <= end && it.amount < 0 }
                    .sumOf { -it.amount }

                val totalRevenue = tuitionCollected
                val profit = totalRevenue - totalExpenses

                // Receivables
                val totalReceivables = appData.students
                    .filter { it.balance < 0 && (filteredStudentIds?.contains(it.id) ?: true) }
                    .sumOf { -it.balance }

                // New students
                val newStudents = appData.students.count { s ->
                    s.createdAt >= start && s.createdAt <= end &&
                    (filteredStudentIds?.contains(s.id) ?: true)
                }

                val inactiveStudents = appData.students.count { s ->
                    s.status.name == "INACTIVE" &&
                    (s.statusChangedAt ?: "") >= start && (s.statusChangedAt ?: "") <= end &&
                    (filteredStudentIds?.contains(s.id) ?: true)
                }

                // Attendance stats
                val periodAttendance = appData.attendance.filter { a ->
                    a.date >= start && a.date <= end &&
                    (if (classFilter != "all") a.classId == classFilter else true)
                }
                val totalSessions = periodAttendance.size
                val presentCount = periodAttendance.count { it.status == "PRESENT" || it.status == "LATE" }
                val absentCount = periodAttendance.count { it.status == "ABSENT" || it.status == "UNEXCUSED_ABSENT" }
                val lateCount = periodAttendance.count { it.status == "LATE" }
                val attendanceRate = if (totalSessions > 0) (presentCount.toDouble() / totalSessions) * 100 else 0.0

                _uiState.value = state.copy(
                    totalRevenue = totalRevenue,
                    totalExpenses = totalExpenses,
                    profit = profit,
                    tuitionCollected = tuitionCollected,
                    totalReceivables = totalReceivables,
                    newStudents = newStudents,
                    inactiveStudents = inactiveStudents,
                    attendanceRate = attendanceRate,
                    totalSessions = totalSessions,
                    presentCount = presentCount,
                    absentCount = absentCount,
                    lateCount = lateCount,
                    isLoading = false
                )
            }
        }
    }
}
