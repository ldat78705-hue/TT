package com.educenter.pro.ui.screens.classes

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
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
    var showEditClassDialog by remember { mutableStateOf(false) }
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
                        IconButton(onClick = { showEditClassDialog = true }) {
                            Icon(Icons.Default.Edit, contentDescription = "Sửa lớp", tint = Color(0xFF667EEA))
                        }
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
                                    val dayMap = mapOf("Monday" to "Thứ 2", "Tuesday" to "Thứ 3", "Wednesday" to "Thứ 4", "Thursday" to "Thứ 5", "Friday" to "Thứ 6", "Saturday" to "Thứ 7", "Sunday" to "Chủ nhật")
                                    selectedClass!!.schedule.forEach { sch ->
                                        Text("${dayMap[sch.dayOfWeek] ?: sch.dayOfWeek}: ${sch.startTime} - ${sch.endTime}", fontSize = 14.sp, color = Color(0xFF475569))
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

        // Edit Class Dialog
        if (showEditClassDialog && selectedClass != null) {
            ClassFormDialog(
                title = "Chỉnh sửa Lớp học",
                initialClass = selectedClass!!,
                onDismiss = { showEditClassDialog = false },
                onSave = { name, subject, schedule, feeType, feeAmount ->
                    viewModel.updateClass(name, subject, schedule, feeType, feeAmount)
                    showEditClassDialog = false
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
                        ClassCard(
                            classModel = classModel,
                            onClick = { viewModel.selectClass(classModel) }
                        )
                    }
                }
            }
        }

        // === ADD CLASS DIALOG ===
        if (showAddClassDialog) {
            ClassFormDialog(
                title = "Thêm Lớp Mới",
                initialClass = null,
                onDismiss = { showAddClassDialog = false },
                onSave = { name, subject, schedule, feeType, feeAmount ->
                    viewModel.addClass(name, subject, schedule, feeType, feeAmount)
                    showAddClassDialog = false
                }
            )
        }
    }
}

