package com.educenter.pro.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "pending_operations")
data class PendingOperationEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val operationName: String,   // e.g. "updateAttendance"
    val payload: String,         // JSON payload
    val createdAt: Long = System.currentTimeMillis(),
    val status: String = "PENDING" // PENDING, SYNCING, FAILED
)
