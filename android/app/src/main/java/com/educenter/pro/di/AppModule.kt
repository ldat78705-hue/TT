package com.educenter.pro.di

import android.content.Context
import androidx.room.Room
import com.educenter.pro.data.local.AppDatabase
import com.educenter.pro.data.local.ShardDao
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.gson.Gson
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideAppDatabase(@ApplicationContext context: Context): AppDatabase {
        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            "educenter_db"
        ).fallbackToDestructiveMigration().build()
    }

    @Provides
    fun provideShardDao(database: AppDatabase): ShardDao {
        return database.shardDao()
    }

    @Provides
    @Singleton
    fun provideFirebaseFirestore(): FirebaseFirestore {
        val app = com.google.firebase.FirebaseApp.getInstance()
        return FirebaseFirestore.getInstance(app, "ai-studio-1201c9cd-f201-4fe5-8e8c-fc40d170de52")
    }

    @Provides
    @Singleton
    fun provideFirebaseAuth(): FirebaseAuth {
        return FirebaseAuth.getInstance()
    }

    @Provides
    @Singleton
    fun provideGson(): Gson {
        return Gson()
    }
}
