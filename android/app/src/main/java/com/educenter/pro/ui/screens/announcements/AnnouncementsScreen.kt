@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package com.educenter.pro.ui.screens.announcements

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import com.educenter.pro.ui.components.PullRefreshWrapper
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnnouncementsScreen(
    viewModel: AnnouncementsViewModel = hiltViewModel()
) {
    val announcements by viewModel.announcements.collectAsState()
    val currentUserRole by viewModel.currentUserRole.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()
    val canManage = currentUserRole == com.educenter.pro.data.model.UserRole.ADMIN || currentUserRole == com.educenter.pro.data.model.UserRole.MANAGER || currentUserRole == com.educenter.pro.data.model.UserRole.TEACHER

    var showAddDialog by remember { mutableStateOf(false) }
    var announcementToDelete by remember { mutableStateOf<com.educenter.pro.data.model.Announcement?>(null) }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Thông báo") }) },
        floatingActionButton = {
            if (canManage) {
                FloatingActionButton(
                    onClick = { showAddDialog = true },
                    containerColor = Color(0xFF3B82F6)
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Tạo thông báo", tint = Color.White)
                }
            }
        }
    ) { padding ->
      PullRefreshWrapper(isRefreshing = isRefreshing, onRefresh = { viewModel.refresh() }, modifier = Modifier.fillMaxSize().padding(padding)) {
        if (announcements.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.Campaign, contentDescription = null, modifier = Modifier.size(64.dp), tint = Color(0xFFCBD5E1))
                    Spacer(modifier = Modifier.height(12.dp))
                    Text("Chưa có thông báo nào", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (canManage) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Nhấn + để tạo thông báo đầu tiên", fontSize = 13.sp, color = Color(0xFFCBD5E1))
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(announcements) { ann ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Text(ann.title, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color(0xFF3B82F6), modifier = Modifier.weight(1f))
                                if (canManage) {
                                    IconButton(onClick = { announcementToDelete = ann }, modifier = Modifier.size(32.dp)) {
                                        Icon(Icons.Default.Delete, contentDescription = "Xóa", tint = Color(0xFFEF4444), modifier = Modifier.size(18.dp))
                                    }
                                }
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(ann.content, color = MaterialTheme.colorScheme.onSurfaceVariant, lineHeight = 20.sp)
                            Spacer(modifier = Modifier.height(12.dp))
                            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                Text(
                                    "Bởi: ${ann.createdBy}",
                                    fontSize = 13.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    fontWeight = FontWeight.Medium
                                )
                                Text(
                                    ann.createdAt.take(10),
                                    fontSize = 13.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }
                }
            }
        }
      } // PullRefreshWrapper

        // Delete confirmation
        if (announcementToDelete != null) {
            AlertDialog(
                onDismissRequest = { announcementToDelete = null },
                title = { Text("Xác nhận xóa") },
                text = { Text("Bạn có chắc muốn xóa thông báo \"${announcementToDelete?.title}\"?") },
                confirmButton = {
                    Button(
                        onClick = {
                            announcementToDelete?.let { viewModel.deleteAnnouncement(it.id) }
                            announcementToDelete = null
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                    ) { Text("Xóa") }
                },
                dismissButton = { TextButton(onClick = { announcementToDelete = null }) { Text("Hủy") } }
            )
        }

        // Add dialog
        if (showAddDialog) {
            var title by remember { mutableStateOf("") }
            var content by remember { mutableStateOf("") }
            var selectedTarget by remember { mutableStateOf("ALL") }
            val targetOptions = listOf("ALL" to "Tất cả", "TEACHERS" to "Giáo viên", "STUDENTS" to "Học viên")

            AlertDialog(
                onDismissRequest = { showAddDialog = false },
                title = { Text("Tạo Thông báo mới") },
                text = {
                    Column {
                        OutlinedTextField(
                            value = title, onValueChange = { title = it },
                            label = { Text("Tiêu đề *") }, singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        OutlinedTextField(
                            value = content, onValueChange = { content = it },
                            label = { Text("Nội dung *") },
                            modifier = Modifier.fillMaxWidth().height(120.dp),
                            maxLines = 5
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("Đối tượng nhận:", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            targetOptions.forEach { (key, label) ->
                                FilterChip(
                                    selected = selectedTarget == key,
                                    onClick = { selectedTarget = key },
                                    label = { Text(label, fontSize = 13.sp) }
                                )
                            }
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (title.isNotBlank() && content.isNotBlank()) {
                                viewModel.addAnnouncement(title, content, selectedTarget)
                                showAddDialog = false
                            }
                        }
                    ) { Text("Đăng") }
                },
                dismissButton = { TextButton(onClick = { showAddDialog = false }) { Text("Hủy") } }
            )
        }
    }
}
