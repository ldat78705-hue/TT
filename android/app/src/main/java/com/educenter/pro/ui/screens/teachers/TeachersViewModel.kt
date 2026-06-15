package com.educenter.pro.ui.screens.teachers

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.educenter.pro.data.model.Teacher
import com.educenter.pro.data.repository.DataRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class TeachersViewModel @Inject constructor(
    private val dataRepository: DataRepository
) : ViewModel() {

    private val _teachers = MutableStateFlow<List<Teacher>>(emptyList())
    val teachers = _teachers.asStateFlow()

    val currentUserRole = dataRepository.currentUserRole

    init {
        viewModelScope.launch {
            dataRepository.appData.collect { appData ->
                if (appData != null) {
                    _teachers.value = appData.teachers
                }
            }
        }
        // Sync fresh data from server
        viewModelScope.launch {
            try { dataRepository.syncData() } catch (_: Exception) { }
        }
    }

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing = _isRefreshing.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            _isRefreshing.value = true
            try { dataRepository.syncData(force = true) } catch (_: Exception) { }
            _isRefreshing.value = false
        }
    }

    fun addTeacher(name: String, phone: String, subject: String) {
        addTeacher(Teacher(
            id = java.util.UUID.randomUUID().toString(),
            name = name,
            phone = phone,
            subject = subject
        ))
    }

    fun addTeacher(teacher: Teacher) {
        val current = _teachers.value.toMutableList()
        current.add(teacher)
        viewModelScope.launch { dataRepository.saveTeachers(current) }
    }

    fun updateTeacher(teacher: Teacher) {
        val current = _teachers.value.toMutableList()
        val index = current.indexOfFirst { it.id == teacher.id }
        if (index != -1) {
            current[index] = teacher
            viewModelScope.launch { dataRepository.saveTeachers(current) }
        }
    }

    fun deleteTeacher(teacherId: String) {
        val current = _teachers.value.filter { it.id != teacherId }
        viewModelScope.launch { dataRepository.saveTeachers(current) }
    }
}
