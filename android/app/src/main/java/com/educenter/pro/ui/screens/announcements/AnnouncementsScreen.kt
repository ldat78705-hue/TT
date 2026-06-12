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
    val canManage = currentUserRole == com.educenter.pro.data.model.UserRole.ADMIN || currentUserRole == com.educenter.pro.data.model.UserRole.MANAGER

    var showAddDialog by remember { mutableStateOf(false) }
    var announcementToDelete by remember { mutableStateOf<com.educenter.pro.data.model.Announcement?>(null) }

    Scaffold(
        topBar = { TopAppBar(title = { Text("ThĂ´ng bĂ¡o") }) },
        floatingActionButton = {
            if (canManage) {
                FloatingActionButton(
                    onClick = { showAddDialog = true },
                    containerColor = Color(0xFF3B82F6)
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Táº¡o thĂ´ng bĂ¡o", tint = Color.White)
                }
            }
        }
    ) { padding ->
        if (announcements.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.Campaign, contentDescription = null, modifier = Modifier.size(64.dp), tint = Color(0xFFCBD5E1))
                    Spacer(modifier = Modifier.height(12.dp))
                    Text("ChÆ°a cĂ³ thĂ´ng bĂ¡o nĂ o", fontWeight = FontWeight.Bold, color = Color(0xFF64748B))
                    if (canManage) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Nháº¥n + Ä‘á»ƒ táº¡o thĂ´ng bĂ¡o Ä‘áº§u tiĂªn", fontSize = 13.sp, color = Color(0xFFCBD5E1))
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(announcements) { ann ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Text(ann.title, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color(0xFF3B82F6), modifier = Modifier.weight(1f))
                                if (canManage) {
                                    IconButton(onClick = { announcementToDelete = ann }, modifier = Modifier.size(32.dp)) {
                                        Icon(Icons.Default.Delete, contentDescription = "XĂ³a", tint = Color(0xFFEF4444), modifier = Modifier.size(18.dp))
                                    }
                                }
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(ann.content, color = Color(0xFF475569), lineHeight = 20.sp)
                            Spacer(modifier = Modifier.height(12.dp))
                            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                Text(
                                    "Bá»Ÿi: ${ann.createdBy}",
                                    fontSize = 13.sp,
                                    color = Color(0xFF64748B),
                                    fontWeight = FontWeight.Medium
                                )
                                Text(
                                    ann.createdAt.take(10),
                                    fontSize = 13.sp,
                                    color = Color(0xFF64748B),
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }
                }
            }
        }

        // Delete confirmation
        if (announcementToDelete != null) {
            AlertDialog(
                onDismissRequest = { announcementToDelete = null },
                title = { Text("XĂ¡c nháº­n xĂ³a") },
                text = { Text("Báº¡n cĂ³ cháº¯c muá»‘n xĂ³a thĂ´ng bĂ¡o \"${announcementToDelete?.title}\"?") },
                confirmButton = {
                    Button(
                        onClick = {
                            announcementToDelete?.let { viewModel.deleteAnnouncement(it.id) }
                            announcementToDelete = null
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                    ) { Text("XĂ³a") }
                },
                dismissButton = { TextButton(onClick = { announcementToDelete = null }) { Text("Há»§y") } }
            )
        }

        // Add dialog
        if (showAddDialog) {
            var title by remember { mutableStateOf("") }
            var content by remember { mutableStateOf("") }

            AlertDialog(
                onDismissRequest = { showAddDialog = false },
                title = { Text("Táº¡o ThĂ´ng bĂ¡o má»›i") },
                text = {
                    Column {
                        OutlinedTextField(
                            value = title, onValueChange = { title = it },
                            label = { Text("TiĂªu Ä‘á» *") }, singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        OutlinedTextField(
                            value = content, onValueChange = { content = it },
                            label = { Text("Ná»™i dung *") },
                            modifier = Modifier.fillMaxWidth().height(150.dp),
                            maxLines = 6
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (title.isNotBlank() && content.isNotBlank()) {
                                viewModel.addAnnouncement(title, content, "ALL")
                                showAddDialog = false
                            }
                        }
                    ) { Text("ÄÄƒng") }
                },
                dismissButton = { TextButton(onClick = { showAddDialog = false }) { Text("Há»§y") } }
            )
        }
    }
}
