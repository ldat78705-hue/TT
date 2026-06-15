@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package com.educenter.pro.ui.screens.progress

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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.educenter.pro.ui.components.PullRefreshWrapper
import com.educenter.pro.data.model.ClassModel
import com.educenter.pro.data.model.Student
import com.educenter.pro.data.model.UserRole

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProgressReportScreen(
    onBack: () -> Unit,
    viewModel: ProgressReportViewModel = hiltViewModel()
) {
    val currentUserRole by viewModel.currentUserRole.collectAsState()
    val classes by viewModel.classes.collectAsState()
    val students by viewModel.students.collectAsState()
    val reports by viewModel.filteredReports.collectAsState()
    val selectedClassId by viewModel.selectedClassId.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()

    val canAdd = currentUserRole == UserRole.ADMIN || currentUserRole == UserRole.MANAGER || currentUserRole == UserRole.TEACHER

    var showAddDialog by remember { mutableStateOf(false) }
    var reportToDelete by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Nhận xét Học viên") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Quay lại")
                    }
                }
            )
        },
        floatingActionButton = {
            if (canAdd) {
                FloatingActionButton(
                    onClick = { showAddDialog = true },
                    containerColor = Color(0xFF3B82F6)
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Thêm nhận xét", tint = Color.White)
                }
            }
        }
    ) { padding ->
        PullRefreshWrapper(
            isRefreshing = isRefreshing,
            onRefresh = { viewModel.refresh() },
            modifier = Modifier.fillMaxSize().padding(padding)
        ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp)
        ) {
            // Class filter
            Spacer(modifier = Modifier.height(8.dp))
            Text("Lọc theo lớp:", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(modifier = Modifier.height(6.dp))
            LazyColumn(modifier = Modifier.heightIn(max = 50.dp)) {
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterChip(
                            selected = selectedClassId == null,
                            onClick = { viewModel.selectClass(null) },
                            label = { Text("Tất cả", fontSize = 12.sp) }
                        )
                        classes.take(5).forEach { cls ->
                            FilterChip(
                                selected = selectedClassId == cls.id,
                                onClick = { viewModel.selectClass(cls.id) },
                                label = { Text(cls.name, fontSize = 12.sp) }
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            Text("${reports.size} nhận xét", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(modifier = Modifier.height(8.dp))

            if (reports.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("📝", fontSize = 48.sp)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Chưa có nhận xét nào", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (canAdd) {
                            Text("Nhấn + để thêm nhận xét", fontSize = 13.sp, color = Color(0xFF94A3B8))
                        }
                    }
                }
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(reports) { report ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            elevation = CardDefaults.cardElevation(2.dp)
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            viewModel.getStudentName(report.studentId),
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 15.sp,
                                            color = Color(0xFF3B82F6)
                                        )
                                        Text(
                                            "Lớp: ${viewModel.getClassName(report.classId)}",
                                            fontSize = 12.sp,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                    Column(horizontalAlignment = Alignment.End) {
                                        if (report.score != null) {
                                            val scoreColor = when {
                                                report.score >= 8 -> Color(0xFF10B981)
                                                report.score >= 6 -> Color(0xFFF59E0B)
                                                else -> Color(0xFFEF4444)
                                            }
                                            Box(
                                                modifier = Modifier
                                                    .size(36.dp)
                                                    .clip(CircleShape)
                                                    .background(scoreColor.copy(alpha = 0.15f)),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Text(
                                                    "${report.score.toInt()}",
                                                    fontWeight = FontWeight.ExtraBold,
                                                    fontSize = 14.sp,
                                                    color = scoreColor
                                                )
                                            }
                                        }
                                        if (canAdd) {
                                            IconButton(
                                                onClick = { reportToDelete = report.id },
                                                modifier = Modifier.size(28.dp)
                                            ) {
                                                Icon(Icons.Default.Delete, contentDescription = "Xóa", tint = Color(0xFFEF4444), modifier = Modifier.size(16.dp))
                                            }
                                        }
                                    }
                                }
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(report.comments, fontSize = 14.sp, color = MaterialTheme.colorScheme.onBackground, lineHeight = 20.sp)
                                Spacer(modifier = Modifier.height(6.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(report.date, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    Text("Bởi: ${report.createdBy}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }
                }
            }
        }
        } // PullRefreshWrapper

        // Delete confirmation
        if (reportToDelete != null) {
            AlertDialog(
                onDismissRequest = { reportToDelete = null },
                title = { Text("Xóa nhận xét?") },
                text = { Text("Bạn có chắc muốn xóa nhận xét này?") },
                confirmButton = {
                    Button(
                        onClick = {
                            reportToDelete?.let { viewModel.deleteReport(it) }
                            reportToDelete = null
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                    ) { Text("Xóa") }
                },
                dismissButton = { TextButton(onClick = { reportToDelete = null }) { Text("Hủy") } }
            )
        }

        // Add dialog
        if (showAddDialog) {
            AddProgressReportDialog(
                classes = classes,
                students = students,
                onDismiss = { showAddDialog = false },
                onSave = { classId, studentId, score, comments ->
                    val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault()).format(java.util.Date())
                    viewModel.addReport(classId, studentId, today, score, comments)
                    showAddDialog = false
                }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddProgressReportDialog(
    classes: List<ClassModel>,
    students: List<Student>,
    onDismiss: () -> Unit,
    onSave: (classId: String, studentId: String, score: Double?, comments: String) -> Unit
) {
    var selectedClassId by remember { mutableStateOf(classes.firstOrNull()?.id ?: "") }
    var selectedStudentId by remember { mutableStateOf("") }
    var scoreText by remember { mutableStateOf("") }
    var comments by remember { mutableStateOf("") }

    val classStudents = remember(selectedClassId, students, classes) {
        val cls = classes.find { it.id == selectedClassId }
        if (cls != null) students.filter { it.id in cls.studentIds }
        else emptyList()
    }

    // Auto-select first student when class changes
    LaunchedEffect(selectedClassId) {
        val cls = classes.find { it.id == selectedClassId }
        if (cls != null) {
            val available = students.filter { it.id in cls.studentIds }
            selectedStudentId = available.firstOrNull()?.id ?: ""
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("📝 Thêm Nhận xét", fontWeight = FontWeight.Bold) },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                // Class dropdown
                item {
                    Text("Lớp:", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(4.dp))
                    var expanded by remember { mutableStateOf(false) }
                    ExposedDropdownMenuBox(
                        expanded = expanded,
                        onExpandedChange = { expanded = !expanded }
                    ) {
                        OutlinedTextField(
                            value = classes.find { it.id == selectedClassId }?.name ?: "Chọn lớp",
                            onValueChange = {},
                            readOnly = true,
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
                            modifier = Modifier.menuAnchor().fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp),
                            textStyle = androidx.compose.ui.text.TextStyle(fontSize = 14.sp)
                        )
                        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                            classes.forEach { cls ->
                                DropdownMenuItem(
                                    text = { Text("${cls.name} (${cls.subject})") },
                                    onClick = {
                                        selectedClassId = cls.id
                                        expanded = false
                                    }
                                )
                            }
                        }
                    }
                }

                // Student dropdown
                item {
                    Text("Học viên:", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(4.dp))
                    var expanded2 by remember { mutableStateOf(false) }
                    ExposedDropdownMenuBox(
                        expanded = expanded2,
                        onExpandedChange = { expanded2 = !expanded2 }
                    ) {
                        OutlinedTextField(
                            value = classStudents.find { it.id == selectedStudentId }?.name ?: "Chọn học viên",
                            onValueChange = {},
                            readOnly = true,
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded2) },
                            modifier = Modifier.menuAnchor().fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp),
                            textStyle = androidx.compose.ui.text.TextStyle(fontSize = 14.sp)
                        )
                        ExposedDropdownMenu(expanded = expanded2, onDismissRequest = { expanded2 = false }) {
                            classStudents.forEach { s ->
                                DropdownMenuItem(
                                    text = { Text(s.name) },
                                    onClick = {
                                        selectedStudentId = s.id
                                        expanded2 = false
                                    }
                                )
                            }
                        }
                    }
                }

                // Score
                item {
                    OutlinedTextField(
                        value = scoreText,
                        onValueChange = { scoreText = it.filter { c -> c.isDigit() || c == '.' } },
                        label = { Text("Điểm (0-10, không bắt buộc)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Number)
                    )
                }

                // Comments
                item {
                    OutlinedTextField(
                        value = comments,
                        onValueChange = { comments = it },
                        label = { Text("Nhận xét *") },
                        modifier = Modifier.fillMaxWidth().height(120.dp),
                        maxLines = 5,
                        shape = RoundedCornerShape(10.dp)
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (selectedClassId.isNotBlank() && selectedStudentId.isNotBlank() && comments.isNotBlank()) {
                        val score = scoreText.toDoubleOrNull()
                        onSave(selectedClassId, selectedStudentId, score, comments)
                    }
                },
                enabled = selectedStudentId.isNotBlank() && comments.isNotBlank(),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF3B82F6))
            ) { Text("Lưu", fontWeight = FontWeight.Bold) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Hủy") } }
    )
}
