package com.educenter.pro.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(entities = [ShardEntity::class, PendingOperationEntity::class], version = 2, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun shardDao(): ShardDao
    abstract fun pendingOperationDao(): PendingOperationDao
}
