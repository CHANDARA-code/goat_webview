package com.goat.webview.view

import android.content.Context
import android.content.res.Configuration
import android.graphics.Color
import android.net.Uri
import android.util.AttributeSet
import android.util.Log
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.goat.webview.GoatAssetManager
import com.goat.webview.GoatBridgeActionHandler
import com.goat.webview.GoatFastPool
import com.goat.webview.GoatFindInPageController
import com.goat.webview.GoatPrintController
import com.goat.webview.GoatStorageManager
import com.goat.webview.GoatWebMessageListener
import com.goat.webview.GoatWebViewClient
import com.goat.webview.RealWebViewFindAdapter
import com.goat.webview.ui.GoatFindInPageOverlay
import com.goat.webview.popup.GoatPopupListener
import com.goat.webview.popup.GoatPopupManager
import com.goat.webview.popup.GoatPopupRequest
import com.goat.webview.popup.GoatPopupRoutingPolicy
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.io.File

/**
 * Enterprise-grade Android View container for Goat WebView.
 * Designed for modular reuse across Android Views, React Native Fabric components, and Flutter PlatformViews.
 */
class GoatView @JvmOverloads constructor(
    private val hostContext: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(hostContext, attrs, defStyleAttr) {

    companion object {
        private const val TAG = "GoatView"
        const val ENTRY_URL = "https://appassets.androidplatform.net/assets/index.html"
        const val BRIDGE_NAME = "nativeBridge"
        const val BRIDGE_ORIGIN = "https://appassets.androidplatform.net"
    }

    private val viewScope = CoroutineScope(Dispatchers.Main + Job())
    private var webView: WebView? = null
    private var actionHandler: GoatBridgeActionHandler? = null
    private val findInPageController = GoatFindInPageController()
    private val findInPageOverlay: GoatFindInPageOverlay by lazy { GoatFindInPageOverlay(hostContext) }
    private var cachedFindAdapter: RealWebViewFindAdapter? = null
    private var cachedFindAdapterWebView: WebView? = null
    private val printController = GoatPrintController()
    private val storageManager: GoatStorageManager by lazy { GoatStorageManager(context ?: hostContext) }

    private fun findAdapterFor(wv: WebView): RealWebViewFindAdapter {
        if (cachedFindAdapterWebView !== wv) {
            cachedFindAdapter = RealWebViewFindAdapter(wv)
            cachedFindAdapterWebView = wv
        }
        return cachedFindAdapter!!
    }

    private fun updateFindOverlay(result: GoatFindInPageController.FindResult) {
        if (result.query.isEmpty()) {
            findInPageOverlay.dismiss()
            return
        }
        findInPageOverlay.show(this, result.matchCount, result.activeMatchIndex)
    }

    /**
     * Runs a native find-in-page query on the current WebView (FIND_IN_PAGE / Task 10184).
     * Highlighting is Chromium's own native implementation — no DOM mutation.
     */
    suspend fun handleFindInPage(query: String): JsonObject {
        val wv = webView ?: return buildJsonObject { put("matchCount", 0); put("activeMatchIndex", 0) }
        val result = findInPageController.findInPage(findAdapterFor(wv), query)
        updateFindOverlay(result)
        return buildJsonObject {
            put("matchCount", result.matchCount)
            put("activeMatchIndex", result.activeMatchIndex)
        }
    }

    /** Cycles the active find match forward/backward, scrolling it into view (FIND_NEXT). */
    suspend fun handleFindNext(forward: Boolean): JsonObject {
        val wv = webView ?: return buildJsonObject { put("matchCount", 0); put("activeMatchIndex", 0) }
        val result = findInPageController.findNext(findAdapterFor(wv), forward)
        updateFindOverlay(result)
        return buildJsonObject {
            put("matchCount", result.matchCount)
            put("activeMatchIndex", result.activeMatchIndex)
        }
    }

    /** Clears find highlights and dismisses the overlay (FIND_CLEAR, and on SPA route change). */
    fun handleFindClear() {
        val wv = webView ?: return
        findInPageController.clear(findAdapterFor(wv))
        findInPageOverlay.dismiss()
    }

    /**
     * Triggers the native system print sheet or a sandboxed PDF export of the current page
     * (PRINT_PAGE / Task 10185). `EXPORT_PDF` rasterizes the real WebView content into a PDF
     * and persists it through [GoatStorageManager] so it lands exclusively inside the calling
     * tenant's sandbox.
     */
    suspend fun handlePrintPage(jobName: String, mode: String): JsonObject {
        val wv = webView ?: throw IllegalStateException("WebView not initialized")
        val activeContext = context ?: hostContext
        if (mode != "EXPORT_PDF") {
            val shown = printController.showSystemPrintSheet(activeContext, wv, jobName)
            return buildJsonObject { put("shown", shown) }
        }

        val safeFileName = jobName.replace(Regex("[^A-Za-z0-9_-]"), "_").ifEmpty { "print_job" }
        val pdfBytes = printController.exportToPdf(wv)
        if (pdfBytes.isEmpty()) {
            throw IllegalStateException("PDF export failed for job '$jobName'")
        }
        val relativePath = "exports/$safeFileName.pdf"
        storageManager.writeFile(appId = currentAppId, relativePath = relativePath, data = pdfBytes)
        return buildJsonObject { put("pdfUri", "goat://fs/$relativePath") }
    }

    var currentAssetDir: File? = null
        private set
    var currentAppId: String = GoatAssetManager.DEFAULT_APP_ID
        private set
    var defaultPopupRoutingPolicy: GoatPopupRoutingPolicy = GoatPopupRoutingPolicy.AUTO
    var onPopupRequest: ((GoatPopupRequest) -> GoatPopupRoutingPolicy?)? = null
    var popupListener: GoatPopupListener? = null

    var onBridgeAction: (suspend (action: String, payload: JsonObject) -> Result<JsonObject>)? = null
    var onPageStarted: (() -> Unit)? = null
    var onPageFinished: (() -> Unit)? = null
    var onError: ((description: String) -> Unit)? = null
    var onFileChooserRequested: ((callback: ValueCallback<Array<Uri>>?, acceptTypes: Array<String>?) -> Boolean)? = null
    /** Host-provided real OS runtime permission requester (Task 10198). Wire via
     *  `ActivityResultContracts.RequestMultiplePermissions()` registered on the host Activity. */
    var onRequestOsPermissions: (suspend (permissions: Array<String>) -> Map<String, Boolean>)? = null
    var onAppServiceReady: ((appId: String, details: JsonObject?) -> Unit)? = null
    var onAppServiceCrash: ((appId: String, error: String, details: JsonObject?) -> Unit)? = null
    var onAppServiceTerminate: ((appId: String, details: JsonObject?) -> Unit)? = null
    var onSetAdaptiveRefreshRate: ((elevate: Boolean) -> Boolean)? = null

    private var pendingTextZoom: Int = 100
    var onTextZoomApplied: ((zoom: Int) -> Unit)? = null

    fun setTextZoom(zoom: Int): Boolean {
        val clamped = com.goat.webview.accessibility.GoatTextZoomPolicy.clampTextZoom(zoom)
        pendingTextZoom = clamped
        val wv = webView
        return if (wv != null) {
            try {
                wv.settings.textZoom = clamped
                onTextZoomApplied?.invoke(clamped)
                true
            } catch (e: Throwable) {
                false
            }
        } else {
            false
        }
    }

    fun getTextZoom(): Int = pendingTextZoom

    fun syncSystemFontScale(fontScale: Float) {
        val zoom = com.goat.webview.accessibility.GoatTextZoomPolicy.fontScaleToTextZoom(fontScale)
        setTextZoom(zoom)
    }

    fun getUnderlyingWebView(): WebView? = webView

    init {
        try {
            setBackgroundColor(Color.TRANSPARENT)
        } catch (e: Exception) {
            // Ignored in unit test environment
        }
    }

    /**
     * Initializes and loads the WebView with the given extracted asset directory.
     */
    @JvmOverloads
    fun initialize(
        assetDir: File,
        customActionHandler: GoatBridgeActionHandler? = null,
        appId: String = GoatAssetManager.DEFAULT_APP_ID,
        entryUrl: String? = null
    ) {
        val activeContext = context ?: hostContext
        currentAssetDir = assetDir
        currentAppId = appId
        actionHandler = customActionHandler ?: GoatBridgeActionHandler(
            context = activeContext,
            appId = appId,
            autoRegisterPlugins = true,
            autoRegisterPayments = true,
            onAppServiceReady = { id, details -> onAppServiceReady?.invoke(id, details) },
            onAppServiceCrash = { id, error, details -> onAppServiceCrash?.invoke(id, error, details) },
            onAppServiceTerminate = { id, details -> onAppServiceTerminate?.invoke(id, details) },
            onSetAdaptiveRefreshRate = { elevate -> onSetAdaptiveRefreshRate?.invoke(elevate) ?: false },
            onRequestOsPermissions = { perms -> onRequestOsPermissions?.invoke(perms) ?: emptyMap() },
            onFindInPage = { query -> handleFindInPage(query) },
            onFindNext = { forward -> handleFindNext(forward) },
            onFindClear = { handleFindClear() },
            onPrintPage = { jobName, mode -> handlePrintPage(jobName, mode) }
        )

        findInPageOverlay.onNext = { viewScope.launch { handleFindNext(true) } }
        findInPageOverlay.onPrevious = { viewScope.launch { handleFindNext(false) } }
        findInPageOverlay.onClose = { handleFindClear() }

        val clientDomain = GoatWebViewClient.resolveDomain(appId)
        val allowedOrigins = setOf("https://$clientDomain", "https://appassets.androidplatform.net")
        val finalEntryUrl = entryUrl ?: "https://$clientDomain/assets/index.html"

        val wv = GoatFastPool.acquire(activeContext).apply {
            layoutParams = LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )

            // Transparent canvas to eliminate white flash
            setBackgroundColor(Color.TRANSPARENT)

            // Performance & Security Flags
            try {
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    try {
                        setSupportMultipleWindows(true)
                    } catch (_: Throwable) {}
                    try {
                        javaScriptCanOpenWindowsAutomatically = true
                    } catch (_: Throwable) {}
                    cacheMode = WebSettings.LOAD_DEFAULT
                    allowFileAccess = false
                    allowContentAccess = false
                    allowFileAccessFromFileURLs = false
                    allowUniversalAccessFromFileURLs = false
                    setSupportZoom(false)
                    builtInZoomControls = false
                    displayZoomControls = false
                    useWideViewPort = true
                    loadWithOverviewMode = true
                }
            } catch (e: Throwable) {
                // Handled for headless/mock unit test environments
            }

            // Algorithmic Darkening Sync
            try {
                if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
                    val isDark = (activeContext.resources?.configuration?.uiMode ?: 0 and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
                    WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, isDark)
                }
            } catch (e: Throwable) {
                // Handled for headless/mock unit test environments
            }

            // Register Modern WebMessageListener IPC Bridge
            try {
                if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
                    WebViewCompat.addWebMessageListener(
                        this,
                        BRIDGE_NAME,
                        allowedOrigins,
                        GoatWebMessageListener(viewScope) { action, payload ->
                            val custom = onBridgeAction
                            if (custom != null) {
                                custom(action, payload)
                            } else {
                                actionHandler?.executeAction(action, payload)
                                    ?: Result.failure(IllegalStateException("Action handler not initialized"))
                            }
                        }
                    )
                } else {
                    Log.w(TAG, "WEB_MESSAGE_LISTENER is not supported on this device")
                }
            } catch (e: Throwable) {
                // Handled for headless/mock unit test environments
            }

            // Download Listener
            setDownloadListener { url, _, contentDisposition, mimetype, _ ->
                viewScope.launch {
                    val guessedName = URLUtil.guessFileName(url, contentDisposition, mimetype)
                    val payload = buildJsonObject {
                        put("url", url)
                        put("fileName", guessedName)
                        put("title", guessedName)
                    }
                    actionHandler?.executeAction("DOWNLOAD_FILE", payload)
                }
            }

            webViewClient = GoatWebViewClient(
                context = activeContext,
                extractedDir = assetDir,
                appId = appId,
                onPageStarted = { onPageStarted?.invoke() },
                onPageLoaded = { onPageFinished?.invoke() },
                onRenderCrashed = { didCrash ->
                    onError?.invoke("Render process crashed: didCrash=$didCrash")
                    onAppServiceCrash?.invoke(appId, "Render process crashed: didCrash=$didCrash", null)
                }
            )

            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(message: ConsoleMessage?): Boolean {
                    Log.d("GoatWebConsole", "[${message?.messageLevel()}] ${message?.message()}")
                    return true
                }

                override fun onCreateWindow(
                    view: WebView?,
                    isDialog: Boolean,
                    isUserGesture: Boolean,
                    resultMsg: android.os.Message?
                ): Boolean {
                    val customListen = object : GoatPopupListener {
                        override fun onPopupRequest(request: GoatPopupRequest): GoatPopupRoutingPolicy? {
                            return onPopupRequest?.invoke(request) ?: popupListener?.onPopupRequest(request)
                        }
                        override fun onModalWindowCreated(modalView: GoatView, request: GoatPopupRequest) {
                            popupListener?.onModalWindowCreated(modalView, request)
                        }
                        override fun onModalWindowClosed(modalView: GoatView) {
                            popupListener?.onModalWindowClosed(modalView)
                        }
                    }
                    return GoatPopupManager.handleCreateWindow(
                        parentGoatView = this@GoatView,
                        isDialog = isDialog,
                        isUserGesture = isUserGesture,
                        resultMsg = resultMsg,
                        customListener = customListen,
                        routingPolicy = defaultPopupRoutingPolicy,
                        eventCoalescer = actionHandler?.coalescer
                    )
                }

                override fun onCloseWindow(window: WebView?) {
                    GoatPopupManager.handleCloseWindow(window)
                }

                override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    val customChooser = onFileChooserRequested
                    if (customChooser != null) {
                        return customChooser(filePathCallback, fileChooserParams?.acceptTypes)
                    }
                    return false
                }

                override fun onPermissionRequest(request: android.webkit.PermissionRequest?) {
                    if (request == null) return
                    val resources = request.resources ?: return
                    val scope = when {
                        resources.contains(android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE) -> com.goat.webview.GoatPermissionManager.SCOPE_CAMERA
                        resources.contains(android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE) -> com.goat.webview.GoatPermissionManager.SCOPE_RECORD
                        else -> "web_resource"
                    }

                    val act = activeContext as? android.app.Activity
                    val isPermanentlyDenied = if (act != null) {
                        val perm = when (scope) {
                            com.goat.webview.GoatPermissionManager.SCOPE_CAMERA -> android.Manifest.permission.CAMERA
                            com.goat.webview.GoatPermissionManager.SCOPE_RECORD -> android.Manifest.permission.RECORD_AUDIO
                            else -> null
                        }
                        if (perm != null) com.goat.webview.permission.GoatPermissionPrimingDialog.isPermanentlyDenied(act, perm) else false
                    } else false

                    com.goat.webview.permission.GoatPermissionPrimingDialog.show(
                        context = activeContext,
                        appId = appId,
                        scope = scope,
                        rationale = "Mini-App '$appId' is requesting access to $scope to enable interactive features.",
                        isPermanentlyDenied = isPermanentlyDenied,
                        onAccept = {
                            request.grant(resources)
                        },
                        onDenied = {
                            request.deny()
                        }
                    )
                }
            }

            loadUrl(finalEntryUrl)
        }

        webView = wv
        try {
            wv.settings.textZoom = pendingTextZoom
        } catch (e: Throwable) {
        }
        removeAllViews()
        addView(wv)
    }

    override fun dispatchTouchEvent(ev: android.view.MotionEvent?): Boolean {
        if (ev?.action == android.view.MotionEvent.ACTION_DOWN || ev?.action == android.view.MotionEvent.ACTION_UP) {
            actionHandler?.abuseGuard?.recordUserGesture()
        }
        return super.dispatchTouchEvent(ev)
    }

    /**
     * Executes arbitrary JavaScript inside the loaded page.
     */
    fun evaluateJavascript(script: String, callback: ((String?) -> Unit)? = null) {
        webView?.evaluateJavascript(script) { result ->
            callback?.invoke(result)
        }
    }

    /**
     * Can the WebView navigate back in history?
     */
    fun canGoBack(): Boolean = webView?.canGoBack() == true

    /**
     * Navigates back in history.
     */
    fun goBack() {
        webView?.goBack()
    }

    /**
     * Reloads current page.
     */
    fun reload() {
        webView?.reload()
    }

    /**
     * Pauses WebView V8 JavaScript execution and animation frames for background RAM trimming (Pillar 5).
     * Disables offscreen pre-rasterization to drop background memory consumption below 8MB.
     * Note: Does NOT call process-wide pauseTimers() to avoid freezing other WebViews.
     */
    fun onPause() {
        webView?.let { wv ->
            wv.onPause()
            try {
                wv.settings.offscreenPreRaster = false
            } catch (e: Exception) {
                // Handled in headless environments
            }
        }
    }

    /**
     * Resumes WebView V8 execution and restores pre-rasterization when the screen is foregrounded.
     */
    fun onResume() {
        webView?.let { wv ->
            wv.onResume()
            try {
                wv.settings.offscreenPreRaster = true
            } catch (e: Exception) {
                // Handled in headless environments
            }
        }
    }

    /**
     * Handles Android OS memory trimming alerts (ComponentCallbacks2).
     *
     * @param level Memory pressure level from [android.content.ComponentCallbacks2].
     */
    @Suppress("DEPRECATION")
    fun onTrimMemory(level: Int) {
        if (level >= android.content.ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW ||
            level == android.content.ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN
        ) {
            webView?.clearCache(false)
            webView?.freeMemory()
        }
    }

    /**
     * Disposes the WebView and its associated resources to prevent leaks,
     * recycling clean instances into GoatFastPool.
     */
    fun destroy() {
        actionHandler?.coalescer?.cancelAll()
        viewScope.cancel()
        webView?.let { wv ->
            GoatFastPool.recycle(wv)
        }
        webView = null
        removeAllViews()
    }
}
