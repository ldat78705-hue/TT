package com.educenter.pro.ui.screens.profile

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
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

    LaunchedEffect(isLoggedOut) {
        if (isLoggedOut) {
            onLogoutSuccess()
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(title = { Text("Tài khoản") })
        
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                Icons.Default.AccountCircle,
                contentDescription = null,
                modifier = Modifier.size(100.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text("Xin chào,", style = MaterialTheme.typography.bodyLarge)
            Text(email, style = MaterialTheme.typography.headlineSmall, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
            
            Spacer(modifier = Modifier.height(48.dp))

            Button(
                onClick = viewModel::manualSync,
                modifier = Modifier.fillMaxWidth().height(50.dp),
                enabled = !isSyncing
            ) {
                if (isSyncing) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), color = MaterialTheme.colorScheme.onPrimary)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Đang đồng bộ...")
                } else {
                    Icon(Icons.Default.Sync, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Đồng bộ dữ liệu")
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            Button(
                onClick = onNavigateToTransactions,
                modifier = Modifier.fillMaxWidth().height(50.dp)
            ) {
                Text("Lịch sử Thu / Chi")
            }

            Spacer(modifier = Modifier.height(16.dp))

            OutlinedButton(
                onClick = viewModel::logout,
                modifier = Modifier.fillMaxWidth().height(50.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
            ) {
                Icon(Icons.Default.Logout, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Đăng xuất")
            }
        }
    }
}
