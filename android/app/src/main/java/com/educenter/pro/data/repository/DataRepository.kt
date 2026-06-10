package com.educenter.pro.data.repository

import android.content.SharedPreferences
import com.educenter.pro.data.local.ShardDao
import com.educenter.pro.data.local.ShardEntity
import com.educenter.pro.data.model.AppData
import com.educenter.pro.data.model.AttendanceRecord
import com.educenter.pro.data.model.Announcement
import com.educenter.pro.data.model.ClassModel
import com.educenter.pro.data.model.Student
import com.educenter.pro.data.model.Teacher
import com.educenter.pro.data.remote.ApiService
import com.educenter.pro.data.remote.LoginRequest
import com.educenter.pro.data.remote.OperationPayload
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DataRepository @Inject constructor(
    private val apiService: ApiService,
    private val shardDao: ShardDao,
    private val gson: Gson,
    private val prefs: SharedPreferences
) {
    private val _appData = MutableStateFlow<AppData?>(null)
    val appData: StateFlow<AppData?> = _appData.asStateFlow()

    private val _currentUserRole = MutableStateFlow<com.educenter.pro.data.model.UserRole>(com.educenter.pro.data.model.UserRole.VIEWER)
    val currentUserRole: StateFlow<com.educenter.pro.data.model.UserRole> = _currentUserRole.asStateFlow()

    init {
        val savedRole = prefs.getString("user_role", null)
        if (savedRole != null) {
            try {
                _currentUserRole.value = com.educenter.pro.data.model.UserRole.valueOf(savedRole)
            } catch (e: Exception) {}
        }
    }
    
    fun isUserLoggedIn(): Boolean {
        return prefs.getString("user_token", null) != null
    }

    suspend fun loginLocal(identifier: String, passwordRaw: String): Boolean {
        try {
            val response = apiService.login(LoginRequest(identifier, passwordRaw))
            if (response.token != null) {
                val roleStr = response.role ?: "VIEWER"
                prefs.edit()
                    .putString("user_token", response.token)
                    .putString("user_role", roleStr)
                    .apply()
                _currentUserRole.value = com.educenter.pro.data.model.UserRole.valueOf(roleStr)
                return true
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return false
    }

    fun logout() {
        prefs.edit().clear().apply()
        _currentUserRole.value = com.educenter.pro.data.model.UserRole.VIEWER
        _appData.value = null
        kotlinx.coroutines.CoroutineScope(Dispatchers.IO).launch { shardDao.clearAll() }
    }

    suspend fun syncData() = withContext(Dispatchers.IO) {
        try {
            val data = apiService.getAppData()
            _appData.value = data
            val json = gson.toJson(data)
            shardDao.clearAll()
            shardDao.insertShards(listOf(ShardEntity(id = "app_data", data = json)))
        } catch (e: Exception) {
            e.printStackTrace()
            try {
                val shards = shardDao.getAllShards()
                val mainShard = shards.find { it.id == "app_data" }
                if (mainShard != null) {
                    _appData.value = gson.fromJson(mainShard.data, AppData::class.java)
                } else {
                    _appData.value = AppData()
                }
            } catch (e2: Exception) {
                _appData.value = AppData()
            }
        }
    }

    suspend fun recordAttendance(classId: String, studentId: String, dateStr: String, status: String) = withContext(Dispatchers.IO) {
        try {
            val op = OperationPayload("updateSingleAttendance", mapOf(
                "classId" to classId, "studentId" to studentId, "date" to dateStr, "status" to status
            ))
            val updatedData = apiService.executeOperation(op)
            _appData.value = updatedData
            shardDao.insertShards(listOf(ShardEntity(id = "app_data", data = gson.toJson(updatedData))))
        } catch (e: Exception) {
            e.printStackTrace()
            throw e
        }
    }

    suspend fun recordTransaction(studentId: String, amount: Double, description: String, dateStr: String, type: String, paymentMethod: String? = null) = withContext(Dispatchers.IO) {
        try {
            val op = OperationPayload("addAdjustment", mapOf(
                "studentId" to studentId, "amount" to amount, "date" to dateStr, "description" to description, "type" to type, "paymentMethod" to paymentMethod
            ))
            val updatedData = apiService.executeOperation(op)
            _appData.value = updatedData
            shardDao.insertShards(listOf(ShardEntity(id = "app_data", data = gson.toJson(updatedData))))
        } catch (e: Exception) { e.printStackTrace() }
    }

    suspend fun saveStudents(newStudents: List<Student>) = withContext(Dispatchers.IO) {
        val current = _appData.value?.students ?: emptyList()
        val added = newStudents.filter { n -> current.none { it.id == n.id } }
        val modified = newStudents.filter { n -> current.any { it.id == n.id && it != n } }
        val deleted = current.filter { c -> newStudents.none { it.id == c.id } }

        try {
            var latest = _appData.value
            for (s in added) latest = apiService.executeOperation(OperationPayload("addStudent", mapOf("student" to s, "classIds" to emptyList<String>())))
            for (s in modified) latest = apiService.executeOperation(OperationPayload("updateStudent", mapOf("originalId" to s.id, "updatedStudent" to s, "classIds" to emptyList<String>())))
            for (s in deleted) latest = apiService.executeOperation(OperationPayload("deleteStudent", mapOf("studentId" to s.id)))
            _appData.value = latest
            if(latest != null) shardDao.insertShards(listOf(ShardEntity(id = "app_data", data = gson.toJson(latest))))
        } catch (e: Exception) { e.printStackTrace() }
    }

    suspend fun saveTeachers(newTeachers: List<Teacher>) = withContext(Dispatchers.IO) {
        val current = _appData.value?.teachers ?: emptyList()
        val added = newTeachers.filter { n -> current.none { it.id == n.id } }
        val modified = newTeachers.filter { n -> current.any { it.id == n.id && it != n } }
        val deleted = current.filter { c -> newTeachers.none { it.id == c.id } }

        try {
            var latest = _appData.value
            for (t in added) latest = apiService.executeOperation(OperationPayload("addTeacher", t))
            for (t in modified) latest = apiService.executeOperation(OperationPayload("updateTeacher", mapOf("originalId" to t.id, "updatedTeacher" to t)))
            for (t in deleted) latest = apiService.executeOperation(OperationPayload("deleteTeacher", mapOf("teacherId" to t.id)))
            _appData.value = latest
            if(latest != null) shardDao.insertShards(listOf(ShardEntity(id = "app_data", data = gson.toJson(latest))))
        } catch (e: Exception) { e.printStackTrace() }
    }

    suspend fun saveClasses(newClasses: List<ClassModel>) = withContext(Dispatchers.IO) {
        val current = _appData.value?.classes ?: emptyList()
        val added = newClasses.filter { n -> current.none { it.id == n.id } }
        val modified = newClasses.filter { n -> current.any { it.id == n.id && it != n } }
        val deleted = current.filter { c -> newClasses.none { it.id == c.id } }

        try {
            var latest = _appData.value
            for (c in added) latest = apiService.executeOperation(OperationPayload("addClass", c))
            for (c in modified) latest = apiService.executeOperation(OperationPayload("updateClass", mapOf("originalId" to c.id, "updatedClass" to c)))
            for (c in deleted) latest = apiService.executeOperation(OperationPayload("deleteClass", mapOf("classId" to c.id)))
            _appData.value = latest
            if(latest != null) shardDao.insertShards(listOf(ShardEntity(id = "app_data", data = gson.toJson(latest))))
        } catch (e: Exception) { e.printStackTrace() }
    }

    suspend fun saveAnnouncements(newAnnouncements: List<Announcement>) = withContext(Dispatchers.IO) {
        try {
            // For announcements, we can just replace them entirely via a new operation or mock it locally if API doesn't support
            val op = OperationPayload("executeCustom", mapOf("action" to "replaceAnnouncements", "data" to newAnnouncements))
            val updatedData = apiService.executeOperation(op)
            _appData.value = updatedData
            shardDao.insertShards(listOf(ShardEntity(id = "app_data", data = gson.toJson(updatedData))))
        } catch (e: Exception) { e.printStackTrace() }
    }
}
