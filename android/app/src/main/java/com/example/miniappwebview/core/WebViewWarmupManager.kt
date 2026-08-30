package com.example.miniappwebview.core

import android.content.Context
import android.os.Looper
import android.util.Log
import android.webkit.WebView

/**
 * Pre-initializes the Chromium core, zygote, and V8 engine during Application.onCreate
 * or IdleHandler to eliminate 300-500ms from the first WebView render.
 */
object WebViewWarmupManager {
    private const val TAG = "WebViewWarmup"
    private var prewarmedWebView: WebView? = null

    fun prewarm(context: Context) {
        Looper.myQueue().addIdleHandler {
            try {
                // Instantiating WebView loads libmonochrome/libwebviewchromium.so and warms V8
                val appContext = context.applicationContext
                val wv = WebView(appContext).apply {
                    settings.javaScriptEnabled = true
                    loadDataWithBaseURL(
                        "https://appassets.androidplatform.net",
                        "<!DOCTYPE html><html><head></head><body></body></html>",
                        "text/html",
                        "UTF-8",
                        null
                    )
                }
                prewarmedWebView = wv
                Log.d(TAG, "Chromium WebKit engine pre-warmed successfully")
            } catch (e: Exception) {
                Log.e(TAG, "WebView pre-warmup failed: ${e.message}", e)
            }
            false // Run once on idle
        }
    }
}
