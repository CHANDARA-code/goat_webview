package com.goat.webview.popup

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Parsed window features configuration from JavaScript `window.open(url, target, features)` (Task 10183 / R3).
 */
@Serializable
data class GoatWindowFeatures(
    val width: Double? = null,
    val height: Double? = null,
    val x: Double? = null,
    val y: Double? = null,
    val menuBar: Boolean? = null,
    val statusBar: Boolean? = null,
    val toolbars: Boolean? = null,
    val resizable: Boolean? = null,
    val scrollbars: Boolean? = null,
    val isPopup: Boolean? = null,
    val rawFeatures: Map<String, String> = emptyMap()
) {
    // Property aliases for cross-platform and JS naming compatibility
    val left: Double? get() = x
    val top: Double? get() = y
    val menubar: Boolean? get() = menuBar
    val status: Boolean? get() = statusBar
    val toolbar: Boolean? get() = toolbars

    /**
     * Converts the features configuration into a structured [JsonObject] conforming to the `ON_POPUP_REQUEST` IPC schema.
     */
    fun toJsonObject(): JsonObject = buildJsonObject {
        width?.let { put("width", it) }
        height?.let { put("height", it) }
        x?.let { put("x", it) }
        y?.let { put("y", it) }
        menuBar?.let { put("menuBar", it) }
        statusBar?.let { put("statusBar", it) }
        toolbars?.let { put("toolbars", it) }
        resizable?.let { put("resizable", it) }
        scrollbars?.let { put("scrollbars", it) }
        isPopup?.let { put("isPopup", it) }
    }

    companion object {
        /**
         * Parses a comma-separated window features string passed to `window.open()`.
         * Handles boolean aliases (yes/no, 1/0, true/false, valueless keys) and dimension properties.
         *
         * @param featuresString The raw features string from JavaScript (e.g. "width=480,height=640,resizable=yes").
         * @return A parsed [GoatWindowFeatures] model with safe fallback defaults.
         */
        fun parse(featuresString: String?): GoatWindowFeatures {
            if (featuresString.isNullOrBlank()) return GoatWindowFeatures()

            val rawMap = mutableMapOf<String, String>()
            val tokens = featuresString.split(",")

            for (token in tokens) {
                val trimmed = token.trim()
                if (trimmed.isEmpty()) continue

                val parts = trimmed.split("=", limit = 2)
                val key = parts[0].trim().lowercase()
                val value = if (parts.size > 1) parts[1].trim().lowercase() else "yes"
                rawMap[key] = value
            }

            fun parseBoolean(vararg keys: String): Boolean? {
                for (k in keys) {
                    val v = rawMap[k] ?: continue
                    return when (v) {
                        "yes", "1", "true", "" -> true
                        "no", "0", "false" -> false
                        else -> null
                    }
                }
                return null
            }

            fun parseDouble(vararg keys: String): Double? {
                for (k in keys) {
                    val v = rawMap[k] ?: continue
                    val num = v.toDoubleOrNull()
                    if (num != null) return num
                }
                return null
            }

            val width = parseDouble("width", "innerwidth", "outerwidth")
            val height = parseDouble("height", "innerheight", "outerheight")
            val x = parseDouble("left", "screenx", "x")
            val y = parseDouble("top", "screeny", "y")

            val resizable = parseBoolean("resizable", "allowsresizing")
            val menuBar = parseBoolean("menubar", "menubarvisibility")
            val statusBar = parseBoolean("status", "statusbar", "statusbarvisibility")
            val toolbars = parseBoolean("toolbar", "toolbars", "toolbarsvisibility")
            val scrollbars = parseBoolean("scrollbars")
            val isPopup = parseBoolean("popup", "ispopup")

            return GoatWindowFeatures(
                width = width,
                height = height,
                x = x,
                y = y,
                menuBar = menuBar,
                statusBar = statusBar,
                toolbars = toolbars,
                resizable = resizable,
                scrollbars = scrollbars,
                isPopup = isPopup,
                rawFeatures = rawMap
            )
        }
    }
}
