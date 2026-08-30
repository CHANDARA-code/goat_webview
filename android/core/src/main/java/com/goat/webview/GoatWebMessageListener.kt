package com.goat.webview

import android.net.Uri
import android.util.Log
import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
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
    private val onNativeAction: suspend (action: String, payload: JsonObject) -> Result<JsonObject>
) : WebViewCompat.WebMessageListener {

    companion object {
        private const val TAG = "GoatBridge"

        /**
         * Helper to parse a raw incoming JSON message string into id, action, and payload.
         */
        fun parseMessage(messageText: String): Triple<String, String, JsonObject> {
            val element = Json.parseToJsonElement(messageText)
            val json = element as? JsonObject
                ?: throw IllegalArgumentException("Root message must be a JSON object")
            val requestId = (json["id"] as? JsonPrimitive)?.content ?: ""
            val action = (json["action"] as? JsonPrimitive)?.content ?: ""
            val payload = json["payload"] as? JsonObject ?: JsonObject(emptyMap())
            return Triple(requestId, action, payload)
        }

        /**
         * Helper to serialize a response object adhering to the standard IPC schema:
         * { "id": "...", "success": true, "data": { ... }, "error": null }
         */
        fun buildResponse(requestId: String, result: Result<JsonObject>): JsonObject {
            return buildJsonObject {
                put("id", requestId)
                put("success", result.isSuccess)
                if (result.isSuccess) {
                    put("data", result.getOrNull() ?: JsonObject(emptyMap()))
                    put("error", null as String?)
                } else {
                    put("data", null as String?)
                    put("error", result.exceptionOrNull()?.message ?: "Unknown native error")
                }
            }
        }
    }

    override fun onPostMessage(
        view: WebView,
        message: WebMessageCompat,
        sourceOrigin: Uri,
        isMainFrame: Boolean,
        replyProxy: JavaScriptReplyProxy
    ) {
        val messageText = message.data ?: return

        scope.launch(Dispatchers.Default) {
            var reqId = ""
            val result = try {
                val (requestId, action, payload) = parseMessage(messageText)
                reqId = requestId
                onNativeAction(action, payload)
            } catch (e: Throwable) {
                Log.e(TAG, "Error processing incoming WebMessage", e)
                Result.failure(e)
            }

            val responseJson = buildResponse(reqId, result)
            val responseString = responseJson.toString()

            withContext(Dispatchers.Main) {
                try {
                    replyProxy.postMessage(responseString)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to send response via replyProxy", e)
                }
            }
        }
    }
}
