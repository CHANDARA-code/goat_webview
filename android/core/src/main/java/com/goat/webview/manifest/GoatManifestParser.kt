package com.goat.webview.manifest

import android.content.pm.ActivityInfo
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

class MalformedManifestException(message: String) : IllegalArgumentException(message)

enum class MiniAppOrientation(val manifestValue: String, val screenOrientation: Int) {
    PORTRAIT("portrait", ActivityInfo.SCREEN_ORIENTATION_PORTRAIT),
    LANDSCAPE("landscape", ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE),
    AUTO("auto", ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);

    companion object {
        fun fromManifestValue(value: String?): MiniAppOrientation =
            entries.firstOrNull { it.manifestValue.equals(value?.trim(), ignoreCase = true) } ?: AUTO
    }
}

data class MiniAppWindowConfig(
    val navigationBarTitleText: String = DEFAULT_TITLE,
    val navigationBarBackgroundColor: String = DEFAULT_BACKGROUND_COLOR,
    val navigationBarTextStyle: String = DEFAULT_TEXT_STYLE,
    val orientation: MiniAppOrientation = MiniAppOrientation.AUTO
) {
    val screenOrientation: Int get() = orientation.screenOrientation

    companion object {
        const val DEFAULT_TITLE = ""
        const val DEFAULT_BACKGROUND_COLOR = "#FFFFFF"
        const val DEFAULT_TEXT_STYLE = "black"
        val DEFAULT = MiniAppWindowConfig()
    }
}

data class MiniAppManifest(
    val appId: String,
    val version: String,
    val entrypoint: String = DEFAULT_ENTRYPOINT,
    val window: MiniAppWindowConfig = MiniAppWindowConfig.DEFAULT,
    val requiredScopes: List<String> = emptyList(),
    val allowedDomains: List<String> = emptyList()
) {
    companion object {
        const val DEFAULT_ENTRYPOINT = "index.html"

        fun defaultFor(appId: String, version: String = "0.0.0"): MiniAppManifest =
            MiniAppManifest(appId = appId, version = version)
    }
}

object GoatManifestParser {

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    private val HEX_COLOR = Regex("^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")

    fun parseManifest(jsonString: String): MiniAppManifest {
        val root = try {
            json.parseToJsonElement(jsonString).jsonObject
        } catch (e: Exception) {
            throw MalformedManifestException("manifest.json is not a valid JSON object: ${e.message}")
        }

        val appId = root.stringOrNull("appId")
            ?: throw MalformedManifestException("manifest.json is missing mandatory field 'appId'")
        val version = root.stringOrNull("version")
            ?: throw MalformedManifestException("manifest.json is missing mandatory field 'version'")

        val entrypoint = root.stringOrNull("entrypoint")
            ?: root.stringOrNull("entry")
            ?: MiniAppManifest.DEFAULT_ENTRYPOINT
        if (!isSafeEntrypoint(entrypoint)) {
            throw MalformedManifestException("manifest.json 'entrypoint' escapes the bundle root: $entrypoint")
        }

        return MiniAppManifest(
            appId = appId,
            version = version,
            entrypoint = entrypoint,
            window = parseWindow(root["window"] as? JsonObject),
            requiredScopes = parseStringArray(root["permissions"] as? JsonObject, "requiredScopes"),
            allowedDomains = parseStringArray(root["security"] as? JsonObject, "allowedDomains")
        )
    }

    fun parseManifestOrDefault(jsonString: String?, fallbackAppId: String): MiniAppManifest =
        try {
            if (jsonString.isNullOrBlank()) MiniAppManifest.defaultFor(fallbackAppId)
            else parseManifest(jsonString)
        } catch (_: Exception) {
            MiniAppManifest.defaultFor(fallbackAppId)
        }

    private fun parseWindow(window: JsonObject?): MiniAppWindowConfig {
        if (window == null) return MiniAppWindowConfig.DEFAULT
        val color = window.stringOrNull("navigationBarBackgroundColor")
        return MiniAppWindowConfig(
            navigationBarTitleText = window.stringOrNull("navigationBarTitleText")
                ?: MiniAppWindowConfig.DEFAULT_TITLE,
            navigationBarBackgroundColor = if (color != null && HEX_COLOR.matches(color)) color
                else MiniAppWindowConfig.DEFAULT_BACKGROUND_COLOR,
            navigationBarTextStyle = window.stringOrNull("navigationBarTextStyle")
                ?: MiniAppWindowConfig.DEFAULT_TEXT_STYLE,
            orientation = MiniAppOrientation.fromManifestValue(window.stringOrNull("orientation"))
        )
    }

    private fun parseStringArray(parent: JsonObject?, key: String): List<String> {
        val element = parent?.get(key) ?: return emptyList()
        return try {
            element.jsonArray.mapNotNull { it.jsonPrimitive.contentOrNull }
                .map { it.trim() }
                .filter { it.isNotEmpty() }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun isSafeEntrypoint(entrypoint: String): Boolean {
        if (entrypoint.isBlank()) return false
        if (entrypoint.startsWith("/") || entrypoint.contains("://")) return false
        return entrypoint.split('/').none { it == ".." }
    }

    private fun JsonObject.stringOrNull(key: String): String? {
        val primitive = this[key] as? JsonPrimitive ?: return null
        val content = primitive.contentOrNull?.trim()
        return if (content.isNullOrEmpty()) null else content
    }
}
