@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package com.educenter.pro.ui.screens.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.educenter.pro.data.model.ClassModel
import com.educenter.pro.data.model.ClassSchedule
import com.educenter.pro.data.model.PersonStatus
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

// ========== ViewModel ==========

data class CalendarDay(
    val date: Date,
    val dayOfMonth: Int,
    val isCurrentMonth: Boolean,
    val isToday: Boolean,
    val classes: List<ClassWithSchedule>
)

data class ClassWithSchedule(
    val classModel: ClassModel,
    val schedule: ClassSchedule,
    val studentCount: Int
)

data class TeacherCalendarUiState(
    val currentMonth: Calendar = Calendar.getInstance(),
    val calendarDays: List<CalendarDay> = emptyList(),
    val selectedDate: Date = Date(),
    val selectedDayClasses: List<ClassWithSchedule> = emptyList(),
    val teacherName: String = "",
    val totalClassesThisWeek: Int = 0,
    val isLoading: Boolean = true
)

@HiltViewModel
class TeacherCalendarViewModel @Inject constructor(
    private val repository: DataRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(TeacherCalendarUiState())
    val uiState: StateFlow<TeacherCalendarUiState> = _uiState.asStateFlow()

    private var myClasses: List<ClassModel> = emptyList()
    private var activeStudentIds: Set<String> = emptySet()

    init {
        loadData()
    }

    private fun loadData() {
        viewModelScope.launch {
            repository.appData.collect { appData ->
                if (appData != null) {
                    val loginId = repository.getLoggedInUserId()
                    val loginEmail = repository.getLoggedInUserEmail()
                    val teacher = appData.teachers.find { t ->
                        t.id == loginId || t.id == loginEmail ||
                        t.email == loginEmail || t.email == loginId ||
                        t.phone == loginEmail || t.phone == loginId
                    }
                    val teacherId = teacher?.id ?: ""
                    val teacherName = teacher?.name ?: loginEmail

                    activeStudentIds = appData.students.filter { it.status == PersonStatus.ACTIVE }.map { it.id }.toSet()

                    myClasses = appData.classes.filter { cls ->
                        cls.teacherIds.contains(teacherId)
                    }

                    val cal = _uiState.value.currentMonth
                    buildCalendar(cal, teacherName)
                }
            }
        }
    }

    private fun buildCalendar(monthCal: Calendar, teacherName: String = _uiState.value.teacherName) {
        val days = mutableListOf<CalendarDay>()
        val today = Calendar.getInstance()

        val cal = monthCal.clone() as Calendar
        cal.set(Calendar.DAY_OF_MONTH, 1)

        // Determine first day to show (may be from previous month)
        val firstDayOfWeek = cal.get(Calendar.DAY_OF_WEEK) // Sunday=1
        val daysToShowBefore = (firstDayOfWeek - Calendar.MONDAY + 7) % 7

        cal.add(Calendar.DAY_OF_MONTH, -daysToShowBefore)

        val dayNames = listOf("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")

        // Generate 42 days (6 weeks)
        for (i in 0 until 42) {
            val dayOfMonth = cal.get(Calendar.DAY_OF_MONTH)
            val isCurrentMonth = cal.get(Calendar.MONTH) == monthCal.get(Calendar.MONTH)
            val isToday = cal.get(Calendar.YEAR) == today.get(Calendar.YEAR) &&
                    cal.get(Calendar.MONTH) == today.get(Calendar.MONTH) &&
                    cal.get(Calendar.DAY_OF_MONTH) == today.get(Calendar.DAY_OF_MONTH)

            val dayIdx = cal.get(Calendar.DAY_OF_WEEK)
            val dayName = when(dayIdx) {
                Calendar.MONDAY -> "Monday"
                Calendar.TUESDAY -> "Tuesday"
                Calendar.WEDNESDAY -> "Wednesday"
                Calendar.THURSDAY -> "Thursday"
                Calendar.FRIDAY -> "Friday"
                Calendar.SATURDAY -> "Saturday"
                Calendar.SUNDAY -> "Sunday"
                else -> ""
            }

            val classesForDay = myClasses.flatMap { cls ->
                cls.schedule.filter { it.dayOfWeek == dayName }.map { sched ->
                    ClassWithSchedule(
                        classModel = cls,
                        schedule = sched,
                        studentCount = cls.studentIds.count { activeStudentIds.contains(it) }
                    )
                }
            }.sortedBy { it.schedule.startTime }

            days.add(CalendarDay(
                date = cal.time,
                dayOfMonth = dayOfMonth,
                isCurrentMonth = isCurrentMonth,
                isToday = isToday,
                classes = classesForDay
            ))

            cal.add(Calendar.DAY_OF_MONTH, 1)
        }

        // This week's classes
        val thisWeekStart = Calendar.getInstance().apply {
            set(Calendar.DAY_OF_WEEK, Calendar.MONDAY)
            set(Calendar.HOUR_OF_DAY, 0)
        }
        val thisWeekEnd = (thisWeekStart.clone() as Calendar).apply { add(Calendar.DAY_OF_MONTH, 7) }
        val weekClasses = days.filter { day ->
            val dc = Calendar.getInstance().apply { time = day.date }
            !dc.before(thisWeekStart) && dc.before(thisWeekEnd)
        }.sumOf { it.classes.size }

        // Selected day's classes
        val selectedDay = days.find { it.isToday } ?: days.firstOrNull { it.isCurrentMonth }

        _uiState.value = _uiState.value.copy(
            currentMonth = monthCal,
            calendarDays = days,
            selectedDate = selectedDay?.date ?: Date(),
            selectedDayClasses = selectedDay?.classes ?: emptyList(),
            teacherName = teacherName,
            totalClassesThisWeek = weekClasses,
            isLoading = false
        )
    }

    fun selectDate(date: Date) {
        val day = _uiState.value.calendarDays.find { d ->
            val c1 = Calendar.getInstance().apply { time = d.date }
            val c2 = Calendar.getInstance().apply { time = date }
            c1.get(Calendar.YEAR) == c2.get(Calendar.YEAR) &&
                    c1.get(Calendar.MONTH) == c2.get(Calendar.MONTH) &&
                    c1.get(Calendar.DAY_OF_MONTH) == c2.get(Calendar.DAY_OF_MONTH)
        }
        _uiState.value = _uiState.value.copy(
            selectedDate = date,
            selectedDayClasses = day?.classes ?: emptyList()
        )
    }

    fun prevMonth() {
        val cal = _uiState.value.currentMonth.clone() as Calendar
        cal.add(Calendar.MONTH, -1)
        buildCalendar(cal)
    }

    fun nextMonth() {
        val cal = _uiState.value.currentMonth.clone() as Calendar
        cal.add(Calendar.MONTH, 1)
        buildCalendar(cal)
    }
}

