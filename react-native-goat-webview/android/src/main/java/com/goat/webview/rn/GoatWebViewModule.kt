package com.goat.webview.rn

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.goat.webview.GoatAssetManager
import com.goat.webview.GoatBridgeActionHandler
import com.goat.webview.GoatWarmupManager
import com.goat.webview.headless.GoatHeadlessWebView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/**
 * TurboModule exposing JSI methods to React Native for high-performance engine lifecycle control.
 * Implements the full 8-method specification matching NativeGoatWebViewModule.ts.
 */
class GoatWebViewModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val moduleScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val assetManager = GoatAssetManager(reactContext)
    private val actionHandler = GoatBridgeActionHandler(reactContext, autoRegisterPlugins = true, autoRegisterPayments = true)

    override fun getName(): String {
        return "GoatWebViewModule"
    }

    private fun getActionHandler(appId: String?): GoatBridgeActionHandler {
        return if (!appId.isNullOrBlank() && appId != actionHandler.appId) {
            GoatBridgeActionHandler(reactContext, appId = appId, autoRegisterPlugins = true, autoRegisterPayments = true)
        } else {
            actionHandler
        }
    }

    @ReactMethod
    fun prewarm(appId: String?, promise: Promise) {
        reactContext.runOnUiQueueThread {
            try {
                GoatWarmupManager.prewarm(reactContext)
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("PREWARM_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun clearCache(appId: String?, promise: Promise) {
        try {
            val targetAppId = if (!appId.isNullOrBlank()) appId else GoatAssetManager.DEFAULT_APP_ID
            assetManager.clearCache(targetAppId)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CLEAR_CACHE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getBundleVersion(appId: String?, promise: Promise) {
        try {
            promise.resolve("1.0.0-goat")
        } catch (e: Exception) {
            promise.reject("VERSION_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun runHeadlessScript(script: String, appId: String?, promise: Promise) {
        val targetAppId = if (!appId.isNullOrBlank()) appId else GoatAssetManager.DEFAULT_APP_ID
        moduleScope.launch(Dispatchers.Main) {
            var headless: GoatHeadlessWebView? = null
            try {
                headless = GoatHeadlessWebView(reactContext, appId = targetAppId)
                val rawResult = headless.runScript(script) ?: ""
                val resultString = if (rawResult.startsWith("\"") && rawResult.endsWith("\"") && rawResult.length >= 2) {
                    rawResult.substring(1, rawResult.length - 1)
                } else {
                    rawResult
                }
                headless.dispose()
                promise.resolve(resultString)
            } catch (e: Exception) {
                try {
                    headless?.dispose()
                } catch (_: Exception) {}
                promise.reject("HEADLESS_SCRIPT_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun executeAction(action: String, payload: ReadableMap?, appId: String?, promise: Promise) {
        val jsonPayload = payload?.toJsonObject() ?: buildJsonObject {}
        val handler = getActionHandler(appId)
        moduleScope.launch(Dispatchers.IO) {
            try {
                val result = handler.executeAction(action, jsonPayload)
                result.fold(
                    onSuccess = { dataJson ->
                        val resultMap = dataJson.toWritableMap()
                        promise.resolve(resultMap)
                    },
                    onFailure = { err ->
                        promise.reject("EXECUTE_ACTION_ERROR", err.message, err)
                    }
                )
            } catch (e: Exception) {
                promise.reject("EXECUTE_ACTION_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun triggerHaptic(type: String?, style: String?, notificationType: String?, promise: Promise) {
        val payload = buildJsonObject {
            put("type", type ?: "impact")
            put("style", style ?: "medium")
            put("notificationType", notificationType ?: "success")
        }
        moduleScope.launch(Dispatchers.IO) {
            try {
                val result = actionHandler.executeAction("HAPTIC_FEEDBACK", payload)
                result.fold(
                    onSuccess = { dataJson ->
                        val resultMap = dataJson.toWritableMap()
                        promise.resolve(resultMap)
                    },
                    onFailure = { err ->
                        promise.reject("HAPTIC_ERROR", err.message, err)
                    }
                )
            } catch (e: Exception) {
                promise.reject("HAPTIC_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun setNavBarState(state: ReadableMap?, appId: String?, promise: Promise) {
        val jsonPayload = state?.toJsonObject() ?: buildJsonObject {}
        val handler = getActionHandler(appId)
        moduleScope.launch(Dispatchers.IO) {
            try {
                var handled = false
                if (jsonPayload.containsKey("backgroundColor") || jsonPayload.containsKey("textColor")) {
                    handler.executeAction("SET_NAV_BAR_COLOR", jsonPayload)
                    handled = true
                }
                if (jsonPayload.containsKey("title") || jsonPayload.containsKey("subtitle")) {
                    handler.executeAction("SET_NAV_BAR_TITLE", jsonPayload)
                    handled = true
                }
                if (jsonPayload.containsKey("progress") || jsonPayload.containsKey("visible")) {
                    handler.executeAction("SET_NAV_BAR_PROGRESS", jsonPayload)
                    handled = true
                }
                if (jsonPayload.containsKey("left") || jsonPayload.containsKey("right")) {
                    handler.executeAction("SET_NAV_BAR_BUTTONS", jsonPayload)
                    handled = true
                }
                if (!handled) {
                    handler.executeAction("SET_NAV_BAR_TITLE", jsonPayload)
                }
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("NAV_BAR_STATE_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun setBottomSheetState(state: ReadableMap?, appId: String?, promise: Promise) {
        val jsonPayload = state?.toJsonObject() ?: buildJsonObject {}
        val handler = getActionHandler(appId)
        moduleScope.launch(Dispatchers.IO) {
            try {
                if (jsonPayload.containsKey("snapPoints")) {
                    handler.executeAction("SET_SHEET_SNAP_POINTS", jsonPayload)
                } else if (jsonPayload.containsKey("expanded")) {
                    val expanded = jsonPayload["expanded"]?.jsonPrimitive?.booleanOrNull ?: true
                    val action = if (expanded) "EXPAND_BOTTOM_SHEET" else "COLLAPSE_BOTTOM_SHEET"
                    handler.executeAction(action, jsonPayload)
                } else if (jsonPayload["state"]?.jsonPrimitive?.content?.lowercase() == "collapsed") {
                    handler.executeAction("COLLAPSE_BOTTOM_SHEET", jsonPayload)
                } else {
                    handler.executeAction("EXPAND_BOTTOM_SHEET", jsonPayload)
                }
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("BOTTOM_SHEET_STATE_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun notifyAppServiceReady(appId: String?, details: ReadableMap?, promise: Promise) {
        val targetAppId = if (!appId.isNullOrBlank()) appId else GoatAssetManager.DEFAULT_APP_ID
        val jsonPayload = buildJsonObject {
            put("appId", targetAppId)
            if (details != null) {
                put("details", details.toJsonObject())
            }
        }
        val handler = getActionHandler(targetAppId)
        moduleScope.launch(Dispatchers.IO) {
            try {
                val result = handler.executeAction("ON_APP_SERVICE_READY", jsonPayload)
                result.fold(
                    onSuccess = { promise.resolve(true) },
                    onFailure = { err -> promise.reject("APP_SERVICE_READY_ERROR", err.message, err) }
                )
            } catch (e: Exception) {
                promise.reject("APP_SERVICE_READY_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun notifyAppServiceCrash(appId: String?, error: String?, promise: Promise) {
        val targetAppId = if (!appId.isNullOrBlank()) appId else GoatAssetManager.DEFAULT_APP_ID
        val jsonPayload = buildJsonObject {
            put("appId", targetAppId)
            put("error", error ?: "Unknown error")
        }
        val handler = getActionHandler(targetAppId)
        moduleScope.launch(Dispatchers.IO) {
            try {
                val result = handler.executeAction("ON_APP_SERVICE_CRASH", jsonPayload)
                result.fold(
                    onSuccess = { promise.resolve(true) },
                    onFailure = { err -> promise.reject("APP_SERVICE_CRASH_ERROR", err.message, err) }
                )
            } catch (e: Exception) {
                promise.reject("APP_SERVICE_CRASH_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun notifyAppServiceTerminate(appId: String?, promise: Promise) {
        val targetAppId = if (!appId.isNullOrBlank()) appId else GoatAssetManager.DEFAULT_APP_ID
        val jsonPayload = buildJsonObject {
            put("appId", targetAppId)
        }
        val handler = getActionHandler(targetAppId)
        moduleScope.launch(Dispatchers.IO) {
            try {
                val result = handler.executeAction("ON_APP_SERVICE_TERMINATE", jsonPayload)
                result.fold(
                    onSuccess = { promise.resolve(true) },
                    onFailure = { err -> promise.reject("APP_SERVICE_TERMINATE_ERROR", err.message, err) }
                )
            } catch (e: Exception) {
                promise.reject("APP_SERVICE_TERMINATE_ERROR", e.message, e)
            }
        }
    }

}

internal fun ReadableMap.toJsonObject(): JsonObject {
    val iterator = this.keySetIterator()
    val map = mutableMapOf<String, JsonElement>()
    while (iterator.hasNextKey()) {
        val key = iterator.nextKey()
        when (this.getType(key)) {
            ReadableType.Null -> map[key] = JsonNull
            ReadableType.Boolean -> map[key] = JsonPrimitive(this.getBoolean(key))
            ReadableType.Number -> {
                val doubleVal = this.getDouble(key)
                if (doubleVal % 1.0 == 0.0 && doubleVal >= Long.MIN_VALUE && doubleVal <= Long.MAX_VALUE) {
                    map[key] = JsonPrimitive(doubleVal.toLong())
                } else {
                    map[key] = JsonPrimitive(doubleVal)
                }
            }
            ReadableType.String -> {
                val strVal = this.getString(key)
                map[key] = if (strVal != null) JsonPrimitive(strVal) else JsonNull
            }
            ReadableType.Map -> map[key] = this.getMap(key)?.toJsonObject() ?: JsonNull
            ReadableType.Array -> map[key] = this.getArray(key)?.toJsonArray() ?: JsonNull
        }
    }
    return JsonObject(map)
}

internal fun ReadableArray.toJsonArray(): JsonArray {
    val list = mutableListOf<JsonElement>()
    for (i in 0 until this.size()) {
        when (this.getType(i)) {
            ReadableType.Null -> list.add(JsonNull)
            ReadableType.Boolean -> list.add(JsonPrimitive(this.getBoolean(i)))
            ReadableType.Number -> {
                val doubleVal = this.getDouble(i)
                if (doubleVal % 1.0 == 0.0 && doubleVal >= Long.MIN_VALUE && doubleVal <= Long.MAX_VALUE) {
                    list.add(JsonPrimitive(doubleVal.toLong()))
                } else {
                    list.add(JsonPrimitive(doubleVal))
                }
            }
            ReadableType.String -> {
                val strVal = this.getString(i)
                list.add(if (strVal != null) JsonPrimitive(strVal) else JsonNull)
            }
            ReadableType.Map -> list.add(this.getMap(i)?.toJsonObject() ?: JsonNull)
            ReadableType.Array -> list.add(this.getArray(i)?.toJsonArray() ?: JsonNull)
        }
    }
    return JsonArray(list)
}

internal fun JsonObject.toWritableMap(): WritableMap {
    val map = Arguments.createMap()
    for ((key, value) in this) {
        when (value) {
            is JsonNull -> map.putNull(key)
            is JsonPrimitive -> {
                if (value.isString) {
                    map.putString(key, value.content)
                } else {
                    val bool = value.booleanOrNull
                    if (bool != null) {
                        map.putBoolean(key, bool)
                    } else {
                        val intVal = value.intOrNull
                        val doubleVal = value.doubleOrNull
                        if (intVal != null && (doubleVal == null || doubleVal == intVal.toDouble())) {
                            map.putInt(key, intVal)
                        } else if (doubleVal != null) {
                            map.putDouble(key, doubleVal)
                        } else {
                            map.putString(key, value.content)
                        }
                    }
                }
            }
            is JsonObject -> map.putMap(key, value.toWritableMap())
            is JsonArray -> map.putArray(key, value.toWritableArray())
        }
    }
    return map
}

internal fun JsonArray.toWritableArray(): WritableArray {
    val array = Arguments.createArray()
    for (value in this) {
        when (value) {
            is JsonNull -> array.pushNull()
            is JsonPrimitive -> {
                if (value.isString) {
                    array.pushString(value.content)
                } else {
                    val bool = value.booleanOrNull
                    if (bool != null) {
                        array.pushBoolean(bool)
                    } else {
                        val intVal = value.intOrNull
                        val doubleVal = value.doubleOrNull
                        if (intVal != null && (doubleVal == null || doubleVal == intVal.toDouble())) {
                            array.pushInt(intVal)
                        } else if (doubleVal != null) {
                            array.pushDouble(doubleVal)
                        } else {
                            array.pushString(value.content)
                        }
                    }
                }
            }
            is JsonObject -> array.pushMap(value.toWritableMap())
            is JsonArray -> array.pushArray(value.toWritableArray())
        }
    }
    return array
}
