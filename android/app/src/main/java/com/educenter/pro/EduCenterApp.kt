package com.educenter.pro

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class EduCenterApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // Initialize Firebase if needed here, but usually it auto-initializes via google-services.json
    }
}
