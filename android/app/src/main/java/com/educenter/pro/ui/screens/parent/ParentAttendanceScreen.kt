@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package com.educenter.pro.ui.screens.parent

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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
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

// ========== ViewModel ==========

data class AttendanceDayInfo(
    val date: Date,
    val dayOfMonth: Int,
    val isCurrentMonth: Boolean,
    val isToday: Boolean,
    val records: List<AttendanceRecord> // Records for this student on this day
)

data class ParentAttendanceUiState(
    val studentName: String = "",
    val currentMonth: Calendar = Calendar.getInstance(),
    val calendarDays: List<AttendanceDayInfo> = emptyList(),
    val selectedDate: Date = Date(),
    val selectedDayRecords: List<AttendanceRecord> = emptyList(),
    val myClasses: List<ClassModel> = emptyList(),
    val presentCount: Int = 0,
    val absentCount: Int = 0,
    val lateCount: Int = 0,
    val isLoading: Boolean = true,
    // Leave request
    val leaveRequestSuccess: Boolean = false,
    val leaveRequestError: String? = null,
    val leaveRequestLoading: Boolean = false
)

@HiltViewModel
class ParentAttendanceViewModel @Inject constructor(
    private val repository: DataRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ParentAttendanceUiState())
    val uiState: StateFlow<ParentAttendanceUiState> = _uiState.asStateFlow()

    private var allMyAttendance: List<AttendanceRecord> = emptyList()
    private var myClasses: List<ClassModel> = emptyList()
    private var studentId: String = ""

    init {
        loadData()
    }

    private fun loadData() {
        viewModelScope.launch {
            repository.appData.collect { appData ->
                if (appData != null) {
                    studentId = repository.getLoggedInUserId()
                    val student = appData.students.find { it.id == studentId }

                    allMyAttendance = appData.attendance.filter { it.studentId == studentId }
                    myClasses = appData.classes.filter { it.studentIds.contains(studentId) }

                    buildCalendar(_uiState.value.currentMonth, student?.name ?: "")
                }
            }
        }
    }

    private fun buildCalendar(monthCal: Calendar, studentName: String = _uiState.value.studentName) {
        val days = mutableListOf<AttendanceDayInfo>()
        val today = Calendar.getInstance()
        val cal = monthCal.clone() as Calendar
        cal.set(Calendar.DAY_OF_MONTH, 1)

        val firstDayOfWeek = cal.get(Calendar.DAY_OF_WEEK)
        val daysToShowBefore = (firstDayOfWeek - Calendar.MONDAY + 7) % 7
        cal.add(Calendar.DAY_OF_MONTH, -daysToShowBefore)

        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())

        for (i in 0 until 42) {
            val dayOfMonth = cal.get(Calendar.DAY_OF_MONTH)
            val isCurrentMonth = cal.get(Calendar.MONTH) == monthCal.get(Calendar.MONTH)
            val isToday = cal.get(Calendar.YEAR) == today.get(Calendar.YEAR) &&
                    cal.get(Calendar.MONTH) == today.get(Calendar.MONTH) &&
                    cal.get(Calendar.DAY_OF_MONTH) == today.get(Calendar.DAY_OF_MONTH)

            val dateStr = dateFormat.format(cal.time)
            val records = allMyAttendance.filter { it.date == dateStr }

            days.add(AttendanceDayInfo(
                date = cal.time,
                dayOfMonth = dayOfMonth,
                isCurrentMonth = isCurrentMonth,
                isToday = isToday,
                records = records
            ))

            cal.add(Calendar.DAY_OF_MONTH, 1)
        }

        // Stats for this month
        val monthStr = SimpleDateFormat("yyyy-MM", Locale.getDefault()).format(monthCal.time)
        val monthRecords = allMyAttendance.filter { it.date.startsWith(monthStr) }
        val presentCount = monthRecords.count { it.status == "PRESENT" || it.status == "LATE" }
        val absentCount = monthRecords.count { it.status == "ABSENT" || it.status == "UNEXCUSED_ABSENT" || it.status == "EXCUSED_ABSENT" }
        val lateCount = monthRecords.count { it.status == "LATE" }

        val selectedDay = days.find { it.isToday } ?: days.firstOrNull { it.isCurrentMonth }

        _uiState.value = _uiState.value.copy(
            studentName = studentName,
            currentMonth = monthCal,
            calendarDays = days,
            selectedDate = selectedDay?.date ?: Date(),
            selectedDayRecords = selectedDay?.records ?: emptyList(),
            myClasses = myClasses,
            presentCount = presentCount,
            absentCount = absentCount,
            lateCount = lateCount,
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
            selectedDayRecords = day?.records ?: emptyList()
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

    fun submitLeaveRequest(classId: String, date: String, reason: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(leaveRequestLoading = true, leaveRequestError = null, leaveRequestSuccess = false)
            try {
                // Use updateSingleAttendance to avoid wiping other students' records
                val note = "PHHS xin phép: $reason"
                repository.recordAttendance(classId, studentId, date, "EXCUSED_ABSENT", note)
                _uiState.value = _uiState.value.copy(leaveRequestLoading = false, leaveRequestSuccess = true)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(leaveRequestLoading = false, leaveRequestError = e.message ?: "Gửi đơn thất bại")
            }
        }
    }

    fun clearLeaveResult() {
        _uiState.value = _uiState.value.copy(leaveRequestSuccess = false, leaveRequestError = null)
    }
}

