package com.educenter.pro.ui.screens.classes

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.RemoveCircle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
    val teacherNames by viewModel.selectedClassTeacherNames.collectAsState()

    var showAddClassDialog by remember { mutableStateOf(false) }
    var showAddStudentDialog by remember { mutableStateOf(false) }
    var studentToRemove by remember { mutableStateOf<Student?>(null) }

    if (selectedClass != null) {
        BackHandler { viewModel.clearSelection() }
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { 
                        Column {
                            Text(selectedClass?.name ?: "")
                            Text(
                                "${selectedClass?.subject ?: ""} • ${students.size} học viên",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    },
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
            LazyColumn(modifier = Modifier.padding(padding).fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                // Schedule info
                if (selectedClass != null && (selectedClass!!.schedule.isNotEmpty() || teacherNames.isNotEmpty() || selectedClass!!.fee.amount > 0)) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                if (selectedClass!!.schedule.isNotEmpty()) {
                                    Text("📅 Lịch học", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Color(0xFF3B82F6))
                                    Spacer(modifier = Modifier.height(8.dp))
                                    selectedClass!!.schedule.forEach { sch ->
                                        Text("${sch.dayOfWeek}: ${sch.startTime} - ${sch.endTime}", fontSize = 14.sp, color = Color(0xFF475569))
                                    }
                                }
                                if (selectedClass!!.fee.amount > 0) {
                                    Spacer(modifier = Modifier.height(8.dp))
                                    val feeLabel = when (selectedClass!!.fee.type) {
                                        "PER_SESSION" -> "Theo buổi"
                                        "MONTHLY" -> "Theo tháng"
                                        "PER_COURSE" -> "Theo khóa"
                                        else -> selectedClass!!.fee.type
                                    }
                                    val feeFormatter = java.text.NumberFormat.getCurrencyInstance(java.util.Locale("vi", "VN"))
                                    Text("💰 Học phí: ${feeFormatter.format(selectedClass!!.fee.amount)} / $feeLabel", fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Color(0xFF10B981))
                                }
                                if (teacherNames.isNotEmpty()) {
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text("👨‍🏫 GV: ${teacherNames.joinToString(", ")}", fontSize = 14.sp, color = Color(0xFF8B5CF6), fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }
                    }
                }
                item {
                    Text(
                        "Danh sách Học viên (${students.size})",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
                if (students.isEmpty()) {
                    item {
                        Box(modifier = Modifier.fillMaxWidth().height(100.dp), contentAlignment = Alignment.Center) {
                            Text("Lớp này chưa có học viên. Nhấn + để thêm.", color = Color.Gray)
                        }
                    }
                } else {
                    items(students) { student ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(16.dp).fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(student.name, fontWeight = FontWeight.Bold, color = Color(0xFF3B82F6))
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(student.phone, style = MaterialTheme.typography.bodySmall, color = Color(0xFF94A3B8))
                                }
                                IconButton(onClick = { studentToRemove = student }) {
                                    Icon(Icons.Default.RemoveCircle, contentDescription = "Xóa khỏi lớp", tint = Color(0xFFEF4444))
                                }
                            }
                        }
                    }
                }
            }
        }

        // Confirm remove student from class
        if (studentToRemove != null) {
            AlertDialog(
                onDismissRequest = { studentToRemove = null },
                title = { Text("Xác nhận") },
                text = { Text("Xóa \"${studentToRemove?.name}\" khỏi lớp \"${selectedClass?.name}\"?") },
                confirmButton = {
                    Button(
                        onClick = {
                            studentToRemove?.let { viewModel.removeStudentFromClass(it.id) }
                            studentToRemove = null
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                    ) { Text("Xóa") }
                },
                dismissButton = {
                    TextButton(onClick = { studentToRemove = null }) { Text("Hủy") }
                }
            )
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
                                // Show schedule
                                if (classModel.schedule.isNotEmpty()) {
                                    Spacer(modifier = Modifier.height(4.dp))
                                    val dayMap = mapOf("Monday" to "T2", "Tuesday" to "T3", "Wednesday" to "T4", "Thursday" to "T5", "Friday" to "T6", "Saturday" to "T7", "Sunday" to "CN")
                                    val schedText = classModel.schedule.joinToString(" | ") { 
                                        "${dayMap[it.dayOfWeek] ?: it.dayOfWeek}: ${it.startTime}-${it.endTime}" 
                                    }
                                    Text(schedText, style = MaterialTheme.typography.bodySmall, color = Color(0xFF64748B), fontSize = 11.sp)
                                }
                                // Show fee
                                if (classModel.fee.amount > 0) {
                                    val feeTypeText = when (classModel.fee.type) {
                                        "PER_SESSION" -> "buổi"
                                        "MONTHLY" -> "tháng"
                                        "PER_COURSE" -> "khóa"
                                        else -> ""
                                    }
                                    Text(
                                        "Học phí: ${java.text.NumberFormat.getCurrencyInstance(java.util.Locale("vi", "VN")).format(classModel.fee.amount)}/$feeTypeText",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = Color(0xFF10B981),
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 12.sp
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // === ADD CLASS DIALOG ===
        if (showAddClassDialog) {
            AddClassDialog(
                onDismiss = { showAddClassDialog = false },
                onSave = { name, subject, schedule, feeType, feeAmount ->
                    viewModel.addClass(name, subject, schedule, feeType, feeAmount)
                    showAddClassDialog = false
                }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddClassDialog(
    onDismiss: () -> Unit,
    onSave: (String, String, List<Map<String, String>>, String, Double) -> Unit
) {
    var className by remember { mutableStateOf("") }
    var subject by remember { mutableStateOf("") }
    var feeAmountText by remember { mutableStateOf("") }
    var selectedFeeType by remember { mutableStateOf("PER_SESSION") }
    
    // Schedule entries
    val allDays = listOf("Monday" to "T2", "Tuesday" to "T3", "Wednesday" to "T4", "Thursday" to "T5", "Friday" to "T6", "Saturday" to "T7", "Sunday" to "CN")
    var selectedDays by remember { mutableStateOf(setOf<String>()) }
    var startTime by remember { mutableStateOf("18:00") }
    var endTime by remember { mutableStateOf("19:30") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Thêm Lớp Mới") },
        text = {
            LazyColumn {
                item { OutlinedTextField(value = className, onValueChange = { className = it }, label = { Text("Tên lớp *") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
                item { Spacer(modifier = Modifier.height(8.dp)) }
                item { OutlinedTextField(value = subject, onValueChange = { subject = it }, label = { Text("Môn học *") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
                item { Spacer(modifier = Modifier.height(12.dp)) }
                
                // Schedule
                item { Text("Lịch học:", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall) }
                item { Spacer(modifier = Modifier.height(4.dp)) }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        allDays.forEach { (dayEn, dayVn) ->
                            FilterChip(
                                selected = selectedDays.contains(dayEn),
                                onClick = {
                                    selectedDays = if (selectedDays.contains(dayEn)) {
                                        selectedDays - dayEn
                                    } else {
                                        selectedDays + dayEn
                                    }
                                },
                                label = { Text(dayVn, fontSize = 11.sp) },
                                modifier = Modifier.height(32.dp)
                            )
                        }
                    }
                }
                item { Spacer(modifier = Modifier.height(8.dp)) }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = startTime, onValueChange = { startTime = it },
                            label = { Text("Bắt đầu") }, singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = endTime, onValueChange = { endTime = it },
                            label = { Text("Kết thúc") }, singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
                item { Spacer(modifier = Modifier.height(12.dp)) }
                
                // Fee
                item { Text("Học phí:", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall) }
                item { Spacer(modifier = Modifier.height(4.dp)) }
                item {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        listOf("PER_SESSION" to "Theo buổi", "MONTHLY" to "Theo tháng", "PER_COURSE" to "Theo khóa").forEach { (type, label) ->
                            RadioButton(selected = selectedFeeType == type, onClick = { selectedFeeType = type })
                            Text(label, fontSize = 12.sp)
                            Spacer(modifier = Modifier.width(4.dp))
                        }
                    }
                }
                item { Spacer(modifier = Modifier.height(4.dp)) }
                item {
                    OutlinedTextField(
                        value = feeAmountText, onValueChange = { feeAmountText = it },
                        label = { Text("Số tiền (VNĐ)") }, singleLine = true,
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        },
        confirmButton = {
            Button(onClick = {
                if (className.isNotBlank() && subject.isNotBlank()) {
                    val schedule = selectedDays.map { day ->
                        mapOf("dayOfWeek" to day, "startTime" to startTime, "endTime" to endTime)
                    }
                    val feeAmount = feeAmountText.toDoubleOrNull() ?: 0.0
                    onSave(className, subject, schedule, selectedFeeType, feeAmount)
                }
            }) { Text("Lưu") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Hủy") }
        }
    )
}
