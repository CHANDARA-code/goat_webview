package com.goat.webview.miniapp

import android.webkit.WebView
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.goat.webview.compose.GoatWebView
import kotlinx.serialization.json.JsonObject
import java.io.File

/**
 * Hardened MiniAppWebView component enforcing strict sandboxing and zero-trust file access policies (Task 10193).
 */
@Composable
fun MiniAppWebView(
    assetDir: File,
    appId: String = "default",
    modifier: Modifier = Modifier,
    onBridgeAction: suspend (String, JsonObject) -> Result<JsonObject>,
    onLoadingStateChanged: ((isLoading: Boolean) -> Unit)? = null,
    onAppServiceReady: ((appId: String) -> Unit)? = null,
    onAppServiceCrash: ((appId: String, error: String) -> Unit)? = null,
    onAppServiceTerminate: ((appId: String) -> Unit)? = null
) {
    GoatWebView(
        assetDir = assetDir,
        appId = appId,
        modifier = modifier,
        onBridgeAction = onBridgeAction,
        onLoadingStateChanged = onLoadingStateChanged,
        onAppServiceReady = onAppServiceReady,
        onAppServiceCrash = onAppServiceCrash,
        onAppServiceTerminate = onAppServiceTerminate
    )
}

// hardenFileAccessFlags() now lives in :core (Compose-free) — it is a security control, not UI.