@Composable
private fun ClassCard(classModel: ClassModel, onClick: () -> Unit) {
    val dayMap = mapOf("Monday" to "T2", "Tuesday" to "T3", "Wednesday" to "T4", "Thursday" to "T5", "Friday" to "T6", "Saturday" to "T7", "Sunday" to "CN")
    Card(
        modifier = Modifier.fillMaxWidth().clickable { onClick() },
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(classModel.name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
            Spacer(modifier = Modifier.height(4.dp))
            Text("Môn: ${classModel.subject}", style = MaterialTheme.typography.bodyMedium)
            Spacer(modifier = Modifier.height(4.dp))
            Text("Sĩ số: ${classModel.studentIds.size} học sinh", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary)
            // Show schedule per entry
            if (classModel.schedule.isNotEmpty()) {
                Spacer(modifier = Modifier.height(4.dp))
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

private data class ScheduleEntry(val dayOfWeek: String, val startTime: String, val endTime: String)

// ====== SHARED CLASS FORM DIALOG (Add + Edit) ======
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ClassFormDialog(
    title: String,
    initialClass: ClassModel?,
    onDismiss: () -> Unit,
    onSave: (String, String, List<Map<String, String>>, String, Double) -> Unit
) {
    val allDays = listOf("Monday" to "T2", "Tuesday" to "T3", "Wednesday" to "T4", "Thursday" to "T5", "Friday" to "T6", "Saturday" to "T7", "Sunday" to "CN")

    var className by remember { mutableStateOf(initialClass?.name ?: "") }
    var subject by remember { mutableStateOf(initialClass?.subject ?: "") }
    var feeAmountText by remember { mutableStateOf(if ((initialClass?.fee?.amount ?: 0.0) > 0) initialClass!!.fee.amount.toLong().toString() else "") }
    var selectedFeeType by remember { mutableStateOf(initialClass?.fee?.type ?: "PER_SESSION") }
    
    // Schedule entries - each is an independent entry (day + start + end)
    var scheduleEntries by remember {
        mutableStateOf(
            if (initialClass != null && initialClass.schedule.isNotEmpty()) {
                initialClass.schedule.map { ScheduleEntry(it.dayOfWeek, it.startTime, it.endTime) }
            } else {
                listOf(ScheduleEntry("Monday", "18:00", "19:30"))
            }
        )
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title, fontWeight = FontWeight.Bold) },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                item {
                    OutlinedTextField(
                        value = className, onValueChange = { className = it },
                        label = { Text("Tên lớp *") }, singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )
                }
                item {
                    OutlinedTextField(
                        value = subject, onValueChange = { subject = it },
                        label = { Text("Môn học *") }, singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )
                }

                // Schedule section
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("📅 Lịch học:", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        TextButton(onClick = {
                            scheduleEntries = scheduleEntries + ScheduleEntry("Monday", "18:00", "19:30")
                        }) {
                            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Thêm buổi", fontSize = 12.sp)
                        }
                    }
                }

                itemsIndexed(scheduleEntries) { index, entry ->
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFF8FAFC)),
                        elevation = CardDefaults.cardElevation(0.dp)
                    ) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("Buổi ${index + 1}", fontWeight = FontWeight.SemiBold, fontSize = 12.sp, color = Color(0xFF667EEA))
                                if (scheduleEntries.size > 1) {
                                    IconButton(
                                        onClick = { scheduleEntries = scheduleEntries.toMutableList().also { it.removeAt(index) } },
                                        modifier = Modifier.size(28.dp)
                                    ) {
                                        Icon(Icons.Default.Close, contentDescription = "Xóa", tint = Color(0xFFEF4444), modifier = Modifier.size(16.dp))
                                    }
                                }
                            }
                            // Day selector dropdown
                            var expanded by remember { mutableStateOf(false) }
                            ExposedDropdownMenuBox(
                                expanded = expanded,
                                onExpandedChange = { expanded = !expanded }
                            ) {
                                OutlinedTextField(
                                    value = allDays.find { it.first == entry.dayOfWeek }?.second ?: entry.dayOfWeek,
                                    onValueChange = {},
                                    readOnly = true,
                                    label = { Text("Thứ", fontSize = 11.sp) },
                                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
                                    modifier = Modifier.menuAnchor().fillMaxWidth(),
                                    shape = RoundedCornerShape(10.dp),
                                    textStyle = androidx.compose.ui.text.TextStyle(fontSize = 14.sp)
                                )
                                ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                                    allDays.forEach { (dayEn, dayVn) ->
                                        DropdownMenuItem(
                                            text = { Text(dayVn) },
                                            onClick = {
                                                scheduleEntries = scheduleEntries.toMutableList().also {
                                                    it[index] = entry.copy(dayOfWeek = dayEn)
                                                }
                                                expanded = false
                                            }
                                        )
                                    }
                                }
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedTextField(
                                    value = entry.startTime,
                                    onValueChange = { newVal ->
                                        scheduleEntries = scheduleEntries.toMutableList().also {
                                            it[index] = entry.copy(startTime = newVal)
                                        }
                                    },
                                    label = { Text("Bắt đầu", fontSize = 11.sp) },
                                    singleLine = true,
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(10.dp),
                                    textStyle = androidx.compose.ui.text.TextStyle(fontSize = 14.sp)
                                )
                                OutlinedTextField(
                                    value = entry.endTime,
                                    onValueChange = { newVal ->
                                        scheduleEntries = scheduleEntries.toMutableList().also {
                                            it[index] = entry.copy(endTime = newVal)
                                        }
                                    },
                                    label = { Text("Kết thúc", fontSize = 11.sp) },
                                    singleLine = true,
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(10.dp),
                                    textStyle = androidx.compose.ui.text.TextStyle(fontSize = 14.sp)
                                )
                            }
                        }
                    }
                }

                // Fee section
                item { Spacer(modifier = Modifier.height(4.dp)) }
                item { Text("💰 Học phí:", fontWeight = FontWeight.Bold, fontSize = 14.sp) }
                item {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        listOf("PER_SESSION" to "Theo buổi", "MONTHLY" to "Theo tháng").forEach { (type, label) ->
                            RadioButton(selected = selectedFeeType == type, onClick = { selectedFeeType = type })
                            Text(label, fontSize = 12.sp)
                            Spacer(modifier = Modifier.width(4.dp))
                        }
                    }
                }
                item {
                    val displayFee = remember(feeAmountText) {
                        val digits = feeAmountText.filter { c -> c.isDigit() }
                        if (digits.isEmpty()) "" else {
                            val num = digits.toLongOrNull() ?: 0L
                            java.text.NumberFormat.getInstance(java.util.Locale("vi", "VN")).format(num)
                        }
                    }
                    OutlinedTextField(
                        value = displayFee,
                        onValueChange = { feeAmountText = it.filter { c -> c.isDigit() } },
                        label = { Text("Số tiền (VNĐ)") },
                        suffix = { Text("đ", fontWeight = FontWeight.Bold, color = Color(0xFF10B981)) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        textStyle = androidx.compose.ui.text.TextStyle(fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (className.isNotBlank() && subject.isNotBlank()) {
                        val schedule = scheduleEntries.map { entry ->
                            mapOf("dayOfWeek" to entry.dayOfWeek, "startTime" to entry.startTime, "endTime" to entry.endTime)
                        }
                        val feeAmount = feeAmountText.filter { it.isDigit() }.toDoubleOrNull() ?: 0.0
                        onSave(className, subject, schedule, selectedFeeType, feeAmount)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF667EEA)),
                shape = RoundedCornerShape(12.dp)
            ) { Text("Lưu", fontWeight = FontWeight.Bold) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Hủy") }
        }
    )
}
