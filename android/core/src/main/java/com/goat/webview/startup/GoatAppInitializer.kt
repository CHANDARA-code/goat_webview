package com.goat.webview.startup

import android.content.Context
import android.util.Log
import androidx.startup.Initializer
import com.goat.webview.GoatAssetManager
import com.goat.webview.GoatConfig
import com.goat.webview.GoatWarmupManager
import com.goat.webview.network.GoatNetworkPrewarmer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicBoolean

/**
 * AndroidX App Startup Initializer for Goat WebView.
 *
 * Automatically executes non-blocking background asset extraction and engine pre-warming
 * during early application initialization without requiring boilerplate code in `Application.onCreate()`.
 *
 * Fulfills Pillar 1 (Zero-Delay Boot) and OWASP MASVS performance/resilience constraints.
 */
class GoatAppInitializer : Initializer<Unit> {

    companion object {
        private const val TAG = "GoatAppInitializer"
        private val isInitialized = AtomicBoolean(false)
        private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

        /**
         * Checks if the Goat App Startup initializer has completed invocation.
         */
        fun isInitialized(): Boolean = isInitialized.get()

        /**
         * Resets the initialization state (primarily for automated testing).
         */
        internal fun resetForTesting() {
            isInitialized.set(false)
        }
    }

    /**
     * Initializes engine pre-warming and kicks off asynchronous background asset preparation.
     *
     * @param context Host application context passed by AndroidX App Startup provider.
     */
    override fun create(context: Context) {
        if (isInitialized.compareAndSet(false, true)) {
            Log.i(TAG, "Initializing Goat WebView Engine via AndroidX App Startup...")

            // 1. Trigger Chromium & V8 pre-warming on idle thread
            try {
                GoatWarmupManager.prewarm(context)
            } catch (e: Exception) {
                Log.w(TAG, "Early engine warmup encountered non-fatal error: ${e.message}", e)
            }

            // 2. Prewarm DNS + socket connections for hosts the host app declares
            try {
                GoatNetworkPrewarmer.prewarm(GoatConfig.preconnectHosts)
            } catch (e: Exception) {
                Log.w(TAG, "Network prewarm encountered non-fatal error: ${e.message}", e)
            }

            // 3. Launch asynchronous non-blocking asset verification and extraction
            scope.launch {
                try {
                    val assetManager = GoatAssetManager(context.applicationContext)
                    assetManager.ensureAssetsReady()
                    Log.i(TAG, "Default mini-app assets verified and ready in background.")
                } catch (e: Exception) {
                    Log.e(TAG, "Background asset preparation error: ${e.message}", e)
                }
            }
        }
    }

    /**
     * Declares that GoatAppInitializer has no prerequisite initializers.
     *
     * @return Empty list of initializer dependencies.
     */
    override fun dependencies(): List<Class<out Initializer<*>>> = emptyList()
}
