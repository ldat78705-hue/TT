package com.educenter.pro.data.repository

import android.content.SharedPreferences
import com.educenter.pro.data.local.PendingOperationDao
import com.educenter.pro.data.local.PendingOperationEntity
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
    private val pendingOpDao: PendingOperationDao,
    private val gson: Gson,
    private val prefs: SharedPreferences
) {
    private val _appData = MutableStateFlow<AppData?>(null)
    val appData: StateFlow<AppData?> = _appData.asStateFlow()

    private val _pendingOpsCount = MutableStateFlow(0)
    val pendingOpsCount: StateFlow<Int> = _pendingOpsCount.asStateFlow()

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

    fun getLoggedInUserName(): String {
        return prefs.getString("user_name", null) ?: prefs.getString("user_email", null) ?: ""
    }

    fun getCenterId(): String {
        return prefs.getString("center_id", null) ?: ""
    }

    suspend fun loginLocal(identifier: String, passwordRaw: String): Boolean {
        try {
            val response = apiService.login(LoginRequest(identifier, passwordRaw))
            if (response.token != null) {
                val roleStr = response.role ?: "VIEWER"
                // Extract user name and id from response user object (Map)
                val userName = when (val user = response.user) {
                    is Map<*, *> -> user["name"]?.toString() ?: identifier
                    else -> identifier
                }
                val userId = when (val user = response.user) {
                    is Map<*, *> -> user["id"]?.toString() ?: identifier
                    else -> identifier
                }
                prefs.edit()
                    .putString("user_token", response.token)
                    .putString("user_role", roleStr)
                    .putString("user_email", identifier)
                    .putString("user_name", userName)
                    .putString("user_id", userId)
                    .putString("center_id", response.centerId ?: "")
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
        _pendingOpsCount.value = 0
        kotlinx.coroutines.CoroutineScope(Dispatchers.IO).launch {
            shardDao.clearAll()
            pendingOpDao.clearAll()
        }
    }

    suspend fun syncData() = withContext(Dispatchers.IO) {
        try {
            // First, try to sync any pending offline operations
            syncPendingOperations()
            
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
        _pendingOpsCount.value = pendingOpDao.getPendingCount()
    }

    private suspend fun saveAndCache(updatedData: AppData) {
        _appData.value = updatedData
        shardDao.insertShards(listOf(ShardEntity(id = "app_data", data = gson.toJson(updatedData))))
    }

    // ============ ATTENDANCE ============

    // BATCH save - mirrors Web's updateAttendance (1 API call for all students)
    // Supports OFFLINE mode: queues operation if network fails
    suspend fun recordAttendanceBatch(
        classId: String,
        date: String,
        entries: Map<String, Map<String, String>> // studentId -> {status, note}
    ) = withContext(Dispatchers.IO) {
        val records = entries.map { (studentId, data) ->
            mapOf(
                "classId" to classId,
                "studentId" to studentId,
                "date" to date,
                "status" to (data["status"] ?: "UNMARKED"),
                "note" to (data["note"] ?: "")
            )
        }
        try {
            val op = OperationPayload("updateAttendance", records)
            val updatedData = apiService.executeOperation(op)
            saveAndCache(updatedData)
        } catch (e: Exception) {
            // OFFLINE FALLBACK: Queue the operation for later sync
            val payloadJson = gson.toJson(mapOf("op" to "updateAttendance", "payload" to records))
            pendingOpDao.insert(PendingOperationEntity(
                operationName = "updateAttendance",
                payload = payloadJson
            ))
            _pendingOpsCount.value = pendingOpDao.getPendingCount()

            // Optimistic local update: update cached attendance data
            val currentData = _appData.value
            if (currentData != null) {
                val updatedAttendance = currentData.attendance.toMutableList()
                // Remove existing records for this class/date
                updatedAttendance.removeAll { it.classId == classId && it.date == date }
                // Add new records
                records.forEach { r ->
                    updatedAttendance.add(com.educenter.pro.data.model.AttendanceRecord(
                        id = "PENDING-${System.currentTimeMillis()}-${r["studentId"]}",
                        classId = classId,
                        studentId = r["studentId"] ?: "",
                        date = date,
                        status = r["status"] ?: "UNMARKED",
                        note = r["note"] ?: ""
                    ))
                }
                val updatedData = currentData.copy(attendance = updatedAttendance)
                _appData.value = updatedData
                shardDao.insertShards(listOf(ShardEntity(id = "app_data", data = gson.toJson(updatedData))))
            }
            // Don't throw - silently queued
        }
    }

    // Single attendance (kept for backward compat)
    suspend fun recordAttendance(classId: String, studentId: String, dateStr: String, status: String, note: String? = null) = withContext(Dispatchers.IO) {
        try {
            val payload = mutableMapOf(
                "classId" to classId, "studentId" to studentId, "date" to dateStr, "status" to status
            )
            if (!note.isNullOrBlank()) payload["note"] = note
            val op = OperationPayload("updateSingleAttendance", payload)
            val updatedData = apiService.executeOperation(op)
            saveAndCache(updatedData)
        } catch (e: Exception) {
            e.printStackTrace()
            throw e
        }
    }

    // Delete attendance for a date
    suspend fun deleteAttendanceForDate(classId: String, date: String) = withContext(Dispatchers.IO) {
        try {
            val op = OperationPayload("deleteAttendanceForDate", mapOf("classId" to classId, "date" to date))
            val updatedData = apiService.executeOperation(op)
            saveAndCache(updatedData)
        } catch (e: Exception) {
            e.printStackTrace()
            throw e
        }
    }

    // ============ TRANSACTIONS ============

    suspend fun recordTransaction(studentId: String, amount: Double, description: String, dateStr: String, type: String, paymentMethod: String? = null) = withContext(Dispatchers.IO) {
        addAdjustment(studentId, amount, dateStr, description, type, paymentMethod ?: "transfer")
    }

    // ============ STUDENTS ============

    suspend fun addStudent(student: Student, classIds: List<String>) = withContext(Dispatchers.IO) {
        try {
            val op = OperationPayload("addStudent", mapOf("student" to student, "classIds" to classIds))
            val updatedData = apiService.executeOperation(op)
            saveAndCache(updatedData)
        } catch (e: Exception) { e.printStackTrace() }
    }

    suspend fun updateStudent(originalId: String, updatedStudent: Student, classIds: List<String>) = withContext(Dispatchers.IO) {
        try {
            val op = OperationPayload("updateStudent", mapOf(
                "originalId" to originalId, "updatedStudent" to updatedStudent, "classIds" to classIds
            ))
            val updatedData = apiService.executeOperation(op)
            saveAndCache(updatedData)
        } catch (e: Exception) { e.printStackTrace() }
    }

    suspend fun deleteStudent(studentId: String) = withContext(Dispatchers.IO) {
        try {
            val op = OperationPayload("deleteStudent", mapOf("studentId" to studentId))
            val updatedData = apiService.executeOperation(op)
            saveAndCache(updatedData)
        } catch (e: Exception) { e.printStackTrace() }
    }

    // Legacy bulk save (kept for compat)
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

    // ============ TEACHERS ============

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

    // ============ CLASSES ============

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

    // ============ ANNOUNCEMENTS ============

    suspend fun addAnnouncement(title: String, content: String, createdBy: String, targetAudience: String = "ALL") = withContext(Dispatchers.IO) {
        try {
            val payload = mapOf(
                "title" to title,
                "content" to content,
                "createdBy" to createdBy,
                "targetAudience" to targetAudience
            )
            val updatedData = apiService.executeOperation(OperationPayload("addAnnouncement", payload))
            saveAndCache(updatedData)
        } catch (e: Exception) { e.printStackTrace(); throw e }
    }

    suspend fun deleteAnnouncement(announcementId: String) = withContext(Dispatchers.IO) {
        try {
            val updatedData = apiService.executeOperation(OperationPayload("deleteAnnouncement", mapOf("id" to announcementId)))
            saveAndCache(updatedData)
        } catch (e: Exception) { e.printStackTrace(); throw e }
    }

    // ============ PROGRESS REPORTS ============

    suspend fun addProgressReport(classId: String, studentId: String, date: String, score: Double?, comments: String) = withContext(Dispatchers.IO) {
        try {
            val payload = mutableMapOf<String, Any>(
                "classId" to classId,
                "studentId" to studentId,
                "date" to date,
                "comments" to comments,
                "createdBy" to getLoggedInUserName()
            )
            if (score != null) payload["score"] = score
            val updatedData = apiService.executeOperation(OperationPayload("addProgressReport", payload))
            saveAndCache(updatedData)
        } catch (e: Exception) { e.printStackTrace(); throw e }
    }

    suspend fun deleteProgressReport(reportId: String) = withContext(Dispatchers.IO) {
        try {
            val updatedData = apiService.executeOperation(OperationPayload("deleteProgressReport", mapOf("reportId" to reportId)))
            saveAndCache(updatedData)
        } catch (e: Exception) { e.printStackTrace(); throw e }
    }

    // ============ INCOME / EXPENSE ============

    suspend fun addIncome(description: String, amount: Double, category: String, date: String) = withContext(Dispatchers.IO) {
        try {
            val payload = mapOf(
                "description" to description,
                "amount" to amount,
                "category" to category,
                "date" to date
            )
            val updatedData = apiService.executeOperation(OperationPayload("addIncome", payload))
            saveAndCache(updatedData)
        } catch (e: Exception) { e.printStackTrace(); throw e }
    }

    suspend fun deleteIncome(itemId: String) = withContext(Dispatchers.IO) {
        try {
            val updatedData = apiService.executeOperation(OperationPayload("deleteIncome", mapOf("itemId" to itemId)))
            saveAndCache(updatedData)
        } catch (e: Exception) { e.printStackTrace(); throw e }
    }

    suspend fun addExpense(description: String, amount: Double, category: String, date: String) = withContext(Dispatchers.IO) {
        try {
            val payload = mapOf(
                "description" to description,
                "amount" to amount,
                "category" to category,
                "date" to date
            )
            val updatedData = apiService.executeOperation(OperationPayload("addExpense", payload))
            saveAndCache(updatedData)
        } catch (e: Exception) { e.printStackTrace(); throw e }
    }

    suspend fun deleteExpense(itemId: String) = withContext(Dispatchers.IO) {
        try {
            val updatedData = apiService.executeOperation(OperationPayload("deleteExpense", mapOf("itemId" to itemId)))
            saveAndCache(updatedData)
        } catch (e: Exception) { e.printStackTrace(); throw e }
    }

    // ============ PAYMENTS / ADJUSTMENTS ============

    suspend fun addAdjustment(
        studentId: String,
        amount: Double,
        date: String,
        description: String,
        type: String, // "CREDIT" or "DEBIT"
        paymentMethod: String = "transfer"
    ) = withContext(Dispatchers.IO) {
        try {
            val payload = mapOf(
                "studentId" to studentId,
                "amount" to amount,
                "date" to date,
                "description" to description,
                "type" to type,
                "paymentMethod" to paymentMethod
            )
            val updatedData = apiService.executeOperation(OperationPayload("addAdjustment", payload))
            saveAndCache(updatedData)
        } catch (e: Exception) { e.printStackTrace(); throw e }
    }


    // ============ OFFLINE SYNC ============

    // ============ STAFF ============

    suspend fun addStaff(name: String, email: String, role: String, password: String) = withContext(Dispatchers.IO) {
        try {
            val payload = mapOf("name" to name, "email" to email, "role" to role, "password" to password)
            val updatedData = apiService.executeOperation(OperationPayload("addStaff", payload))
            saveAndCache(updatedData)
        } catch (e: Exception) { e.printStackTrace(); throw e }
    }

    suspend fun updateStaff(originalId: String, name: String, email: String, role: String, password: String) = withContext(Dispatchers.IO) {
        try {
            val payload = mapOf("originalId" to originalId, "name" to name, "email" to email, "role" to role, "password" to password)
            val updatedData = apiService.executeOperation(OperationPayload("updateStaff", payload))
            saveAndCache(updatedData)
        } catch (e: Exception) { e.printStackTrace(); throw e }
    }

    suspend fun deleteStaff(staffId: String) = withContext(Dispatchers.IO) {
        try {
            val updatedData = apiService.executeOperation(OperationPayload("deleteStaff", mapOf("staffId" to staffId)))
            saveAndCache(updatedData)
        } catch (e: Exception) { e.printStackTrace(); throw e }
    }

    // ============ CHANGE PASSWORD ============

    fun getLoggedInUserEmail(): String {
        return prefs.getString("user_email", null) ?: ""
    }

    fun getLoggedInUserId(): String {
        return prefs.getString("user_id", null) ?: prefs.getString("user_email", null) ?: ""
    }

    suspend fun changePassword(currentPassword: String, newPassword: String) = withContext(Dispatchers.IO) {
        // Verify current password by attempting a login
        try {
            val email = getLoggedInUserEmail()
            if (email.isBlank()) throw Exception("Không tìm thấy thông tin đăng nhập")

            // Find current user's ID from app data
            val data = _appData.value ?: throw Exception("Chưa tải dữ liệu")
            val role = _currentUserRole.value

            // Find user in the appropriate list based on role
            val userId = when (role) {
                com.educenter.pro.data.model.UserRole.ADMIN,
                com.educenter.pro.data.model.UserRole.MANAGER,
                com.educenter.pro.data.model.UserRole.ACCOUNTANT,
                com.educenter.pro.data.model.UserRole.VIEWER -> {
                    data.staff.find { it.email == email || it.id == email }?.id
                        ?: data.teachers.find { it.email == email || it.id == email }?.id
                        ?: if (email == "ADMIN_USER") "ADMIN_USER" else throw Exception("Không tìm thấy tài khoản")
                }
                com.educenter.pro.data.model.UserRole.TEACHER -> {
                    data.teachers.find { it.email == email || it.id == email }?.id
                        ?: throw Exception("Không tìm thấy tài khoản giáo viên")
                }
                com.educenter.pro.data.model.UserRole.PARENT -> {
                    data.students.find { it.id == getLoggedInUserId() }?.id
                        ?: throw Exception("Không tìm thấy tài khoản học sinh")
                }
            }

            // Map role to the format expected by the server
            val roleStr = when (role) {
                com.educenter.pro.data.model.UserRole.TEACHER -> "TEACHER"
                com.educenter.pro.data.model.UserRole.PARENT -> "STUDENT"
                else -> role.name
            }

            val payload = mapOf(
                "userId" to userId,
                "role" to roleStr,
                "newPassword" to newPassword,
                "currentPassword" to currentPassword
            )

            val updatedData = apiService.executeOperation(OperationPayload("updateUserPassword", payload))
            saveAndCache(updatedData)
        } catch (e: Exception) {
            e.printStackTrace()
            throw e
        }
    }

    // ============ OFFLINE SYNC ============

    suspend fun refreshPendingCount() = withContext(Dispatchers.IO) {
        _pendingOpsCount.value = pendingOpDao.getPendingCount()
    }

    /**
     * Replay all pending offline operations to the server.
     * Called automatically when network becomes available.
     * Returns number of successfully synced operations.
     */
    suspend fun syncPendingOperations(): Int = withContext(Dispatchers.IO) {
        val pending = pendingOpDao.getPending()
        if (pending.isEmpty()) return@withContext 0

        var successCount = 0
        for (op in pending) {
            try {
                pendingOpDao.updateStatus(op.id, "SYNCING")

                // Parse the stored JSON payload
                val parsed = gson.fromJson(op.payload, Map::class.java) as? Map<String, Any?> ?: emptyMap()
                val opName = parsed["op"] as? String ?: op.operationName
                val payload: Any = parsed["payload"] ?: emptyList<Any>()

                val operationPayload = OperationPayload(opName, payload)
                val updatedData = apiService.executeOperation(operationPayload)
                saveAndCache(updatedData)

                // Success - remove from queue
                pendingOpDao.delete(op.id)
                successCount++
            } catch (e: Exception) {
                e.printStackTrace()
                // Failed - mark as FAILED but keep in queue for retry
                pendingOpDao.updateStatus(op.id, "PENDING")
                break // Stop trying if one fails (likely still offline)
            }
        }

        _pendingOpsCount.value = pendingOpDao.getPendingCount()
        return@withContext successCount
    }
}
