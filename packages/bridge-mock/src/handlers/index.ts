/**
 * @goat/bridge-mock - Master Action Dispatcher & Catalog Index
 * Unifies all 197 action strings across all 18 functional domains.
 */

import { CoreHandlers } from './core.js';
import { StorageHandlers } from './storage.js';
import { FileSystemHandlers } from './fs.js';
import { NetworkHandlers } from './network.js';
import { UIHandlers } from './ui.js';
import { SensorHandlers } from './sensors.js';
import { LocationHandlers } from './location.js';
import { BiometricHandlers } from './biometrics.js';
import { MediaHandlers } from './media.js';
import { ContactsHandlers } from './contacts.js';
import { PushHandlers } from './push.js';
import { BleNfcHandlers } from './ble.js';
import { Web3Handlers } from './web3.js';
import { PasskeyHandlers } from './passkey.js';
import { PassHandlers } from './passes.js';
import { BinaryHandlers } from './binary.js';
import { NavigationHandlers } from './navigation.js';
import { SubpackageHandlers } from './subpackages.js';
import { RenderHandlers } from './render.js';
import { ApmHandlers } from './apm.js';
import { GoatBridgeError, BridgeErrorCodes } from '../errors.js';
import { mockState } from '../state/store.js';

export * from './core.js';
export * from './storage.js';
export * from './fs.js';
export * from './network.js';
export * from './ui.js';
export * from './sensors.js';
export * from './location.js';
export * from './biometrics.js';
export * from './media.js';
export * from './contacts.js';
export * from './push.js';
export * from './ble.js';
export * from './web3.js';
export * from './binary.js';
export * from './navigation.js';
export * from './subpackages.js';
export * from './render.js';
export * from './apm.js';

export const SUPPORTED_ACTIONS: Set<string> = new Set([
  // Domain 1: Core & System Lifecycle (12)
  'GET_DEVICE_INFO',
  'HAPTIC_FEEDBACK',
  'SET_STATUS_BAR_THEME',
  'SET_SCREEN_BRIGHTNESS',
  'GET_SCREEN_BRIGHTNESS',
  'SET_KEEP_SCREEN_ON',
  'CLIPBOARD_SET',
  'CLIPBOARD_GET',
  'NAVIGATE_BACK',
  'CAN_I_USE',
  'START_OAUTH_SESSION',
  'CANCEL_OAUTH_SESSION',

  // Domain 2: Multi-Tenant Storage & Sandboxing (16)
  'STORAGE_SET',
  'STORAGE_GET',
  'STORAGE_REMOVE',
  'STORAGE_CLEAR',
  'SECURE_STORAGE_SET',
  'SECURE_STORAGE_GET',
  'SECURE_STORAGE_REMOVE',
  'SECURE_STORAGE_CLEAR',
  'COOKIE_GET',
  'COOKIE_SET',
  'COOKIE_REMOVE',
  'COOKIE_REMOVE_ALL',
  'WEB_STORAGE_GET_QUOTA_USAGE',
  'WEB_STORAGE_CLEAR',
  'HTTP_AUTH_SAVE_CREDENTIAL',
  'HTTP_AUTH_CLEAR_CREDENTIALS',

  // Domain 3: Sandboxed FileSystem & File Chooser (11)
  'FS_WRITE_FILE',
  'FS_READ_FILE',
  'FS_MKDIR',
  'FS_RMDIR',
  'FS_UNLINK',
  'FS_LIST_DIR',
  'FS_STAT',
  'FS_COPY_FILE',
  'FS_EXISTS',
  'CHOOSE_FILES',
  'CANCEL_FILE_CHOOSER',

  // Domain 4: Networking, HTTP & WebSockets (10)
  'API_REQUEST',
  'DOWNLOAD_FILE',
  'UPLOAD_FILE',
  'GET_NETWORK_TYPE',
  'IS_CONNECTED',
  'WEBSOCKET_CONNECT',
  'WEBSOCKET_SEND',
  'WEBSOCKET_CLOSE',
  'VERIFY_SSL_PIN',
  'AUDIT_NETWORK_CERTIFICATE',

  // Domain 5: UI Feedback, Navigation Bar, Bottom Sheet & Window Insets (28)
  'SHOW_TOAST',
  'HIDE_TOAST',
  'SHOW_MODAL',
  'SHOW_ACTION_SHEET',
  'SHOW_LOADING',
  'HIDE_LOADING',
  'GET_KEYBOARD_INSETS',
  'SET_KEYBOARD_INSETS',
  'SET_NAV_BAR_TITLE',
  'SET_NAV_BAR_COLOR',
  'SET_NAV_BAR_BUTTONS',
  'SET_NAV_BAR_PROGRESS',
  'EXPAND_BOTTOM_SHEET',
  'COLLAPSE_BOTTOM_SHEET',
  'SET_SHEET_SNAP_POINTS',
  'GET_SAFE_AREA_INSETS',
  'OPEN_EXTERNAL_LINK',
  'OPEN_URL',
  'OPEN_LINK',
  'TAB_OPEN',
  'TAB_CLOSE',
  'TAB_SWITCH',
  'TAB_GET_ACTIVE',
  'TAB_LIST',
  'TAB_CLOSE_ALL',
  'OPEN_MINI_APP',
  'CLOSE_MINI_APP',
  'ON_MINI_APP_CLOSED',

  // Domain 6: Hardware Sensors & Telephony (13)
  'START_ACCELEROMETER',
  'STOP_ACCELEROMETER',
  'GET_LATEST_ACCELEROMETER',
  'START_COMPASS',
  'STOP_COMPASS',
  'START_GYROSCOPE',
  'STOP_GYROSCOPE',
  'GET_LATEST_GYROSCOPE',
  'START_DEVICE_MOTION',
  'STOP_DEVICE_MOTION',
  'GET_LATEST_DEVICE_MOTION',
  'MAKE_PHONE_CALL',
  'SEND_SMS',

  // Domain 7: Location & Geofencing (7)
  'GET_LOCATION',
  'CHOOSE_LOCATION',
  'OPEN_LOCATION',
  'START_GEOFENCE',
  'STOP_GEOFENCE',
  'LIST_GEOFENCES',
  'EVALUATE_GEOFENCE',

  // Domain 8: Biometrics & Permissions (8)
  'CHECK_BIOMETRIC_SUPPORT',
  'BIOMETRIC_AUTH',
  'CHECK_PERMISSION',
  'REQUEST_PERMISSION',
  'GET_SETTING',
  'OPEN_SETTING',
  'AUTHORIZE',
  'AUDIT_SANDBOX_HEADERS',

  // Domain 9: Media & Audio (7)
  'SCAN_CODE',
  'CHOOSE_MEDIA',
  'PREVIEW_IMAGE',
  'AUDIO_PLAY',
  'AUDIO_PAUSE',
  'AUDIO_STOP',
  'AUDIO_SEEK',

  // Domain 10: Contacts & Social Sharing (5)
  'CHOOSE_CONTACT',
  'PICK_CONTACTS',
  'GET_CONTACTS_COUNT',
  'SHARE_SHEET',
  'SHARE_TO_STORY',

  // Domain 11: Push Notifications (9)
  'PUSH_GET_TOKEN',
  'GET_PUSH_TOKEN',
  'PUSH_REQUEST_PERMISSION',
  'PUSH_SET_BADGE',
  'PUSH_SHOW_NOTIFICATION',
  'SUBSCRIBE_PUSH_TOPIC',
  'UNSUBSCRIBE_PUSH_TOPIC',
  'GET_PENDING_NOTIFICATIONS',
  'CLEAR_NOTIFICATIONS',

  // Domain 12: Bluetooth Low Energy & NFC (16)
  'BLE_START_SCAN',
  'START_BLE_SCAN',
  'BLE_STOP_SCAN',
  'STOP_BLE_SCAN',
  'BLE_CONNECT',
  'CONNECT_BLE_DEVICE',
  'DISCONNECT_BLE_DEVICE',
  'BLE_READ_CHARACTERISTIC',
  'READ_BLE_CHARACTERISTIC',
  'BLE_WRITE_CHARACTERISTIC',
  'WRITE_BLE_CHARACTERISTIC',
  'NFC_READ_TAG',
  'READ_NFC_NDEF_MESSAGE',
  'NFC_WRITE_TAG',
  'START_NFC_DISCOVERY',
  'STOP_NFC_DISCOVERY',

  // Domain 13: Web3 & Payments (7)
  'WEB3_CONNECT_WALLET',
  'WEB3_SIGN_TRANSACTION',
  'WEB3_SIGN_MESSAGE',
  'WEB3_SWITCH_CHAIN',
  'PASSKEY_CHECK_SUPPORT',
  'PASSKEY_REGISTER',
  'PASSKEY_ASSERT',
  'VAULT_ENCRYPT',
  'VAULT_DECRYPT',
  'WALLET_SAVE_PASS',
  'WALLET_GET_PASS_STATE',
  'WALLET_OPEN_PASS',
  'WALLET_LIST_PASSES',
  'WALLET_DELETE_PASS',
  'WEB3_DISCONNECT',
  'WEB3_GET_ACCOUNT',
  'OPEN_INVOICE',
  'GET_PURCHASE_PRODUCTS',
  'RESTORE_PURCHASES',

  // Domain 14: Binary IPC Channels (4)
  'CREATE_BINARY_PORT',
  'POST_BINARY_MESSAGE',
  'READ_BINARY_MESSAGE',
  'CLOSE_BINARY_PORT',

  // Domain 15: Navigation & Predictive Back (12)
  'CAN_GO_BACK',
  'HANDLE_BACK_PRESS',
  'PUSH_HISTORY_STATE',
  'GET_CURRENT_ROUTE',
  'NAV_PUSH',
  'NAV_POP',
  'NAV_POP_TO_ROOT',
  'NAV_REPLACE',
  'GET_PAGE_STACK',
  'PREDICTIVE_BACK_PROGRESS',
  'PREDICTIVE_BACK_INVOKE',
  'PREDICTIVE_BACK_CANCEL',

  // Domain 16: Subpackages, WASM & Bytecode (9)
  'LOAD_SUBPACKAGE',
  'IS_SUBPACKAGE_CACHED',
  'CLEAR_SUBPACKAGE_CACHE',
  'GET_SUBPACKAGES',
  'PRECOMPILE_BYTECODE',
  'IS_BYTECODE_WARM',
  'CLEAR_BYTECODE_CACHE',
  'GET_BYTECODE_STATS',
  'VALIDATE_WASM_SUPPORT',

  // Domain 17: Visual Rendering & Same-Layer (10)
  'CONFIGURE_TRANSPARENCY',
  'SYNC_THEME_BACKGROUND',
  'GET_RENDER_LAYER_CONFIG',
  'GESTURE_SCROLL_UPDATE',
  'SHOULD_PARENT_INTERCEPT',
  'RESET_GESTURE_COORDINATOR',
  'EMBED_NATIVE_VIEW',
  'UPDATE_NATIVE_VIEW_BOUNDS',
  'REMOVE_NATIVE_VIEW',
  'GET_ACTIVE_NATIVE_VIEWS',

  // Domain 18: Capability Discovery & APM Telemetry (14)
  'GET_API_CAPABILITIES',
  'REGISTER_CAPABILITY',
  'GET_SANDBOX_PROCESS_STATUS',
  'GET_STARTUP_BENCHMARK_REPORT',
  'RECORD_STARTUP_BENCHMARK_SAMPLE',
  'REPORT_METRICS',
  'SEND_APM_METRIC',
  'GET_APM_METRICS',
  'GET_APM_SUMMARY',
  'RECORD_BRIDGE_TIMING',
  'START_TRACE',
  'STOP_TRACE',
  'GET_TRACES',
  'GET_MEMORY_METRICS',
]);

