package com.educenter.pro.ui.screens.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.educenter.pro.data.repository.DataRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val dataRepository: DataRepository
) : ViewModel() {

    private val _userEmail = MutableStateFlow(dataRepository.getLoggedInUserName())
    val userEmail = _userEmail.asStateFlow()

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    private val _isLoggedOut = MutableStateFlow(false)
    val isLoggedOut: StateFlow<Boolean> = _isLoggedOut.asStateFlow()

    val currentUserRole = dataRepository.currentUserRole

    val centerName = dataRepository.appData
        .map { it?.settings?.name ?: "" }
        .stateIn(viewModelScope, SharingStarted.Lazily, "")

    fun logout() {
        dataRepository.logout()
        _isLoggedOut.value = true
    }

    fun manualSync() {
        viewModelScope.launch {
            _isSyncing.value = true
            dataRepository.syncData()
            _isSyncing.value = false
        }
    }

    suspend fun changePassword(currentPassword: String, newPassword: String) {
        dataRepository.changePassword(currentPassword, newPassword)
    }
}
