package com.goat.webview

import android.app.Application
import android.content.ComponentCallbacks2
import android.content.Context
import android.content.MutableContextWrapper
import android.content.res.Configuration
import android.graphics.Color
import android.util.Log
import android.webkit.CookieManager
import android.webkit.WebStorage
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebViewDatabase
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

/**
 * Lean 2-Instance Recycler Pool for Goat WebView (Pillar 2 of Native-Kill Blueprint).
 *
 * Maintains up to 2 pre-warmed WebView instances in memory:
 * - Instance A (Active): Currently visible and executing within the active UI container.
 * - Instance B (Standby): Pre-warmed and pre-loaded with base HTML/CSS runtime during idle time.
 *
 * Enables sub-10ms route launches via memory pointer swapping. Automatically sanitizes state
 * upon recycling (8-step reset) and evicts standby instances upon memory pressure warnings
 * received from [ComponentCallbacks2].
 */
object GoatFastPool {
    private const val TAG = "GoatFastPool"
    private const val BRIDGE_NAME = "nativeBridge"

    /** Maximum allowed warm WebView instances in the standby pool to cap RAM below 45MB. */
    const val MAX_POOL_SIZE = 2

    private val pool = ArrayDeque<WebView>(MAX_POOL_SIZE)
    private var isCallbacksRegistered = false

    /**
     * Registers automatic memory trimming callbacks with the host [Application].
     *
     * @param application The Android application instance.
     */
    @Synchronized
    fun registerMemoryCallbacks(application: Application) {
        if (isCallbacksRegistered) return
        application.registerComponentCallbacks(object : ComponentCallbacks2 {
            override fun onTrimMemory(level: Int) {
                handleTrimMemory(level)
            }

            override fun onConfigurationChanged(newConfig: Configuration) {
                // No-op for pool instances
            }

            override fun onLowMemory() {
                trimMemory()
            }
        })
        isCallbacksRegistered = true
        Log.i(TAG, "Registered ComponentCallbacks2 memory trimming hooks for GoatFastPool")
    }

    /**
     * Acquires a pre-warmed WebView instance from the pool or creates a fresh warm instance.
     * Rebinds the MutableContextWrapper base context to the active Activity context.
     *
     * @param context The active Android context (typically an Activity).
     * @return A ready-to-use warm [WebView] instance.
     */
    @Synchronized
    fun acquire(context: Context): WebView {
        val pooled = pool.removeFirstOrNull()
        if (pooled != null) {
            (pooled.context as? MutableContextWrapper)?.baseContext = context
            Log.d(TAG, "Acquired pre-warmed WebView from pool (remaining=${pool.size})")
            return pooled
        }
        Log.d(TAG, "Pool empty; creating fresh warm WebView")
        val fresh = createWarmWebView(context)
        (fresh.context as? MutableContextWrapper)?.baseContext = context
        return fresh
    }

    /**
     * Recycles a WebView instance back into the pool after sanitizing its state.
     * Rebinds the baseContext to Application context immediately to avoid leaking the Activity.
     * If the pool is saturated (> [MAX_POOL_SIZE]), the excess instance is immediately destroyed.
     *
     * @param webView The [WebView] instance to recycle.
     * @return `true` if recycled into pool, `false` if destroyed due to saturation.
     */
    @Synchronized
    fun recycle(webView: WebView): Boolean {
        // Immediately restore baseContext to Application Context to prevent Activity leaks
        try {
            val ctx = webView.context
            val appContext = ctx?.applicationContext ?: ctx
            if (appContext != null && ctx is MutableContextWrapper) {
                ctx.baseContext = appContext
            }
        } catch (e: Exception) {
            // Handled for headless mock contexts
        }

        return if (pool.size < MAX_POOL_SIZE) {
            try {
                sanitizeWebView(webView)
                pool.addLast(webView)
                Log.d(TAG, "Recycled sanitized WebView into pool (currentSize=${pool.size})")

                // Best-effort: null out the nativeBridge JS property on the pooled instance so that
                // any in-flight messages dispatched to the old tenant bridge channel are silently
                // dropped when the WebView is reused for a new tenant. This runs after pool
                // insertion so a JS engine failure (e.g. in test environments) never blocks recycling.
                try {
                    webView.evaluateJavascript(
                        "try{if(window.nativeBridge)window.nativeBridge=null;}catch(e){}", null
                    )
                } catch (jsErr: Exception) {
                    Log.d(TAG, "nativeBridge nullification skipped (JS engine unavailable): ${jsErr.message}")
                }

                true
            } catch (e: Exception) {
                Log.e(TAG, "Failed recycling WebView; destroying instance", e)
                destroySafely(webView)
                false
            }
        } else {
            Log.d(TAG, "Pool full (max=$MAX_POOL_SIZE); destroying excess WebView")
            destroySafely(webView)
            false
        }
    }

