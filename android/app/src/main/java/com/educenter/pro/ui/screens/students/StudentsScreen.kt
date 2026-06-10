package com.educenter.pro.ui.screens.students

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.educenter.pro.data.model.Student
import com.educenter.pro.data.model.ClassModel
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StudentsScreen(
    viewModel: StudentsViewModel = hiltViewModel()
) {
    val students by viewModel.filteredStudents.collectAsState()
    val transactions by viewModel.transactions.collectAsState()
    val attendanceRecords by viewModel.attendanceRecords.collectAsState()
    val classes by viewModel.classes.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val currentUserRole by viewModel.currentUserRole.collectAsState()
    
    val canManage = currentUserRole == com.educenter.pro.data.model.UserRole.ADMIN || currentUserRole == com.educenter.pro.data.model.UserRole.MANAGER
    val canCollectFee = canManage || currentUserRole == com.educenter.pro.data.model.UserRole.ACCOUNTANT
    
    var showAddDialog by remember { mutableStateOf(false) }
    var selectedStudentForFee by remember { mutableStateOf<Student?>(null) }
    var feeAmountText by remember { mutableStateOf("") }
    var selectedPaymentMethod by remember { mutableStateOf("Tiền mặt") }
    
    var selectedStudentForEdit by remember { mutableStateOf<Student?>(null) }
    var selectedStudentForDetails by remember { mutableStateOf<Student?>(null) }
    var studentToDelete by remember { mutableStateOf<Student?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Quản lý Học viên") })
        },
        floatingActionButton = {
            if (canManage) {
                FloatingActionButton(
                    onClick = { showAddDialog = true },
                    containerColor = Color(0xFF3B82F6)
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Thêm học viên", tint = Color.White)
                }
            }
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            // Search bar with clear button
            OutlinedTextField(
                value = searchQuery,
                onValueChange = viewModel::onSearchQueryChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                placeholder = { Text("Tìm tên hoặc số điện thoại...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { viewModel.onSearchQueryChange("") }) {
                            Icon(Icons.Default.Clear, contentDescription = "Xóa tìm kiếm")
                        }
                    }
                },
                singleLine = true,
                shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp)
            )

            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(students) { student ->
                    val studentClasses = classes.filter { it.studentIds.contains(student.id) }
                    StudentCard(
                        student = student,
                        studentClasses = studentClasses,
                        canManage = canManage,
                        canCollectFee = canCollectFee,
                        onClick = { selectedStudentForDetails = it },
                        onPayFeeClick = { selectedStudentForFee = it },
                        onEditClick = { selectedStudentForEdit = it },
                        onDeleteClick = { studentToDelete = it }
                    )
                }
            }
        }

        // === DELETE CONFIRMATION ===
        if (studentToDelete != null) {
            AlertDialog(
                onDismissRequest = { studentToDelete = null },
                title = { Text("Xác nhận xóa") },
                text = { Text("Bạn có chắc chắn muốn xóa học viên \"${studentToDelete?.name}\"? Thao tác này không thể hoàn tác.") },
                confirmButton = {
                    Button(
                        onClick = {
                            studentToDelete?.let { viewModel.deleteStudent(it.id) }
                            studentToDelete = null
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                    ) { Text("Xóa") }
                },
                dismissButton = {
                    TextButton(onClick = { studentToDelete = null }) { Text("Hủy") }
                }
            )
        }

        // === ADD DIALOG ===
        if (showAddDialog) {
            AddOrEditStudentDialog(
                student = null,
                allClasses = classes,
                currentClassIds = emptyList(),
                onDismiss = { showAddDialog = false },
                onSave = { name, phone, parentName, email, address, gender, dob, discount, status, classIds ->
                    viewModel.addStudent(name, phone, parentName, email, address, gender, dob, discount, status, classIds)
                    showAddDialog = false
                }
            )
        }

        // === EDIT DIALOG ===
        if (selectedStudentForEdit != null) {
            val editClassIds = viewModel.getStudentClassIds(selectedStudentForEdit!!.id)
            AddOrEditStudentDialog(
                student = selectedStudentForEdit,
                allClasses = classes,
                currentClassIds = editClassIds,
                onDismiss = { selectedStudentForEdit = null },
                onSave = { name, phone, parentName, email, address, gender, dob, discount, status, classIds ->
                    selectedStudentForEdit?.let {
                        val updated = it.copy(
                            name = name, phone = phone, parentName = parentName,
                            email = email, address = address, gender = gender,
                            dob = dob, discountPercentage = discount, status = status
                        )
                        viewModel.updateStudent(updated, classIds)
                    }
                    selectedStudentForEdit = null
                }
            )
        }

        // === FEE DIALOG ===
        if (selectedStudentForFee != null) {
            val fmt = NumberFormat.getCurrencyInstance(Locale("vi", "VN"))
            // Auto-fill amount on selection
            LaunchedEffect(selectedStudentForFee) {
                if (selectedStudentForFee != null && selectedStudentForFee!!.balance < 0) {
                    feeAmountText = (-selectedStudentForFee!!.balance).toLong().toString()
                }
            }

            AlertDialog(
                onDismissRequest = { selectedStudentForFee = null },
                title = {
                    Column {
                        Text("💰 Thu học phí")
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            selectedStudentForFee?.name ?: "",
                            fontSize = 14.sp,
                            color = Color(0xFF3B82F6),
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        // Current balance
                        Card(
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(10.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = if (selectedStudentForFee!!.balance < 0) Color(0xFFFEF2F2) else Color(0xFFF0FDF4)
                            )
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp).fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Số dư:", fontSize = 13.sp)
                                Text(
                                    fmt.format(selectedStudentForFee!!.balance),
                                    fontWeight = FontWeight.Bold,
                                    color = if (selectedStudentForFee!!.balance < 0) Color(0xFFEF4444) else Color(0xFF10B981)
                                )
                            }
                        }

                        OutlinedTextField(
                            value = feeAmountText,
                            onValueChange = { feeAmountText = it.filter { c -> c.isDigit() } },
                            label = { Text("Số tiền (VNĐ)") },
                            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )

                        Text("Hình thức nộp:", style = MaterialTheme.typography.labelMedium)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(
                                selected = selectedPaymentMethod == "Tiền mặt",
                                onClick = { selectedPaymentMethod = "Tiền mặt" }
                            )
                            Text("💵 Tiền mặt")
                            Spacer(modifier = Modifier.width(16.dp))
                            RadioButton(
                                selected = selectedPaymentMethod == "Chuyển khoản",
                                onClick = { selectedPaymentMethod = "Chuyển khoản" }
                            )
                            Text("🏦 Chuyển khoản")
                        }

                        // Preview after payment
                        val parsedAmount = feeAmountText.toDoubleOrNull() ?: 0.0
                        if (parsedAmount > 0) {
                            val newBalance = selectedStudentForFee!!.balance + parsedAmount
                            Card(
                                shape = androidx.compose.foundation.shape.RoundedCornerShape(10.dp),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFFF0FDF4))
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp).fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text("Số dư sau:", fontSize = 13.sp)
                                    Text(
                                        fmt.format(newBalance),
                                        fontWeight = FontWeight.Bold,
                                        color = if (newBalance < 0) Color(0xFFEF4444) else Color(0xFF10B981)
                                    )
                                }
                            }
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            val amount = feeAmountText.toDoubleOrNull()
                            if (amount != null && amount > 0) {
                                selectedStudentForFee?.let {
                                    val method = if (selectedPaymentMethod == "Tiền mặt") "cash" else "transfer"
                                    viewModel.collectFee(it.id, amount, method)
                                }
                            }
                            selectedStudentForFee = null
                            feeAmountText = ""
                            selectedPaymentMethod = "Tiền mặt"
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))
                    ) {
                        Text("✅ Xác nhận Ghi sổ", fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { selectedStudentForFee = null }) {
                        Text("Hủy")
                    }
                }
            )
        }

        // === DETAIL DIALOG ===
        if (selectedStudentForDetails != null) {
            val studentTx = transactions.filter { it.studentId == selectedStudentForDetails!!.id }
            val studentAtt = attendanceRecords.filter { it.studentId == selectedStudentForDetails!!.id }
            
            StudentDetailDialog(
                student = selectedStudentForDetails!!,
                transactions = studentTx,
                attendanceRecords = studentAtt,
                classes = classes,
                onDismiss = { selectedStudentForDetails = null }
            )
        }
    }
}

