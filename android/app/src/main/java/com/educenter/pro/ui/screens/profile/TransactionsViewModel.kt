package com.educenter.pro.ui.screens.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.educenter.pro.data.model.Transaction
import com.educenter.pro.data.repository.DataRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class TransactionsViewModel @Inject constructor(
    private val dataRepository: DataRepository
) : ViewModel() {

    private val _transactions = MutableStateFlow<List<Transaction>>(emptyList())
    val transactions = _transactions.asStateFlow()

    init {
        viewModelScope.launch {
            dataRepository.appData.collect { appData ->
                if (appData != null) {
                    _transactions.value = appData.transactions
                }
            }
        }
    }
}