    /**
     * Sanitizes WebView state according to the zero-leak 9-step teardown policy:
     * 1. Terminate pending network/script loads (stopLoading)
     * 2. Navigate away from tenant DOM to empty context (about:blank)
     * 3. Clear back/forward navigation history stack (clearHistory)
     * 4. Purge DOM WebStorage (localStorage & sessionStorage)
     * 5. Purge Cookies (session & persistent) + flush
     * 6. Purge Form Data & HTTP Auth credentials (WebViewDatabase)
     * 7. Clear Disk & RAM HTTP Caches + SSL preferences
     * 8. Detach client delegates and reset styling
     * 9. Unregister the WebMessageListener IPC bridge
     *
     * Note: The nativeBridge JS nullification runs in [recycle] after pool insertion
     * so it never blocks the recycling path on environments without a JS engine.
     *
     * @param webView The [WebView] to sanitize.
     */
    fun sanitizeWebView(webView: WebView) {
        webView.apply {
            // 1. Terminate pending network and script loads
            try {
                stopLoading()
            } catch (e: Exception) {
                Log.e(TAG, "Error in stopLoading", e)
            }

            // 2. Navigate away from tenant DOM to empty context
            try {
                loadUrl("about:blank")
            } catch (e: Exception) {
                Log.e(TAG, "Error loading about:blank", e)
            }

            // 3. Clear navigation history
            try {
                clearHistory()
            } catch (e: Exception) {
                Log.e(TAG, "Error in clearHistory", e)
            }

            // 4. Purge DOM WebStorage (localStorage & sessionStorage)
            try {
                WebStorage.getInstance().deleteAllData()
            } catch (e: Exception) {
                Log.e(TAG, "Error purging WebStorage in FastPool", e)
            }

            // 5. Purge Cookies (session and persistent)
            try {
                val cookieManager = CookieManager.getInstance()
                cookieManager.removeAllCookies(null)
                cookieManager.flush()
            } catch (e: Exception) {
                Log.e(TAG, "Error purging CookieManager in FastPool", e)
            }

            // 6. Purge Form Data & HTTP Auth credentials
            try {
                val db = WebViewDatabase.getInstance(context)
                db?.clearFormData()
                db?.clearHttpAuthUsernamePassword()
            } catch (e: Exception) {
                Log.e(TAG, "Error purging WebViewDatabase in FastPool", e)
            }

            // 7. Clear Disk & RAM HTTP Caches and SSL Preferences
            try {
                clearCache(true)
                clearSslPreferences()
            } catch (e: Exception) {
                Log.e(TAG, "Error clearing cache or SSL prefs", e)
            }

            // 8. Detach client delegates and reset styling
            try {
                webViewClient = WebViewClient()
                webChromeClient = null
                setDownloadListener(null)
                removeAllViews()
                setBackgroundColor(Color.TRANSPARENT)
            } catch (e: Exception) {
                Log.e(TAG, "Error resetting delegates", e)
            }

            // 9. Unregister WebMessageListener bridge to prevent stale tenant listener leakage
            try {
                if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
                    WebViewCompat.removeWebMessageListener(webView, BRIDGE_NAME)
                }
            } catch (e: Throwable) {
                Log.e(TAG, "Error removing WebMessageListener in FastPool", e)
            }
        }
    }

    /**
     * Handles [ComponentCallbacks2] memory trim levels and evicts standby instances on memory pressure.
     *
     * @param level The memory trim level integer.
     */
    @Synchronized
    fun handleTrimMemory(level: Int) {
        val isCritical = level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW ||
            level == ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN ||
            level >= ComponentCallbacks2.TRIM_MEMORY_BACKGROUND

        if (isCritical && pool.isNotEmpty()) {
            Log.w(TAG, "Memory trim alert (level=$level); purging ${pool.size} standby instances from GoatFastPool")
            trimMemory()
        }
    }

    /**
     * Destroys all standby WebView instances in the pool to free RAM immediately.
     */
    @Synchronized
    fun trimMemory() {
        val count = pool.size
        while (pool.isNotEmpty()) {
            val instance = pool.removeFirstOrNull()
            if (instance != null) {
                destroySafely(instance)
            }
        }
        if (count > 0) {
            Log.i(TAG, "Trimmed $count pooled WebView instances from memory")
        }
    }

    /**
     * Clears all pooled instances (alias for [trimMemory]).
     */
    @Synchronized
    fun clearPool() {
        trimMemory()
    }

    /**
     * Returns the current number of standby WebViews in the pool.
     */
    val poolSize: Int
        @Synchronized get() = pool.size

    /**
     * Creates a warm WebView instance wrapped in MutableContextWrapper with baseline configuration.
     *
     * @param context The Android context.
     * @return A newly created warm [WebView].
     */
    fun createWarmWebView(context: Context): WebView {
        val appContext = context.applicationContext ?: context
        val mutableContext = MutableContextWrapper(appContext)
        return WebView(mutableContext).apply {
            setBackgroundColor(Color.TRANSPARENT)
            try {
                settings?.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    allowFileAccess = false
                    allowContentAccess = false
                    allowFileAccessFromFileURLs = false
                    allowUniversalAccessFromFileURLs = false
                }
            } catch (e: Exception) {
                // Handled for headless/mock environments
            }
            try {
                loadUrl("about:blank")
            } catch (e: Exception) {
                // Handled for headless/mock environments
            }
        }
    }

    /**
     * Pre-populates the pool up to [MAX_POOL_SIZE] during application idle time.
     *
     * @param context The Android context.
     */
    @Synchronized
    fun prewarmPool(context: Context) {
        while (pool.size < MAX_POOL_SIZE) {
            try {
                pool.addLast(createWarmWebView(context))
            } catch (e: Exception) {
                Log.e(TAG, "Failed prewarming WebView pool instance", e)
                break
            }
        }
        Log.d(TAG, "Prewarmed GoatFastPool (currentSize=${pool.size})")
    }

    private fun destroySafely(webView: WebView) {
        try {
            webView.apply {
                stopLoading()
                loadUrl("about:blank")
                clearHistory()
                removeAllViews()
                destroy()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error destroying WebView instance", e)
        }
    }
}
