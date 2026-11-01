package com.educenter.pro.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "shards")
data class ShardEntity(
    @PrimaryKey val id: String,
    val data: String // JSON string of the shard content
)
