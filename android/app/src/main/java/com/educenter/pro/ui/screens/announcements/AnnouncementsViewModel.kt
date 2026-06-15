package com.educenter.pro.ui.screens.announcements

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.educenter.pro.data.model.Announcement
import com.educenter.pro.data.repository.DataRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AnnouncementsViewModel @Inject constructor(
    private val dataRepository: DataRepository
) : ViewModel() {

    val announcements = dataRepository.appData
        .map { (it?.announcements ?: emptyList()).sortedByDescending { a -> a.createdAt } }
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    val currentUserRole = dataRepository.currentUserRole

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing = _isRefreshing.asStateFlow()

    init {
        // Sync fresh data from server
        viewModelScope.launch {
            try { dataRepository.syncData() } catch (_: Exception) { }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            _isRefreshing.value = true
            try { dataRepository.syncData(force = true) } catch (_: Exception) { }
            _isRefreshing.value = false
        }
    }

    fun addAnnouncement(title: String, content: String, target: String) {
        val createdBy = dataRepository.getLoggedInUserName().ifEmpty { "Admin" }
        viewModelScope.launch {
            dataRepository.addAnnouncement(title, content, createdBy, target)
        }
    }

    fun deleteAnnouncement(id: String) {
        viewModelScope.launch {
            dataRepository.deleteAnnouncement(id)
        }
    }
}
