package com.educenter.pro.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    onLogoutSuccess: () -> Unit,
    onNavigateToTransactions: () -> Unit,
    viewModel: ProfileViewModel = hiltViewModel()
) {
    val email by viewModel.userEmail.collectAsState()
    val isSyncing by viewModel.isSyncing.collectAsState()
    val isLoggedOut by viewModel.isLoggedOut.collectAsState()
    val centerName by viewModel.centerName.collectAsState()
    val currentRole by viewModel.currentUserRole.collectAsState()
    val context = LocalContext.current

    LaunchedEffect(isLoggedOut) {
        if (isLoggedOut) {
            onLogoutSuccess()
        }
    }

    val versionName = try {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "1.0"
    } catch (e: Exception) { "1.0" }

    Column(modifier = Modifier.fillMaxSize().background(Color(0xFFF8FAFC))) {
        // Header with gradient
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Brush.verticalGradient(listOf(Color(0xFF2563EB), Color(0xFF3B82F6))))
                .padding(top = 48.dp, bottom = 32.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    modifier = Modifier.size(80.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.AccountCircle, contentDescription = null, modifier = Modifier.size(56.dp), tint = Color.White)
                }
                Spacer(modifier = Modifier.height(12.dp))
                Text(email.ifBlank { "Người dùng" }, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                if (centerName.isNotBlank()) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(centerName, color = Color.White.copy(alpha = 0.8f), fontSize = 13.sp)
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    "Vai trò: ${currentRole.name}",
                    color = Color.White.copy(alpha = 0.7f),
                    fontSize = 12.sp
                )
            }
        }

        // Menu items
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            ProfileMenuItem(
                icon = Icons.Default.Sync,
                label = if (isSyncing) "Đang đồng bộ..." else "Đồng bộ dữ liệu",
                color = Color(0xFF3B82F6),
                enabled = !isSyncing,
                onClick = viewModel::manualSync
            )

            ProfileMenuItem(
                icon = Icons.Default.Receipt,
                label = "Lịch sử Thu / Chi",
                color = Color(0xFF10B981),
                onClick = onNavigateToTransactions
            )

            // App version
            Text(
                "Phiên bản: v$versionName",
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                fontSize = 13.sp,
                color = Color(0xFF94A3B8),
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(16.dp))

            ProfileMenuItem(
                icon = Icons.Default.Logout,
                label = "Đăng xuất",
                color = Color(0xFFEF4444),
                onClick = viewModel::logout
            )
        }
    }
}

@Composable
private fun ProfileMenuItem(
    icon: ImageVector,
    label: String,
    color: Color,
    enabled: Boolean = true,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        onClick = onClick,
        enabled = enabled
    ) {
        Row(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier.size(40.dp).clip(CircleShape).background(color.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(20.dp))
            }
            Spacer(modifier = Modifier.width(16.dp))
            Text(label, fontWeight = FontWeight.SemiBold, color = if (enabled) Color(0xFF1E293B) else Color(0xFF94A3B8))
        }
    }
}
