@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
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
import com.educenter.pro.ui.components.PullRefreshWrapper
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
    val isRefreshing by viewModel.isRefreshing.collectAsState()
    
    val canManage = currentUserRole == com.educenter.pro.data.model.UserRole.ADMIN || currentUserRole == com.educenter.pro.data.model.UserRole.MANAGER
    val canCollectFee = canManage || currentUserRole == com.educenter.pro.data.model.UserRole.ACCOUNTANT
    
    var showAddDialog by remember { mutableStateOf(false) }
    var selectedStudentForFee by remember { mutableStateOf<Student?>(null) }
    var feeAmountText by remember { mutableStateOf("") }
    var selectedPaymentMethod by remember { mutableStateOf("Tiá»n máº·t") }
    
    var selectedStudentForEdit by remember { mutableStateOf<Student?>(null) }
    var selectedStudentForDetails by remember { mutableStateOf<Student?>(null) }
    var studentToDelete by remember { mutableStateOf<Student?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Quáº£n lĂ½ Há»c viĂªn") })
        },
        floatingActionButton = {
            if (canManage) {
                FloatingActionButton(
                    onClick = { showAddDialog = true },
                    containerColor = Color(0xFF3B82F6)
                ) {
                    Icon(Icons.Default.Add, contentDescription = "ThĂªm há»c viĂªn", tint = Color.White)
                }
            }
        }
    ) { padding ->
        PullRefreshWrapper(
            isRefreshing = isRefreshing,
            onRefresh = { viewModel.refresh() },
            modifier = Modifier.fillMaxSize().padding(padding)
        ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Search bar with clear button
            OutlinedTextField(
                value = searchQuery,
                onValueChange = viewModel::onSearchQueryChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                placeholder = { Text("TĂ¬m tĂªn hoáº·c sá»‘ Ä‘iá»‡n thoáº¡i...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { viewModel.onSearchQueryChange("") }) {
                            Icon(Icons.Default.Clear, contentDescription = "XĂ³a tĂ¬m kiáº¿m")
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
        } // PullRefreshWrapper

        // === DELETE CONFIRMATION ===
        if (studentToDelete != null) {
            AlertDialog(
                onDismissRequest = { studentToDelete = null },
                title = { Text("XĂ¡c nháº­n xĂ³a") },
                text = { Text("Báº¡n cĂ³ cháº¯c cháº¯n muá»‘n xĂ³a há»c viĂªn \"${studentToDelete?.name}\"? Thao tĂ¡c nĂ y khĂ´ng thá»ƒ hoĂ n tĂ¡c.") },
                confirmButton = {
                    Button(
                        onClick = {
                            studentToDelete?.let { viewModel.deleteStudent(it.id) }
                            studentToDelete = null
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                    ) { Text("XĂ³a") }
                },
                dismissButton = {
                    TextButton(onClick = { studentToDelete = null }) { Text("Há»§y") }
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
                        Text("đŸ’° Thu há»c phĂ­")
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
                                Text("Sá»‘ dÆ°:", fontSize = 13.sp)
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
                            label = { Text("Sá»‘ tiá»n (VNÄ)") },
                            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )

                        Text("HĂ¬nh thá»©c ná»™p:", style = MaterialTheme.typography.labelMedium)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(
                                selected = selectedPaymentMethod == "Tiá»n máº·t",
                                onClick = { selectedPaymentMethod = "Tiá»n máº·t" }
                            )
                            Text("đŸ’µ Tiá»n máº·t")
                            Spacer(modifier = Modifier.width(16.dp))
                            RadioButton(
                                selected = selectedPaymentMethod == "Chuyá»ƒn khoáº£n",
                                onClick = { selectedPaymentMethod = "Chuyá»ƒn khoáº£n" }
                            )
                            Text("đŸ¦ Chuyá»ƒn khoáº£n")
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
                                    Text("Sá»‘ dÆ° sau:", fontSize = 13.sp)
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
                                    val method = if (selectedPaymentMethod == "Tiá»n máº·t") "cash" else "transfer"
                                    viewModel.collectFee(it.id, amount, method)
                                }
                            }
                            selectedStudentForFee = null
                            feeAmountText = ""
                            selectedPaymentMethod = "Tiá»n máº·t"
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))
                    ) {
                        Text("âœ… XĂ¡c nháº­n Ghi sá»•", fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { selectedStudentForFee = null }) {
                        Text("Há»§y")
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
    var gender by remember { mutableStateOf(student?.gender ?: "KhĂ¡c") }
    var dob by remember { mutableStateOf(student?.dob ?: "") }
    var discountText by remember { mutableStateOf(student?.discountPercentage?.toString() ?: "0") }
    var isActive by remember { mutableStateOf(student?.status == com.educenter.pro.data.model.PersonStatus.ACTIVE) }
    var selectedClassIds by remember { mutableStateOf(currentClassIds.toMutableList()) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (student == null) "ThĂªm Há»c viĂªn" else "Sá»­a Há»c viĂªn") },
        text = {
            LazyColumn {
                item { OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Há» TĂªn *") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
                item { Spacer(modifier = Modifier.height(8.dp)) }
                item { OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Sá»‘ Ä‘iá»‡n thoáº¡i") }, singleLine = true, keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Phone), modifier = Modifier.fillMaxWidth()) }
                item { Spacer(modifier = Modifier.height(8.dp)) }
                item { OutlinedTextField(value = parentName, onValueChange = { parentName = it }, label = { Text("TĂªn Phá»¥ huynh") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
                item { Spacer(modifier = Modifier.height(8.dp)) }
                item { OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Email") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
                item { Spacer(modifier = Modifier.height(8.dp)) }
                item { OutlinedTextField(value = dob, onValueChange = { dob = it }, label = { Text("NgĂ y sinh (YYYY-MM-DD)") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
                item { Spacer(modifier = Modifier.height(8.dp)) }
                item { OutlinedTextField(value = address, onValueChange = { address = it }, label = { Text("Äá»‹a chá»‰") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
                item { Spacer(modifier = Modifier.height(8.dp)) }
                item {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Giá»›i tĂ­nh: ", style = MaterialTheme.typography.bodyMedium)
                        Spacer(modifier = Modifier.width(8.dp))
                        listOf("Nam", "Ná»¯", "KhĂ¡c").forEach { g ->
                            RadioButton(selected = gender == g, onClick = { gender = g })
                            Text(g)
                            Spacer(modifier = Modifier.width(8.dp))
                        }
                    }
                }
                item { Spacer(modifier = Modifier.height(8.dp)) }
                item { OutlinedTextField(value = discountText, onValueChange = { discountText = it }, label = { Text("% Giáº£m há»c phĂ­") }, singleLine = true, keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth()) }
                item { Spacer(modifier = Modifier.height(8.dp)) }
                item {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = isActive, onCheckedChange = { isActive = it })
                        Text("Äang theo há»c (ACTIVE)")
                    }
                }
                // === CLASS SELECTION ===
                if (allClasses.isNotEmpty()) {
                    item {
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("Lá»›p há»c:", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
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
                Text("LÆ°u")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Há»§y") }
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
                    Text(student.name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onBackground)
                    Spacer(modifier = Modifier.height(4.dp))
                    if (student.phone.isNotBlank()) {
                        val context = androidx.compose.ui.platform.LocalContext.current
                        Text(
                            "đŸ“ ${student.phone}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color(0xFF3B82F6),
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier.clickable {
                                val intent = android.content.Intent(android.content.Intent.ACTION_DIAL).apply {
                                    data = android.net.Uri.parse("tel:${student.phone}")
                                }
                                context.startActivity(intent)
                            }
                        )
                    }
                    if (student.parentName.isNotBlank()) {
                        Text("PH: ${student.parentName}", style = MaterialTheme.typography.bodySmall, color = Color(0xFF64748B))
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
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = Color(0xFF2563EB),
                                        maxLines = 1
                                    )
                                }
                            }
                            if (studentClasses.size > 3) {
                                Text("+${studentClasses.size - 3}", fontSize = 12.sp, color = Color(0xFF64748B))
                            }
                        }
                    }
                }
                Column(horizontalAlignment = Alignment.End) {
                    Surface(
                        color = if (student.status.name == "ACTIVE") Color(0xFF10B981).copy(alpha = 0.1f) else Color(0xFF64748B).copy(alpha = 0.1f),
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = if (student.status.name == "ACTIVE") "Äang há»c" else "Nghá»‰ há»c",
                            color = if (student.status.name == "ACTIVE") Color(0xFF10B981) else Color(0xFF64748B),
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                            fontSize = 12.sp,
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
                        Icon(Icons.Default.Delete, contentDescription = "XĂ³a", tint = Color(0xFFEF4444))
                    }
                    IconButton(onClick = { onEditClick(student) }) {
                        Icon(Icons.Default.Edit, contentDescription = "Sá»­a", tint = Color(0xFF3B82F6))
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
                        Text("Ná»™p tiá»n", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
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
    val context = androidx.compose.ui.platform.LocalContext.current
    val studentClasses = classes.filter { it.studentIds.contains(student.id) }

    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier.fillMaxHeight(0.9f).fillMaxWidth(0.95f),
        title = { Text("Chi tiáº¿t Há»c viĂªn", fontWeight = FontWeight.Bold) },
        text = {
            Column(modifier = Modifier.fillMaxSize()) {
                Text(student.name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onBackground)
                Spacer(modifier = Modifier.height(8.dp))

                // Quick action: Call
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (student.phone.isNotBlank()) {
                        androidx.compose.material3.AssistChip(
                            onClick = {
                                val intent = android.content.Intent(android.content.Intent.ACTION_DIAL).apply {
                                    data = android.net.Uri.parse("tel:${student.phone}")
                                }
                                context.startActivity(intent)
                            },
                            label = { Text("đŸ“ ${student.phone}", fontSize = 14.sp) },
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(20.dp)
                        )
                    }
                    if (student.parentName.isNotBlank()) {
                        androidx.compose.material3.AssistChip(
                            onClick = {},
                            label = { Text("đŸ‘¨â€đŸ‘©â€đŸ‘§ ${student.parentName}", fontSize = 14.sp) },
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(20.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Balance card
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = if (student.balance < 0) Color(0xFFFEF2F2) else Color(0xFFF0FDF4))
                ) {
                    Row(modifier = Modifier.padding(12.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Sá»‘ dÆ° tĂ i khoáº£n", fontSize = 14.sp, color = Color(0xFF475569))
                        Text(currencyFormatter.format(student.balance), fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, color = if (student.balance < 0) Color(0xFFEF4444) else Color(0xFF10B981))
                    }
                }

                if (studentClasses.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Text("Lá»›p: ${studentClasses.joinToString { it.name }}", fontSize = 14.sp, color = Color(0xFF475569))
                }

                Spacer(modifier = Modifier.height(12.dp))

                TabRow(selectedTabIndex = selectedTab) {
                    Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }, text = { Text("đŸ’° TĂ i chĂ­nh", fontSize = 14.sp) })
                    Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }, text = { Text("đŸ“‹ Äiá»ƒm danh", fontSize = 14.sp) })
                }

                Spacer(modifier = Modifier.height(8.dp))

                if (selectedTab == 0) {
                    if (transactions.isEmpty()) {
                        Text("ChÆ°a cĂ³ giao dá»‹ch nĂ o.", modifier = Modifier.padding(16.dp), color = Color(0xFF64748B))
                    } else {
                        val totalPaid = transactions.filter { it.amount > 0 }.sumOf { it.amount }
                        Card(modifier = Modifier.fillMaxWidth(), shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = Color(0xFFF0F7FF))) {
                            Row(modifier = Modifier.padding(12.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Column { Text("Tá»•ng Ä‘Ă£ ná»™p", fontSize = 13.sp, color = Color(0xFF475569)); Text(currencyFormatter.format(totalPaid), fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color(0xFF10B981)) }
                                Column(horizontalAlignment = Alignment.End) { Text("Giao dá»‹ch", fontSize = 13.sp, color = Color(0xFF475569)); Text("${transactions.size}", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color(0xFF3B82F6)) }
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        LazyColumn {
                            items(transactions.sortedByDescending { it.date }) { tx ->
                                Card(modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp), shape = androidx.compose.foundation.shape.RoundedCornerShape(10.dp), colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(1.dp)) {
                                    Row(modifier = Modifier.padding(10.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(tx.description, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = MaterialTheme.colorScheme.onBackground)
                                            Text(tx.date, fontSize = 13.sp, color = Color(0xFF64748B))
                                        }
                                        Text(currencyFormatter.format(tx.amount), color = if (tx.amount > 0) Color(0xFF10B981) else Color(0xFFEF4444), fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    }
                                }
                            }
                        }
                    }
                } else {
                    if (attendanceRecords.isEmpty()) {
                        Text("ChÆ°a cĂ³ lá»‹ch sá»­ Ä‘iá»ƒm danh.", modifier = Modifier.padding(16.dp), color = Color(0xFF64748B))
                    } else {
                        val presentCount = attendanceRecords.count { it.status == "PRESENT" }
                        val lateCount = attendanceRecords.count { it.status == "LATE" }
                        val absentCount = attendanceRecords.count { it.status == "ABSENT" }
                        val unexcusedCount = attendanceRecords.count { it.status == "UNEXCUSED_ABSENT" }

                        Card(modifier = Modifier.fillMaxWidth(), shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = Color(0xFFF0F7FF))) {
                            Row(modifier = Modifier.padding(12.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                                DetailStatItem("CĂ³ máº·t", presentCount, Color(0xFF10B981))
                                DetailStatItem("Trá»…", lateCount, Color(0xFFF59E0B))
                                DetailStatItem("CĂ³ phĂ©p", absentCount, Color(0xFF0EA5E9))
                                DetailStatItem("K.phĂ©p", unexcusedCount, Color(0xFFEF4444))
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))

                        val grouped = attendanceRecords.sortedByDescending { it.date }.groupBy { it.date.take(7) }
                        LazyColumn {
                            grouped.forEach { (month, records) ->
                                item {
                                    Text("đŸ“… ThĂ¡ng ${month.takeLast(2)}/${month.take(4)} (${records.size} buá»•i)", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Color(0xFF3B82F6), modifier = Modifier.padding(vertical = 6.dp))
                                }
                                items(records) { att ->
                                    val clsName = classes.find { it.id == att.classId }?.name ?: ""
                                    val statusText = when (att.status) { "PRESENT" -> "âœ…"; "LATE" -> "â°"; "ABSENT" -> "đŸ“"; "UNEXCUSED_ABSENT" -> "âŒ"; else -> "?" }
                                    val statusLabel = when (att.status) { "PRESENT" -> "CĂ³ máº·t"; "LATE" -> "Trá»…"; "ABSENT" -> "CĂ³ phĂ©p"; "UNEXCUSED_ABSENT" -> "K.phĂ©p"; else -> att.status }
                                    val statusColor = when (att.status) { "PRESENT" -> Color(0xFF10B981); "LATE" -> Color(0xFFF59E0B); "ABSENT" -> Color(0xFF0EA5E9); "UNEXCUSED_ABSENT" -> Color(0xFFEF4444); else -> Color(0xFF64748B) }
                                    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp, horizontal = 4.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(att.date, fontSize = 14.sp, fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.onBackground)
                                            if (clsName.isNotBlank()) Text(clsName, fontSize = 13.sp, color = Color(0xFF64748B))
                                        }
                                        Text("$statusText $statusLabel", color = statusColor, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    }
                                    HorizontalDivider(color = Color(0xFFF1F5F9))
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("ÄĂ³ng", fontWeight = FontWeight.Bold) } }
    )
}

@Composable
private fun DetailStatItem(label: String, count: Int, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text("$count", fontWeight = FontWeight.ExtraBold, fontSize = 20.sp, color = color)
        Text(label, fontSize = 13.sp, color = Color(0xFF475569), fontWeight = FontWeight.Medium)
    }
}