/**
 * Normalizes action strings from camelCase / dot-notation / PascalCase to UPPER_SNAKE_CASE
 */
export function normalizeActionName(rawAction: string): string {
  if (!rawAction) return '';
  const trimmed = rawAction.trim();

  // Handle common exact aliases
  const aliasMap: Record<string, string> = {
    getDeviceInfo: 'GET_DEVICE_INFO',
    getSystemInfo: 'GET_DEVICE_INFO',
    triggerHaptic: 'HAPTIC_FEEDBACK',
    hapticFeedback: 'HAPTIC_FEEDBACK',
    setStatusBarTheme: 'SET_STATUS_BAR_THEME',
    setScreenBrightness: 'SET_SCREEN_BRIGHTNESS',
    setBrightness: 'SET_SCREEN_BRIGHTNESS',
    getScreenBrightness: 'GET_SCREEN_BRIGHTNESS',
    getBrightness: 'GET_SCREEN_BRIGHTNESS',
    setKeepScreenOn: 'SET_KEEP_SCREEN_ON',
    setClipboard: 'CLIPBOARD_SET',
    setClipboardData: 'CLIPBOARD_SET',
    getClipboard: 'CLIPBOARD_GET',
    getClipboardData: 'CLIPBOARD_GET',
    navigateBack: 'NAVIGATE_BACK',
    canIUse: 'CAN_I_USE',
    startOAuthSession: 'START_OAUTH_SESSION',
    cancelOAuthSession: 'CANCEL_OAUTH_SESSION',

    storageSet: 'STORAGE_SET',
    setStorage: 'STORAGE_SET',
    setStorageSync: 'STORAGE_SET',
    storageGet: 'STORAGE_GET',
    getStorage: 'STORAGE_GET',
    getStorageSync: 'STORAGE_GET',
    storageRemove: 'STORAGE_REMOVE',
    removeStorage: 'STORAGE_REMOVE',
    removeStorageSync: 'STORAGE_REMOVE',
    storageClear: 'STORAGE_CLEAR',
    clearStorage: 'STORAGE_CLEAR',
    clearStorageSync: 'STORAGE_CLEAR',
    secureStorageSet: 'SECURE_STORAGE_SET',
    secureStorageGet: 'SECURE_STORAGE_GET',
    secureStorageRemove: 'SECURE_STORAGE_REMOVE',
    secureStorageClear: 'SECURE_STORAGE_CLEAR',
    getCookies: 'COOKIE_GET',
    getCookie: 'COOKIE_GET',
    setCookie: 'COOKIE_SET',
    removeCookie: 'COOKIE_REMOVE',
    clearCookies: 'COOKIE_REMOVE_ALL',
    removeAllCookies: 'COOKIE_REMOVE_ALL',
    getWebStorageQuota: 'WEB_STORAGE_GET_QUOTA_USAGE',
    clearWebStorage: 'WEB_STORAGE_CLEAR',
    saveHttpAuthCredential: 'HTTP_AUTH_SAVE_CREDENTIAL',
    clearHttpAuthCredentials: 'HTTP_AUTH_CLEAR_CREDENTIALS',

    writeFile: 'FS_WRITE_FILE',
    readFile: 'FS_READ_FILE',
    mkdir: 'FS_MKDIR',
    rmdir: 'FS_RMDIR',
    unlink: 'FS_UNLINK',
    listDir: 'FS_LIST_DIR',
    readDir: 'FS_LIST_DIR',
    stat: 'FS_STAT',
    getFileInfo: 'FS_STAT',
    copyFile: 'FS_COPY_FILE',
    exists: 'FS_EXISTS',
    access: 'FS_EXISTS',
    chooseFiles: 'CHOOSE_FILES',
    chooseFile: 'CHOOSE_FILES',
    cancelFileChooser: 'CANCEL_FILE_CHOOSER',
    saveFile: 'CANCEL_FILE_CHOOSER',

    apiRequest: 'API_REQUEST',
    request: 'API_REQUEST',
    downloadFile: 'DOWNLOAD_FILE',
    uploadFile: 'UPLOAD_FILE',
    getNetworkType: 'GET_NETWORK_TYPE',
    isConnected: 'IS_CONNECTED',
    onNetworkStatusChange: 'IS_CONNECTED',
    connectSocket: 'WEBSOCKET_CONNECT',
    sendSocketMessage: 'WEBSOCKET_SEND',
    closeSocket: 'WEBSOCKET_CLOSE',
    verifySslPin: 'VERIFY_SSL_PIN',
    auditSslPinning: 'VERIFY_SSL_PIN',
    auditNetworkCertificate: 'AUDIT_NETWORK_CERTIFICATE',

    showToast: 'SHOW_TOAST',
    hideToast: 'HIDE_TOAST',
    showModal: 'SHOW_MODAL',
    showActionSheet: 'SHOW_ACTION_SHEET',
    showLoading: 'SHOW_LOADING',
    hideLoading: 'HIDE_LOADING',
    getKeyboardInsets: 'GET_KEYBOARD_INSETS',
    setKeyboardInsets: 'SET_KEYBOARD_INSETS',
    setNavBarTitle: 'SET_NAV_BAR_TITLE',
    setNavigationBarTitle: 'SET_NAV_BAR_TITLE',
    setNavBarColor: 'SET_NAV_BAR_COLOR',
    setNavigationBarColor: 'SET_NAV_BAR_COLOR',
    setNavBarButtons: 'SET_NAV_BAR_BUTTONS',
    setNavBarProgress: 'SET_NAV_BAR_PROGRESS',
    expandBottomSheet: 'EXPAND_BOTTOM_SHEET',
    showBottomSheet: 'EXPAND_BOTTOM_SHEET',
    collapseBottomSheet: 'COLLAPSE_BOTTOM_SHEET',
    hideBottomSheet: 'COLLAPSE_BOTTOM_SHEET',
    setSheetSnapPoints: 'SET_SHEET_SNAP_POINTS',
    getSafeAreaInsets: 'GET_SAFE_AREA_INSETS',
    openExternalLink: 'OPEN_EXTERNAL_LINK',
    showExternalLinkWarning: 'OPEN_EXTERNAL_LINK',
    openUrl: 'OPEN_EXTERNAL_LINK',
    openLink: 'OPEN_EXTERNAL_LINK',
    tabOpen: 'TAB_OPEN',
    showMultiTabSheet: 'TAB_OPEN',
    tabClose: 'TAB_CLOSE',
    tabSwitch: 'TAB_SWITCH',
    tabGetActive: 'TAB_GET_ACTIVE',
    tabList: 'TAB_LIST',
    tabCloseAll: 'TAB_CLOSE_ALL',
    openMiniApp: 'OPEN_MINI_APP',
    openCrossAppWindow: 'OPEN_MINI_APP',
    closeMiniApp: 'CLOSE_MINI_APP',
    onMiniAppClosed: 'ON_MINI_APP_CLOSED',

    startAccelerometer: 'START_ACCELEROMETER',
    stopAccelerometer: 'STOP_ACCELEROMETER',
    getLatestAccelerometer: 'GET_LATEST_ACCELEROMETER',
    startCompass: 'START_COMPASS',
    stopCompass: 'STOP_COMPASS',
    startGyroscope: 'START_GYROSCOPE',
    stopGyroscope: 'STOP_GYROSCOPE',
    getLatestGyroscope: 'GET_LATEST_GYROSCOPE',
    startDeviceMotion: 'START_DEVICE_MOTION',
    stopDeviceMotion: 'STOP_DEVICE_MOTION',
    getLatestDeviceMotion: 'GET_LATEST_DEVICE_MOTION',
    makePhoneCall: 'MAKE_PHONE_CALL',
    sendSms: 'SEND_SMS',

    getLocation: 'GET_LOCATION',
    chooseLocation: 'CHOOSE_LOCATION',
    openLocation: 'OPEN_LOCATION',
    startGeofence: 'START_GEOFENCE',
    geofence: 'START_GEOFENCE',
    stopGeofence: 'STOP_GEOFENCE',
    listGeofences: 'LIST_GEOFENCES',
    evaluateGeofence: 'EVALUATE_GEOFENCE',
    onLocationChange: 'EVALUATE_GEOFENCE',

    checkBiometricSupport: 'CHECK_BIOMETRIC_SUPPORT',
    checkBiometricsSupport: 'CHECK_BIOMETRIC_SUPPORT',
    biometricAuth: 'BIOMETRIC_AUTH',
    authenticateWithBiometrics: 'BIOMETRIC_AUTH',
    checkPermission: 'CHECK_PERMISSION',
    requestPermission: 'REQUEST_PERMISSION',
    requestPermissionWithPriming: 'REQUEST_PERMISSION',
    getSetting: 'GET_SETTING',
    getAppAuthorizeSetting: 'GET_SETTING',
    openSetting: 'OPEN_SETTING',
    openAppPermissionSettings: 'OPEN_SETTING',
    authorize: 'AUTHORIZE',
    auditSandboxHeaders: 'AUDIT_SANDBOX_HEADERS',

    scanCode: 'SCAN_CODE',
    chooseMedia: 'CHOOSE_MEDIA',
    chooseImage: 'CHOOSE_MEDIA',
    chooseVideo: 'CHOOSE_MEDIA',
    previewImage: 'PREVIEW_IMAGE',
    audioPlay: 'AUDIO_PLAY',
    audioPause: 'AUDIO_PAUSE',
    audioStop: 'AUDIO_STOP',
    audioSeek: 'AUDIO_SEEK',

    chooseContact: 'CHOOSE_CONTACT',
    pickContacts: 'PICK_CONTACTS',
    getContactsCount: 'GET_CONTACTS_COUNT',
    shareSheet: 'SHARE_SHEET',
    share: 'SHARE_SHEET',
    shareAppMessage: 'SHARE_SHEET',
    shareToStory: 'SHARE_TO_STORY',
    shareToTimeline: 'SHARE_TO_STORY',

    getNotificationToken: 'PUSH_GET_TOKEN',
    getPushToken: 'PUSH_GET_TOKEN',
    'push.getToken': 'PUSH_GET_TOKEN',
    'push.getPushToken': 'PUSH_GET_TOKEN',
    requestNotificationPermission: 'PUSH_REQUEST_PERMISSION',
    'push.requestPermission': 'PUSH_REQUEST_PERMISSION',
    setBadge: 'PUSH_SET_BADGE',
    setBadgeCount: 'PUSH_SET_BADGE',
    'push.setBadge': 'PUSH_SET_BADGE',
    showNotification: 'PUSH_SHOW_NOTIFICATION',
    showLocalNotification: 'PUSH_SHOW_NOTIFICATION',
    'push.showNotification': 'PUSH_SHOW_NOTIFICATION',
    subscribePushTopic: 'SUBSCRIBE_PUSH_TOPIC',
    subscribeTopic: 'SUBSCRIBE_PUSH_TOPIC',
    'push.subscribeTopic': 'SUBSCRIBE_PUSH_TOPIC',
    unsubscribePushTopic: 'UNSUBSCRIBE_PUSH_TOPIC',
    unsubscribeTopic: 'UNSUBSCRIBE_PUSH_TOPIC',
    'push.unsubscribeTopic': 'UNSUBSCRIBE_PUSH_TOPIC',
    getPendingNotifications: 'GET_PENDING_NOTIFICATIONS',
    'push.getPending': 'GET_PENDING_NOTIFICATIONS',
    clearNotifications: 'CLEAR_NOTIFICATIONS',
    'push.clear': 'CLEAR_NOTIFICATIONS',

    startBleScan: 'BLE_START_SCAN',
    bleStartScan: 'BLE_START_SCAN',
    openBluetoothAdapter: 'BLE_START_SCAN',
    startBluetoothDevicesDiscovery: 'BLE_START_SCAN',
    stopBleScan: 'BLE_STOP_SCAN',
    bleStopScan: 'BLE_STOP_SCAN',
    closeBluetoothAdapter: 'BLE_STOP_SCAN',
    stopBluetoothDevicesDiscovery: 'BLE_STOP_SCAN',
    connectBleDevice: 'BLE_CONNECT',
    bleConnect: 'BLE_CONNECT',
    createBLEConnection: 'BLE_CONNECT',
    disconnectBleDevice: 'DISCONNECT_BLE_DEVICE',
    closeBLEConnection: 'DISCONNECT_BLE_DEVICE',
    readBleChar: 'BLE_READ_CHARACTERISTIC',
    bleReadCharacteristic: 'BLE_READ_CHARACTERISTIC',
    readBLECharacteristicValue: 'BLE_READ_CHARACTERISTIC',
    writeBleChar: 'BLE_WRITE_CHARACTERISTIC',
    bleWriteCharacteristic: 'BLE_WRITE_CHARACTERISTIC',
    writeBLECharacteristicValue: 'BLE_WRITE_CHARACTERISTIC',
    readNfcTag: 'NFC_READ_TAG',
    nfcReadTag: 'NFC_READ_TAG',
    readNfcNdefMessage: 'READ_NFC_NDEF_MESSAGE',
    writeNfcTag: 'NFC_WRITE_TAG',
    nfcWriteTag: 'NFC_WRITE_TAG',
    startNfcDiscovery: 'START_NFC_DISCOVERY',
    stopNfcDiscovery: 'STOP_NFC_DISCOVERY',

    web3ConnectWallet: 'WEB3_CONNECT_WALLET',
    requestWalletConnect: 'WEB3_CONNECT_WALLET',
    web3SignTransaction: 'WEB3_SIGN_TRANSACTION',
    signTransaction: 'WEB3_SIGN_TRANSACTION',
    web3SignMessage: 'WEB3_SIGN_MESSAGE',
    signMessage: 'WEB3_SIGN_MESSAGE',
    web3SwitchChain: 'WEB3_SWITCH_CHAIN',
    switchChain: 'WEB3_SWITCH_CHAIN',
    checkPasskeySupport: 'PASSKEY_CHECK_SUPPORT',
    registerCredential: 'PASSKEY_REGISTER',
    assertCredential: 'PASSKEY_ASSERT',
    vaultEncrypt: 'VAULT_ENCRYPT',
    vaultDecrypt: 'VAULT_DECRYPT',
    walletSavePass: 'WALLET_SAVE_PASS',
    savePass: 'WALLET_SAVE_PASS',
    walletGetPassState: 'WALLET_GET_PASS_STATE',
    hasPass: 'WALLET_GET_PASS_STATE',
    walletOpenPass: 'WALLET_OPEN_PASS',
    walletListPasses: 'WALLET_LIST_PASSES',
    walletDeletePass: 'WALLET_DELETE_PASS',
    web3Disconnect: 'WEB3_DISCONNECT',
    web3GetAccount: 'WEB3_GET_ACCOUNT',
    openInvoice: 'OPEN_INVOICE',
    requestPayment: 'OPEN_INVOICE',
    getPurchaseProducts: 'GET_PURCHASE_PRODUCTS',
    getInAppProducts: 'GET_PURCHASE_PRODUCTS',
    restorePurchases: 'RESTORE_PURCHASES',
    buyInAppProduct: 'RESTORE_PURCHASES',

    createBinaryPort: 'CREATE_BINARY_PORT',
    postBinaryMessage: 'POST_BINARY_MESSAGE',
    readBinaryMessage: 'READ_BINARY_MESSAGE',
    onBinaryMessage: 'READ_BINARY_MESSAGE',
    closeBinaryPort: 'CLOSE_BINARY_PORT',

    canGoBack: 'CAN_GO_BACK',
    handleBackPress: 'HANDLE_BACK_PRESS',
    pushHistoryState: 'PUSH_HISTORY_STATE',
    getCurrentRoute: 'GET_CURRENT_ROUTE',
    navigateTo: 'NAV_PUSH',
    navPush: 'NAV_PUSH',
    navPop: 'NAV_POP',
    reLaunch: 'NAV_POP_TO_ROOT',
    navPopToRoot: 'NAV_POP_TO_ROOT',
    redirectTo: 'NAV_REPLACE',
    switchTab: 'NAV_REPLACE',
    navReplace: 'NAV_REPLACE',
    getPageStack: 'GET_PAGE_STACK',
    enablePredictiveBack: 'PREDICTIVE_BACK_PROGRESS',
    predictiveBackProgress: 'PREDICTIVE_BACK_PROGRESS',
    onPredictiveBackGesture: 'PREDICTIVE_BACK_INVOKE',
    predictiveBackInvoke: 'PREDICTIVE_BACK_INVOKE',
    predictiveBackCancel: 'PREDICTIVE_BACK_CANCEL',

    loadSubpackage: 'LOAD_SUBPACKAGE',
    isSubpackageCached: 'IS_SUBPACKAGE_CACHED',
    clearSubpackageCache: 'CLEAR_SUBPACKAGE_CACHE',
    getSubpackages: 'GET_SUBPACKAGES',
    prefetchSubpackage: 'GET_SUBPACKAGES',
    precompileBytecode: 'PRECOMPILE_BYTECODE',
    compileBytecodeCache: 'PRECOMPILE_BYTECODE',
    isBytecodeWarm: 'IS_BYTECODE_WARM',
    clearBytecodeCache: 'CLEAR_BYTECODE_CACHE',
    getBytecodeStats: 'GET_BYTECODE_STATS',
    validateWasmSupport: 'VALIDATE_WASM_SUPPORT',
    probeWasmSupport: 'VALIDATE_WASM_SUPPORT',

    configureTransparency: 'CONFIGURE_TRANSPARENCY',
    setWebviewTransparent: 'CONFIGURE_TRANSPARENCY',
    syncThemeBg: 'SYNC_THEME_BACKGROUND',
    setWindowBackground: 'SYNC_THEME_BACKGROUND',
    preventWhiteFlash: 'SYNC_THEME_BACKGROUND',
    syncThemeBackground: 'SYNC_THEME_BACKGROUND',
    getRenderLayerConfig: 'GET_RENDER_LAYER_CONFIG',
    gestureScrollUpdate: 'GESTURE_SCROLL_UPDATE',
    shouldParentIntercept: 'SHOULD_PARENT_INTERCEPT',
    resetGestureCoordinator: 'RESET_GESTURE_COORDINATOR',
    embedNativeView: 'EMBED_NATIVE_VIEW',
    enableSameLayerRendering: 'EMBED_NATIVE_VIEW',
    updateNativeViewBounds: 'UPDATE_NATIVE_VIEW_BOUNDS',
    removeNativeView: 'REMOVE_NATIVE_VIEW',
    getActiveNativeViews: 'GET_ACTIVE_NATIVE_VIEWS',

    getApiCapabilities: 'GET_API_CAPABILITIES',
    getBridgeVersion: 'GET_API_CAPABILITIES',
    registerCapability: 'REGISTER_CAPABILITY',
    getSandboxProcessStatus: 'GET_SANDBOX_PROCESS_STATUS',
    getProcessStatus: 'GET_SANDBOX_PROCESS_STATUS',
    getStartupBenchmarkReport: 'GET_STARTUP_BENCHMARK_REPORT',
    getStartupPerformance: 'GET_STARTUP_BENCHMARK_REPORT',
    recordStartupBenchmarkSample: 'RECORD_STARTUP_BENCHMARK_SAMPLE',
    recordStartupSample: 'RECORD_STARTUP_BENCHMARK_SAMPLE',
    reportMetrics: 'REPORT_METRICS',
    reportApmMetric: 'REPORT_METRICS',
    sendApmMetric: 'SEND_APM_METRIC',
    getApmMetrics: 'GET_APM_METRICS',
    getApmSummary: 'GET_APM_SUMMARY',
    recordBridgeTiming: 'RECORD_BRIDGE_TIMING',
    startTrace: 'START_TRACE',
    stopTrace: 'STOP_TRACE',
    getTraces: 'GET_TRACES',
    getMemoryMetrics: 'GET_MEMORY_METRICS',
    getMemoryUsage: 'GET_MEMORY_METRICS',
  };

  if (aliasMap[trimmed]) {
    return aliasMap[trimmed];
  }

  // Convert camelCase or dot notation to UPPER_SNAKE_CASE
  const snake = trimmed
    .replace(/\./g, '_')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toUpperCase();

  if (SUPPORTED_ACTIONS.has(snake)) {
    return snake;
  }

  return snake;
}