@Composable
fun AddOrEditStudentDialog(
    student: Student?,
    allClasses: List<ClassModel>,
    currentClassIds: List<String>,
    onDismiss: () -> Unit,
    onSave: (String, String, String, String, String, String, String, Double, com.educenter.pro.data.model.PersonStatus, List<String>) -> Unit
) {
    var name by remember { mutableStateOf(student?.name ?: "") }
    var phone by remember { mutableStateOf(student?.phone ?: "") }
    var parentName by remember { mutableStateOf(student?.parentName ?: "") }
    var email by remember { mutableStateOf(student?.email ?: "") }
    var address by remember { mutableStateOf(student?.address ?: "") }
    var gender by remember { mutableStateOf(student?.gender ?: "Khác") }
    var dob by remember { mutableStateOf(student?.dob ?: "") }
    var discountText by remember { mutableStateOf(student?.discountPercentage?.toString() ?: "0") }
    var isActive by remember { mutableStateOf(student?.status == com.educenter.pro.data.model.PersonStatus.ACTIVE) }
    var selectedClassIds by remember { mutableStateOf(currentClassIds.toMutableList()) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (student == null) "Thêm Học viên" else "Sửa Học viên") },
        text = {
            LazyColumn {
                item { OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Họ Tên *") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
                item { Spacer(modifier = Modifier.height(8.dp)) }
                item { OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Số điện thoại") }, singleLine = true, keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Phone), modifier = Modifier.fillMaxWidth()) }
                item { Spacer(modifier = Modifier.height(8.dp)) }
                item { OutlinedTextField(value = parentName, onValueChange = { parentName = it }, label = { Text("Tên Phụ huynh") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
                item { Spacer(modifier = Modifier.height(8.dp)) }
                item { OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Email") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
                item { Spacer(modifier = Modifier.height(8.dp)) }
                item { OutlinedTextField(value = dob, onValueChange = { dob = it }, label = { Text("Ngày sinh (YYYY-MM-DD)") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
                item { Spacer(modifier = Modifier.height(8.dp)) }
                item { OutlinedTextField(value = address, onValueChange = { address = it }, label = { Text("Địa chỉ") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
                item { Spacer(modifier = Modifier.height(8.dp)) }
                item {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Giới tính: ", style = MaterialTheme.typography.bodyMedium)
                        Spacer(modifier = Modifier.width(8.dp))
                        listOf("Nam", "Nữ", "Khác").forEach { g ->
                            RadioButton(selected = gender == g, onClick = { gender = g })
                            Text(g)
                            Spacer(modifier = Modifier.width(8.dp))
                        }
                    }
                }
                item { Spacer(modifier = Modifier.height(8.dp)) }
                item { OutlinedTextField(value = discountText, onValueChange = { discountText = it }, label = { Text("% Giảm học phí") }, singleLine = true, keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth()) }
                item { Spacer(modifier = Modifier.height(8.dp)) }
                item {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = isActive, onCheckedChange = { isActive = it })
                        Text("Đang theo học (ACTIVE)")
                    }
                }
                // === CLASS SELECTION ===
                if (allClasses.isNotEmpty()) {
                    item {
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("Lớp học:", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
                        Spacer(modifier = Modifier.height(4.dp))
                    }
                    items(allClasses) { cls ->
                        val isSelected = selectedClassIds.contains(cls.id)
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    selectedClassIds = if (isSelected) {
                                        selectedClassIds.toMutableList().also { it.remove(cls.id) }
                                    } else {
                                        selectedClassIds.toMutableList().also { it.add(cls.id) }
                                    }
                                }
                                .padding(vertical = 4.dp)
                        ) {
                            Checkbox(
                                checked = isSelected,
                                onCheckedChange = {
                                    selectedClassIds = if (isSelected) {
                                        selectedClassIds.toMutableList().also { it.remove(cls.id) }
                                    } else {
                                        selectedClassIds.toMutableList().also { it.add(cls.id) }
                                    }
                                }
                            )
                            Text("${cls.name} (${cls.subject})", style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = { 
                if (name.isNotBlank()) {
                    val discount = discountText.toDoubleOrNull() ?: 0.0
                    val status = if (isActive) com.educenter.pro.data.model.PersonStatus.ACTIVE else com.educenter.pro.data.model.PersonStatus.INACTIVE
                    onSave(name, phone, parentName, email, address, gender, dob, discount, status, selectedClassIds)
                }
            }) {
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
    studentClasses: List<ClassModel>,
    canManage: Boolean,
    canCollectFee: Boolean,
    onClick: (Student) -> Unit,
    onPayFeeClick: (Student) -> Unit,
    onEditClick: (Student) -> Unit,
    onDeleteClick: (Student) -> Unit
) {
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("vi", "VN"))
    val balanceColor = if (student.balance < 0) Color(0xFFEF4444) else Color(0xFF10B981)

    Card(
        modifier = Modifier.fillMaxWidth().clickable { onClick(student) },
        shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(student.name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium, color = Color(0xFF1E293B))
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(student.phone, style = MaterialTheme.typography.bodyMedium, color = Color(0xFF64748B))
                    if (student.parentName.isNotBlank()) {
                        Text("PH: ${student.parentName}", style = MaterialTheme.typography.bodySmall, color = Color(0xFF94A3B8))
                    }
                    // Show classes
                    if (studentClasses.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            studentClasses.take(3).forEach { cls ->
                                Surface(
                                    color = Color(0xFF3B82F6).copy(alpha = 0.1f),
                                    shape = androidx.compose.foundation.shape.RoundedCornerShape(6.dp)
                                ) {
                                    Text(
                                        cls.name,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = Color(0xFF3B82F6),
                                        maxLines = 1
                                    )
                                }
                            }
                            if (studentClasses.size > 3) {
                                Text("+${studentClasses.size - 3}", fontSize = 10.sp, color = Color(0xFF94A3B8))
                            }
                        }
                    }
                }
                Column(horizontalAlignment = Alignment.End) {
                    Surface(
                        color = if (student.status.name == "ACTIVE") Color(0xFF10B981).copy(alpha = 0.1f) else Color(0xFF94A3B8).copy(alpha = 0.1f),
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = if (student.status.name == "ACTIVE") "Đang học" else "Nghỉ học",
                            color = if (student.status.name == "ACTIVE") Color(0xFF10B981) else Color(0xFF94A3B8),
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = currencyFormatter.format(student.balance),
                        color = balanceColor,
                        fontWeight = FontWeight.ExtraBold,
                        style = MaterialTheme.typography.titleMedium
                    )
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                if (canManage) {
                    IconButton(onClick = { onDeleteClick(student) }) {
                        Icon(Icons.Default.Delete, contentDescription = "Xóa", tint = Color(0xFFEF4444))
                    }
                    IconButton(onClick = { onEditClick(student) }) {
                        Icon(Icons.Default.Edit, contentDescription = "Sửa", tint = Color(0xFF3B82F6))
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                }
                if (canCollectFee) {
                    Button(
                        onClick = { onPayFeeClick(student) },
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        modifier = Modifier.height(38.dp),
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF3B82F6))
                    ) {
                        Text("Nộp tiền", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun StudentDetailDialog(
    student: Student,
    transactions: List<com.educenter.pro.data.model.Transaction>,
    attendanceRecords: List<com.educenter.pro.data.model.AttendanceRecord>,
    classes: List<ClassModel>,
    onDismiss: () -> Unit
) {
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("vi", "VN"))
    var selectedTab by remember { mutableStateOf(0) }
    
    val studentClasses = classes.filter { it.studentIds.contains(student.id) }
    
    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier.fillMaxHeight(0.9f).fillMaxWidth(0.95f),
        title = { Text("Chi tiết Học viên") },
        text = {
            Column(modifier = Modifier.fillMaxSize()) {
                Text(student.name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("SĐT: ${student.phone} | PH: ${student.parentName}")
                if (student.email.isNotBlank()) Text("Email: ${student.email}")
                if (student.address.isNotBlank()) Text("Địa chỉ: ${student.address}")
                Text("Số dư: ${currencyFormatter.format(student.balance)}", fontWeight = FontWeight.Bold, color = if(student.balance < 0) Color.Red else Color(0xFF10B981))
                
                if (studentClasses.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Lớp đang học:", fontWeight = FontWeight.Bold)
                    studentClasses.forEach { cls ->
                        Text("- ${cls.name} (${cls.subject})")
                    }
                }
                
                Spacer(modifier = Modifier.height(16.dp))
                
                TabRow(selectedTabIndex = selectedTab) {
                    Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }, text = { Text("Nộp tiền") })
                    Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }, text = { Text("Điểm danh") })
                }
                
                Spacer(modifier = Modifier.height(8.dp))
                
                if (selectedTab == 0) {
                    if (transactions.isEmpty()) {
                        Text("Chưa có giao dịch nào.", modifier = Modifier.padding(16.dp))
                    } else {
                        LazyColumn {
                            items(transactions.sortedByDescending { it.date }) { tx ->
                                Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                                    Column(modifier = Modifier.padding(8.dp)) {
                                        Text("${tx.date} - ${tx.description}", fontWeight = FontWeight.Bold)
                                        Text("Số tiền: ${currencyFormatter.format(tx.amount)}", color = if(tx.amount > 0) Color(0xFF10B981) else Color.Red)
                                        if (!tx.paymentMethod.isNullOrEmpty()) {
                                            Text("Hình thức: ${if(tx.paymentMethod == "cash") "Tiền mặt" else "Chuyển khoản"}")
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else {
                    if (attendanceRecords.isEmpty()) {
                        Text("Chưa có lịch sử điểm danh.", modifier = Modifier.padding(16.dp))
                    } else {
                        LazyColumn {
                            items(attendanceRecords.sortedByDescending { it.date }) { att ->
                                val clsName = classes.find { it.id == att.classId }?.name ?: "Lớp đã xóa"
                                Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                                    Row(modifier = Modifier.padding(8.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Column {
                                            Text(att.date, fontWeight = FontWeight.Bold)
                                            Text(clsName, style = MaterialTheme.typography.bodySmall)
                                        }
                                        val statusText = when (att.status) {
                                            "PRESENT" -> "Có mặt"
                                            "LATE" -> "Trễ"
                                            "ABSENT" -> "Có phép"
                                            "UNEXCUSED_ABSENT" -> "Không phép"
                                            else -> att.status
                                        }
                                        val statusColor = when (att.status) {
                                            "PRESENT" -> Color(0xFF10B981)
                                            "LATE" -> Color(0xFFF59E0B)
                                            "ABSENT" -> Color(0xFF0EA5E9)
                                            "UNEXCUSED_ABSENT" -> Color(0xFFEF4444)
                                            else -> Color.Gray
                                        }
                                        Text(
                                            text = statusText,
                                            color = statusColor,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Đóng") }
        }
    )
}
