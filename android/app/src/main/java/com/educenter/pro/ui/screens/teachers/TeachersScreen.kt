package com.educenter.pro.ui.screens.teachers

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.educenter.pro.data.model.Teacher

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TeachersScreen(
    viewModel: TeachersViewModel = hiltViewModel()
) {
    val teachers by viewModel.teachers.collectAsState()
    var showAddDialog by remember { mutableStateOf(false) }
    var selectedForEdit by remember { mutableStateOf<Teacher?>(null) }
    var teacherToDelete by remember { mutableStateOf<Teacher?>(null) }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Giáo viên") }) },
        floatingActionButton = {
            FloatingActionButton(onClick = { showAddDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = "Thêm")
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(teachers) { teacher ->
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
                        Column {
                            Text(teacher.name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(teacher.phone, style = MaterialTheme.typography.bodyMedium)
                            Spacer(modifier = Modifier.height(2.dp))
                            Text("Môn: ${teacher.subject}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary)
                        }
                        Row {
                            IconButton(onClick = { selectedForEdit = teacher }) {
                                Icon(Icons.Default.Edit, contentDescription = "Sửa", tint = MaterialTheme.colorScheme.primary)
                            }
                            IconButton(onClick = { teacherToDelete = teacher }) {
                                Icon(Icons.Default.Delete, contentDescription = "Xóa", tint = MaterialTheme.colorScheme.error)
                            }
                        }
                    }
                }
            }
        }

        // Delete confirmation
        if (teacherToDelete != null) {
            AlertDialog(
                onDismissRequest = { teacherToDelete = null },
                title = { Text("Xác nhận xóa") },
                text = { Text("Bạn có chắc chắn muốn xóa giáo viên \"${teacherToDelete?.name}\"?") },
                confirmButton = {
                    Button(
                        onClick = {
                            teacherToDelete?.let { viewModel.deleteTeacher(it.id) }
                            teacherToDelete = null
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color.Red)
                    ) { Text("Xóa") }
                },
                dismissButton = {
                    TextButton(onClick = { teacherToDelete = null }) { Text("Hủy") }
                }
            )
        }

        if (showAddDialog) {
            AddOrEditTeacherDialog(
                teacher = null,
                onDismiss = { showAddDialog = false },
                onSave = { n, p, s -> viewModel.addTeacher(n, p, s); showAddDialog = false }
            )
        }

        if (selectedForEdit != null) {
            AddOrEditTeacherDialog(
                teacher = selectedForEdit,
                onDismiss = { selectedForEdit = null },
                onSave = { n, p, s ->
                    selectedForEdit?.let {
                        viewModel.updateTeacher(it.copy(name = n, phone = p, subject = s))
                    }
                    selectedForEdit = null
                }
            )
        }
    }
}

@Composable
fun AddOrEditTeacherDialog(
    teacher: Teacher?,
    onDismiss: () -> Unit,
    onSave: (String, String, String) -> Unit
) {
    var name by remember { mutableStateOf(teacher?.name ?: "") }
    var phone by remember { mutableStateOf(teacher?.phone ?: "") }
    var subject by remember { mutableStateOf(teacher?.subject ?: "") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (teacher == null) "Thêm Giáo viên" else "Sửa Giáo viên") },
        text = {
            Column {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Họ tên") })
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Số điện thoại") })
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = subject, onValueChange = { subject = it }, label = { Text("Môn dạy") })
            }
        },
        confirmButton = {
            Button(onClick = { if (name.isNotBlank()) onSave(name, phone, subject) }) { Text("Lưu") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Hủy") }
        }
    )
}
