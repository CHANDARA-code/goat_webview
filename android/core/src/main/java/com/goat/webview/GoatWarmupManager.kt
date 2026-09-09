package com.goat.webview

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log

/**
 * Pre-initializes the Chromium core, zygote, and V8 engine during Application.onCreate
 * or IdleHandler to eliminate 300-500ms from the first WebView render.
 */
object GoatWarmupManager {
    private const val TAG = "GoatWarmupManager"

    @Volatile
    private var prewarmStarted = false

    /**
     * Warms up the Chromium engine by instantiating a dummy WebView on an idle thread.
     *
     * This is the *opportunistic* entry point — the one every automatic startup hook uses. It
     * yields to a real mount that got there first (see [runPrewarm]); a host that genuinely wants
     * a standby regardless should call [prewarmNow].
     */
    fun prewarm(context: Context) {
        Looper.myQueue().addIdleHandler {
            runPrewarm(context, "idle", yieldToLiveInstance = true)
            false // Run once on idle
        }
    }

    /** Delay before the deferred pool warm-up runs, long enough to clear the first frame. */
    private const val DEFERRED_PREWARM_DELAY_MS = 350L

    /**
     * Schedules the WebView pool warm-up shortly after the caller's frame, off the launch
     * critical path. WebView construction must run on the main thread, so this never happens
     * "now" — it is posted with a small delay so the first frame renders first, then the pool
     * fills for the *next* mount / warm swap. Idempotent; the first call wins.
     *
     * This is the *explicit* entry point (the host-facing `prewarm` bridge call). Unlike
     * [prewarm], it does not yield to an already-live instance: a host asking for a standby is
     * asking for the next mount to be instant, which is exactly the case where one is wanted.
     */
    fun prewarmNow(context: Context) {
        if (prewarmStarted) return
        val appContext = context.applicationContext ?: context
        Handler(Looper.getMainLooper()).postDelayed(
            { runPrewarm(appContext, "deferred", yieldToLiveInstance = false) },
            DEFERRED_PREWARM_DELAY_MS
        )
    }

    /**
     * @param yieldToLiveInstance when true, do nothing if a WebView already exists in this
     *   process. Set for the automatic warm-ups only.
     */
    @Synchronized
    private fun runPrewarm(context: Context, source: String, yieldToLiveInstance: Boolean) {
        if (prewarmStarted && GoatFastPool.poolSize >= GoatFastPool.MAX_POOL_SIZE) return
        // A real mount that arrived before this fired already paid the Chromium-init cost this
        // warm-up exists to hide, and it took its instance from acquire()'s pool-empty branch, so
        // poolSize is still 0 and the guard above does not catch it. Building a standby now would
        // construct a *second* WebView (~15-25 MB plus a renderer process) on the launch critical
        // path, immediately after the most expensive moment of startup, for no latency benefit —
        // the pool refills for free when that live instance is recycled.
        // A standby WebView is a latency optimization paid for in RAM. On constrained hardware
        // that trade is wrong: creating a second WebView during startup raises peak memory at the
        // exact moment the low-memory killer is most likely to act, and being reaped costs the
        // user a full cold start -- far more than the prewarm would ever have saved.
        if (GoatDeviceTier.isLowEnd(context)) {
            prewarmStarted = true
            Log.d(TAG, "Skipping $source pre-warm; low-end device")
            return
        }
        if (yieldToLiveInstance && GoatFastPool.isChromiumInitialized) {
            prewarmStarted = true
            Log.d(TAG, "Skipping $source pre-warm; a live WebView already initialized Chromium")
            return
        }
        prewarmStarted = true
        try {
            val appContext = context.applicationContext ?: context
            // Filling the pool creates the first WebView, which is what actually loads the Chromium
            // native library and boots V8 — no need for a separate long-lived instance that the
            // background memory-trim path cannot reach. One standby is enough for the first mount;
            // a second idle WebView is ~15–25 MB (plus a renderer process) of resident cost on a
            // constrained device that opens one mini-app at a time.
            GoatFastPool.prewarmPool(appContext, upTo = 1)
            Log.d(TAG, "Chromium engine and GoatFastPool pre-warmed ($source, poolSize=${GoatFastPool.poolSize})")
        } catch (e: Exception) {
            Log.e(TAG, "Goat WebView pre-warmup failed ($source): ${e.message}", e)
        }
    }
}
