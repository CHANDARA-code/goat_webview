package com.goat.webview

import kotlinx.serialization.json.JsonObject

/**
 * Extension SPI interface for modular Goat WebView feature plugins (Task 10134 / Task 10152).
 * Enables zero-bloat modular builds by allowing host applications to include only the native
 * dependencies they need (e.g. Media, Location, Scanner, Biometrics) without forcing
 * heavyweight ML Kit or Google Play Services libraries into every host build.
 */
interface GoatBridgePlugin {
    /** Unique identifier for the plugin (e.g. "media", "location", "scanner"). */
    val pluginId: String

    /** List of IPC action types handled by this plugin. */
    val supportedActions: List<String>

    /**
     * Executes the requested action payload.
     *
     * @param action Action identifier.
     * @param payload Request parameters from web client.
     * @return Result containing response JsonObject or failure exception.
     */
    suspend fun execute(action: String, payload: JsonObject): Result<JsonObject>

    /**
     * Determines whether this plugin can handle the specified action.
     */
    fun canHandle(action: String): Boolean = supportedActions.contains(action)
}
