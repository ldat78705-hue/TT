@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package com.educenter.pro.ui.screens.classes

import android.content.Context
import android.content.Intent
import android.graphics.*
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import androidx.hilt.navigation.compose.hiltViewModel
import com.educenter.pro.data.model.ClassModel
import com.educenter.pro.data.model.Settings
import com.educenter.pro.data.model.Student
import com.educenter.pro.ui.components.PullRefreshWrapper
import java.io.File
import java.io.FileOutputStream
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

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
    val isRefreshing by viewModel.isRefreshing.collectAsState()
    val currentUserRole by viewModel.currentUserRole.collectAsState()
    val settings by viewModel.settings.collectAsState()
    val canManage = currentUserRole == com.educenter.pro.data.model.UserRole.ADMIN || currentUserRole == com.educenter.pro.data.model.UserRole.MANAGER

    var showAddClassDialog by remember { mutableStateOf(false) }
    var showEditClassDialog by remember { mutableStateOf(false) }
    var showAddStudentDialog by remember { mutableStateOf(false) }
    var studentToRemove by remember { mutableStateOf<Student?>(null) }

    val context = LocalContext.current

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
                        // Send class debt report button
                        IconButton(onClick = {
                            shareClassDebtReport(context, selectedClass!!, students, settings)
                        }) {
                            Icon(Icons.Default.Share, contentDescription = "Gửi công nợ", tint = Color(0xFF0068FF))
                        }
                        if (canManage) {
                            IconButton(onClick = { showEditClassDialog = true }) {
                                Icon(Icons.Default.Edit, contentDescription = "Sửa lớp", tint = Color(0xFF667EEA))
                            }
                            IconButton(onClick = { showAddStudentDialog = true }) {
                                Icon(Icons.Default.PersonAdd, contentDescription = "Thêm học viên")
                            }
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
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                if (selectedClass!!.schedule.isNotEmpty()) {
                                    Text("📅 Lịch học", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Color(0xFF3B82F6))
                                    Spacer(modifier = Modifier.height(8.dp))
                                    val dayMap = mapOf("Monday" to "Thứ 2", "Tuesday" to "Thứ 3", "Wednesday" to "Thứ 4", "Thursday" to "Thứ 5", "Friday" to "Thứ 6", "Saturday" to "Thứ 7", "Sunday" to "Chủ nhật")
                                    selectedClass!!.schedule.forEach { sch ->
                                        Text("${dayMap[sch.dayOfWeek] ?: sch.dayOfWeek}: ${sch.startTime} - ${sch.endTime}", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
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
                        val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("vi", "VN"))
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
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(student.phone, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        if (student.balance < 0) {
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text(
                                                "Nợ: ${currencyFormatter.format(Math.abs(student.balance))}",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = Color(0xFFEF4444),
                                                fontWeight = FontWeight.SemiBold,
                                                fontSize = 12.sp
                                            )
                                        }
                                    }
                                }
                                Row {
                                    // Send individual debt via Zalo
                                    if (student.phone.isNotBlank() && student.balance < 0) {
                                        IconButton(onClick = {
                                            shareStudentDebt(context, student, selectedClass!!.name, settings)
                                        }) {
                                            Icon(Icons.Default.Send, contentDescription = "Gửi công nợ", tint = Color(0xFF0068FF), modifier = Modifier.size(20.dp))
                                        }
                                    }
                                    if (canManage) {
                                        IconButton(onClick = { studentToRemove = student }) {
                                            Icon(Icons.Default.RemoveCircle, contentDescription = "Xóa khỏi lớp", tint = Color(0xFFEF4444))
                                        }
                                    }
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
                if (canManage) {
                    FloatingActionButton(onClick = { showAddClassDialog = true }) {
                        Icon(Icons.Default.Add, contentDescription = "Thêm Lớp")
                    }
                }
            }
        ) { padding ->
            PullRefreshWrapper(
                isRefreshing = isRefreshing,
                onRefresh = { viewModel.refresh() },
                modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp)
            ) {
            Column(modifier = Modifier.fillMaxSize()) {
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
            } // PullRefreshWrapper
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

// ====== Generate and share class debt report as image ======

private fun shareClassDebtReport(context: Context, cls: ClassModel, students: List<Student>, settings: Settings?) {
    val indebtedStudents = students.filter { it.balance < 0 }.sortedBy { it.name }
    if (indebtedStudents.isEmpty()) {
        android.widget.Toast.makeText(context, "Lớp không có học viên nợ học phí!", android.widget.Toast.LENGTH_SHORT).show()
        return
    }

    val centerName = settings?.name ?: "TRUNG TÂM"
    val centerAddress = settings?.address ?: ""
    val bankInfo = buildString {
        if (!settings?.bankAccountNumber.isNullOrBlank()) {
            append("STK: ${settings?.bankAccountNumber} - ${settings?.bankName ?: ""}")
            if (!settings?.bankAccountHolder.isNullOrBlank()) append(" (${settings?.bankAccountHolder})")
        }
    }

    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("vi", "VN"))
    val dateStr = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()).format(Date())

    // Canvas dimensions
    val width = 1200
    val rowHeight = 72
    val headerHeight = 300
    val footerHeight = 120
    val totalHeight = headerHeight + (indebtedStudents.size + 1) * rowHeight + footerHeight + 50

    val bitmap = Bitmap.createBitmap(width, totalHeight, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    canvas.drawColor(android.graphics.Color.WHITE)

    // Paints
    val paintTitle = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.BLACK; textSize = 36f; typeface = Typeface.DEFAULT_BOLD; textAlign = Paint.Align.CENTER }
    val paintSubtitle = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.DKGRAY; textSize = 24f; textAlign = Paint.Align.CENTER }
    val paintHeader = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.BLACK; textSize = 40f; typeface = Typeface.DEFAULT_BOLD; textAlign = Paint.Align.CENTER }
    val paintCell = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.BLACK; textSize = 28f }
    val paintCellBold = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.BLACK; textSize = 28f; typeface = Typeface.DEFAULT_BOLD }
    val paintRed = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.RED; textSize = 28f; typeface = Typeface.DEFAULT_BOLD; textAlign = Paint.Align.RIGHT }
    val paintLine = Paint().apply { color = android.graphics.Color.BLACK; strokeWidth = 2f; style = Paint.Style.STROKE }
    val paintFooter = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.DKGRAY; textSize = 22f; textAlign = Paint.Align.RIGHT }

    // Draw header
    var y = 50f
    canvas.drawText(centerName.uppercase(), width / 2f, y, paintTitle)
    y += 36f
    if (centerAddress.isNotBlank()) {
        canvas.drawText(centerAddress, width / 2f, y, paintSubtitle)
        y += 30f
    }
    if (bankInfo.isNotBlank()) {
        canvas.drawText(bankInfo, width / 2f, y, paintSubtitle)
        y += 30f
    }

    // Divider line
    y += 10f
    canvas.drawLine(40f, y, width - 40f, y, paintLine)
    y += 40f

    canvas.drawText("BÁO CÁO CÔNG NỢ - ${cls.name.uppercase()}", width / 2f, y, paintHeader)
    y += 36f
    canvas.drawText("Ngày lập: $dateStr", width / 2f, y, paintSubtitle)
    y += 50f

    // Table columns: STT | Mã HV | Họ tên | Số dư nợ
    val colX = floatArrayOf(40f, 120f, 360f, width - 40f)
    val tableTop = y

    // Draw table header
    val headerBg = Paint().apply { color = android.graphics.Color.parseColor("#F3F4F6"); style = Paint.Style.FILL }
    canvas.drawRect(colX[0], y, colX[3], y + rowHeight, headerBg)

    val headerY = y + rowHeight * 0.65f
    canvas.drawText("STT", colX[0] + 20f, headerY, paintCellBold)
    canvas.drawText("Mã HV", colX[1] + 10f, headerY, paintCellBold)
    canvas.drawText("Họ tên", colX[2] + 10f, headerY, paintCellBold)
    val rightPaint = Paint(paintCellBold).apply { textAlign = Paint.Align.RIGHT }
    canvas.drawText("Số dư nợ", colX[3] - 20f, headerY, rightPaint)
    y += rowHeight

    // Draw header line
    canvas.drawLine(colX[0], tableTop, colX[3], tableTop, paintLine)
    canvas.drawLine(colX[0], y, colX[3], y, paintLine)

    // Data rows
    var totalDebt = 0.0
    for ((index, student) in indebtedStudents.withIndex()) {
        val cellY = y + rowHeight * 0.65f

        // Alternate row background
        if (index % 2 == 1) {
            val altBg = Paint().apply { color = android.graphics.Color.parseColor("#FAFAFA"); style = Paint.Style.FILL }
            canvas.drawRect(colX[0], y, colX[3], y + rowHeight, altBg)
        }

        canvas.drawText("${index + 1}", colX[0] + 20f, cellY, paintCell)
        val displayId = if (student.id.length > 8) student.id.take(8) + ".." else student.id
        canvas.drawText(displayId, colX[1] + 10f, cellY, paintCell)
        canvas.drawText(student.name, colX[2] + 10f, cellY, paintCellBold)
        canvas.drawText(currencyFormatter.format(Math.abs(student.balance)), colX[3] - 20f, cellY, paintRed)

        totalDebt += student.balance
        y += rowHeight

        // Bottom line
        canvas.drawLine(colX[0], y, colX[3], y, paintLine)
    }

    // Totals row
    val totalBg = Paint().apply { color = android.graphics.Color.parseColor("#FEF2F2"); style = Paint.Style.FILL }
    canvas.drawRect(colX[0], y, colX[3], y + rowHeight, totalBg)
    val totalY = y + rowHeight * 0.65f
    val totalLabel = Paint(paintCellBold).apply { textAlign = Paint.Align.RIGHT; textSize = 30f }
    canvas.drawText("TỔNG CÔNG NỢ:", colX[2] + 400f, totalY, totalLabel)
    val totalAmountPaint = Paint(paintRed).apply { textSize = 32f }
    canvas.drawText(currencyFormatter.format(Math.abs(totalDebt)), colX[3] - 20f, totalY, totalAmountPaint)
    y += rowHeight
    canvas.drawLine(colX[0], y, colX[3], y, paintLine)

    // Vertical lines
    canvas.drawLine(colX[0], tableTop, colX[0], y, paintLine)
    canvas.drawLine(colX[1], tableTop, colX[1], y, paintLine)
    canvas.drawLine(colX[2], tableTop, colX[2], y, paintLine)
    canvas.drawLine(colX[3], tableTop, colX[3], y, paintLine)

    // Footer spacing only
    y += 30f

    // Save and share
    try {
        val file = File(context.cacheDir, "CongNo_${cls.name.replace(" ", "_")}.png")
        FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }

        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "image/png"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_TEXT, "Báo cáo Công nợ - ${cls.name}")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        
        // Try Zalo first
        try {
            val zaloIntent = Intent(shareIntent).apply { setPackage("com.zing.zalo") }
            context.startActivity(zaloIntent)
        } catch (_: Exception) {
            context.startActivity(Intent.createChooser(shareIntent, "Gửi báo cáo công nợ"))
        }
    } catch (e: Exception) {
        android.widget.Toast.makeText(context, "Lỗi: ${e.message}", android.widget.Toast.LENGTH_SHORT).show()
    }
}

