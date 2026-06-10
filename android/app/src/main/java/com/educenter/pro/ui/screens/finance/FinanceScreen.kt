package com.educenter.pro.ui.screens.finance

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FinanceScreen(
    viewModel: FinanceViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val fmt = NumberFormat.getCurrencyInstance(Locale("vi", "VN"))
    var selectedTab by remember { mutableStateOf(0) }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Quản lý Tài chính") }) }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            // Tabs
            TabRow(selectedTabIndex = selectedTab) {
                Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }, text = { Text("Tổng quan") })
                Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }, text = { Text("Công nợ") })
                Tab(selected = selectedTab == 2, onClick = { selectedTab = 2 }, text = { Text("Giao dịch") })
            }

            when (selectedTab) {
                0 -> OverviewTab(uiState, fmt)
                1 -> DebtTab(uiState, fmt)
                2 -> TransactionsTab(uiState, fmt)
            }
        }
    }
}

@Composable
private fun OverviewTab(uiState: FinanceUiState, fmt: NumberFormat) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Cash flow card
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Brush.linearGradient(
                            if (uiState.cashFlow >= 0) listOf(Color(0xFF10B981), Color(0xFF059669))
                            else listOf(Color(0xFFEF4444), Color(0xFFDC2626))
                        ))
                        .padding(24.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                        Text("Dòng tiền (Thu - Chi)", color = Color.White.copy(alpha = 0.9f), fontSize = 14.sp)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(fmt.format(uiState.cashFlow), color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 28.sp)
                    }
                }
            }
        }

        // Revenue + Expense
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Card(
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Icon(Icons.Default.TrendingUp, contentDescription = null, tint = Color(0xFF10B981))
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Tổng thu", fontSize = 12.sp, color = Color(0xFF64748B))
                        Text(fmt.format(uiState.cashRevenue), fontWeight = FontWeight.Bold, color = Color(0xFF10B981), fontSize = 16.sp)
                    }
                }
                Card(
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Icon(Icons.Default.TrendingDown, contentDescription = null, tint = Color(0xFFEF4444))
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Tổng chi", fontSize = 12.sp, color = Color(0xFF64748B))
                        Text(fmt.format(uiState.totalExpenses), fontWeight = FontWeight.Bold, color = Color(0xFFEF4444), fontSize = 16.sp)
                    }
                }
            }
        }

        // Receivables + Credit
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Card(
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFF59E0B))
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Nợ phải thu", fontSize = 12.sp, color = Color(0xFF64748B))
                        Text(fmt.format(uiState.totalReceivables), fontWeight = FontWeight.Bold, color = Color(0xFFF59E0B), fontSize = 16.sp)
                    }
                }
                Card(
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Icon(Icons.Default.AccountBalanceWallet, contentDescription = null, tint = Color(0xFF8B5CF6))
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Số dư ví HS", fontSize = 12.sp, color = Color(0xFF64748B))
                        Text(fmt.format(uiState.totalCredit), fontWeight = FontWeight.Bold, color = Color(0xFF8B5CF6), fontSize = 16.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun DebtTab(uiState: FinanceUiState, fmt: NumberFormat) {
    if (uiState.debtStudents.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("🎉", fontSize = 48.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Text("Không có học viên nợ!", fontWeight = FontWeight.Bold, color = Color(0xFF10B981))
            }
        }
    } else {
        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            item {
                Text("${uiState.debtStudents.size} học viên đang nợ", fontWeight = FontWeight.Bold, color = Color(0xFF64748B))
                Spacer(modifier = Modifier.height(8.dp))
            }
            itemsIndexed(uiState.debtStudents) { index, item ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp).fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier.size(36.dp).clip(CircleShape)
                                .background(if (index < 3) Color(0xFFEF4444) else Color(0xFF94A3B8)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("${index + 1}", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(item.student.name, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            Text(item.student.phone, fontSize = 12.sp, color = Color(0xFF64748B))
                        }
                        Text(
                            fmt.format(item.debt),
                            fontWeight = FontWeight.ExtraBold,
                            color = Color(0xFFEF4444),
                            fontSize = 15.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TransactionsTab(uiState: FinanceUiState, fmt: NumberFormat) {
    if (uiState.recentTransactions.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("Chưa có giao dịch nào.", color = Color(0xFF64748B))
        }
    } else {
        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(uiState.recentTransactions) { tx ->
                val isPositive = tx.amount > 0
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp).fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(tx.description, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, maxLines = 2)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(tx.date, fontSize = 12.sp, color = Color(0xFF94A3B8))
                        }
                        Text(
                            text = (if (isPositive) "+" else "") + fmt.format(tx.amount),
                            color = if (isPositive) Color(0xFF10B981) else Color(0xFFEF4444),
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 15.sp
                        )
                    }
                }
            }
        }
    }
}
