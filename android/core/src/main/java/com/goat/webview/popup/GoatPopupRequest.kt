package com.goat.webview.popup

import com.goat.webview.view.GoatView
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Structured request model capturing intercepted popup window / target="_blank" navigations (Task 10183 / R1 / R2).
 */
@Serializable
data class GoatPopupRequest(
    val url: String,
    val target: String = "_blank",
    val policy: GoatPopupRoutingPolicy = GoatPopupRoutingPolicy.AUTO,
    val isUserGesture: Boolean = true,
    val isDialog: Boolean = false,
    val windowFeatures: GoatWindowFeatures = GoatWindowFeatures(),
    val parentAppId: String = ""
) {
    /**
     * Serializes this request data to a standard [JsonObject].
     */
    fun toJsonObject(): JsonObject = buildJsonObject {
        put("url", url)
        put("target", target)
        put("policy", policy.name)
        put("isUserGesture", isUserGesture)
        put("isDialog", isDialog)
        put("windowFeatures", windowFeatures.toJsonObject())
        if (parentAppId.isNotEmpty()) {
            put("parentAppId", parentAppId)
        }
    }

    /**
     * Serializes this request to the canonical `ON_POPUP_REQUEST` bridge event format.
     */
    fun toEventPayload(): JsonObject = buildJsonObject {
        put("event", "ON_POPUP_REQUEST")
        put("data", toJsonObject())
    }
}

/**
 * Typealias for event payloads in listener callbacks.
 */
typealias GoatPopupRequestEvent = GoatPopupRequest

/**
 * Host callback listener for observing, intercepting, or overriding popup routing decisions.
 */
interface GoatPopupListener {
    /**
     * Intercepts a popup request. Returning a non-null [GoatPopupRoutingPolicy] overrides default routing.
     */
    fun onPopupRequest(request: GoatPopupRequest): GoatPopupRoutingPolicy? = null

    /**
     * Dispatched when a same-origin modal [GoatView] is created and attached.
     */
    fun onModalWindowCreated(modalView: GoatView, request: GoatPopupRequest) {}

    /**
     * Dispatched when a modal [GoatView] is closed via `window.close()` or user gesture.
     */
    fun onModalWindowClosed(modalView: GoatView) {}
}
