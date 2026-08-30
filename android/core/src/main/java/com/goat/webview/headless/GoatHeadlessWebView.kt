package com.goat.webview.headless

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.MutableContextWrapper
import android.graphics.Color
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.goat.webview.GoatAssetManager
import com.goat.webview.GoatBridgeActionHandler
import com.goat.webview.GoatWebMessageListener
import com.goat.webview.GoatWebViewClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Enterprise Headless WebView container for offscreen JavaScript background tasks and Mini-App execution.
 *
 * Key features:
 * 1. Instantiated with MutableContextWrapper to eliminate Activity context memory leaks.
 * 2. Attached to root view hierarchy with View.INVISIBLE to bypass Chromium V8 background task/timer throttling.
 * 3. Coroutine-based JavaScript evaluation (runScript / runScriptAsync).
 * 4. Native Bridge action execution and WebMessageListener IPC integration.
 * 5. Complete zero-leak disposal and teardown.
 */
class GoatHeadlessWebView(
    val context: Context,
    val appId: String = GoatAssetManager.DEFAULT_APP_ID,
    private val externalScope: CoroutineScope? = null
) {
    companion object {
        private const val TAG = "GoatHeadlessWebView"
        private const val BRIDGE_NAME = "nativeBridge"
    }

    private val coroutineDispatcher: kotlinx.coroutines.CoroutineDispatcher
        get() = try {
            Dispatchers.Main
        } catch (e: Throwable) {
            Dispatchers.Unconfined
        }

    private val isExternalScope = externalScope != null
    private val scope = externalScope ?: CoroutineScope(coroutineDispatcher + SupervisorJob())

    private val appContext: Context = context.applicationContext ?: context
    private val mutableContext = MutableContextWrapper(appContext)
    private val actionHandler = GoatBridgeActionHandler(
        context,
        appId = appId,
        autoRegisterPlugins = true,
        autoRegisterPayments = true,
    )

    internal val webView: WebView = createHeadlessWebView()
    private var isAttachedToHierarchy = false
    private var isDisposed = false

    init {
        // If an Activity context was provided, bind it to the mutable context wrapper
        if (context is Activity) {
            mutableContext.baseContext = context
        }
        attachToViewHierarchy()
    }

    private fun createHeadlessWebView(): WebView {
        return WebView(mutableContext).apply {
            visibility = View.INVISIBLE
            setBackgroundColor(Color.TRANSPARENT)

            try {
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    databaseEnabled = true
                    allowFileAccess = false
                    allowContentAccess = false
                    allowFileAccessFromFileURLs = false
                    allowUniversalAccessFromFileURLs = false
                    cacheMode = WebSettings.LOAD_DEFAULT
                    try {
                        offscreenPreRaster = true
                    } catch (e: Throwable) {
                        // Ignored on mock or older WebSettings
                    }
                }
            } catch (e: Throwable) {
                // Handled for unit test environments
            }

            // Register Modern WebMessageListener IPC Bridge
            try {
                if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
                    val clientDomain = GoatWebViewClient.resolveDomain(appId)
                    val allowedOrigins = setOf("https://$clientDomain", "https://appassets.androidplatform.net")
                    WebViewCompat.addWebMessageListener(
                        this,
                        BRIDGE_NAME,
                        allowedOrigins,
                        GoatWebMessageListener(scope) { action, payload ->
                            actionHandler.executeAction(action, payload)
                        }
                    )
                }
            } catch (e: Throwable) {
                // Handled for unit test environments
            }
        }
    }

    /**
     * Attaches the offscreen WebView to the active Activity root DecorView or Content FrameLayout
     * with View.INVISIBLE to bypass Chromium V8 background task throttling.
     */
    private fun attachToViewHierarchy() {
        val activity = findActivity(context)
        if (activity != null) {
            try {
                val rootViewGroup = activity.findViewById<ViewGroup>(android.R.id.content)
                    ?: (activity.window?.decorView as? ViewGroup)
                if (rootViewGroup != null) {
                    webView.visibility = View.INVISIBLE
                    webView.layoutParams = ViewGroup.LayoutParams(1, 1)
                    rootViewGroup.addView(webView)
                    isAttachedToHierarchy = true
                    Log.d(TAG, "Attached headless WebView to root view hierarchy with View.INVISIBLE")
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed attaching headless WebView to view hierarchy; running offscreen", e)
            }
        }
    }

    private fun findActivity(ctx: Context?): Activity? {
        var current: Context? = ctx
        while (current is ContextWrapper) {
            if (current is Activity) return current
            current = current.baseContext
        }
        return null
    }

    /**
     * Evaluates JavaScript asynchronously within the headless WebView DOM context.
     *
     * @param script The JavaScript code string to execute.
     * @return Evaluated result string (or JSON formatted primitive), or null.
     */
    suspend fun runScript(script: String): String? = withContext(coroutineDispatcher) {
        checkNotDisposed()
        suspendCancellableCoroutine { continuation ->
            try {
                webView.evaluateJavascript(script) { result ->
                    if (continuation.isActive) {
                        continuation.resume(result)
                    }
                }
            } catch (e: Throwable) {
                if (continuation.isActive) {
                    continuation.resumeWithException(e)
                }
            }
        }
    }

    /**
     * Asynchronously evaluates JavaScript returning a Deferred handle.
     */
    fun runScriptAsync(script: String): Deferred<String?> = scope.async(coroutineDispatcher) {
        runScript(script)
    }

    /**
     * Executes a native bridge action through the container's bound [GoatBridgeActionHandler].
     */
    suspend fun executeAction(action: String, payload: JsonObject): Result<JsonObject> = runCatching {
        checkNotDisposed()
        actionHandler.executeAction(action, payload).getOrThrow()
    }

    /**
     * Loads a raw web URL in the headless instance.
     */
    fun loadUrl(url: String) {
        checkNotDisposed()
        webView.loadUrl(url)
    }

    /**
     * Loads raw HTML data into the headless DOM.
     */
    fun loadHtml(html: String, baseUrl: String? = null) {
        checkNotDisposed()
        val base = baseUrl ?: "https://${GoatWebViewClient.resolveDomain(appId)}/assets/"
        webView.loadDataWithBaseURL(base, html, "text/html", "UTF-8", null)
    }

    /**
     * Loads an extracted mini-app bundle directory into the headless WebView with virtual domain isolation.
     */
    fun loadMiniApp(assetDir: File) {
        checkNotDisposed()
        webView.webViewClient = GoatWebViewClient(
            context = context,
            extractedDir = assetDir,
            appId = appId
        )
        val entryUrl = "https://${GoatWebViewClient.resolveDomain(appId)}/assets/index.html"
        webView.loadUrl(entryUrl)
    }

    /**
     * Complete zero-leak teardown and disposal of the headless WebView instance.
     */
    fun dispose() {
        if (isDisposed) return
        isDisposed = true

        try {
            // 1. Remove from parent hierarchy if attached
            if (isAttachedToHierarchy) {
                (webView.parent as? ViewGroup)?.removeView(webView)
                isAttachedToHierarchy = false
            }

            // 2. Restore baseContext to application context to prevent Activity leaks
            mutableContext.baseContext = appContext

            // 3. Stop loading, clear history, and destroy
            webView.apply {
                stopLoading()
                loadUrl("about:blank")
                clearHistory()
                destroy()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error disposing GoatHeadlessWebView", e)
        } finally {
            if (!isExternalScope) {
                scope.cancel()
            }
        }
    }

    private fun checkNotDisposed() {
        if (isDisposed) {
            throw IllegalStateException("GoatHeadlessWebView has already been disposed")
        }
    }
}
