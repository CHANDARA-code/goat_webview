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
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
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
import com.example.miniappwebview.hud.DebugHudManager
import com.example.miniappwebview.navigation.ShowcaseDestination
import com.goat.webview.GoatBridgeActionHandler
import com.goat.webview.GoatFastPool
import com.goat.webview.GoatWebMessageListener
import com.goat.webview.GoatWebViewClient
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.io.File

private const val TAG = "GoatFastPoolContainer"
private const val BRIDGE_NAME = "nativeBridge"

/**
 * Multi-Tenant Jetpack Compose Container powered by GoatFastPool (Pillar 2).
 * Acquires a pre-warmed, sanitized WebView upon mount / tab switch and recycles it
 * with an 8-step zero-bleed teardown policy when switching away or on unmount.
 */
@Composable
fun GoatFastPoolContainer(
    destination: ShowcaseDestination,
    assetDir: File,
    hudManager: DebugHudManager,
    bridgeActionHandler: GoatBridgeActionHandler,
    modifier: Modifier = Modifier,
    onLoadingChanged: ((Boolean) -> Unit)? = null
) {
    key(destination.id) {
        FastPoolSingleTenantView(
            destination = destination,
            assetDir = assetDir,
            hudManager = hudManager,
            bridgeActionHandler = bridgeActionHandler,
            modifier = modifier,
            onLoadingChanged = onLoadingChanged
        )
    }
}

@Composable
private fun FastPoolSingleTenantView(
    destination: ShowcaseDestination,
    assetDir: File,
    hudManager: DebugHudManager,
    bridgeActionHandler: GoatBridgeActionHandler,
    modifier: Modifier = Modifier,
    onLoadingChanged: ((Boolean) -> Unit)? = null
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val coroutineScope = rememberCoroutineScope()

    var webViewRef by remember { mutableStateOf<WebView?>(null) }
    var canGoBack by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(true) }

    // Multi-File upload callback holder
    var filePathCallback by remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }

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

    // Hardware Back Handler synchronization
    BackHandler(enabled = canGoBack) {
        webViewRef?.let { wv ->
            if (wv.canGoBack()) {
                wv.goBack()
            }
        }
    }

    // Background RAM trimming lifecycle observer
    DisposableEffect(lifecycleOwner, webViewRef) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_PAUSE -> {
                    Log.d(TAG, "ON_PAUSE: Pausing tenant ${destination.appId} execution")
                    webViewRef?.onPause()
                }
                Lifecycle.Event.ON_RESUME -> {
                    Log.d(TAG, "ON_RESUME: Resuming tenant ${destination.appId} execution")
                    webViewRef?.onResume()
                }
                else -> {}
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    // Multi-tenant FastPool Lifecycle: Recycle instance on tab switch or unmount
    DisposableEffect(destination.id) {
        onDispose {
            Log.d(TAG, "Recycling WebView instance for tab '${destination.id}' back into GoatFastPool")
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
        val clientDomain = GoatWebViewClient.resolveDomain(destination.appId)
        val allowedOrigins = setOf(
            "https://$clientDomain",
            "https://appassets.androidplatform.net",
            "goat://assets"
        )
        val entryUrl = "https://$clientDomain/assets/index.html${destination.route}"

        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                // Acquire warm, sanitized instance from GoatFastPool
                GoatFastPool.acquire(ctx).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )

                    // Eliminate white flash
                    setBackgroundColor(Color.TRANSPARENT)

                    // Performance & Security Settings
                    try {
                        settings.apply {
                            javaScriptEnabled = true
                            domStorageEnabled = true
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
                    } catch (_: Throwable) {}

                    // System Theme Sync
                    try {
                        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
                            val isDark = (ctx.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
                            WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, isDark)
                        }
                    } catch (_: Throwable) {}

                    // Register Modern WebMessageListener with Debug HUD Telemetry Interceptor
                    try {
                        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
                            WebViewCompat.addWebMessageListener(
                                this,
                                BRIDGE_NAME,
                                allowedOrigins,
                                GoatWebMessageListener(coroutineScope) { action, payload ->
                                    // Route through HUD Manager for latency measurement & hardware overrides
                                    hudManager.interceptBridgeAction(action, payload) { act, pay ->
                                        bridgeActionHandler.executeAction(act, pay)
                                    }
                                }
                            )
                        }
                    } catch (_: Throwable) {}

                    // Download Listener
                    setDownloadListener { url, _, contentDisposition, mimetype, _ ->
                        coroutineScope.launch {
                            val guessedName = URLUtil.guessFileName(url, contentDisposition, mimetype)
                            hudManager.interceptBridgeAction(
                                "DOWNLOAD_FILE",
                                buildJsonObject {
                                    put("url", url)
                                    put("fileName", guessedName)
                                    put("title", guessedName)
                                }
                            ) { act, pay ->
                                bridgeActionHandler.executeAction(act, pay)
                            }
                        }
                    }

                    // WebViewClient with AndroidX Asset Loader
                    webViewClient = GoatWebViewClient(
                        context = ctx,
                        extractedDir = assetDir,
                        appId = destination.appId,
                        onPageStarted = {
                            isLoading = true
                            onLoadingChanged?.invoke(true)
                        },
                        onPageLoaded = {
                            isLoading = false
                            canGoBack = canGoBack()
                            onLoadingChanged?.invoke(false)
                        },
                        onRenderCrashed = { didCrash ->
                            Log.e(TAG, "Render process gone for ${destination.appId}, didCrash=$didCrash")
                        }
                    )

                    // WebChromeClient
                    webChromeClient = object : WebChromeClient() {
                        override fun onConsoleMessage(message: ConsoleMessage?): Boolean {
                            Log.d("GoatWebConsole", "[${destination.id}] [${message?.messageLevel()}] ${message?.message()}")
                            return true
                        }

                        override fun onProgressChanged(view: WebView?, newProgress: Int) {
                            super.onProgressChanged(view, newProgress)
                            canGoBack = view?.canGoBack() == true
                        }

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

                    Log.d(TAG, "Loading entry URL for tenant '${destination.appId}': $entryUrl")
                    loadUrl(entryUrl)
                    webViewRef = this
                }
            },
            update = { webView ->
                canGoBack = webView.canGoBack()
            }
        )

        // Loading spinner overlay
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
