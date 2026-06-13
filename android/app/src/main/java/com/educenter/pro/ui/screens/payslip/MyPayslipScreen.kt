@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package com.educenter.pro.ui.screens.payslip

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.educenter.pro.data.model.Payroll
import com.educenter.pro.data.repository.DataRepository
import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import java.text.NumberFormat
import java.util.Locale
import javax.inject.Inject

@HiltViewModel
class MyPayslipViewModel @Inject constructor(
    private val dataRepository: DataRepository
) : ViewModel() {

    val myPayrolls: StateFlow<List<Payroll>> = dataRepository.appData
        .map { data ->
            val email = dataRepository.getLoggedInUserEmail()
            val teacher = data?.teachers?.find { it.email == email }
            if (teacher != null) {
                data.payrolls
                    .filter { it.teacherId == teacher.id }
                    .sortedByDescending { it.month }
            } else {
                emptyList()
            }
        }
        .stateIn(kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main), SharingStarted.Lazily, emptyList())

    val teacherName: StateFlow<String> = dataRepository.appData
        .map { data ->
            val email = dataRepository.getLoggedInUserEmail()
            data?.teachers?.find { it.email == email }?.name ?: ""
        }
        .stateIn(kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main), SharingStarted.Lazily, "")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MyPayslipScreen(
    onBack: () -> Unit = {},
    viewModel: MyPayslipViewModel = hiltViewModel()
) {
    val payrolls by viewModel.myPayrolls.collectAsState()
    val teacherName by viewModel.teacherName.collectAsState()
    val fmt = NumberFormat.getCurrencyInstance(Locale("vi", "VN"))

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Bảng lương của tôi", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Trở về")
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Header card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    elevation = CardDefaults.cardElevation(4.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Brush.linearGradient(listOf(Color(0xFF10B981), Color(0xFF059669))))
                            .padding(20.dp)
                    ) {
                        Column {
                            Text("👨‍🏫 $teacherName", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("Lịch sử ${payrolls.size} bảng lương", color = Color.White.copy(alpha = 0.8f), fontSize = 14.sp)

                            if (payrolls.isNotEmpty()) {
                                Spacer(modifier = Modifier.height(12.dp))
                                val total = payrolls.sumOf { it.totalSalary }
                                Text("Tổng đã nhận: ${fmt.format(total)}", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp)
                            }
                        }
                    }
                }
            }

            if (payrolls.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(40.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("💰", fontSize = 48.sp)
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("Chưa có dữ liệu bảng lương", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            } else {
                items(payrolls) { payroll ->
                    PayslipCard(payroll = payroll, fmt = fmt)
                }
            }
        }
    }
}

@Composable
private fun PayslipCard(payroll: Payroll, fmt: NumberFormat) {
    val isPaid = payroll.status == "PAID"

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header: Month + Status
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "Tháng ${payroll.month}",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (isPaid) Color(0xFF10B981).copy(alpha = 0.1f) else Color(0xFFF59E0B).copy(alpha = 0.1f))
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        if (isPaid) "✅ Đã trả" else "⏳ Chưa trả",
                        color = if (isPaid) Color(0xFF10B981) else Color(0xFFF59E0B),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Spacer(modifier = Modifier.height(12.dp))

            // Details
            PayslipRow("Số buổi dạy", "${payroll.sessionsTaught} buổi")
            PayslipRow("Đơn giá / buổi", fmt.format(payroll.rate))
            PayslipRow("Lương cơ bản", fmt.format(payroll.baseSalary))
            if (payroll.bonus > 0) PayslipRow("Thưởng", "+${fmt.format(payroll.bonus)}", Color(0xFF10B981))
            if (payroll.deduction > 0) PayslipRow("Khấu trừ", "-${fmt.format(payroll.deduction)}", Color(0xFFEF4444))

            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Spacer(modifier = Modifier.height(8.dp))

            // Total
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("TỔNG LƯƠNG", fontWeight = FontWeight.ExtraBold, fontSize = 15.sp, color = MaterialTheme.colorScheme.onBackground)
                Text(fmt.format(payroll.totalSalary), fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, color = Color(0xFF3B82F6))
            }

            // Class details
            if (payroll.classDetails.isNotEmpty()) {
                Spacer(modifier = Modifier.height(12.dp))
                Text("📋 Chi tiết theo lớp:", fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(4.dp))
                payroll.classDetails.forEach { detail ->
                    Text(
                        "  • ${detail.className}: ${detail.sessionsTaught} buổi",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Paid date
            if (isPaid && payroll.paidDate != null) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "Ngày trả: ${payroll.paidDate}",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.End,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

@Composable
private fun PayslipRow(label: String, value: String, valueColor: Color = MaterialTheme.colorScheme.onBackground) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = valueColor)
    }
}
