package com.educenter.pro.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ShardDao {
    @Query("SELECT * FROM shards")
    suspend fun getAllShards(): List<ShardEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertShards(shards: List<ShardEntity>)

    @Query("DELETE FROM shards")
    suspend fun clearAll()
}
