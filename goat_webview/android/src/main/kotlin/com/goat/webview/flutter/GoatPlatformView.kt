package com.goat.webview.flutter

import android.content.Context
import android.util.Log
import android.view.View
import com.goat.webview.GoatAssetManager
import com.goat.webview.GoatWarmupManager
import com.goat.webview.popup.GoatPopupRoutingPolicy
import com.goat.webview.view.GoatView
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.platform.PlatformView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put

/**
 * Android PlatformView embedding GoatView inside Flutter widget tree via Hybrid Composition.
 */
class GoatPlatformView(
    private val context: Context,
    private val id: Int,
    private val creationParams: Map<String, Any>?,
    private val messenger: BinaryMessenger
) : PlatformView, MethodChannel.MethodCallHandler {

    companion object {
        private const val TAG = "GoatPlatformView"
    }

    private val goatView = GoatView(context)
    private val channel = MethodChannel(messenger, "com.goat.webview/bridge_$id")
    private val job = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.IO + job)

    private fun jsonElementToAny(v: kotlinx.serialization.json.JsonElement): Any? = when (v) {
        is JsonNull -> null
        is kotlinx.serialization.json.JsonPrimitive ->
            if (v.isString) v.content
            else v.booleanOrNull ?: v.longOrNull ?: v.doubleOrNull ?: v.content
        is JsonObject -> jsonObjectToMap(v)
        is JsonArray -> v.map { jsonElementToAny(it) }
    }

    private fun jsonObjectToMap(jsonObj: JsonObject): Map<String, Any?> {
        val map = mutableMapOf<String, Any?>()
        for ((k, v) in jsonObj) {
            map[k] = jsonElementToAny(v)
        }
        return map
    }

    private fun mapToJsonObject(map: Map<String, Any?>): JsonObject {
        return buildJsonObject {
            for ((k, v) in map) {
                when (v) {
                    null -> {}
                    is Boolean -> put(k, v)
                    is Number -> {
                        if (v is Int || v is Long || v is Short || v is Byte) put(k, v.toLong())
                        else put(k, v.toDouble())
                    }
                    is String -> put(k, v)
                    is Map<*, *> -> @Suppress("UNCHECKED_CAST") put(k, mapToJsonObject(v as Map<String, Any?>))
                    is List<*> -> {
                        put(k, buildJsonArray {
                            for (item in v) {
                                when (item) {
                                    null -> add(JsonNull)
                                    is Boolean -> add(item)
                                    is Number -> {
                                        if (item is Int || item is Long || item is Short || item is Byte) add(item.toLong())
                                        else add(item.toDouble())
                                    }
                                    is String -> add(item)
                                    is Map<*, *> -> @Suppress("UNCHECKED_CAST") add(mapToJsonObject(item as Map<String, Any?>))
                                    else -> add(item.toString())
                                }
                            }
                        })
                    }
                    else -> put(k, v.toString())
                }
            }
        }
    }

    init {
        channel.setMethodCallHandler(this)
        // The mounted mini-app view keeps its WebView fully warm across remounts (warm pool swap).
        goatView.hotReuseEnabled = true
        val appId = (creationParams?.get("appId") as? String) ?: GoatAssetManager.DEFAULT_APP_ID
        val assetBundleName = (creationParams?.get("assetBundleName") as? String) ?: "miniapp.zip"
        val popupRoutingPolicyStr = creationParams?.get("popupRoutingPolicy") as? String
        goatView.defaultPopupRoutingPolicy = GoatPopupRoutingPolicy.fromString(popupRoutingPolicyStr)

        @Suppress("UNCHECKED_CAST")
        (creationParams?.get("initialUserScripts") as? List<String>)?.let {
            goatView.initialUserScripts = it
        }

        // T7 compat: off unless a compat consumer explicitly sets these creation params.
        (creationParams?.get("compatExternalSchemeResolver") as? Boolean)?.let {
            goatView.compatExternalSchemeResolver = it
        }
        @Suppress("UNCHECKED_CAST")
        (creationParams?.get("hostDomainAllowlist") as? List<*>)?.let { raw ->
            val hosts = raw.filterIsInstance<String>().filter { it.isNotBlank() }.toSet()
            if (hosts.isNotEmpty()) goatView.hostDomainAllowlist = hosts
        }
        (creationParams?.get("compatExternalLinkHosts") as? List<String>)?.let {
            goatView.compatExternalLinkHosts = it.toSet()
        }
        goatView.onExternalNavigation = { url ->
            scope.launch(Dispatchers.Main) { channel.invokeMethod("onExternalNavigation", url) }
        }

        // T8 compat (G7): each on*Compat callback is only assigned — at all — when the widget
        // says the Dart side actually supplied that handler. Left null (the GoatView default),
        // GoatWebViewClient's own `cb ?: return` skips the override's work entirely; assigning
        // it unconditionally here would silently defeat that gate by always marshalling.
        if (creationParams?.get("enableOnReceivedError") as? Boolean == true) {
            goatView.onReceivedErrorCompat = { url, errorCode, description ->
                scope.launch(Dispatchers.Main) {
                    channel.invokeMethod("onReceivedError", mapOf(
                        "url" to url, "errorCode" to errorCode, "description" to description
                    ))
                }
            }
        }
        if (creationParams?.get("enableOnReceivedHttpError") as? Boolean == true) {
            goatView.onReceivedHttpErrorCompat = { url, statusCode ->
                scope.launch(Dispatchers.Main) {
                    channel.invokeMethod("onReceivedHttpError", mapOf("url" to url, "statusCode" to statusCode))
                }
            }
        }
        if (creationParams?.get("enableOnPageCommitVisible") as? Boolean == true) {
            goatView.onPageCommitVisibleCompat = { url ->
                scope.launch(Dispatchers.Main) { channel.invokeMethod("onPageCommitVisible", url) }
            }
        }
        if (creationParams?.get("enableOnLoadResource") as? Boolean == true) {
            goatView.onLoadResourceCompat = { url ->
                scope.launch(Dispatchers.Main) { channel.invokeMethod("onLoadResource", url) }
            }
        }
        if (creationParams?.get("enableOnUpdateVisitedHistory") as? Boolean == true) {
            goatView.onUpdateVisitedHistoryCompat = { url, isReload ->
                scope.launch(Dispatchers.Main) {
                    channel.invokeMethod("onUpdateVisitedHistory", mapOf("url" to url, "isReload" to isReload))
                }
            }
        }
        if (creationParams?.get("enableOnConsoleMessage") as? Boolean == true) {
            goatView.onConsoleMessageCompat = { message, level ->
                scope.launch(Dispatchers.Main) {
                    channel.invokeMethod("onConsoleMessage", mapOf("message" to message, "messageLevel" to level))
                }
            }
        }

        // T9 compat: off unless requested. When on but no custom-refresh callback is wired,
        // pulling to refresh does a plain native reload() -- zero Dart round-trip (G8-style).
        // A custom onRefresh callback only costs a round-trip for hosts that actually asked for one.
        if (creationParams?.get("pullToRefreshEnabled") as? Boolean == true) {
            goatView.pullToRefreshEnabled = true
            if (creationParams?.get("enableOnPullToRefresh") as? Boolean == true) {
                goatView.onPullToRefresh = {
                    scope.launch(Dispatchers.Main) { channel.invokeMethod("onPullToRefresh", null) }
                }
            }
        }

        goatView.onPageStarted = {
            scope.launch(Dispatchers.Main) { channel.invokeMethod("onPageStarted", "") }
        }
        goatView.onPageFinished = {
            scope.launch(Dispatchers.Main) { channel.invokeMethod("onPageFinished", "") }
        }

        goatView.onPopupRequest = { req ->
            val wfMap = mutableMapOf<String, Any?>()
            req.windowFeatures.width?.let { wfMap["width"] = it }
            req.windowFeatures.height?.let { wfMap["height"] = it }
            req.windowFeatures.x?.let { wfMap["x"] = it }
            req.windowFeatures.y?.let { wfMap["y"] = it }
            req.windowFeatures.menuBar?.let { wfMap["menuBar"] = it }
            req.windowFeatures.statusBar?.let { wfMap["statusBar"] = it }
            req.windowFeatures.toolbars?.let { wfMap["toolbars"] = it }
            req.windowFeatures.resizable?.let { wfMap["resizable"] = it }
            req.windowFeatures.scrollbars?.let { wfMap["scrollbars"] = it }

            val eventMap = mapOf(
                "url" to req.url,
                "target" to req.target,
                "policy" to req.policy.name,
                "isUserGesture" to req.isUserGesture,
                "isDialog" to req.isDialog,
                "windowFeatures" to wfMap
            )
            scope.launch(Dispatchers.Main) {
                channel.invokeMethod("onPopupRequest", eventMap)
            }
            null
        }

        goatView.onBridgeAction = { action, payload ->
            // Execute against the view's own single handler
            val nativeResult = goatView.executeAction(action, payload)
            // BRIDGE_PING is a raw latency probe — skip the Flutter observation hop (the map
            // conversion + main-thread invokeMethod that every other action pays).
            if (action != "BRIDGE_PING") {
                // Build the observation payload on this (Default) thread and hop to Main only to
                // hand it to the channel. jsonObjectToMap recurses over the whole payload *and*
                // the whole result, so doing it inside the Main block ran that conversion on the
                // UI thread for every bridge call — work that scales with payload size and shows
                // up as jank, not as bridge latency. It also folded a kotlin.Result across the
                // suspension point, the value-class/R8 hazard this codebase documents elsewhere.
                val observation: Map<String, Any?> = nativeResult.fold(
                    onSuccess = { dataJson ->
                        mapOf(
                            "action" to action,
                            "payload" to jsonObjectToMap(payload),
                            "result" to jsonObjectToMap(dataJson),
                            "success" to true
                        )
                    },
                    onFailure = { err ->
                        mapOf(
                            "action" to action,
                            "payload" to jsonObjectToMap(payload),
                            "result" to null,
                            "success" to false,
                            "error" to (err.message ?: "Native execution error")
                        )
                    }
                )
                withContext(Dispatchers.Main) {
                    channel.invokeMethod("onBridgeMessage", observation)
                }
            }
            // Return native result to JS bridge
            nativeResult
        }

        // Pool warm-up is handled once per process by GoatAppInitializer's idle-time hook
        // (androidx.startup). Re-triggering it here would only schedule redundant main-thread
        // WebView construction; the explicit "prewarm" MethodChannel remains for host control.

        val initialUrl = (creationParams?.get("initialUrl") as? String)?.takeIf { it.isNotBlank() }
        // Warm pool swap in place — synchronous, no coroutine — if a parked instance matches.
        val hotAttached = initialUrl != null && goatView.tryHotAttachSync(initialUrl, appId)
        if (!hotAttached) {
            scope.launch {
                try {
                    if (initialUrl != null) {
                        // Mini-app-by-URL fast path: no zip extraction, no filesDir write, no asset
                        // loader. Straight to a pooled WebView + loadUrl.
                        goatView.initializeUrlAsync(initialUrl, appId = appId)
                    } else {
                        val assetDir = GoatAssetManager(context)
                            .ensureAssetsReady(bundleAssetPath = assetBundleName, appId = appId)
                        goatView.initializeAsync(assetDir, appId = appId)
                    }
                } catch (e: Exception) {
                    // Nothing downstream observes this failure -- the view just stays blank
                    // forever -- so it must at least be diagnosable from logcat.
                    Log.e(
                        TAG,
                        "Mini-app initialization failed (appId=$appId, " +
                            "target=${initialUrl ?: assetBundleName}); the view will stay blank",
                        e
                    )
                }
            }
        }
    }

    override fun getView(): View = goatView

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "evaluateJavascript" -> {
                val script = call.argument<String>("script") ?: ""
                goatView.evaluateJavascript(script) { res ->
                    result.success(res)
                }
            }
            "executeAction" -> {
                val action = call.argument<String>("action") ?: ""
                val payloadMap = call.argument<Map<String, Any>>("payload") ?: emptyMap()
                val jsonPayload = mapToJsonObject(payloadMap)

                scope.launch(Dispatchers.IO) {
                    val resultObj = goatView.executeAction(action, jsonPayload)
                    withContext(Dispatchers.Main) {
                        resultObj.fold(
                            onSuccess = { dataJson ->
                                result.success(mapOf(
                                    "id" to "req_flutter_${System.currentTimeMillis()}",
                                    "success" to true,
                                    "data" to jsonObjectToMap(dataJson),
                                    "error" to null
                                ))
                            },
                            onFailure = { err ->
                                result.success(mapOf(
                                    "id" to "req_flutter_${System.currentTimeMillis()}",
                                    "success" to false,
                                    "data" to null,
                                    "error" to (err.message ?: "Native execution error")
                                ))
                            }
                        )
                    }
                }
            }
            "callJs" -> {
                val action = call.argument<String>("action") ?: ""
                val payloadMap = call.argument<Map<String, Any>>("payload") ?: emptyMap()
                val jsonPayload = org.json.JSONObject(payloadMap).toString()
                val escapedAction = org.json.JSONObject.quote(action)
                val script = """
                    (function() {
                        window.dispatchEvent(new CustomEvent('native_call', {
                            detail: { action: $escapedAction, payload: $jsonPayload }
                        }));
                    })();
                """.trimIndent()
                goatView.evaluateJavascript(script) {
                    result.success(mapOf("id" to "req_flutter", "success" to true))
                }
            }
            "setTheme" -> {
                val isDark = call.argument<Boolean>("isDark") ?: true
                val script = "document.documentElement.classList.toggle('dark', $isDark);"
                goatView.evaluateJavascript(script) {
                    result.success(true)
                }
            }
            "prewarm" -> {
                GoatWarmupManager.prewarmNow(context)
                result.success(true)
            }
            "openMiniApp" -> {
                // In-place mini-app switch — no platform-view recreation.
                val url = call.argument<String>("url") ?: ""
                val targetAppId = call.argument<String>("appId") ?: "default"
                if (url.isNotBlank()) goatView.hotSwapTo(url, targetAppId)
                result.success(url.isNotBlank())
            }
            "goBack" -> {
                val canBack = goatView.canGoBack()
                if (canBack) {
                    goatView.goBack()
                }
                result.success(canBack)
            }
            "reload" -> {
                goatView.reload()
                result.success(null)
            }
            "getUrl" -> result.success(goatView.getUrl())
            "getTitle" -> result.success(goatView.getTitle())
            "canGoForward" -> result.success(goatView.canGoForward())
            "goForward" -> {
                goatView.goForward()
                result.success(null)
            }
            "getCopyBackForwardList" -> result.success(goatView.getCopyBackForwardList())
            "loadUrl" -> {
                val url = call.argument<String>("url") ?: ""
                if (url.isNotBlank()) goatView.loadUrl(url)
                result.success(url.isNotBlank())
            }
            "pause" -> {
                goatView.onPause()
                result.success(true)
            }
            "resume" -> {
                goatView.onResume()
                result.success(true)
            }
            "setRefreshing" -> {
                val refreshing = call.argument<Boolean>("refreshing") ?: false
                goatView.setRefreshing(refreshing)
                result.success(true)
            }
            "isRefreshing" -> result.success(goatView.isRefreshing)
            "setPopupRoutingPolicy" -> {
                val policyStr = call.argument<String>("policy")
                goatView.defaultPopupRoutingPolicy = GoatPopupRoutingPolicy.fromString(policyStr)
                result.success(null)
            }
            else -> result.notImplemented()
        }
    }

    override fun dispose() {
        job.cancel()
        channel.setMethodCallHandler(null)
        goatView.destroy()
    }
}
