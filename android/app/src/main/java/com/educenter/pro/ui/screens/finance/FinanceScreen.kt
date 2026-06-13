@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package com.educenter.pro.ui.screens.finance

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.educenter.pro.data.model.Student
import com.educenter.pro.ui.components.PullRefreshWrapper
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FinanceScreen(
    viewModel: FinanceViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val paymentResult by viewModel.paymentResult.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()
    val fmt = NumberFormat.getCurrencyInstance(Locale("vi", "VN"))
    var selectedTab by remember { mutableStateOf(0) }
    var paymentStudent by remember { mutableStateOf<DebtStudent?>(null) }

    // Handle payment result
    LaunchedEffect(paymentResult) {
        if (paymentResult?.isSuccess == true || paymentResult?.isError == true) {
            val wasSuccess = paymentResult?.isSuccess == true
            // Auto-clear after a delay
            kotlinx.coroutines.delay(2000)
            viewModel.clearPaymentResult()
            if (wasSuccess) {
                paymentStudent = null
            }
        }
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Quản lý Tài chính") }) }
    ) { padding ->
        PullRefreshWrapper(
            isRefreshing = isRefreshing,
            onRefresh = { viewModel.refresh() },
            modifier = Modifier.fillMaxSize().padding(padding)
        ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Tabs
            TabRow(selectedTabIndex = selectedTab) {
                Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }, text = { Text("Tổng quan") })
                Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }, text = { Text("Công nợ") })
                Tab(selected = selectedTab == 2, onClick = { selectedTab = 2 }, text = { Text("Giao dịch") })
                Tab(selected = selectedTab == 3, onClick = { selectedTab = 3 }, text = { Text("Thu/Chi") })
                Tab(selected = selectedTab == 4, onClick = { selectedTab = 4 }, text = { Text("Lương") })
            }

            when (selectedTab) {
                0 -> OverviewTab(uiState, fmt)
                1 -> DebtTab(uiState, fmt, onCollectFee = { paymentStudent = it })
                2 -> TransactionsTab(uiState, fmt)
                3 -> IncomeExpenseTab(uiState, fmt, viewModel)
                4 -> PayrollTab(uiState, fmt)
            }
        }
        } // PullRefreshWrapper

        // Payment Dialog
        if (paymentStudent != null) {
            PaymentDialog(
                student = paymentStudent!!.student,
                currentDebt = paymentStudent!!.debt,
                paymentResult = paymentResult,
                onDismiss = { paymentStudent = null; viewModel.clearPaymentResult() },
                onConfirm = { amount, method, date ->
                    viewModel.collectFee(
                        studentId = paymentStudent!!.student.id,
                        amount = amount,
                        paymentMethod = method,
                        date = date
                    )
                }
            )
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
                        Text("Dòng tiền (Thu - Chi)", color = Color.White.copy(alpha = 0.95f), fontSize = 15.sp)
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
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Icon(Icons.Default.TrendingUp, contentDescription = null, tint = Color(0xFF10B981))
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Tổng thu", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(fmt.format(uiState.cashRevenue), fontWeight = FontWeight.Bold, color = Color(0xFF059669), fontSize = 17.sp)
                    }
                }
                Card(
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Icon(Icons.Default.TrendingDown, contentDescription = null, tint = Color(0xFFEF4444))
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Tổng chi", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(fmt.format(uiState.totalExpenses), fontWeight = FontWeight.Bold, color = Color(0xFFDC2626), fontSize = 17.sp)
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
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFF59E0B))
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Nợ phải thu", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(fmt.format(uiState.totalReceivables), fontWeight = FontWeight.Bold, color = Color(0xFFD97706), fontSize = 17.sp)
                    }
                }
                Card(
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Icon(Icons.Default.AccountBalanceWallet, contentDescription = null, tint = Color(0xFF8B5CF6))
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Số dư ví HS", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(fmt.format(uiState.totalCredit), fontWeight = FontWeight.Bold, color = Color(0xFF7C3AED), fontSize = 17.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun DebtTab(uiState: FinanceUiState, fmt: NumberFormat, onCollectFee: (DebtStudent) -> Unit) {
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
                Text("${uiState.debtStudents.size} học viên đang nợ", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 15.sp)
                Spacer(modifier = Modifier.height(8.dp))
            }
            itemsIndexed(uiState.debtStudents) { index, item ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp).fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Rank badge
                        Box(
                            modifier = Modifier.size(36.dp).clip(CircleShape)
                                .background(if (index < 3) Color(0xFFEF4444) else Color(0xFF64748B)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("${index + 1}", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        // Student info
                        Column(modifier = Modifier.weight(1f)) {
                            Text(item.student.name, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = MaterialTheme.colorScheme.onBackground)
                            Text(item.student.phone, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                "Nợ: ${fmt.format(item.debt)}",
                                fontWeight = FontWeight.ExtraBold,
                                color = Color(0xFFDC2626),
                                fontSize = 14.sp
                            )
                        }
                        // Collect Fee button
                        Button(
                            onClick = { onCollectFee(item) },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                            shape = RoundedCornerShape(12.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                            modifier = Modifier.height(36.dp)
                        ) {
                            Icon(Icons.Default.Payments, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Thu HP", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }
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
            Text("Chưa có giao dịch nào.", color = MaterialTheme.colorScheme.onSurfaceVariant)
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
                            Text(tx.description, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = MaterialTheme.colorScheme.onBackground, maxLines = 2)
                            Spacer(modifier = Modifier.height(4.dp))
                            Row {
                                Text(tx.date.take(10), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                if (!tx.paymentMethod.isNullOrBlank()) {
                                    Spacer(modifier = Modifier.width(8.dp))
                                    val methodLabel = if (tx.paymentMethod == "cash") "💵 Tiền mặt" else "🏦 Chuyển khoản"
                                    Text(methodLabel, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PaymentDialog(
    student: Student,
    currentDebt: Double,
    paymentResult: PaymentResult?,
    onDismiss: () -> Unit,
    onConfirm: (amount: Double, method: String, date: String) -> Unit
) {
    val fmt = NumberFormat.getCurrencyInstance(Locale("vi", "VN"))
    var amountText by remember { mutableStateOf(currentDebt.toLong().toString()) }
    var paymentMethod by remember { mutableStateOf("transfer") }
    val isLoading = paymentResult?.isLoading == true

    // Current date in yyyy-MM-dd'T'HH:mm:ss format
    val currentDate = remember {
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()).format(Date())
    }

    AlertDialog(
        onDismissRequest = { if (!isLoading) onDismiss() },
        title = {
            Column {
                Text("💰 Thu học phí", fontWeight = FontWeight.ExtraBold)
                Spacer(modifier = Modifier.height(4.dp))
                Text(student.name, fontSize = 14.sp, color = Color(0xFF3B82F6), fontWeight = FontWeight.SemiBold)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                // Current balance
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF2F2))
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp).fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Số dư hiện tại:", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            fmt.format(student.balance),
                            fontWeight = FontWeight.Bold,
                            color = if (student.balance < 0) Color(0xFFEF4444) else Color(0xFF10B981),
                            fontSize = 14.sp
                        )
                    }
                }

                // Amount input with thousand separators
                val displayAmount = remember(amountText) {
                    val digits = amountText.filter { c -> c.isDigit() }
                    if (digits.isEmpty()) "" else {
                        val num = digits.toLongOrNull() ?: 0L
                        java.text.NumberFormat.getInstance(java.util.Locale("vi", "VN")).format(num)
                    }
                }
                OutlinedTextField(
                    value = displayAmount,
                    onValueChange = { newVal ->
                        amountText = newVal.filter { c -> c.isDigit() }
                    },
                    label = { Text("Số tiền thanh toán (VNĐ)") },
                    leadingIcon = { Icon(Icons.Default.Payments, contentDescription = null, tint = Color(0xFF10B981)) },
                    suffix = { Text("đ", fontWeight = FontWeight.Bold, color = Color(0xFF10B981)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    shape = RoundedCornerShape(12.dp),
                    textStyle = androidx.compose.ui.text.TextStyle(
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                )

                // Payment method
                Text("Hình thức thanh toán:", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = paymentMethod == "transfer",
                        onClick = { paymentMethod = "transfer" },
                        label = { Text("🏦 Chuyển khoản", fontSize = 12.sp) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = Color(0xFF3B82F6),
                            selectedLabelColor = Color.White
                        )
                    )
                    FilterChip(
                        selected = paymentMethod == "cash",
                        onClick = { paymentMethod = "cash" },
                        label = { Text("💵 Tiền mặt", fontSize = 12.sp) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = Color(0xFF10B981),
                            selectedLabelColor = Color.White
                        )
                    )
                }

                // Amount preview
                val parsedAmount = amountText.toDoubleOrNull() ?: 0.0
                if (parsedAmount > 0) {
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFF0FDF4))
                    ) {
                        Column(modifier = Modifier.padding(12.dp).fillMaxWidth()) {
                            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                Text("Thanh toán:", fontSize = 13.sp)
                                Text(fmt.format(parsedAmount), fontWeight = FontWeight.Bold, color = Color(0xFF10B981))
                            }
                            val newBalance = student.balance + parsedAmount
                            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                Text("Số dư sau:", fontSize = 13.sp)
                                Text(
                                    fmt.format(newBalance),
                                    fontWeight = FontWeight.Bold,
                                    color = if (newBalance < 0) Color(0xFFEF4444) else Color(0xFF10B981)
                                )
                            }
                        }
                    }
                }

                // Result feedback
                if (paymentResult?.isSuccess == true) {
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFDCFCE7))
                    ) {
                        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF10B981))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(paymentResult.message, color = Color(0xFF166534), fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
                if (paymentResult?.isError == true) {
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFEE2E2))
                    ) {
                        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Error, contentDescription = null, tint = Color(0xFFEF4444))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(paymentResult.message, color = Color(0xFF991B1B), fontSize = 13.sp)
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val amount = amountText.toDoubleOrNull() ?: 0.0
                    if (amount > 0) {
                        onConfirm(amount, paymentMethod, currentDate)
                    }
                },
                enabled = !isLoading && (amountText.toDoubleOrNull() ?: 0.0) > 0,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                shape = RoundedCornerShape(12.dp)
            ) {
                if (isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Đang xử lý...")
                } else {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Xác nhận Ghi sổ", fontWeight = FontWeight.Bold)
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !isLoading) {
                Text("Hủy")
            }
        }
    )
}

