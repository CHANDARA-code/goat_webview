package com.goat.webview.flutter

import android.content.Context
import android.view.View
import com.goat.webview.GoatAssetManager
import com.goat.webview.GoatBridgeActionHandler
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

    private val goatView = GoatView(context)
    private val channel = MethodChannel(messenger, "com.goat.webview/bridge_$id")
    private val job = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.IO + job)
    private var actionHandler = GoatBridgeActionHandler(context, autoRegisterPlugins = true, autoRegisterPayments = true)

    private fun jsonObjectToMap(jsonObj: JsonObject): Map<String, Any?> {
        val map = mutableMapOf<String, Any?>()
        for ((k, v) in jsonObj) {
            map[k] = when {
                v is kotlinx.serialization.json.JsonPrimitive -> {
                    if (v.isString) v.content
                    else v.booleanOrNull ?: v.longOrNull ?: v.doubleOrNull ?: v.content
                }
                v is JsonObject -> jsonObjectToMap(v)
                else -> v.toString()
            }
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
        val appId = (creationParams?.get("appId") as? String) ?: GoatAssetManager.DEFAULT_APP_ID
        actionHandler = GoatBridgeActionHandler(context, appId = appId, autoRegisterPlugins = true, autoRegisterPayments = true)
        val assetBundleName = (creationParams?.get("assetBundleName") as? String) ?: "miniapp.zip"
        val popupRoutingPolicyStr = creationParams?.get("popupRoutingPolicy") as? String
        goatView.defaultPopupRoutingPolicy = GoatPopupRoutingPolicy.fromString(popupRoutingPolicyStr)

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
            // Execute natively first
            val nativeResult = actionHandler.executeAction(action, payload)
            // Notify Flutter of the message AND result (for observation/logging)
            withContext(Dispatchers.Main) {
                nativeResult.fold(
                    onSuccess = { dataJson ->
                        channel.invokeMethod("onBridgeMessage", mapOf(
                            "action" to action,
                            "payload" to jsonObjectToMap(payload),
                            "result" to jsonObjectToMap(dataJson),
                            "success" to true
                        ))
                    },
                    onFailure = { err ->
                        channel.invokeMethod("onBridgeMessage", mapOf(
                            "action" to action,
                            "payload" to jsonObjectToMap(payload),
                            "result" to null,
                            "success" to false,
                            "error" to (err.message ?: "Native execution error")
                        ))
                    }
                )
            }
            // Return native result to JS bridge
            nativeResult
        }

        val assetManager = GoatAssetManager(context)
        scope.launch {
            try {
                val assetDir = assetManager.ensureAssetsReady(bundleAssetPath = assetBundleName, appId = appId)
                withContext(Dispatchers.Main) {
                    goatView.initialize(assetDir, appId = appId)
                }
            } catch (e: Exception) {
                // Asset loading error
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
                    val resultObj = actionHandler.executeAction(action, jsonPayload)
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
                GoatWarmupManager.prewarm(context)
                result.success(true)
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
            "pause" -> {
                goatView.onPause()
                result.success(true)
            }
            "resume" -> {
                goatView.onResume()
                result.success(true)
            }
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
