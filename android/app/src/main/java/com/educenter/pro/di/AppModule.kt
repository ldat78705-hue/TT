package com.educenter.pro.di

import android.content.Context
import androidx.room.Room
import com.educenter.pro.data.local.AppDatabase
import com.educenter.pro.data.local.ShardDao
import com.educenter.pro.data.local.PendingOperationDao
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.gson.Gson
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import com.educenter.pro.data.remote.ApiService
import android.content.SharedPreferences
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
    fun providePendingOperationDao(database: AppDatabase): PendingOperationDao {
        return database.pendingOperationDao()
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

    @Provides
    @Singleton
    fun provideSharedPreferences(@ApplicationContext context: Context): SharedPreferences {
        return try {
            androidx.security.crypto.EncryptedSharedPreferences.create(
                "educenter_secure_prefs",
                androidx.security.crypto.MasterKeys.getOrCreate(
                    androidx.security.crypto.MasterKeys.AES256_GCM_SPEC
                ),
                context,
                androidx.security.crypto.EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                androidx.security.crypto.EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            // Fallback to regular prefs if encryption fails (e.g., on old devices)
            context.getSharedPreferences("educenter_prefs", Context.MODE_PRIVATE)
        }
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(prefs: SharedPreferences): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            // BASIC only logs request/response lines — NOT body content
            // This prevents passwords, tokens, and personal data from leaking to Logcat
            level = HttpLoggingInterceptor.Level.BASIC
        }
        return OkHttpClient.Builder()
            .addInterceptor(logging)
            .addInterceptor { chain ->
                val token = prefs.getString("user_token", null)
                val requestBuilder = chain.request().newBuilder()
                if (token != null) {
                    requestBuilder.addHeader("Authorization", "Bearer $token")
                }
                chain.proceed(requestBuilder.build())
            }
            .build()
    }

    @Provides
    @Singleton
    fun provideApiService(okHttpClient: OkHttpClient, gson: Gson): ApiService {
        return Retrofit.Builder()
            .baseUrl("https://tt.thaydat.edu.vn/")
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
            .create(ApiService::class.java)
    }
}
