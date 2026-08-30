package com.example.miniappwebview.ui

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
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.example.miniappwebview.core.MiniAppWebMessageListener
import com.example.miniappwebview.core.MiniAppWebViewClient
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.io.File

private const val TAG = "MiniAppWebView"
private const val ENTRY_URL = "https://appassets.androidplatform.net/assets/index.html"
private const val BRIDGE_NAME = "nativeBridge"
private const val BRIDGE_ORIGIN = "https://appassets.androidplatform.net"

/**
 * Production-grade Jetpack Compose WebView component hosting the Mini-App SPA.
 * Includes native multi-file upload support (onShowFileChooser) and crash-free file download handling.
 */
@Composable
fun MiniAppWebView(
    assetDir: File,
    modifier: Modifier = Modifier,
    onBridgeAction: suspend (String, JsonObject) -> Result<JsonObject>,
    onLoadingStateChanged: ((isLoading: Boolean) -> Unit)? = null
) {
    val context = LocalContext.current
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

    DisposableEffect(context) {
        onDispose {
            Log.d(TAG, "Disposing MiniAppWebView resources")
            // Crucial: Release any dangling file chooser callback to prevent memory leak & deadlock
            filePathCallback?.onReceiveValue(null)
            filePathCallback = null

            webViewRef?.apply {
                stopLoading()
                loadUrl("about:blank")
                clearHistory()
                removeAllViews()
                destroy()
            }
            webViewRef = null
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                WebView(ctx).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )

                    // Eliminate white flash with transparent background
                    setBackgroundColor(Color.TRANSPARENT)

                    // Performance & Security Settings
                    settings.apply {
                        javaScriptEnabled = true
                        domStorageEnabled = true
                        cacheMode = WebSettings.LOAD_DEFAULT
                        allowFileAccess = false
                        allowContentAccess = false
                        setSupportZoom(false)
                        builtInZoomControls = false
                        displayZoomControls = false
                        useWideViewPort = true
                        loadWithOverviewMode = true
                    }

                    // System Theme (Dark/Light mode) Synchronization
                    if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
                        val isDark = (ctx.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
                        WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, isDark)
                    }

                    // Register Modern WebMessageListener IPC Bridge
                    if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
                        WebViewCompat.addWebMessageListener(
                            this,
                            BRIDGE_NAME,
                            setOf(BRIDGE_ORIGIN),
                            MiniAppWebMessageListener(coroutineScope, onBridgeAction)
                        )
                    } else {
                        Log.w(TAG, "WEB_MESSAGE_LISTENER is not supported on this device/ROM")
                    }

                    // Handle Native File Downloads from links or blob downloads
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

                    webViewClient = MiniAppWebViewClient(
                        context = ctx,
                        extractedDir = assetDir,
                        onPageStarted = {
                            isLoading = true
                            onLoadingStateChanged?.invoke(true)
                        },
                        onPageLoaded = {
                            isLoading = false
                            canGoBack = canGoBack()
                            onLoadingStateChanged?.invoke(false)
                        }
                    )

                    webChromeClient = object : WebChromeClient() {
                        override fun onConsoleMessage(message: ConsoleMessage?): Boolean {
                            Log.d("WebConsole", "[${message?.messageLevel()}] ${message?.message()} (${message?.sourceId()}:${message?.lineNumber()})")
                            return true
                        }

                        override fun onProgressChanged(view: WebView?, newProgress: Int) {
                            super.onProgressChanged(view, newProgress)
                            canGoBack = view?.canGoBack() == true
                        }

                        // Multi-File Chooser implementation with zero-stall guarantee
                        override fun onShowFileChooser(
                            webView: WebView?,
                            callback: ValueCallback<Array<Uri>>?,
                            params: FileChooserParams?
                        ): Boolean {
                            // Cancel any existing pending callback
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

                    loadUrl(ENTRY_URL)
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
