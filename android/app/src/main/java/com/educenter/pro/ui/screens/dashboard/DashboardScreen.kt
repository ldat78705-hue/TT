package com.educenter.pro.ui.screens.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import java.text.NumberFormat
import java.util.Locale

@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    if (uiState.isLoading) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = androidx.compose.ui.Alignment.Center) {
            CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
        }
        return
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Text("Tổng quan", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            Spacer(modifier = Modifier.height(12.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                DashboardCard(
                    title = "Tổng học sinh",
                    value = uiState.totalStudents.toString(),
                    modifier = Modifier.weight(1f),
                    color = MaterialTheme.colorScheme.secondaryContainer,
                    contentColor = MaterialTheme.colorScheme.onSecondaryContainer
                )
                val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("vi", "VN"))
                DashboardCard(
                    title = "Doanh thu tháng",
                    value = currencyFormatter.format(uiState.monthlyRevenue),
                    modifier = Modifier.weight(1f),
                    color = MaterialTheme.colorScheme.tertiaryContainer,
                    contentColor = MaterialTheme.colorScheme.onTertiaryContainer
                )
            }
            Spacer(modifier = Modifier.height(24.dp))
            Text("Lịch học hôm nay", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            Spacer(modifier = Modifier.height(8.dp))
        }

        if (uiState.todayClasses.isEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp)
                ) {
                    Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = androidx.compose.ui.Alignment.Center) {
                        Text("Không có lịch học nào hôm nay 🎉", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        } else {
            items(uiState.todayClasses) { classModel ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(classModel.name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("Môn: ${classModel.subject}", style = MaterialTheme.typography.bodyMedium)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("Sĩ số: ${classModel.studentIds.size} học sinh", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary)
                    }
                }
            }
        }

        if (uiState.announcements.isNotEmpty()) {
            item {
                Spacer(modifier = Modifier.height(24.dp))
                Text("Bảng tin", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                Spacer(modifier = Modifier.height(8.dp))
            }
            items(uiState.announcements) { announcement ->
                Card(
                    modifier = Modifier.fillMaxWidth(), 
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(announcement.title, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onPrimaryContainer, style = MaterialTheme.typography.titleMedium)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(announcement.content, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("Bởi: ${announcement.createdBy} • ${announcement.createdAt.take(10)}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha=0.7f))
                    }
                }
            }
        }
    }
}

@Composable
fun DashboardCard(title: String, value: String, modifier: Modifier = Modifier, color: androidx.compose.ui.graphics.Color, contentColor: androidx.compose.ui.graphics.Color) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = color, contentColor = contentColor),
        shape = androidx.compose.foundation.shape.RoundedCornerShape(20.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Text(title, style = MaterialTheme.typography.labelLarge, color = contentColor.copy(alpha = 0.8f))
            Spacer(modifier = Modifier.height(12.dp))
            Text(value, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold)
        }
    }
}
