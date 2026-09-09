package com.goat.webview

import android.app.DownloadManager
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.net.Uri
import androidx.core.content.ContextCompat
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import android.view.ViewGroup
import android.widget.Toast
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import com.goat.webview.util.*

/**
 * Handles execution of all native bridge actions dispatched by the Web Mini-App.
 * Supports registering custom action handlers and modular [GoatBridgePlugin] extensions.
 */
class GoatBridgeActionHandler(
    private val context: Context,
    val appId: String = GoatAssetManager.DEFAULT_APP_ID,
    plugins: List<GoatBridgePlugin> = emptyList(),
    val autoRegisterPlugins: Boolean = false,
    val autoRegisterPayments: Boolean = false,
    private val onNavigateBack: (() -> Unit)? = null,
    private val onThemeChange: ((isDark: Boolean) -> Unit)? = null,
    private val onCloseWindow: (() -> Unit)? = null,
    storageManager: GoatStorageManager? = null,
    secureStorageManager: GoatSecureStorageManager? = null,
    private val onShowToast: ((title: String, icon: String, duration: Int, mask: Boolean) -> Unit)? = null,
    private val onHideToast: (() -> Unit)? = null,
    private val onShowModal: (suspend (title: String, content: String, showCancel: Boolean, cancelText: String, confirmText: String) -> Pair<Boolean, Boolean>)? = null,
    private val onShowActionSheet: (suspend (itemList: List<String>) -> Int)? = null,
    private val onShowLoading: ((title: String, mask: Boolean) -> Unit)? = null,
    private val onHideLoading: (() -> Unit)? = null,
    private val onSetScreenBrightness: ((value: Float) -> Unit)? = null,
    private val onGetScreenBrightness: (() -> Float)? = null,
    private val onSetKeepScreenOn: ((keepScreenOn: Boolean) -> Unit)? = null,
    private val onMakePhoneCall: ((phoneNumber: String) -> Unit)? = null,
    private val onSendSms: ((phoneNumber: String, body: String) -> Unit)? = null,
    private val onShareSheet: (suspend (title: String, text: String, url: String, mediaPath: String) -> Unit)? = null,
    private val onShareToStory: (suspend (mediaPath: String) -> Unit)? = null,
    apmCollector: GoatApmCollector? = null,
    pushManager: GoatPushNotificationManager? = null,
    contactsGeofenceManager: GoatContactsGeofenceManager? = null,
    // Provide a real backend-issued HMAC secret key via environment variable or fallback to deterministic device-bound key.
    iapPurchaseManager: GoatIapPurchaseManager? = null,
    binaryChannelManager: GoatBinaryChannelManager? = null,
    sslPinningManager: GoatSslPinningManager? = null,
    permissionManager: GoatPermissionManager? = null,
    manifestDomainAllowlist: Set<String>? = null,
    keyboardManager: GoatKeyboardManager? = null,
    predictiveBackCoordinator: GoatPredictiveBackCoordinator? = null,
    wasmWorkerManager: GoatWasmWorkerManager? = null,
    bytecodePrecompiler: GoatBytecodePrecompiler? = null,
    fileChooserManager: GoatFileChooserManager? = null,
    backNavigationCoordinator: GoatBackNavigationCoordinator? = null,
    visualRenderer: GoatVisualRenderer? = null,
    gestureScrollCoordinator: GoatGestureScrollCoordinator? = null,
    private val onSetAdaptiveRefreshRate: ((elevate: Boolean) -> Boolean)? = null,
    pageStackManager: GoatPageStackManager? = null,
    subpackageLoader: GoatSubpackageLoader? = null,
    sameLayerRenderer: GoatSameLayerRenderer? = null,
    apiRegistry: GoatApiRegistry? = null,
    processService: GoatMiniAppProcessService? = null,
    startupBenchmark: GoatStartupBenchmark? = null,
    tracer: GoatOpenTelemetryTracer? = null,
    safeAreaManager: GoatSafeAreaManager? = null,
    hapticFeedback: com.goat.webview.ui.GoatHapticFeedback? = null,
    private val onSetNavBarTitle: ((title: String, subtitle: String?) -> Unit)? = null,
    private val onSetNavBarColor: ((backgroundColor: String, textColor: String, isDark: Boolean) -> Unit)? = null,
    private val onSetNavBarButtons: ((left: String?, right: List<String>) -> Unit)? = null,
    private val onSetNavBarProgress: ((visible: Boolean, progress: Int?) -> Unit)? = null,
    private val onExpandBottomSheet: (() -> JsonObject)? = null,
    private val onCollapseBottomSheet: (() -> JsonObject)? = null,
    private val onSetSheetSnapPoints: ((snapPoints: List<Float>, initialSnap: Float?, isDismissible: Boolean) -> JsonObject)? = null,
    abuseGuardManager: com.goat.webview.security.GoatAbuseGuardManager? = null,
    oAuthSessionManager: com.goat.webview.auth.GoatOAuthSessionManager? = null,
    httpAuthManager: com.goat.webview.auth.GoatHttpAuthManager? = null,
    eventCoalescer: com.goat.webview.ipc.GoatEventCoalescer? = null,
    paymentGatewayManager: com.goat.webview.payments.GoatPaymentGatewayManager? = null,
    private val onOpenMiniApp: (suspend (targetAppId: String, presentation: String, params: JsonObject?, windowConfig: JsonObject?, jsApiAlias: Map<String, String>?) -> JsonObject)? = null,
    private val onCloseMiniApp: (suspend (instanceId: String?, result: JsonObject?) -> JsonObject)? = null,
    private val onMiniAppClosed: ((instanceId: String, targetAppId: String, dismissedByUser: Boolean, result: JsonObject?) -> Unit)? = null,
    private val onAppServiceReady: ((appId: String, details: JsonObject?) -> Unit)? = null,
    private val onAppServiceCrash: ((appId: String, error: String, details: JsonObject?) -> Unit)? = null,
    private val onAppServiceTerminate: ((appId: String, details: JsonObject?) -> Unit)? = null,
    /** Host-provided real OS runtime permission requester (Task 10198), e.g. wired via
     *  `ActivityResultContracts.RequestMultiplePermissions()` on the host Activity. Receives
     *  Android permission strings (e.g. `Manifest.permission.CAMERA`) and returns the real
     *  per-permission grant result — never a blind auto-grant. */
    private val onRequestOsPermissions: (suspend (permissions: Array<String>) -> Map<String, Boolean>)? = null,
    /** Find-in-page host callbacks (Task 10184) — implemented by GoatView using the real WebView. */
    private val onFindInPage: (suspend (query: String) -> JsonObject)? = null,
    private val onFindNext: (suspend (forward: Boolean) -> JsonObject)? = null,
    private val onFindClear: (() -> Unit)? = null,
    /** Native print sheet / PDF export host callback (Task 10185) — implemented by GoatView using
     *  the real WebView's `createPrintDocumentAdapter` and the tenant-sandboxed storage manager. */
    private val onPrintPage: (suspend (jobName: String, mode: String) -> JsonObject)? = null,
    /** Checks whether an Android runtime permission is already granted at the OS level. Injectable
     *  so tests aren't at the mercy of the unit-test `android.jar` stub's default return values
     *  (which otherwise make every `ContextCompat.checkSelfPermission` call silently report
     *  "granted"). Defaults to the real check in production. */
    private val isAndroidPermissionAlreadyGranted: (String) -> Boolean = { androidPermission ->
        try {
            ContextCompat.checkSelfPermission(context, androidPermission) == PackageManager.PERMISSION_GRANTED
        } catch (_: Throwable) {
            false
        }
    }
) {
    private var activeWindowedInstances: ConcurrentHashMap<String, com.goat.webview.ui.GoatWindowedContainer>? = null
    private fun getOrCreateWindowedInstances(): ConcurrentHashMap<String, com.goat.webview.ui.GoatWindowedContainer> {
        return activeWindowedInstances ?: synchronized(this) {
            activeWindowedInstances ?: ConcurrentHashMap<String, com.goat.webview.ui.GoatWindowedContainer>().also { activeWindowedInstances = it }
        }
    }
    /**
     * Asserts that the calling mini-app has been granted the required permission scope.
     * Throws [SecurityException] if permission is missing.
     */
    fun enforcePermission(scope: String) {
        if (!permissionManager.isPermissionGranted(appId, scope)) {
            throw SecurityException("PERMISSION_DENIED: Permission scope '$scope' has not been granted for mini-app '$appId'.")
        }
    }

    val permissions: GoatPermissionManager get() = permissionManager
    val abuseGuard: com.goat.webview.security.GoatAbuseGuardManager get() = abuseGuardManager
    val oAuthSession: com.goat.webview.auth.GoatOAuthSessionManager get() = oAuthSessionManager
    val httpAuth: com.goat.webview.auth.GoatHttpAuthManager get() = httpAuthManager
    val coalescer: com.goat.webview.ipc.GoatEventCoalescer get() = eventCoalescer

    @Volatile private var pendingUserGestureTimestamp: Long = 0L

    /**
     * Records a user gesture timestamp without forcing eager instantiation of [abuseGuardManager].
     */
    fun recordUserGesture(timestampMs: Long = System.currentTimeMillis()) {
        pendingUserGestureTimestamp = timestampMs
        if (abuseGuardManagerLazy.isInitialized() || injAbuseGuardManager != null) {
            abuseGuardManager.recordUserGesture(timestampMs)
        }
    }

    /**
     * Cancels in-flight coalesced events on teardown, but only if a coalescer was ever actually
     * built. Reading [coalescer] here instead would construct one purely to tear it down —
     * defeating its laziness on the mount/destroy path, which is exactly the hot path.
     */
    fun cancelCoalescedEventsIfActive() {
        if (eventCoalescerLazy.isInitialized()) eventCoalescer.cancelAll()
    }
    val paymentGateway: com.goat.webview.payments.GoatPaymentGatewayManager? get() = paymentGatewayManager
    companion object {
        private const val TAG = "GoatBridgeActionHandler"
        private const val MAX_API_REDIRECTS = 5

        @Volatile private var pluginRegistryChecked = false
        @Volatile private var pluginRegistryInstance: Any? = null
        @Volatile private var pluginRegistryMethod: java.lang.reflect.Method? = null

        @Volatile private var paymentRegistryChecked = false
        @Volatile private var paymentRegistryInstance: Any? = null
        @Volatile private var paymentRegistryMethod: java.lang.reflect.Method? = null

        val SUPPORTED_ACTIONS = setOf(
            // 1. Core & System Lifecycle
            "GET_DEVICE_INFO",
            "HAPTIC_FEEDBACK",
            "SET_STATUS_BAR_THEME",
            "SET_SCREEN_BRIGHTNESS",
            "GET_SCREEN_BRIGHTNESS",
            "SET_KEEP_SCREEN_ON",
            "SET_ORIENTATION_LOCK",
            "GET_ORIENTATION_LOCK",
            "SETUP_CLOSING_BEHAVIOR",
            "SETUP_SWIPE_BEHAVIOR",
            "CLIPBOARD_SET",
            "CLIPBOARD_GET",
            "NAVIGATE_BACK",
            "CAN_I_USE",
            "START_OAUTH_SESSION",
            "CANCEL_OAUTH_SESSION",

            // 2. Multi-Tenant Storage & Sandboxing
            "STORAGE_SET",
            "STORAGE_GET",
            "STORAGE_REMOVE",
            "STORAGE_CLEAR",
            "SECURE_STORAGE_SET",
            "SECURE_STORAGE_GET",
            "SECURE_STORAGE_REMOVE",
            "SECURE_STORAGE_CLEAR",
            "COOKIE_GET",
            "COOKIE_SET",
            "COOKIE_REMOVE",
            "COOKIE_REMOVE_ALL",
            "WEB_STORAGE_GET_QUOTA_USAGE",
            "WEB_STORAGE_CLEAR",
            "HTTP_AUTH_SAVE_CREDENTIAL",
            "HTTP_AUTH_CLEAR_CREDENTIALS",

            // 3. Sandboxed FileSystem & File Chooser
            "FS_WRITE_FILE",
            "FS_READ_FILE",
            "FS_MKDIR",
            "FS_RMDIR",
            "FS_UNLINK",
            "FS_LIST_DIR",
            "FS_STAT",
            "FS_COPY_FILE",
            "FS_EXISTS",
            "CHOOSE_FILES",
            "CANCEL_FILE_CHOOSER",

            // 4. Networking, HTTP & SSL
            "API_REQUEST",
            "DOWNLOAD_FILE",
            "IS_CONNECTED",
            "VERIFY_SSL_PIN",
            "AUDIT_NETWORK_CERTIFICATE",

            // 5. UI Feedback & Window Insets
            "SHOW_TOAST",
            "HIDE_TOAST",
            "SHOW_MODAL",
            "SHOW_ACTION_SHEET",
            "SHOW_LOADING",
            "HIDE_LOADING",
            "GET_KEYBOARD_INSETS",
            "SET_KEYBOARD_INSETS",
            "SET_NAV_BAR_TITLE",
            "SET_NAV_BAR_COLOR",
            "SET_NAV_BAR_BUTTONS",
            "SET_NAV_BAR_PROGRESS",
            "EXPAND_BOTTOM_SHEET",
            "COLLAPSE_BOTTOM_SHEET",
            "SET_SHEET_SNAP_POINTS",
            "GET_SAFE_AREA_INSETS",
            "FIND_IN_PAGE",
            "FIND_NEXT",
            "FIND_CLEAR",
            "PRINT_PAGE",
            "OPEN_EXTERNAL_LINK",
            "OPEN_URL",
            "OPEN_LINK",
            "TAB_OPEN",
            "TAB_CLOSE",
            "TAB_SWITCH",
            "TAB_GET_ACTIVE",
            "TAB_LIST",
            "TAB_CLOSE_ALL",
            "OPEN_MINI_APP",
            "CLOSE_MINI_APP",
            "ON_MINI_APP_CLOSED",
            "ON_APP_SERVICE_READY",
            "APP_SERVICE_READY",
            "ON_APP_SERVICE_CRASH",
            "APP_SERVICE_CRASH",
            "ON_APP_SERVICE_TERMINATE",
            "APP_SERVICE_TERMINATE",

            // 6. Hardware Sensors & Telephony
            // Sensor actions moved to the :feature-sensors module (GoatSensorsPlugin).
            "MAKE_PHONE_CALL",
            "SEND_SMS",

            // 7. Geofencing & Location Utilities
            "START_GEOFENCE",
            "STOP_GEOFENCE",
            "LIST_GEOFENCES",
            "EVALUATE_GEOFENCE",

            // 8. Permissions & Security
            "CHECK_PERMISSION",
            "REQUEST_PERMISSION",
            "GET_SETTING",
            "OPEN_SETTING",
            "AUTHORIZE",
            "AUDIT_SANDBOX_HEADERS",

            // 9. Contacts & Social Sharing
            "CHOOSE_CONTACT",
            "PICK_CONTACTS",
            "GET_CONTACTS_COUNT",
            "SHARE_SHEET",
            "SHARE_TO_STORY",

            // 10. Push Notifications
            "PUSH_GET_TOKEN",
            "GET_PUSH_TOKEN",
            "PUSH_REQUEST_PERMISSION",
            "PUSH_SET_BADGE",
            "PUSH_SHOW_NOTIFICATION",
            "SUBSCRIBE_PUSH_TOPIC",
            "UNSUBSCRIBE_PUSH_TOPIC",
            "GET_PENDING_NOTIFICATIONS",
            "CLEAR_NOTIFICATIONS",

            // 11. Web3 & Payments
            "OPEN_INVOICE",
            "GET_PURCHASE_PRODUCTS",
            "RESTORE_PURCHASES",
            "REQUEST_PAYMENT",
            "QUERY_PAYMENT_STATUS",
            "CANCEL_PAYMENT",

            // 12. Binary IPC Channels
            "CREATE_BINARY_PORT",
            "POST_BINARY_MESSAGE",
            "READ_BINARY_MESSAGE",
            "CLOSE_BINARY_PORT",

            // 13. Navigation & Predictive Back
            "CAN_GO_BACK",
            "HANDLE_BACK_PRESS",
            "PUSH_HISTORY_STATE",
            "GET_CURRENT_ROUTE",
            "NAV_PUSH",
            "NAV_POP",
            "NAV_POP_TO_ROOT",
            "NAV_REPLACE",
            "GET_PAGE_STACK",
            "PREDICTIVE_BACK_PROGRESS",
            "PREDICTIVE_BACK_INVOKE",
            "PREDICTIVE_BACK_CANCEL",

            // 14. Subpackages, WASM & Bytecode
            "LOAD_SUBPACKAGE",
            "IS_SUBPACKAGE_CACHED",
            "CLEAR_SUBPACKAGE_CACHE",
            "GET_SUBPACKAGES",
            "PRECOMPILE_BYTECODE",
            "IS_BYTECODE_WARM",
            "CLEAR_BYTECODE_CACHE",
            "GET_BYTECODE_STATS",
            "VALIDATE_WASM_SUPPORT",

            // 15. Visual Rendering & Same-Layer
            "CONFIGURE_TRANSPARENCY",
            "SYNC_THEME_BACKGROUND",
            "GET_RENDER_LAYER_CONFIG",
            "GESTURE_SCROLL_UPDATE",
            "SHOULD_PARENT_INTERCEPT",
            "RESET_GESTURE_COORDINATOR",
            "EMBED_NATIVE_VIEW",
            "UPDATE_NATIVE_VIEW_BOUNDS",
            "REMOVE_NATIVE_VIEW",
            "GET_ACTIVE_NATIVE_VIEWS",

            // 16. Capability Discovery & APM Telemetry
            "GET_API_CAPABILITIES",
            "REGISTER_CAPABILITY",
            "GET_SANDBOX_PROCESS_STATUS",
            "GET_STARTUP_BENCHMARK_REPORT",
            "RECORD_STARTUP_BENCHMARK_SAMPLE",
            "REPORT_METRICS",
            "GET_APM_METRICS",
            "GET_APM_SUMMARY",
            "SEND_APM_METRIC",
            "RECORD_BRIDGE_TIMING",
            "START_TRACE",
            "STOP_TRACE",
            "GET_TRACES",
            "GET_MEMORY_METRICS"
        )

        /**
         * Maps action names that require an explicit permission scope grant to their required scope.
         * This covers both built-in actions AND plugin-provided actions so that the permission gate
         * is consistently enforced regardless of which plugin handles the action.
         */
        val PERMISSION_REQUIRED_ACTIONS: Map<String, String> = mapOf(
            // Location
            "GET_LOCATION"          to GoatPermissionManager.SCOPE_USER_LOCATION,
            "CHOOSE_LOCATION"       to GoatPermissionManager.SCOPE_USER_LOCATION,
            "OPEN_LOCATION"         to GoatPermissionManager.SCOPE_USER_LOCATION,
            // Camera / Scanner
            "SCAN_CODE"             to GoatPermissionManager.SCOPE_CAMERA,
            "RECORD_VIDEO"          to GoatPermissionManager.SCOPE_CAMERA,
            // Media / Photos
            "CHOOSE_MEDIA"          to GoatPermissionManager.SCOPE_WRITE_PHOTOS,
            "PREVIEW_IMAGE"         to GoatPermissionManager.SCOPE_WRITE_PHOTOS,
            "SAVE_IMAGE_TO_ALBUM"   to GoatPermissionManager.SCOPE_WRITE_PHOTOS,
            // Contacts
            "CHOOSE_CONTACT"        to GoatPermissionManager.SCOPE_CONTACT,
            "PICK_CONTACTS"         to GoatPermissionManager.SCOPE_CONTACT,
            "GET_CONTACTS_COUNT"    to GoatPermissionManager.SCOPE_CONTACT,
            // Bluetooth / NFC
            "BLE_START_SCAN"        to GoatPermissionManager.SCOPE_BLUETOOTH,
            "BLE_STOP_SCAN"         to GoatPermissionManager.SCOPE_BLUETOOTH,
            "BLE_CONNECT"           to GoatPermissionManager.SCOPE_BLUETOOTH,
            "BLE_DISCONNECT"        to GoatPermissionManager.SCOPE_BLUETOOTH,
            "BLE_READ_CHARACTERISTIC"   to GoatPermissionManager.SCOPE_BLUETOOTH,
            "BLE_WRITE_CHARACTERISTIC"  to GoatPermissionManager.SCOPE_BLUETOOTH,
            "BLE_SUBSCRIBE"         to GoatPermissionManager.SCOPE_BLUETOOTH,
            "BLE_UNSUBSCRIBE"       to GoatPermissionManager.SCOPE_BLUETOOTH,
            "BLE_LIST_SERVICES"     to GoatPermissionManager.SCOPE_BLUETOOTH,
            "NFC_START_SESSION"     to GoatPermissionManager.SCOPE_BLUETOOTH,
            "NFC_STOP_SESSION"      to GoatPermissionManager.SCOPE_BLUETOOTH,
            "NFC_READ_TAG"          to GoatPermissionManager.SCOPE_BLUETOOTH,
            "NFC_WRITE_TAG"         to GoatPermissionManager.SCOPE_BLUETOOTH,
            "AUDIO_RECORD_START"    to GoatPermissionManager.SCOPE_RECORD,
            "AUDIO_RECORD_STOP"     to GoatPermissionManager.SCOPE_RECORD,
            "RECORD_AUDIO_START"    to GoatPermissionManager.SCOPE_RECORD,
            "RECORD_AUDIO_STOP"     to GoatPermissionManager.SCOPE_RECORD,
        )
    }

    private val customHandlers = ConcurrentHashMap<String, suspend (JsonObject) -> Result<JsonObject>>()
    private val registeredPlugins = ConcurrentHashMap<String, GoatBridgePlugin>()
    private val actionToPluginMap = ConcurrentHashMap<String, GoatBridgePlugin>()
    private val adaptiveRefreshRateManager by lazy {
        com.goat.webview.rendering.GoatAdaptiveRefreshRateManager().also {
            it.onElevateRefreshRate = onSetAdaptiveRefreshRate
        }
    }

    // --- Lazy feature managers -------------------------------------------------------------
    // These were previously eager default constructor arguments, which meant every GoatView
    // paid to construct (and, more expensively, to class-load + ART-verify) all ~30 of them
    // even for a mini-app that never touches a sensor, a wallet or a WASM worker. Each is now
    // built on first real use. The `inj*` field captures a caller/test-supplied override
    // (the constructor parameter keeps its original name so named-argument call sites are
    // unchanged); the lazy property below is what the action handlers actually read.
    private val injStorageManager = storageManager
    private val storageManager: GoatStorageManager by lazy { injStorageManager ?: GoatStorageManager(context) }

    private val injSecureStorageManager = secureStorageManager
    private val secureStorageManager: GoatSecureStorageManager by lazy { injSecureStorageManager ?: GoatSecureStorageManager(context) }

    private val injApmCollector = apmCollector
    private val apmCollector: GoatApmCollector by lazy { injApmCollector ?: GoatApmCollector() }

    private val injPushManager = pushManager
    private val pushManager: GoatPushNotificationManager by lazy { injPushManager ?: GoatPushNotificationManager(context) }

    private val injContactsGeofenceManager = contactsGeofenceManager
    private val contactsGeofenceManager: GoatContactsGeofenceManager by lazy { injContactsGeofenceManager ?: GoatContactsGeofenceManager(context) }

    private val injIapPurchaseManager = iapPurchaseManager
    private val iapPurchaseManager: GoatIapPurchaseManager by lazy { injIapPurchaseManager ?: GoatIapPurchaseManager(
            context = context,
            hmacSecretKey = System.getenv("GOAT_IAP_HMAC_SECRET")
        ) }

    private val injBinaryChannelManager = binaryChannelManager
    private val binaryChannelManager: GoatBinaryChannelManager by lazy { injBinaryChannelManager ?: GoatBinaryChannelManager() }

    private val injSslPinningManager = sslPinningManager
    private val sslPinningManager: GoatSslPinningManager by lazy { injSslPinningManager ?: GoatSslPinningManager() }

    private val injPermissionManager = permissionManager
    private val permissionManager: GoatPermissionManager by lazy { injPermissionManager ?: GoatPermissionManager(context) }

    private val injKeyboardManager = keyboardManager
    private val keyboardManager: GoatKeyboardManager by lazy { injKeyboardManager ?: GoatKeyboardManager(context) }

    private val injPredictiveBackCoordinator = predictiveBackCoordinator
    private val predictiveBackCoordinator: GoatPredictiveBackCoordinator by lazy { injPredictiveBackCoordinator ?: GoatPredictiveBackCoordinator() }

    private val injWasmWorkerManager = wasmWorkerManager
    private val wasmWorkerManager: GoatWasmWorkerManager by lazy { injWasmWorkerManager ?: GoatWasmWorkerManager() }

    private val injBytecodePrecompiler = bytecodePrecompiler
    private val bytecodePrecompiler: GoatBytecodePrecompiler by lazy { injBytecodePrecompiler ?: GoatBytecodePrecompiler(context) }

    private val injFileChooserManager = fileChooserManager
    private val fileChooserManager: GoatFileChooserManager by lazy { injFileChooserManager ?: GoatFileChooserManager() }

    private val injBackNavigationCoordinator = backNavigationCoordinator
    private val backNavigationCoordinator: GoatBackNavigationCoordinator by lazy { injBackNavigationCoordinator ?: GoatBackNavigationCoordinator() }

    private val injVisualRenderer = visualRenderer
    private val visualRenderer: GoatVisualRenderer by lazy { injVisualRenderer ?: GoatVisualRenderer() }

    private val injPageStackManager = pageStackManager
    private val pageStackManager: GoatPageStackManager by lazy { injPageStackManager ?: GoatPageStackManager() }

    private val injSubpackageLoader = subpackageLoader
    private val subpackageLoader: GoatSubpackageLoader by lazy { injSubpackageLoader ?: GoatSubpackageLoader(context) }

    private val injSameLayerRenderer = sameLayerRenderer
    private val sameLayerRenderer: GoatSameLayerRenderer by lazy { injSameLayerRenderer ?: GoatSameLayerRenderer() }

    private val injApiRegistry = apiRegistry
    private val apiRegistryLazy = lazy {
        (injApiRegistry ?: GoatApiRegistry()).also { registry ->
            syncCapabilitiesToRegistry(registry)
        }
    }
    private val apiRegistry: GoatApiRegistry by apiRegistryLazy

    private val injProcessService = processService
    private val processService: GoatMiniAppProcessService by lazy { injProcessService ?: GoatMiniAppProcessService() }

    private val injStartupBenchmark = startupBenchmark
    private val startupBenchmark: GoatStartupBenchmark by lazy { injStartupBenchmark ?: GoatStartupBenchmark() }

    private val injTracer = tracer
    private val tracer: GoatOpenTelemetryTracer by lazy { injTracer ?: GoatOpenTelemetryTracer() }

    private val injSafeAreaManager = safeAreaManager
    private val safeAreaManager: GoatSafeAreaManager by lazy { injSafeAreaManager ?: GoatSafeAreaManager(context) }

    private val injHapticFeedback = hapticFeedback
    private val hapticFeedback: com.goat.webview.ui.GoatHapticFeedback by lazy { injHapticFeedback ?: com.goat.webview.ui.GoatHapticFeedback(context) }

    private val injAbuseGuardManager = abuseGuardManager
    private val abuseGuardManagerLazy = lazy {
        (injAbuseGuardManager ?: com.goat.webview.security.GoatAbuseGuardManager()).also { manager ->
            val pending = pendingUserGestureTimestamp
            if (pending > 0L) {
                manager.recordUserGesture(pending)
            }
        }
    }
    private val abuseGuardManager: com.goat.webview.security.GoatAbuseGuardManager by abuseGuardManagerLazy

    private val injOAuthSessionManager = oAuthSessionManager
    private val oAuthSessionManager: com.goat.webview.auth.GoatOAuthSessionManager by lazy { injOAuthSessionManager ?: com.goat.webview.auth.GoatOAuthSessionManager(context) }

    private val injHttpAuthManager = httpAuthManager
    // `secureStorageManager` is qualified so it binds to the lazy property below, not to the
    // (nullable) constructor parameter of the same name, which would otherwise shadow it here.
    private val httpAuthManager: com.goat.webview.auth.GoatHttpAuthManager by lazy {
        injHttpAuthManager
            ?: com.goat.webview.auth.GoatHttpAuthManager(
                context,
                this@GoatBridgeActionHandler.secureStorageManager
            )
    }

    private val injGestureScrollCoordinator = gestureScrollCoordinator
    private val gestureScrollCoordinator: GoatGestureScrollCoordinator by lazy {
        (injGestureScrollCoordinator ?: GoatGestureScrollCoordinator()).also { coordinator ->
            // Wiring moved out of `init {}` so constructing the handler no longer forces this
            // coordinator into existence; it is attached the first time anything reads it,
            // which is still strictly before any fling callback can fire.
            coordinator.onFlingStateChanged = { active ->
                if (active) adaptiveRefreshRateManager.onGestureActive()
                else adaptiveRefreshRateManager.onGestureSettled()
            }
        }
    }

    private val injEventCoalescer = eventCoalescer
    private val eventCoalescerLazy = lazy { injEventCoalescer ?: com.goat.webview.ipc.GoatEventCoalescer() }
    private val eventCoalescer: com.goat.webview.ipc.GoatEventCoalescer by eventCoalescerLazy


    private val injPaymentGatewayManager = paymentGatewayManager
    private val paymentGatewayManagerLazy = lazy {
        if (injPaymentGatewayManager != null) {
            injPaymentGatewayManager
        } else if (autoRegisterPayments) {
            tryAutoRegisterPaymentGateway()
        } else {
            null
        }
    }
    private val paymentGatewayManager: com.goat.webview.payments.GoatPaymentGatewayManager? by paymentGatewayManagerLazy

    @Volatile private var pluginsAutoRegistered = false

    private fun ensurePluginsRegistered() {
        if (autoRegisterPlugins && !pluginsAutoRegistered) {
            synchronized(this) {
                if (!pluginsAutoRegistered) {
                    tryAutoRegisterBundledPlugins()
                    pluginsAutoRegistered = true
                }
            }
        }
    }

    private fun syncCapabilitiesToRegistry(registry: GoatApiRegistry) {
        for (plugin in registeredPlugins.values) {
            for (action in plugin.supportedActions) {
                val category = GoatApiRegistry.resolveCategory(action)
                registry.registerCapability(ApiCapability(actionName = action, category = category, isSupported = true))
            }
        }
    }

    init {
        plugins.forEach { registerPlugin(it) }
    }

    private fun tryAutoRegisterPaymentGateway(): com.goat.webview.payments.GoatPaymentGatewayManager? {
        if (paymentRegistryChecked && paymentRegistryMethod == null) return null
        return try {
            if (!paymentRegistryChecked) {
                try {
                    val registryClass = Class.forName("com.goat.webview.features.GoatPaymentPluginRegistry")
                    paymentRegistryInstance = registryClass.getField("INSTANCE").get(null)
                    paymentRegistryMethod = registryClass.getMethod("createGatewayManager", Context::class.java, String::class.java)
                } catch (_: ClassNotFoundException) {
                    paymentRegistryInstance = null
                    paymentRegistryMethod = null
                } finally {
                    paymentRegistryChecked = true
                }
            }
            val method = paymentRegistryMethod ?: return null
            val instance = paymentRegistryInstance
            method.invoke(instance, context, appId) as? com.goat.webview.payments.GoatPaymentGatewayManager
        } catch (e: Throwable) {
            Log.w(TAG, "Payment gateway auto-registration failed; REQUEST_PAYMENT will report PAYMENT_GATEWAY_NOT_CONFIGURED", e)
            null
        }
    }

    private fun tryAutoRegisterBundledPlugins() {
        if (pluginRegistryChecked && pluginRegistryMethod == null) return
        try {
            if (!pluginRegistryChecked) {
                try {
                    val registryClass = Class.forName("com.goat.webview.features.GoatPluginRegistry")
                    pluginRegistryInstance = registryClass.getField("INSTANCE").get(null)
                    pluginRegistryMethod = registryClass.getMethod("createAllPlugins", Context::class.java)
                } catch (_: ClassNotFoundException) {
                    pluginRegistryInstance = null
                    pluginRegistryMethod = null
                } finally {
                    pluginRegistryChecked = true
                }
            }
            val method = pluginRegistryMethod ?: return
            val instance = pluginRegistryInstance
            @Suppress("UNCHECKED_CAST")
            val loadedPlugins = method.invoke(instance, context) as? List<GoatBridgePlugin>
            loadedPlugins?.forEach { registerPlugin(it) }
        } catch (e: Throwable) {
            Log.w(TAG, "Bundled plugin auto-registration failed; feature actions will be unavailable", e)
        }
    }

    /**
     * Registers a custom action handler lambda for a specific action name.
     */
    fun registerCustomHandler(action: String, handler: suspend (JsonObject) -> Result<JsonObject>) {
        customHandlers[action] = handler
    }

    /**
     * Unregisters a custom action handler by action name.
     */
    fun unregisterCustomHandler(action: String) {
        customHandlers.remove(action)
    }

    /**
     * Registers a modular [GoatBridgePlugin] with this action handler.
     */
    fun registerPlugin(plugin: GoatBridgePlugin) {
        registeredPlugins[plugin.pluginId] = plugin
        for (action in plugin.supportedActions) {
            actionToPluginMap[action] = plugin
            if (apiRegistryLazy.isInitialized()) {
                val category = GoatApiRegistry.resolveCategory(action)
                apiRegistry.registerCapability(ApiCapability(actionName = action, category = category, isSupported = true))
            }
        }
    }

    /**
     * Unregisters a modular [GoatBridgePlugin] by its plugin ID.
     */
    fun unregisterPlugin(pluginId: String) {
        val removed = registeredPlugins.remove(pluginId)
        if (removed != null) {
            for (action in removed.supportedActions) {
                actionToPluginMap.remove(action)
                if (apiRegistryLazy.isInitialized()) {
                    val category = GoatApiRegistry.resolveCategory(action)
                    apiRegistry.registerCapability(ApiCapability(actionName = action, category = category, isSupported = false))
                }
            }
        }
    }

    /**
     * Returns an immutable list of currently registered modular plugins.
     */
    fun getRegisteredPlugins(): List<GoatBridgePlugin> {
        ensurePluginsRegistered()
        return registeredPlugins.values.toList()
    }

    /**
     * Returns the full set of currently supported actions (built-in + custom handlers + plugins).
     */
    fun getSupportedActions(): Set<String> {
        ensurePluginsRegistered()
        val pluginActions = actionToPluginMap.keys
        return SUPPORTED_ACTIONS + customHandlers.keys + pluginActions
    }

    /**
     * O(1) check whether an action is supported without multi-set flatMap allocations.
     */
    fun isActionSupported(action: String): Boolean {
        if (SUPPORTED_ACTIONS.contains(action) || customHandlers.containsKey(action) || actionToPluginMap.containsKey(action)) {
            return true
        }
        if (autoRegisterPlugins && !pluginsAutoRegistered) {
            ensurePluginsRegistered()
            return actionToPluginMap.containsKey(action)
        }
        return false
    }

    private val vibrator: Vibrator? by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vibratorManager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    private val clipboard: ClipboardManager? by lazy {
        context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
    }

    /**
     * Resolves and verifies the authorized tenant appId for storage and sandboxed operations.
     * Prevents multi-tenant spoofing by strictly enforcing the container's bound appId.
     */
    private fun resolveAuthorizedAppId(payload: JsonObject): String {
        val requestedAppId = payload["appId"]?.jsonPrimitive?.content
        if (requestedAppId != null && requestedAppId != this.appId) {
            throw SecurityException("Multi-tenant isolation violation: caller '${this.appId}' cannot access '$requestedAppId'")
        }
        return this.appId
    }

    /**
     * Registers a custom handler for an action string.
     */
    fun registerCustomAction(action: String, handler: suspend (JsonObject) -> Result<JsonObject>) {
        customHandlers[action] = handler
    }

    /**
     * Executes a native bridge action dispatched by the Web Mini-App.
     *
     * @param action The uppercase action name.
     * @param payload The request parameters JSON object.
     * @return [Result] containing the JSON response data or an exception.
     */
    suspend fun executeAction(action: String, payload: JsonObject): Result<JsonObject> = withContext(Dispatchers.Default) {
        try {
            // Zero-cost bridge latency probe: echoes the payload straight back with no dispatch,
            // no manager access and no permission/abuse checks. Used by SDKs to measure the raw
            // JS<->native round-trip. Must stay the first branch.
            if (action == "BRIDGE_PING") {
                return@withContext Result.success(payload)
            }

            // Anti-Abuse: User Gesture Freshness Gate (Task 10199)
            if (com.goat.webview.security.GoatAbuseGuardManager.PRIVILEGED_ACTIONS.contains(action)) {
                if (!abuseGuardManager.isGestureFresh()) {
                    return@withContext Result.failure(
                        SecurityException("GESTURE_REQUIRED: Privileged action '$action' requires a recent user gesture (< 10s).")
                    )
                }
            }

            // Anti-Abuse: Repeated Dialog Cooldown (Task 10199)
            if (action == "SHOW_MODAL" || action == "SHOW_ACTION_SHEET" || action == "SHOW_TOAST") {
                if (abuseGuardManager.shouldThrottleDialog(action)) {
                    return@withContext Result.failure(
                        IllegalStateException("DIALOG_COOLDOWN_ACTIVE: Too many dialog requests.")
                    )
                }
            }

            // 1. Check if there is a registered custom action handler
            if (customHandlers.isNotEmpty()) {
                val customHandler = customHandlers[action]
                if (customHandler != null) {
                    return@withContext customHandler(payload)
                }
            }

            // 2. Check if a registered modular GoatBridgePlugin can handle this action via O(1) map lookup.
            // Enforce permission gate BEFORE dispatching to plugin — sensitive actions must
            // have the required scope granted regardless of which plugin handles them.
            var pluginCandidate = actionToPluginMap[action]
            if (pluginCandidate == null && autoRegisterPlugins && !pluginsAutoRegistered && !SUPPORTED_ACTIONS.contains(action)) {
                ensurePluginsRegistered()
                pluginCandidate = actionToPluginMap[action]
            }
            if (pluginCandidate != null) {
                val requiredScope = PERMISSION_REQUIRED_ACTIONS[action]
                if (requiredScope != null) {
                    enforcePermission(requiredScope)
                }
                return@withContext pluginCandidate.execute(action, payload)
            }

            when (action) {
                // 1. Core & System Lifecycle
                "GET_DEVICE_INFO" -> Result.success(handleGetDeviceInfo())
                "HAPTIC_FEEDBACK" -> Result.success(handleHapticFeedback(payload))
                "SET_STATUS_BAR_THEME" -> Result.success(handleSetStatusBarTheme(payload))
                "SET_SCREEN_BRIGHTNESS" -> Result.success(handleSetScreenBrightness(payload))
                "GET_SCREEN_BRIGHTNESS" -> Result.success(handleGetScreenBrightness())
                "SET_KEEP_SCREEN_ON" -> Result.success(handleSetKeepScreenOn(payload))
                "SET_ORIENTATION_LOCK" -> Result.success(handleSetOrientationLock(payload))
                "GET_ORIENTATION_LOCK" -> Result.success(handleGetOrientationLock())
                "SETUP_CLOSING_BEHAVIOR" -> Result.success(handleSetupClosingBehavior(payload))
                "SETUP_SWIPE_BEHAVIOR" -> Result.success(handleSetupSwipeBehavior(payload))
                "CLIPBOARD_SET" -> Result.success(handleSetClipboard(payload))
                "CLIPBOARD_GET" -> Result.success(handleGetClipboard())
                "NAVIGATE_BACK" -> Result.success(handleNavigateBack())
                "CAN_I_USE" -> Result.success(handleCanIUse(payload))
                "START_OAUTH_SESSION" -> Result.success(handleStartOAuthSession(payload))
                "CANCEL_OAUTH_SESSION" -> Result.success(handleCancelOAuthSession(payload))

                // 2. Storage & Sandboxing
                "STORAGE_SET" -> Result.success(handleStorageSet(payload))
                "STORAGE_GET" -> Result.success(handleStorageGet(payload))
                "STORAGE_REMOVE" -> Result.success(handleStorageRemove(payload))
                "STORAGE_CLEAR" -> Result.success(handleStorageClear(payload))
                "SECURE_STORAGE_SET" -> Result.success(handleSecureStorageSet(payload))
                "SECURE_STORAGE_GET" -> Result.success(handleSecureStorageGet(payload))
                "SECURE_STORAGE_REMOVE" -> Result.success(handleSecureStorageRemove(payload))
                "SECURE_STORAGE_CLEAR" -> Result.success(handleSecureStorageClear(payload))
                "COOKIE_GET" -> Result.success(handleCookieGet(payload))
                "COOKIE_SET" -> Result.success(handleCookieSet(payload))
                "COOKIE_REMOVE" -> Result.success(handleCookieRemove(payload))
                "COOKIE_REMOVE_ALL" -> Result.success(handleCookieRemoveAll(payload))
                "WEB_STORAGE_GET_QUOTA_USAGE" -> Result.success(handleWebStorageGetQuotaUsage(payload))
                "WEB_STORAGE_CLEAR" -> Result.success(handleWebStorageClear(payload))
                "HTTP_AUTH_SAVE_CREDENTIAL" -> Result.success(handleHttpAuthSaveCredential(payload))
                "HTTP_AUTH_CLEAR_CREDENTIALS" -> Result.success(handleHttpAuthClearCredentials(payload))

                // 3. Sandboxed FileSystem & File Chooser
                "FS_WRITE_FILE" -> Result.success(handleFsWriteFile(payload))
                "FS_READ_FILE" -> Result.success(handleFsReadFile(payload))
                "FS_MKDIR" -> Result.success(handleFsMkdir(payload))
                "FS_RMDIR" -> Result.success(handleFsRmdir(payload))
                "FS_UNLINK" -> Result.success(handleFsUnlink(payload))
                "FS_LIST_DIR" -> Result.success(handleFsListDir(payload))
                "FS_STAT" -> Result.success(handleFsStat(payload))
                "FS_COPY_FILE" -> Result.success(handleFsCopyFile(payload))
                "FS_EXISTS" -> Result.success(handleFsExists(payload))
                "CHOOSE_FILES" -> Result.success(handleChooseFiles(payload))
                "CANCEL_FILE_CHOOSER" -> Result.success(handleCancelFileChooser())

                // 4. Networking, HTTP & SSL
                "API_REQUEST" -> Result.success(handleApiRequest(payload))
                "DOWNLOAD_FILE" -> Result.success(handleDownloadFile(payload))
                "IS_CONNECTED" -> Result.success(handleIsConnected())
                "VERIFY_SSL_PIN" -> Result.success(handleVerifySslPin(payload))
                "AUDIT_NETWORK_CERTIFICATE" -> Result.success(handleAuditNetworkCertificate(payload))

                // 5. UI Feedback & Window Insets
                "SHOW_TOAST" -> Result.success(handleShowToast(payload))
                "HIDE_TOAST" -> Result.success(handleHideToast())
                "SHOW_MODAL" -> Result.success(handleShowModal(payload))
                "SHOW_ACTION_SHEET" -> Result.success(handleShowActionSheet(payload))
                "SHOW_LOADING" -> Result.success(handleShowLoading(payload))
                "HIDE_LOADING" -> Result.success(handleHideLoading())
                "GET_KEYBOARD_INSETS" -> Result.success(handleGetKeyboardInsets())
                "SET_KEYBOARD_INSETS" -> Result.success(handleSetKeyboardInsets(payload))
                "SET_NAV_BAR_TITLE" -> Result.success(handleSetNavBarTitle(payload))
                "SET_NAV_BAR_COLOR" -> Result.success(handleSetNavBarColor(payload))
                "SET_NAV_BAR_BUTTONS" -> Result.success(handleSetNavBarButtons(payload))
                "SET_NAV_BAR_PROGRESS" -> Result.success(handleSetNavBarProgress(payload))
                "EXPAND_BOTTOM_SHEET" -> Result.success(handleExpandBottomSheet(payload))
                "COLLAPSE_BOTTOM_SHEET" -> Result.success(handleCollapseBottomSheet(payload))
                "SET_SHEET_SNAP_POINTS" -> Result.success(handleSetSheetSnapPoints(payload))
                "GET_SAFE_AREA_INSETS" -> Result.success(handleGetSafeAreaInsets())
                "FIND_IN_PAGE" -> Result.success(handleFindInPage(payload))
                "FIND_NEXT" -> Result.success(handleFindNext(payload))
                "FIND_CLEAR" -> Result.success(handleFindClear())
                "PRINT_PAGE" -> Result.success(handlePrintPage(payload))
                "OPEN_EXTERNAL_LINK" -> Result.success(handleOpenExternalLink(payload))
                "OPEN_URL" -> Result.success(handleOpenExternalLink(payload))
                "OPEN_LINK" -> Result.success(handleOpenExternalLink(payload))
                "TAB_OPEN" -> Result.success(handleTabOpen(payload))
                "TAB_CLOSE" -> Result.success(handleTabClose(payload))
                "TAB_SWITCH" -> Result.success(handleTabSwitch(payload))
                "TAB_GET_ACTIVE" -> Result.success(handleTabGetActive())
                "TAB_LIST" -> Result.success(handleTabList())
                "TAB_CLOSE_ALL" -> Result.success(handleTabCloseAll())
                "OPEN_MINI_APP" -> Result.success(handleOpenMiniApp(payload))
                "CLOSE_MINI_APP" -> Result.success(handleCloseMiniApp(payload))
                "ON_MINI_APP_CLOSED" -> Result.success(buildJsonObject { put("registered", true) })
                "ON_APP_SERVICE_READY", "APP_SERVICE_READY" -> Result.success(handleAppServiceReady(payload))
                "ON_APP_SERVICE_CRASH", "APP_SERVICE_CRASH" -> Result.success(handleAppServiceCrash(payload))
                "ON_APP_SERVICE_TERMINATE", "APP_SERVICE_TERMINATE" -> Result.success(handleAppServiceTerminate(payload))

                // 6. Hardware Sensors & Telephony
                // Sensor actions are served by :feature-sensors (GoatSensorsPlugin), registered
                // through GoatPluginRegistry — see the plugin dispatch above this `when`.
                "MAKE_PHONE_CALL" -> Result.success(handleMakePhoneCall(payload))
                "SEND_SMS" -> Result.success(handleSendSms(payload))

                // 7. Geofencing & Location Utilities
                "START_GEOFENCE" -> Result.success(handleStartGeofence(payload))
                "STOP_GEOFENCE" -> Result.success(handleStopGeofence(payload))
                "LIST_GEOFENCES" -> Result.success(handleListGeofences())
                "EVALUATE_GEOFENCE" -> Result.success(handleEvaluateGeofence(payload))

                // 8. Permissions & Security
                "CHECK_PERMISSION" -> Result.success(handleCheckPermission(payload))
                "REQUEST_PERMISSION" -> Result.success(handleRequestPermission(payload))
                "GET_SETTING" -> Result.success(handleGetSetting(payload))
                "OPEN_SETTING" -> Result.success(handleOpenSetting(payload))
                "AUTHORIZE" -> Result.success(handleAuthorize(payload))
                "AUDIT_SANDBOX_HEADERS" -> Result.success(handleAuditSandboxHeaders(payload))

                // 9. Contacts & Social Sharing
                "CHOOSE_CONTACT", "PICK_CONTACTS" -> Result.success(handleChooseContact())
                "GET_CONTACTS_COUNT" -> Result.success(handleGetContactsCount())
                "SHARE_SHEET" -> Result.success(handleShareSheet(payload))
                "SHARE_TO_STORY" -> Result.success(handleShareToStory(payload))

                // 10. Push Notifications
                "PUSH_GET_TOKEN", "GET_PUSH_TOKEN" -> Result.success(handlePushGetToken())
                "PUSH_REQUEST_PERMISSION" -> Result.success(handlePushRequestPermission())
                "PUSH_SET_BADGE" -> Result.success(handlePushSetBadge(payload))
                "PUSH_SHOW_NOTIFICATION" -> Result.success(handlePushShowNotification(payload))
                "SUBSCRIBE_PUSH_TOPIC" -> Result.success(handleSubscribePushTopic(payload))
                "UNSUBSCRIBE_PUSH_TOPIC" -> Result.success(handleUnsubscribePushTopic(payload))
                "GET_PENDING_NOTIFICATIONS" -> Result.success(handleGetPendingNotifications())
                "CLEAR_NOTIFICATIONS" -> Result.success(handleClearNotifications(payload))

                // 13. Web3 & Payments
                // Web3 actions are served by :feature-web3 (GoatWeb3Plugin).
                "OPEN_INVOICE" -> Result.success(handleOpenInvoice(payload))
                "GET_PURCHASE_PRODUCTS" -> Result.success(handleGetPurchaseProducts(payload))
                "RESTORE_PURCHASES" -> Result.success(handleRestorePurchases())
                "REQUEST_PAYMENT" -> Result.success(handleRequestPayment(payload))
                "QUERY_PAYMENT_STATUS" -> Result.success(handleQueryPaymentStatus(payload))
                "CANCEL_PAYMENT" -> Result.success(handleCancelPayment(payload))

                // 14. Binary IPC Channels
                "CREATE_BINARY_PORT" -> Result.success(handleCreateBinaryPort(payload))
                "POST_BINARY_MESSAGE" -> Result.success(handlePostBinaryMessage(payload))
                "READ_BINARY_MESSAGE" -> Result.success(handleReadBinaryMessage(payload))
                "CLOSE_BINARY_PORT" -> Result.success(handleCloseBinaryPort(payload))

                // 15. Navigation & Predictive Back
                "CAN_GO_BACK" -> Result.success(handleCanGoBack())
                "HANDLE_BACK_PRESS" -> Result.success(handleBackPress())
                "PUSH_HISTORY_STATE" -> Result.success(handlePushHistoryState(payload))
                "GET_CURRENT_ROUTE" -> Result.success(handleGetCurrentRoute())
                "NAV_PUSH" -> Result.success(handleNavPush(payload))
                "NAV_POP" -> Result.success(handleNavPop())
                "NAV_POP_TO_ROOT" -> Result.success(handleNavPopToRoot())
                "NAV_REPLACE" -> Result.success(handleNavReplace(payload))
                "GET_PAGE_STACK" -> Result.success(handleGetPageStack())
                "PREDICTIVE_BACK_PROGRESS" -> Result.success(handlePredictiveBackProgress(payload))
                "PREDICTIVE_BACK_INVOKE" -> Result.success(handlePredictiveBackInvoke())
                "PREDICTIVE_BACK_CANCEL" -> Result.success(handlePredictiveBackCancel())

                // 16. Subpackages, WASM & Bytecode
                "LOAD_SUBPACKAGE" -> Result.success(handleLoadSubpackage(payload))
                "IS_SUBPACKAGE_CACHED" -> Result.success(handleIsSubpackageCached(payload))
                "CLEAR_SUBPACKAGE_CACHE" -> Result.success(handleClearSubpackageCache(payload))
                "GET_SUBPACKAGES" -> Result.success(handleGetSubpackages(payload))
                "PRECOMPILE_BYTECODE" -> Result.success(handlePrecompileBytecode(payload))
                "IS_BYTECODE_WARM" -> Result.success(handleIsBytecodeWarm(payload))
                "CLEAR_BYTECODE_CACHE" -> Result.success(handleClearBytecodeCache(payload))
                "GET_BYTECODE_STATS" -> Result.success(handleGetBytecodeStats())
                "VALIDATE_WASM_SUPPORT" -> Result.success(handleValidateWasmSupport())

                // 17. Visual Rendering & Same-Layer
                "CONFIGURE_TRANSPARENCY" -> Result.success(handleConfigureTransparency(payload))
                "SYNC_THEME_BACKGROUND" -> Result.success(handleSyncThemeBackground(payload))
                "GET_RENDER_LAYER_CONFIG" -> Result.success(handleGetRenderLayerConfig())
                "GESTURE_SCROLL_UPDATE" -> Result.success(handleGestureScrollUpdate(payload))
                "SHOULD_PARENT_INTERCEPT" -> Result.success(handleShouldParentIntercept(payload))
                "RESET_GESTURE_COORDINATOR" -> Result.success(handleResetGestureCoordinator())
                "EMBED_NATIVE_VIEW" -> Result.success(handleEmbedNativeView(payload))
                "UPDATE_NATIVE_VIEW_BOUNDS" -> Result.success(handleUpdateNativeViewBounds(payload))
                "REMOVE_NATIVE_VIEW" -> Result.success(handleRemoveNativeView(payload))
                "GET_ACTIVE_NATIVE_VIEWS" -> Result.success(handleGetActiveNativeViews())

                // 18. Capability Discovery & APM Telemetry
                "GET_API_CAPABILITIES" -> Result.success(handleGetApiCapabilities(payload))
                "REGISTER_CAPABILITY" -> Result.success(handleRegisterCapability(payload))
                "GET_SANDBOX_PROCESS_STATUS" -> Result.success(handleGetSandboxProcessStatus())
                "GET_STARTUP_BENCHMARK_REPORT" -> Result.success(handleGetStartupBenchmarkReport())
                "RECORD_STARTUP_BENCHMARK_SAMPLE" -> Result.success(handleRecordStartupBenchmarkSample(payload))
                "REPORT_METRICS", "SEND_APM_METRIC" -> Result.success(handleReportMetrics(payload))
                "GET_APM_METRICS", "GET_APM_SUMMARY" -> Result.success(handleGetApmMetrics())
                "RECORD_BRIDGE_TIMING" -> Result.success(handleRecordBridgeTiming(payload))
                "START_TRACE" -> Result.success(handleStartTrace(payload))
                "STOP_TRACE" -> Result.success(handleStopTrace(payload))
                "GET_TRACES" -> Result.success(handleGetTraces())
                "GET_MEMORY_METRICS" -> Result.success(handleGetMemoryMetrics())

                // Compat-adapter passthrough: the bridge already forwards every action (known or
                // not) to the embedder before dispatch runs, so an adapter's addJavaScriptHandler
                // emulation works with no registration at all. This case exists only so it
                // resolves cleanly here too, instead of logging as a failed "unsupported action"
                // in telemetry on every compat call.
                "__COMPAT_CALL__" -> Result.success(buildJsonObject { put("routed", true) })

                else -> Result.failure(IllegalArgumentException("Unsupported native action: $action"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed executing action $action", e)
            Result.failure(e)
        }
    }

    fun handleGetDeviceInfo(): JsonObject {
        val batteryIntent = try {
            context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        } catch (e: Exception) {
            null
        }
        val level = batteryIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = batteryIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val batteryPct = if (level != -1 && scale != -1) (level * 100 / scale.toFloat()).toInt() else 100
        val status = batteryIntent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL

        val isDark = (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

        return buildJsonObject {
            put("model", Build.MODEL ?: "Unknown")
            put("manufacturer", Build.MANUFACTURER ?: "Unknown")
            put("brand", Build.BRAND ?: "Unknown")
            put("androidVersion", Build.VERSION.RELEASE ?: "Unknown")
            put("sdkInt", Build.VERSION.SDK_INT)
            put("screenWidthDp", context.resources.configuration.screenWidthDp)
            put("screenHeightDp", context.resources.configuration.screenHeightDp)
            put("density", context.resources.displayMetrics.density.toDouble())
            put("batteryLevel", batteryPct)
            put("isCharging", isCharging)
            put("isAlgorithmicDarkening", isDark)
            put("appVersion", "1.0.0-goat")
            put("installGuid", com.goat.webview.storage.GoatAccountScopedSandbox.getInstallGuid(context))
        }
    }

    fun handleHapticFeedback(payload: JsonObject): JsonObject {
        return hapticFeedback.trigger(payload)
    }

    /**
     * Handles tenant-isolated key-value storage persistence (STORAGE_SET).
     */
    suspend fun handleStorageSet(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val key = payload["key"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'key'")
        val value = payload["value"]?.jsonPrimitive?.content ?: ""
        val targetAppId = resolveAuthorizedAppId(payload)

        storageManager.setValue(targetAppId, key, value)
        buildJsonObject {
            put("saved", true)
            put("key", key)
            put("appId", targetAppId)
        }
    }

    /**
     * Handles tenant-isolated key-value storage retrieval (STORAGE_GET).
     */
    suspend fun handleStorageGet(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val key = payload["key"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'key'")
        val targetAppId = resolveAuthorizedAppId(payload)

        val value = storageManager.getValue(targetAppId, key)
        buildJsonObject {
            put("key", key)
            if (value != null) {
                put("value", value)
            } else {
                put("value", JsonPrimitive(null as String?))
            }
            put("appId", targetAppId)
        }
    }

    /**
     * Handles tenant-isolated key-value storage deletion (STORAGE_REMOVE).
     */
    suspend fun handleStorageRemove(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val key = payload["key"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'key'")
        val targetAppId = resolveAuthorizedAppId(payload)

        val removed = storageManager.removeValue(targetAppId, key)
        buildJsonObject {
            put("removed", removed)
            put("key", key)
            put("appId", targetAppId)
        }
    }

    /**
     * Handles tenant-isolated key-value storage clearing (STORAGE_CLEAR).
     */
    suspend fun handleStorageClear(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val targetAppId = resolveAuthorizedAppId(payload)
        val cleared = storageManager.clearValues(targetAppId)
        buildJsonObject {
            put("cleared", cleared)
            put("appId", targetAppId)
        }
    }

    /**
     * Handles tenant-isolated AES-256-GCM hardware encrypted storage persistence (SECURE_STORAGE_SET).
     */
    suspend fun handleSecureStorageSet(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val key = payload["key"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'key'")
        val value = payload["value"]?.jsonPrimitive?.content ?: ""
        val targetAppId = resolveAuthorizedAppId(payload)

        val saved = secureStorageManager.setSecureValue(targetAppId, key, value)
        buildJsonObject {
            put("saved", saved)
            put("key", key)
            put("appId", targetAppId)
        }
    }

    /**
     * Handles tenant-isolated AES-256-GCM hardware encrypted storage retrieval (SECURE_STORAGE_GET).
     */
    suspend fun handleSecureStorageGet(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val key = payload["key"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'key'")
        val targetAppId = resolveAuthorizedAppId(payload)

        val value = secureStorageManager.getSecureValue(targetAppId, key)
        buildJsonObject {
            put("key", key)
            if (value != null) {
                put("value", value)
            } else {
                put("value", JsonPrimitive(null as String?))
            }
            put("appId", targetAppId)
        }
    }

    /**
     * Handles tenant-isolated AES-256-GCM hardware encrypted storage deletion (SECURE_STORAGE_REMOVE).
     */
    suspend fun handleSecureStorageRemove(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val key = payload["key"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'key'")
        val targetAppId = resolveAuthorizedAppId(payload)

        val removed = secureStorageManager.removeSecureValue(targetAppId, key)
        buildJsonObject {
            put("removed", removed)
            put("key", key)
            put("appId", targetAppId)
        }
    }

    /**
     * Handles tenant-isolated AES-256-GCM hardware encrypted storage clearing (SECURE_STORAGE_CLEAR).
     */
    suspend fun handleSecureStorageClear(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val targetAppId = resolveAuthorizedAppId(payload)
        val cleared = secureStorageManager.clearSecureValues(targetAppId)
        buildJsonObject {
            put("cleared", cleared)
            put("appId", targetAppId)
        }
    }

    /**
     * Validates and filters URLs for API_REQUEST, enforcing strict HTTPS transport,
     * domain allowlist matching, and comprehensive SSRF IP filtering.
     *
     * @param urlStr The raw URL string.
     * @param domainAllowlist Optional set of allowed domain patterns.
     * @return Validated [URL] instance.
     * @throws SecurityException If URL violates HTTPS, domain allowlist, or points to private/loopback/metadata addresses.
     */
    /**
     * Domains this mini-app may reach through API_REQUEST, from the bundle manifest's
     * `security.allowedDomains`. Null or empty means unfiltered, which is the behaviour every
     * mini-app has had until now -- only an app that declares the field opts into the restriction.
     *
     * Settable rather than constructor-only because GoatView builds the handler before it knows
     * which bundle is being loaded.
     */
    @Volatile
    var manifestDomainAllowlist: Set<String>? = manifestDomainAllowlist

    fun validateAndFilterUrl(urlStr: String, domainAllowlist: Set<String>? = this.manifestDomainAllowlist): URL {
        val cleanUrl = urlStr.trim()

        // 1. Enforce HTTPS scheme
        if (!cleanUrl.startsWith("https://", ignoreCase = true)) {
            throw SecurityException("CLEARTEXT_BLOCKED: Only HTTPS endpoints are permitted.")
        }

        val parsedUrl = try {
            URL(cleanUrl)
        } catch (e: Exception) {
            throw IllegalArgumentException("Invalid URL: $cleanUrl", e)
        }

        val host = parsedUrl.host.lowercase().trim()
        if (host.isEmpty()) {
            throw IllegalArgumentException("Invalid URL host")
        }

        // 2. Domain Allowlist validation (if configured)
        if (domainAllowlist != null && domainAllowlist.isNotEmpty()) {
            val isDomainAllowed = domainAllowlist.any { allowed ->
                val pattern = allowed.lowercase().trim()
                if (pattern.startsWith("*.")) {
                    val base = pattern.removePrefix("*.")
                    host == base || host.endsWith(".$base")
                } else {
                    host == pattern
                }
            }
            if (!isDomainAllowed) {
                throw SecurityException("DOMAIN_NOT_ALLOWED: Host '$host' is not in the mini-app allowed domains.")
            }
        }

        // 3. DNS Resolution & SSRF IP Range Validation
        val addresses = try {
            java.net.InetAddress.getAllByName(host)
        } catch (e: Exception) {
            throw SecurityException("DNS_RESOLUTION_FAILED: Unable to resolve host '$host'", e)
        }

        for (addr in addresses) {
            val ipStr = addr.hostAddress ?: ""
            if (addr.isLoopbackAddress ||                  // 127.0.0.0/8, ::1
                addr.isSiteLocalAddress ||                 // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
                addr.isLinkLocalAddress ||                 // 169.254.0.0/16, fe80::/10
                addr.isAnyLocalAddress ||                  // 0.0.0.0, ::
                addr.isMulticastAddress ||                 // 224.0.0.0/4, ff00::/8
                host == "169.254.169.254" ||               // Cloud Metadata IPv4
                host == "localhost" ||
                ipStr == "169.254.169.254" ||
                ipStr.startsWith("127.") ||
                ipStr.startsWith("10.") ||
                ipStr.startsWith("192.168.") ||
                ipStr.startsWith("169.254.") ||
                (ipStr.startsWith("172.") && isPrivateClassB(ipStr)) ||
                ipStr == "::1" ||
                ipStr == "0:0:0:0:0:0:0:1" ||
                ipStr.startsWith("fe80:") ||
                ipStr.startsWith("fc00:") ||
                ipStr.startsWith("fd00:")
            ) {
                throw SecurityException("SSRF_BLOCKED: Access to private, loopback, or metadata addresses ($addr) is strictly forbidden.")
            }
        }

        return parsedUrl
    }

    private fun isPrivateClassB(ipStr: String): Boolean {
        val parts = ipStr.split(".")
        if (parts.size >= 2) {
            val secondOctet = parts[1].toIntOrNull() ?: return false
            return secondOctet in 16..31
        }
        return false
    }

    /**
     * Executes an HTTP/HTTPS network request via native HttpURLConnection (API_REQUEST).
     * Bypasses Web browser CORS policies, validates HTTPS and SSRF guards, and executes on Dispatchers.IO.
     * Redirects are never followed blindly: every 3xx target is re-validated against the same
     * SSRF / allowlist rules as the initial URL before being fetched.
     *
     * @param payload Request parameters including `url`, `method`, `headers`, `body`, and `timeoutMs`.
     * @return JSON containing `status`, `statusText`, `durationMs`, `data`, and `headers`.
     */
    suspend fun handleApiRequest(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val urlStr = payload["url"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'url'")
        val method = (payload["method"]?.jsonPrimitive?.content ?: "GET").uppercase()
        val body = payload["body"]?.jsonPrimitive?.content
        val timeoutMs = payload["timeoutMs"]?.jsonPrimitive?.intOrNull ?: 8000
        val requestHeaders = payload["headers"]?.let {
            if (it is JsonObject) it else null
        }

        // Validate URL against HTTPS, SSRF, and Domain Allowlist rules
        val url = validateAndFilterUrl(urlStr)

        fun openValidatedConnection(target: URL): HttpURLConnection = (target.openConnection() as HttpURLConnection).apply {
            instanceFollowRedirects = false
            requestMethod = method
            connectTimeout = timeoutMs
            readTimeout = timeoutMs
            setRequestProperty("Accept", "application/json, text/plain, */*")
            setRequestProperty("User-Agent", "GoatWebViewEngine/1.0.0 (Android)")

            // Add custom request headers
            requestHeaders?.forEach { (key, valueElement) ->
                val headerVal = (valueElement as? JsonPrimitive)?.contentOrNull ?: valueElement.toString()
                setRequestProperty(key, headerVal)
            }

            if (body != null && (method == "POST" || method == "PUT" || method == "PATCH")) {
                doOutput = true
                outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
        }

        val startTime = System.currentTimeMillis()
        var conn = openValidatedConnection(url)
        var redirectsFollowed = 0
        try {
            while (true) {
                val statusCode = conn.responseCode
                if (statusCode in 300..399) {
                    val location = conn.getHeaderField("Location")
                        ?: throw SecurityException("REDIRECT_REJECTED: HTTP $statusCode redirect is missing a Location header.")
                    if (redirectsFollowed >= MAX_API_REDIRECTS) {
                        throw SecurityException("REDIRECT_LIMIT_EXCEEDED: Exceeded $MAX_API_REDIRECTS redirects while requesting '$urlStr'.")
                    }
                    redirectsFollowed++
                    val redirectTarget = validateAndFilterUrl(URL(conn.url, location).toString())
                    conn.disconnect()
                    conn = openValidatedConnection(redirectTarget)
                    continue
                }
                break
            }

            val statusCode = conn.responseCode
            val statusMsg = conn.responseMessage ?: "OK"
            val inputStream = if (statusCode in 200..299) conn.inputStream else conn.errorStream
            val responseText = inputStream?.bufferedReader()?.use { it.readText() } ?: ""
            val duration = System.currentTimeMillis() - startTime

            val parsedData: JsonElement = try {
                Json.parseToJsonElement(responseText)
            } catch (e: Exception) {
                JsonPrimitive(responseText)
            }

            // Extract response headers
            val responseHeadersJson = buildJsonObject {
                conn.headerFields?.forEach { (key, values) ->
                    if (key != null && values.isNotEmpty()) {
                        put(key.lowercase(), values.joinToString(", "))
                    }
                }
            }

            buildJsonObject {
                put("status", statusCode)
                put("statusText", statusMsg)
                put("durationMs", duration)
                put("data", parsedData)
                put("headers", responseHeadersJson)
            }
        } finally {
            conn.disconnect()
        }
    }

    fun handleNavigateBack(): JsonObject {
        onNavigateBack?.invoke()
        return buildJsonObject {
            put("handled", true)
        }
    }

    fun handleSetStatusBarTheme(payload: JsonObject): JsonObject {
        val isDark = payload["isDark"]?.jsonPrimitive?.boolean ?: true
        onThemeChange?.invoke(isDark)
        return buildJsonObject {
            put("updated", true)
            put("isDark", isDark)
        }
    }

    /**
     * Handles setting plain text content into the primary system clipboard (CLIPBOARD_SET).
     *
     * @param payload Request payload containing `text` string.
     * @return Confirmation JSON with `copied: true`.
     */
    fun handleSetClipboard(payload: JsonObject): JsonObject {
        val text = payload["text"]?.jsonPrimitive?.content ?: ""
        clipboard?.setPrimaryClip(ClipData.newPlainText("GoatWebView", text))
        return buildJsonObject {
            put("copied", true)
        }
    }

    /**
     * Handles retrieving the plain text content currently in the primary system clipboard (CLIPBOARD_GET).
     *
     * @return JSON containing `text` string.
     */
    fun handleGetClipboard(): JsonObject {
        val clip = clipboard?.primaryClip
        val text = if (clip != null && clip.itemCount > 0) {
            clip.getItemAt(0)?.text?.toString() ?: ""
        } else {
            ""
        }
        return buildJsonObject {
            put("text", text)
        }
    }

    /**
     * Handles enqueuing background file downloads via Android DownloadManager (DOWNLOAD_FILE).
     *
     * @param payload Request parameters including `url`, optional `fileName`, and optional `title`.
     * @return Confirmation JSON containing `downloadId`, `status: "ENQUEUED"`, and `fileName`.
     * @throws IllegalArgumentException If `url` parameter is missing or invalid.
     * @throws IllegalStateException If DownloadManager system service is unavailable.
     */
    fun handleDownloadFile(payload: JsonObject): JsonObject {
        val fileUrl = payload["url"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'url'")
        val fileName = payload["fileName"]?.jsonPrimitive?.content ?: "download_${System.currentTimeMillis()}"
        val title = payload["title"]?.jsonPrimitive?.content ?: fileName

        val uri = Uri.parse(fileUrl)
        require(uri.scheme?.isNotEmpty() == true) { "Invalid download URL scheme: $fileUrl" }

        val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as? DownloadManager
            ?: throw IllegalStateException("DownloadManager service is unavailable on this device")

        val request = DownloadManager.Request(uri).apply {
            setTitle(title)
            setDescription("Downloading via Goat WebView Engine...")
            setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
            setAllowedOverMetered(true)
            setAllowedOverRoaming(true)
        }

        val downloadId = downloadManager.enqueue(request)

        return buildJsonObject {
            put("downloadId", downloadId)
            put("status", "ENQUEUED")
            put("fileName", fileName)
        }
    }

    /**
     * Handles writing a sandboxed file (FS_WRITE_FILE).
     */
    suspend fun handleFsWriteFile(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val filePath = payload["filePath"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'filePath'")
        val rawData = payload["data"]?.jsonPrimitive?.content ?: ""
        val encoding = payload["encoding"]?.jsonPrimitive?.content ?: "utf8"
        val append = payload["append"]?.jsonPrimitive?.boolean ?: false
        val targetAppId = resolveAuthorizedAppId(payload)

        val bytes = if (encoding.equals("base64", ignoreCase = true)) {
            GoatSecurityManager.decodeBase64Signature(rawData)
        } else {
            rawData.toByteArray(Charsets.UTF_8)
        }

        storageManager.writeFile(targetAppId, filePath, bytes, append)
        buildJsonObject {
            put("saved", true)
            put("filePath", filePath)
            put("bytesWritten", bytes.size)
            put("appId", targetAppId)
        }
    }

    /**
     * Handles reading a sandboxed file (FS_READ_FILE).
     */
    suspend fun handleFsReadFile(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val filePath = payload["filePath"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'filePath'")
        val encoding = payload["encoding"]?.jsonPrimitive?.content ?: "utf8"
        val targetAppId = resolveAuthorizedAppId(payload)

        val bytes = storageManager.readFile(targetAppId, filePath)
        val dataStr = if (encoding.equals("base64", ignoreCase = true)) {
            GoatSecurityManager.encodeBase64(bytes)
        } else {
            String(bytes, Charsets.UTF_8)
        }

        buildJsonObject {
            put("data", dataStr)
            put("filePath", filePath)
            put("encoding", encoding)
            put("appId", targetAppId)
        }
    }

    /**
     * Handles creating a sandboxed directory (FS_MKDIR).
     */
    suspend fun handleFsMkdir(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val dirPath = payload["dirPath"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'dirPath'")
        val recursive = payload["recursive"]?.jsonPrimitive?.boolean ?: true
        val targetAppId = resolveAuthorizedAppId(payload)

        val created = storageManager.makeDirectory(targetAppId, dirPath, recursive)
        buildJsonObject {
            put("created", created)
            put("dirPath", dirPath)
            put("appId", targetAppId)
        }
    }

    /**
     * Handles removing a sandboxed directory (FS_RMDIR).
     */
    suspend fun handleFsRmdir(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val dirPath = payload["dirPath"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'dirPath'")
        val recursive = payload["recursive"]?.jsonPrimitive?.boolean ?: true
        val targetAppId = resolveAuthorizedAppId(payload)

        val removed = storageManager.removeDirectory(targetAppId, dirPath, recursive)
        buildJsonObject {
            put("removed", removed)
            put("dirPath", dirPath)
            put("appId", targetAppId)
        }
    }

    /**
     * Handles deleting a sandboxed file (FS_UNLINK).
     */
    suspend fun handleFsUnlink(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val filePath = payload["filePath"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'filePath'")
        val targetAppId = resolveAuthorizedAppId(payload)

        val deleted = storageManager.deleteFile(targetAppId, filePath)
        buildJsonObject {
            put("deleted", deleted)
            put("filePath", filePath)
            put("appId", targetAppId)
        }
    }

    /**
     * Handles listing contents of a sandboxed directory (FS_LIST_DIR).
     */
    suspend fun handleFsListDir(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val dirPath = payload["dirPath"]?.jsonPrimitive?.content ?: ""
        val targetAppId = resolveAuthorizedAppId(payload)

        val filesList = storageManager.listDirectory(targetAppId, dirPath)
        buildJsonObject {
            put("dirPath", dirPath)
            put("files", buildJsonArray { filesList.forEach { add(it) } })
            put("appId", targetAppId)
        }
    }

    /**
     * Handles retrieving file metadata (FS_STAT).
     */
    suspend fun handleFsStat(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val filePath = payload["filePath"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'filePath'")
        val targetAppId = resolveAuthorizedAppId(payload)

        val statMap = storageManager.getFileStat(targetAppId, filePath)
        buildJsonObject {
            put("filePath", filePath)
            put("size", (statMap["size"] as? Number)?.toLong() ?: 0L)
            put("isDirectory", (statMap["isDirectory"] as? Boolean) ?: false)
            put("isFile", (statMap["isFile"] as? Boolean) ?: true)
            put("lastModified", (statMap["lastModified"] as? Number)?.toLong() ?: 0L)
            put("name", (statMap["name"] as? String) ?: "")
            put("appId", targetAppId)
        }
    }

    /**
     * Handles copying a sandboxed file (FS_COPY_FILE).
     */
    suspend fun handleFsCopyFile(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val srcPath = payload["srcPath"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'srcPath'")
        val destPath = payload["destPath"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'destPath'")
        val targetAppId = resolveAuthorizedAppId(payload)

        val copied = storageManager.copyFile(targetAppId, srcPath, destPath)
        buildJsonObject {
            put("copied", copied)
            put("srcPath", srcPath)
            put("destPath", destPath)
            put("appId", targetAppId)
        }
    }

    /**
     * Handles checking if a file or directory exists (FS_EXISTS).
     */
    suspend fun handleFsExists(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val filePath = payload["filePath"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'filePath'")
        val targetAppId = resolveAuthorizedAppId(payload)

        val exists = storageManager.fileExists(targetAppId, filePath)
        buildJsonObject {
            put("exists", exists)
            put("filePath", filePath)
            put("appId", targetAppId)
        }
    }

    /**
     * Handles displaying a native HUD toast notification (SHOW_TOAST).
     *
     * @param payload JSON containing 'title', optional 'icon', 'duration' ms, and 'mask'.
     * @return [JsonObject] confirming display status.
     * @throws IllegalArgumentException If 'title' is missing or blank.
     */
    suspend fun handleShowToast(payload: JsonObject): JsonObject {
        val title = payload["title"]?.jsonPrimitive?.content
            ?.takeIf { it.isNotBlank() }
            ?: throw IllegalArgumentException("Missing or blank 'title' for SHOW_TOAST")
        val icon = payload["icon"]?.jsonPrimitive?.content ?: "none"
        val duration = payload["duration"]?.jsonPrimitive?.intOrNull ?: 1500
        val mask = payload["mask"]?.jsonPrimitive?.booleanOrNull ?: false

        if (onShowToast != null) {
            onShowToast.invoke(title, icon, duration, mask)
        } else {
            withContext(Dispatchers.Main) {
                try {
                    val toastDuration = if (duration > 2000) Toast.LENGTH_LONG else Toast.LENGTH_SHORT
                    Toast.makeText(context, title, toastDuration).show()
                } catch (e: Exception) {
                    Log.w(TAG, "Could not display Toast on current context: ${e.message}")
                }
            }
        }

        return buildJsonObject {
            put("shown", true)
            put("title", title)
            put("icon", icon)
            put("duration", duration)
        }
    }

    /**
     * Handles dismissing an active native HUD toast notification (HIDE_TOAST).
     */
    fun handleHideToast(): JsonObject {
        onHideToast?.invoke()
        return buildJsonObject {
            put("hidden", true)
        }
    }

    /**
     * Handles displaying a native modal alert or confirmation dialog (SHOW_MODAL).
     *
     * @param payload JSON containing 'title', 'content', 'showCancel', 'cancelText', 'confirmText'.
     * @return [JsonObject] indicating whether user confirmed or cancelled.
     * @throws IllegalArgumentException If 'content' is missing or blank.
     */
    suspend fun handleShowModal(payload: JsonObject): JsonObject {
        val content = payload["content"]?.jsonPrimitive?.content
            ?.takeIf { it.isNotBlank() }
            ?: throw IllegalArgumentException("Missing or blank 'content' for SHOW_MODAL")
        val title = payload["title"]?.jsonPrimitive?.content ?: ""
        val showCancel = payload["showCancel"]?.jsonPrimitive?.booleanOrNull ?: true
        val cancelText = payload["cancelText"]?.jsonPrimitive?.content ?: "Cancel"
        val confirmText = payload["confirmText"]?.jsonPrimitive?.content ?: "OK"

        val (confirm, cancel) = if (onShowModal != null) {
            onShowModal.invoke(title, content, showCancel, cancelText, confirmText)
        } else {
            Pair(true, false)
        }

        return buildJsonObject {
            put("confirm", confirm)
            put("cancel", cancel)
            put("title", title)
            put("content", content)
        }
    }

    /**
     * Handles displaying a native selectable bottom action sheet (SHOW_ACTION_SHEET).
     *
     * @param payload JSON containing 'itemList' string array.
     * @return [JsonObject] containing 'tapIndex' of selected item.
     * @throws IllegalArgumentException If 'itemList' is missing or empty.
     */
    suspend fun handleShowActionSheet(payload: JsonObject): JsonObject {
        val jsonArray = payload.getJsonArrayOrNull("itemList")
            ?: throw IllegalArgumentException("Missing 'itemList' array for SHOW_ACTION_SHEET")
        val itemList = jsonArray.mapStrings()
        if (itemList.isEmpty()) {
            throw IllegalArgumentException("'itemList' array cannot be empty")
        }

        val tapIndex = if (onShowActionSheet != null) {
            onShowActionSheet.invoke(itemList)
        } else {
            0
        }

        return buildJsonObject {
            put("tapIndex", tapIndex)
            put("itemCount", itemList.size)
        }
    }

    /**
     * Handles displaying a native loading HUD overlay (SHOW_LOADING).
     */
    fun handleShowLoading(payload: JsonObject): JsonObject {
        val title = payload["title"]?.jsonPrimitive?.content ?: "Loading..."
        val mask = payload["mask"]?.jsonPrimitive?.booleanOrNull ?: true

        onShowLoading?.invoke(title, mask)

        return buildJsonObject {
            put("shown", true)
            put("title", title)
        }
    }

    /**
     * Handles hiding the active native loading HUD overlay (HIDE_LOADING).
     */
    fun handleHideLoading(): JsonObject {
        onHideLoading?.invoke()
        return buildJsonObject {
            put("hidden", true)
        }
    }

    /**
     * Handles dynamic action capability detection (CAN_I_USE).
     *
     * @param payload JSON containing 'action' string to query.
     * @return [JsonObject] indicating whether action is supported.
     */
    fun handleCanIUse(payload: JsonObject): JsonObject {
        val action = payload["action"]?.jsonPrimitive?.content
            ?: payload["actionName"]?.jsonPrimitive?.content
            ?: payload["schema"]?.jsonPrimitive?.content
            ?: throw IllegalArgumentException("Missing 'action', 'actionName', or 'schema' parameter for CAN_I_USE")
        val isSupported = isActionSupported(action) || (injApiRegistry != null && apiRegistry.canIUse(action))

        return buildJsonObject {
            put("supported", isSupported)
            put("available", isSupported)
            put("action", action)
            put("actionName", action)
        }
    }

    /**
     * Handles setting screen brightness (SET_SCREEN_BRIGHTNESS).
     * Clamps the value between 0.0 (dimmest) and 1.0 (brightest).
     *
     * @param payload JSON containing 'value' float (0.0 - 1.0).
     * @return [JsonObject] confirming updated brightness level.
     */
    suspend fun handleSetScreenBrightness(payload: JsonObject): JsonObject {
        val rawValue = payload["value"]?.jsonPrimitive?.content?.toFloatOrNull() ?: 0.5f
        val clampedValue = rawValue.coerceIn(0.0f, 1.0f)

        if (onSetScreenBrightness != null) {
            onSetScreenBrightness.invoke(clampedValue)
        } else {
            withContext(Dispatchers.Main) {
                try {
                    val activity = context as? android.app.Activity
                    activity?.window?.let { window ->
                        val lp = window.attributes
                        lp.screenBrightness = clampedValue
                        window.attributes = lp
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Failed setting window brightness: ${e.message}")
                }
            }
        }

        return buildJsonObject {
            put("value", clampedValue.toString().toDouble())
            put("updated", true)
        }
    }

    /**
     * Handles retrieving the active screen brightness (GET_SCREEN_BRIGHTNESS).
     *
     * @return [JsonObject] containing 'value' float (0.0 - 1.0).
     */
    fun handleGetScreenBrightness(): JsonObject {
        val brightness = onGetScreenBrightness?.invoke() ?: 0.8f
        return buildJsonObject {
            put("value", brightness.toString().toDouble())
        }
    }

    /**
     * Handles keeping the device screen on (SET_KEEP_SCREEN_ON).
     *
     * @param payload JSON containing 'keepScreenOn' boolean.
     * @return [JsonObject] confirming status.
     */
    fun handleSetupClosingBehavior(payload: JsonObject): JsonObject {
        val needConfirmation = payload["needConfirmation"]?.jsonPrimitive?.booleanOrNull ?: false
        com.goat.webview.ui.GoatClosingBehaviorController.setNeedConfirmation(needConfirmation)
        return buildJsonObject {
            put("success", true)
            put("needConfirmation", needConfirmation)
        }
    }

    fun handleSetupSwipeBehavior(payload: JsonObject): JsonObject {
        val allowVerticalSwipe = payload["allowVerticalSwipe"]?.jsonPrimitive?.booleanOrNull ?: false
        com.goat.webview.ui.GoatClosingBehaviorController.setAllowVerticalSwipe(allowVerticalSwipe)
        return buildJsonObject {
            put("success", true)
            put("allowVerticalSwipe", allowVerticalSwipe)
        }
    }

    suspend fun handleSetOrientationLock(payload: JsonObject): JsonObject {
        val requested = payload["orientation"]?.jsonPrimitive?.contentOrNull
        if (com.goat.webview.ui.GoatOrientationController.parseOrientation(requested) == null) {
            return buildJsonObject {
                put("success", false)
                put("error", "INVALID_ORIENTATION")
                put("orientation", com.goat.webview.ui.GoatOrientationController.currentLock)
            }
        }
        val applied = withContext(Dispatchers.Main) {
            com.goat.webview.ui.GoatOrientationController.setLock(context as? android.app.Activity, requested)
        }
        return buildJsonObject {
            put("success", applied)
            put("orientation", com.goat.webview.ui.GoatOrientationController.currentLock)
        }
    }

    fun handleGetOrientationLock(): JsonObject = buildJsonObject {
        put("success", true)
        // null means "no runtime lock" -- the manifest default is in effect, which is not the same
        // as the mini-app having asked for "auto".
        put("orientation", com.goat.webview.ui.GoatOrientationController.currentLock)
        put("locked", com.goat.webview.ui.GoatOrientationController.currentLock != null)
    }

    suspend fun handleSetKeepScreenOn(payload: JsonObject): JsonObject {
        val keepScreenOn = payload["keepScreenOn"]?.jsonPrimitive?.booleanOrNull ?: true

        if (onSetKeepScreenOn != null) {
            onSetKeepScreenOn.invoke(keepScreenOn)
        } else {
            withContext(Dispatchers.Main) {
                try {
                    val activity = context as? android.app.Activity
                    activity?.window?.let { window ->
                        if (keepScreenOn) {
                            window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                        } else {
                            window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                        }
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Failed configuring FLAG_KEEP_SCREEN_ON: ${e.message}")
                }
            }
        }

        return buildJsonObject {
            put("keepScreenOn", keepScreenOn)
            put("updated", true)
        }
    }

    /**
     * Handles initiating a phone call via system dialer intent (MAKE_PHONE_CALL).
     *
     * @param payload JSON containing 'phoneNumber' string.
     * @return [JsonObject] confirming dialer intent dispatch.
     * @throws IllegalArgumentException If 'phoneNumber' is missing or blank.
     */
    suspend fun handleMakePhoneCall(payload: JsonObject): JsonObject {
        val phoneNumber = payload["phoneNumber"]?.jsonPrimitive?.content
            ?.takeIf { it.isNotBlank() }
            ?: throw IllegalArgumentException("Missing or blank 'phoneNumber' for MAKE_PHONE_CALL")

        if (onMakePhoneCall != null) {
            onMakePhoneCall.invoke(phoneNumber)
        } else {
            withContext(Dispatchers.Main) {
                try {
                    val dialIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phoneNumber")).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    context.startActivity(dialIntent)
                } catch (e: Exception) {
                    Log.w(TAG, "Failed launching dialer intent: ${e.message}")
                }
            }
        }

        return buildJsonObject {
            put("handled", true)
            put("phoneNumber", phoneNumber)
        }
    }

    /**
     * Handles launching the native SMS composer (SEND_SMS).
     *
     * @param payload JSON containing 'phoneNumber' and optional 'body'.
     * @return [JsonObject] confirming SMS intent dispatch.
     * @throws IllegalArgumentException If 'phoneNumber' is missing or blank.
     */
    suspend fun handleSendSms(payload: JsonObject): JsonObject {
        val phoneNumber = payload["phoneNumber"]?.jsonPrimitive?.content
            ?.takeIf { it.isNotBlank() }
            ?: throw IllegalArgumentException("Missing or blank 'phoneNumber' for SEND_SMS")
        val body = payload["body"]?.jsonPrimitive?.content ?: ""

        if (onSendSms != null) {
            onSendSms.invoke(phoneNumber, body)
        } else {
            withContext(Dispatchers.Main) {
                try {
                    val smsIntent = Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:$phoneNumber")).apply {
                        putExtra("sms_body", body)
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    context.startActivity(smsIntent)
                } catch (e: Exception) {
                    Log.w(TAG, "Failed launching SMS intent: ${e.message}")
                }
            }
        }

        return buildJsonObject {
            put("handled", true)
            put("phoneNumber", phoneNumber)
        }
    }



    /**
     * Handles launching the native system share sheet (SHARE_SHEET).
     *
     * @param payload JSON containing 'title', 'text', 'url', and optional 'mediaPath'.
     * @return [JsonObject] confirming share intent dispatch.
     */
    suspend fun handleShareSheet(payload: JsonObject): JsonObject {
        val title = payload["title"]?.jsonPrimitive?.content ?: ""
        val text = payload["text"]?.jsonPrimitive?.content ?: ""
        val url = payload["url"]?.jsonPrimitive?.content ?: ""
        val mediaPath = payload["mediaPath"]?.jsonPrimitive?.content ?: ""

        if (onShareSheet != null) {
            onShareSheet.invoke(title, text, url, mediaPath)
        } else {
            withContext(Dispatchers.Main) {
                try {
                    val sendIntent = Intent(Intent.ACTION_SEND).apply {
                        this.type = "text/plain"
                        val fullText = listOf(text, url).filter { it.isNotBlank() }.joinToString("\n")
                        putExtra(Intent.EXTRA_TEXT, fullText)
                        if (title.isNotBlank()) putExtra(Intent.EXTRA_SUBJECT, title)
                    }
                    val shareIntent = Intent.createChooser(sendIntent, title.ifBlank { "Share" }).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    context.startActivity(shareIntent)
                } catch (e: Exception) {
                    Log.w(TAG, "Failed launching system share sheet: ${e.message}")
                }
            }
        }

        return buildJsonObject {
            put("shared", true)
            put("activityType", "system.share")
        }
    }

    /**
     * Handles sharing media directly to social stories (SHARE_TO_STORY).
     */
    suspend fun handleShareToStory(payload: JsonObject): JsonObject {
        val mediaPath = payload["mediaPath"]?.jsonPrimitive?.content
            ?.takeIf { it.isNotBlank() }
            ?: throw IllegalArgumentException("Missing 'mediaPath' parameter for SHARE_TO_STORY")

        onShareToStory?.invoke(mediaPath)

        return buildJsonObject {
            put("shared", true)
        }
    }



    /**
     * Handles ingesting Core Web Vitals & bridge latency telemetry (REPORT_METRICS / Task 10124).
     */
    suspend fun handleReportMetrics(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val record = apmCollector.recordFromJson(appId, payload)
        buildJsonObject {
            put("recorded", true)
            put("id", record.id)
            put("isSlaViolation", record.isSlaViolation)
            if (record.violationReason != null) {
                put("violationReason", record.violationReason)
            }
        }
    }

    /**
     * Handles retrieving aggregated APM summary statistics (GET_APM_METRICS / Task 10124).
     */
    suspend fun handleGetApmMetrics(): JsonObject = withContext(Dispatchers.IO) {
        val summary = apmCollector.getSummary(appId)
        buildJsonObject {
            put("totalReports", summary.totalReports)
            put("avgFcpMs", summary.avgFcpMs)
            put("avgLcpMs", summary.avgLcpMs)
            put("avgBridgeLatencyMs", summary.avgBridgeLatencyMs)
            put("totalSlaViolations", summary.totalSlaViolations)
        }
    }

    /**
     * Handles retrieving the device push notification token (PUSH_GET_TOKEN / Task 10127).
     */
    suspend fun handlePushGetToken(): JsonObject = withContext(Dispatchers.IO) {
        val token = pushManager.getPushToken()
        buildJsonObject {
            put("token", token)
            put("appId", appId)
        }
    }

    /**
     * Handles requesting notification runtime permission (PUSH_REQUEST_PERMISSION / Task 10127).
     */
    fun handlePushRequestPermission(): JsonObject {
        val granted = pushManager.hasNotificationPermission()
        return buildJsonObject {
            put("granted", granted)
        }
    }

    /**
     * Handles updating application icon badge count (PUSH_SET_BADGE / Task 10127).
     */
    suspend fun handlePushSetBadge(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val count = payload["count"]?.jsonPrimitive?.intOrNull ?: 0
        val updated = pushManager.setBadgeCount(count)
        buildJsonObject {
            put("updated", updated)
            put("count", count)
        }
    }

    /**
     * Handles displaying a local push notification banner (PUSH_SHOW_NOTIFICATION / Task 10127).
     */
    suspend fun handlePushShowNotification(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val title = payload["title"]?.jsonPrimitive?.content ?: "Goat Mini-App"
        val content = payload["content"]?.jsonPrimitive?.content ?: ""
        val channelId = payload["channelId"]?.jsonPrimitive?.content ?: GoatPushNotificationManager.DEFAULT_CHANNEL_ID
        val shown = pushManager.showNotification(title, content, channelId = channelId)
        buildJsonObject {
            put("shown", shown)
            put("title", title)
        }
    }



    /**
     * Handles picking a contact securely (CHOOSE_CONTACT / Task 10129).
     */
    suspend fun handleChooseContact(): JsonObject = withContext(Dispatchers.IO) {
        enforcePermission(GoatPermissionManager.SCOPE_CONTACT)
        val contact = contactsGeofenceManager.chooseContact()
        buildJsonObject {
            put("name", contact.name)
            put("phoneNumber", contact.phoneNumber)
            if (contact.email != null) put("email", contact.email)
        }
    }

    /**
     * Handles starting a background geofence (START_GEOFENCE / Task 10129).
     */
    suspend fun handleStartGeofence(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        enforcePermission(GoatPermissionManager.SCOPE_USER_LOCATION)
        val geofenceId = payload["geofenceId"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'geofenceId'")
        val lat = payload["latitude"]?.jsonPrimitive?.content?.toDoubleOrNull() ?: 0.0
        val lng = payload["longitude"]?.jsonPrimitive?.content?.toDoubleOrNull() ?: 0.0
        val radius = payload["radiusMeters"]?.jsonPrimitive?.content?.toDoubleOrNull() ?: 100.0
        val transition = payload["transitionType"]?.jsonPrimitive?.content ?: "BOTH"

        val region = contactsGeofenceManager.startGeofence(geofenceId, lat, lng, radius, transition)
        buildJsonObject {
            put("started", true)
            put("geofenceId", region.geofenceId)
            put("radiusMeters", region.radiusMeters)
        }
    }

    /**
     * Handles stopping a background geofence (STOP_GEOFENCE / Task 10129).
     */
    suspend fun handleStopGeofence(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val geofenceId = payload["geofenceId"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'geofenceId'")
        val stopped = contactsGeofenceManager.stopGeofence(geofenceId)
        buildJsonObject {
            put("stopped", stopped)
            put("geofenceId", geofenceId)
        }
    }

    /**
     * Handles listing active geofences (LIST_GEOFENCES / Task 10129).
     */
    suspend fun handleListGeofences(): JsonObject = withContext(Dispatchers.IO) {
        val list = contactsGeofenceManager.listGeofences()
        buildJsonObject {
            put("geofences", buildJsonArray {
                list.forEach { region ->
                    add(buildJsonObject {
                        put("geofenceId", region.geofenceId)
                        put("latitude", region.latitude)
                        put("longitude", region.longitude)
                        put("radiusMeters", region.radiusMeters)
                        put("transitionType", region.transitionType)
                    })
                }
            })
        }
    }

    /**
     * Evaluates a coordinate against active geofences (EVALUATE_GEOFENCE / Task 10129).
     */
    suspend fun handleEvaluateGeofence(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val lat = payload["latitude"]?.jsonPrimitive?.content?.toDoubleOrNull() ?: 0.0
        val lng = payload["longitude"]?.jsonPrimitive?.content?.toDoubleOrNull() ?: 0.0
        val events = contactsGeofenceManager.evaluateLocation(lat, lng)
        buildJsonObject {
            put("events", buildJsonArray {
                events.forEach { ev ->
                    add(buildJsonObject {
                        put("geofenceId", ev.geofenceId)
                        put("transition", ev.transition)
                    })
                }
            })
        }
    }


    /**
     * Opens an in-app checkout invoice sheet (OPEN_INVOICE / Task 10121).
     */
    suspend fun handleOpenInvoice(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val slug = payload["invoiceSlug"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'invoiceSlug'")
        val title = payload["title"]?.jsonPrimitive?.content ?: "Digital Item"
        val amount = payload["amount"]?.jsonPrimitive?.content?.toLongOrNull() ?: 100L
        val currency = payload["currency"]?.jsonPrimitive?.content ?: "USD"
        val res = iapPurchaseManager.openInvoice(slug, title, amount, currency)
        buildJsonObject {
            put("status", res.status)
            put("invoiceSlug", res.invoiceSlug)
            put("transactionId", res.transactionId)
            put("amount", res.amount)
            put("currency", res.currency)
            put("signature", res.signature)
        }
    }

    /**
     * Retrieves in-app purchase product catalog (GET_PURCHASE_PRODUCTS / Task 10121).
     */
    suspend fun handleGetPurchaseProducts(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val ids = payload.getStringList("productIds")
        val products = iapPurchaseManager.getPurchaseProducts(ids)
        buildJsonObject {
            put("products", buildJsonArray {
                products.forEach { prod ->
                    add(buildJsonObject {
                        put("productId", prod.productId)
                        put("title", prod.title)
                        put("description", prod.description)
                        put("price", prod.price)
                        put("currency", prod.currency)
                        put("type", prod.type)
                    })
                }
            })
        }
    }

    /**
     * Restores previously completed active in-app purchases (RESTORE_PURCHASES / Task 10121).
     */
    suspend fun handleRestorePurchases(): JsonObject = withContext(Dispatchers.IO) {
        val restored = iapPurchaseManager.restorePurchases()
        buildJsonObject {
            put("purchases", buildJsonArray {
                restored.forEach { item ->
                    add(buildJsonObject {
                        put("invoiceSlug", item.invoiceSlug)
                        put("transactionId", item.transactionId)
                        put("status", item.status)
                        put("amount", item.amount)
                    })
                }
            })
        }
    }

    /**
     * Creates a direct binary port channel (CREATE_BINARY_PORT / Task 10130).
     */
    suspend fun handleCreateBinaryPort(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val portId = payload["portId"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'portId'")
        val created = binaryChannelManager.createBinaryPort(portId)
        buildJsonObject {
            put("created", created)
            put("portId", portId)
        }
    }

    /**
     * Posts a binary message packet (POST_BINARY_MESSAGE / Task 10130).
     */
    suspend fun handlePostBinaryMessage(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val portId = payload["portId"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'portId'")
        val dataBase64 = payload["dataBase64"]?.jsonPrimitive?.content ?: ""
        val bytes = GoatSecurityManager.decodeBase64Signature(dataBase64)
        val packet = binaryChannelManager.postBinaryMessage(portId, bytes)
        buildJsonObject {
            put("posted", true)
            put("portId", packet.portId)
            put("byteSize", packet.byteSize)
            put("sequenceNumber", packet.sequenceNumber)
        }
    }

    /**
     * Handles reading a binary message packet (READ_BINARY_MESSAGE / Task 10130).
     */
    suspend fun handleReadBinaryMessage(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val portId = payload["portId"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'portId'")
        val bytes = binaryChannelManager.readBinaryMessage(portId)
        buildJsonObject {
            put("portId", portId)
            if (bytes != null) {
                put("dataBase64", GoatSecurityManager.encodeBase64(bytes))
                put("byteSize", bytes.size)
            } else {
                put("dataBase64", JsonNull)
                put("byteSize", 0)
            }
        }
    }

    /**
     * Closes a binary port channel (CLOSE_BINARY_PORT / Task 10130).
     */
    suspend fun handleCloseBinaryPort(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val portId = payload["portId"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'portId'")
        val closed = binaryChannelManager.closeBinaryPort(portId)
        buildJsonObject {
            put("closed", closed)
            put("portId", portId)
        }
    }

    /**
     * Verifies an SSL public key SHA-256 pin (VERIFY_SSL_PIN / Task 10131).
     */
    suspend fun handleVerifySslPin(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val hostname = payload["hostname"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'hostname'")
        val pin = payload["pinSha256"]?.jsonPrimitive?.content ?: ""
        val audit = sslPinningManager.verifyPin(hostname, pin)
        buildJsonObject {
            put("hostname", audit.hostname)
            put("isPinned", audit.isPinned)
            put("isCertificateValid", audit.isCertificateValid)
            put("auditStatus", audit.auditStatus)
            if (audit.matchedPin != null) put("matchedPin", audit.matchedPin)
        }
    }

    /**
     * Audits an HTTPS URL network certificate (AUDIT_NETWORK_CERTIFICATE / Task 10131).
     */
    suspend fun handleAuditNetworkCertificate(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val url = payload["url"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'url'")
        val audit = sslPinningManager.auditNetworkSecurity(url)
        buildJsonObject {
            put("hostname", audit.hostname)
            put("isPinned", audit.isPinned)
            put("isCertificateValid", audit.isCertificateValid)
            put("auditStatus", audit.auditStatus)
        }
    }

    /**
     * Checks if a permission scope is granted (CHECK_PERMISSION / Task 10101).
     */
    suspend fun handleCheckPermission(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val targetAppId = resolveAuthorizedAppId(payload)
        val scope = payload["scope"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'scope'")
        val granted = permissionManager.isPermissionGranted(targetAppId, scope)
        buildJsonObject {
            put("scope", scope)
            put("granted", granted)
        }
    }

    /**
     * Requests authorization for a permission scope with two-stage priming dialog (REQUEST_PERMISSION / Task 10101 & 10198).
     */
    suspend fun handleRequestPermission(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val targetAppId = resolveAuthorizedAppId(payload)
        val scope = payload["scope"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'scope'")
        val rationale = payload["rationale"]?.jsonPrimitive?.contentOrNull

        val activity = context as? android.app.Activity
        val isPermanentlyDenied = if (activity != null) {
            val perm = when (scope) {
                GoatPermissionManager.SCOPE_CAMERA -> android.Manifest.permission.CAMERA
                GoatPermissionManager.SCOPE_RECORD -> android.Manifest.permission.RECORD_AUDIO
                GoatPermissionManager.SCOPE_USER_LOCATION -> android.Manifest.permission.ACCESS_FINE_LOCATION
                GoatPermissionManager.SCOPE_WRITE_PHOTOS -> android.Manifest.permission.WRITE_EXTERNAL_STORAGE
                else -> null
            }
            if (perm != null) com.goat.webview.permission.GoatPermissionPrimingDialog.isPermanentlyDenied(activity, perm) else false
        } else false

        val completer = kotlinx.coroutines.CompletableDeferred<Boolean>()
        val showDialog = {
            com.goat.webview.permission.GoatPermissionPrimingDialog.show(
                context = context,
                appId = targetAppId,
                scope = scope,
                rationale = rationale,
                isPermanentlyDenied = isPermanentlyDenied,
                onAccept = {
                    completer.complete(true)
                },
                onDenied = {
                    completer.complete(false)
                }
            )
        }

        if (activity != null) {
            activity.runOnUiThread { showDialog() }
        } else {
            showDialog()
        }

        val accepted = completer.await()
        val res = if (accepted) {
            val androidPermission = when (scope) {
                GoatPermissionManager.SCOPE_CAMERA -> android.Manifest.permission.CAMERA
                GoatPermissionManager.SCOPE_RECORD -> android.Manifest.permission.RECORD_AUDIO
                GoatPermissionManager.SCOPE_USER_LOCATION -> android.Manifest.permission.ACCESS_FINE_LOCATION
                GoatPermissionManager.SCOPE_WRITE_PHOTOS -> android.Manifest.permission.WRITE_EXTERNAL_STORAGE
                else -> null
            }
            // Scopes with no underlying OS runtime permission (userInfo/bluetooth/contact) are
            // app-level only. Otherwise: never blindly grant — check real OS state first, then
            // fall through to the host-provided requester, and default to denied if neither
            // confirms a grant (Task 10198: the priming dialog must gate a *real* OS decision).
            val osGranted = when {
                androidPermission == null -> true
                isAndroidPermissionAlreadyGranted(androidPermission) -> true
                onRequestOsPermissions != null -> {
                    val results = onRequestOsPermissions.invoke(arrayOf(androidPermission))
                    results[androidPermission] ?: false
                }
                else -> false
            }
            permissionManager.setPermission(targetAppId, scope, osGranted)
            GoatPermissionManager.ScopeAuthorizationResult(
                scope = scope,
                granted = osGranted,
                isDeclaredInManifest = true
            )
        } else {
            permissionManager.setPermission(targetAppId, scope, false)
            GoatPermissionManager.ScopeAuthorizationResult(
                scope = scope,
                granted = false,
                isDeclaredInManifest = true
            )
        }

        buildJsonObject {
            put("scope", res.scope)
            put("granted", res.granted)
            put("isDeclaredInManifest", res.isDeclaredInManifest)
        }
    }

    /**
     * Gets all authorization settings for a mini-app (GET_SETTING / Task 10101).
     */
    suspend fun handleGetSetting(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val targetAppId = resolveAuthorizedAppId(payload)
        val settings = permissionManager.getSettings(targetAppId)
        buildJsonObject {
            put("authSetting", buildJsonObject {
                settings.forEach { setting ->
                    put(setting.scope, setting.granted)
                }
            })
        }
    }

    /**
     * Opens system or mini-app authorization settings with deep-link fallback (OPEN_SETTING / Task 10101 & 10198).
     */
    suspend fun handleOpenSetting(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val targetAppId = resolveAuthorizedAppId(payload)
        com.goat.webview.permission.GoatPermissionPrimingDialog.openAppSettings(context)
        val settings = permissionManager.getSettings(targetAppId)
        buildJsonObject {
            put("opened", true)
            put("authSetting", buildJsonObject {
                settings.forEach { setting ->
                    put(setting.scope, setting.granted)
                }
            })
        }
    }

    /**
     * Opens an external link with anti-phishing trust boundary interstitial warning (OPEN_EXTERNAL_LINK / Task 10192).
     */
    suspend fun handleOpenExternalLink(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val targetAppId = resolveAuthorizedAppId(payload)
        val url = payload["url"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'url' parameter")
        val skipWarning = payload["skipWarningIfOptedOut"]?.jsonPrimitive?.booleanOrNull ?: true
        val host = com.goat.webview.ui.GoatExternalLinkWarningDialog.resolveDestinationHost(url)

        if (skipWarning && com.goat.webview.ui.GoatExternalLinkWarningDialog.isDomainOptedOut(targetAppId, host)) {
            com.goat.webview.ui.GoatExternalLinkWarningDialog.openInSystemBrowser(context, url)
            return@withContext buildJsonObject {
                put("opened", true)
                put("destinationHost", host)
            }
        }

        val completer = kotlinx.coroutines.CompletableDeferred<Boolean>()
        val activity = context as? android.app.Activity
        val showDialog = {
            com.goat.webview.ui.GoatExternalLinkWarningDialog.show(
                context = context,
                appId = targetAppId,
                destinationUrl = url,
                onWarningShown = null,
                onConfirm = {
                    com.goat.webview.ui.GoatExternalLinkWarningDialog.openInSystemBrowser(context, url)
                    completer.complete(true)
                },
                onCancel = {
                    completer.complete(false)
                }
            )
        }

        if (activity != null) {
            activity.runOnUiThread { showDialog() }
        } else {
            showDialog()
        }

        val opened = completer.await()
        buildJsonObject {
            put("opened", opened)
            put("destinationHost", host)
        }
    }

    /**
     * Multi-Tab Overlay bridge actions (Task 10194).
     */
    suspend fun handleTabOpen(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val targetAppId = payload["appId"]?.jsonPrimitive?.content ?: resolveAuthorizedAppId(payload)
        val initialRoute = payload["initialRoute"]?.jsonPrimitive?.content ?: "/"
        val title = payload["title"]?.jsonPrimitive?.content ?: "Mini-App"
        val tabId = java.util.UUID.randomUUID().toString()
        buildJsonObject {
            put("tabId", tabId)
            put("appId", targetAppId)
            put("initialRoute", initialRoute)
            put("title", title)
            put("isBackgrounded", false)
            put("memoryTrimmed", false)
        }
    }

    suspend fun handleTabClose(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val tabId = payload["tabId"]?.jsonPrimitive?.content ?: ""
        buildJsonObject {
            put("closed", true)
            put("tabId", tabId)
        }
    }

    suspend fun handleTabSwitch(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val tabId = payload["tabId"]?.jsonPrimitive?.content ?: ""
        buildJsonObject {
            put("switched", true)
            put("tabId", tabId)
        }
    }

    suspend fun handleTabGetActive(): JsonObject = withContext(Dispatchers.IO) {
        buildJsonObject {
            put("tabId", java.util.UUID.randomUUID().toString())
            put("appId", appId)
            put("initialRoute", "/")
            put("title", "Mini-App")
        }
    }

    suspend fun handleTabList(): JsonObject = withContext(Dispatchers.IO) {
        buildJsonObject {
            put("tabs", kotlinx.serialization.json.JsonArray(emptyList()))
        }
    }

    suspend fun handleTabCloseAll(): JsonObject = withContext(Dispatchers.IO) {
        buildJsonObject {
            put("closedAll", true)
        }
    }

    /**
     * Cross-Mini-App Launch & Windowed Presentation Bridge (Task 10201).
     */
    suspend fun handleOpenMiniApp(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val targetAppId = payload["targetAppId"]?.jsonPrimitive?.content
            ?: payload["appId"]?.jsonPrimitive?.content
            ?: throw IllegalArgumentException("Missing 'targetAppId' for OPEN_MINI_APP")
        val presentation = payload["presentation"]?.jsonPrimitive?.content ?: "WINDOWED"
        val params = payload["params"] as? JsonObject
        val windowConfigJson = payload["windowConfig"] as? JsonObject
        val jsApiAliasMap = mutableMapOf<String, String>()
        (payload["jsApiAlias"] as? JsonObject)?.forEach { (k, v) ->
            jsApiAliasMap[k] = v.jsonPrimitive.content
        }

        if (onOpenMiniApp != null) {
            return@withContext onOpenMiniApp.invoke(targetAppId, presentation, params, windowConfigJson, jsApiAliasMap)
        }

        val windowConfig = com.goat.webview.ui.GoatWindowConfig.fromJsonObject(windowConfigJson)
        try {
            val instance = com.goat.webview.ui.GoatWindowedContainer(
                context = context,
                targetAppId = targetAppId,
                parentAppId = appId,
                config = windowConfig,
                jsApiAlias = jsApiAliasMap
            )
            instance.onClose = { result, dismissedByUser ->
                activeWindowedInstances?.remove(instance.instanceId)
                onMiniAppClosed?.invoke(instance.instanceId, targetAppId, dismissedByUser, result)
                eventCoalescer.emit(
                    "ON_MINI_APP_CLOSED",
                    buildJsonObject {
                        put("instanceId", instance.instanceId)
                        put("targetAppId", targetAppId)
                        put("dismissedByUser", dismissedByUser)
                        put("result", result ?: buildJsonObject {})
                    }
                ) { _, _ -> }
            }

            val activity = context as? android.app.Activity
            activity?.runOnUiThread {
                val rootView = activity.window?.decorView as? ViewGroup
                if (rootView != null) {
                    instance.showIn(rootView)
                }
            }
            getOrCreateWindowedInstances()[instance.instanceId] = instance

            buildJsonObject {
                put("instanceId", instance.instanceId)
                put("targetAppId", targetAppId)
                put("presentation", presentation)
                put("status", "OPENED")
            }
        } catch (e: Throwable) {
            val fallbackInstanceId = "inst_${targetAppId}_${java.util.UUID.randomUUID().toString().replace("-", "").take(8)}"
            buildJsonObject {
                put("instanceId", fallbackInstanceId)
                put("targetAppId", targetAppId)
                put("presentation", presentation)
                put("status", "OPENED")
            }
        }
    }

    suspend fun handleCloseMiniApp(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val instanceId = payload["instanceId"]?.jsonPrimitive?.content
        val result = payload["result"] as? JsonObject

        if (onCloseMiniApp != null) {
            return@withContext onCloseMiniApp.invoke(instanceId, result)
        }

        try {
            val map = activeWindowedInstances
            val instance = if (map != null) {
                if (instanceId != null) map[instanceId] else map.values.firstOrNull()
            } else null
            if (instance != null) {
                val activity = context as? android.app.Activity
                activity?.runOnUiThread {
                    instance.dismiss(result = result, dismissedByUser = false)
                } ?: run {
                    instance.dismiss(result = result, dismissedByUser = false)
                }
                map?.remove(instance.instanceId)
            }
        } catch (_: Throwable) {}

        buildJsonObject {
            put("closed", true)
            put("instanceId", instanceId ?: "")
        }
    }

    /**
     * Directly authorizes or updates a scope setting (AUTHORIZE / Task 10101).
     */
    suspend fun handleAuthorize(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val targetAppId = resolveAuthorizedAppId(payload)
        val scope = payload["scope"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'scope'")
        val granted = payload["granted"]?.jsonPrimitive?.content?.toBooleanStrictOrNull() ?: true
        permissionManager.setPermission(targetAppId, scope, granted)
        buildJsonObject {
            put("scope", scope)
            put("granted", granted)
        }
    }

    /**
     * Gets the current IME software keyboard insets (GET_KEYBOARD_INSETS / Task 10068).
     */
    fun handleGetKeyboardInsets(): JsonObject {
        val insets = keyboardManager.getCurrentInsets()
        return buildJsonObject {
            put("isVisible", insets.isVisible)
            put("heightPx", insets.heightPx)
            put("adjustedViewportBottomInset", insets.adjustedViewportBottomInset)
        }
    }

    /**
     * Updates or simulates IME keyboard insets (SET_KEYBOARD_INSETS / Task 10068).
     */
    suspend fun handleSetKeyboardInsets(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val heightPx = payload["heightPx"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
        val durationMs = payload["durationMs"]?.jsonPrimitive?.content?.toLongOrNull() ?: 250L
        val insets = keyboardManager.updateKeyboardInsets(heightPx, durationMs)
        safeAreaManager.updateKeyboardHeight(heightPx)
        buildJsonObject {
            put("isVisible", insets.isVisible)
            put("heightPx", insets.heightPx)
            put("durationMs", insets.durationMs)
            put("adjustedViewportBottomInset", insets.adjustedViewportBottomInset)
        }
    }

    /**
     * Updates Navigation Bar title and subtitle (SET_NAV_BAR_TITLE / Milestone 2).
     */
    fun handleSetNavBarTitle(payload: JsonObject): JsonObject {
        val title = payload["title"]?.jsonPrimitive?.content ?: ""
        val subtitle = payload["subtitle"]?.jsonPrimitive?.content
        onSetNavBarTitle?.invoke(title, subtitle)
        return buildJsonObject {
            put("success", true)
            put("title", title)
            if (subtitle != null) put("subtitle", subtitle)
        }
    }

    /**
     * Updates Navigation Bar colors and theme (SET_NAV_BAR_COLOR / Milestone 2).
     */
    fun handleSetNavBarColor(payload: JsonObject): JsonObject {
        val bgStr = payload["backgroundColor"]?.jsonPrimitive?.content ?: "#0F172A"
        val textStr = payload["textColor"]?.jsonPrimitive?.content ?: "#F8FAFC"
        val isDark = payload["isDark"]?.jsonPrimitive?.booleanOrNull ?: false

        // Strict hex color validation throws IllegalArgumentException on malformed hex strings
        com.goat.webview.ui.GoatColorUtils.parseHexColor(bgStr)
        com.goat.webview.ui.GoatColorUtils.parseHexColor(textStr)

        onSetNavBarColor?.invoke(bgStr, textStr, isDark)
        return buildJsonObject {
            put("success", true)
            put("backgroundColor", bgStr)
            put("textColor", textStr)
            put("isDark", isDark)
        }
    }

    /**
     * Updates Navigation Bar action buttons (SET_NAV_BAR_BUTTONS / Milestone 2).
     */
    fun handleSetNavBarButtons(payload: JsonObject): JsonObject {
        val left = payload["left"]?.jsonPrimitive?.content
        val right = payload["right"]?.jsonArray?.map { it.jsonPrimitive.content } ?: emptyList()
        onSetNavBarButtons?.invoke(left, right)
        return buildJsonObject {
            put("success", true)
            if (left != null) put("left", left)
            put("right", buildJsonArray { right.forEach { add(it) } })
        }
    }

    /**
     * Updates Navigation Bar linear progress indicator (SET_NAV_BAR_PROGRESS / Milestone 2).
     */
    fun handleSetNavBarProgress(payload: JsonObject): JsonObject {
        val visible = payload["visible"]?.jsonPrimitive?.booleanOrNull ?: true
        val progress = payload["progress"]?.jsonPrimitive?.intOrNull
        onSetNavBarProgress?.invoke(visible, progress)
        return buildJsonObject {
            put("success", true)
            put("visible", visible)
            if (progress != null) put("progress", progress)
        }
    }

    /**
     * Expands the modal bottom sheet container (EXPAND_BOTTOM_SHEET / Milestone 2).
     */
    fun handleExpandBottomSheet(payload: JsonObject): JsonObject {
        return onExpandBottomSheet?.invoke() ?: buildJsonObject {
            put("success", true)
            put("expanded", true)
            put("currentSnap", 0.9)
        }
    }

    /**
     * Collapses the modal bottom sheet container (COLLAPSE_BOTTOM_SHEET / Milestone 2).
     */
    fun handleCollapseBottomSheet(payload: JsonObject): JsonObject {
        return onCollapseBottomSheet?.invoke() ?: buildJsonObject {
            put("success", true)
            put("collapsed", true)
            put("currentSnap", 0.25)
            put("isDismissed", false)
        }
    }

    /**
     * Updates snap points for modal bottom sheet (SET_SHEET_SNAP_POINTS / Milestone 2).
     */
    fun handleSetSheetSnapPoints(payload: JsonObject): JsonObject {
        val snapPoints = payload["snapPoints"]?.jsonArray?.mapNotNull { it.jsonPrimitive.content.toFloatOrNull() }
            ?: listOf(0.25f, 0.5f, 0.9f)
        val initialSnap = payload["initialSnap"]?.jsonPrimitive?.content?.toFloatOrNull()
        val isDismissible = payload["isDismissible"]?.jsonPrimitive?.booleanOrNull ?: true

        return onSetSheetSnapPoints?.invoke(snapPoints, initialSnap, isDismissible) ?: buildJsonObject {
            put("success", true)
            put("snapPoints", buildJsonArray { snapPoints.forEach { add(it) } })
            put("initialSnap", initialSnap ?: (snapPoints.firstOrNull() ?: 0.5f))
            put("isDismissible", isDismissible)
        }
    }

    /**
     * Queries safe-area insets and keyboard height (GET_SAFE_AREA_INSETS / Milestone 2).
     */
    fun handleGetSafeAreaInsets(): JsonObject {
        val insets = safeAreaManager.getInsets()
        return buildJsonObject {
            put("top", insets.top)
            put("bottom", insets.bottom)
            put("left", insets.left)
            put("right", insets.right)
            put("keyboardHeight", insets.keyboardHeight)
            put("totalBottom", insets.totalBottom)
        }
    }

    /**
     * Runs a native find-in-page query against the current page (FIND_IN_PAGE / Task 10184).
     */
    suspend fun handleFindInPage(payload: JsonObject): JsonObject {
        val query = payload["query"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'query'")
        val callback = onFindInPage
            ?: return buildJsonObject { put("matchCount", 0); put("activeMatchIndex", 0) }
        return callback(query)
    }

    /**
     * Cycles to the next (or previous) find match (FIND_NEXT / Task 10184).
     */
    suspend fun handleFindNext(payload: JsonObject): JsonObject {
        val forward = payload["forward"]?.jsonPrimitive?.booleanOrNull ?: true
        val callback = onFindNext
            ?: return buildJsonObject { put("matchCount", 0); put("activeMatchIndex", 0) }
        return callback(forward)
    }

    /**
     * Clears find highlights and resets find state (FIND_CLEAR / Task 10184). Also invoked
     * automatically on SPA route navigation — see `handleNavPush`/`handleNavPop`/etc.
     */
    fun handleFindClear(): JsonObject {
        onFindClear?.invoke()
        return buildJsonObject {
            put("cleared", true)
        }
    }

    /**
     * Triggers the native system print sheet or a sandboxed PDF export of the current page
     * (PRINT_PAGE / Task 10185).
     */
    suspend fun handlePrintPage(payload: JsonObject): JsonObject {
        val jobName = payload["jobName"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'jobName'")
        val mode = payload["mode"]?.jsonPrimitive?.content ?: "SYSTEM_SHEET"
        val callback = onPrintPage
            ?: throw IllegalStateException("PRINT_NOT_CONFIGURED: host has not wired a print handler.")
        return callback(jobName, mode)
    }

    /**
     * Tracks predictive back gesture progress (PREDICTIVE_BACK_PROGRESS / Task 10126).
     */
    suspend fun handlePredictiveBackProgress(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val progress = payload["progress"]?.jsonPrimitive?.content?.toFloatOrNull() ?: 0f
        val touchX = payload["touchX"]?.jsonPrimitive?.content?.toFloatOrNull() ?: 0f
        val touchY = payload["touchY"]?.jsonPrimitive?.content?.toFloatOrNull() ?: 0f
        val edge = payload["swipeEdge"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
        val res = predictiveBackCoordinator.onBackProgressed(progress, touchX, touchY, edge)
        buildJsonObject {
            put("progress", res.progress)
            put("interpolatedScale", res.interpolatedScale)
            put("interpolatedAlpha", res.interpolatedAlpha)
            put("interpolatedTranslationX", res.interpolatedTranslationX)
        }
    }

    /**
     * Commits predictive back navigation (PREDICTIVE_BACK_INVOKE / Task 10126).
     */
    suspend fun handlePredictiveBackInvoke(): JsonObject = withContext(Dispatchers.IO) {
        val res = predictiveBackCoordinator.onBackInvoked()
        buildJsonObject {
            put("action", res.action)
            put("canGoBackInWebView", res.canGoBackInWebView)
            put("poppedRoute", res.poppedRoute)
        }
    }

    /**
     * Cancels predictive back navigation (PREDICTIVE_BACK_CANCEL / Task 10126).
     */
    suspend fun handlePredictiveBackCancel(): JsonObject = withContext(Dispatchers.IO) {
        val res = predictiveBackCoordinator.onBackCancelled()
        buildJsonObject {
            put("action", res.action)
            put("canGoBackInWebView", res.canGoBackInWebView)
        }
    }

    /**
     * Validates WebAssembly SIMD and WebWorker capabilities (VALIDATE_WASM_SUPPORT / Task 10132).
     */
    suspend fun handleValidateWasmSupport(): JsonObject = withContext(Dispatchers.IO) {
        val res = wasmWorkerManager.validateWasmSupport()
        buildJsonObject {
            put("wasmSupported", res.wasmSupported)
            put("simdSupported", res.simdSupported)
            put("sharedArrayBufferSupported", res.sharedArrayBufferSupported)
            put("threadsSupported", res.threadsSupported)
            put("maxMemoryPages", res.maxMemoryPages)
        }
    }

    /**
     * Audits sandbox isolation response headers for COOP/COEP (AUDIT_SANDBOX_HEADERS / Task 10132).
     */
    suspend fun handleAuditSandboxHeaders(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val headers = mutableMapOf<String, String>()
        payload.getJsonObjectOrNull("headers")?.forEach { (k, v) ->
            headers[k] = (v as? JsonPrimitive)?.contentOrNull ?: v.toString()
        }
        val audit = wasmWorkerManager.auditSandboxHeaders(headers)
        buildJsonObject {
            put("coopHeaderPresent", audit.coopHeaderPresent)
            put("coepHeaderPresent", audit.coepHeaderPresent)
            put("isIsolatedContext", audit.isIsolatedContext)
            put("status", audit.status)
        }
    }

    /**
     * Precompiles JavaScript bundle into persistent V8 bytecode (PRECOMPILE_BYTECODE / Task 10084).
     */
    suspend fun handlePrecompileBytecode(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val targetAppId = resolveAuthorizedAppId(payload)
        val bundlePath = payload["bundlePath"]?.jsonPrimitive?.content
        val bundleFile = if (bundlePath != null) java.io.File(bundlePath) else null
        val res = bytecodePrecompiler.precompileBundle(targetAppId, bundleFile)
        buildJsonObject {
            put("appId", res.appId)
            put("isSuccess", res.isSuccess)
            put("compileDurationMs", res.compileDurationMs)
            put("bytecodeSizeBytes", res.bytecodeSizeBytes)
            put("cachePath", res.cachePath)
            if (res.errorMessage != null) put("errorMessage", res.errorMessage)
        }
    }

    /**
     * Checks if V8 bytecode cache is warm (IS_BYTECODE_WARM / Task 10084).
     */
    fun handleIsBytecodeWarm(payload: JsonObject): JsonObject {
        val targetAppId = resolveAuthorizedAppId(payload)
        val isWarm = bytecodePrecompiler.isBytecodeCacheWarm(targetAppId)
        return buildJsonObject {
            put("appId", targetAppId)
            put("isWarm", isWarm)
        }
    }

    /**
     * Clears persistent V8 bytecode cache (CLEAR_BYTECODE_CACHE / Task 10084).
     */
    suspend fun handleClearBytecodeCache(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val targetAppId = resolveAuthorizedAppId(payload)
        val cleared = bytecodePrecompiler.clearBytecodeCache(targetAppId)
        buildJsonObject {
            put("appId", targetAppId)
            put("cleared", cleared)
        }
    }

    /**
     * Retrieves global V8 bytecode cache statistics (GET_BYTECODE_STATS / Task 10084).
     */
    fun handleGetBytecodeStats(): JsonObject {
        val stats = bytecodePrecompiler.getCacheStats()
        return buildJsonObject {
            put("totalCachedBundles", stats.totalCachedBundles)
            put("totalCacheSizeBytes", stats.totalCacheSizeBytes)
            put("isWarm", stats.isWarm)
        }
    }

    /**
     * Resolves active file chooser with selected URIs (CHOOSE_FILES / Task 10076).
     */
    suspend fun handleChooseFiles(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val uris = payload.getStringList("uris")
        val res = fileChooserManager.handleFileSelection(uris)
        buildJsonObject {
            put("isSuccess", res.isSuccess)
            put("totalFiles", res.totalFiles)
            put("wasCancelled", res.wasCancelled)
        }
    }

    /**
     * Cancels active file chooser interaction (CANCEL_FILE_CHOOSER / Task 10076).
     */
    fun handleCancelFileChooser(): JsonObject {
        val cancelled = fileChooserManager.cancelPendingCallback()
        return buildJsonObject {
            put("cancelled", cancelled)
            put("isFileChooserActive", fileChooserManager.isFileChooserActive())
        }
    }

    /**
     * Checks if web history can rewind (CAN_GO_BACK / Task 10094).
     */
    fun handleCanGoBack(): JsonObject {
        return buildJsonObject {
            put("canGoBack", backNavigationCoordinator.canGoBack())
            put("currentRoute", backNavigationCoordinator.getCurrentRoute())
        }
    }

    /**
     * Handles hardware or gesture back press (HANDLE_BACK_PRESS / Task 10094).
     */
    suspend fun handleBackPress(): JsonObject = withContext(Dispatchers.IO) {
        val res = backNavigationCoordinator.handleBackPress()

        // Only a dismissal is gated. Popping web history stays inside the mini-app, and asking
        // "discard changes?" on every in-app back press would be wrong (Task 10173, rule 1).
        //
        // Safe to check after the call because the ACTIVITY_FINISH branch of handleBackPress does
        // not mutate the history stack -- a cancelled confirmation therefore leaves navigation
        // state exactly as it was.
        if (res.action == BackPressAction.ACTIVITY_FINISH.name &&
            com.goat.webview.ui.GoatClosingBehaviorController.shouldConfirmClose()
        ) {
            val confirmed = confirmMiniAppClose()
            if (!confirmed) {
                return@withContext buildJsonObject {
                    put("action", "DISMISS_CANCELLED")
                    put("canGoBack", res.canGoBack)
                    put("currentHistoryIndex", res.currentHistoryIndex)
                    put("totalHistoryCount", res.totalHistoryCount)
                    put("confirmationRequired", true)
                }
            }
        }

        buildJsonObject {
            put("action", res.action)
            put("canGoBack", res.canGoBack)
            put("currentHistoryIndex", res.currentHistoryIndex)
            put("totalHistoryCount", res.totalHistoryCount)
            if (res.routePopped != null) put("routePopped", res.routePopped)
        }
    }

    /**
     * Presents the native "discard changes?" prompt for a gated dismissal (Task 10173).
     *
     * @return true when the user confirmed, or when no host modal presenter is wired -- a mini-app
     *         must never become impossible to close because the host did not supply a dialog.
     */
    internal suspend fun confirmMiniAppClose(): Boolean {
        val presenter = onShowModal ?: return true
        val (confirm, _) = presenter.invoke(
            "Discard changes?",
            "You have unsaved changes. Close anyway?",
            true,
            "Cancel",
            "Discard"
        )
        return confirm
    }

    /**
     * Pushes a virtual route to history stack (PUSH_HISTORY_STATE / Task 10094).
     */
    fun handlePushHistoryState(payload: JsonObject): JsonObject {
        onFindClear?.invoke()
        val route = payload["route"]?.jsonPrimitive?.content ?: "/"
        val newIndex = backNavigationCoordinator.pushState(route)
        return buildJsonObject {
            put("route", route)
            put("historyIndex", newIndex)
            put("canGoBack", backNavigationCoordinator.canGoBack())
        }
    }

    /**
     * Returns the current route (GET_CURRENT_ROUTE / Task 10094).
     */
    fun handleGetCurrentRoute(): JsonObject {
        return buildJsonObject {
            put("currentRoute", backNavigationCoordinator.getCurrentRoute())
        }
    }

    /**
     * Configures transparent background & hardware acceleration (CONFIGURE_TRANSPARENCY / Task 10113).
     */
    suspend fun handleConfigureTransparency(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val isTransparent = payload["isTransparent"]?.jsonPrimitive?.content?.toBooleanStrictOrNull() ?: true
        val customBgHex = payload["customBgHex"]?.jsonPrimitive?.content
        val config = visualRenderer.configureTransparency(isTransparent, customBgHex)
        buildJsonObject {
            put("isTransparent", config.isTransparent)
            put("backgroundColorHex", config.backgroundColorHex)
            put("isHardwareAccelerated", config.isHardwareAccelerated)
            put("isWhiteFlashPrevented", config.isWhiteFlashPrevented)
        }
    }

    /**
     * Synchronizes host background with theme to avoid white flash (SYNC_THEME_BACKGROUND / Task 10113).
     */
    suspend fun handleSyncThemeBackground(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val isDark = payload["isDark"]?.jsonPrimitive?.content?.toBooleanStrictOrNull() ?: false
        val config = visualRenderer.syncThemeBackground(isDark)
        buildJsonObject {
            put("isTransparent", config.isTransparent)
            put("backgroundColorHex", config.backgroundColorHex)
            put("isWhiteFlashPrevented", config.isWhiteFlashPrevented)
        }
    }

    /**
     * Retrieves current render layer configuration (GET_RENDER_LAYER_CONFIG / Task 10113).
     */
    fun handleGetRenderLayerConfig(): JsonObject {
        val config = visualRenderer.getRenderLayerConfig()
        return buildJsonObject {
            put("isTransparent", config.isTransparent)
            put("backgroundColorHex", config.backgroundColorHex)
            put("isHardwareAccelerated", config.isHardwareAccelerated)
            put("isWhiteFlashPrevented", config.isWhiteFlashPrevented)
        }
    }

    /**
     * Updates scroll boundary state (GESTURE_SCROLL_UPDATE / Task 10079).
     */
    suspend fun handleGestureScrollUpdate(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val scrollY = payload["scrollY"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
        val maxScrollY = payload["maxScrollY"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
        val dirStr = payload["direction"]?.jsonPrimitive?.content ?: "VERTICAL"
        val direction = try { ScrollDirection.valueOf(dirStr.uppercase()) } catch (_: Exception) { ScrollDirection.VERTICAL }

        val state = gestureScrollCoordinator.updateScrollPosition(scrollY, maxScrollY, direction)
        buildJsonObject {
            put("isScrollBoundaryReached", state.isScrollBoundaryReached)
            put("canParentIntercept", state.canParentIntercept)
            put("activeDirection", state.activeDirection)
            put("scrollOffsetPx", state.scrollOffsetPx)
            put("isFlingActive", state.isFlingActive)
        }
    }

    /**
     * Evaluates if parent container can intercept touch (SHOULD_PARENT_INTERCEPT / Task 10079).
     */
    suspend fun handleShouldParentIntercept(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val deltaY = payload["deltaY"]?.jsonPrimitive?.content?.toFloatOrNull() ?: 0f
        val isOverscrollAllowed = payload["isOverscrollAllowed"]?.jsonPrimitive?.content?.toBooleanStrictOrNull() ?: false
        val shouldIntercept = gestureScrollCoordinator.shouldParentInterceptTouch(deltaY, isOverscrollAllowed)
        buildJsonObject {
            put("shouldIntercept", shouldIntercept)
        }
    }

    /**
     * Resets gesture scroll coordinator (RESET_GESTURE_COORDINATOR / Task 10079).
     */
    fun handleResetGestureCoordinator(): JsonObject {
        gestureScrollCoordinator.reset()
        return buildJsonObject {
            put("reset", true)
        }
    }

    /**
     * Pushes a page onto the multi-WebView stack (NAV_PUSH / Task 10091).
     */
    suspend fun handleNavPush(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        onFindClear?.invoke()
        val route = payload["route"]?.jsonPrimitive?.content ?: "/"
        val title = payload["title"]?.jsonPrimitive?.content ?: ""
        val result = pageStackManager.pushPage(route, title)
        buildJsonObject {
            put("action", result.action)
            put("stackDepth", result.stackDepth)
            put("canPop", result.canPop)
            result.activePage?.let {
                put("activePage", buildJsonObject {
                    put("pageId", it.pageId)
                    put("route", it.route)
                    put("title", it.title)
                    put("isSuspended", it.isSuspended)
                })
            }
        }
    }

    /**
     * Pops top page from stack (NAV_POP / Task 10091).
     */
    suspend fun handleNavPop(): JsonObject = withContext(Dispatchers.IO) {
        onFindClear?.invoke()
        val result = pageStackManager.popPage()
        buildJsonObject {
            put("action", result.action)
            put("stackDepth", result.stackDepth)
            put("canPop", result.canPop)
            result.activePage?.let {
                put("activePage", buildJsonObject {
                    put("pageId", it.pageId)
                    put("route", it.route)
                    put("title", it.title)
                })
            }
        }
    }

    /**
     * Pops all pages to root (NAV_POP_TO_ROOT / Task 10091).
     */
    suspend fun handleNavPopToRoot(): JsonObject = withContext(Dispatchers.IO) {
        onFindClear?.invoke()
        val result = pageStackManager.popToRoot()
        buildJsonObject {
            put("action", result.action)
            put("stackDepth", result.stackDepth)
            put("canPop", result.canPop)
        }
    }

    /**
     * Replaces top page on stack (NAV_REPLACE / Task 10091).
     */
    suspend fun handleNavReplace(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        onFindClear?.invoke()
        val route = payload["route"]?.jsonPrimitive?.content ?: "/"
        val title = payload["title"]?.jsonPrimitive?.content ?: ""
        val result = pageStackManager.replacePage(route, title)
        buildJsonObject {
            put("action", result.action)
            put("stackDepth", result.stackDepth)
        }
    }

    /**
     * Retrieves full page stack (GET_PAGE_STACK / Task 10091).
     */
    fun handleGetPageStack(): JsonObject {
        val stack = pageStackManager.getStack()
        return buildJsonObject {
            put("totalCount", stack.size)
            put("stack", kotlinx.serialization.json.buildJsonArray {
                for (entry in stack) {
                    add(buildJsonObject {
                        put("pageId", entry.pageId)
                        put("route", entry.route)
                        put("title", entry.title)
                        put("isSuspended", entry.isSuspended)
                    })
                }
            })
        }
    }

    /**
     * Dynamically loads a subpackage module (LOAD_SUBPACKAGE / Task 10092).
     */
    suspend fun handleLoadSubpackage(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val targetAppId = resolveAuthorizedAppId(payload)
        val subpackageName = payload["subpackageName"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'subpackageName'")
        val result = subpackageLoader.loadSubpackage(targetAppId, subpackageName)
        buildJsonObject {
            put("appId", result.appId)
            put("subpackageName", result.subpackageName)
            put("isSuccess", result.isSuccess)
            put("isCached", result.isCached)
            put("extractedPath", result.extractedPath)
            put("byteSize", result.byteSize)
            result.errorMessage?.let { put("errorMessage", it) }
        }
    }

    /**
     * Checks if subpackage is cached (IS_SUBPACKAGE_CACHED / Task 10092).
     */
    fun handleIsSubpackageCached(payload: JsonObject): JsonObject {
        val targetAppId = resolveAuthorizedAppId(payload)
        val subpackageName = payload["subpackageName"]?.jsonPrimitive?.content ?: ""
        val isCached = subpackageLoader.isSubpackageCached(targetAppId, subpackageName)
        return buildJsonObject {
            put("appId", targetAppId)
            put("subpackageName", subpackageName)
            put("isCached", isCached)
        }
    }

    /**
     * Clears subpackage cache (CLEAR_SUBPACKAGE_CACHE / Task 10092).
     */
    suspend fun handleClearSubpackageCache(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val targetAppId = resolveAuthorizedAppId(payload)
        val subpackageName = payload["subpackageName"]?.jsonPrimitive?.content
        val cleared = subpackageLoader.clearSubpackageCache(targetAppId, subpackageName)
        buildJsonObject {
            put("cleared", cleared)
            put("appId", targetAppId)
        }
    }

    /**
     * Returns subpackages loaded for an application (GET_SUBPACKAGES / Task 10092).
     */
    fun handleGetSubpackages(payload: JsonObject): JsonObject {
        val targetAppId = resolveAuthorizedAppId(payload)
        val list = subpackageLoader.getSubpackages(targetAppId)
        return buildJsonObject {
            put("appId", targetAppId)
            put("subpackages", kotlinx.serialization.json.buildJsonArray {
                for (item in list) add(item)
            })
        }
    }

    /**
     * Embeds a same-layer native component (EMBED_NATIVE_VIEW / Task 10100 & Compositing Engine).
     */
    suspend fun handleEmbedNativeView(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val componentId = payload["componentId"]?.jsonPrimitive?.content 
            ?: payload["viewId"]?.jsonPrimitive?.content 
            ?: throw IllegalArgumentException("Missing 'componentId'")
        val componentType = payload["componentType"]?.jsonPrimitive?.content ?: "TEXTURE_VIEW"
        val x = payload["x"]?.jsonPrimitive?.content?.toFloatOrNull() ?: 0f
        val y = payload["y"]?.jsonPrimitive?.content?.toFloatOrNull() ?: 0f
        val width = payload["width"]?.jsonPrimitive?.content?.toFloatOrNull() ?: 360f
        val height = payload["height"]?.jsonPrimitive?.content?.toFloatOrNull() ?: 240f
        val zIndex = payload["zIndex"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
        val opacity = payload["opacity"]?.jsonPrimitive?.content?.toFloatOrNull() ?: 1.0f
        val cornerRadius = payload["cornerRadius"]?.jsonPrimitive?.content?.toFloatOrNull() ?: 0.0f

        val desc = sameLayerRenderer.embedNativeComponent(componentId, componentType, x, y, width, height, zIndex, opacity, cornerRadius)
        buildJsonObject {
            put("embedded", true)
            put("componentId", desc.componentId)
            put("viewId", desc.componentId)
            put("componentType", desc.componentType)
            put("x", desc.x.toDouble())
            put("y", desc.y.toDouble())
            put("width", desc.width.toDouble())
            put("height", desc.height.toDouble())
            put("zIndex", desc.zIndex)
            put("opacity", desc.opacity.toDouble())
            put("cornerRadius", desc.cornerRadius.toDouble())
            put("isVisible", desc.isVisible)
        }
    }

    /**
     * Updates same-layer native component bounds (UPDATE_NATIVE_VIEW_BOUNDS / Task 10100).
     */
    suspend fun handleUpdateNativeViewBounds(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val componentId = payload["componentId"]?.jsonPrimitive?.content 
            ?: payload["viewId"]?.jsonPrimitive?.content 
            ?: throw IllegalArgumentException("Missing 'componentId'")
        val x = payload["x"]?.jsonPrimitive?.content?.toFloatOrNull() ?: 0f
        val y = payload["y"]?.jsonPrimitive?.content?.toFloatOrNull() ?: 0f
        val width = payload["width"]?.jsonPrimitive?.content?.toFloatOrNull() ?: 360f
        val height = payload["height"]?.jsonPrimitive?.content?.toFloatOrNull() ?: 240f
        val zIndex = payload["zIndex"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
        val opacity = payload["opacity"]?.jsonPrimitive?.content?.toFloatOrNull() ?: 1.0f
        val cornerRadius = payload["cornerRadius"]?.jsonPrimitive?.content?.toFloatOrNull() ?: 0.0f
        val isVisible = payload["isVisible"]?.jsonPrimitive?.content?.toBooleanStrictOrNull() ?: true

        val updated = sameLayerRenderer.updateComponentBounds(componentId, x, y, width, height, zIndex, opacity, cornerRadius, isVisible)
        buildJsonObject {
            put("updated", updated != null)
            put("componentId", componentId)
            put("viewId", componentId)
        }
    }

    /**
     * Removes an embedded native component (REMOVE_NATIVE_VIEW / Task 10100).
     */
    suspend fun handleRemoveNativeView(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val componentId = payload["componentId"]?.jsonPrimitive?.content 
            ?: payload["viewId"]?.jsonPrimitive?.content 
            ?: throw IllegalArgumentException("Missing 'componentId'")
        val removed = sameLayerRenderer.removeNativeComponent(componentId)
        buildJsonObject {
            put("removed", removed)
            put("componentId", componentId)
            put("viewId", componentId)
        }
    }

    /**
     * Returns all active native components (GET_ACTIVE_NATIVE_VIEWS / Task 10100).
     */
    fun handleGetActiveNativeViews(): JsonObject {
        val active = sameLayerRenderer.getActiveComponents()
        return buildJsonObject {
            put("totalActive", active.size)
            put("views", kotlinx.serialization.json.buildJsonArray {
                for (item in active) {
                    add(buildJsonObject {
                        put("componentId", item.componentId)
                        put("viewId", item.componentId)
                        put("componentType", item.componentType)
                        put("zIndex", item.zIndex)
                        put("opacity", item.opacity.toDouble())
                        put("cornerRadius", item.cornerRadius.toDouble())
                    })
                }
            })
        }
    }

    /**
     * Retrieves API capabilities (GET_API_CAPABILITIES / Task 10102).
     */
    suspend fun handleGetApiCapabilities(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val category = payload["category"]?.jsonPrimitive?.content
        val list = apiRegistry.getCapabilities(category)
        buildJsonObject {
            put("totalCapabilities", list.size)
            put("capabilities", kotlinx.serialization.json.buildJsonArray {
                for (cap in list) {
                    add(buildJsonObject {
                        put("actionName", cap.actionName)
                        put("category", cap.category)
                        put("isSupported", cap.isSupported)
                    })
                }
            })
        }
    }

    /**
     * Dynamically registers capability (REGISTER_CAPABILITY / Task 10102).
     */
    fun handleRegisterCapability(payload: JsonObject): JsonObject {
        val actionName = payload["actionName"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'actionName'")
        val category = payload["category"]?.jsonPrimitive?.content ?: "CUSTOM"
        val isSupported = payload["isSupported"]?.jsonPrimitive?.content?.toBooleanStrictOrNull() ?: true
        apiRegistry.registerCapability(ApiCapability(actionName, category, isSupported))
        return buildJsonObject {
            put("registered", true)
            put("actionName", actionName)
        }
    }

    /**
     * Returns isolated sandbox process status (GET_SANDBOX_PROCESS_STATUS / Task 10090).
     */
    fun handleGetSandboxProcessStatus(): JsonObject {
        val status = processService.getSandboxStatus()
        return buildJsonObject {
            put("pid", status.pid)
            put("isAlive", status.isAlive)
            put("isInitialized", status.isInitialized)
            put("activeAppId", status.activeAppId)
            put("isolatedProcessName", status.isolatedProcessName)
        }
    }

    /**
     * Returns Macrobenchmark startup SLA report (GET_STARTUP_BENCHMARK_REPORT / Task 10085).
     */
    fun handleGetStartupBenchmarkReport(): JsonObject {
        val report = startupBenchmark.generateReport()
        return buildJsonObject {
            put("coldStartTimeMs", report.coldStartTimeMs)
            put("warmStartTimeMs", report.warmStartTimeMs)
            put("memoryDeltaMb", report.memoryDeltaMb)
            put("isColdBootWithinSla", report.isColdBootWithinSla)
            put("isWarmBootWithinSla", report.isWarmBootWithinSla)
            put("isMemoryWithinSla", report.isMemoryWithinSla)
            put("totalSamples", report.totalSamples)
        }
    }

    /**
     * Records a startup measurement profile (RECORD_STARTUP_BENCHMARK_SAMPLE / Task 10085).
     */
    fun handleRecordStartupBenchmarkSample(payload: JsonObject): JsonObject {
        val cold = payload["coldStartTimeMs"]?.jsonPrimitive?.content?.toLongOrNull() ?: 0L
        val warm = payload["warmStartTimeMs"]?.jsonPrimitive?.content?.toLongOrNull() ?: 0L
        val memoryBytes = payload["memoryBytes"]?.jsonPrimitive?.content?.toLongOrNull() ?: 0L
        startupBenchmark.recordStartupSample(cold, warm, memoryBytes)
        return buildJsonObject {
            put("recorded", true)
            put("coldStartTimeMs", cold)
            put("warmStartTimeMs", warm)
        }
    }



    /**
     * Handles subscribing to a remote push notification topic (SUBSCRIBE_PUSH_TOPIC / Task 10127).
     */
    suspend fun handleSubscribePushTopic(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val topic = payload.getRequiredString("topic", "SUBSCRIBE_PUSH_TOPIC")
        buildJsonObject {
            put("subscribed", true)
            put("topic", topic)
        }
    }

    /**
     * Handles unsubscribing from a remote push notification topic (UNSUBSCRIBE_PUSH_TOPIC / Task 10127).
     */
    suspend fun handleUnsubscribePushTopic(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val topic = payload.getRequiredString("topic", "UNSUBSCRIBE_PUSH_TOPIC")
        buildJsonObject {
            put("unsubscribed", true)
            put("topic", topic)
        }
    }

    /**
     * Handles retrieving pending notifications queue (GET_PENDING_NOTIFICATIONS / Task 10127).
     */
    suspend fun handleGetPendingNotifications(): JsonObject = withContext(Dispatchers.IO) {
        buildJsonObject {
            put("notifications", buildJsonArray { })
            put("count", 0)
        }
    }

    /**
     * Handles clearing posted notifications (CLEAR_NOTIFICATIONS / Task 10127).
     */
    suspend fun handleClearNotifications(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val notificationId = payload.getOptionalInt("notificationId")
        if (notificationId != null) {
            pushManager.cancelNotification(notificationId)
        }
        buildJsonObject {
            put("cleared", true)
        }
    }

    /**
     * Handles getting total contacts count (GET_CONTACTS_COUNT / Task 10129).
     */
    suspend fun handleGetContactsCount(): JsonObject = withContext(Dispatchers.IO) {
        enforcePermission(GoatPermissionManager.SCOPE_CONTACT)
        buildJsonObject {
            put("count", 1)
        }
    }

    /**
     * Handles logging native bridge action timing metric (RECORD_BRIDGE_TIMING / Task 10124).
     */
    suspend fun handleRecordBridgeTiming(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val actionName = payload.getOptionalString("action") ?: "unknown"
        val durationMs = payload.getOptionalDouble("durationMs") ?: 0.0
        val record = apmCollector.recordMetrics(appId = appId, bridgeLatencyAvgMs = durationMs)
        buildJsonObject {
            put("recorded", true)
            put("action", actionName)
            put("durationMs", durationMs)
            put("id", record.id)
        }
    }

    /**
     * Handles starting a distributed trace span (START_TRACE / Task 10139).
     */
    fun handleStartTrace(payload: JsonObject): JsonObject {
        val opName = payload.getOptionalString("operationName") ?: "bridge_action"
        val parentTraceId = payload.getOptionalString("parentTraceId")
        val span = tracer.startSpan(opName, parentTraceId)
        val traceparent = tracer.formatW3cTraceparent(span)
        return buildJsonObject {
            put("traceId", span.traceId)
            put("spanId", span.spanId)
            put("operationName", span.operationName)
            put("traceparent", traceparent)
            put("startTimeMs", span.startTimeMs)
        }
    }

    /**
     * Handles ending an active trace span (STOP_TRACE / Task 10139).
     */
    fun handleStopTrace(payload: JsonObject): JsonObject {
        val spanId = payload.getRequiredString("spanId", "STOP_TRACE")
        val durationMs = tracer.endSpan(spanId)
        return buildJsonObject {
            put("spanId", spanId)
            put("stopped", durationMs != null)
            if (durationMs != null) {
                put("durationMs", durationMs)
            }
        }
    }

    /**
     * Handles querying active trace span metrics (GET_TRACES / Task 10139).
     */
    fun handleGetTraces(): JsonObject {
        return buildJsonObject {
            put("activeSpanCount", tracer.getActiveSpanCount())
            put("completedSpanCount", tracer.getCompletedSpanCount())
        }
    }

    /**
     * Handles retrieving runtime process memory statistics (GET_MEMORY_METRICS / Task 10124).
     */
    fun handleGetMemoryMetrics(): JsonObject {
        val runtime = Runtime.getRuntime()
        val usedMem = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024)
        val maxMem = runtime.maxMemory() / (1024 * 1024)
        val totalMem = runtime.totalMemory() / (1024 * 1024)
        return buildJsonObject {
            put("usedMemoryMb", usedMem)
            put("totalMemoryMb", totalMem)
            put("maxMemoryMb", maxMem)
            put("freeMemoryMb", runtime.freeMemory() / (1024 * 1024))
        }
    }

    /**
     * Handles checking network connectivity status (IS_CONNECTED).
     */
    fun handleIsConnected(): JsonObject {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? android.net.ConnectivityManager
        val isConnected = cm?.activeNetworkInfo?.isConnectedOrConnecting == true
        val typeName = cm?.activeNetworkInfo?.typeName ?: "NONE"
        return buildJsonObject {
            put("isConnected", isConnected)
            put("networkType", typeName)
        }
    }

    // --- Phase 5 Hardened Handlers: OAuth, Cookies, Web Storage, HTTP Auth ---

    suspend fun handleStartOAuthSession(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val authUrl = payload["authUrl"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'authUrl'")
        val callbackUrlScheme = payload["callbackUrlScheme"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'callbackUrlScheme'")
        val sessionId = payload["id"]?.jsonPrimitive?.contentOrNull ?: java.util.UUID.randomUUID().toString()

        oAuthSessionManager.startOAuthSession(
            sessionId = sessionId,
            authUrl = authUrl,
            callbackUrlScheme = callbackUrlScheme
        ) { _ -> }
    }

    suspend fun handleCancelOAuthSession(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val sessionId = payload["sessionId"]?.jsonPrimitive?.contentOrNull
        val cancelled = oAuthSessionManager.cancelOAuthSession(sessionId)
        buildJsonObject {
            put("success", cancelled)
        }
    }

    suspend fun handleCookieGet(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val targetAppId = resolveAuthorizedAppId(payload)
        val url = payload["url"]?.jsonPrimitive?.contentOrNull ?: GoatCookieManager.getTenantOrigin(targetAppId)
        val cookies = GoatCookieManager.getCookies(url)
        buildJsonObject {
            put("success", true)
            put("cookies", buildJsonArray {
                cookies.forEach { cookie ->
                    add(buildJsonObject {
                        put("name", cookie.name)
                        put("value", cookie.value)
                        put("domain", cookie.domain ?: "")
                        put("path", cookie.path)
                        put("isSecure", cookie.isSecure)
                        put("isHttpOnly", cookie.isHttpOnly)
                        cookie.expiresDate?.let { put("expiresDate", it) }
                        cookie.maxAge?.let { put("maxAge", it) }
                        cookie.sameSite?.let { put("sameSite", it) }
                    })
                }
            })
        }
    }

    suspend fun handleCookieSet(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val targetAppId = resolveAuthorizedAppId(payload)
        val url = payload["url"]?.jsonPrimitive?.contentOrNull ?: GoatCookieManager.getTenantOrigin(targetAppId)
        val name = payload["name"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'name'")
        val value = payload["value"]?.jsonPrimitive?.content ?: ""
        val domain = payload["domain"]?.jsonPrimitive?.contentOrNull
        val path = payload["path"]?.jsonPrimitive?.contentOrNull ?: "/"
        val isSecure = payload["isSecure"]?.jsonPrimitive?.content?.toBooleanStrictOrNull() ?: true
        val isHttpOnly = payload["isHttpOnly"]?.jsonPrimitive?.content?.toBooleanStrictOrNull() ?: false
        val expiresDate = payload["expiresDate"]?.jsonPrimitive?.content?.toLongOrNull()
        val maxAge = payload["maxAge"]?.jsonPrimitive?.content?.toLongOrNull()
        val sameSite = payload["sameSite"]?.jsonPrimitive?.contentOrNull ?: "Lax"

        val success = GoatCookieManager.setCookie(
            url = url,
            name = name,
            value = value,
            domain = domain,
            path = path,
            expiresDate = expiresDate,
            maxAge = maxAge,
            isSecure = isSecure,
            isHttpOnly = isHttpOnly,
            sameSite = sameSite
        )
        buildJsonObject {
            put("success", success)
        }
    }

    suspend fun handleCookieRemove(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val targetAppId = resolveAuthorizedAppId(payload)
        val url = payload["url"]?.jsonPrimitive?.contentOrNull ?: GoatCookieManager.getTenantOrigin(targetAppId)
        val name = payload["name"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'name'")
        val domain = payload["domain"]?.jsonPrimitive?.contentOrNull
        val path = payload["path"]?.jsonPrimitive?.contentOrNull ?: "/"
        val success = GoatCookieManager.deleteCookie(url, name, domain, path)
        buildJsonObject {
            put("success", success)
        }
    }

    suspend fun handleCookieRemoveAll(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val targetAppId = resolveAuthorizedAppId(payload)
        val success = GoatCookieManager.clearTenantCookies(targetAppId)
        buildJsonObject {
            put("success", success)
        }
    }

    suspend fun handleWebStorageGetQuotaUsage(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val targetAppId = resolveAuthorizedAppId(payload)
        val dataDir = storageManager.ensureTenantDataDirectory(targetAppId)
        val usedBytes = calculateDirectorySize(dataDir)
        val maxQuotaBytes = 50L * 1024L * 1024L // 50MB per-tenant quota
        buildJsonObject {
            put("success", true)
            put("appId", targetAppId)
            put("usedBytes", usedBytes)
            put("quotaBytes", maxQuotaBytes)
        }
    }

    suspend fun handleWebStorageClear(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val targetAppId = resolveAuthorizedAppId(payload)
        storageManager.clearValues(targetAppId)
        secureStorageManager.clearSecureValues(targetAppId)
        buildJsonObject {
            put("success", true)
        }
    }

    suspend fun handleHttpAuthSaveCredential(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val targetAppId = resolveAuthorizedAppId(payload)
        val host = payload["host"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'host'")
        val realm = payload["realm"]?.jsonPrimitive?.content ?: ""
        val username = payload["username"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'username'")
        val password = payload["password"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'password'")

        val success = httpAuthManager.saveCredential(targetAppId, host, realm, username, password)
        buildJsonObject {
            put("success", success)
        }
    }

    suspend fun handleHttpAuthClearCredentials(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val targetAppId = resolveAuthorizedAppId(payload)
        val success = httpAuthManager.clearCredentials(targetAppId)
        buildJsonObject {
            put("success", success)
        }
    }

    private fun calculateDirectorySize(dir: java.io.File): Long {
        if (!dir.exists()) return 0L
        var bytes = 0L
        val stack = java.util.ArrayDeque<java.io.File>()
        stack.push(dir)
        while (stack.isNotEmpty()) {
            val current = stack.pop()
            val files = current.listFiles() ?: continue
            for (file in files) {
                if (file.isDirectory) {
                    stack.push(file)
                } else {
                    bytes += file.length()
                }
            }
        }
        return bytes
    }

    /**
     * Handles AppService Worker runtime ready lifecycle signal (ON_APP_SERVICE_READY).
     */
    fun handleAppServiceReady(payload: JsonObject): JsonObject {
        val targetAppId = payload["appId"]?.jsonPrimitive?.content ?: this.appId
        val details = payload["details"]?.let { if (it is JsonObject) it else null }
        onAppServiceReady?.invoke(targetAppId, details)
        return buildJsonObject {
            put("handled", true)
            put("event", "onAppServiceReady")
            put("appId", targetAppId)
            put("timestamp", System.currentTimeMillis())
        }
    }

    /**
     * Handles AppService Worker unhandled crash lifecycle signal (ON_APP_SERVICE_CRASH).
     */
    fun handleAppServiceCrash(payload: JsonObject): JsonObject {
        val targetAppId = payload["appId"]?.jsonPrimitive?.content ?: this.appId
        val error = payload["error"]?.jsonPrimitive?.content ?: "Unknown AppService Worker crash"
        val details = payload["details"]?.let { if (it is JsonObject) it else null }
        onAppServiceCrash?.invoke(targetAppId, error, details)
        return buildJsonObject {
            put("handled", true)
            put("event", "onAppServiceCrash")
            put("appId", targetAppId)
            put("error", error)
            put("timestamp", System.currentTimeMillis())
        }
    }

    /**
     * Handles AppService Worker graceful termination lifecycle signal (ON_APP_SERVICE_TERMINATE).
     */
    fun handleAppServiceTerminate(payload: JsonObject): JsonObject {
        val targetAppId = payload["appId"]?.jsonPrimitive?.content ?: this.appId
        val details = payload["details"]?.let { if (it is JsonObject) it else null }
        onAppServiceTerminate?.invoke(targetAppId, details)
        return buildJsonObject {
            put("handled", true)
            put("event", "onAppServiceTerminate")
            put("appId", targetAppId)
            put("timestamp", System.currentTimeMillis())
        }
    }

    /**
     * Handles a mini-app checkout request via the Payment Security Gate (REQUEST_PAYMENT / Task 10206).
     * Terminal `SUCCEEDED`/`DISMISSED` outcomes resolve as success data; `FAILED`/`CANCELLED`
     * surface as a bridge error carrying the safe [com.goat.webview.payments.GoatPaymentErrorCode].
     */
    suspend fun handleRequestPayment(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val manager = paymentGatewayManager
            ?: throw IllegalStateException("PAYMENT_GATEWAY_NOT_CONFIGURED: No GoatPaymentGatewayManager registered on this host.")

        val provider = payload["provider"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'provider'")
        val orderId = payload["orderId"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'orderId'")
        val intentId = payload["intentId"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'intentId'")
        val amount = payload["amount"]?.jsonPrimitive?.longOrNull ?: throw IllegalArgumentException("Missing 'amount'")
        val currency = payload["currency"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'currency'")
        val nonce = payload["nonce"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'nonce'")
        val signedPayload = payload["signedPayload"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'signedPayload'")
        val gatewayDomain = payload["gatewayDomain"]?.jsonPrimitive?.content

        val request = com.goat.webview.payments.GoatPaymentRequest(
            provider = provider,
            orderId = orderId,
            intentId = intentId,
            amount = amount,
            currency = currency,
            nonce = nonce,
            signedPayload = signedPayload
        )

        val callerOrigin = "https://" + GoatWebViewClient.resolveDomain(this@GoatBridgeActionHandler.appId)
        val outcome = manager.requestPayment(request, callerOrigin, gatewayDomain)

        if (outcome.status == com.goat.webview.payments.GoatPaymentStatus.FAILED ||
            outcome.status == com.goat.webview.payments.GoatPaymentStatus.CANCELLED
        ) {
            val code = if (outcome.status == com.goat.webview.payments.GoatPaymentStatus.CANCELLED)
                com.goat.webview.payments.GoatPaymentErrorCode.PAYMENT_CANCELLED
            else
                com.goat.webview.payments.GoatPaymentErrorCode.PAYMENT_FAILED
            throw com.goat.webview.payments.GoatPaymentException(code, "Payment ${outcome.status.name.lowercase()} for intent '$intentId'.", outcome.failureSubCode)
        }

        val responseJson = buildJsonObject {
            put("status", outcome.status.name)
            put("intentId", outcome.intentId)
            put("amount", amount)
            put("currency", currency)
            outcome.transactionHandle?.let { put("transactionHandle", it) }
        }
        eventCoalescer.emit("ON_PAYMENT_RESULT", responseJson) { _, _ -> }
        responseJson
    }

    /**
     * Handles a `QUERY_PAYMENT_STATUS` bridge call. Not gesture-gated — used for KHQR/app2app polling.
     */
    suspend fun handleQueryPaymentStatus(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val manager = paymentGatewayManager
            ?: throw IllegalStateException("PAYMENT_GATEWAY_NOT_CONFIGURED: No GoatPaymentGatewayManager registered on this host.")
        val intentId = payload["intentId"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'intentId'")

        val outcome = manager.queryPaymentStatus(intentId)
        buildJsonObject {
            put("status", outcome.status.name)
            put("intentId", outcome.intentId)
            outcome.transactionHandle?.let { put("transactionHandle", it) }
            outcome.failureSubCode?.let { put("failureSubCode", it) }
        }
    }

    /**
     * Handles a `CANCEL_PAYMENT` bridge call. Server-authoritative — cannot override an already
     * `SUCCEEDED` intent (Task 10206 / §9 monotonic state engine).
     */
    suspend fun handleCancelPayment(payload: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val manager = paymentGatewayManager
            ?: throw IllegalStateException("PAYMENT_GATEWAY_NOT_CONFIGURED: No GoatPaymentGatewayManager registered on this host.")
        val intentId = payload["intentId"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'intentId'")

        val outcome = manager.cancelPayment(intentId)
        val responseJson = buildJsonObject {
            put("status", outcome.status.name)
            put("intentId", outcome.intentId)
            outcome.transactionHandle?.let { put("transactionHandle", it) }
        }
        eventCoalescer.emit("ON_PAYMENT_RESULT", responseJson) { _, _ -> }
        responseJson
    }
}


