package com.educenter.pro.data.repository

import com.educenter.pro.data.local.ShardDao
import com.educenter.pro.data.local.ShardEntity
import com.educenter.pro.data.model.AppData
import com.educenter.pro.data.model.AttendanceRecord
import com.educenter.pro.data.model.Announcement
import com.educenter.pro.data.model.ClassModel
import com.educenter.pro.data.model.Settings
import com.educenter.pro.data.model.Student
import com.educenter.pro.data.model.Teacher
import com.educenter.pro.data.model.Transaction
import com.google.firebase.firestore.FirebaseFirestore
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DataRepository @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val shardDao: ShardDao,
    private val gson: Gson
) {
    private val _appData = MutableStateFlow<AppData?>(null)
    val appData: StateFlow<AppData?> = _appData.asStateFlow()

    private val _currentUserRole = MutableStateFlow<com.educenter.pro.data.model.UserRole>(com.educenter.pro.data.model.UserRole.VIEWER)
    val currentUserRole: StateFlow<com.educenter.pro.data.model.UserRole> = _currentUserRole.asStateFlow()

    private val auth = com.google.firebase.auth.FirebaseAuth.getInstance()

    init {
        auth.addAuthStateListener {
            updateUserRole(it.currentUser?.email, _appData.value)
        }
    }

    private val COLLECTION_NAME = "db_core_v2_secure_9a8b7c6d5e4f3g2h1"

    suspend fun syncData() = withContext(Dispatchers.IO) {
        try {
            kotlinx.coroutines.withTimeout(10000L) {
                val snapshot = firestore.collection(COLLECTION_NAME).get().await()
                val newShards = mutableListOf<ShardEntity>()
                
                for (document in snapshot.documents) {
                    if (document.id == "_sync") continue
                    val dataMap = document.data?.get("data")
                    if (dataMap != null) {
                        val jsonStr = gson.toJson(dataMap)
                        newShards.add(ShardEntity(id = document.id, data = jsonStr))
                    }
                }
                if (newShards.isNotEmpty()) {
                    shardDao.clearAll()
                    shardDao.insertShards(newShards)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        try {
            val localShards = shardDao.getAllShards()
            rebuildAppDataFromLocal(localShards)
        } catch (e: Exception) {
            e.printStackTrace()
            _appData.value = AppData()
        }
    }

    private fun updateUserRole(email: String?, data: AppData?) {
        if (email == null || data == null) {
            _currentUserRole.value = com.educenter.pro.data.model.UserRole.VIEWER
            return
        }
        val staffMember = data.staff.find { it.email == email }
        if (staffMember != null) {
            _currentUserRole.value = staffMember.role
            return
        }
        _currentUserRole.value = com.educenter.pro.data.model.UserRole.VIEWER
    }

    private fun rebuildAppDataFromLocal(shards: List<ShardEntity>) {
        var settings: Settings? = null
        val students = mutableListOf<Student>()
        val teachers = mutableListOf<Teacher>()
        val staff = mutableListOf<com.educenter.pro.data.model.Staff>()
        val classes = mutableListOf<ClassModel>()
        val transactions = mutableListOf<Transaction>()
        val attendance = mutableListOf<AttendanceRecord>()
        val announcements = mutableListOf<Announcement>()

        for (shard in shards) {
            val id = shard.id
            val json = shard.data
            
            when {
                id == "settings" -> settings = gson.fromJson(json, Settings::class.java)
                id == "students" -> students.addAll(parseList(json))
                id == "teachers" -> teachers.addAll(parseList(json))
                id == "staff" -> staff.addAll(parseList(json))
                id == "classes" -> classes.addAll(parseList(json))
                id == "announcements" -> announcements.addAll(parseList(json))
                id.startsWith("transactions_") -> transactions.addAll(parseList(json))
                id.startsWith("attendance_") -> attendance.addAll(parseList(json))
            }
        }

        val newData = AppData(
            settings = settings,
            students = students,
            teachers = teachers,
            staff = staff,
            classes = classes,
            transactions = transactions,
            attendance = attendance,
            announcements = announcements
        )
        _appData.value = newData
        updateUserRole(auth.currentUser?.email, newData)
    }

    private inline fun <reified T> parseList(json: String): List<T> {
        val type = object : TypeToken<List<T>>() {}.type
        return try {
            gson.fromJson(json, type) ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun recordAttendance(classId: String, studentId: String, dateStr: String, status: String) = withContext(Dispatchers.IO) {
        val currentData = _appData.value ?: return@withContext
        
        // Create new record
        val recordId = java.util.UUID.randomUUID().toString()
        val newRecord = AttendanceRecord(id = recordId, classId = classId, studentId = studentId, date = dateStr, status = status)
        
        // Update list (remove existing for same day/class/student)
        val updatedAttendance = currentData.attendance.filter { 
            !(it.classId == classId && it.studentId == studentId && it.date == dateStr) 
        }.toMutableList()
        updatedAttendance.add(newRecord)
        
        // Update local StateFlow immediately
        _appData.value = currentData.copy(attendance = updatedAttendance)
        
        // Calculate shard key (e.g. attendance_2024_07_12)
        val parts = dateStr.split("-")
        val shardKey = if (parts.size >= 3) {
            "attendance_${parts[0]}_${parts[1]}_${parts[2]}"
        } else {
            "attendance"
        }
        
        // Get all records belonging to this shard
        val shardRecords = updatedAttendance.filter {
            val p = it.date.split("-")
            if (p.size >= 3) "attendance_${p[0]}_${p[1]}_${p[2]}" == shardKey else "attendance" == shardKey
        }
        
        // Save to Local Room DB
        val shardJson = gson.toJson(shardRecords)
        shardDao.insertShards(listOf(ShardEntity(id = shardKey, data = shardJson)))
        
        // Push to Firestore (entire shard + update _sync)
        try {
            val batch = firestore.batch()
            
            val shardRef = firestore.collection(COLLECTION_NAME).document(shardKey)
            batch.set(shardRef, mapOf("data" to shardRecords))
            
            val syncRef = firestore.collection(COLLECTION_NAME).document("_sync")
            val syncId = "${System.currentTimeMillis()}_${java.util.UUID.randomUUID().toString().substring(0, 8)}"
            batch.set(syncRef, mapOf(
                "syncId" to syncId, 
                "lastUpdatedAt" to System.currentTimeMillis()
            ))
            
            batch.commit().await()
        } catch (e: Exception) {
            e.printStackTrace()
            // In a production app we would handle sync queueing here
        }
    }

    suspend fun recordTransaction(studentId: String, amount: Double, description: String, dateStr: String, type: String) = withContext(Dispatchers.IO) {
        val currentData = _appData.value ?: return@withContext
        
        val recordId = java.util.UUID.randomUUID().toString()
        val newTx = Transaction(id = recordId, amount = amount, date = dateStr, description = description, type = type)
        
        val updatedTx = currentData.transactions.toMutableList()
        updatedTx.add(newTx)
        
        // Also update student balance locally
        val updatedStudents = currentData.students.map {
            if (it.id == studentId) {
                // If type is PAYMENT (credit), balance increases
                val balanceChange = if (type == "PAYMENT") amount else -amount
                it.copy(balance = it.balance + balanceChange)
            } else it
        }.toMutableList()

        _appData.value = currentData.copy(transactions = updatedTx, students = updatedStudents)
        
        // Shard transactions
        val parts = dateStr.split("-")
        val txShardKey = if (parts.size >= 3) "transactions_${parts[0]}_${parts[1]}_${parts[2]}" else "transactions"
        
        val txShardRecords = updatedTx.filter {
            val p = it.date.split("-")
            if (p.size >= 3) "transactions_${p[0]}_${p[1]}_${p[2]}" == txShardKey else "transactions" == txShardKey
        }
        
        shardDao.insertShards(listOf(
            ShardEntity(id = txShardKey, data = gson.toJson(txShardRecords)),
            ShardEntity(id = "students", data = gson.toJson(updatedStudents))
        ))
        
        try {
            val batch = firestore.batch()
            batch.set(firestore.collection(COLLECTION_NAME).document(txShardKey), mapOf("data" to txShardRecords))
            batch.set(firestore.collection(COLLECTION_NAME).document("students"), mapOf("data" to updatedStudents))
            
            val syncId = "${System.currentTimeMillis()}_${java.util.UUID.randomUUID().toString().substring(0, 8)}"
            batch.set(firestore.collection(COLLECTION_NAME).document("_sync"), mapOf(
                "syncId" to syncId, 
                "lastUpdatedAt" to System.currentTimeMillis()
            ))
            
            batch.commit().await()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    suspend fun saveStudents(newStudents: List<Student>) = saveCoreCollection("students", newStudents) { current -> current.copy(students = newStudents) }
    suspend fun saveTeachers(newTeachers: List<Teacher>) = saveCoreCollection("teachers", newTeachers) { current -> current.copy(teachers = newTeachers) }
    suspend fun saveClasses(newClasses: List<ClassModel>) = saveCoreCollection("classes", newClasses) { current -> current.copy(classes = newClasses) }
    suspend fun saveAnnouncements(newAnnouncements: List<Announcement>) = saveCoreCollection("announcements", newAnnouncements) { current -> current.copy(announcements = newAnnouncements) }

    private suspend fun <T> saveCoreCollection(shardId: String, dataList: List<T>, updateAppData: (AppData) -> AppData) = withContext(Dispatchers.IO) {
        val currentData = _appData.value ?: return@withContext
        
        _appData.value = updateAppData(currentData)
        shardDao.insertShards(listOf(ShardEntity(id = shardId, data = gson.toJson(dataList))))
        
        try {
            val batch = firestore.batch()
            batch.set(firestore.collection(COLLECTION_NAME).document(shardId), mapOf("data" to dataList))
            
            val syncId = "${System.currentTimeMillis()}_${java.util.UUID.randomUUID().toString().substring(0, 8)}"
            batch.set(firestore.collection(COLLECTION_NAME).document("_sync"), mapOf(
                "syncId" to syncId, 
                "lastUpdatedAt" to System.currentTimeMillis()
            ))
            
            batch.commit().await()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
