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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.educenter.pro.ui.components.PullRefreshWrapper
import com.educenter.pro.ui.components.ShimmerLoadingList
import java.text.NumberFormat
import java.util.Locale

private val BlueAccent = Color(0xFF3B82F6)
private val GreenAccent = Color(0xFF10B981)
private val RedAccent = Color(0xFFEF4444)
private val OrangeAccent = Color(0xFFF59E0B)
private val PurpleAccent = Color(0xFF8B5CF6)

@Composable
fun ParentDashboardScreen(
    onNavigateToAttendance: () -> Unit = {},
    onNavigateToAnnouncements: () -> Unit = {},
    viewModel: ParentDashboardViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("vi", "VN"))

    if (uiState.isLoading) {
        ShimmerLoadingList()
        return
    }

    if (uiState.student == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("😔", fontSize = 48.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Text("Không tìm thấy thông tin học sinh", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Text("Vui lòng liên hệ trung tâm", color = Color(0xFF94A3B8))
            }
        }
        return
    }

    val student = uiState.student!!
    var showAllReports by remember { mutableStateOf(false) }

    PullRefreshWrapper(
        isRefreshing = uiState.isRefreshing,
        onRefresh = { viewModel.refresh() },
        modifier = Modifier.fillMaxSize()
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // === HEADER CARD ===
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.Transparent),
                    elevation = CardDefaults.cardElevation(0.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                Brush.horizontalGradient(
                                    listOf(Color(0xFF667EEA), Color(0xFF764BA2))
                                ),
                                shape = RoundedCornerShape(20.dp)
                            )
                            .padding(20.dp)
                    ) {
                        Column {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    if (uiState.centerName.isNotBlank()) {
                                        Text(
                                            uiState.centerName,
                                            color = Color.White.copy(alpha = 0.8f),
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Medium
                                        )
                                        Spacer(modifier = Modifier.height(2.dp))
                                    }
                                    Text(
                                        "👋 Xin chào, Phụ huynh",
                                        color = Color.White,
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                                Box(
                                    modifier = Modifier
                                        .size(48.dp)
                                        .clip(CircleShape)
                                        .background(Color.White.copy(alpha = 0.2f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.School, contentDescription = null, tint = Color.White, modifier = Modifier.size(28.dp))
                                }
                            }
                            Spacer(modifier = Modifier.height(16.dp))

                            // Student info
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.15f))
                            ) {
                                Row(
                                    modifier = Modifier.padding(14.dp).fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(44.dp)
                                            .clip(CircleShape)
                                            .background(Color.White.copy(alpha = 0.2f)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            student.name.take(1).uppercase(),
                                            color = Color.White,
                                            fontWeight = FontWeight.ExtraBold,
                                            fontSize = 20.sp
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(student.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                                        Text(
                                            "Mã HS: ${student.id} • ${uiState.myClasses.joinToString(", ") { it.name }}",
                                            color = Color.White.copy(alpha = 0.8f),
                                            fontSize = 12.sp,
                                            maxLines = 2
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // === BALANCE CARD ===
            item {
                val balance = student.balance
                val isDebt = balance < 0
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (isDebt) Color(0xFFFEF2F2) else Color(0xFFF0FDF4)
                    ),
                    elevation = CardDefaults.cardElevation(2.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp).fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                if (isDebt) Icons.Default.Warning else Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = if (isDebt) RedAccent else GreenAccent,
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text(
                                    if (isDebt) "Còn nợ học phí" else "Đã đóng đủ",
                                    fontSize = 13.sp,
                                    color = if (isDebt) RedAccent else GreenAccent,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    currencyFormatter.format(kotlin.math.abs(balance)),
                                    fontSize = 20.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = if (isDebt) RedAccent else GreenAccent
                                )
                            }
                        }
                    }
                }
            }

            // === ATTENDANCE SUMMARY ===
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("📊 Chuyên cần 30 ngày qua", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onBackground)
                        Spacer(modifier = Modifier.height(14.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Circle progress
                            val rate = uiState.attendanceRate.toFloat().coerceIn(0f, 100f)
                            Box(contentAlignment = Alignment.Center, modifier = Modifier.size(80.dp)) {
                                androidx.compose.foundation.Canvas(modifier = Modifier.size(80.dp)) {
                                    val strokeWidth = 10.dp.toPx()
                                    drawArc(color = Color(0xFFE2E8F0), startAngle = -90f, sweepAngle = 360f, useCenter = false, style = androidx.compose.ui.graphics.drawscope.Stroke(strokeWidth))
                                    drawArc(
                                        color = if (rate >= 80) GreenAccent else if (rate >= 60) OrangeAccent else RedAccent,
                                        startAngle = -90f, sweepAngle = rate * 3.6f, useCenter = false,
                                        style = androidx.compose.ui.graphics.drawscope.Stroke(strokeWidth, cap = androidx.compose.ui.graphics.StrokeCap.Round)
                                    )
                                }
                                Text("${uiState.attendanceRate.toInt()}%", fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, color = MaterialTheme.colorScheme.onBackground)
                            }

                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                AttendanceStat("✅ Có mặt", uiState.presentCount, GreenAccent)
                                AttendanceStat("❌ Vắng", uiState.absentCount, RedAccent)
                                AttendanceStat("⏰ Đi muộn", uiState.lateCount, OrangeAccent)
                            }
                        }
                    }
                }
            }

            // === TODAY'S CLASSES ===
            item {
                SectionTitle(icon = Icons.Default.EventNote, title = "Lịch học hôm nay", color = BlueAccent)
            }

            if (uiState.myTodayClasses.isEmpty()) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFF1F5F9))
                    ) {
                        Box(modifier = Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) {
                            Text("Hôm nay không có buổi học 🎉", color = Color(0xFF94A3B8), fontWeight = FontWeight.Medium)
                        }
                    }
                }
            } else {
                items(uiState.myTodayClasses) { cls ->
                    val todayDayName = try {
                        val today = java.time.LocalDate.now()
                        today.dayOfWeek.name.lowercase().replaceFirstChar { it.uppercase() }
                    } catch (e: Exception) { "" }
                    val schedule = cls.schedule.find { it.dayOfWeek.equals(todayDayName, ignoreCase = true) }
                    val teacher = uiState.allTeachers.find { cls.teacherIds.contains(it.id) }

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        elevation = CardDefaults.cardElevation(2.dp)
                    ) {
                        Row(modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
                            Box(modifier = Modifier.width(5.dp).fillMaxHeight().background(BlueAccent))
                            Column(modifier = Modifier.padding(14.dp).weight(1f)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(cls.name, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onBackground)
                                    if (schedule != null) {
                                        Box(
                                            modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(BlueAccent.copy(alpha = 0.1f)).padding(horizontal = 8.dp, vertical = 3.dp)
                                        ) {
                                            Text("${schedule.startTime} - ${schedule.endTime}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = BlueAccent)
                                        }
                                    }
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.MenuBook, contentDescription = null, modifier = Modifier.size(14.dp), tint = Color(0xFF94A3B8))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(cls.subject, fontSize = 13.sp, color = Color(0xFF64748B))
                                    if (teacher != null) {
                                        Spacer(modifier = Modifier.width(12.dp))
                                        Icon(Icons.Default.Person, contentDescription = null, modifier = Modifier.size(14.dp), tint = Color(0xFF94A3B8))
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(teacher.name, fontSize = 13.sp, color = Color(0xFF64748B))
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // === RECENT TRANSACTIONS ===
            if (uiState.recentTransactions.isNotEmpty()) {
                item {
                    SectionTitle(icon = Icons.Default.Receipt, title = "Giao dịch gần đây", color = GreenAccent)
                }
                items(uiState.recentTransactions.take(5)) { tx ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        elevation = CardDefaults.cardElevation(1.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp).fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(tx.description.ifBlank { tx.type }, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = MaterialTheme.colorScheme.onBackground, maxLines = 1)
                                Text(tx.date, fontSize = 12.sp, color = Color(0xFF94A3B8))
                            }
                            Text(
                                currencyFormatter.format(tx.amount),
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = if (tx.amount >= 0) GreenAccent else RedAccent
                            )
                        }
                    }
                }
            }

            // === INVOICES ===
            if (uiState.invoices.isNotEmpty()) {
                item {
                    SectionTitle(icon = Icons.Default.Description, title = "Hóa đơn học phí", color = BlueAccent)
                }
                items(uiState.invoices) { inv ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        elevation = CardDefaults.cardElevation(1.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp).fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Kỳ: ${inv.month}", fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = MaterialTheme.colorScheme.onBackground)
                                Text("Ngày tạo: ${inv.generatedDate.take(10)}", fontSize = 12.sp, color = Color(0xFF94A3B8))
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    currencyFormatter.format(inv.amount),
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = MaterialTheme.colorScheme.onBackground
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(
                                            when (inv.status) {
                                                "PAID" -> GreenAccent.copy(alpha = 0.1f)
                                                "CANCELLED" -> Color(0xFF94A3B8).copy(alpha = 0.1f)
                                                else -> OrangeAccent.copy(alpha = 0.1f)
                                            }
                                        )
                                        .padding(horizontal = 8.dp, vertical = 2.dp)
                                ) {
                                    Text(
                                        when (inv.status) {
                                            "PAID" -> "Đã trả"
                                            "CANCELLED" -> "Đã hủy"
                                            else -> "Chưa trả"
                                        },
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = when (inv.status) {
                                            "PAID" -> GreenAccent
                                            "CANCELLED" -> Color(0xFF94A3B8)
                                            else -> OrangeAccent
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // === TEACHER COMMENTS (All Reports) ===
            if (uiState.allReports.isNotEmpty()) {
                item {
                    SectionTitle(icon = Icons.Default.RateReview, title = "Nhận xét từ giáo viên", color = PurpleAccent)
                }
                val displayedReports = if (showAllReports) uiState.allReports else uiState.allReports.take(5)
                items(displayedReports) { report ->
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
                                        Text("${report.score}/10", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = OrangeAccent)
                                    }
                                }
                            }
                            if (report.comments.isNotBlank()) {
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(report.comments, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
                if (uiState.allReports.size > 5) {
                    item {
                        TextButton(
                            onClick = { showAllReports = !showAllReports },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                if (showAllReports) "Thu gọn" else "Xem tất cả ${uiState.allReports.size} nhận xét",
                                color = PurpleAccent,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }

            // === ANNOUNCEMENTS ===
            if (uiState.announcements.isNotEmpty()) {
                item {
                    SectionTitle(icon = Icons.Default.Campaign, title = "Thông báo từ trung tâm", color = OrangeAccent)
                }
                items(uiState.announcements) { ann ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        elevation = CardDefaults.cardElevation(1.dp)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(ann.title, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = MaterialTheme.colorScheme.onBackground, modifier = Modifier.weight(1f))
                                Text(ann.createdAt.take(10), fontSize = 11.sp, color = Color(0xFF94A3B8))
                            }
                            if (ann.content.isNotBlank()) {
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(ann.content, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 3)
                            }
                        }
                    }
                }
            }

            // Bottom spacer
            item { Spacer(modifier = Modifier.height(16.dp)) }
        }
    }
}

@Composable
private fun AttendanceStat(label: String, count: Int, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(label, fontSize = 13.sp, color = Color(0xFF64748B))
        Spacer(modifier = Modifier.width(8.dp))
        Text("$count", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = color)
    }
}

@Composable
private fun SectionTitle(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier.size(32.dp).clip(RoundedCornerShape(8.dp)).background(color.copy(alpha = 0.1f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(18.dp))
        }
        Spacer(modifier = Modifier.width(10.dp))
        Text(title, fontWeight = FontWeight.Bold, fontSize = 17.sp, color = MaterialTheme.colorScheme.onBackground)
    }
}
