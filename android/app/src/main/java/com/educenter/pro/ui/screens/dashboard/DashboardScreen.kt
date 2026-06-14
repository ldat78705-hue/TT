package com.educenter.pro.ui.screens.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Class
import androidx.compose.material.icons.filled.EventNote
import androidx.compose.material.icons.filled.MonetizationOn
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.TrendingDown
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.educenter.pro.data.model.UserRole
import com.educenter.pro.ui.components.ShimmerLoadingList
import com.educenter.pro.ui.components.PullRefreshWrapper
import java.text.NumberFormat
import java.util.Locale

private val GreenAccent = Color(0xFF10B981)
private val RedAccent = Color(0xFFEF4444)
private val BlueAccent = Color(0xFF3B82F6)
private val OrangeAccent = Color(0xFFF59E0B)
private val PurpleAccent = Color(0xFF8B5CF6)

@Composable
fun DashboardScreen(
    onNavigateToClasses: () -> Unit = {},
    onNavigateToTeachers: () -> Unit = {},
    onNavigateToFinance: () -> Unit = {},
    onNavigateToAnnouncements: () -> Unit = {},
    onNavigateToTeacherCalendar: () -> Unit = {},
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("vi", "VN"))

    if (uiState.isLoading) {
        ShimmerLoadingList()
        return
    }

    PullRefreshWrapper(
        isRefreshing = uiState.isRefreshing,
        onRefresh = { viewModel.refresh() },
        modifier = Modifier.fillMaxSize()
    ) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(vertical = 16.dp)
    ) {
        // === HEADER ===
        item {
            Text(
                "Tổng quan",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.ExtraBold,
                color = MaterialTheme.colorScheme.onBackground
            )
        }

        // === GLOBAL SEARCH ===
        item {
            var searchQuery by remember { mutableStateOf("") }
            val appData = uiState

            Column {
                com.educenter.pro.ui.components.AppSearchBar(
                    query = searchQuery,
                    onQueryChange = { searchQuery = it },
                    placeholder = "Tìm học viên, lớp, giáo viên..."
                )

                if (searchQuery.length >= 2) {
                    val query = searchQuery.lowercase()
                    val matchedStudents = uiState.allStudents
                        .filter { it.name.lowercase().contains(query) || it.phone.contains(query) }
                        .take(5)
                    val matchedTeachers = uiState.allTeachers
                        .filter { it.name.lowercase().contains(query) || it.phone.contains(query) }
                        .take(3)
                    val matchedClasses = uiState.allClasses
                        .filter { it.name.lowercase().contains(query) || it.subject.lowercase().contains(query) }
                        .take(3)
                    val hasResults = matchedStudents.isNotEmpty() || matchedTeachers.isNotEmpty() || matchedClasses.isNotEmpty()

                    if (hasResults) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            elevation = CardDefaults.cardElevation(2.dp)
                        ) {
                            Column(modifier = Modifier.padding(8.dp)) {
                                if (matchedStudents.isNotEmpty()) {
                                    Text("👨‍🎓 Học viên", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color(0xFF3B82F6), modifier = Modifier.padding(bottom = 4.dp))
                                    matchedStudents.forEach { student ->
                                        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                                            Icon(Icons.Default.People, contentDescription = null, tint = BlueAccent, modifier = Modifier.size(18.dp))
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(student.name, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = MaterialTheme.colorScheme.onBackground)
                                                if (student.phone.isNotBlank()) Text(student.phone, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                            }
                                        }
                                    }
                                }
                                if (matchedTeachers.isNotEmpty()) {
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text("👨‍🏫 Giáo viên", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color(0xFF10B981), modifier = Modifier.padding(bottom = 4.dp))
                                    matchedTeachers.forEach { teacher ->
                                        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                                            Icon(Icons.Default.Person, contentDescription = null, tint = Color(0xFF10B981), modifier = Modifier.size(18.dp))
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text(teacher.name, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = MaterialTheme.colorScheme.onBackground)
                                        }
                                    }
                                }
                                if (matchedClasses.isNotEmpty()) {
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text("🏫 Lớp học", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color(0xFFF59E0B), modifier = Modifier.padding(bottom = 4.dp))
                                    matchedClasses.forEach { cls ->
                                        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                                            Icon(Icons.Default.Class, contentDescription = null, tint = Color(0xFFF59E0B), modifier = Modifier.size(18.dp))
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text("${cls.name} - ${cls.subject}", fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = MaterialTheme.colorScheme.onBackground)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // === QUICK ACCESS GRID ===
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                QuickAccessButton(
                    label = "Lớp học",
                    icon = Icons.Default.Class,
                    color = Color(0xFF8B5CF6),
                    onClick = onNavigateToClasses,
                    modifier = Modifier.weight(1f)
                )
                if (uiState.currentUserRole != UserRole.TEACHER) {
                    QuickAccessButton(
                        label = "Giáo viên",
                        icon = Icons.Default.Person,
                        color = Color(0xFF3B82F6),
                        onClick = onNavigateToTeachers,
                        modifier = Modifier.weight(1f)
                    )
                    QuickAccessButton(
                        label = "Tài chính",
                        icon = Icons.Default.MonetizationOn,
                        color = Color(0xFF10B981),
                        onClick = onNavigateToFinance,
                        modifier = Modifier.weight(1f)
                    )
                } else {
                    QuickAccessButton(
                        label = "Lịch dạy",
                        icon = Icons.Default.CalendarMonth,
                        color = Color(0xFF3B82F6),
                        onClick = onNavigateToTeacherCalendar,
                        modifier = Modifier.weight(1f)
                    )
                }
                QuickAccessButton(
                    label = "Thông báo",
                    icon = Icons.Default.Campaign,
                    color = Color(0xFFF59E0B),
                    onClick = onNavigateToAnnouncements,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // === TEACHER PERSONAL STATS ===
        if (uiState.currentUserRole == UserRole.TEACHER) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFEEF2FF)),
                    elevation = CardDefaults.cardElevation(2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("👋 Xin chào, ${uiState.teacherName}", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color(0xFF1E293B))
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("${uiState.myTeacherClasses.size}", fontWeight = FontWeight.ExtraBold, fontSize = 28.sp, color = Color(0xFF3B82F6))
                                Text("Lớp đang dạy", fontSize = 12.sp, color = Color(0xFF64748B))
                            }
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("${uiState.myTodayClasses.size}", fontWeight = FontWeight.ExtraBold, fontSize = 28.sp, color = Color(0xFF10B981))
                                Text("Buổi hôm nay", fontSize = 12.sp, color = Color(0xFF64748B))
                            }
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("${uiState.myWeekSessions}", fontWeight = FontWeight.ExtraBold, fontSize = 28.sp, color = Color(0xFFF59E0B))
                                Text("Buổi/tuần", fontSize = 12.sp, color = Color(0xFF64748B))
                            }
                        }
                    }
                }
            }
        }

        // === REVENUE CHART (Admin/Manager only) ===
        if (uiState.currentUserRole != UserRole.TEACHER && uiState.revenueChartData.isNotEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("📊 Doanh thu 6 tháng gần nhất", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onBackground, modifier = Modifier.weight(1f))
                            // Growth badge
                            if (uiState.revenueGrowth != 0.0 && !uiState.revenueGrowth.isNaN() && !uiState.revenueGrowth.isInfinite()) {
                                val isPositive = uiState.revenueGrowth > 0
                                val growthText = "${if (isPositive) "↑" else "↓"}${"%.1f".format(kotlin.math.abs(uiState.revenueGrowth))}%"
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(if (isPositive) Color(0xFF10B981).copy(alpha = 0.1f) else Color(0xFFEF4444).copy(alpha = 0.1f))
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Text(
                                        growthText,
                                        color = if (isPositive) Color(0xFF10B981) else Color(0xFFEF4444),
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        maxLines = 1,
                                        softWrap = false
                                    )
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(16.dp))

                        val maxRevenue = uiState.revenueChartData.maxOfOrNull { it.second } ?: 1.0

                        // Bar chart
                        Row(
                            modifier = Modifier.fillMaxWidth().height(120.dp),
                            horizontalArrangement = Arrangement.SpaceEvenly,
                            verticalAlignment = Alignment.Bottom
                        ) {
                            uiState.revenueChartData.forEach { (label, amount) ->
                                val fraction = if (maxRevenue > 0) (amount / maxRevenue).toFloat() else 0f
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    modifier = Modifier.weight(1f)
                                ) {
                                    // Bar
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth(0.6f)
                                            .height((fraction * 90).dp.coerceAtLeast(4.dp))
                                            .clip(RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp))
                                            .background(
                                                Brush.verticalGradient(
                                                    listOf(Color(0xFF3B82F6), Color(0xFF2563EB))
                                                )
                                            )
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(label, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, fontWeight = FontWeight.Medium)
                                }
                            }
                        }
                    }
                }
            }

            // Attendance rate
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    // Attendance rate card
                    Card(
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        elevation = CardDefaults.cardElevation(2.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text("✅ Chuyên cần", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Spacer(modifier = Modifier.height(12.dp))

                            // Circle progress
                            val rate = uiState.attendanceRate.toFloat().coerceIn(0f, 100f)
                            Box(contentAlignment = Alignment.Center, modifier = Modifier.size(80.dp)) {
                                androidx.compose.foundation.Canvas(modifier = Modifier.size(80.dp)) {
                                    val strokeWidth = 10.dp.toPx()
                                    drawArc(
                                        color = Color(0xFFE2E8F0),
                                        startAngle = -90f,
                                        sweepAngle = 360f,
                                        useCenter = false,
                                        style = androidx.compose.ui.graphics.drawscope.Stroke(strokeWidth)
                                    )
                                    drawArc(
                                        color = if (rate >= 80) Color(0xFF10B981) else if (rate >= 60) Color(0xFFF59E0B) else Color(0xFFEF4444),
                                        startAngle = -90f,
                                        sweepAngle = rate * 3.6f,
                                        useCenter = false,
                                        style = androidx.compose.ui.graphics.drawscope.Stroke(strokeWidth, cap = androidx.compose.ui.graphics.StrokeCap.Round)
                                    )
                                }
                                Text(
                                    "${uiState.attendanceRate.toInt()}%",
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 18.sp,
                                    color = MaterialTheme.colorScheme.onBackground
                                )
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("30 ngày qua", fontSize = 12.sp, color = Color(0xFF94A3B8))
                        }
                    }

                    // Summary card - hide financial data for teacher
                    if (uiState.currentUserRole != UserRole.TEACHER) {
                        Card(
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            elevation = CardDefaults.cardElevation(2.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text("📈 Tổng quan", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Spacer(modifier = Modifier.height(12.dp))
                                val fmt = java.text.NumberFormat.getCurrencyInstance(java.util.Locale("vi", "VN"))
                                Text("Doanh thu tháng", fontSize = 12.sp, color = Color(0xFF94A3B8))
                                Text(fmt.format(uiState.monthlyRevenue), fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color(0xFF10B981))
                                Spacer(modifier = Modifier.height(8.dp))
                                Text("Nợ phải thu", fontSize = 12.sp, color = Color(0xFF94A3B8))
                                Text(fmt.format(uiState.totalUncollected), fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color(0xFFEF4444))
                            }
                        }
                    }
                }
            }
        }

        // === TODAY'S CLASSES ===
        item {
            SectionHeader(
                icon = Icons.Default.EventNote,
                title = if (uiState.currentUserRole == UserRole.TEACHER) "Lịch dạy hôm nay" else "Lịch học hôm nay",
                color = BlueAccent
            )
        }

        val todayClassList = if (uiState.currentUserRole == UserRole.TEACHER) uiState.myTodayClasses else uiState.todayClasses
        if (todayClassList.isEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            if (uiState.currentUserRole == UserRole.TEACHER) "Hôm nay không có buổi dạy 🎉" else "Không có lịch học nào hôm nay 🎉",
                            color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 15.sp
                        )
                    }
                }
            }
        } else {
            items(todayClassList) { classModel ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(BlueAccent.copy(alpha = 0.1f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Class, contentDescription = null, tint = BlueAccent)
                        }
                        Spacer(modifier = Modifier.width(16.dp))
                        Column {
                            Text(classModel.name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onBackground)
                            Spacer(modifier = Modifier.height(2.dp))
                            // Show schedule time for today
                            val todayDayName = try {
                                val today = java.time.LocalDate.now()
                                when (today.dayOfWeek) {
                                    java.time.DayOfWeek.MONDAY -> "Monday"
                                    java.time.DayOfWeek.TUESDAY -> "Tuesday"
                                    java.time.DayOfWeek.WEDNESDAY -> "Wednesday"
                                    java.time.DayOfWeek.THURSDAY -> "Thursday"
                                    java.time.DayOfWeek.FRIDAY -> "Friday"
                                    java.time.DayOfWeek.SATURDAY -> "Saturday"
                                    java.time.DayOfWeek.SUNDAY -> "Sunday"
                                    else -> ""
                                }
                            } catch (e: Exception) { "" }
                            val todaySchedule = classModel.schedule.find { it.dayOfWeek == todayDayName }
                            val timeStr = if (todaySchedule != null) "${todaySchedule.startTime} - ${todaySchedule.endTime} • " else ""
                            Text(
                                "${timeStr}${classModel.subject} • ${classModel.studentIds.size} HV",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }

        // === STAT CARDS ROW 1 ===
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatCard(
                    title = "Học sinh",
                    value = uiState.totalStudents.toString(),
                    icon = Icons.Default.People,
                    gradientColors = listOf(Color(0xFF4facfe), Color(0xFF00f2fe)),
                    modifier = Modifier.weight(1f)
                )
                StatCard(
                    title = "Lớp học",
                    value = if (uiState.currentUserRole == UserRole.TEACHER) uiState.myTeacherClasses.size.toString() else uiState.totalClasses.toString(),
                    icon = Icons.Default.Class,
                    gradientColors = listOf(Color(0xFFf093fb), Color(0xFFf5576c)),
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // === STAT CARDS ROW 2 (hide financial for teacher) ===
        if (uiState.currentUserRole != UserRole.TEACHER) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    StatCard(
                        title = "Thu tháng này",
                        value = currencyFormatter.format(uiState.monthlyRevenue),
                        icon = Icons.Default.MonetizationOn,
                        gradientColors = listOf(Color(0xFF43e97b), Color(0xFF38f9d7)),
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        title = "Chưa thu",
                        value = currencyFormatter.format(uiState.totalUncollected),
                        icon = Icons.Default.Warning,
                        gradientColors = listOf(Color(0xFFf97316), Color(0xFFfbbf24)),
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        // === TOP DEBTORS (hide for teacher) ===
        if (uiState.currentUserRole != UserRole.TEACHER && uiState.topDebtors.isNotEmpty()) {
            item {
                SectionHeader(
                    icon = Icons.Default.TrendingDown,
                    title = "Nợ học phí nhiều nhất",
                    color = RedAccent
                )
            }
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        uiState.topDebtors.forEachIndexed { index, item ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                // Rank badge
                                Box(
                                    modifier = Modifier
                                        .size(28.dp)
                                        .clip(CircleShape)
                                        .background(
                                            when (index) {
                                                0 -> RedAccent
                                                1 -> OrangeAccent
                                                else -> Color(0xFF64748B)
                                            }
                                        ),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("${index + 1}", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(item.student.name, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = MaterialTheme.colorScheme.onBackground)
                                    Text(item.student.phone, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                Text(
                                    "-${currencyFormatter.format(item.debt)}",
                                    color = RedAccent,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp
                                )
                            }
                            if (index < uiState.topDebtors.lastIndex) {
                                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                            }
                        }
                    }
                }
            }
        }

        // === TOP ABSENT ===
        if (uiState.topAbsent.isNotEmpty()) {
            item {
                SectionHeader(
                    icon = Icons.Default.Person,
                    title = "Nghỉ không phép nhiều nhất (tháng)",
                    color = OrangeAccent
                )
            }
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        uiState.topAbsent.forEachIndexed { index, item ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(28.dp)
                                        .clip(CircleShape)
                                        .background(
                                            when (index) {
                                                0 -> OrangeAccent
                                                1 -> Color(0xFFFB923C)
                                                else -> Color(0xFF64748B)
                                            }
                                        ),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("${index + 1}", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Text(item.student.name, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = MaterialTheme.colorScheme.onBackground, modifier = Modifier.weight(1f))
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(RedAccent.copy(alpha = 0.1f))
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Text(
                                        "${item.absentCount} buổi",
                                        color = RedAccent,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp
                                    )
                                }
                            }
                            if (index < uiState.topAbsent.lastIndex) {
                                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                            }
                        }
                    }
                }
            }
        }
        // === TOP LATE ===
        if (uiState.topLate.isNotEmpty()) {
            item {
                SectionHeader(
                    icon = Icons.Default.Person,
                    title = "Đi muộn nhiều nhất (30 ngày)",
                    color = Color(0xFFF97316)
                )
            }
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        uiState.topLate.forEachIndexed { index, item ->
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier.size(28.dp).clip(CircleShape)
                                        .background(if (index == 0) Color(0xFFF97316) else Color(0xFF64748B)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("${index + 1}", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Text(item.student.name, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = MaterialTheme.colorScheme.onBackground, modifier = Modifier.weight(1f))
                                Box(
                                    modifier = Modifier.clip(RoundedCornerShape(8.dp))
                                        .background(OrangeAccent.copy(alpha = 0.1f))
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Text("${item.absentCount} buổi", color = OrangeAccent, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                }
                            }
                            if (index < uiState.topLate.lastIndex) {
                                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                            }
                        }
                    }
                }
            }
        }

        // === ANNOUNCEMENTS ===
        if (uiState.announcements.isNotEmpty()) {
            item {
                SectionHeader(
                    icon = Icons.Default.Campaign,
                    title = "Bảng tin",
                    color = PurpleAccent
                )
            }
            items(uiState.announcements) { announcement ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
                    shape = RoundedCornerShape(16.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            announcement.title,
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSecondaryContainer
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            announcement.content,
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color(0xFF6B7280),
                            maxLines = 3,
                            overflow = TextOverflow.Ellipsis
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "${announcement.createdBy} • ${announcement.createdAt.take(10)}",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFF9CA3AF)
                        )
                    }
                }
            }
        }

        // Bottom padding
        item { Spacer(modifier = Modifier.height(16.dp)) }
    }
    } // PullRefreshWrapper
}

@Composable
private fun SectionHeader(icon: ImageVector, title: String, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(24.dp))
        Spacer(modifier = Modifier.width(8.dp))
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onBackground)
    }
}

@Composable
fun StatCard(
    title: String,
    value: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    gradientColors: List<Color>
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Brush.linearGradient(colors = gradientColors))
                .padding(16.dp)
        ) {
            Column {
                Icon(icon, contentDescription = null, tint = Color.White.copy(alpha = 0.9f), modifier = Modifier.size(24.dp))
                Spacer(modifier = Modifier.height(10.dp))
                Text(title, style = MaterialTheme.typography.labelMedium, color = Color.White.copy(alpha = 0.95f))
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    value,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    fontSize = 20.sp
                )
            }
        }
    }
}

@Composable
private fun QuickAccessButton(
    label: String,
    icon: ImageVector,
    color: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        onClick = onClick
    ) {
        Column(
            modifier = Modifier.padding(vertical = 12.dp).fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier.size(36.dp).clip(CircleShape).background(color.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(20.dp))
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface, maxLines = 1)
        }
    }
}

