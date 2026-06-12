@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package com.educenter.pro.ui.screens.teachers

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Person
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
import com.educenter.pro.data.model.Teacher
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TeachersScreen(
    viewModel: TeachersViewModel = hiltViewModel()
) {
    val teachers by viewModel.teachers.collectAsState()
    var showAddDialog by remember { mutableStateOf(false) }
    var selectedForEdit by remember { mutableStateOf<Teacher?>(null) }
    var teacherToDelete by remember { mutableStateOf<Teacher?>(null) }
    val fmt = NumberFormat.getCurrencyInstance(Locale("vi", "VN"))

    Scaffold(
        topBar = { TopAppBar(title = { Text("Giáo viên") }) },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddDialog = true },
                containerColor = Color(0xFF3B82F6)
            ) {
                Icon(Icons.Default.Add, contentDescription = "Thêm", tint = Color.White)
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(teachers) { teacher ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp).fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Avatar
                        Box(
                            modifier = Modifier.size(44.dp).clip(CircleShape)
                                .background(Color(0xFF3B82F6).copy(alpha = 0.15f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Person, contentDescription = null, tint = Color(0xFF3B82F6), modifier = Modifier.size(24.dp))
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(teacher.name, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onBackground)
                            Spacer(modifier = Modifier.height(2.dp))
                            Text("Môn: ${teacher.subject}", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            if (teacher.phone.isNotBlank()) {
                                val context = androidx.compose.ui.platform.LocalContext.current
                                Text(
                                    "📞 ${teacher.phone}",
                                    fontSize = 14.sp,
                                    color = Color(0xFF3B82F6),
                                    fontWeight = FontWeight.Medium,
                                    modifier = Modifier.clickable {
                                        val intent = android.content.Intent(android.content.Intent.ACTION_DIAL).apply {
                                            data = android.net.Uri.parse("tel:${teacher.phone}")
                                        }
                                        context.startActivity(intent)
                                    }
                                )
                            }
                            if (teacher.qualification.isNotBlank()) {
                                Text("Trình độ: ${teacher.qualification}", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            if (teacher.rate > 0) {
                                val salaryLabel = if (teacher.salaryType == "MONTHLY") "Lương tháng" else "Lương/buổi"
                                Text("$salaryLabel: ${fmt.format(teacher.rate)}", fontSize = 14.sp, color = Color(0xFF10B981), fontWeight = FontWeight.Medium)
                            }
                        }
                        Column {
                            IconButton(onClick = { selectedForEdit = teacher }, modifier = Modifier.size(32.dp)) {
                                Icon(Icons.Default.Edit, contentDescription = "Sửa", tint = Color(0xFF3B82F6), modifier = Modifier.size(18.dp))
                            }
                            IconButton(onClick = { teacherToDelete = teacher }, modifier = Modifier.size(32.dp)) {
                                Icon(Icons.Default.Delete, contentDescription = "Xóa", tint = Color(0xFFEF4444), modifier = Modifier.size(18.dp))
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
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                    ) { Text("Xóa") }
                },
                dismissButton = { TextButton(onClick = { teacherToDelete = null }) { Text("Hủy") } }
            )
        }

        if (showAddDialog) {
            AddOrEditTeacherDialog(
                teacher = null,
                onDismiss = { showAddDialog = false },
                onSave = { t -> viewModel.addTeacher(t); showAddDialog = false }
            )
        }

        if (selectedForEdit != null) {
            AddOrEditTeacherDialog(
                teacher = selectedForEdit,
                onDismiss = { selectedForEdit = null },
                onSave = { t ->
                    viewModel.updateTeacher(t)
                    selectedForEdit = null
                }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddOrEditTeacherDialog(
    teacher: Teacher?,
    onDismiss: () -> Unit,
    onSave: (Teacher) -> Unit
) {
    var name by remember { mutableStateOf(teacher?.name ?: "") }
    var phone by remember { mutableStateOf(teacher?.phone ?: "") }
    var subject by remember { mutableStateOf(teacher?.subject ?: "") }
    var email by remember { mutableStateOf(teacher?.email ?: "") }
    var address by remember { mutableStateOf(teacher?.address ?: "") }
    var dob by remember { mutableStateOf(teacher?.dob ?: "") }
    var qualification by remember { mutableStateOf(teacher?.qualification ?: "") }
    var gender by remember { mutableStateOf(teacher?.gender ?: "Khác") }
    var salaryType by remember { mutableStateOf(teacher?.salaryType ?: "PER_SESSION") }
    var rate by remember { mutableStateOf(if ((teacher?.rate ?: 0.0) > 0) teacher!!.rate.toLong().toString() else "") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (teacher == null) "Thêm Giáo viên" else "Sửa Giáo viên") },
        text = {
            LazyColumn(modifier = Modifier.heightIn(max = 400.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                item { OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Họ tên *") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
                item { OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Số điện thoại") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
                item { OutlinedTextField(value = subject, onValueChange = { subject = it }, label = { Text("Môn dạy") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
                item { OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Email") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
                item { OutlinedTextField(value = dob, onValueChange = { dob = it }, label = { Text("Ngày sinh (YYYY-MM-DD)") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
                item { OutlinedTextField(value = qualification, onValueChange = { qualification = it }, label = { Text("Trình độ") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
                item { OutlinedTextField(value = address, onValueChange = { address = it }, label = { Text("Địa chỉ") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
                item {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Giới tính: ", style = MaterialTheme.typography.bodyMedium)
                        Spacer(modifier = Modifier.width(8.dp))
                        listOf("Nam", "Nữ", "Khác").forEach { g ->
                            RadioButton(selected = gender == g, onClick = { gender = g })
                            Text(g, modifier = Modifier.padding(end = 8.dp))
                        }
                    }
                }
                item {
                    Text("Loại lương:", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                    Spacer(modifier = Modifier.height(4.dp))
                    Row {
                        listOf("PER_SESSION" to "Theo buổi", "MONTHLY" to "Theo tháng").forEach { (key, label) ->
                            FilterChip(
                                selected = salaryType == key,
                                onClick = { salaryType = key },
                                label = { Text(label, fontSize = 14.sp) },
                                modifier = Modifier.padding(end = 8.dp)
                            )
                        }
                    }
                }
                item { OutlinedTextField(value = rate, onValueChange = { rate = it.filter { c -> c.isDigit() } }, label = { Text("Mức lương (VNĐ)") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
            }
        },
        confirmButton = {
            Button(onClick = {
                if (name.isNotBlank()) {
                    val rateVal = rate.toDoubleOrNull() ?: 0.0
                    val result = (teacher ?: Teacher()).copy(
                        id = teacher?.id ?: java.util.UUID.randomUUID().toString(),
                        name = name, phone = phone, subject = subject,
                        email = email, address = address, dob = dob,
                        qualification = qualification, gender = gender,
                        salaryType = salaryType, rate = rateVal
                    )
                    onSave(result)
                }
            }) { Text("Lưu") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Hủy") } }
    )
}
