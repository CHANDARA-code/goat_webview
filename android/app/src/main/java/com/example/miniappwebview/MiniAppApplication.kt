package com.example.miniappwebview

import android.app.Application
import android.content.ComponentCallbacks2
import android.util.Log
import com.goat.webview.GoatFastPool
import com.goat.webview.GoatWarmupManager

class MiniAppApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        Log.i("MiniAppApplication", "Application onCreate: Initializing Goat WebView engine pre-warming...")
        GoatWarmupManager.prewarm(this)
    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        if (level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL || level >= ComponentCallbacks2.TRIM_MEMORY_MODERATE) {
            Log.w("MiniAppApplication", "Low memory condition detected (level=$level). Trimming GoatFastPool...")
            GoatFastPool.trimMemory()
        }
    }
}
