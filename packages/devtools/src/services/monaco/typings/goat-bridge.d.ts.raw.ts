/**
 * @goat/devtools - Raw Ambient TypeScript Declaration for GoatBridge
 * Injected directly into Monaco Editor TypeScript Language Service.
 */

export const GOAT_BRIDGE_DTS = `
/**
 * Canonical GoatBridge SDK Declaration
 * 203 High-Performance Native Bridge Actions across 18 Domains.
 */
declare namespace GoatBridge {
  export function invoke(action: 'CLIPBOARD_SET', payload?: any): Promise<any>;
  export function invoke(action: 'CLIPBOARD_GET', payload?: any): Promise<any>;
  export function invoke(action: 'NAVIGATE_BACK', payload?: any): Promise<any>;
  export function invoke(action: 'CAN_I_USE', payload?: any): Promise<any>;
  export function invoke(action: 'START_OAUTH_SESSION', payload?: any): Promise<any>;
  export function invoke(action: 'CANCEL_OAUTH_SESSION', payload?: any): Promise<any>;
  // Domain 2: Multi-Tenant Storage & Sandboxing (16 Actions)
  export function invoke(action: 'STORAGE_SET', payload?: any): Promise<any>;
  export function invoke(action: 'STORAGE_GET', payload?: any): Promise<any>;
  export function invoke(action: 'STORAGE_REMOVE', payload?: any): Promise<any>;
  export function invoke(action: 'STORAGE_CLEAR', payload?: any): Promise<any>;
  export function invoke(action: 'SECURE_STORAGE_SET', payload?: any): Promise<any>;
  export function invoke(action: 'SECURE_STORAGE_GET', payload?: any): Promise<any>;
  export function invoke(action: 'SECURE_STORAGE_REMOVE', payload?: any): Promise<any>;
  export function invoke(action: 'SECURE_STORAGE_CLEAR', payload?: any): Promise<any>;
  export function invoke(action: 'COOKIE_GET', payload?: any): Promise<any>;
  export function invoke(action: 'COOKIE_SET', payload?: any): Promise<any>;
  export function invoke(action: 'COOKIE_REMOVE', payload?: any): Promise<any>;
  export function invoke(action: 'COOKIE_REMOVE_ALL', payload?: any): Promise<any>;
  export function invoke(action: 'WEB_STORAGE_GET_QUOTA_USAGE', payload?: any): Promise<any>;
  export function invoke(action: 'WEB_STORAGE_CLEAR', payload?: any): Promise<any>;
  export function invoke(action: 'HTTP_AUTH_SAVE_CREDENTIAL', payload?: any): Promise<any>;
  export function invoke(action: 'HTTP_AUTH_CLEAR_CREDENTIALS', payload?: any): Promise<any>;
  // Domain 3: Sandboxed FileSystem & File Chooser (11 Actions)
  export function invoke(action: 'FS_WRITE_FILE', payload?: any): Promise<any>;
  export function invoke(action: 'FS_READ_FILE', payload?: any): Promise<any>;
  export function invoke(action: 'FS_MKDIR', payload?: any): Promise<any>;
  export function invoke(action: 'FS_RMDIR', payload?: any): Promise<any>;
  export function invoke(action: 'FS_UNLINK', payload?: any): Promise<any>;
  export function invoke(action: 'FS_LIST_DIR', payload?: any): Promise<any>;
  export function invoke(action: 'FS_STAT', payload?: any): Promise<any>;
  export function invoke(action: 'FS_COPY_FILE', payload?: any): Promise<any>;
  export function invoke(action: 'FS_EXISTS', payload?: any): Promise<any>;
  export function invoke(action: 'CHOOSE_FILES', payload?: any): Promise<any>;
  export function invoke(action: 'CANCEL_FILE_CHOOSER', payload?: any): Promise<any>;
  // Domain 4: Networking, HTTP & WebSockets (10 Actions)
  export function invoke(action: 'API_REQUEST', payload?: any): Promise<any>;
  export function invoke(action: 'DOWNLOAD_FILE', payload?: any): Promise<any>;
  export function invoke(action: 'UPLOAD_FILE', payload?: any): Promise<any>;
  export function invoke(action: 'GET_NETWORK_TYPE', payload?: any): Promise<any>;
  export function invoke(action: 'IS_CONNECTED', payload?: any): Promise<any>;
  export function invoke(action: 'WEBSOCKET_CONNECT', payload?: any): Promise<any>;
  export function invoke(action: 'WEBSOCKET_SEND', payload?: any): Promise<any>;
  export function invoke(action: 'WEBSOCKET_CLOSE', payload?: any): Promise<any>;
  export function invoke(action: 'VERIFY_SSL_PIN', payload?: any): Promise<any>;
  export function invoke(action: 'AUDIT_NETWORK_CERTIFICATE', payload?: any): Promise<any>;
  // Domain 5: UI Feedback & Window Insets (34 Actions)
  export function invoke(action: 'SHOW_TOAST', payload?: any): Promise<any>;
  export function invoke(action: 'HIDE_TOAST', payload?: any): Promise<any>;
  export function invoke(action: 'SHOW_MODAL', payload?: any): Promise<any>;
  export function invoke(action: 'SHOW_ACTION_SHEET', payload?: any): Promise<any>;
  export function invoke(action: 'SHOW_LOADING', payload?: any): Promise<any>;
  export function invoke(action: 'HIDE_LOADING', payload?: any): Promise<any>;
  export function invoke(action: 'GET_KEYBOARD_INSETS', payload?: any): Promise<any>;
  export function invoke(action: 'SET_KEYBOARD_INSETS', payload?: any): Promise<any>;
  export function invoke(action: 'SET_NAV_BAR_TITLE', payload?: any): Promise<any>;
  export function invoke(action: 'SET_NAV_BAR_COLOR', payload?: any): Promise<any>;
  export function invoke(action: 'SET_NAV_BAR_BUTTONS', payload?: any): Promise<any>;
  export function invoke(action: 'SET_NAV_BAR_PROGRESS', payload?: any): Promise<any>;
  export function invoke(action: 'EXPAND_BOTTOM_SHEET', payload?: any): Promise<any>;
  export function invoke(action: 'COLLAPSE_BOTTOM_SHEET', payload?: any): Promise<any>;
  export function invoke(action: 'SET_SHEET_SNAP_POINTS', payload?: any): Promise<any>;
  export function invoke(action: 'GET_SAFE_AREA_INSETS', payload?: any): Promise<any>;
  export function invoke(action: 'OPEN_EXTERNAL_LINK', payload?: any): Promise<any>;
  export function invoke(action: 'OPEN_URL', payload?: any): Promise<any>;
  export function invoke(action: 'OPEN_LINK', payload?: any): Promise<any>;
  export function invoke(action: 'TAB_OPEN', payload?: any): Promise<any>;
  export function invoke(action: 'TAB_CLOSE', payload?: any): Promise<any>;
  export function invoke(action: 'TAB_SWITCH', payload?: any): Promise<any>;
  export function invoke(action: 'TAB_GET_ACTIVE', payload?: any): Promise<any>;
  export function invoke(action: 'TAB_LIST', payload?: any): Promise<any>;
  export function invoke(action: 'TAB_CLOSE_ALL', payload?: any): Promise<any>;
  export function invoke(action: 'OPEN_MINI_APP', payload?: any): Promise<any>;
  export function invoke(action: 'CLOSE_MINI_APP', payload?: any): Promise<any>;
  export function invoke(action: 'ON_MINI_APP_CLOSED', payload?: any): Promise<any>;
  export function invoke(action: 'ON_APP_SERVICE_READY', payload?: any): Promise<any>;
  export function invoke(action: 'APP_SERVICE_READY', payload?: any): Promise<any>;
  export function invoke(action: 'ON_APP_SERVICE_CRASH', payload?: any): Promise<any>;
  export function invoke(action: 'APP_SERVICE_CRASH', payload?: any): Promise<any>;
  export function invoke(action: 'ON_APP_SERVICE_TERMINATE', payload?: any): Promise<any>;
  export function invoke(action: 'APP_SERVICE_TERMINATE', payload?: any): Promise<any>;
  // Domain 6: Hardware Sensors & Telephony (12 Actions)
  export function invoke(action: 'START_ACCELEROMETER', payload?: any): Promise<any>;
  export function invoke(action: 'STOP_ACCELEROMETER', payload?: any): Promise<any>;
  export function invoke(action: 'GET_LATEST_ACCELEROMETER', payload?: any): Promise<any>;
  export function invoke(action: 'START_COMPASS', payload?: any): Promise<any>;
  export function invoke(action: 'START_GYROSCOPE', payload?: any): Promise<any>;
  export function invoke(action: 'STOP_GYROSCOPE', payload?: any): Promise<any>;
  export function invoke(action: 'GET_LATEST_GYROSCOPE', payload?: any): Promise<any>;
  export function invoke(action: 'START_DEVICE_MOTION', payload?: any): Promise<any>;
  export function invoke(action: 'STOP_DEVICE_MOTION', payload?: any): Promise<any>;
  export function invoke(action: 'GET_LATEST_DEVICE_MOTION', payload?: any): Promise<any>;
  export function invoke(action: 'MAKE_PHONE_CALL', payload?: any): Promise<any>;
  export function invoke(action: 'SEND_SMS', payload?: any): Promise<any>;
  // Domain 7: Location & Geofencing (7 Actions)
  export function invoke(action: 'GET_LOCATION', payload?: any): Promise<any>;
  export function invoke(action: 'CHOOSE_LOCATION', payload?: any): Promise<any>;
  export function invoke(action: 'OPEN_LOCATION', payload?: any): Promise<any>;
  export function invoke(action: 'START_GEOFENCE', payload?: any): Promise<any>;
  export function invoke(action: 'STOP_GEOFENCE', payload?: any): Promise<any>;
  export function invoke(action: 'LIST_GEOFENCES', payload?: any): Promise<any>;
  export function invoke(action: 'EVALUATE_GEOFENCE', payload?: any): Promise<any>;
  // Domain 8: Biometrics & Permissions (8 Actions)
  export function invoke(action: 'CHECK_BIOMETRIC_SUPPORT', payload?: any): Promise<any>;
  export function invoke(action: 'BIOMETRIC_AUTH', payload?: any): Promise<any>;
  export function invoke(action: 'CHECK_PERMISSION', payload?: any): Promise<any>;
  export function invoke(action: 'REQUEST_PERMISSION', payload?: any): Promise<any>;
  export function invoke(action: 'GET_SETTING', payload?: any): Promise<any>;
  export function invoke(action: 'OPEN_SETTING', payload?: any): Promise<any>;
  export function invoke(action: 'AUTHORIZE', payload?: any): Promise<any>;
  export function invoke(action: 'AUDIT_SANDBOX_HEADERS', payload?: any): Promise<any>;
  // Domain 9: Media & Audio (7 Actions)
  export function invoke(action: 'SCAN_CODE', payload?: any): Promise<any>;
  export function invoke(action: 'CHOOSE_MEDIA', payload?: any): Promise<any>;
  export function invoke(action: 'PREVIEW_IMAGE', payload?: any): Promise<any>;
  export function invoke(action: 'AUDIO_PLAY', payload?: any): Promise<any>;
  export function invoke(action: 'AUDIO_PAUSE', payload?: any): Promise<any>;
  export function invoke(action: 'AUDIO_STOP', payload?: any): Promise<any>;
  export function invoke(action: 'AUDIO_SEEK', payload?: any): Promise<any>;
  // Domain 10: Contacts & Social Sharing (5 Actions)
  export function invoke(action: 'CHOOSE_CONTACT', payload?: any): Promise<any>;
  export function invoke(action: 'PICK_CONTACTS', payload?: any): Promise<any>;
  export function invoke(action: 'GET_CONTACTS_COUNT', payload?: any): Promise<any>;
  export function invoke(action: 'SHARE_SHEET', payload?: any): Promise<any>;
  export function invoke(action: 'SHARE_TO_STORY', payload?: any): Promise<any>;
  // Domain 11: Push Notifications (9 Actions)
  export function invoke(action: 'PUSH_GET_TOKEN', payload?: any): Promise<any>;
  export function invoke(action: 'GET_PUSH_TOKEN', payload?: any): Promise<any>;
  export function invoke(action: 'PUSH_REQUEST_PERMISSION', payload?: any): Promise<any>;
  export function invoke(action: 'PUSH_SET_BADGE', payload?: any): Promise<any>;
  export function invoke(action: 'PUSH_SHOW_NOTIFICATION', payload?: any): Promise<any>;
  export function invoke(action: 'SUBSCRIBE_PUSH_TOPIC', payload?: any): Promise<any>;
  export function invoke(action: 'UNSUBSCRIBE_PUSH_TOPIC', payload?: any): Promise<any>;
  export function invoke(action: 'GET_PENDING_NOTIFICATIONS', payload?: any): Promise<any>;
  export function invoke(action: 'CLEAR_NOTIFICATIONS', payload?: any): Promise<any>;
  // Domain 12: Bluetooth Low Energy & NFC (16 Actions)
  export function invoke(action: 'BLE_START_SCAN', payload?: any): Promise<any>;
  export function invoke(action: 'START_BLE_SCAN', payload?: any): Promise<any>;
  export function invoke(action: 'BLE_STOP_SCAN', payload?: any): Promise<any>;
  export function invoke(action: 'STOP_BLE_SCAN', payload?: any): Promise<any>;
  export function invoke(action: 'BLE_CONNECT', payload?: any): Promise<any>;
  export function invoke(action: 'CONNECT_BLE_DEVICE', payload?: any): Promise<any>;
  export function invoke(action: 'DISCONNECT_BLE_DEVICE', payload?: any): Promise<any>;
  export function invoke(action: 'BLE_READ_CHARACTERISTIC', payload?: any): Promise<any>;
  export function invoke(action: 'READ_BLE_CHARACTERISTIC', payload?: any): Promise<any>;
  export function invoke(action: 'BLE_WRITE_CHARACTERISTIC', payload?: any): Promise<any>;
  export function invoke(action: 'WRITE_BLE_CHARACTERISTIC', payload?: any): Promise<any>;
  export function invoke(action: 'NFC_READ_TAG', payload?: any): Promise<any>;
  export function invoke(action: 'READ_NFC_NDEF_MESSAGE', payload?: any): Promise<any>;
  export function invoke(action: 'NFC_WRITE_TAG', payload?: any): Promise<any>;
  export function invoke(action: 'START_NFC_DISCOVERY', payload?: any): Promise<any>;
  export function invoke(action: 'STOP_NFC_DISCOVERY', payload?: any): Promise<any>;
  // Domain 13: Web3 & Payments (7 Actions)
  export function invoke(action: 'WEB3_CONNECT_WALLET', payload?: any): Promise<any>;
  export function invoke(action: 'WEB3_SIGN_TRANSACTION', payload?: any): Promise<any>;
  export function invoke(action: 'WEB3_DISCONNECT', payload?: any): Promise<any>;
  export function invoke(action: 'WEB3_GET_ACCOUNT', payload?: any): Promise<any>;
  export function invoke(action: 'OPEN_INVOICE', payload?: any): Promise<any>;
  export function invoke(action: 'GET_PURCHASE_PRODUCTS', payload?: any): Promise<any>;
  export function invoke(action: 'RESTORE_PURCHASES', payload?: any): Promise<any>;
  // Domain 14: Binary IPC Channels (4 Actions)
  export function invoke(action: 'CREATE_BINARY_PORT', payload?: any): Promise<any>;
  export function invoke(action: 'POST_BINARY_MESSAGE', payload?: any): Promise<any>;
  export function invoke(action: 'READ_BINARY_MESSAGE', payload?: any): Promise<any>;
  export function invoke(action: 'CLOSE_BINARY_PORT', payload?: any): Promise<any>;
  // Domain 15: Navigation & Predictive Back (12 Actions)
  export function invoke(action: 'CAN_GO_BACK', payload?: any): Promise<any>;
  export function invoke(action: 'HANDLE_BACK_PRESS', payload?: any): Promise<any>;
  export function invoke(action: 'PUSH_HISTORY_STATE', payload?: any): Promise<any>;
  export function invoke(action: 'GET_CURRENT_ROUTE', payload?: any): Promise<any>;
  export function invoke(action: 'NAV_PUSH', payload?: any): Promise<any>;
  export function invoke(action: 'NAV_POP', payload?: any): Promise<any>;
  export function invoke(action: 'NAV_POP_TO_ROOT', payload?: any): Promise<any>;
  export function invoke(action: 'NAV_REPLACE', payload?: any): Promise<any>;
  export function invoke(action: 'GET_PAGE_STACK', payload?: any): Promise<any>;
  export function invoke(action: 'PREDICTIVE_BACK_PROGRESS', payload?: any): Promise<any>;
  export function invoke(action: 'PREDICTIVE_BACK_INVOKE', payload?: any): Promise<any>;
  export function invoke(action: 'PREDICTIVE_BACK_CANCEL', payload?: any): Promise<any>;
  // Domain 16: Subpackages, WASM & Bytecode (9 Actions)
  export function invoke(action: 'LOAD_SUBPACKAGE', payload?: any): Promise<any>;
  export function invoke(action: 'IS_SUBPACKAGE_CACHED', payload?: any): Promise<any>;
  export function invoke(action: 'CLEAR_SUBPACKAGE_CACHE', payload?: any): Promise<any>;
  export function invoke(action: 'GET_SUBPACKAGES', payload?: any): Promise<any>;
  export function invoke(action: 'PRECOMPILE_BYTECODE', payload?: any): Promise<any>;
  export function invoke(action: 'IS_BYTECODE_WARM', payload?: any): Promise<any>;
  export function invoke(action: 'CLEAR_BYTECODE_CACHE', payload?: any): Promise<any>;
  export function invoke(action: 'GET_BYTECODE_STATS', payload?: any): Promise<any>;
  export function invoke(action: 'VALIDATE_WASM_SUPPORT', payload?: any): Promise<any>;
  // Domain 17: Visual Rendering & Same-Layer (10 Actions)
  export function invoke(action: 'CONFIGURE_TRANSPARENCY', payload?: any): Promise<any>;
  export function invoke(action: 'SYNC_THEME_BACKGROUND', payload?: any): Promise<any>;
  export function invoke(action: 'GET_RENDER_LAYER_CONFIG', payload?: any): Promise<any>;
  export function invoke(action: 'GESTURE_SCROLL_UPDATE', payload?: any): Promise<any>;
  export function invoke(action: 'SHOULD_PARENT_INTERCEPT', payload?: any): Promise<any>;
  export function invoke(action: 'RESET_GESTURE_COORDINATOR', payload?: any): Promise<any>;
  export function invoke(action: 'EMBED_NATIVE_VIEW', payload?: any): Promise<any>;
  export function invoke(action: 'UPDATE_NATIVE_VIEW_BOUNDS', payload?: any): Promise<any>;
  export function invoke(action: 'REMOVE_NATIVE_VIEW', payload?: any): Promise<any>;
  export function invoke(action: 'GET_ACTIVE_NATIVE_VIEWS', payload?: any): Promise<any>;
  // Domain 18: Capability Discovery & APM Telemetry (14 Actions)
  export function invoke(action: 'GET_API_CAPABILITIES', payload?: any): Promise<any>;
  export function invoke(action: 'REGISTER_CAPABILITY', payload?: any): Promise<any>;
  export function invoke(action: 'GET_SANDBOX_PROCESS_STATUS', payload?: any): Promise<any>;
  export function invoke(action: 'GET_STARTUP_BENCHMARK_REPORT', payload?: any): Promise<any>;
  export function invoke(action: 'RECORD_STARTUP_BENCHMARK_SAMPLE', payload?: any): Promise<any>;
  export function invoke(action: 'REPORT_METRICS', payload?: any): Promise<any>;
  export function invoke(action: 'GET_APM_METRICS', payload?: any): Promise<any>;
  export function invoke(action: 'GET_APM_SUMMARY', payload?: any): Promise<any>;
  export function invoke(action: 'SEND_APM_METRIC', payload?: any): Promise<any>;
  export function invoke(action: 'RECORD_BRIDGE_TIMING', payload?: any): Promise<any>;
  export function invoke(action: 'START_TRACE', payload?: any): Promise<any>;
  export function invoke(action: 'STOP_TRACE', payload?: any): Promise<any>;
  export function invoke(action: 'GET_TRACES', payload?: any): Promise<any>;
  export function invoke(action: 'GET_MEMORY_METRICS', payload?: any): Promise<any>;

  export function invoke(action: string, payload?: any): Promise<any>;
  export function emit(event: string, data?: any): void;
  export function on(event: string, listener: (data: any) => void): () => void;
  export function off(event: string, listener?: (data: any) => void): void;
  export function canIUse(action: string): boolean;
}

declare class MiniAppBridge {
  static invoke(action: string, payload?: any): Promise<any>;
  static emit(event: string, data?: any): void;
  static on(event: string, listener: (data: any) => void): () => void;
  static off(event: string, listener?: (data: any) => void): void;
}

declare const bridge: typeof GoatBridge;
`;
