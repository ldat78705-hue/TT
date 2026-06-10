package com.educenter.pro.ui.screens.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Campaign
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
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("vi", "VN"))

    if (uiState.isLoading) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
        }
        return
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF8FAFC))
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
                color = Color(0xFF1E293B)
            )
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
                QuickAccessButton(
                    label = "Thông báo",
                    icon = Icons.Default.Campaign,
                    color = Color(0xFFF59E0B),
                    onClick = onNavigateToAnnouncements,
                    modifier = Modifier.weight(1f)
                )
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
                    value = uiState.totalClasses.toString(),
                    icon = Icons.Default.Class,
                    gradientColors = listOf(Color(0xFFf093fb), Color(0xFFf5576c)),
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // === STAT CARDS ROW 2 ===
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

        // === TOP DEBTORS ===
        if (uiState.topDebtors.isNotEmpty()) {
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
                    colors = CardDefaults.cardColors(containerColor = Color.White),
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
                                                else -> Color(0xFF94A3B8)
                                            }
                                        ),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("${index + 1}", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(item.student.name, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                                    Text(item.student.phone, fontSize = 12.sp, color = Color.Gray)
                                }
                                Text(
                                    "-${currencyFormatter.format(item.debt)}",
                                    color = RedAccent,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp
                                )
                            }
                            if (index < uiState.topDebtors.lastIndex) {
                                HorizontalDivider(color = Color(0xFFF1F5F9))
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
                    colors = CardDefaults.cardColors(containerColor = Color.White),
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
                                                else -> Color(0xFF94A3B8)
                                            }
                                        ),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("${index + 1}", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Text(item.student.name, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, modifier = Modifier.weight(1f))
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
                                        fontSize = 12.sp
                                    )
                                }
                            }
                            if (index < uiState.topAbsent.lastIndex) {
                                HorizontalDivider(color = Color(0xFFF1F5F9))
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
                    colors = CardDefaults.cardColors(containerColor = Color.White),
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
                                        .background(if (index == 0) Color(0xFFF97316) else Color(0xFF94A3B8)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("${index + 1}", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Text(item.student.name, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, modifier = Modifier.weight(1f))
                                Box(
                                    modifier = Modifier.clip(RoundedCornerShape(8.dp))
                                        .background(OrangeAccent.copy(alpha = 0.1f))
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Text("${item.absentCount} buổi", color = OrangeAccent, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                }
                            }
                            if (index < uiState.topLate.lastIndex) {
                                HorizontalDivider(color = Color(0xFFF1F5F9))
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
                title = "Lịch học hôm nay",
                color = BlueAccent
            )
        }

        if (uiState.todayClasses.isEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("Không có lịch học nào hôm nay 🎉", color = Color.Gray)
                    }
                }
            }
        } else {
            items(uiState.todayClasses) { classModel ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
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
                            Text(classModel.name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                "Môn: ${classModel.subject} • ${classModel.studentIds.size} học viên",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color.Gray
                            )
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
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFF5F3FF)),
                    shape = RoundedCornerShape(16.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            announcement.title,
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.titleMedium,
                            color = Color(0xFF4C1D95)
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
}

@Composable
private fun SectionHeader(icon: ImageVector, title: String, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(24.dp))
        Spacer(modifier = Modifier.width(8.dp))
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color(0xFF1E293B))
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
                Icon(icon, contentDescription = null, tint = Color.White.copy(alpha = 0.8f), modifier = Modifier.size(22.dp))
                Spacer(modifier = Modifier.height(12.dp))
                Text(title, style = MaterialTheme.typography.labelMedium, color = Color.White.copy(alpha = 0.9f))
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    value,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
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
        colors = CardDefaults.cardColors(containerColor = Color.White),
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
            Text(label, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFF475569), maxLines = 1)
        }
    }
}