@Composable
private fun IncomeExpenseTab(uiState: FinanceUiState, fmt: NumberFormat, viewModel: FinanceViewModel) {
    val totalIncome = uiState.incomeList.sumOf { it.amount }
    val totalExpense = uiState.expenseList.sumOf { it.amount }
    val currentUserRole by viewModel.currentUserRole.collectAsState()
    val canManage = currentUserRole == com.educenter.pro.data.model.UserRole.ADMIN ||
            currentUserRole == com.educenter.pro.data.model.UserRole.MANAGER ||
            currentUserRole == com.educenter.pro.data.model.UserRole.ACCOUNTANT

    var showAddDialog by remember { mutableStateOf(false) }
    var deleteTarget by remember { mutableStateOf<Pair<String, String>?>(null) } // Pair(id, type: "income"/"expense")

    Box(modifier = Modifier.fillMaxSize()) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Summary
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Card(modifier = Modifier.weight(1f), shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFF0FDF4))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Thu khác", fontSize = 14.sp, color = Color(0xFF059669))
                        Text(fmt.format(totalIncome), fontWeight = FontWeight.Bold, color = Color(0xFF059669), fontSize = 16.sp)
                        Text("${uiState.incomeList.size} khoản", fontSize = 12.sp, color = Color(0xFF94A3B8))
                    }
                }
                Card(modifier = Modifier.weight(1f), shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF2F2))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Chi phí", fontSize = 14.sp, color = Color(0xFFDC2626))
                        Text(fmt.format(totalExpense), fontWeight = FontWeight.Bold, color = Color(0xFFDC2626), fontSize = 16.sp)
                        Text("${uiState.expenseList.size} khoản", fontSize = 12.sp, color = Color(0xFF94A3B8))
                    }
                }
            }
        }

        // Income
        if (uiState.incomeList.isNotEmpty()) {
            item { Text("📈 Thu nhập khác", fontWeight = FontWeight.Bold, fontSize = 16.sp, modifier = Modifier.padding(top = 8.dp)) }
            items(uiState.incomeList) { income ->
                Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), elevation = CardDefaults.cardElevation(1.dp)) {
                    Row(modifier = Modifier.padding(12.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(income.description, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                            Text("${income.date.take(10)} • ${income.category}", fontSize = 12.sp, color = Color(0xFF94A3B8))
                        }
                        Text("+${fmt.format(income.amount)}", color = Color(0xFF10B981), fontWeight = FontWeight.Bold)
                        if (canManage) {
                            IconButton(onClick = { deleteTarget = Pair(income.id, "income") }, modifier = Modifier.size(32.dp)) {
                                Icon(Icons.Default.Delete, contentDescription = "Xóa", tint = Color(0xFFEF4444), modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }
            }
        }

        // Expense
        if (uiState.expenseList.isNotEmpty()) {
            item { Text("📉 Chi phí", fontWeight = FontWeight.Bold, fontSize = 16.sp, modifier = Modifier.padding(top = 8.dp)) }
            items(uiState.expenseList) { expense ->
                val isAutoPayroll = expense.id.startsWith("EXP-PAY-")
                Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), elevation = CardDefaults.cardElevation(1.dp)) {
                    Row(modifier = Modifier.padding(12.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(expense.description, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                            Text("${expense.date.take(10)} • ${expense.category}", fontSize = 12.sp, color = Color(0xFF94A3B8))
                        }
                        Text("-${fmt.format(expense.amount)}", color = Color(0xFFEF4444), fontWeight = FontWeight.Bold)
                        if (canManage && !isAutoPayroll) {
                            IconButton(onClick = { deleteTarget = Pair(expense.id, "expense") }, modifier = Modifier.size(32.dp)) {
                                Icon(Icons.Default.Delete, contentDescription = "Xóa", tint = Color(0xFFEF4444), modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }
            }
        }

        if (uiState.incomeList.isEmpty() && uiState.expenseList.isEmpty()) {
            item {
                Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    Text("Chưa có khoản thu/chi nào", color = Color(0xFF94A3B8))
                }
            }
        }
    }

    // FAB
    if (canManage) {
        FloatingActionButton(
            onClick = { showAddDialog = true },
            containerColor = Color(0xFF3B82F6),
            modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp)
        ) {
            Icon(Icons.Default.Add, contentDescription = "Thêm Thu/Chi", tint = Color.White)
        }
    }
    } // Box

    // Delete confirmation
    if (deleteTarget != null) {
        val (id, type) = deleteTarget!!
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Xóa khoản ${if (type == "income") "thu" else "chi"}?") },
            text = { Text("Bạn có chắc muốn xóa khoản này?") },
            confirmButton = {
                Button(
                    onClick = {
                        if (type == "income") viewModel.deleteIncome(id)
                        else viewModel.deleteExpense(id)
                        deleteTarget = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                ) { Text("Xóa") }
            },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Hủy") } }
        )
    }

    // Add dialog
    if (showAddDialog) {
        var isIncome by remember { mutableStateOf(true) }
        var description by remember { mutableStateOf("") }
        var amountText by remember { mutableStateOf("") }
        var category by remember { mutableStateOf("") }
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())

        AlertDialog(
            onDismissRequest = { showAddDialog = false },
            title = { Text("➕ Thêm khoản Thu/Chi", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(
                            selected = isIncome,
                            onClick = { isIncome = true },
                            label = { Text("Thu nhập") },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = Color(0xFF10B981),
                                selectedLabelColor = Color.White
                            )
                        )
                        FilterChip(
                            selected = !isIncome,
                            onClick = { isIncome = false },
                            label = { Text("Chi phí") },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = Color(0xFFEF4444),
                                selectedLabelColor = Color.White
                            )
                        )
                    }
                    OutlinedTextField(
                        value = description, onValueChange = { description = it },
                        label = { Text("Mô tả *") }, singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    )
                    OutlinedTextField(
                        value = amountText, onValueChange = { amountText = it.filter { c -> c.isDigit() || c == '.' } },
                        label = { Text("Số tiền *") }, singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                    )
                    OutlinedTextField(
                        value = category, onValueChange = { category = it },
                        label = { Text("Danh mục") }, singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val amount = amountText.toDoubleOrNull() ?: 0.0
                        if (description.isNotBlank() && amount > 0) {
                            if (isIncome) viewModel.addIncome(description, amount, category.ifBlank { "Khác" }, today)
                            else viewModel.addExpense(description, amount, category.ifBlank { "Khác" }, today)
                            showAddDialog = false
                        }
                    },
                    enabled = description.isNotBlank() && (amountText.toDoubleOrNull() ?: 0.0) > 0,
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = if (isIncome) Color(0xFF10B981) else Color(0xFFEF4444))
                ) { Text("Lưu", fontWeight = FontWeight.Bold) }
            },
            dismissButton = { TextButton(onClick = { showAddDialog = false }) { Text("Hủy") } }
        )
    }
}

