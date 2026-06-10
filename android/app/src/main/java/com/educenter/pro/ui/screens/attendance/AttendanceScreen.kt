package com.educenter.pro.ui.screens.attendance

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AttendanceScreen(
    viewModel: AttendanceViewModel = hiltViewModel()
) {
    val classes by viewModel.classes.collectAsState()
    val scheduledClasses by viewModel.scheduledClasses.collectAsState()
    val selectedClassId by viewModel.selectedClassId.collectAsState()
    val selectedDate by viewModel.selectedDate.collectAsState()
    val students by viewModel.studentsInClass.collectAsState()
    val attendanceRecords by viewModel.attendanceForClass.collectAsState()

    val selectedClassName = classes.find { it.id == selectedClassId }?.name ?: ""

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (selectedClassId == null) "Điểm danh theo Lịch" else "Điểm danh: $selectedClassName") },
                navigationIcon = {
                    if (selectedClassId != null) {
                        IconButton(onClick = { viewModel.selectClass("") }) { // "" acts as null
                            Icon(androidx.compose.material.icons.Icons.Default.ArrowBack, contentDescription = "Trở về")
                        }
                    }
                }
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
            if (selectedClassId.isNullOrEmpty()) {
                // Show Date Selector and Class List
                OutlinedTextField(
                    value = selectedDate,
                    onValueChange = { viewModel.selectDate(it) },
                    label = { Text("Ngày (YYYY-MM-DD)") },
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(16.dp))

                Text("Lịch học ngày $selectedDate", style = MaterialTheme.typography.titleMedium, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
                Spacer(modifier = Modifier.height(8.dp))

                if (scheduledClasses.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("Không có lịch trình nào vào ngày này.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                } else {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(scheduledClasses) { cls ->
                            Card(
                                modifier = Modifier.fillMaxWidth().clickable { viewModel.selectClass(cls.id) },
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Text(cls.name, style = MaterialTheme.typography.titleMedium, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
                                        Text("Sĩ số: ${cls.studentIds.size} học viên", style = MaterialTheme.typography.bodyMedium)
                                    }
                                    Button(onClick = { viewModel.selectClass(cls.id) }) {
                                        Text("Điểm danh")
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                // Show Student List for Attendance
                if (students.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("Lớp này chưa có học viên", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(students) { student ->
                            val record = attendanceRecords.find { it.studentId == student.id }
                            val status = record?.status ?: "NONE"

                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(student.name, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                                    
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Button(
                                            onClick = { viewModel.markAttendance(student.id, "PRESENT") },
                                            colors = ButtonDefaults.buttonColors(
                                                containerColor = if (status == "PRESENT") Color(0xFF10B981) else Color.LightGray
                                            ),
                                            contentPadding = PaddingValues(horizontal = 8.dp)
                                        ) {
                                            Text("Có mặt", color = if (status == "PRESENT") Color.White else Color.Black)
                                        }
                                        
                                        Button(
                                            onClick = { viewModel.markAttendance(student.id, "ABSENT") },
                                            colors = ButtonDefaults.buttonColors(
                                                containerColor = if (status == "ABSENT") Color(0xFFEF4444) else Color.LightGray
                                            ),
                                            contentPadding = PaddingValues(horizontal = 8.dp)
                                        ) {
                                            Text("Vắng", color = if (status == "ABSENT") Color.White else Color.Black)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
