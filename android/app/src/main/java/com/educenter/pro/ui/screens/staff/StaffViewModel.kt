package com.educenter.pro.ui.screens.staff

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.educenter.pro.data.model.Staff
import com.educenter.pro.data.model.UserRole
import com.educenter.pro.data.repository.DataRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class StaffUiState(
    val staffList: List<Staff> = emptyList(),
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val error: String? = null,
    val isSaving: Boolean = false,
    val saveSuccess: Boolean? = null
)

@HiltViewModel
class StaffViewModel @Inject constructor(
    private val repository: DataRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(StaffUiState())
    val uiState: StateFlow<StaffUiState> = _uiState.asStateFlow()

    val currentUserRole = repository.currentUserRole

    init {
        loadData()
    }

    private fun loadData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            repository.syncData()
            updateFromRepo()
            _uiState.value = _uiState.value.copy(isLoading = false)
        }
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isRefreshing = true)
            repository.syncData(force = true)
            updateFromRepo()
            _uiState.value = _uiState.value.copy(isRefreshing = false)
        }
    }

    private fun updateFromRepo() {
        val data = repository.appData.value ?: return
        _uiState.value = _uiState.value.copy(staffList = data.staff)
    }

    fun addStaff(name: String, email: String, role: String, password: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSaving = true)
            try {
                repository.addStaff(name, email, role, password)
                updateFromRepo()
                _uiState.value = _uiState.value.copy(isSaving = false, saveSuccess = true)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isSaving = false, error = e.message)
            }
        }
    }

    fun deleteStaff(staffId: String) {
        viewModelScope.launch {
            try {
                repository.deleteStaff(staffId)
                updateFromRepo()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = e.message)
            }
        }
    }

    fun clearResult() {
        _uiState.value = _uiState.value.copy(saveSuccess = null, error = null)
    }
}