// ====== Share individual student debt via Zalo text ======

private fun shareStudentDebt(context: Context, student: Student, className: String, settings: Settings?) {
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("vi", "VN"))
    val debtAmount = currencyFormatter.format(Math.abs(student.balance))
    val parentName = student.parentName.ifBlank { "Phụ huynh" }
    val centerName = settings?.name ?: ""

    val message = buildString {
        appendLine("THÔNG BÁO HỌC PHÍ")
        appendLine(centerName)
        appendLine("---")
        appendLine("Kính gửi: $parentName")
        appendLine("Học viên: ${student.name}")
        appendLine("Lớp: $className")
        appendLine("Công nợ: $debtAmount")
        if (!settings?.bankAccountNumber.isNullOrBlank()) {
            appendLine("---")
            appendLine("Thanh toán: ${settings?.bankName} - ${settings?.bankAccountNumber}")
            if (!settings?.bankAccountHolder.isNullOrBlank()) appendLine("Chủ TK: ${settings?.bankAccountHolder}")
            appendLine("Nội dung CK: HOC PHI ${student.id}")
        }
        appendLine("---")
        appendLine("Vui lòng thanh toán. Xin cảm ơn!")
    }

    try {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, message)
            setPackage("com.zing.zalo")
        }
        context.startActivity(intent)
    } catch (_: Exception) {
        val fallback = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, message)
        }
        context.startActivity(Intent.createChooser(fallback, "Gửi công nợ qua"))
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
                Text(schedText, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
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
                    color = Color(0xFF059669),
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp
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
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
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
                                    label = { Text("Thứ", fontSize = 13.sp) },
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
                                    label = { Text("Bắt đầu", fontSize = 13.sp) },
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
                                    label = { Text("Kết thúc", fontSize = 13.sp) },
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
