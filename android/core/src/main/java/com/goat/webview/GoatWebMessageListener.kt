package com.goat.webview

import android.net.Uri
import android.util.Log
import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Modern bidirectional Native-JS IPC handler implementing WebViewCompat.WebMessageListener.
 * Parses incoming JSON messages, dispatches native actions asynchronously, and returns
 * structured promise responses via JavaScriptReplyProxy.
 */
class GoatWebMessageListener(
    private val scope: CoroutineScope,
    private val allowedOrigins: Set<String> = emptySet(),
    private val allowSubframes: Boolean = false,
    private val onNativeAction: suspend (action: String, payload: JsonObject) -> Result<JsonObject>
) : WebViewCompat.WebMessageListener {

    companion object {
        private const val TAG = "GoatBridge"

        private val EMPTY_PAYLOAD = JsonObject(emptyMap())

        /**
         * Helper to parse a raw incoming JSON message string into id, action, and payload.
         */
        /**
         * Scheme + host + explicit port, lowercased, with path/query/fragment dropped.
         *
         * Parsed from the string rather than via `android.net.Uri` because unit tests in this module
         * run with `unitTests.isReturnDefaultValues = true`, where every `Uri` method returns null --
         * origin logic built on `Uri` cannot be tested here at all.
         */
        internal fun normalizeOrigin(raw: String?): String? {
            val text = raw?.trim().orEmpty()
            if (text.isEmpty()) return null
            val schemeEnd = text.indexOf("://")
            if (schemeEnd <= 0) return null
            val scheme = text.substring(0, schemeEnd).lowercase()
            if (scheme.any { !it.isLetterOrDigit() && it != '+' && it != '-' && it != '.' }) return null
            val rest = text.substring(schemeEnd + 3)
            val authority = rest.takeWhile { it != '/' && it != '?' && it != '#' }
            if (authority.isEmpty() || authority.contains('@')) return null
            val lastColon = authority.lastIndexOf(':')
            val portPart = if (lastColon > 0) authority.substring(lastColon + 1) else ""
            val hasPort = lastColon > 0 && portPart.isNotEmpty() && portPart.all { it.isDigit() }
            val host = (if (hasPort) authority.substring(0, lastColon) else authority).lowercase()
            if (host.isEmpty()) return null
            return if (hasPort) "$scheme://$host:$portPart" else "$scheme://$host"
        }

        fun parseMessage(messageText: String): Triple<String, String, JsonObject> {
            val element = Json.parseToJsonElement(messageText)
            val json = element as? JsonObject
                ?: throw IllegalArgumentException("Root message must be a JSON object")
            val requestId = (json["id"] as? JsonPrimitive)?.content ?: ""
            val action = (json["action"] as? JsonPrimitive)?.content ?: ""
            val payload = json["payload"] as? JsonObject ?: EMPTY_PAYLOAD
            return Triple(requestId, action, payload)
        }

        /**
         * Helper to serialize a response object adhering to the standard IPC schema:
         * { "id": "...", "success": true, "data": { ... }, "error": null }
         *
         * Takes plain reference types, never `kotlin.Result` — a value class flowing across a
         * suspend boundary is an R8 state-machine miscompile hazard on coroutine cancellation
         * (surfaces as `ClassCastException: kotlin.Result cannot be cast to JsonObject`).
         */
        fun buildResponse(requestId: String, data: JsonObject?, error: String?): JsonObject {
            return buildJsonObject {
                put("id", requestId)
                put("success", error == null)
                if (error == null) {
                    put("data", data ?: EMPTY_PAYLOAD)
                    put("error", null as String?)
                } else {
                    put("data", null as String?)
                    put("error", error)
                }
            }
        }
    }

    // A bridge message that is still in flight when the owning scope is cancelled (e.g. the app is
    // backgrounded) has nowhere to deliver its reply anyway. Contain any failure from that race —
    // including a coroutine-machinery ClassCastException seen when a value-class (kotlin.Result)
    // suspend result is resumed during cancellation under R8 — so it is logged, never fatal.
    private val bridgeErrors = CoroutineExceptionHandler { _, t ->
        Log.w(TAG, "Bridge message coroutine aborted (likely scope cancellation): ${t.message}")
    }

    /** Combined once rather than per message: `Dispatchers.Default + bridgeErrors` allocates a
     *  CombinedContext on every evaluation, and this runs for every JS bridge call. */
    private val bridgeDispatchContext = Dispatchers.Default + bridgeErrors

    /**
     * The transport's own `allowedOriginRules` is the first gate, but it is set to `*` for URL-mode
     * mini-apps, where the entry origin is not known until load time. With `*`, WebView delivers
     * messages from ANY frame at ANY origin -- including a cross-origin iframe embedded by the
     * loaded page -- so the bridge has to check the sender itself rather than trusting the rule.
     *
     * An empty [allowedOrigins] means the caller did not supply a policy; that is treated as
     * main-frame-only rather than allow-all, so a caller that forgets to pass origins gets the
     * restrictive behaviour instead of the permissive one.
     */
    internal fun isSenderPermitted(sourceOrigin: String?, isMainFrame: Boolean): Boolean {
        if (!isMainFrame && !allowSubframes) return false
        if (allowedOrigins.isEmpty()) return isMainFrame
        if (allowedOrigins.contains("*")) return true
        val origin = normalizeOrigin(sourceOrigin) ?: return false
        return allowedOrigins.any { normalizeOrigin(it) == origin }
    }

    override fun onPostMessage(
        view: WebView,
        message: WebMessageCompat,
        sourceOrigin: Uri,
        isMainFrame: Boolean,
        replyProxy: JavaScriptReplyProxy
    ) {
        val messageText = message.data ?: return

        if (!isSenderPermitted(sourceOrigin?.toString(), isMainFrame)) {
            Log.w(TAG, "Bridge message rejected: sender not permitted (mainFrame=$isMainFrame)")
            return
        }

        scope.launch(bridgeDispatchContext) {
            // computeResponse materialises the value-class (Result) suspend result into plain
            // reference-type locals before returning; this outer coroutine only awaits String.
            val responseString = computeResponse(messageText)
            withContext(Dispatchers.Main) {
                try {
                    replyProxy.postMessage(responseString)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to send response via replyProxy", e)
                }
            }
        }
    }

    private suspend fun computeResponse(messageText: String): String {
        var reqId = ""
        var data: JsonObject? = null
        var error: String? = null
        try {
            val (requestId, action, payload) = parseMessage(messageText)
            reqId = requestId
            val r = onNativeAction(action, payload)
            // Destructure the Result immediately, before any further suspension or return, so no
            // value-class instance is live across the coroutine state machine's resume points.
            if (r.isSuccess) {
                data = r.getOrNull() ?: EMPTY_PAYLOAD
            } else {
                error = r.exceptionOrNull()?.message ?: "Unknown native error"
            }
        } catch (e: CancellationException) {
            // A message whose owning scope is cancelled has nowhere to deliver its reply; let the
            // cancellation propagate to bridgeErrors rather than trying to build a response.
            throw e
        } catch (e: Throwable) {
            Log.e(TAG, "Error processing incoming WebMessage", e)
            error = e.message ?: "Unknown native error"
        }
        return buildResponse(reqId, data, error).toString()
    }
}
