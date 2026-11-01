@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package com.educenter.pro.ui.screens.parent

import androidx.compose.foundation.background
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.educenter.pro.data.model.AttendanceRecord
import com.educenter.pro.data.model.ClassModel
import com.educenter.pro.ui.components.PullRefreshWrapper

private val GreenPresent = Color(0xFF10B981)
private val TealAbsent = Color(0xFF14B8A6)
private val RedAbsent = Color(0xFFEF4444)
private val YellowLate = Color(0xFFF59E0B)
private val BlueRate = Color(0xFF3B82F6)
private val PurpleAccent = Color(0xFF8B5CF6)
private val OrangeAccent = Color(0xFFF97316)

@Composable
fun ParentReportsScreen(
    viewModel: ParentDashboardViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    if (uiState.student == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    val student = uiState.student!!
    val enrolledClasses = uiState.allClasses.filter { student.id in it.studentIds }
    val studentAttendance = uiState.allAttendance.filter { it.studentId == student.id }

    PullRefreshWrapper(
        isRefreshing = uiState.isRefreshing,
        onRefresh = { viewModel.refresh() },
        modifier = Modifier.fillMaxSize()
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // === ATTENDANCE SUMMARY PER CLASS ===
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.BarChart, contentDescription = null, tint = BlueRate, modifier = Modifier.size(22.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Tổng kết Chuyên cần", fontWeight = FontWeight.Bold, fontSize = 17.sp)
                }
            }

            if (enrolledClasses.isEmpty()) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().height(80.dp), contentAlignment = Alignment.Center) {
                        Text("Chưa có dữ liệu chuyên cần", color = Color(0xFF94A3B8))
                    }
                }
            } else {
                items(enrolledClasses) { cls ->
                    AttendanceSummaryCard(cls = cls, attendance = studentAttendance)
                }
            }

            // === ATTENDANCE LOG ===
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.CalendarMonth, contentDescription = null, tint = PurpleAccent, modifier = Modifier.size(22.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Sổ theo dõi Chi tiết", fontWeight = FontWeight.Bold, fontSize = 17.sp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("(${studentAttendance.size})", fontSize = 14.sp, color = Color(0xFF94A3B8))
                }
            }

            val sortedAttendance = studentAttendance.sortedByDescending { it.date }
            val displayAttendance = sortedAttendance.take(50) // Show latest 50

            items(displayAttendance) { record ->
                val cls = uiState.allClasses.find { it.id == record.classId }
                val statusColor = when (record.status) {
                    "PRESENT" -> GreenPresent
                    "ABSENT" -> TealAbsent
                    "UNEXCUSED_ABSENT" -> RedAbsent
                    "LATE" -> YellowLate
                    else -> Color(0xFF94A3B8)
                }
                val statusLabel = when (record.status) {
                    "PRESENT" -> "Có mặt"
                    "ABSENT" -> "Có phép"
                    "UNEXCUSED_ABSENT" -> "Không phép"
                    "LATE" -> "Trễ"
                    else -> "N/A"
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(MaterialTheme.colorScheme.surface)
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            cls?.name ?: "N/A",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp
                        )
                        Text(record.date, fontSize = 12.sp, color = Color(0xFF94A3B8))
                    }
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(statusColor.copy(alpha = 0.1f))
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Text(statusLabel, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = statusColor)
                    }
                }
            }

            // === PROGRESS REPORTS ===
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.RateReview, contentDescription = null, tint = OrangeAccent, modifier = Modifier.size(22.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Lịch sử Nhận xét", fontWeight = FontWeight.Bold, fontSize = 17.sp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("(${uiState.allReports.size})", fontSize = 14.sp, color = Color(0xFF94A3B8))
                }
            }

            if (uiState.allReports.isEmpty()) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().height(80.dp), contentAlignment = Alignment.Center) {
                        Text("Chưa có nhận xét từ giáo viên", color = Color(0xFF94A3B8))
                    }
                }
            } else {
                items(uiState.allReports.sortedByDescending { it.date }) { report ->
                    val cls = uiState.allClasses.find { it.id == report.classId }
                    val teacher = uiState.allTeachers.find { it.id == report.createdBy }

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        elevation = CardDefaults.cardElevation(1.dp)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(cls?.name ?: "", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = PurpleAccent)
                                    if (teacher != null) {
                                        Text("GV: ${teacher.name}", fontSize = 12.sp, color = Color(0xFF64748B))
                                    }
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    Text(report.date, fontSize = 12.sp, color = Color(0xFF94A3B8))
                                    if (report.score != null) {
                                        Text(
                                            "${report.score}/10",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 16.sp,
                                            color = OrangeAccent
                                        )
                                    }
                                }
                            }
                            if (report.comments.isNotBlank()) {
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    report.comments,
                                    fontSize = 14.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    lineHeight = 20.sp
                                )
                            }
                        }
                    }
                }
            }

            // Bottom padding
            item { Spacer(modifier = Modifier.height(32.dp)) }
        }
    }
}

@Composable
private fun AttendanceSummaryCard(
    cls: ClassModel,
    attendance: List<AttendanceRecord>
) {
    val classAttendance = attendance.filter { it.classId == cls.id }
    val present = classAttendance.count { it.status == "PRESENT" }
    val absent = classAttendance.count { it.status == "ABSENT" }
    val unexcused = classAttendance.count { it.status == "UNEXCUSED_ABSENT" }
    val late = classAttendance.count { it.status == "LATE" }
    val total = classAttendance.size
    val rate = if (total > 0) ((present + late).toDouble() / total * 100) else 0.0

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(1.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(cls.name, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = BlueRate)
            Spacer(modifier = Modifier.height(10.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                AttendanceStatItem("Có mặt", present, GreenPresent)
                AttendanceStatItem("Có phép", absent, TealAbsent)
                AttendanceStatItem("K.phép", unexcused, RedAbsent)
                AttendanceStatItem("Trễ", late, YellowLate)
                AttendanceStatItem(
                    "Tỷ lệ",
                    null,
                    BlueRate,
                    displayText = if (total > 0) "${rate.toInt()}%" else "N/A"
                )
            }
        }
    }
}

@Composable
private fun AttendanceStatItem(
    label: String,
    count: Int?,
    color: Color,
    displayText: String? = null
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(color.copy(alpha = 0.1f)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                displayText ?: "$count",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = color
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(label, fontSize = 11.sp, color = Color(0xFF94A3B8))
    }
}
