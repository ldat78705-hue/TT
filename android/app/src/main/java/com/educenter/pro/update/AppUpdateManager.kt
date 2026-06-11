package com.educenter.pro.update

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Environment
import androidx.core.content.FileProvider
import com.educenter.pro.data.remote.GitHubApiService
import com.educenter.pro.data.remote.GitHubRelease
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

data class UpdateInfo(
    val isAvailable: Boolean = false,
    val latestVersion: String = "",
    val currentVersion: String = "",
    val releaseNotes: String = "",
    val downloadUrl: String = "",
    val fileSize: Long = 0,
    val isDownloading: Boolean = false,
    val downloadProgress: Int = 0
)

@Singleton
class AppUpdateManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private const val GITHUB_OWNER = "ldat78705-hue"
        private const val GITHUB_REPO = "TT"
        private const val PREF_SKIP_VERSION = "skip_update_version"
        private const val PREF_LAST_CHECK = "last_update_check"
        private const val CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000L // 4 hours
    }

    private val _updateInfo = MutableStateFlow(UpdateInfo())
    val updateInfo: StateFlow<UpdateInfo> = _updateInfo

    private val gitHubApi: GitHubApiService by lazy {
        Retrofit.Builder()
            .baseUrl("https://api.github.com/")
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(GitHubApiService::class.java)
    }

    private val prefs by lazy {
        context.getSharedPreferences("app_update_prefs", Context.MODE_PRIVATE)
    }

    /**
     * Get current app versionCode
     */
    private fun getCurrentVersionCode(): Int {
        return try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                pInfo.longVersionCode.toInt()
            } else {
                @Suppress("DEPRECATION")
                pInfo.versionCode
            }
        } catch (e: Exception) {
            1
        }
    }

    /**
     * Get current app versionName
     */
    private fun getCurrentVersionName(): String {
        return try {
            context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "1.0"
        } catch (e: Exception) {
            "1.0"
        }
    }

    /**
     * Parse version code from tag name (e.g., "v1.2" -> 102, "v2.0.1" -> 201)
     */
    private fun parseVersionCode(tagName: String): Int {
        val clean = tagName.removePrefix("v").removePrefix("V")
        val parts = clean.split(".")
        return try {
            when (parts.size) {
                1 -> parts[0].toInt() * 100
                2 -> parts[0].toInt() * 100 + parts[1].toInt()
                else -> parts[0].toInt() * 10000 + parts[1].toInt() * 100 + parts[2].toInt()
            }
        } catch (e: Exception) {
            0
        }
    }

    /**
     * Check if update should be checked (throttled to avoid excessive API calls)
     */
    private fun shouldCheck(): Boolean {
        val lastCheck = prefs.getLong(PREF_LAST_CHECK, 0)
        return System.currentTimeMillis() - lastCheck > CHECK_INTERVAL_MS
    }

    /**
     * Check for app updates from GitHub Releases
     */
    suspend fun checkForUpdate(force: Boolean = false): UpdateInfo {
        if (!force && !shouldCheck()) {
            return _updateInfo.value
        }

        return withContext(Dispatchers.IO) {
            try {
                val release = gitHubApi.getLatestRelease(GITHUB_OWNER, GITHUB_REPO)
                prefs.edit().putLong(PREF_LAST_CHECK, System.currentTimeMillis()).apply()
                
                val currentVersionCode = getCurrentVersionCode()
                val remoteVersionCode = parseVersionCode(release.tagName)
                val skippedVersion = prefs.getString(PREF_SKIP_VERSION, null)

                // Find APK asset
                val apkAsset = release.assets.find { it.name.endsWith(".apk") }

                val isAvailable = remoteVersionCode > currentVersionCode 
                    && apkAsset != null
                    && release.tagName != skippedVersion

                val info = UpdateInfo(
                    isAvailable = isAvailable,
                    latestVersion = release.tagName,
                    currentVersion = "v${getCurrentVersionName()}",
                    releaseNotes = release.body ?: "Cập nhật mới",
                    downloadUrl = apkAsset?.downloadUrl ?: "",
                    fileSize = apkAsset?.size ?: 0
                )

                _updateInfo.value = info
                info
            } catch (e: Exception) {
                // Silently fail - don't bother user if GitHub is unreachable
                _updateInfo.value
            }
        }
    }

    /**
     * Skip this version - don't show update dialog again for this version
     */
    fun skipVersion(version: String) {
        prefs.edit().putString(PREF_SKIP_VERSION, version).apply()
        _updateInfo.value = _updateInfo.value.copy(isAvailable = false)
    }

    /**
     * Dismiss update dialog without skipping
     */
    fun dismissUpdate() {
        _updateInfo.value = _updateInfo.value.copy(isAvailable = false)
    }

    /**
     * Download APK using system DownloadManager
     */
    fun downloadAndInstall(downloadUrl: String) {
        try {
            _updateInfo.value = _updateInfo.value.copy(isDownloading = true)

            val fileName = "EduCenterPro_update.apk"
            val file = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), fileName)
            if (file.exists()) file.delete()

            val request = DownloadManager.Request(Uri.parse(downloadUrl)).apply {
                setTitle("Đang tải bản cập nhật...")
                setDescription("EduCenter Pro")
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, fileName)
                setMimeType("application/vnd.android.package-archive")
            }

            val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val downloadId = downloadManager.enqueue(request)

            // Register receiver for download complete
            val receiver = object : BroadcastReceiver() {
                override fun onReceive(ctx: Context?, intent: Intent?) {
                    val id = intent?.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
                    if (id == downloadId) {
                        _updateInfo.value = _updateInfo.value.copy(isDownloading = false)
                        installApk(file)
                        try {
                            context.unregisterReceiver(this)
                        } catch (_: Exception) {}
                    }
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(
                    receiver,
                    IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                    Context.RECEIVER_EXPORTED
                )
            } else {
                context.registerReceiver(
                    receiver,
                    IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
                )
            }
        } catch (e: Exception) {
            _updateInfo.value = _updateInfo.value.copy(isDownloading = false)
            // Fallback: open in browser
            openInBrowser(downloadUrl)
        }
    }

    /**
     * Install downloaded APK using FileProvider
     */
    private fun installApk(file: File) {
        try {
            val uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            // Fallback: try without FileProvider
            try {
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(Uri.fromFile(file), "application/vnd.android.package-archive")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(intent)
            } catch (_: Exception) {}
        }
    }

    /**
     * Open download URL in browser as fallback
     */
    fun openInBrowser(url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        } catch (_: Exception) {}
    }
}
