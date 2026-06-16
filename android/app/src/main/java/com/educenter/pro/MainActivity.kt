package com.educenter.pro

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import com.educenter.pro.ui.theme.EduCenterProTheme
import com.educenter.pro.update.AppUpdateManager
import com.educenter.pro.update.UpdateDialog
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    @Inject
    lateinit var appUpdateManager: AppUpdateManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            EduCenterProTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    Box(modifier = Modifier.fillMaxSize()) {
                        com.educenter.pro.ui.navigation.AppNavigation()

                        // Check for updates on app start
                        LaunchedEffect(Unit) {
                            appUpdateManager.checkForUpdate(force = true)
                        }

                        // Show update dialog if available
                        UpdateDialog(updateManager = appUpdateManager)
                    }
                }
            }
        }
    }
}
