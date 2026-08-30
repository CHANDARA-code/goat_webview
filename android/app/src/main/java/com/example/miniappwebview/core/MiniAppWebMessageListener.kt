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
    onNativeAction: suspend (action: String, payload: JsonObject) -> Result<JsonObject>
) : WebViewCompat.WebMessageListener {

    private val delegate = GoatWebMessageListener(scope, onNativeAction)

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