// ========== Screen ==========

private val classColors = listOf(
    Color(0xFF3B82F6), Color(0xFF8B5CF6), Color(0xFF10B981),
    Color(0xFFF59E0B), Color(0xFFEC4899), Color(0xFF0EA5E9),
    Color(0xFF6366F1), Color(0xFFEF4444)
)

@Composable
fun TeacherCalendarScreen(
    onBack: () -> Unit,
    viewModel: TeacherCalendarViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("📅 Lịch dạy của tôi", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Quay lại")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF2563EB),
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White
                )
            )
        }
    ) { padding ->
        if (uiState.isLoading) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Summary card
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFEEF2FF))
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp).fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("👋 Xin chào,", fontSize = 13.sp, color = Color(0xFF64748B))
                                Text(uiState.teacherName, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color(0xFF1E293B))
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text("${myClassCount(uiState)} lớp", fontWeight = FontWeight.ExtraBold, fontSize = 24.sp, color = Color(0xFF3B82F6))
                                Text("${uiState.totalClassesThisWeek} buổi/tuần", fontSize = 12.sp, color = Color(0xFF64748B))
                            }
                        }
                    }
                }

                // Month navigation
                item {
                    val monthLabel = SimpleDateFormat("MMMM yyyy", Locale("vi")).format(uiState.currentMonth.time)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = { viewModel.prevMonth() }) {
                            Icon(Icons.Default.ChevronLeft, contentDescription = "Tháng trước")
                        }
                        Text(
                            monthLabel.replaceFirstChar { it.uppercase() },
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                        IconButton(onClick = { viewModel.nextMonth() }) {
                            Icon(Icons.Default.ChevronRight, contentDescription = "Tháng sau")
                        }
                    }
                }

                // Day of week headers
                item {
                    Row(modifier = Modifier.fillMaxWidth()) {
                        listOf("T2", "T3", "T4", "T5", "T6", "T7", "CN").forEach { d ->
                            Text(
                                d,
                                modifier = Modifier.weight(1f),
                                textAlign = TextAlign.Center,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xFF94A3B8)
                            )
                        }
                    }
                }

                // Calendar grid (6 weeks)
                val weeks = uiState.calendarDays.chunked(7)
                items(weeks) { week ->
                    Row(modifier = Modifier.fillMaxWidth()) {
                        week.forEach { day ->
                            val isSelected = isSameDay(day.date, uiState.selectedDate)
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .aspectRatio(1f)
                                    .padding(2.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(
                                        when {
                                            isSelected -> Color(0xFF3B82F6)
                                            day.isToday -> Color(0xFF3B82F6).copy(alpha = 0.1f)
                                            else -> Color.Transparent
                                        }
                                    )
                                    .then(
                                        if (day.isToday && !isSelected) Modifier.border(1.5.dp, Color(0xFF3B82F6), RoundedCornerShape(10.dp))
                                        else Modifier
                                    )
                                    .clickable { viewModel.selectDate(day.date) },
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(
                                        "${day.dayOfMonth}",
                                        fontSize = 14.sp,
                                        fontWeight = if (day.isToday || isSelected) FontWeight.Bold else FontWeight.Normal,
                                        color = when {
                                            isSelected -> Color.White
                                            !day.isCurrentMonth -> Color(0xFFCBD5E1)
                                            else -> MaterialTheme.colorScheme.onBackground
                                        }
                                    )
                                    if (day.classes.isNotEmpty()) {
                                        Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                                            day.classes.take(3).forEachIndexed { idx, _ ->
                                                Box(
                                                    modifier = Modifier
                                                        .size(5.dp)
                                                        .clip(CircleShape)
                                                        .background(
                                                            if (isSelected) Color.White.copy(alpha = 0.8f)
                                                            else classColors[idx % classColors.size]
                                                        )
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Selected day detail
                item {
                    Spacer(modifier = Modifier.height(4.dp))
                    val dayLabel = SimpleDateFormat("EEEE, dd/MM/yyyy", Locale("vi")).format(uiState.selectedDate)
                    Text(
                        dayLabel.replaceFirstChar { it.uppercase() },
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                }

                if (uiState.selectedDayClasses.isEmpty()) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = Color(0xFFF1F5F9))
                        ) {
                            Box(
                                modifier = Modifier.fillMaxWidth().padding(24.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text("🎉", fontSize = 32.sp)
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text("Không có buổi dạy", color = Color(0xFF94A3B8), fontWeight = FontWeight.Medium)
                                }
                            }
                        }
                    }
                } else {
                    items(uiState.selectedDayClasses) { item ->
                        val colorIdx = myClasses(uiState).indexOf(item.classModel.id).coerceAtLeast(0) % classColors.size
                        val color = classColors[colorIdx]

                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp),
                            elevation = CardDefaults.cardElevation(2.dp)
                        ) {
                            Row(modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
                                // Color bar
                                Box(
                                    modifier = Modifier
                                        .width(6.dp)
                                        .fillMaxHeight()
                                        .background(color)
                                )
                                Column(modifier = Modifier.padding(14.dp).weight(1f)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(item.classModel.name, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onBackground)
                                        Box(
                                            modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(color.copy(alpha = 0.1f)).padding(horizontal = 8.dp, vertical = 3.dp)
                                        ) {
                                            Text(
                                                "${item.schedule.startTime} - ${item.schedule.endTime}",
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = color
                                            )
                                        }
                                    }
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Default.MenuBook, contentDescription = null, modifier = Modifier.size(14.dp), tint = Color(0xFF94A3B8))
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(item.classModel.subject, fontSize = 13.sp, color = Color(0xFF64748B))
                                        Spacer(modifier = Modifier.width(12.dp))
                                        Icon(Icons.Default.People, contentDescription = null, modifier = Modifier.size(14.dp), tint = Color(0xFF94A3B8))
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text("${item.studentCount} học viên", fontSize = 13.sp, color = Color(0xFF64748B))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun myClassCount(state: TeacherCalendarUiState): Int {
    return state.calendarDays.flatMap { it.classes }.map { it.classModel.id }.distinct().size
}

private fun myClasses(state: TeacherCalendarUiState): List<String> {
    return state.calendarDays.flatMap { it.classes }.map { it.classModel.id }.distinct()
}

private fun isSameDay(d1: Date, d2: Date): Boolean {
    val c1 = Calendar.getInstance().apply { time = d1 }
    val c2 = Calendar.getInstance().apply { time = d2 }
    return c1.get(Calendar.YEAR) == c2.get(Calendar.YEAR) &&
            c1.get(Calendar.MONTH) == c2.get(Calendar.MONTH) &&
            c1.get(Calendar.DAY_OF_MONTH) == c2.get(Calendar.DAY_OF_MONTH)
}