/**
 * Dispatches an action string to its appropriate handler
 */
export async function dispatchBridgeAction(
  rawAction: string,
  payload: any = {},
  callerAppId: string = mockState.defaultAppId
): Promise<any> {
  const action = normalizeActionName(rawAction);

  switch (action) {
    // === Domain 1: Core & System Lifecycle (12) ===
    case 'GET_DEVICE_INFO':
      return CoreHandlers.getDeviceInfo();
    case 'HAPTIC_FEEDBACK':
      return CoreHandlers.triggerHaptic(payload);
    case 'SET_STATUS_BAR_THEME':
      return CoreHandlers.setStatusBarTheme(payload);
    case 'SET_SCREEN_BRIGHTNESS':
      return CoreHandlers.setScreenBrightness(payload);
    case 'GET_SCREEN_BRIGHTNESS':
      return CoreHandlers.getScreenBrightness();
    case 'SET_KEEP_SCREEN_ON':
      return CoreHandlers.setKeepScreenOn(payload);
    case 'CLIPBOARD_SET':
      return CoreHandlers.setClipboard(payload);
    case 'CLIPBOARD_GET':
      return CoreHandlers.getClipboard();
    case 'NAVIGATE_BACK':
      return CoreHandlers.navigateBack();
    case 'CAN_I_USE':
      return CoreHandlers.canIUse(payload, SUPPORTED_ACTIONS);
    case 'START_OAUTH_SESSION':
      return await CoreHandlers.startOAuthSession(payload);
    case 'CANCEL_OAUTH_SESSION':
      return CoreHandlers.cancelOAuthSession();

    // === Domain 2: Multi-Tenant Storage & Sandboxing (16) ===
    case 'STORAGE_SET':
      return StorageHandlers.storageSet(payload, callerAppId);
    case 'STORAGE_GET':
      return StorageHandlers.storageGet(payload, callerAppId);
    case 'STORAGE_REMOVE':
      return StorageHandlers.storageRemove(payload, callerAppId);
    case 'STORAGE_CLEAR':
      return StorageHandlers.storageClear(payload, callerAppId);
    case 'SECURE_STORAGE_SET':
      return StorageHandlers.secureStorageSet(payload, callerAppId);
    case 'SECURE_STORAGE_GET':
      return StorageHandlers.secureStorageGet(payload, callerAppId);
    case 'SECURE_STORAGE_REMOVE':
      return StorageHandlers.secureStorageRemove(payload, callerAppId);
    case 'SECURE_STORAGE_CLEAR':
      return StorageHandlers.secureStorageClear(payload, callerAppId);
    case 'COOKIE_GET':
      return StorageHandlers.getCookies(payload, callerAppId);
    case 'COOKIE_SET':
      return StorageHandlers.setCookie(payload, callerAppId);
    case 'COOKIE_REMOVE':
      return StorageHandlers.removeCookie(payload, callerAppId);
    case 'COOKIE_REMOVE_ALL':
      return StorageHandlers.clearCookies(payload, callerAppId);
    case 'WEB_STORAGE_GET_QUOTA_USAGE':
      return StorageHandlers.getWebStorageQuotaUsage(payload, callerAppId);
    case 'WEB_STORAGE_CLEAR':
      return StorageHandlers.clearWebStorage(payload, callerAppId);
    case 'HTTP_AUTH_SAVE_CREDENTIAL':
      return StorageHandlers.saveHttpAuthCredential(payload);
    case 'HTTP_AUTH_CLEAR_CREDENTIALS':
      return StorageHandlers.clearHttpAuthCredentials(payload);

    // === Domain 3: Sandboxed FileSystem & File Chooser (11) ===
    case 'FS_WRITE_FILE':
      return FileSystemHandlers.writeFile(payload, callerAppId);
    case 'FS_READ_FILE':
      return FileSystemHandlers.readFile(payload, callerAppId);
    case 'FS_MKDIR':
      return FileSystemHandlers.mkdir(payload, callerAppId);
    case 'FS_RMDIR':
      return FileSystemHandlers.rmdir(payload, callerAppId);
    case 'FS_UNLINK':
      return FileSystemHandlers.unlink(payload, callerAppId);
    case 'FS_LIST_DIR':
      return FileSystemHandlers.listDir(payload, callerAppId);
    case 'FS_STAT':
      return FileSystemHandlers.stat(payload, callerAppId);
    case 'FS_COPY_FILE':
      return FileSystemHandlers.copyFile(payload, callerAppId);
    case 'FS_EXISTS':
      return FileSystemHandlers.exists(payload, callerAppId);
    case 'CHOOSE_FILES':
      return await FileSystemHandlers.chooseFiles(payload);
    case 'CANCEL_FILE_CHOOSER':
      return FileSystemHandlers.cancelFileChooser();

    // === Domain 4: Networking, HTTP & WebSockets (10) ===
    case 'API_REQUEST':
      return await NetworkHandlers.apiRequest(payload);
    case 'DOWNLOAD_FILE':
      return NetworkHandlers.downloadFile(payload);
    case 'UPLOAD_FILE':
      return NetworkHandlers.uploadFile(payload);
    case 'GET_NETWORK_TYPE':
      return NetworkHandlers.getNetworkType();
    case 'IS_CONNECTED':
      return NetworkHandlers.isConnected();
    case 'WEBSOCKET_CONNECT':
      return NetworkHandlers.connectSocket(payload);
    case 'WEBSOCKET_SEND':
      return NetworkHandlers.sendSocketMessage(payload);
    case 'WEBSOCKET_CLOSE':
      return NetworkHandlers.closeSocket();
    case 'VERIFY_SSL_PIN':
      return NetworkHandlers.verifySslPin(payload);
    case 'AUDIT_NETWORK_CERTIFICATE':
      return NetworkHandlers.auditNetworkCertificate(payload);

    // === Domain 5: UI Feedback, Navigation Bar, Bottom Sheet & Window Insets (28) ===
    case 'SHOW_TOAST':
      return UIHandlers.showToast(payload);
    case 'HIDE_TOAST':
      return UIHandlers.hideToast();
    case 'SHOW_MODAL':
      return UIHandlers.showModal(payload);
    case 'SHOW_ACTION_SHEET':
      return UIHandlers.showActionSheet(payload);
    case 'SHOW_LOADING':
      return UIHandlers.showLoading(payload);
    case 'HIDE_LOADING':
      return UIHandlers.hideLoading();
    case 'GET_KEYBOARD_INSETS':
      return UIHandlers.getKeyboardInsets();
    case 'SET_KEYBOARD_INSETS':
      return UIHandlers.setKeyboardInsets(payload);
    case 'SET_NAV_BAR_TITLE':
      return UIHandlers.setNavBarTitle(payload);
    case 'SET_NAV_BAR_COLOR':
      return UIHandlers.setNavBarColor(payload);
    case 'SET_NAV_BAR_BUTTONS':
      return UIHandlers.setNavBarButtons(payload);
    case 'SET_NAV_BAR_PROGRESS':
      return UIHandlers.setNavBarProgress(payload);
    case 'EXPAND_BOTTOM_SHEET':
      return UIHandlers.expandBottomSheet();
    case 'COLLAPSE_BOTTOM_SHEET':
      return UIHandlers.collapseBottomSheet();
    case 'SET_SHEET_SNAP_POINTS':
      return UIHandlers.setSheetSnapPoints(payload);
    case 'GET_SAFE_AREA_INSETS':
      return UIHandlers.getSafeAreaInsets();
    case 'OPEN_EXTERNAL_LINK':
    case 'OPEN_URL':
    case 'OPEN_LINK':
      return await UIHandlers.openExternalLink(payload);
    case 'TAB_OPEN':
      return UIHandlers.tabOpen(payload, callerAppId);
    case 'TAB_CLOSE':
      return UIHandlers.tabClose(payload);
    case 'TAB_SWITCH':
      return UIHandlers.tabSwitch(payload);
    case 'TAB_GET_ACTIVE':
      return UIHandlers.tabGetActive();
    case 'TAB_LIST':
      return UIHandlers.tabList();
    case 'TAB_CLOSE_ALL':
      return UIHandlers.tabCloseAll();
    case 'OPEN_MINI_APP':
      return UIHandlers.openMiniApp(payload);
    case 'CLOSE_MINI_APP':
      return UIHandlers.closeMiniApp(payload);
    case 'ON_MINI_APP_CLOSED':
      return UIHandlers.onMiniAppClosed();

    // === Domain 6: Hardware Sensors & Telephony (12) ===
    case 'START_ACCELEROMETER':
      return SensorHandlers.startAccelerometer(payload);
    case 'STOP_ACCELEROMETER':
      return SensorHandlers.stopAccelerometer();
    case 'GET_LATEST_ACCELEROMETER':
      return SensorHandlers.getLatestAccelerometer();
    case 'START_COMPASS':
      return SensorHandlers.startCompass(payload);
    case 'STOP_COMPASS':
      return SensorHandlers.stopCompass();
    case 'START_GYROSCOPE':
      return SensorHandlers.startGyroscope(payload);
    case 'STOP_GYROSCOPE':
      return SensorHandlers.stopGyroscope();
    case 'GET_LATEST_GYROSCOPE':
      return SensorHandlers.getLatestGyroscope();
    case 'START_DEVICE_MOTION':
      return SensorHandlers.startDeviceMotion(payload);
    case 'STOP_DEVICE_MOTION':
      return SensorHandlers.stopDeviceMotion();
    case 'GET_LATEST_DEVICE_MOTION':
      return SensorHandlers.getLatestDeviceMotion();
    case 'MAKE_PHONE_CALL':
      return SensorHandlers.makePhoneCall(payload);
    case 'SEND_SMS':
      return SensorHandlers.sendSms(payload);

    // === Domain 7: Location & Geofencing (7) ===
    case 'GET_LOCATION':
      return LocationHandlers.getLocation(payload);
    case 'CHOOSE_LOCATION':
      return LocationHandlers.chooseLocation();
    case 'OPEN_LOCATION':
      return LocationHandlers.openLocation(payload);
    case 'START_GEOFENCE':
      return LocationHandlers.startGeofence(payload);
    case 'STOP_GEOFENCE':
      return LocationHandlers.stopGeofence(payload);
    case 'LIST_GEOFENCES':
      return LocationHandlers.listGeofences();
    case 'EVALUATE_GEOFENCE':
      return LocationHandlers.evaluateGeofence(payload);

    // === Domain 8: Biometrics & Permissions (8) ===
    case 'CHECK_BIOMETRIC_SUPPORT':
      return BiometricHandlers.checkBiometricSupport();
    case 'BIOMETRIC_AUTH':
      return await BiometricHandlers.biometricAuth(payload);
    case 'CHECK_PERMISSION':
      return BiometricHandlers.checkPermission(payload);
    case 'REQUEST_PERMISSION':
      return await BiometricHandlers.requestPermission(payload);
    case 'GET_SETTING':
      return BiometricHandlers.getSetting();
    case 'OPEN_SETTING':
      return BiometricHandlers.openSetting();
    case 'AUTHORIZE':
      return BiometricHandlers.authorize(payload);
    case 'AUDIT_SANDBOX_HEADERS':
      return BiometricHandlers.auditSandboxHeaders();

    // === Domain 9: Media & Audio (7) ===
    case 'SCAN_CODE':
      return await MediaHandlers.scanCode(payload);
    case 'CHOOSE_MEDIA':
      return MediaHandlers.chooseMedia(payload);
    case 'PREVIEW_IMAGE':
      return MediaHandlers.previewImage(payload);
    case 'AUDIO_PLAY':
      return MediaHandlers.audioPlay(payload);
    case 'AUDIO_PAUSE':
      return MediaHandlers.audioPause();
    case 'AUDIO_STOP':
      return MediaHandlers.audioStop();
    case 'AUDIO_SEEK':
      return MediaHandlers.audioSeek(payload);

    // === Domain 10: Contacts & Social Sharing (5) ===
    case 'CHOOSE_CONTACT':
    case 'PICK_CONTACTS':
      return ContactsHandlers.chooseContact();
    case 'GET_CONTACTS_COUNT':
      return ContactsHandlers.getContactsCount();
    case 'SHARE_SHEET':
      return ContactsHandlers.shareSheet(payload);
    case 'SHARE_TO_STORY':
      return ContactsHandlers.shareToStory(payload);

    // === Domain 11: Push Notifications (9) ===
    case 'PUSH_GET_TOKEN':
    case 'GET_PUSH_TOKEN':
      return PushHandlers.getPushToken(payload, callerAppId);
    case 'PUSH_REQUEST_PERMISSION':
      return PushHandlers.requestPermission();
    case 'PUSH_SET_BADGE':
      return PushHandlers.setBadge(payload);
    case 'PUSH_SHOW_NOTIFICATION':
      return PushHandlers.showNotification(payload);
    case 'SUBSCRIBE_PUSH_TOPIC':
      return PushHandlers.subscribeTopic(payload);
    case 'UNSUBSCRIBE_PUSH_TOPIC':
      return PushHandlers.unsubscribeTopic(payload);
    case 'GET_PENDING_NOTIFICATIONS':
      return PushHandlers.getPending();
    case 'CLEAR_NOTIFICATIONS':
      return PushHandlers.clear();

    // === Domain 12: Bluetooth Low Energy & NFC (16) ===
    case 'BLE_START_SCAN':
    case 'START_BLE_SCAN':
      return BleNfcHandlers.startScan(payload);
    case 'BLE_STOP_SCAN':
    case 'STOP_BLE_SCAN':
      return BleNfcHandlers.stopScan();
    case 'BLE_CONNECT':
    case 'CONNECT_BLE_DEVICE':
      return BleNfcHandlers.connect(payload);
    case 'DISCONNECT_BLE_DEVICE':
      return BleNfcHandlers.disconnect(payload);
    case 'BLE_READ_CHARACTERISTIC':
    case 'READ_BLE_CHARACTERISTIC':
      return BleNfcHandlers.readCharacteristic(payload);
    case 'BLE_WRITE_CHARACTERISTIC':
    case 'WRITE_BLE_CHARACTERISTIC':
      return BleNfcHandlers.writeCharacteristic(payload);
    case 'NFC_READ_TAG':
      return BleNfcHandlers.readTag();
    case 'READ_NFC_NDEF_MESSAGE':
      return BleNfcHandlers.readTag();
    case 'NFC_WRITE_TAG':
      return BleNfcHandlers.writeTag(payload);
    case 'START_NFC_DISCOVERY':
      return BleNfcHandlers.startNfcDiscovery();
    case 'STOP_NFC_DISCOVERY':
      return BleNfcHandlers.stopNfcDiscovery();

    // === Domain 13: Web3 & Payments (9) ===
    case 'WEB3_CONNECT_WALLET':
      return Web3Handlers.connectWallet(payload);
    case 'WEB3_SIGN_TRANSACTION':
      return Web3Handlers.signTransaction(payload);
    case 'WEB3_SIGN_MESSAGE':
      return Web3Handlers.signMessage(payload);
    case 'PASSKEY_CHECK_SUPPORT':
    case 'CHECK_PASSKEY_SUPPORT':
      return PasskeyHandlers.checkSupport();
    case 'PASSKEY_REGISTER':
      return PasskeyHandlers.register(payload);
    case 'PASSKEY_ASSERT':
      return PasskeyHandlers.assert(payload);
    case 'VAULT_ENCRYPT':
      return PasskeyHandlers.encryptVault(payload);
    case 'VAULT_DECRYPT':
      return PasskeyHandlers.decryptVault(payload);

    case 'WALLET_SAVE_PASS':
      return PassHandlers.savePass(payload);
    case 'WALLET_GET_PASS_STATE':
      return PassHandlers.getPassState(payload);
    case 'WALLET_OPEN_PASS':
      return PassHandlers.openPass(payload);
    case 'WALLET_LIST_PASSES':
      return PassHandlers.listPasses(payload);
    case 'WALLET_DELETE_PASS':
      return PassHandlers.deletePass(payload);

    case 'WEB3_SWITCH_CHAIN':
      return Web3Handlers.switchChain(payload);
    case 'WEB3_DISCONNECT':
      return Web3Handlers.disconnect();
    case 'WEB3_GET_ACCOUNT':
      return Web3Handlers.getAccount();
    case 'OPEN_INVOICE':
      return await Web3Handlers.openInvoice(payload);
    case 'GET_PURCHASE_PRODUCTS':
      return Web3Handlers.getProducts();
    case 'RESTORE_PURCHASES':
      return Web3Handlers.restorePurchases();

    // === Domain 14: Binary IPC Channels (4) ===
    case 'CREATE_BINARY_PORT':
      return BinaryHandlers.createPort(payload);
    case 'POST_BINARY_MESSAGE':
      return BinaryHandlers.postMessage(payload);
    case 'READ_BINARY_MESSAGE':
      return BinaryHandlers.readMessage(payload);
    case 'CLOSE_BINARY_PORT':
      return BinaryHandlers.closePort(payload);

    // === Domain 15: Navigation & Predictive Back (12) ===
    case 'CAN_GO_BACK':
      return NavigationHandlers.canGoBack();
    case 'HANDLE_BACK_PRESS':
      return NavigationHandlers.handleBackPress();
    case 'PUSH_HISTORY_STATE':
      return NavigationHandlers.pushHistoryState(payload);
    case 'GET_CURRENT_ROUTE':
      return NavigationHandlers.getCurrentRoute();
    case 'NAV_PUSH':
      return NavigationHandlers.navPush(payload);
    case 'NAV_POP':
      return NavigationHandlers.navPop();
    case 'NAV_POP_TO_ROOT':
      return NavigationHandlers.navPopToRoot();
    case 'NAV_REPLACE':
      return NavigationHandlers.navReplace(payload);
    case 'GET_PAGE_STACK':
      return NavigationHandlers.getPageStack();
    case 'PREDICTIVE_BACK_PROGRESS':
      return NavigationHandlers.predictiveBackProgress(payload);
    case 'PREDICTIVE_BACK_INVOKE':
      return NavigationHandlers.predictiveBackInvoke();
    case 'PREDICTIVE_BACK_CANCEL':
      return NavigationHandlers.predictiveBackCancel();

    // === Domain 16: Subpackages, WASM & Bytecode (9) ===
    case 'LOAD_SUBPACKAGE':
      return await SubpackageHandlers.loadSubpackage(payload, callerAppId);
    case 'IS_SUBPACKAGE_CACHED':
      return SubpackageHandlers.isSubpackageCached(payload, callerAppId);
    case 'CLEAR_SUBPACKAGE_CACHE':
      return SubpackageHandlers.clearSubpackageCache(payload, callerAppId);
    case 'GET_SUBPACKAGES':
      return SubpackageHandlers.getSubpackages(payload, callerAppId);
    case 'PRECOMPILE_BYTECODE':
      return await SubpackageHandlers.precompileBytecode(payload, callerAppId);
    case 'IS_BYTECODE_WARM':
      return SubpackageHandlers.isBytecodeWarm(payload, callerAppId);
    case 'CLEAR_BYTECODE_CACHE':
      return SubpackageHandlers.clearBytecodeCache(payload, callerAppId);
    case 'GET_BYTECODE_STATS':
      return SubpackageHandlers.getBytecodeStats();
    case 'VALIDATE_WASM_SUPPORT':
      return SubpackageHandlers.validateWasmSupport();

    // === Domain 17: Visual Rendering & Same-Layer (10) ===
    case 'CONFIGURE_TRANSPARENCY':
      return RenderHandlers.configureTransparency(payload);
    case 'SYNC_THEME_BACKGROUND':
      return RenderHandlers.syncThemeBg(payload);
    case 'GET_RENDER_LAYER_CONFIG':
      return RenderHandlers.getRenderLayerConfig();
    case 'GESTURE_SCROLL_UPDATE':
      return RenderHandlers.gestureScrollUpdate(payload);
    case 'SHOULD_PARENT_INTERCEPT':
      return RenderHandlers.shouldParentIntercept(payload);
    case 'RESET_GESTURE_COORDINATOR':
      return RenderHandlers.resetGestureCoordinator();
    case 'EMBED_NATIVE_VIEW':
      return RenderHandlers.embedNativeView(payload);
    case 'UPDATE_NATIVE_VIEW_BOUNDS':
      return RenderHandlers.updateNativeViewBounds(payload);
    case 'REMOVE_NATIVE_VIEW':
      return RenderHandlers.removeNativeView(payload);
    case 'GET_ACTIVE_NATIVE_VIEWS':
      return RenderHandlers.getActiveNativeViews();

    // === Domain 18: Capability Discovery & APM Telemetry (14) ===
    case 'GET_API_CAPABILITIES':
      return ApmHandlers.getApiCapabilities(payload, SUPPORTED_ACTIONS);
    case 'REGISTER_CAPABILITY':
      return ApmHandlers.registerCapability(payload);
    case 'GET_SANDBOX_PROCESS_STATUS':
      return ApmHandlers.getSandboxProcessStatus(payload, callerAppId);
    case 'GET_STARTUP_BENCHMARK_REPORT':
      return ApmHandlers.getStartupBenchmarkReport();
    case 'RECORD_STARTUP_BENCHMARK_SAMPLE':
      return ApmHandlers.recordStartupBenchmarkSample(payload);
    case 'REPORT_METRICS':
      return ApmHandlers.reportMetrics(payload);
    case 'SEND_APM_METRIC':
      return ApmHandlers.reportMetrics(payload);
    case 'GET_APM_METRICS':
    case 'GET_APM_SUMMARY':
      return ApmHandlers.getApmMetrics();
    case 'RECORD_BRIDGE_TIMING':
      return ApmHandlers.recordBridgeTiming(payload);
    case 'START_TRACE':
      return ApmHandlers.startTrace(payload);
    case 'STOP_TRACE':
      return ApmHandlers.stopTrace(payload);
    case 'GET_TRACES':
      return ApmHandlers.getTraces();
    case 'GET_MEMORY_METRICS':
      return ApmHandlers.getMemoryMetrics();

    default:
      // Check dynamic capabilities before throwing
      if (mockState.dynamicCapabilities.has(action)) {
        return { success: true, action, dynamic: true };
      }
      throw new GoatBridgeError(
        BridgeErrorCodes.UNSUPPORTED_ACTION,
        `Unsupported native bridge action: "${rawAction}" (normalized: "${action}")`
      );
  }
}
