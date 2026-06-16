@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package com.educenter.pro.ui.screens.staff

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.background
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.educenter.pro.data.model.Staff
import com.educenter.pro.data.model.UserRole
import com.educenter.pro.ui.components.PullRefreshWrapper
import com.educenter.pro.ui.components.ShimmerLoadingList

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StaffScreen(
    viewModel: StaffViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val currentUserRole by viewModel.currentUserRole.collectAsState()
    val canManage = currentUserRole == UserRole.ADMIN
    var showAddDialog by remember { mutableStateOf(false) }
    var deleteTarget by remember { mutableStateOf<Staff?>(null) }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Quản lý Nhân viên") }) },
        floatingActionButton = {
            if (canManage) {
                FloatingActionButton(
                    onClick = { showAddDialog = true },
                    containerColor = Color(0xFF3B82F6)
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Thêm nhân viên", tint = Color.White)
                }
            }
        }
    ) { padding ->
        if (uiState.isLoading) {
            ShimmerLoadingList()
            return@Scaffold
        }

        PullRefreshWrapper(
            isRefreshing = uiState.isRefreshing,
            onRefresh = { viewModel.refresh() },
            modifier = Modifier.fillMaxSize().padding(padding)
        ) {
            if (uiState.staffList.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("👥", fontSize = 48.sp)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Chưa có nhân viên nào", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("Bấm + để thêm nhân viên", fontSize = 14.sp, color = Color(0xFF94A3B8))
                    }
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    item {
                        Text("${uiState.staffList.size} nhân viên", fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp)
                    }
                    itemsIndexed(uiState.staffList) { index, staff ->
                        StaffCard(staff = staff, canManage = canManage, onDelete = { deleteTarget = staff })
                    }
                }
            }
        }

        // Add Dialog
        if (showAddDialog) {
            AddStaffDialog(
                onDismiss = { showAddDialog = false },
                onConfirm = { name, email, role, password ->
                    viewModel.addStaff(name, email, role, password)
                    showAddDialog = false
                }
            )
        }

        // Delete confirmation
        if (deleteTarget != null) {
            AlertDialog(
                onDismissRequest = { deleteTarget = null },
                title = { Text("Xóa nhân viên?") },
                text = { Text("Bạn có chắc muốn xóa ${deleteTarget!!.name}?") },
                confirmButton = {
                    Button(
                        onClick = {
                            viewModel.deleteStaff(deleteTarget!!.id)
                            deleteTarget = null
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                    ) { Text("Xóa") }
                },
                dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Hủy") } }
            )
        }
    }
}

@Composable
private fun StaffCard(staff: Staff, canManage: Boolean = false, onDelete: () -> Unit) {
    val roleColor = when (staff.role) {
        UserRole.ADMIN -> Color(0xFFEF4444)
        UserRole.MANAGER -> Color(0xFF8B5CF6)
        UserRole.ACCOUNTANT -> Color(0xFF10B981)
        UserRole.TEACHER -> Color(0xFF3B82F6)
        else -> Color(0xFF64748B)
    }

    val roleLabel = when (staff.role) {
        UserRole.ADMIN -> "Quản trị"
        UserRole.MANAGER -> "Quản lý"
        UserRole.ACCOUNTANT -> "Kế toán"
        UserRole.TEACHER -> "Giáo viên"
        UserRole.VIEWER -> "Xem"
        UserRole.PARENT -> "Phụ huynh"
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Row(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier.size(44.dp).clip(CircleShape)
                    .background(roleColor.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Person, contentDescription = null, tint = roleColor, modifier = Modifier.size(24.dp))
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(staff.name, fontWeight = FontWeight.Bold, fontSize = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(staff.email, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(4.dp))
                Box(
                    modifier = Modifier.clip(RoundedCornerShape(6.dp))
                        .background(roleColor.copy(alpha = 0.1f))
                        .padding(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Text(roleLabel, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = roleColor)
                }
            }
            if (canManage) {
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, contentDescription = "Xóa", tint = Color(0xFFEF4444))
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddStaffDialog(
    onDismiss: () -> Unit,
    onConfirm: (name: String, email: String, role: String, password: String) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var selectedRole by remember { mutableStateOf("MANAGER") }

    val roles = listOf("MANAGER" to "Quản lý", "ACCOUNTANT" to "Kế toán")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("👤 Thêm nhân viên", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = name, onValueChange = { name = it },
                    label = { Text("Tên nhân viên") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp), singleLine = true
                )
                OutlinedTextField(
                    value = email, onValueChange = { email = it },
                    label = { Text("Email") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp), singleLine = true
                )
                OutlinedTextField(
                    value = password, onValueChange = { password = it },
                    label = { Text("Mật khẩu") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp), singleLine = true
                )

                Text("Vai trò:", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    roles.forEach { (value, label) ->
                        FilterChip(
                            selected = selectedRole == value,
                            onClick = { selectedRole = value },
                            label = { Text(label, fontSize = 12.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = Color(0xFF3B82F6),
                                selectedLabelColor = Color.White
                            )
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { if (name.isNotBlank()) onConfirm(name, email, selectedRole, password) },
                enabled = name.isNotBlank(),
                shape = RoundedCornerShape(12.dp)
            ) { Text("Thêm", fontWeight = FontWeight.Bold) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Hủy") } }
    )
}
