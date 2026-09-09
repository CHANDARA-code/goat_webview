package com.example.miniappwebview.core

import android.net.Uri
import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import com.goat.webview.GoatWebMessageListener
import kotlinx.coroutines.CoroutineScope
import kotlinx.serialization.json.JsonObject

/**
 * Modern bidirectional Native-JS IPC handler implementing WebViewCompat.WebMessageListener.
 * Delegates to GoatWebMessageListener core implementation.
 */
class MiniAppWebMessageListener(
    scope: CoroutineScope,
    onNativeAction: suspend (action: String, payload: JsonObject) -> Result<JsonObject>,
    allowedOrigins: Set<String> = emptySet(),
    allowSubframes: Boolean = false
) : WebViewCompat.WebMessageListener {

    // Named arguments deliberately: GoatWebMessageListener takes allowedOrigins/allowSubframes
    // between scope and onNativeAction, and passing this positionally is what silently broke
    // this call site when those origin parameters were introduced.
    private val delegate = GoatWebMessageListener(
        scope = scope,
        allowedOrigins = allowedOrigins,
        allowSubframes = allowSubframes,
        onNativeAction = onNativeAction
    )

    override fun onPostMessage(
        view: WebView,
        message: WebMessageCompat,
        sourceOrigin: Uri,
        isMainFrame: Boolean,
        replyProxy: JavaScriptReplyProxy
    ) {
        delegate.onPostMessage(view, message, sourceOrigin, isMainFrame, replyProxy)
    }
}
