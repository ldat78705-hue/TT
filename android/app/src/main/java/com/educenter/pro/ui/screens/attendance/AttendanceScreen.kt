package com.educenter.pro.ui.screens.attendance

import android.content.Intent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel

// Premium color palette
private val GreenPresent = Color(0xFF10B981)
private val GreenPresentLight = Color(0xFFD1FAE5)
private val YellowLate = Color(0xFFF59E0B)
private val YellowLateLight = Color(0xFFFEF3C7)
private val BluePerm = Color(0xFF0EA5E9)
private val BluePermLight = Color(0xFFE0F2FE)
private val RedAbsent = Color(0xFFEF4444)
private val RedAbsentLight = Color(0xFFFEE2E2)
private val GrayUnmarked = Color(0xFF9CA3AF)
private val SurfaceCard = Color(0xFFFAFAFA)
private val PrimaryBlue = Color(0xFF3B82F6)

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun AttendanceScreen(
    viewModel: AttendanceViewModel = hiltViewModel()
) {
    val classes by viewModel.classes.collectAsState()
    val scheduledClasses by viewModel.scheduledClasses.collectAsState()
    val selectedClassId by viewModel.selectedClassId.collectAsState()
    val selectedDate by viewModel.selectedDate.collectAsState()
    val students by viewModel.studentsInClass.collectAsState()
    val attendanceMap by viewModel.attendanceMap.collectAsState()
    val monthlyCounts by viewModel.monthlyAttendanceCounts.collectAsState()
    val isSaving by viewModel.isSaving.collectAsState()
    val saveSuccess by viewModel.saveSuccess.collectAsState()
    val pendingOpsCount by viewModel.pendingOpsCount.collectAsState()
    val context = androidx.compose.ui.platform.LocalContext.current

    val selectedClassName = classes.find { it.id == selectedClassId }?.name ?: ""

    // Handle save result
    LaunchedEffect(saveSuccess) {
        if (saveSuccess != null) {
            kotlinx.coroutines.delay(2000)
            viewModel.clearSaveResult()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            if (selectedClassId == null) "Điểm danh" else selectedClassName,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        if (selectedClassId != null) {
                            Text(
                                "Ngày: ${formatDateVN(selectedDate)}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                },
                navigationIcon = {
                    if (selectedClassId != null) {
                        IconButton(onClick = { viewModel.selectClass("") }) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Trở về")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { padding ->
        if (selectedClassId == null) {
            // ===== SCHEDULE VIEW =====
            ScheduleView(
                modifier = Modifier.padding(padding),
                selectedDate = selectedDate,
                scheduledClasses = scheduledClasses,
                onDateChange = { viewModel.selectDate(it) },
                onClassClick = { viewModel.selectClass(it) }
            )
        } else {
            // ===== ATTENDANCE VIEW =====
            Box(modifier = Modifier.fillMaxSize().padding(padding)) {
                if (students.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("📋", fontSize = 48.sp)
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                "Lớp này chưa có học viên",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodyLarge
                            )
                        }
                    }
                } else {
                    Column(modifier = Modifier.fillMaxSize()) {
                        // Student list with attendance buttons
                        LazyColumn(
                            modifier = Modifier.weight(1f),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            // Quick actions header
                            item {
                                QuickActionsCard(
                                    onBulkChange = { viewModel.setAllStatus(it) },
                                    onReset = { viewModel.setAllStatus("UNMARKED") }
                                )
                            }

                            // Summary bar
                            item {
                                AttendanceSummaryBar(
                                    attendanceMap = attendanceMap,
                                    totalStudents = students.size
                                )
                            }

                            // Student cards
                            itemsIndexed(students) { index, student ->
                                val entry = attendanceMap[student.id] ?: AttendanceEntry()
                                val monthCount = monthlyCounts[student.id] ?: 0

                                StudentAttendanceCard(
                                    index = index + 1,
                                    studentName = student.name,
                                    monthlyCount = monthCount,
                                    entry = entry,
                                    onStatusChange = { status ->
                                        viewModel.setStudentStatus(student.id, status)
                                    }
                                )
                            }

                            // Bottom spacing for save button
                            item { Spacer(modifier = Modifier.height(80.dp)) }
                        }

                        // Save button bar - fixed at bottom
                        SaveButtonBar(
                            isSaving = isSaving,
                            saveSuccess = saveSuccess,
                            pendingCount = pendingOpsCount,
                            hasMarkedStudents = attendanceMap.any { it.value.status != "UNMARKED" },
                            onSave = { viewModel.saveAttendance() },
                            onDelete = { viewModel.deleteAttendance() },
                            onShare = {
                                val report = viewModel.buildAbsenceReport()
                                if (report != null) {
                                    val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                        type = "text/plain"
                                        putExtra(Intent.EXTRA_TEXT, report)
                                    }
                                    context.startActivity(Intent.createChooser(shareIntent, "Gửi thông báo vắng qua..."))
                                }
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ScheduleView(
    modifier: Modifier = Modifier,
    selectedDate: String,
    scheduledClasses: List<com.educenter.pro.data.model.ClassModel>,
    onDateChange: (String) -> Unit,
    onClassClick: (String) -> Unit
) {
    Column(modifier = modifier.fillMaxSize().padding(16.dp)) {
        // Date selector card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFFF0F7FF)),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.DateRange, contentDescription = null, tint = PrimaryBlue)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Chọn ngày điểm danh", fontWeight = FontWeight.SemiBold, color = PrimaryBlue)
                }
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = selectedDate,
                    onValueChange = onDateChange,
                    label = { Text("Ngày (YYYY-MM-DD)") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true
                )
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        Text(
            "Lịch học ngày ${formatDateVN(selectedDate)}",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(12.dp))

        if (scheduledClasses.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("📅", fontSize = 48.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "Không có lịch học vào ngày này",
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(scheduledClasses) { cls ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onClassClick(cls.id) },
                        shape = RoundedCornerShape(16.dp),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    cls.name,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    "Sĩ số: ${cls.studentIds.size} học viên",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Button(
                                onClick = { onClassClick(cls.id) },
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                            ) {
                                Text("Điểm danh", fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun QuickActionsCard(
    onBulkChange: (String) -> Unit,
    onReset: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF0F7FF)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                "⚡ Thao tác nhanh",
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                color = PrimaryBlue
            )
            Spacer(modifier = Modifier.height(8.dp))
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                QuickActionChip("✓ Tất cả có mặt", GreenPresent) { onBulkChange("PRESENT") }
                QuickActionChip("⏰ Tất cả đi muộn", YellowLate) { onBulkChange("LATE") }
                QuickActionChip("📋 Tất cả có phép", BluePerm) { onBulkChange("ABSENT") }
                QuickActionChip("✗ Tất cả không phép", RedAbsent) { onBulkChange("UNEXCUSED_ABSENT") }
                QuickActionChip("🗑 Xóa tất cả", GrayUnmarked) { onReset() }
            }
        }
    }
}

@Composable
private fun QuickActionChip(
    label: String,
    color: Color,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        shape = RoundedCornerShape(20.dp),
        colors = ButtonDefaults.buttonColors(containerColor = color),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 2.dp)
    ) {
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = Color.White)
    }
}

@Composable
private fun AttendanceSummaryBar(
    attendanceMap: Map<String, AttendanceEntry>,
    totalStudents: Int
) {
    val presentCount = attendanceMap.count { it.value.status == "PRESENT" }
    val lateCount = attendanceMap.count { it.value.status == "LATE" }
    val absentCount = attendanceMap.count { it.value.status == "ABSENT" }
    val unexcusedCount = attendanceMap.count { it.value.status == "UNEXCUSED_ABSENT" }
    val unmarkedCount = attendanceMap.count { it.value.status == "UNMARKED" }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            SummaryBadge("Có mặt", presentCount, GreenPresent)
            SummaryBadge("Trễ", lateCount, YellowLate)
            SummaryBadge("Có phép", absentCount, BluePerm)
            SummaryBadge("K.phép", unexcusedCount, RedAbsent)
            SummaryBadge("Chưa", unmarkedCount, GrayUnmarked)
        }
    }
}

@Composable
private fun SummaryBadge(label: String, count: Int, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(CircleShape)
                .background(color.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                "$count",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = color
            )
        }
        Spacer(modifier = Modifier.height(2.dp))
        Text(label, fontSize = 10.sp, color = Color.Gray)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StudentAttendanceCard(
    index: Int,
    studentName: String,
    monthlyCount: Int,
    entry: AttendanceEntry,
    onStatusChange: (String) -> Unit
) {
    val borderColor by animateColorAsState(
        targetValue = when (entry.status) {
            "PRESENT" -> GreenPresent.copy(alpha = 0.5f)
            "LATE" -> YellowLate.copy(alpha = 0.5f)
            "ABSENT" -> BluePerm.copy(alpha = 0.5f)
            "UNEXCUSED_ABSENT" -> RedAbsent.copy(alpha = 0.5f)
            else -> Color.Transparent
        },
        animationSpec = tween(300),
        label = "borderColor"
    )

    val bgColor by animateColorAsState(
        targetValue = when (entry.status) {
            "PRESENT" -> GreenPresentLight.copy(alpha = 0.3f)
            "LATE" -> YellowLateLight.copy(alpha = 0.3f)
            "ABSENT" -> BluePermLight.copy(alpha = 0.3f)
            "UNEXCUSED_ABSENT" -> RedAbsentLight.copy(alpha = 0.3f)
            else -> Color.White
        },
        animationSpec = tween(300),
        label = "bgColor"
    )

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = if (entry.status != "UNMARKED") 1.5.dp else 0.dp,
                color = borderColor,
                shape = RoundedCornerShape(16.dp)
            ),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = bgColor),
        elevation = CardDefaults.cardElevation(defaultElevation = if (entry.status == "UNMARKED") 1.dp else 0.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
            // Student info row
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Number badge
                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(PrimaryBlue.copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center
                ) {
                    Text("$index", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = PrimaryBlue)
                }
                Spacer(modifier = Modifier.width(10.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        studentName,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        // Monthly count badge
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(PrimaryBlue.copy(alpha = 0.1f))
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                "Tháng: ${monthlyCount} buổi",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = PrimaryBlue
                            )
                        }

                        if (entry.status == "UNMARKED") {
                            Spacer(modifier = Modifier.width(6.dp))
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(GrayUnmarked.copy(alpha = 0.15f))
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text("Chưa ĐD", fontSize = 10.sp, color = GrayUnmarked, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Status buttons row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                StatusButton(
                    label = "Có mặt",
                    isSelected = entry.status == "PRESENT",
                    activeColor = GreenPresent,
                    activeBgColor = GreenPresentLight,
                    onClick = { onStatusChange("PRESENT") },
                    modifier = Modifier.weight(1f)
                )
                StatusButton(
                    label = "Trễ",
                    isSelected = entry.status == "LATE",
                    activeColor = YellowLate,
                    activeBgColor = YellowLateLight,
                    onClick = { onStatusChange("LATE") },
                    modifier = Modifier.weight(1f)
                )
                StatusButton(
                    label = "Có phép",
                    isSelected = entry.status == "ABSENT",
                    activeColor = BluePerm,
                    activeBgColor = BluePermLight,
                    onClick = { onStatusChange("ABSENT") },
                    modifier = Modifier.weight(1f)
                )
                StatusButton(
                    label = "K.phép",
                    isSelected = entry.status == "UNEXCUSED_ABSENT",
                    activeColor = RedAbsent,
                    activeBgColor = RedAbsentLight,
                    onClick = { onStatusChange("UNEXCUSED_ABSENT") },
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
private fun StatusButton(
    label: String,
    isSelected: Boolean,
    activeColor: Color,
    activeBgColor: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val bgColor by animateColorAsState(
        targetValue = if (isSelected) activeColor else Color(0xFFF3F4F6),
        animationSpec = tween(200),
        label = "statusBg"
    )
    val textColor by animateColorAsState(
        targetValue = if (isSelected) Color.White else Color(0xFF6B7280),
        animationSpec = tween(200),
        label = "statusText"
    )

    Button(
        onClick = onClick,
        modifier = modifier.height(36.dp),
        shape = RoundedCornerShape(10.dp),
        colors = ButtonDefaults.buttonColors(containerColor = bgColor),
        contentPadding = PaddingValues(horizontal = 4.dp, vertical = 0.dp),
        elevation = ButtonDefaults.buttonElevation(
            defaultElevation = if (isSelected) 3.dp else 0.dp
        )
    ) {
        Text(
            label,
            color = textColor,
            fontSize = 11.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
            maxLines = 1,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
private fun SaveButtonBar(
    isSaving: Boolean,
    saveSuccess: Boolean?,
    pendingCount: Int,
    hasMarkedStudents: Boolean,
    onSave: () -> Unit,
    onDelete: () -> Unit,
    onShare: () -> Unit
) {
    var showDeleteConfirm by remember { mutableStateOf(false) }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shadowElevation = 12.dp,
        color = Color.White
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Status indicator
            Column(modifier = Modifier.weight(1f)) {
                if (saveSuccess != null) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (saveSuccess == true) {
                            Icon(Icons.Default.Check, contentDescription = null, tint = GreenPresent, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(3.dp))
                            Text("Đã lưu!", color = GreenPresent, fontWeight = FontWeight.SemiBold, fontSize = 11.sp)
                        } else {
                            Icon(Icons.Default.Close, contentDescription = null, tint = RedAbsent, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(3.dp))
                            Text("Lỗi!", color = RedAbsent, fontWeight = FontWeight.SemiBold, fontSize = 11.sp)
                        }
                    }
                }
                if (pendingCount > 0) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(7.dp)
                                .clip(CircleShape)
                                .background(Color(0xFFF59E0B))
                        )
                        Spacer(modifier = Modifier.width(3.dp))
                        Text("$pendingCount chờ đồng bộ", fontSize = 10.sp, color = Color(0xFFF59E0B), fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            // Delete button
            if (hasMarkedStudents) {
                IconButton(
                    onClick = { showDeleteConfirm = true },
                    modifier = Modifier.size(40.dp)
                ) {
                    Icon(
                        Icons.Default.Close,
                        contentDescription = "Xóa điểm danh",
                        tint = RedAbsent,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            // Share button
            if (saveSuccess == true) {
                OutlinedButton(
                    onClick = onShare,
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, PrimaryBlue)
                ) {
                    Text("📤 Gửi TB", fontSize = 11.sp, color = PrimaryBlue, fontWeight = FontWeight.SemiBold)
                }
            }

            // Save button with gradient
            Button(
                onClick = onSave,
                enabled = !isSaving,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                contentPadding = PaddingValues(),
                elevation = ButtonDefaults.buttonElevation(defaultElevation = 4.dp)
            ) {
                Box(
                    modifier = Modifier
                        .background(
                            Brush.horizontalGradient(listOf(Color(0xFF667EEA), Color(0xFF764BA2))),
                            RoundedCornerShape(14.dp)
                        )
                        .padding(horizontal = 20.dp, vertical = 12.dp),
                    contentAlignment = Alignment.Center
                ) {
                    if (isSaving) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Đang lưu...", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color.White)
                        }
                    } else {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp), tint = Color.White)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Lưu điểm danh", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color.White)
                        }
                    }
                }
            }
        }
    }

    // Delete confirmation dialog
    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Xóa điểm danh?", fontWeight = FontWeight.Bold) },
            text = { Text("Xóa toàn bộ dữ liệu điểm danh đã lưu cho lớp này vào ngày hôm nay. Thao tác này không thể hoàn tác.") },
            confirmButton = {
                Button(
                    onClick = { showDeleteConfirm = false; onDelete() },
                    colors = ButtonDefaults.buttonColors(containerColor = RedAbsent)
                ) {
                    Text("Xóa", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) {
                    Text("Hủy")
                }
            }
        )
    }
}

private fun formatDateVN(dateStr: String): String {
    return try {
        val date = java.time.LocalDate.parse(dateStr)
        val dayOfWeek = when (date.dayOfWeek) {
            java.time.DayOfWeek.MONDAY -> "Thứ 2"
            java.time.DayOfWeek.TUESDAY -> "Thứ 3"
            java.time.DayOfWeek.WEDNESDAY -> "Thứ 4"
            java.time.DayOfWeek.THURSDAY -> "Thứ 5"
            java.time.DayOfWeek.FRIDAY -> "Thứ 6"
            java.time.DayOfWeek.SATURDAY -> "Thứ 7"
            java.time.DayOfWeek.SUNDAY -> "Chủ nhật"
            else -> ""
        }
        "$dayOfWeek, ${date.dayOfMonth}/${date.monthValue}/${date.year}"
    } catch (e: Exception) {
        dateStr
    }
}
