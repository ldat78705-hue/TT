package com.educenter.pro.ui.screens.attendance

import androidx.compose.foundation.layout.*
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
    val selectedClassId by viewModel.selectedClassId.collectAsState()
    val selectedDate by viewModel.selectedDate.collectAsState()
    val students by viewModel.studentsInClass.collectAsState()
    val attendanceRecords by viewModel.attendanceForClass.collectAsState()

    var expanded by remember { mutableStateOf(false) }

    val selectedClassName = classes.find { it.id == selectedClassId }?.name ?: "Chọn lớp học"

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Điểm danh") })
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
            // Class Selector
            ExposedDropdownMenuBox(
                expanded = expanded,
                onExpandedChange = { expanded = !expanded }
            ) {
                OutlinedTextField(
                    value = selectedClassName,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Lớp học") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                    modifier = Modifier.menuAnchor().fillMaxWidth()
                )
                ExposedDropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false }
                ) {
                    classes.forEach { cls ->
                        DropdownMenuItem(
                            text = { Text(cls.name) },
                            onClick = {
                                viewModel.selectClass(cls.id)
                                expanded = false
                            }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Date Selector
            OutlinedTextField(
                value = selectedDate,
                onValueChange = { viewModel.selectDate(it) },
                label = { Text("Ngày (YYYY-MM-DD)") },
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))

            if (selectedClassId == null) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Vui lòng chọn lớp học", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            } else if (students.isEmpty()) {
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
                                        )
                                    ) {
                                        Text("Có mặt", color = if (status == "PRESENT") Color.White else Color.Black)
                                    }
                                    
                                    Button(
                                        onClick = { viewModel.markAttendance(student.id, "ABSENT") },
                                        colors = ButtonDefaults.buttonColors(
                                            containerColor = if (status == "ABSENT") Color(0xFFEF4444) else Color.LightGray
                                        )
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
