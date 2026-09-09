package com.goat.webview.compose

import android.content.res.Configuration
import android.graphics.Color
import android.net.Uri
import android.util.Log
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.goat.webview.GoatAssetManager
import com.goat.webview.GoatFastPool
import com.goat.webview.GoatWebMessageListener
import com.goat.webview.GoatWebViewClient
import com.goat.webview.popup.GoatPopupListener
import com.goat.webview.popup.GoatPopupManager
import com.goat.webview.popup.GoatPopupRequest
import com.goat.webview.popup.GoatPopupRoutingPolicy
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.io.File

private const val TAG = "GoatWebView"
private const val ENTRY_URL = "https://appassets.androidplatform.net/assets/index.html"
private const val BRIDGE_NAME = "nativeBridge"
private const val BRIDGE_ORIGIN = "https://appassets.androidplatform.net"

/**
 * Production-grade Jetpack Compose WebView component hosting the Goat Mini-App SPA.
 * Includes native multi-file upload support (onShowFileChooser), crash-free file download handling,
 * zero white flash rendering, native keyboard (IME) synchronization, and background RAM trimming.
 */
@Composable
fun GoatWebView(
    assetDir: File,
    appId: String = GoatAssetManager.DEFAULT_APP_ID,
    modifier: Modifier = Modifier,
    popupRoutingPolicy: GoatPopupRoutingPolicy = GoatPopupRoutingPolicy.AUTO,
    onPopupRequest: ((GoatPopupRequest) -> GoatPopupRoutingPolicy?)? = null,
    popupListener: GoatPopupListener? = null,
    onBridgeAction: suspend (String, JsonObject) -> Result<JsonObject>,
    onLoadingStateChanged: ((isLoading: Boolean) -> Unit)? = null,
    onAppServiceReady: ((appId: String) -> Unit)? = null,
    onAppServiceCrash: ((appId: String, error: String) -> Unit)? = null,
    onAppServiceTerminate: ((appId: String) -> Unit)? = null
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val coroutineScope = rememberCoroutineScope()
    var webViewRef by remember { mutableStateOf<WebView?>(null) }
    var canGoBack by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(true) }

    // Multi-File upload callback holder
    var filePathCallback by remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }

    // Multi-file picker contract launcher
    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenMultipleDocuments()
    ) { uris: List<Uri>? ->
        if (uris.isNullOrEmpty()) {
            filePathCallback?.onReceiveValue(null)
        } else {
            filePathCallback?.onReceiveValue(uris.toTypedArray())
        }
        filePathCallback = null
    }

    // Synchronize native Back button with WebView history stack
    BackHandler(enabled = canGoBack) {
        webViewRef?.let { wv ->
            if (wv.canGoBack()) {
                wv.goBack()
            }
        }
    }

    // Background RAM Trimming: Pause V8 and animations when backgrounded (Pillar 5)
    DisposableEffect(lifecycleOwner, webViewRef) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_PAUSE -> {
                    Log.d(TAG, "Lifecycle ON_PAUSE: Pausing WebView execution & trimming RAM")
                    webViewRef?.onPause()
                    try {
                        webViewRef?.settings?.offscreenPreRaster = false
                    } catch (e: Exception) {
                        // Handled in headless environments
                    }
                }
                Lifecycle.Event.ON_RESUME -> {
                    Log.d(TAG, "Lifecycle ON_RESUME: Resuming WebView execution")
                    webViewRef?.onResume()
                    try {
                        webViewRef?.settings?.offscreenPreRaster = true
                    } catch (e: Exception) {
                        // Handled in headless environments
                    }
                }
                else -> {}
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    DisposableEffect(context) {
        onDispose {
            Log.d(TAG, "Disposing GoatWebView resources")
            // Crucial: Release any dangling file chooser callback to prevent memory leak & deadlock
            filePathCallback?.onReceiveValue(null)
            filePathCallback = null

            webViewRef?.let { wv ->
                GoatFastPool.recycle(wv)
            }
            webViewRef = null
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .windowInsetsPadding(WindowInsets.ime)
    ) {
        val clientDomain = remember(appId) { GoatWebViewClient.resolveDomain(appId) }
        val allowedOrigins = remember(clientDomain) { setOf("https://$clientDomain", "https://appassets.androidplatform.net") }
        val entryUrl = remember(clientDomain) { "https://$clientDomain/assets/index.html" }

        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                GoatFastPool.acquire(ctx).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )

                    // Eliminate white flash with transparent background
                    setBackgroundColor(Color.TRANSPARENT)

                    // Performance & Security Settings
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

                    // System Theme (Dark/Light mode) Synchronization
                    try {
                        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
                            val isDark = (ctx.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
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
                                GoatWebMessageListener(coroutineScope) { action, payload ->
                                    when (action) {
                                        "ON_APP_SERVICE_READY", "APP_SERVICE_READY" -> onAppServiceReady?.invoke(appId)
                                        "ON_APP_SERVICE_CRASH", "APP_SERVICE_CRASH" -> onAppServiceCrash?.invoke(appId, payload["error"]?.toString() ?: "AppService crash")
                                        "ON_APP_SERVICE_TERMINATE", "APP_SERVICE_TERMINATE" -> onAppServiceTerminate?.invoke(appId)
                                    }
                                    onBridgeAction(action, payload)
                                }
                            )
                        } else {
                            Log.w(TAG, "WEB_MESSAGE_LISTENER is not supported on this device/ROM")
                        }
                    } catch (e: Throwable) {
                        // Handled for headless/mock unit test environments
                    }

                    // Handle Native File Downloads
                    setDownloadListener { url, _, contentDisposition, mimetype, _ ->
                        coroutineScope.launch {
                            val guessedName = URLUtil.guessFileName(url, contentDisposition, mimetype)
                            onBridgeAction(
                                "DOWNLOAD_FILE",
                                buildJsonObject {
                                    put("url", url)
                                    put("fileName", guessedName)
                                    put("title", guessedName)
                                }
                            )
                        }
                    }

                    webViewClient = GoatWebViewClient(
                        context = ctx,
                        extractedDir = assetDir,
                        appId = appId,
                        onPageStarted = {
                            isLoading = true
                            onLoadingStateChanged?.invoke(true)
                        },
                        onPageLoaded = {
                            isLoading = false
                            canGoBack = canGoBack()
                            onLoadingStateChanged?.invoke(false)
                        },
                        onRenderCrashed = { didCrash ->
                            onAppServiceCrash?.invoke(appId, "Render process crashed: didCrash=$didCrash")
                        }
                    )

                    webChromeClient = object : WebChromeClient() {
                        override fun onConsoleMessage(message: ConsoleMessage?): Boolean {
                            Log.d("GoatWebConsole", "[${message?.messageLevel()}] ${message?.message()} (${message?.sourceId()}:${message?.lineNumber()})")
                            return true
                        }

                        override fun onProgressChanged(view: WebView?, newProgress: Int) {
                            super.onProgressChanged(view, newProgress)
                            canGoBack = view?.canGoBack() == true
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
                                override fun onModalWindowCreated(modalView: com.goat.webview.view.GoatView, request: GoatPopupRequest) {
                                    popupListener?.onModalWindowCreated(modalView, request)
                                }
                                override fun onModalWindowClosed(modalView: com.goat.webview.view.GoatView) {
                                    popupListener?.onModalWindowClosed(modalView)
                                }
                            }
                            return GoatPopupManager.handleCreateWindow(
                                parentWebView = view,
                                parentContainer = null,
                                context = ctx,
                                appId = appId,
                                assetDir = assetDir,
                                isDialog = isDialog,
                                isUserGesture = isUserGesture,
                                resultMsg = resultMsg,
                                customListener = customListen,
                                routingPolicy = popupRoutingPolicy
                            )
                        }

                        override fun onCloseWindow(window: WebView?) {
                            GoatPopupManager.handleCloseWindow(window)
                        }

                        // Multi-File Chooser implementation with zero-stall guarantee
                        override fun onShowFileChooser(
                            webView: WebView?,
                            callback: ValueCallback<Array<Uri>>?,
                            params: FileChooserParams?
                        ): Boolean {
                            filePathCallback?.onReceiveValue(null)
                            filePathCallback = callback

                            val acceptTypes = params?.acceptTypes?.filter { it.isNotBlank() }?.toTypedArray()
                            val mimeTypes = if (!acceptTypes.isNullOrEmpty()) acceptTypes else arrayOf("*/*")

                            return try {
                                filePickerLauncher.launch(mimeTypes)
                                true
                            } catch (e: Exception) {
                                Log.e(TAG, "Failed launching file picker", e)
                                filePathCallback?.onReceiveValue(null)
                                filePathCallback = null
                                false
                            }
                        }
                    }

                    loadUrl(entryUrl)
                    webViewRef = this
                }
            },
            update = { webView ->
                canGoBack = webView.canGoBack()
            }
        )

        // Loading spinner overlay during initial cold load
        AnimatedVisibility(
            visible = isLoading,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.align(Alignment.Center)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(androidx.compose.ui.graphics.Color(0xFF020617)),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(
                    color = androidx.compose.ui.graphics.Color(0xFF38BDF8)
                )
            }
        }
    }
}
