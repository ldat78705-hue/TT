package com.educenter.pro.ui.screens.classes

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.RemoveCircle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.educenter.pro.data.model.ClassModel
import com.educenter.pro.data.model.Student

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ClassesScreen(
    viewModel: ClassesViewModel = hiltViewModel()
) {
    val classes by viewModel.classes.collectAsState()
    val selectedClass by viewModel.selectedClass.collectAsState()
    val students by viewModel.selectedClassStudents.collectAsState()
    val availableStudents by viewModel.availableStudentsForClass.collectAsState()

    var showAddClassDialog by remember { mutableStateOf(false) }
    var showAddStudentDialog by remember { mutableStateOf(false) }

    if (selectedClass != null) {
        BackHandler { viewModel.clearSelection() }
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text(selectedClass?.name ?: "") },
                    navigationIcon = {
                        IconButton(onClick = { viewModel.clearSelection() }) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                        }
                    },
                    actions = {
                        IconButton(onClick = { showAddStudentDialog = true }) {
                            Icon(Icons.Default.PersonAdd, contentDescription = "Thêm học viên")
                        }
                    }
                )
            }
        ) { padding ->
            Column(modifier = Modifier.padding(padding).fillMaxSize()) {
                Text(
                    "Điểm danh & Quản lý",
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(16.dp)
                )
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(students) { student ->
                        StudentAttendanceRow(
                            student = student,
                            onMark = { status -> viewModel.markAttendance(student.id, status) },
                            onRemove = { viewModel.removeStudentFromClass(student.id) }
                        )
                    }
                }
            }
        }

        if (showAddStudentDialog) {
            AlertDialog(
                onDismissRequest = { showAddStudentDialog = false },
                title = { Text("Thêm Học viên vào Lớp") },
                text = {
                    LazyColumn(modifier = Modifier.heightIn(max = 300.dp)) {
                        items(availableStudents) { s ->
                            Text(
                                text = "${s.name} - ${s.phone}",
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        viewModel.addStudentToClass(s.id)
                                        showAddStudentDialog = false
                                    }
                                    .padding(16.dp)
                            )
                        }
                        if (availableStudents.isEmpty()) {
                            item { Text("Không có học viên nào khả dụng.") }
                        }
                    }
                },
                confirmButton = {
                    TextButton(onClick = { showAddStudentDialog = false }) { Text("Đóng") }
                }
            )
        }

    } else {
        Scaffold(
            floatingActionButton = {
                FloatingActionButton(onClick = { showAddClassDialog = true }) {
                    Icon(Icons.Default.Add, contentDescription = "Thêm Lớp")
                }
            }
        ) { padding ->
            Column(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
                Text("Danh sách Lớp học", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(16.dp))
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(classes) { classModel ->
                        Card(
                            modifier = Modifier.fillMaxWidth().clickable { viewModel.selectClass(classModel) },
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(classModel.name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                                Spacer(modifier = Modifier.height(4.dp))
                                Text("Môn: ${classModel.subject}", style = MaterialTheme.typography.bodyMedium)
                                Spacer(modifier = Modifier.height(4.dp))
                                Text("Sĩ số: ${classModel.studentIds.size} học sinh", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary)
                            }
                        }
                    }
                }
            }
        }

        if (showAddClassDialog) {
            var className by remember { mutableStateOf("") }
            var subject by remember { mutableStateOf("") }
            AlertDialog(
                onDismissRequest = { showAddClassDialog = false },
                title = { Text("Thêm Lớp Mới") },
                text = {
                    Column {
                        OutlinedTextField(value = className, onValueChange = { className = it }, label = { Text("Tên lớp") })
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(value = subject, onValueChange = { subject = it }, label = { Text("Môn học") })
                    }
                },
                confirmButton = {
                    Button(onClick = {
                        if (className.isNotBlank() && subject.isNotBlank()) {
                            viewModel.addClass(className, subject)
                            showAddClassDialog = false
                        }
                    }) { Text("Lưu") }
                },
                dismissButton = {
                    TextButton(onClick = { showAddClassDialog = false }) { Text("Hủy") }
                }
            )
        }
    }
}

@Composable
fun StudentAttendanceRow(student: Student, onMark: (String) -> Unit, onRemove: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(student.name, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                Spacer(modifier = Modifier.height(2.dp))
                Text(student.phone, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                IconButton(onClick = { onMark("PRESENT") }) {
                    Icon(Icons.Default.CheckCircle, contentDescription = "Có mặt", tint = Color(0xFF4CAF50))
                }
                IconButton(onClick = { onMark("ABSENT") }) {
                    Icon(Icons.Default.Cancel, contentDescription = "Vắng mặt", tint = Color(0xFFF44336))
                }
                IconButton(onClick = onRemove) {
                    Icon(Icons.Default.RemoveCircle, contentDescription = "Xóa khỏi lớp", tint = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}
