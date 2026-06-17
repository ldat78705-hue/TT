package com.educenter.pro.ui.screens.classes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.educenter.pro.data.model.ClassModel
import com.educenter.pro.data.model.Student
import com.educenter.pro.data.repository.DataRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ClassesViewModel @Inject constructor(
    private val dataRepository: DataRepository
) : ViewModel() {

    private val _classes = MutableStateFlow<List<ClassModel>>(emptyList())
    val classes: StateFlow<List<ClassModel>> = _classes.asStateFlow()

    private val _selectedClassStudents = MutableStateFlow<List<Student>>(emptyList())
    val selectedClassStudents: StateFlow<List<Student>> = _selectedClassStudents.asStateFlow()

    private val _selectedClass = MutableStateFlow<ClassModel?>(null)
    val selectedClass: StateFlow<ClassModel?> = _selectedClass.asStateFlow()

    val currentUserRole = dataRepository.currentUserRole

    init {
        viewModelScope.launch {
            dataRepository.appData.collect { appData ->
                if (appData != null) {
                    _classes.value = appData.classes
                }
            }
        }
        // Sync fresh data from server to pick up class/schedule changes made on Web
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

    fun selectClass(classModel: ClassModel) {
        _selectedClass.value = classModel
        viewModelScope.launch {
            val appData = dataRepository.appData.value
            if (appData != null) {
                val students = appData.students.filter { it.id in classModel.studentIds }
                _selectedClassStudents.value = students
            }
        }
    }

    // Teacher names for the selected class
    val selectedClassTeacherNames: StateFlow<List<String>> = combine(
        dataRepository.appData,
        _selectedClass
    ) { appData, cls ->
        if (appData == null || cls == null) emptyList()
        else appData.teachers.filter { it.id in cls.teacherIds }.map { it.name }
    }.stateIn(viewModelScope, kotlinx.coroutines.flow.SharingStarted.Lazily, emptyList())

    fun markAttendance(studentId: String, status: String) {
        val classId = _selectedClass.value?.id ?: return
        val todayStr = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault()).format(java.util.Date())
        viewModelScope.launch {
            try {
                dataRepository.recordAttendance(classId, studentId, todayStr, status)
            } catch (e: Exception) { e.printStackTrace() }
        }
    }

    fun addClass(name: String, subject: String, schedule: List<Map<String, String>>, feeType: String, feeAmount: Double) {
        val currentClasses = _classes.value.toMutableList()
        val scheduleModels = schedule.map {
            com.educenter.pro.data.model.ClassSchedule(
                dayOfWeek = it["dayOfWeek"] ?: "",
                startTime = it["startTime"] ?: "",
                endTime = it["endTime"] ?: ""
            )
        }
        val newClass = ClassModel(
            id = java.util.UUID.randomUUID().toString(),
            name = name,
            subject = subject,
            studentIds = emptyList(),
            teacherIds = emptyList(),
            schedule = scheduleModels,
            fee = com.educenter.pro.data.model.ClassFee(type = feeType, amount = feeAmount)
        )
        currentClasses.add(newClass)
        viewModelScope.launch {
            dataRepository.saveClasses(currentClasses)
        }
    }

    fun updateClass(name: String, subject: String, schedule: List<Map<String, String>>, feeType: String, feeAmount: Double) {
        val cls = _selectedClass.value ?: return
        val scheduleModels = schedule.map {
            com.educenter.pro.data.model.ClassSchedule(
                dayOfWeek = it["dayOfWeek"] ?: "",
                startTime = it["startTime"] ?: "",
                endTime = it["endTime"] ?: ""
            )
        }
        val updatedCls = cls.copy(
            name = name,
            subject = subject,
            schedule = scheduleModels,
            fee = com.educenter.pro.data.model.ClassFee(type = feeType, amount = feeAmount)
        )
        val currentClasses = _classes.value.toMutableList()
        val index = currentClasses.indexOfFirst { it.id == cls.id }
        if (index != -1) {
            currentClasses[index] = updatedCls
            viewModelScope.launch {
                dataRepository.saveClasses(currentClasses)
                selectClass(updatedCls)
            }
        }
    }

    fun addStudentToClass(studentId: String) {
        val cls = _selectedClass.value ?: return
        val updatedCls = cls.copy(studentIds = cls.studentIds + studentId)
        val currentClasses = _classes.value.toMutableList()
        val index = currentClasses.indexOfFirst { it.id == cls.id }
        if (index != -1) {
            currentClasses[index] = updatedCls
            viewModelScope.launch {
                dataRepository.saveClasses(currentClasses)
                // Select again to refresh students list
                selectClass(updatedCls)
            }
        }
    }

    fun removeStudentFromClass(studentId: String) {
        val cls = _selectedClass.value ?: return
        val updatedCls = cls.copy(studentIds = cls.studentIds.filter { it != studentId })
        val currentClasses = _classes.value.toMutableList()
        val index = currentClasses.indexOfFirst { it.id == cls.id }
        if (index != -1) {
            currentClasses[index] = updatedCls
            viewModelScope.launch {
                dataRepository.saveClasses(currentClasses)
                selectClass(updatedCls)
            }
        }
    }

    fun clearSelection() {
        _selectedClass.value = null
        _selectedClassStudents.value = emptyList()
    }

    // List of students not in the selected class
    val availableStudentsForClass: StateFlow<List<Student>> = combine(
        dataRepository.appData,
        _selectedClass
    ) { appData, cls ->
        if (appData == null || cls == null) emptyList()
        else appData.students.filter { it.id !in cls.studentIds && it.status.name == "ACTIVE" }
    }.stateIn(viewModelScope, kotlinx.coroutines.flow.SharingStarted.Lazily, emptyList())

    // Settings for center name, address, bank info
    val settings = dataRepository.appData
        .map { it?.settings }
        .stateIn(viewModelScope, kotlinx.coroutines.flow.SharingStarted.Lazily, null)
}
