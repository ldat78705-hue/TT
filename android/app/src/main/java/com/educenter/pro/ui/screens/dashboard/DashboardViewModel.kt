package com.educenter.pro.ui.screens.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.educenter.pro.data.model.ClassModel
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
                    
                    // Calculate current month revenue
                    val currentMonthPrefix = SimpleDateFormat("yyyy-MM", Locale.getDefault()).format(Date())
                    val currentMonthRevenue = appData.transactions
                        .filter { it.date.startsWith(currentMonthPrefix) && it.type == "PAYMENT" }
                        .sumOf { it.amount }

                    // Today's classes
                    val todayDayOfWeek = SimpleDateFormat("EEEE", Locale.ENGLISH).format(Date())
                    val todayClasses = appData.classes.filter { c ->
                        c.schedule.any { it.dayOfWeek.equals(todayDayOfWeek, ignoreCase = true) }
                    }

                    // Recent announcements
                    val recentAnnouncements = appData.announcements
                        .sortedByDescending { it.createdAt }
                        .take(5)

                    _uiState.value = DashboardUiState(
                        totalStudents = activeStudents,
                        monthlyRevenue = currentMonthRevenue,
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
    val monthlyRevenue: Double = 0.0,
    val todayClasses: List<ClassModel> = emptyList(),
    val announcements: List<com.educenter.pro.data.model.Announcement> = emptyList(),
    val isLoading: Boolean = true
)
