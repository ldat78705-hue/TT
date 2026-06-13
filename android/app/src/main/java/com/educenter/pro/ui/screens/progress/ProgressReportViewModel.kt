package com.educenter.pro.ui.screens.progress

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.educenter.pro.data.model.ClassModel
import com.educenter.pro.data.model.ProgressReport
import com.educenter.pro.data.model.Student
import com.educenter.pro.data.repository.DataRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ProgressReportViewModel @Inject constructor(
    private val dataRepository: DataRepository
) : ViewModel() {

    val currentUserRole = dataRepository.currentUserRole

    val classes = dataRepository.appData
        .map { it?.classes ?: emptyList() }
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    val students = dataRepository.appData
        .map { it?.students ?: emptyList() }
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    val progressReports = dataRepository.appData
        .map { (it?.progressReports ?: emptyList()).sortedByDescending { r -> r.date } }
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    private val _selectedClassId = MutableStateFlow<String?>(null)
    val selectedClassId = _selectedClassId.asStateFlow()

    val filteredReports = combine(progressReports, _selectedClassId) { reports, classId ->
        if (classId == null) reports
        else reports.filter { it.classId == classId }
    }.stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    fun selectClass(classId: String?) {
        _selectedClassId.value = classId
    }

    fun addReport(classId: String, studentId: String, date: String, score: Double?, comments: String) {
        viewModelScope.launch {
            try {
                dataRepository.addProgressReport(classId, studentId, date, score, comments)
            } catch (e: Exception) { e.printStackTrace() }
        }
    }

    fun deleteReport(reportId: String) {
        viewModelScope.launch {
            try {
                dataRepository.deleteProgressReport(reportId)
            } catch (e: Exception) { e.printStackTrace() }
        }
    }

    fun getStudentName(studentId: String): String {
        return students.value.find { it.id == studentId }?.name ?: "Không rõ"
    }

    fun getClassName(classId: String): String {
        return classes.value.find { it.id == classId }?.name ?: "Không rõ"
    }
}
