package com.educenter.pro.ui.screens.finance

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.educenter.pro.data.model.Student
import com.educenter.pro.data.model.Transaction
import com.educenter.pro.data.model.Income
import com.educenter.pro.data.model.Invoice
import com.educenter.pro.data.model.Expense
import com.educenter.pro.data.model.Payroll
import com.educenter.pro.data.repository.DataRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DebtStudent(val student: Student, val debt: Double)

data class FinanceUiState(
    val cashRevenue: Double = 0.0,
    val totalExpenses: Double = 0.0,
    val cashFlow: Double = 0.0,
    val totalReceivables: Double = 0.0,
    val totalCredit: Double = 0.0,
    val debtStudents: List<DebtStudent> = emptyList(),
    val recentTransactions: List<Transaction> = emptyList(),
    val incomeList: List<Income> = emptyList(),
    val expenseList: List<Expense> = emptyList(),
    val payrolls: List<Payroll> = emptyList(),
    val invoices: List<Invoice> = emptyList(),
    val isLoading: Boolean = true
)

@HiltViewModel
class FinanceViewModel @Inject constructor(
    private val dataRepository: DataRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(FinanceUiState())
    val uiState: StateFlow<FinanceUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            dataRepository.appData.collect { appData ->
                if (appData == null) return@collect

                // Cash Revenue = Tuition collected (positive transactions) + Other Income
                val tuitionCollected = appData.transactions
                    .filter { it.amount > 0 }
                    .sumOf { it.amount }

                val otherIncome = appData.income
                    .sumOf { it.amount }

                val cashRevenue = tuitionCollected + otherIncome

                // Total Expenses = from expenses records (NOT negative transactions)
                val totalExpenses = appData.expenses
                    .sumOf { it.amount }

                val totalReceivables = appData.students
                    .filter { it.balance < 0 }
                    .sumOf { -it.balance }

                val totalCredit = appData.students
                    .filter { it.balance > 0 }
                    .sumOf { it.balance }

                val debtStudents = appData.students
                    .filter { it.balance < 0 && it.status.name == "ACTIVE" }
                    .sortedBy { it.balance }
                    .map { DebtStudent(it, -it.balance) }

                val recentTransactions = appData.transactions
                    .sortedByDescending { it.date }
                    .take(20)

                _uiState.value = FinanceUiState(
                    cashRevenue = cashRevenue,
                    totalExpenses = totalExpenses,
                    cashFlow = cashRevenue - totalExpenses,
                    totalReceivables = totalReceivables,
                    totalCredit = totalCredit,
                    debtStudents = debtStudents,
                    recentTransactions = recentTransactions,
                    incomeList = appData.income.sortedByDescending { it.date },
                    expenseList = appData.expenses.sortedByDescending { it.date },
                    payrolls = appData.payrolls.sortedByDescending { it.month },
                    invoices = appData.invoices.sortedByDescending { it.generatedDate },
                    isLoading = false
                )
            }
        }
        // Sync fresh data from server
        viewModelScope.launch {
            try { dataRepository.syncData() } catch (_: Exception) { }
        }
    }

    private val _paymentResult = MutableStateFlow<PaymentResult?>(null)
    val paymentResult: StateFlow<PaymentResult?> = _paymentResult.asStateFlow()

    fun clearPaymentResult() { _paymentResult.value = null }

    fun collectFee(
        studentId: String,
        amount: Double,
        paymentMethod: String, // "transfer" or "cash"
        date: String
    ) {
        viewModelScope.launch {
            _paymentResult.value = PaymentResult(isLoading = true)
            try {
                val userName = dataRepository.getLoggedInUserName()
                val description = "Thanh toán HP - ghi nhận bởi $userName (App)"
                dataRepository.addAdjustment(
                    studentId = studentId,
                    amount = amount,
                    date = date,
                    description = description,
                    type = "CREDIT",
                    paymentMethod = paymentMethod
                )
                _paymentResult.value = PaymentResult(isSuccess = true, message = "Ghi nhận thành công!")
            } catch (e: Exception) {
                _paymentResult.value = PaymentResult(isError = true, message = e.message ?: "Lỗi khi ghi nhận thanh toán")
            }
        }
    }

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing = _isRefreshing.asStateFlow()

    val currentUserRole = dataRepository.currentUserRole

    fun refresh() {
        viewModelScope.launch {
            _isRefreshing.value = true
            try { dataRepository.syncData(force = true) } catch (_: Exception) { }
            _isRefreshing.value = false
        }
    }

    fun addIncome(description: String, amount: Double, category: String, date: String) {
        viewModelScope.launch {
            try { dataRepository.addIncome(description, amount, category, date) }
            catch (e: Exception) { e.printStackTrace() }
        }
    }

    fun deleteIncome(itemId: String) {
        viewModelScope.launch {
            try { dataRepository.deleteIncome(itemId) }
            catch (e: Exception) { e.printStackTrace() }
        }
    }

    fun addExpense(description: String, amount: Double, category: String, date: String) {
        viewModelScope.launch {
            try { dataRepository.addExpense(description, amount, category, date) }
            catch (e: Exception) { e.printStackTrace() }
        }
    }

    fun deleteExpense(itemId: String) {
        viewModelScope.launch {
            try { dataRepository.deleteExpense(itemId) }
            catch (e: Exception) { e.printStackTrace() }
        }
    }
}

data class PaymentResult(
    val isLoading: Boolean = false,
    val isSuccess: Boolean = false,
    val isError: Boolean = false,
    val message: String = ""
)

