package com.goat.webview

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import java.util.concurrent.ConcurrentHashMap

/**
 * Metadata record for a registered bridge API.
 */
@Serializable
data class ApiCapability(
    val actionName: String,
    val category: String,
    val isSupported: Boolean,
    val minSdkVersion: Int = 21,
    val isDeprecated: Boolean = false
)

/**
 * SuperApp Extended Standard JS API Registry & Master Dispatcher.
 *
 * Implements capability negotiation (`canIUse`), dynamic action registration,
 * and API version management across all unified native SuperApp bridge actions.
 */
class GoatApiRegistry {

    private val capabilities = ConcurrentHashMap<String, ApiCapability>()

    init {
        registerDefaultCapabilities()
    }

    private fun registerDefaultCapabilities() {
        for (action in GoatBridgeActionHandler.SUPPORTED_ACTIONS) {
            val category = resolveCategory(action)
            capabilities[action] = ApiCapability(
                actionName = action,
                category = category,
                isSupported = true
            )
        }
    }

    /**
     * Checks if a given bridge action is supported by the runtime engine.
     */
    fun canIUse(actionName: String): Boolean {
        return capabilities[actionName]?.isSupported == true
    }

    /**
     * Retrieves all supported capabilities optionally filtered by category.
     */
    suspend fun getCapabilities(category: String? = null): List<ApiCapability> = withContext(Dispatchers.IO) {
        val all = capabilities.values.toList()
        if (category.isNullOrBlank()) {
            all
        } else {
            all.filter { it.category.equals(category, ignoreCase = true) }
        }
    }

    /**
     * Dynamically registers or overrides an API capability.
     */
    fun registerCapability(capability: ApiCapability) {
        capabilities[capability.actionName] = capability
    }

    companion object {
        fun resolveCategory(action: String): String {
            return when {
                action.startsWith("STORAGE_") || action.startsWith("SECURE_STORAGE_") -> "STORAGE"
                action.startsWith("FS_") -> "FILESYSTEM"
                action.startsWith("BLE_") || action.startsWith("NFC_") ||
                        action.contains("_BLE_") || action.contains("_NFC_") -> "HARDWARE"
                action.startsWith("START_ACCELEROMETER") || action.startsWith("STOP_ACCELEROMETER") ||
                        action.startsWith("START_GYROSCOPE") || action.startsWith("STOP_GYROSCOPE") ||
                        action.startsWith("START_COMPASS") || action.startsWith("STOP_COMPASS") ||
                        action.startsWith("START_DEVICE_MOTION") ||
                        action.startsWith("STOP_DEVICE_MOTION") || action.startsWith("GET_LATEST_") -> "HARDWARE"
                action.startsWith("MAKE_PHONE_CALL") || action.startsWith("SEND_SMS") -> "TELEPHONY"
                action.startsWith("CHOOSE_CONTACT") || action.startsWith("PICK_CONTACTS") ||
                        action.startsWith("GET_CONTACTS_") -> "HARDWARE"
                action.contains("LOCATION") || action.contains("GEOFENCE") -> "LOCATION"
                action.startsWith("NAV_") || action.startsWith("NAVIGATE_") || action.startsWith("CAN_GO_BACK") ||
                        action.startsWith("HANDLE_BACK_PRESS") || action.startsWith("PUSH_HISTORY_STATE") ||
                        action.startsWith("PREDICTIVE_BACK_") || action.startsWith("GET_PAGE_STACK") ||
                        action.startsWith("GET_CURRENT_ROUTE") -> "NAVIGATION"
                action.startsWith("SHOW_") || action.startsWith("HIDE_") || action.contains("KEYBOARD") -> "UI"
                action.contains("RENDER") || action.contains("TRANSPARENCY") || action.contains("THEME") ||
                        action.contains("NATIVE_VIEW") || action.contains("GESTURE") -> "RENDERING"
                action.startsWith("BIOMETRIC_") || action.startsWith("CHECK_PERMISSION") ||
                        action.startsWith("REQUEST_PERMISSION") || action.startsWith("GET_SETTING") ||
                        action.startsWith("OPEN_SETTING") || action.startsWith("AUTHORIZE") ||
                        action.startsWith("VERIFY_SSL_") || action.startsWith("AUDIT_") -> "SECURITY"
                action.startsWith("SCAN_") || action.startsWith("CHOOSE_MEDIA") || action.startsWith("PREVIEW_IMAGE") ||
                        action.startsWith("AUDIO_") || action.startsWith("CHOOSE_FILES") || action.startsWith("CANCEL_FILE_CHOOSER") -> "MEDIA"
                action.startsWith("API_REQUEST") || action.startsWith("DOWNLOAD_") || action.startsWith("UPLOAD_") ||
                        action.startsWith("GET_NETWORK_") || action.startsWith("IS_CONNECTED") || action.startsWith("WEBSOCKET_") -> "NETWORK"
                action.startsWith("REPORT_METRICS") || action.startsWith("GET_APM_") || action.startsWith("SEND_APM_") ||
                        action.startsWith("RECORD_") || action.startsWith("START_TRACE") || action.startsWith("STOP_TRACE") ||
                        action.startsWith("GET_TRACES") || action.startsWith("GET_MEMORY_METRICS") ||
                        action.startsWith("GET_STARTUP_BENCHMARK") || action.startsWith("RECORD_STARTUP_BENCHMARK") ||
                        action.startsWith("PRECOMPILE_BYTECODE") || action.startsWith("IS_BYTECODE_WARM") ||
                        action.startsWith("CLEAR_BYTECODE_CACHE") || action.startsWith("GET_BYTECODE_STATS") -> "PERFORMANCE"
                action.startsWith("LOAD_SUBPACKAGE") || action.startsWith("IS_SUBPACKAGE_CACHED") ||
                        action.startsWith("CLEAR_SUBPACKAGE_CACHE") || action.startsWith("GET_SUBPACKAGES") ||
                        action.startsWith("VALIDATE_WASM_SUPPORT") || action.startsWith("CAN_I_USE") ||
                        action.startsWith("GET_API_CAPABILITIES") || action.startsWith("REGISTER_CAPABILITY") ||
                        action.startsWith("GET_SANDBOX_PROCESS_STATUS") -> "CORE"
                action.startsWith("OPEN_INVOICE") || action.startsWith("GET_PURCHASE_PRODUCTS") ||
                        action.startsWith("RESTORE_PURCHASES") -> "PAYMENTS"
                action.startsWith("WEB3_") -> "WEB3"
                action.startsWith("PUSH_") || action.startsWith("GET_PUSH_") || action.startsWith("SUBSCRIBE_PUSH_") ||
                        action.startsWith("UNSUBSCRIBE_PUSH_") || action.startsWith("GET_PENDING_NOTIFICATIONS") ||
                        action.startsWith("CLEAR_NOTIFICATIONS") -> "PUSH"
                action.startsWith("SHARE_") -> "SOCIAL"
                action.contains("BINARY_PORT") || action.contains("BINARY_MESSAGE") -> "IPC"
                else -> "DEVICE"
            }
        }
    }
}
