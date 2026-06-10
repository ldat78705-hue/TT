package com.educenter.pro.data.repository

import android.content.Context
import android.content.SharedPreferences
import java.security.MessageDigest
import dagger.hilt.android.qualifiers.ApplicationContext
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
    @ApplicationContext private val context: Context,
    private val firestore: FirebaseFirestore,
    private val shardDao: ShardDao,
    private val gson: Gson
) {
    private val prefs: SharedPreferences = context.getSharedPreferences("educenter_prefs", Context.MODE_PRIVATE)

    private val _appData = MutableStateFlow<AppData?>(null)
    val appData: StateFlow<AppData?> = _appData.asStateFlow()

    private val _currentUserRole = MutableStateFlow<com.educenter.pro.data.model.UserRole>(com.educenter.pro.data.model.UserRole.VIEWER)
    val currentUserRole: StateFlow<com.educenter.pro.data.model.UserRole> = _currentUserRole.asStateFlow()

    private val auth = com.google.firebase.auth.FirebaseAuth.getInstance()

    init {
        // Load role from SharedPreferences
        val savedRole = prefs.getString("user_role", null)
        if (savedRole != null) {
            try {
                _currentUserRole.value = com.educenter.pro.data.model.UserRole.valueOf(savedRole)
            } catch (e: Exception) {}
        }
    }
    
    fun isUserLoggedIn(): Boolean {
        return prefs.getString("user_id", null) != null
    }

    private fun md5(input: String): String {
        val md = MessageDigest.getInstance("MD5")
        return md.digest(input.toByteArray()).joinToString("") { "%02x".format(it) }
    }

    suspend fun loginLocal(identifier: String, passwordRaw: String): Boolean {
        val data = _appData.value ?: return false
        val upperIdentifier = identifier.uppercase()
        val hashedPw = md5(passwordRaw)

        var foundRole: com.educenter.pro.data.model.UserRole? = null
        var foundId: String? = null

        // 1. Admin
        if (upperIdentifier == "ADMIN" || upperIdentifier == "ADMIN_USER") {
            val adminPassword = data.settings?.adminPassword ?: "123456"
            if (passwordRaw == adminPassword || hashedPw == adminPassword) {
                foundRole = com.educenter.pro.data.model.UserRole.ADMIN
                foundId = "ADMIN_USER"
            }
        }
        // 2. Viewer
        else if (upperIdentifier == "VIEWER" || upperIdentifier == "VIEWER_USER") {
            if (data.settings?.viewerAccountActive != false && (passwordRaw == "viewer123" || hashedPw == "viewer123")) {
                foundRole = com.educenter.pro.data.model.UserRole.VIEWER
                foundId = "VIEWER_USER"
            }
        }
        // 3. Teacher
        else if (data.teachers.any { it.id.uppercase() == upperIdentifier }) {
            val teacher = data.teachers.first { it.id.uppercase() == upperIdentifier }
            if (teacher.password == passwordRaw || teacher.password == hashedPw) {
                foundRole = teacher.role
                foundId = teacher.id
            }
        }
        // 4. Staff
        else if (data.staff.any { it.id.uppercase() == upperIdentifier }) {
            val staffMember = data.staff.first { it.id.uppercase() == upperIdentifier }
            if (staffMember.password == passwordRaw || staffMember.password == hashedPw) {
                foundRole = staffMember.role
                foundId = staffMember.id
            }
        }
        // 5. Student
        else if (data.students.any { it.id.uppercase() == upperIdentifier }) {
            val student = data.students.first { it.id.uppercase() == upperIdentifier }
            val dobPassword = student.dob.split("-").reversed().joinToString("")
            val correctPassword = if (!student.password.isNullOrEmpty()) student.password else dobPassword
            if (passwordRaw == correctPassword || hashedPw == correctPassword) {
                foundRole = com.educenter.pro.data.model.UserRole.PARENT
                foundId = student.id
            }
        }

        if (foundRole != null && foundId != null) {
            _currentUserRole.value = foundRole
            prefs.edit().putString("user_id", foundId).putString("user_role", foundRole.name).apply()
            return true
        }
        return false
    }

    fun logout() {
        prefs.edit().clear().apply()
        _currentUserRole.value = com.educenter.pro.data.model.UserRole.VIEWER
    }

    private val COLLECTION_NAME = "db_core_v2_secure_9a8b7c6d5e4f3g2h1"

    suspend fun syncData() = withContext(Dispatchers.IO) {
        try {
            // Authenticate as server admin to get read/write access
            if (auth.currentUser?.email != "server_admin@educenter.local") {
                try {
                    auth.signInWithEmailAndPassword("server_admin@educenter.local", "EduCenter_Secure_Server_Pwd_2026!").await()
                } catch (e: Exception) {
                    // Try to create if not found (like web server Auth)
                    try {
                        auth.createUserWithEmailAndPassword("server_admin@educenter.local", "EduCenter_Secure_Server_Pwd_2026!").await()
                    } catch (e2: Exception) {
                        e2.printStackTrace()
                    }
                }
            }

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
        // Obsolete
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
        return try {
            gson.fromJson(json, Array<T>::class.java)?.toList() ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun recordAttendance(classId: String, studentId: String, dateStr: String, status: String) = withContext(Dispatchers.IO) {
        val currentData = _appData.value ?: return@withContext
        
        val recordId = java.util.UUID.randomUUID().toString()
        val newRecord = AttendanceRecord(id = recordId, classId = classId, studentId = studentId, date = dateStr, status = status)
        
        val parts = dateStr.split("-")
        val shardKey = if (parts.size >= 3) {
            "attendance_${parts[0]}_${parts[1]}_${parts[2]}"
        } else {
            "attendance"
        }
        
        try {
            val shardRef = firestore.collection(COLLECTION_NAME).document(shardKey)
            val syncRef = firestore.collection(COLLECTION_NAME).document("_sync")
            
            val updatedShardRecords = firestore.runTransaction { transaction ->
                val snapshot = transaction.get(shardRef)
                
                val existingRecords = if (snapshot.exists()) {
                    val dataList = snapshot.get("data") as? List<Map<String, Any>> ?: emptyList()
                    val json = gson.toJson(dataList)
                    parseList<AttendanceRecord>(json).toMutableList()
                } else {
                    mutableListOf<AttendanceRecord>()
                }
                
                val filtered = existingRecords.filter { 
                    !(it.classId == classId && it.studentId == studentId && it.date == dateStr) 
                }.toMutableList()
                filtered.add(newRecord)
                
                transaction.set(shardRef, mapOf("data" to filtered))
                
                val syncId = "${System.currentTimeMillis()}_${java.util.UUID.randomUUID().toString().substring(0, 8)}"
                transaction.set(syncRef, mapOf(
                    "syncId" to syncId, 
                    "lastUpdatedAt" to System.currentTimeMillis()
                ))
                
                filtered
            }.await()
            
            // Update local state and Room only on success
            val updatedAttendance = currentData.attendance.filter {
                val p = it.date.split("-")
                val k = if (p.size >= 3) "attendance_${p[0]}_${p[1]}_${p[2]}" else "attendance"
                k != shardKey
            }.toMutableList()
            updatedAttendance.addAll(updatedShardRecords)
            
            _appData.value = currentData.copy(attendance = updatedAttendance)
            shardDao.insertShards(listOf(ShardEntity(id = shardKey, data = gson.toJson(updatedShardRecords))))
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    suspend fun recordTransaction(studentId: String, amount: Double, description: String, dateStr: String, type: String) = withContext(Dispatchers.IO) {
        val currentData = _appData.value ?: return@withContext
        
        val recordId = java.util.UUID.randomUUID().toString()
        val newTx = Transaction(id = recordId, amount = amount, date = dateStr, description = description, type = type)
        
        val parts = dateStr.split("-")
        val txShardKey = if (parts.size >= 3) "transactions_${parts[0]}_${parts[1]}_${parts[2]}" else "transactions"
        
        try {
            val txShardRef = firestore.collection(COLLECTION_NAME).document(txShardKey)
            val studentsRef = firestore.collection(COLLECTION_NAME).document("students")
            val syncRef = firestore.collection(COLLECTION_NAME).document("_sync")
            
            // Result pair: Pair<UpdatedTransactions, UpdatedStudents>
            val (updatedTxShard, updatedStudentsShard) = firestore.runTransaction { transaction ->
                val txSnapshot = transaction.get(txShardRef)
                val studentsSnapshot = transaction.get(studentsRef)
                
                val existingTx = if (txSnapshot.exists()) {
                    val dataList = txSnapshot.get("data") as? List<Map<String, Any>> ?: emptyList()
                    parseList<Transaction>(gson.toJson(dataList)).toMutableList()
                } else {
                    mutableListOf<Transaction>()
                }
                
                val existingStudents = if (studentsSnapshot.exists()) {
                    val dataList = studentsSnapshot.get("data") as? List<Map<String, Any>> ?: emptyList()
                    parseList<Student>(gson.toJson(dataList)).toMutableList()
                } else {
                    mutableListOf<Student>()
                }
                
                existingTx.add(newTx)
                
                val updatedStudentsList = existingStudents.map {
                    if (it.id == studentId) {
                        val balanceChange = if (type == "PAYMENT") amount else -amount
                        it.copy(balance = it.balance + balanceChange)
                    } else it
                }
                
                transaction.set(txShardRef, mapOf("data" to existingTx))
                transaction.set(studentsRef, mapOf("data" to updatedStudentsList))
                
                val syncId = "${System.currentTimeMillis()}_${java.util.UUID.randomUUID().toString().substring(0, 8)}"
                transaction.set(syncRef, mapOf(
                    "syncId" to syncId, 
                    "lastUpdatedAt" to System.currentTimeMillis()
                ))
                
                Pair(existingTx, updatedStudentsList)
            }.await()
            
            // Update local state and Room only on success
            val newAllTransactions = currentData.transactions.filter {
                val p = it.date.split("-")
                val k = if (p.size >= 3) "transactions_${p[0]}_${p[1]}_${p[2]}" else "transactions"
                k != txShardKey
            }.toMutableList()
            newAllTransactions.addAll(updatedTxShard)
            
            _appData.value = currentData.copy(transactions = newAllTransactions, students = updatedStudentsShard)
            
            shardDao.insertShards(listOf(
                ShardEntity(id = txShardKey, data = gson.toJson(updatedTxShard)),
                ShardEntity(id = "students", data = gson.toJson(updatedStudentsShard))
            ))
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