// ========== Screen ==========

private val statusColors = mapOf(
    "PRESENT" to Color(0xFF10B981),
    "LATE" to Color(0xFFF59E0B),
    "ABSENT" to Color(0xFFEF4444),
    "UNEXCUSED_ABSENT" to Color(0xFFEF4444),
    "EXCUSED_ABSENT" to Color(0xFF3B82F6)
)

private val statusLabels = mapOf(
    "PRESENT" to "Có mặt ✅",
    "LATE" to "Đi muộn ⏰",
    "ABSENT" to "Vắng ❌",
    "UNEXCUSED_ABSENT" to "Vắng KP ❌",
    "EXCUSED_ABSENT" to "Nghỉ phép 📝"
)

@Composable
fun ParentAttendanceScreen(
    viewModel: ParentAttendanceViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    // Leave request dialog state
    var showLeaveDialog by remember { mutableStateOf(false) }
    var leaveDate by remember { mutableStateOf("") }
    var leaveClassId by remember { mutableStateOf("") }
    var leaveReason by remember { mutableStateOf("") }

    if (uiState.isLoading) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Header
        item {
            Text("📅 Lịch điểm danh", fontWeight = FontWeight.Bold, fontSize = 22.sp, color = MaterialTheme.colorScheme.onBackground)
            Text(uiState.studentName, fontSize = 14.sp, color = Color(0xFF64748B))
        }

        // Stats cards
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                StatMiniCard("✅ Có mặt", uiState.presentCount, Color(0xFF10B981), Modifier.weight(1f))
                StatMiniCard("❌ Vắng", uiState.absentCount, Color(0xFFEF4444), Modifier.weight(1f))
                StatMiniCard("⏰ Muộn", uiState.lateCount, Color(0xFFF59E0B), Modifier.weight(1f))
            }
        }

        // Leave request button
        item {
            Button(
                onClick = {
                    // Default to tomorrow
                    val tomorrow = Calendar.getInstance().apply { add(Calendar.DAY_OF_MONTH, 1) }
                    leaveDate = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(tomorrow.time)
                    leaveClassId = uiState.myClasses.firstOrNull()?.id ?: ""
                    leaveReason = ""
                    showLeaveDialog = true
                },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF3B82F6))
            ) {
                Icon(Icons.Default.EventBusy, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Xin nghỉ phép cho con", fontWeight = FontWeight.Bold, color = Color.White)
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

        // Calendar grid
        val weeks = uiState.calendarDays.chunked(7)
        items(weeks) { week ->
            Row(modifier = Modifier.fillMaxWidth()) {
                week.forEach { day ->
                    val isSelected = isSameDay(day.date, uiState.selectedDate)
                    val dominantStatus = day.records.firstOrNull()?.status

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
                                fontSize = 13.sp,
                                fontWeight = if (day.isToday || isSelected) FontWeight.Bold else FontWeight.Normal,
                                color = when {
                                    isSelected -> Color.White
                                    !day.isCurrentMonth -> Color(0xFFCBD5E1)
                                    else -> MaterialTheme.colorScheme.onBackground
                                }
                            )
                            if (dominantStatus != null) {
                                Box(
                                    modifier = Modifier
                                        .size(7.dp)
                                        .clip(CircleShape)
                                        .background(
                                            if (isSelected) Color.White.copy(alpha = 0.8f)
                                            else statusColors[dominantStatus] ?: Color.Gray
                                        )
                                )
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
            Text(dayLabel.replaceFirstChar { it.uppercase() }, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onBackground)
        }

        if (uiState.selectedDayRecords.isEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFF1F5F9))
                ) {
                    Box(modifier = Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) {
                        Text("Không có dữ liệu điểm danh", color = Color(0xFF94A3B8), fontWeight = FontWeight.Medium)
                    }
                }
            }
        } else {
            items(uiState.selectedDayRecords) { record ->
                val cls = uiState.myClasses.find { it.id == record.classId }
                val statusColor = statusColors[record.status] ?: Color.Gray
                val statusLabel = statusLabels[record.status] ?: record.status

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    elevation = CardDefaults.cardElevation(2.dp)
                ) {
                    Row(modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
                        Box(modifier = Modifier.width(5.dp).fillMaxHeight().background(statusColor))
                        Column(modifier = Modifier.padding(14.dp).weight(1f)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(cls?.name ?: record.classId, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = MaterialTheme.colorScheme.onBackground)
                                Box(
                                    modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(statusColor.copy(alpha = 0.1f)).padding(horizontal = 8.dp, vertical = 3.dp)
                                ) {
                                    Text(statusLabel, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = statusColor)
                                }
                            }
                            if (record.note.isNotBlank()) {
                                Spacer(modifier = Modifier.height(4.dp))
                                Text("📝 ${record.note}", fontSize = 13.sp, color = Color(0xFF64748B))
                            }
                        }
                    }
                }
            }
        }

        item { Spacer(modifier = Modifier.height(16.dp)) }
    }

    // === LEAVE REQUEST DIALOG ===
    if (showLeaveDialog) {
        AlertDialog(
            onDismissRequest = { showLeaveDialog = false; viewModel.clearLeaveResult() },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.EventBusy, contentDescription = null, tint = Color(0xFF3B82F6), modifier = Modifier.size(24.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Xin nghỉ phép", fontWeight = FontWeight.Bold)
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (uiState.leaveRequestSuccess) {
                        Text("✅ Đã gửi xin nghỉ phép thành công!", color = Color(0xFF10B981), fontWeight = FontWeight.Bold)
                    } else {
                        if (uiState.leaveRequestError != null) {
                            Text(uiState.leaveRequestError!!, color = Color(0xFFEF4444), fontSize = 13.sp)
                        }

                        // Date input
                        OutlinedTextField(
                            value = leaveDate,
                            onValueChange = { leaveDate = it },
                            label = { Text("Ngày nghỉ (yyyy-MM-dd)") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp)
                        )

                        // Class selector
                        if (uiState.myClasses.size > 1) {
                            Text("Chọn lớp:", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                            Column {
                                uiState.myClasses.forEach { cls ->
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(8.dp))
                                            .clickable { leaveClassId = cls.id }
                                            .background(if (leaveClassId == cls.id) Color(0xFF3B82F6).copy(alpha = 0.1f) else Color.Transparent)
                                            .padding(8.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        RadioButton(
                                            selected = leaveClassId == cls.id,
                                            onClick = { leaveClassId = cls.id },
                                            colors = RadioButtonDefaults.colors(selectedColor = Color(0xFF3B82F6))
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(cls.name, fontSize = 14.sp)
                                    }
                                }
                            }
                        }

                        // Reason
                        OutlinedTextField(
                            value = leaveReason,
                            onValueChange = { leaveReason = it },
                            label = { Text("Lý do xin nghỉ") },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            minLines = 2,
                            maxLines = 4
                        )
                    }
                }
            },
            confirmButton = {
                if (!uiState.leaveRequestSuccess) {
                    Button(
                        onClick = {
                            if (leaveDate.isBlank()) return@Button
                            if (leaveClassId.isBlank() && uiState.myClasses.isNotEmpty()) {
                                leaveClassId = uiState.myClasses.first().id
                            }
                            viewModel.submitLeaveRequest(leaveClassId, leaveDate, leaveReason)
                        },
                        enabled = !uiState.leaveRequestLoading && leaveDate.isNotBlank(),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF3B82F6))
                    ) {
                        if (uiState.leaveRequestLoading) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                        } else {
                            Text("Gửi xin phép", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { showLeaveDialog = false; viewModel.clearLeaveResult() }) {
                    Text(if (uiState.leaveRequestSuccess) "Đóng" else "Hủy")
                }
            }
        )
    }
}

@Composable
private fun StatMiniCard(label: String, count: Int, color: Color, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = color.copy(alpha = 0.08f))
    ) {
        Column(
            modifier = Modifier.padding(12.dp).fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("$count", fontWeight = FontWeight.ExtraBold, fontSize = 22.sp, color = color)
            Text(label, fontSize = 11.sp, color = color, fontWeight = FontWeight.Medium)
        }
    }
}

private fun isSameDay(d1: Date, d2: Date): Boolean {
    val c1 = Calendar.getInstance().apply { time = d1 }
    val c2 = Calendar.getInstance().apply { time = d2 }
    return c1.get(Calendar.YEAR) == c2.get(Calendar.YEAR) &&
            c1.get(Calendar.MONTH) == c2.get(Calendar.MONTH) &&
            c1.get(Calendar.DAY_OF_MONTH) == c2.get(Calendar.DAY_OF_MONTH)
}
