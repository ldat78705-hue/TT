package com.educenter.pro.ui.screens.reports

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReportsScreen(
    viewModel: ReportsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val classes by viewModel.classes.collectAsState()
    val fmt = NumberFormat.getCurrencyInstance(Locale("vi", "VN"))
    var expanded by remember { mutableStateOf(false) }

    val context = androidx.compose.ui.platform.LocalContext.current

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Báo cáo & Phân tích") },
                actions = {
                    IconButton(onClick = {
                        val report = buildString {
                            appendLine("📊 BÁO CÁO ${uiState.period.label.uppercase()}")
                            appendLine("━━━━━━━━━━━━━━━")
                            appendLine("💰 Doanh thu: ${fmt.format(uiState.totalRevenue)}")
                            appendLine("📈 Lợi nhuận: ${fmt.format(uiState.profit)}")
                            appendLine("💳 HP đã thu: ${fmt.format(uiState.tuitionCollected)}")
                            appendLine("⚠️ Nợ phải thu: ${fmt.format(uiState.totalReceivables)}")
                            appendLine("━━━━━━━━━━━━━━━")
                            appendLine("👨‍🎓 HS mới: ${uiState.newStudents}")
                            appendLine("❌ HS tạm nghỉ: ${uiState.inactiveStudents}")
                            appendLine("📋 Tổng buổi học: ${uiState.totalSessions}")
                            appendLine("✅ Chuyên cần: ${String.format("%.1f", uiState.attendanceRate)}%")
                            appendLine("━━━━━━━━━━━━━━━")
                            appendLine("📱 EduCenter Pro")
                        }
                        val intent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(android.content.Intent.EXTRA_SUBJECT, "Báo cáo ${uiState.period.label}")
                            putExtra(android.content.Intent.EXTRA_TEXT, report)
                        }
                        context.startActivity(android.content.Intent.createChooser(intent, "Chia sẻ báo cáo"))
                    }) {
                        Icon(Icons.Default.Share, contentDescription = "Chia sẻ", tint = Color(0xFF3B82F6))
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Period selector
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("this_month" to "Tháng này", "last_month" to "Tháng trước", "this_year" to "Năm nay").forEach { (key, label) ->
                        val isSelected = uiState.period.label == label
                        FilterChip(
                            selected = isSelected,
                            onClick = { viewModel.setPeriod(key) },
                            label = { Text(label, fontSize = 14.sp, fontWeight = FontWeight.Medium) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = Color(0xFF3B82F6),
                                selectedLabelColor = Color.White
                            )
                        )
                    }
                }
            }

            // Class filter
            item {
                ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
                    OutlinedTextField(
                        value = if (uiState.classFilter == "all") "Tất cả các lớp" else classes.find { it.id == uiState.classFilter }?.name ?: "",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Lọc theo lớp") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                        singleLine = true
                    )
                    ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                        DropdownMenuItem(text = { Text("Tất cả các lớp") }, onClick = { viewModel.setClassFilter("all"); expanded = false })
                        classes.forEach { cls ->
                            DropdownMenuItem(text = { Text(cls.name) }, onClick = { viewModel.setClassFilter(cls.id); expanded = false })
                        }
                    }
                }
            }

            // Finance KPIs
            item {
                Text("💰 Tài chính", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = MaterialTheme.colorScheme.onBackground)
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    KpiCard(
                        modifier = Modifier.weight(1f),
                        title = "Doanh thu",
                        value = fmt.format(uiState.totalRevenue),
                        gradient = listOf(Color(0xFF10B981), Color(0xFF059669)),
                        icon = Icons.Default.TrendingUp
                    )
                    KpiCard(
                        modifier = Modifier.weight(1f),
                        title = "Lợi nhuận",
                        value = fmt.format(uiState.profit),
                        gradient = if (uiState.profit >= 0) listOf(Color(0xFF3B82F6), Color(0xFF2563EB)) else listOf(Color(0xFFEF4444), Color(0xFFDC2626)),
                        icon = if (uiState.profit >= 0) Icons.Default.TrendingUp else Icons.Default.TrendingDown
                    )
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    KpiCard(
                        modifier = Modifier.weight(1f),
                        title = "HP đã thu",
                        value = fmt.format(uiState.tuitionCollected),
                        gradient = listOf(Color(0xFF8B5CF6), Color(0xFF7C3AED)),
                        icon = Icons.Default.Payments
                    )
                    KpiCard(
                        modifier = Modifier.weight(1f),
                        title = "Nợ phải thu",
                        value = fmt.format(uiState.totalReceivables),
                        gradient = listOf(Color(0xFFEF4444), Color(0xFFDC2626)),
                        icon = Icons.Default.Warning
                    )
                }
            }

            // Student KPIs
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Text("👨‍🎓 Học viên", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = MaterialTheme.colorScheme.onBackground)
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    InfoCard(
                        modifier = Modifier.weight(1f),
                        title = "HS mới trong kỳ",
                        value = "${uiState.newStudents}",
                        color = Color(0xFF10B981)
                    )
                    InfoCard(
                        modifier = Modifier.weight(1f),
                        title = "HS tạm nghỉ",
                        value = "${uiState.inactiveStudents}",
                        color = Color(0xFFEF4444)
                    )
                }
            }

            // Attendance KPIs
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Text("📋 Chuyên cần", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = MaterialTheme.colorScheme.onBackground)
            }
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Tỉ lệ chuyên cần", fontWeight = FontWeight.Bold)
                            Text("${String.format("%.1f", uiState.attendanceRate)}%", fontWeight = FontWeight.ExtraBold, color = Color(0xFF3B82F6), fontSize = 20.sp)
                        }
                        Spacer(modifier = Modifier.height(12.dp))

                        // Progress bar
                        LinearProgressIndicator(
                            progress = { (uiState.attendanceRate / 100).toFloat().coerceIn(0f, 1f) },
                            modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                            color = Color(0xFF3B82F6),
                            trackColor = Color(0xFFE2E8F0)
                        )

                        Spacer(modifier = Modifier.height(16.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            AttendanceStat("Có mặt", uiState.presentCount, Color(0xFF10B981))
                            AttendanceStat("Đi muộn", uiState.lateCount, Color(0xFFF59E0B))
                            AttendanceStat("Vắng", uiState.absentCount, Color(0xFFEF4444))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun KpiCard(
    modifier: Modifier = Modifier,
    title: String,
    value: String,
    gradient: List<Color>,
    icon: ImageVector
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Brush.linearGradient(gradient))
                .padding(16.dp)
        ) {
            Column {
                Icon(icon, contentDescription = null, tint = Color.White.copy(alpha = 0.8f), modifier = Modifier.size(24.dp))
                Spacer(modifier = Modifier.height(8.dp))
                Text(title, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                Spacer(modifier = Modifier.height(4.dp))
                Text(value, color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, maxLines = 1)
            }
        }
    }
}

@Composable
private fun InfoCard(modifier: Modifier = Modifier, title: String, value: String, color: Color) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(title, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, fontWeight = FontWeight.Medium)
            Spacer(modifier = Modifier.height(8.dp))
            Text(value, fontWeight = FontWeight.ExtraBold, fontSize = 28.sp, color = color)
        }
    }
}

@Composable
private fun AttendanceStat(label: String, count: Int, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text("$count", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = color)
        Text(label, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, fontWeight = FontWeight.Medium)
    }
}
