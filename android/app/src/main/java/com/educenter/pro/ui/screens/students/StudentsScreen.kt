package com.educenter.pro.ui.screens.students

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.educenter.pro.data.model.Student
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StudentsScreen(
    viewModel: StudentsViewModel = hiltViewModel()
) {
    val students by viewModel.filteredStudents.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val currentUserRole by viewModel.currentUserRole.collectAsState()
    
    val canManage = currentUserRole == com.educenter.pro.data.model.UserRole.ADMIN || currentUserRole == com.educenter.pro.data.model.UserRole.MANAGER
    val canCollectFee = canManage || currentUserRole == com.educenter.pro.data.model.UserRole.ACCOUNTANT
    
    var showAddDialog by remember { mutableStateOf(false) }
    var selectedStudentForFee by remember { mutableStateOf<Student?>(null) }
    var feeAmountText by remember { mutableStateOf("") }
    
    var selectedStudentForEdit by remember { mutableStateOf<Student?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Quản lý Học viên") })
        },
        floatingActionButton = {
            if (canManage) {
                FloatingActionButton(onClick = { showAddDialog = true }) {
                    Icon(Icons.Default.Add, contentDescription = "Thêm học viên")
                }
            }
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = viewModel::onSearchQueryChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                placeholder = { Text("Tìm tên hoặc số điện thoại...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                singleLine = true
            )

            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(students) { student ->
                    StudentCard(
                        student = student,
                        canManage = canManage,
                        canCollectFee = canCollectFee,
                        onPayFeeClick = { selectedStudentForFee = it },
                        onEditClick = { selectedStudentForEdit = it },
                        onDeleteClick = { viewModel.deleteStudent(it.id) }
                    )
                }
            }
        }

        if (showAddDialog) {
            AddOrEditStudentDialog(
                student = null,
                onDismiss = { showAddDialog = false },
                onSave = { name, phone, parentName ->
                    viewModel.addStudent(name, phone, parentName)
                    showAddDialog = false
                }
            )
        }

        if (selectedStudentForEdit != null) {
            AddOrEditStudentDialog(
                student = selectedStudentForEdit,
                onDismiss = { selectedStudentForEdit = null },
                onSave = { name, phone, parentName ->
                    selectedStudentForEdit?.let {
                        val updated = it.copy(name = name, phone = phone, parentName = parentName)
                        viewModel.updateStudent(updated)
                    }
                    selectedStudentForEdit = null
                }
            )
        }

        if (selectedStudentForFee != null) {
            AlertDialog(
                onDismissRequest = { selectedStudentForFee = null },
                title = { Text("Thu học phí") },
                text = {
                    Column {
                        Text("Học viên: ${selectedStudentForFee?.name}")
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = feeAmountText,
                            onValueChange = { feeAmountText = it },
                            label = { Text("Số tiền (VNĐ)") },
                            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true
                        )
                    }
                },
                confirmButton = {
                    Button(onClick = {
                        val amount = feeAmountText.toDoubleOrNull()
                        if (amount != null && amount > 0) {
                            selectedStudentForFee?.let {
                                viewModel.collectFee(it.id, amount)
                            }
                        }
                        selectedStudentForFee = null
                        feeAmountText = ""
                    }) {
                        Text("Xác nhận")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { selectedStudentForFee = null }) {
                        Text("Hủy")
                    }
                }
            )
        }
    }
}

@Composable
fun AddOrEditStudentDialog(
    student: Student?,
    onDismiss: () -> Unit,
    onSave: (String, String, String) -> Unit
) {
    var name by remember { mutableStateOf(student?.name ?: "") }
    var phone by remember { mutableStateOf(student?.phone ?: "") }
    var parentName by remember { mutableStateOf(student?.parentName ?: "") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (student == null) "Thêm Học viên" else "Sửa Học viên") },
        text = {
            Column {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Họ Tên") }, singleLine = true)
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Số điện thoại") }, singleLine = true, keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Phone))
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = parentName, onValueChange = { parentName = it }, label = { Text("Tên Phụ huynh") }, singleLine = true)
            }
        },
        confirmButton = {
            Button(onClick = { if (name.isNotBlank()) onSave(name, phone, parentName) }) {
                Text("Lưu")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Hủy") }
        }
    )
}

@Composable
fun StudentCard(
    student: Student,
    canManage: Boolean,
    canCollectFee: Boolean,
    onPayFeeClick: (Student) -> Unit,
    onEditClick: (Student) -> Unit,
    onDeleteClick: (Student) -> Unit
) {
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("vi", "VN"))
    val balanceColor = if (student.balance < 0) Color(0xFFEF4444) else Color(0xFF10B981)

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text(student.name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(student.phone, style = MaterialTheme.typography.bodyMedium)
                    Spacer(modifier = Modifier.height(2.dp))
                    Text("PH: ${student.parentName}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Column(horizontalAlignment = androidx.compose.ui.Alignment.End) {
                    Text("Trạng thái", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = if (student.status.name == "ACTIVE") "Đang học" else "Nghỉ học",
                        color = if (student.status.name == "ACTIVE") Color(0xFF10B981) else Color(0xFF94A3B8),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = currencyFormatter.format(student.balance),
                        color = balanceColor,
                        fontWeight = FontWeight.ExtraBold,
                        style = MaterialTheme.typography.titleMedium
                    )
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                if (canManage) {
                    IconButton(onClick = { onDeleteClick(student) }) {
                        Icon(Icons.Default.Delete, contentDescription = "Xóa", tint = MaterialTheme.colorScheme.error)
                    }
                    IconButton(onClick = { onEditClick(student) }) {
                        Icon(Icons.Default.Edit, contentDescription = "Sửa", tint = MaterialTheme.colorScheme.primary)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                }
                if (canCollectFee) {
                    Button(
                        onClick = { onPayFeeClick(student) },
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        modifier = Modifier.height(40.dp),
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(20.dp)
                    ) {
                        Text("Thu tiền", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
