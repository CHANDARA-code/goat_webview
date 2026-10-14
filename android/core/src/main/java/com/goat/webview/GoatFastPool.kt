package com.goat.webview

import android.app.Application
import android.content.ComponentCallbacks2
import android.content.Context
import android.content.MutableContextWrapper
import android.content.res.Configuration
import android.graphics.Color
import android.app.Activity
import android.os.Bundle
import android.util.Log
import android.webkit.CookieManager
import android.webkit.WebStorage
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebViewDatabase
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import kotlinx.serialization.json.JsonObject
import java.util.WeakHashMap

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

    /** Hard cap on standby (cold) WebView instances (~15–25 MB resident each). */
    const val MAX_POOL_SIZE = 2

    /**
     * Max instances kept in the *hot* pool — fully warm WebViews (JS context, DOM, bridge and the
     * mini-app page still live) parked by tenant + entry-URL key. Re-acquiring one is a view
     * re-attach, not a navigation, so a same-tenant remount ("warm pool swap") completes in a few
     * milliseconds instead of ~80–140 ms. Held at 2 so a host that ping-pongs between two mini-apps
     * keeps both warm; each parked instance costs ~15–25 MB and is evicted on memory pressure.
     */
    const val MAX_HOT_SIZE = 2

    private val pool = ArrayDeque<WebView>(MAX_POOL_SIZE)
    private val hotPool = LinkedHashMap<String, HotEntry>()
    private var isCallbacksRegistered = false
    @Volatile private var startedActivities = 0

    /** Pooled/parked instances whose renderer the OS reclaimed under memory pressure (their
     *  priority is waived-when-not-visible — see [applyLowMemoryRendererPolicy]). Such a WebView
     *  can no longer render; [acquire]/[acquireHot] must drop it and hand back a fresh one. */
    private val deadRenderers = java.util.Collections.newSetFromMap(WeakHashMap<WebView, Boolean>())

    /** Map of WebView instances to their bound tenant appId for multi-profile tenant affinity */
    private val tenantAffinity = WeakHashMap<WebView, String>()

    /** Binds a WebView instance to a specific tenant appId */
    fun tagTenant(webView: WebView, appId: String) {
        synchronized(tenantAffinity) {
            tenantAffinity[webView] = appId
        }
    }

    /** Retrieves the bound tenant appId for a WebView instance, if any */
    fun getTenant(webView: WebView): String? {
        return synchronized(tenantAffinity) {
            tenantAffinity[webView]
        }
    }

    /** Checks whether a WebView has tenant affinity */
    fun hasTenantAffinity(webView: WebView): Boolean {
        return synchronized(tenantAffinity) {
            tenantAffinity.containsKey(webView)
        }
    }

    /** Clears tenant affinity when a WebView is destroyed */
    fun clearTenantTag(webView: WebView) {
        synchronized(tenantAffinity) {
            tenantAffinity.remove(webView)
        }
    }

    /**
     * Marks a WebView's renderer as reclaimable: `RENDERER_PRIORITY_WAIVED` while it is not
     * visible (i.e. while it sits in the pool or is parked, detached from any window), restored to
     * the app's own priority the moment it is attached and shown. On a constrained device this
     * lets the OS kill an idle standby/parked renderer (~30–40 MB) instead of an important
     * foreground process. A minimal [WebViewClient] whose `onRenderProcessGone` returns `true` is
     * attached first so a reclaimed renderer never takes the app process down with it — the
     * instance is simply flagged dead and skipped on re-acquire.
     */
    private fun applyLowMemoryRendererPolicy(webView: WebView) {
        try {
            if (webView.webViewClient !is DeadRendererGuard) {
                webView.webViewClient = DeadRendererGuard
            }
        } catch (_: Throwable) {
            try { webView.webViewClient = DeadRendererGuard } catch (_: Throwable) {}
        }
        try {
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_WAIVED, true)
        } catch (_: Throwable) {
            // headless / mock
        }
    }

    private object DeadRendererGuard : WebViewClient() {
        override fun onRenderProcessGone(
            view: WebView?,
            detail: android.webkit.RenderProcessGoneDetail?
        ): Boolean {
            view?.let {
                synchronized(deadRenderers) { deadRenderers.add(it) }
                try { pool.remove(it) } catch (_: Throwable) {}
                Log.i(TAG, "Idle pooled renderer reclaimed by the OS; instance flagged dead")
            }
            return true
        }
    }

    /** A parked warm WebView plus an opaque payload (the tenant's bridge handler) the embedder
     *  hands back on re-acquire so a same-tenant remount rebuilds nothing. */
    class HotEntry(val webView: WebView, val payload: Any?)

    /** Dispatch target for a WebView's `WebMessageListener`. The listener is registered exactly
     *  once per WebView (on cold init); on a warm re-attach only this route is re-bound, so the
     *  injected `window.nativeBridge` stays valid (androidx only re-injects on a page load). */
    fun interface BridgeRouter {
        suspend fun route(action: String, payload: JsonObject): Result<JsonObject>
    }

    private val routers = WeakHashMap<WebView, BridgeRouter>()

    fun bindRouter(webView: WebView, router: BridgeRouter) {
        synchronized(routers) { routers[webView] = router }
    }

    suspend fun routeBridge(webView: WebView, action: String, payload: JsonObject): Result<JsonObject> {
        val r = synchronized(routers) { routers[webView] }
            ?: return Result.failure(IllegalStateException("No bridge route bound for this WebView"))
        return r.route(action, payload)
    }

    /**
     * Re-acquires a fully-warm WebView parked for [hotKey] (tenant|entryUrl), or `null` if none is
     * parked. The returned instance still has the mini-app page loaded and its JS context live — the
     * caller only needs to re-attach it and re-bind its client delegates, not navigate.
     */
    @Synchronized
    fun acquireHot(hotKey: String, context: Context): HotEntry? {
        val hot = hotPool.remove(hotKey) ?: return null
        (hot.webView.context as? MutableContextWrapper)?.baseContext = context
        Log.d(TAG, "HOT hit for '$hotKey' (hot left=${hotPool.size})")
        return hot
    }

    /**
     * Parks a still-warm WebView under [hotKey] without any sanitization — the page, DOM and JS
     * heap are kept intact for a fast same-tenant remount. baseContext is rebound to the
     * application context so the Activity is not leaked. Returns `false` (and leaves the instance
     * for the normal [recycle] path) if the hot pool is full.
     */
    @JvmOverloads
    @Synchronized
    fun parkHot(webView: WebView, hotKey: String, payload: Any? = null): Boolean {
        val tenant = hotKey.substringBefore('|')
        if (tenant.isNotEmpty()) {
            tagTenant(webView, tenant)
        }
        if (hotPool.containsKey(hotKey)) {
            hotPool.remove(hotKey)?.let { destroySafely(it.webView) }
        }
        // One parked instance on low-end hardware instead of two. The second exists so a host
        // ping-ponging between two mini-apps keeps both warm; on a constrained device that second
        // parked DOM + JS heap is a worse trade than re-mounting the less-recent one.
        if (hotPool.size >= effectiveMaxHotSize(webView.context)) {
            val oldestKey = hotPool.keys.firstOrNull() ?: return false
            hotPool.remove(oldestKey)?.let { recycle(it.webView) }
        }
        try {
            val ctx = webView.context
            val appContext = ctx?.applicationContext ?: ctx
            if (appContext != null && ctx is MutableContextWrapper) ctx.baseContext = appContext
            webView.onPause()
        } catch (e: Exception) {
            // headless / mock context
        }
        hotPool[hotKey] = HotEntry(webView, payload)
        Log.d(TAG, "Parked HOT '$hotKey' (hot size=${hotPool.size})")
        return true
    }

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
        // TRIM_MEMORY_UI_HIDDEN is no longer dispatched on API 34+, so also watch the activity
        // count directly: the instant the last activity stops, drop the standby pool. Each pooled
        // WebView owns an out-of-process renderer; carrying them into the background makes this
        // process the fattest thing the low-memory killer sees, so it gets reaped and the user's
        // next return is a full cold start instead of a hot resume.
        application.registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
            override fun onActivityStarted(activity: Activity) { startedActivities++ }
            override fun onActivityStopped(activity: Activity) {
                if (--startedActivities <= 0) {
                    startedActivities = 0
                    releaseStandby("app backgrounded")
                }
            }
            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
            override fun onActivityResumed(activity: Activity) {}
            override fun onActivityPaused(activity: Activity) {}
            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
            override fun onActivityDestroyed(activity: Activity) {}
        })
        isCallbacksRegistered = true
        Log.i(TAG, "Registered memory-trim + activity-lifecycle hooks for GoatFastPool")
    }

    /** Destroys only the standby (cold) instances; the hot pool is left intact. */
    @Synchronized
    fun releaseStandby(reason: String) {
        if (pool.isEmpty()) return
        val n = pool.size
        while (pool.isNotEmpty()) pool.removeFirstOrNull()?.let { destroySafely(it) }
        Log.i(TAG, "Released $n standby WebView(s) ($reason)")
    }

    /**
     * Acquires a pre-warmed WebView instance from the pool or creates a fresh warm instance.
     * Rebinds the MutableContextWrapper base context to the active Activity context.
     * Respects multi-profile tenant affinity by discarding mismatched instances on cross-tenant reuse.
     *
     * @param context The active Android context (typically an Activity).
     * @param appId Optional tenant appId to match or bind tenant affinity.
     * @return A ready-to-use warm [WebView] instance.
     */
    @JvmOverloads
    @Synchronized
    fun acquire(context: Context, appId: String? = null): WebView {
        while (true) {
            val pooled = pool.removeFirstOrNull() ?: break
            if (synchronized(deadRenderers) { deadRenderers.remove(pooled) }) {
                destroySafely(pooled); continue          // renderer was reclaimed while idle
            }
            val boundTenant = getTenant(pooled)
            if (boundTenant != null && appId != null && boundTenant != appId) {
                Log.d(TAG, "Discarding pooled WebView bound to tenant '$boundTenant' for new tenant '$appId'")
                destroySafely(pooled)
                continue
            }
            (pooled.context as? MutableContextWrapper)?.baseContext = context
            try { pooled.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false) } catch (_: Throwable) {}
            if (appId != null) {
                tagTenant(pooled, appId)
            }
            Log.d(TAG, "Acquired pre-warmed WebView from pool (remaining=${pool.size})")
            return pooled
        }
        Log.d(TAG, "Pool empty; creating fresh warm WebView")
        // Immediate-use path: the caller navigates to the real entry URL right after this returns,
        // so skip the about:blank priming navigation a standby instance would want.
        val fresh = createWarmWebView(context, warmNavigate = false)
        try { fresh.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false) } catch (_: Throwable) {}
        (fresh.context as? MutableContextWrapper)?.baseContext = context
        if (appId != null) {
            tagTenant(fresh, appId)
        }
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
    @JvmOverloads
    @Synchronized
    fun recycle(webView: WebView, hotKey: String? = null, hotPayload: Any? = null): Boolean {
        // Fast path: keep this instance fully warm for a same-tenant remount.
        if (hotKey != null && parkHot(webView, hotKey, hotPayload)) return true
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
                GoatCookieManager.purgeAllInMemoryCookies()
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
                applyLowMemoryRendererPolicy(this)
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
        // App just went to background: standby WebViews are pure waste there and each one carries an
        // out-of-process renderer, which bloats this app's process group and makes it the first
        // thing the low-memory killer reaps — turning the next foreground into a full cold start.
        // Drop the standby pool immediately; keep the hot pool (it is what makes a fast return).
        if (level == ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN) {
            releaseStandby("UI hidden")   // pre-API-34 path; API 34+ uses ProcessLifecycle ON_STOP
            return
        }
        // Real memory pressure (running low, or backgrounded and being squeezed): drop everything.
        val isCritical = level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW ||
            level >= ComponentCallbacks2.TRIM_MEMORY_BACKGROUND
        if (isCritical && (pool.isNotEmpty() || hotPool.isNotEmpty())) {
            Log.w(TAG, "Memory trim alert (level=$level); purging ${pool.size} standby + ${hotPool.size} hot instances")
            trimMemory()
        }
    }

    /**
     * Destroys all standby WebView instances in the pool to free RAM immediately.
     */
    @Synchronized
    fun trimMemory() {
        val count = pool.size + hotPool.size
        while (pool.isNotEmpty()) {
            pool.removeFirstOrNull()?.let { destroySafely(it) }
        }
        hotPool.values.toList().forEach { destroySafely(it.webView) }
        hotPool.clear()
        if (count > 0) {
            Log.i(TAG, "Trimmed $count pooled/hot WebView instances from memory")
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

    @Volatile
    private var anyInstanceCreated = false

    /**
     * True once *any* WebView has been constructed in this process — meaning Chromium's native
     * library and V8 are already loaded.
     *
     * This is deliberately not the same question as "is the pool non-empty". A cold first mount
     * that beats the deferred warm-up takes its instance straight out of [acquire]'s
     * pool-empty branch, so it never touches [poolSize] — leaving the warm-up unable to tell that
     * the very cost it exists to hide has already been paid. See [GoatWarmupManager].
     */
    val isChromiumInitialized: Boolean
        get() = anyInstanceCreated

    /**
     * Creates a warm WebView instance wrapped in MutableContextWrapper with baseline configuration.
     *
     * @param context The Android context.
     * @return A newly created warm [WebView].
     */
    /**
     * @param warmNavigate whether to prime the renderer with an `about:blank` navigation.
     *   Correct for a *standby* instance that will sit in the pool: it spawns the renderer
     *   process ahead of the mount that eventually claims it. Wrong for an instance being built
     *   for immediate use, where the caller navigates to the real entry URL milliseconds later —
     *   there the blank load is a whole extra navigation on the cold-start critical path, and it
     *   is what makes a cold mount emit two `onPageFinished` callbacks (an `about:blank` commit
     *   followed by the real document) rather than one.
     */
    @JvmOverloads
    fun createWarmWebView(context: Context, warmNavigate: Boolean = false): WebView {
        val appContext = context.applicationContext ?: context
        val mutableContext = MutableContextWrapper(appContext)
        anyInstanceCreated = true
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
            if (warmNavigate) {
                try {
                    loadUrl("about:blank")
                } catch (e: Exception) {
                    // Handled for headless/mock environments
                }
            }
            // Idle standby: let the OS reclaim this renderer under memory pressure.
            applyLowMemoryRendererPolicy(this)
        }
    }

    /**
     * Pre-populates the pool up to [upTo] (default [MAX_POOL_SIZE]) during application idle time.
     * The automatic startup warm-up passes `upTo = 1`: one standby covers the first mount, and a
     * second idle WebView (~15–25 MB, plus its own renderer process) is pure resident cost on a
     * device that only ever opens one mini-app at a time. [MAX_POOL_SIZE] remains the hard cap that
     * [recycle] fills toward.
     *
     * @param context The Android context.
     */
    @JvmOverloads
    @Synchronized
    fun prewarmPool(context: Context, upTo: Int = MAX_POOL_SIZE) {
        // If a mini-app is already parked hot, a cold standby is dead RAM — skip it.
        val target = if (hotPool.isNotEmpty()) 0 else upTo.coerceIn(0, MAX_POOL_SIZE)
        while (pool.size < target) {
            try {
                pool.addLast(createWarmWebView(context, warmNavigate = false))
            } catch (e: Exception) {
                Log.e(TAG, "Failed prewarming WebView pool instance", e)
                break
            }
        }
        Log.d(TAG, "Prewarmed GoatFastPool (pool=${pool.size}, hot=${hotPool.size})")
    }

    /** Hot-pool cap for this device: [MAX_HOT_SIZE] normally, 1 on low-end hardware. */
    internal fun effectiveMaxHotSize(context: android.content.Context?): Int {
        if (context == null) return MAX_HOT_SIZE
        return if (GoatDeviceTier.isLowEnd(context)) 1 else MAX_HOT_SIZE
    }

    private fun destroySafely(webView: WebView) {
        clearTenantTag(webView)
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