@Composable
private fun PayrollTab(uiState: FinanceUiState, fmt: NumberFormat) {
    if (uiState.payrolls.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("💰", fontSize = 48.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Text("Chưa có phiếu lương nào", color = Color(0xFF94A3B8))
            }
        }
    } else {
        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            item {
                Text("${uiState.payrolls.size} phiếu lương", fontWeight = FontWeight.SemiBold, color = Color(0xFF64748B), fontSize = 14.sp)
            }
            items(uiState.payrolls) { payroll ->
                val isPaid = payroll.status == "PAID"
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    elevation = CardDefaults.cardElevation(2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column {
                                Text(payroll.teacherName, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                Text("Tháng ${payroll.month}", fontSize = 13.sp, color = Color(0xFF64748B))
                            }
                            Box(
                                modifier = Modifier.clip(RoundedCornerShape(8.dp))
                                    .background(if (isPaid) Color(0xFF10B981).copy(alpha = 0.1f) else Color(0xFFF59E0B).copy(alpha = 0.1f))
                                    .padding(horizontal = 10.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    if (isPaid) "Đã trả" else "Chưa trả",
                                    fontSize = 12.sp, fontWeight = FontWeight.Bold,
                                    color = if (isPaid) Color(0xFF10B981) else Color(0xFFF59E0B)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("${payroll.sessionsTaught} buổi × ${fmt.format(payroll.rate)}", fontSize = 13.sp, color = Color(0xFF64748B))
                            Text(fmt.format(payroll.totalSalary), fontWeight = FontWeight.ExtraBold, fontSize = 17.sp, color = Color(0xFF3B82F6))
                        }
                    }
                }
            }
        }
    }
}
