package com.goat.webview

import android.content.Context
import android.os.Looper
import android.util.Log
import android.webkit.WebView

/**
 * Pre-initializes the Chromium core, zygote, and V8 engine during Application.onCreate
 * or IdleHandler to eliminate 300-500ms from the first WebView render.
 */
object GoatWarmupManager {
    private const val TAG = "GoatWarmupManager"
    private var prewarmedWebView: WebView? = null

    /**
     * Warms up the Chromium engine by instantiating a dummy WebView on an idle thread.
     */
    fun prewarm(context: Context) {
        Looper.myQueue().addIdleHandler {
            try {
                val appContext = context.applicationContext
                val wv = GoatFastPool.createWarmWebView(appContext)
                prewarmedWebView = wv
                GoatFastPool.prewarmPool(appContext)
                Log.d(TAG, "Chromium WebKit engine and GoatFastPool pre-warmed successfully")
            } catch (e: Exception) {
                Log.e(TAG, "Goat WebView pre-warmup failed: ${e.message}", e)
            }
            false // Run once on idle
        }
    }
}
