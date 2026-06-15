@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package com.educenter.pro.ui.screens.parent

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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.educenter.pro.ui.components.PullRefreshWrapper
import java.text.NumberFormat
import java.util.Locale

private val GreenPaid = Color(0xFF10B981)
private val RedDebt = Color(0xFFEF4444)
private val YellowUnpaid = Color(0xFFF59E0B)
private val GrayCancel = Color(0xFF9CA3AF)
private val PrimaryBlue = Color(0xFF3B82F6)
private val IndigoAccent = Color(0xFF6366F1)

@Composable
fun ParentFinanceScreen(
    viewModel: ParentDashboardViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val currencyFormatter = remember { NumberFormat.getCurrencyInstance(Locale("vi", "VN")) }

    if (uiState.student == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    val student = uiState.student!!
    val balance = student.balance
    val amountToPay = if (balance < 0) Math.abs(balance) else 0.0
    val canGenerateQR = uiState.bankBin.isNotBlank() && uiState.bankAccountNumber.isNotBlank()
    val transferDescription = "HOC PHI ${student.id}"

    val qrUrl = if (canGenerateQR && amountToPay > 0) {
        "https://img.vietqr.io/image/${uiState.bankBin}-${uiState.bankAccountNumber}-compact2.png?amount=${amountToPay.toLong()}&addInfo=${java.net.URLEncoder.encode(transferDescription, "UTF-8")}&accountName=${java.net.URLEncoder.encode(uiState.bankAccountHolder, "UTF-8")}"
    } else ""

    PullRefreshWrapper(
        isRefreshing = uiState.isRefreshing,
        onRefresh = { viewModel.refresh() },
        modifier = Modifier.fillMaxSize()
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // === DEBT STATUS CARD ===
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (balance < 0) RedDebt.copy(alpha = 0.05f) else GreenPaid.copy(alpha = 0.05f)
                    ),
                    elevation = CardDefaults.cardElevation(2.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            if (balance < 0) Icons.Default.Warning else Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = if (balance < 0) RedDebt else GreenPaid,
                            modifier = Modifier.size(36.dp)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            if (balance < 0) "Công nợ hiện tại" else "Số dư tích lũy",
                            fontSize = 14.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            currencyFormatter.format(Math.abs(balance)),
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (balance < 0) RedDebt else GreenPaid
                        )
                    }
                }
            }

            // === QR CODE PAYMENT ===
            if (amountToPay > 0 && canGenerateQR) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        elevation = CardDefaults.cardElevation(2.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                "💳 Thanh toán Tự động",
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp,
                                color = IndigoAccent
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                "Quét mã QR bằng ứng dụng Ngân hàng để thanh toán",
                                fontSize = 13.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(16.dp))

                            // QR Image
                            Card(
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFFF8FAFC)),
                                elevation = CardDefaults.cardElevation(1.dp)
                            ) {
                                AsyncImage(
                                    model = qrUrl,
                                    contentDescription = "VietQR",
                                    modifier = Modifier.size(200.dp).padding(8.dp),
                                    contentScale = ContentScale.Fit
                                )
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            // Bank info
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = IndigoAccent.copy(alpha = 0.05f))
                            ) {
                                Column(modifier = Modifier.padding(14.dp)) {
                                    Text(
                                        "CHUYỂN KHOẢN THỦ CÔNG",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = IndigoAccent,
                                        letterSpacing = 1.sp
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    BankInfoRow("Ngân hàng", bankNameFromBin(uiState.bankBin))
                                    BankInfoRow("Chủ TK", uiState.bankAccountHolder)
                                    BankInfoRow("Số TK", uiState.bankAccountNumber)
                                    BankInfoRow("Số tiền", currencyFormatter.format(amountToPay))
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text("Nội dung CK:", fontSize = 12.sp, color = Color(0xFF64748B))
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(Color.White)
                                            .padding(10.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            transferDescription,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 16.sp,
                                            color = IndigoAccent,
                                            letterSpacing = 1.sp
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // === INVOICES LIST ===
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Receipt, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(22.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Lịch sử Hóa đơn", fontWeight = FontWeight.Bold, fontSize = 17.sp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("(${uiState.invoices.size})", fontSize = 14.sp, color = Color(0xFF94A3B8))
                }
            }

            if (uiState.invoices.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier.fillMaxWidth().height(100.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("Chưa có hóa đơn nào", color = Color(0xFF94A3B8))
                    }
                }
            } else {
                items(uiState.invoices.sortedByDescending { it.generatedDate }) { invoice ->
                    val statusColor = when (invoice.status) {
                        "PAID" -> GreenPaid
                        "UNPAID" -> YellowUnpaid
                        "CANCELLED" -> GrayCancel
                        else -> Color(0xFF64748B)
                    }
                    val statusLabel = when (invoice.status) {
                        "PAID" -> "Đã trả"
                        "UNPAID" -> "Chưa trả"
                        "CANCELLED" -> "Đã hủy"
                        else -> invoice.status
                    }

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        elevation = CardDefaults.cardElevation(1.dp)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        "Kỳ: ${invoice.month}",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 15.sp,
                                        color = PrimaryBlue
                                    )
                                    Text(
                                        "Ngày tạo: ${invoice.generatedDate}",
                                        fontSize = 12.sp,
                                        color = Color(0xFF94A3B8)
                                    )
                                }
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(statusColor.copy(alpha = 0.1f))
                                        .padding(horizontal = 10.dp, vertical = 4.dp)
                                ) {
                                    Text(statusLabel, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = statusColor)
                                }
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Số tiền:", fontSize = 14.sp, color = Color(0xFF64748B))
                                Text(
                                    currencyFormatter.format(invoice.amount),
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    color = if (invoice.status == "UNPAID") RedDebt else MaterialTheme.colorScheme.onSurface
                                )
                            }
                            if (invoice.status == "PAID" && invoice.paidDate != null) {
                                Text(
                                    "Đã thanh toán: ${invoice.paidDate}",
                                    fontSize = 12.sp,
                                    color = GreenPaid
                                )
                            }
                        }
                    }
                }
            }

            // Bottom padding
            item { Spacer(modifier = Modifier.height(32.dp)) }
        }
    }
}

@Composable
private fun BankInfoRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, fontSize = 13.sp, color = Color(0xFF64748B))
        Text(value, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface)
    }
}

private fun bankNameFromBin(bin: String): String {
    val banks = mapOf(
        "970422" to "MBBank",
        "970436" to "Vietcombank",
        "970415" to "VietinBank",
        "970418" to "BIDV",
        "970405" to "Agribank",
        "970416" to "ACB",
        "970407" to "Techcombank",
        "970423" to "TPBank",
        "970432" to "VPBank",
        "970403" to "Sacombank"
    )
    return banks[bin] ?: "Ngân hàng nhận"
}
