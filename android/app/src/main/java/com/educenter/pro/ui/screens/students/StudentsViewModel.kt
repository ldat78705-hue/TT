package com.educenter.pro.ui.screens.students

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.educenter.pro.data.model.Student
import com.educenter.pro.data.model.PersonStatus
import com.educenter.pro.data.repository.DataRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class StudentsViewModel @Inject constructor(
    private val dataRepository: DataRepository
) : ViewModel() {

    private val _searchQuery = MutableStateFlow("")
    val searchQuery = _searchQuery.asStateFlow()

    val currentUserRole = dataRepository.currentUserRole

    private val _allStudents = MutableStateFlow<List<Student>>(emptyList())

    val filteredStudents = combine(_allStudents, _searchQuery) { students, query ->
        if (query.isBlank()) {
            students
        } else {
            val lowerQuery = query.lowercase().trim()
            val matched = students.filter {
                it.name.lowercase().contains(lowerQuery) || 
                it.phone.contains(lowerQuery)
            }
            // Sort: prioritize students whose last name starts with query
            matched.sortedWith(compareBy<Student> { student ->
                val parts = student.name.trim().split("\\s+".toRegex())
                val lastName = parts.lastOrNull()?.lowercase() ?: ""
                when {
                    lastName.startsWith(lowerQuery) -> 0
                    student.name.lowercase().startsWith(lowerQuery) -> 1
                    else -> 2
                }
            }.thenBy { it.name })
        }
    }.stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    val transactions = dataRepository.appData
        .map { it?.transactions ?: emptyList() }
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    val attendanceRecords = dataRepository.appData
        .map { it?.attendance ?: emptyList() }
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    val classes = dataRepository.appData
        .map { it?.classes ?: emptyList() }
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    init {
        viewModelScope.launch {
            dataRepository.appData.collect { appData ->
                if (appData != null) {
                    _allStudents.value = appData.students
                }
            }
        }
    }

    fun onSearchQueryChange(newQuery: String) {
        _searchQuery.value = newQuery
    }

    fun addStudent(
        name: String, 
        phone: String, 
        parentName: String,
        email: String,
        address: String,
        gender: String,
        dob: String,
        discountPercentage: Double,
        status: PersonStatus,
        classIds: List<String>
    ) {
        val newStudent = Student(
            id = java.util.UUID.randomUUID().toString(),
            name = name,
            phone = phone,
            parentName = parentName,
            email = email,
            address = address,
            gender = gender,
            dob = dob,
            discountPercentage = discountPercentage,
            status = status,
            balance = 0.0
        )
        viewModelScope.launch {
            dataRepository.addStudent(newStudent, classIds)
        }
    }

    fun updateStudent(updatedStudent: Student, classIds: List<String>) {
        viewModelScope.launch {
            dataRepository.updateStudent(updatedStudent.id, updatedStudent, classIds)
        }
    }

    fun deleteStudent(studentId: String) {
        viewModelScope.launch {
            dataRepository.deleteStudent(studentId)
        }
    }

    fun collectFee(studentId: String, amount: Double, paymentMethod: String) {
        val todayStr = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault()).format(java.util.Date())
        val description = "Nộp học phí qua App"
        viewModelScope.launch {
            dataRepository.recordTransaction(studentId, amount, description, todayStr, "PAYMENT", paymentMethod)
        }
    }

    // Get classIds for a student
    fun getStudentClassIds(studentId: String): List<String> {
        return classes.value.filter { it.studentIds.contains(studentId) }.map { it.id }
    }
}
