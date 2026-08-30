/**
 * @goat/devtools - Ambient TypeScript Declaration Raw String
 * Registered into Monaco's TypeScript language service via addExtraLib.
 */

export const GOAT_BRIDGE_DTS = `
declare type GoatBridgeAction =
  | 'GET_DEVICE_INFO'
  | 'DISCOVER_CAPABILITIES'
  | 'HAPTIC_FEEDBACK'
  | 'SET_STATUS_BAR_THEME'
  | 'SET_SCREEN_BRIGHTNESS'
  | 'GET_SCREEN_BRIGHTNESS'
  | 'SET_KEEP_SCREEN_ON'
  | 'CLIPBOARD_SET'
  | 'CLIPBOARD_GET'
  | 'NAVIGATE_BACK'
  | 'CAN_I_USE'
  | 'START_OAUTH_SESSION'
  | 'CANCEL_OAUTH_SESSION'
  | 'STORAGE_SET'
  | 'STORAGE_GET'
  | 'STORAGE_REMOVE'
  | 'STORAGE_CLEAR'
  | 'SECURE_STORAGE_SET'
  | 'SECURE_STORAGE_GET'
  | 'SECURE_STORAGE_REMOVE'
  | 'SECURE_STORAGE_CLEAR'
  | 'COOKIE_GET'
  | 'COOKIE_SET'
  | 'COOKIE_REMOVE'
  | 'COOKIE_REMOVE_ALL'
  | 'WEB_STORAGE_GET_QUOTA_USAGE'
  | 'WEB_STORAGE_CLEAR'
  | 'HTTP_AUTH_SAVE_CREDENTIAL'
  | 'HTTP_AUTH_CLEAR_CREDENTIALS'
  | 'FS_WRITE_FILE'
  | 'FS_READ_FILE'
  | 'FS_MKDIR'
  | 'FS_RMDIR'
  | 'FS_UNLINK'
  | 'FS_LIST_DIR'
  | 'FS_STAT'
  | 'FS_COPY_FILE'
  | 'FS_EXISTS'
  | 'CHOOSE_FILES'
  | 'CANCEL_FILE_CHOOSER'
  | 'API_REQUEST'
  | 'DOWNLOAD_FILE'
  | 'UPLOAD_FILE'
  | 'GET_NETWORK_TYPE'
  | 'IS_CONNECTED'
  | 'WEBSOCKET_CONNECT'
  | 'WEBSOCKET_SEND'
  | 'WEBSOCKET_CLOSE'
  | 'VERIFY_SSL_PIN'
  | 'AUDIT_NETWORK_CERTIFICATE'
  | 'SHOW_TOAST'
  | 'HIDE_TOAST'
  | 'SHOW_MODAL'
  | 'SHOW_ACTION_SHEET'
  | 'SHOW_LOADING'
  | 'HIDE_LOADING'
  | 'GET_KEYBOARD_INSETS'
  | 'SET_KEYBOARD_INSETS'
  | 'SET_NAV_BAR_TITLE'
  | 'SET_NAV_BAR_COLOR'
  | 'SET_NAV_BAR_BUTTONS'
  | 'SET_NAV_BAR_PROGRESS'
  | 'EXPAND_BOTTOM_SHEET'
  | 'COLLAPSE_BOTTOM_SHEET'
  | 'SET_SHEET_SNAP_POINTS'
  | 'GET_SAFE_AREA_INSETS'
  | 'OPEN_EXTERNAL_LINK'
  | 'OPEN_URL'
  | 'OPEN_LINK'
  | 'TAB_OPEN'
  | 'TAB_CLOSE'
  | 'TAB_SWITCH'
  | 'TAB_GET_ACTIVE'
  | 'TAB_LIST'
  | 'TAB_CLOSE_ALL'
  | 'OPEN_MINI_APP'
  | 'CLOSE_MINI_APP'
  | 'ON_MINI_APP_CLOSED'
  | 'START_ACCELEROMETER'
  | 'STOP_ACCELEROMETER'
  | 'GET_LATEST_ACCELEROMETER'
  | 'START_COMPASS'
  | 'START_GYROSCOPE'
  | 'STOP_GYROSCOPE'
  | 'GET_LATEST_GYROSCOPE'
  | 'START_DEVICE_MOTION'
  | 'STOP_DEVICE_MOTION'
  | 'GET_LATEST_DEVICE_MOTION'
  | 'MAKE_PHONE_CALL'
  | 'SEND_SMS'
  | 'GET_LOCATION'
  | 'CHOOSE_LOCATION'
  | 'OPEN_LOCATION'
  | 'START_GEOFENCE'
  | 'STOP_GEOFENCE'
  | 'LIST_GEOFENCES'
  | 'EVALUATE_GEOFENCE'
  | 'CHECK_BIOMETRIC_SUPPORT'
  | 'BIOMETRIC_AUTH'
  | 'CHECK_PERMISSION'
  | 'REQUEST_PERMISSION'
  | 'GET_SETTING'
  | 'OPEN_SETTING'
  | 'AUTHORIZE'
  | 'AUDIT_SANDBOX_HEADERS'
  | 'SCAN_CODE'
  | 'CHOOSE_MEDIA'
  | 'PREVIEW_IMAGE'
  | 'AUDIO_PLAY'
  | 'AUDIO_PAUSE'
  | 'AUDIO_STOP'
  | 'AUDIO_SEEK'
  | 'RECORD_AUDIO_START'
  | 'RECORD_AUDIO_STOP'
  | 'CHOOSE_CONTACT'
  | 'PICK_CONTACTS'
  | 'GET_CONTACTS_COUNT'
  | 'SHARE_SHEET'
  | 'SHARE_TO_STORY'
  | 'PUSH_GET_TOKEN'
  | 'GET_PUSH_TOKEN'
  | 'PUSH_REQUEST_PERMISSION'
  | 'PUSH_SET_BADGE'
  | 'PUSH_SHOW_NOTIFICATION'
  | 'SUBSCRIBE_PUSH_TOPIC'
  | 'UNSUBSCRIBE_PUSH_TOPIC'
  | 'GET_PENDING_NOTIFICATIONS'
  | 'CLEAR_NOTIFICATIONS'
  | 'BLE_START_SCAN'
  | 'START_BLE_SCAN'
  | 'BLE_STOP_SCAN'
  | 'STOP_BLE_SCAN'
  | 'BLE_CONNECT'
  | 'CONNECT_BLE_DEVICE'
  | 'DISCONNECT_BLE_DEVICE'
  | 'BLE_READ_CHARACTERISTIC'
  | 'READ_BLE_CHARACTERISTIC'
  | 'BLE_WRITE_CHARACTERISTIC'
  | 'WRITE_BLE_CHARACTERISTIC'
  | 'NFC_READ_TAG'
  | 'READ_NFC_NDEF_MESSAGE'
  | 'NFC_WRITE_TAG'
  | 'START_NFC_DISCOVERY'
  | 'STOP_NFC_DISCOVERY'
  | 'WEB3_CONNECT_WALLET'
  | 'WEB3_SIGN_TRANSACTION'
  | 'WEB3_DISCONNECT'
  | 'WEB3_GET_ACCOUNT'
  | 'OPEN_INVOICE'
  | 'GET_PURCHASE_PRODUCTS'
  | 'RESTORE_PURCHASES'
  | 'IAP_PURCHASE'
  | 'CREATE_BINARY_PORT'
  | 'POST_BINARY_MESSAGE'
  | 'READ_BINARY_MESSAGE'
  | 'CLOSE_BINARY_PORT'
  | 'CAN_GO_BACK'
  | 'HANDLE_BACK_PRESS'
  | 'PUSH_HISTORY_STATE'
  | 'GET_CURRENT_ROUTE'
  | 'NAV_PUSH'
  | 'NAV_POP'
  | 'NAV_POP_TO_ROOT'
  | 'NAV_REPLACE'
  | 'GET_PAGE_STACK'
  | 'PREDICTIVE_BACK_PROGRESS'
  | 'PREDICTIVE_BACK_INVOKE'
  | 'PREDICTIVE_BACK_CANCEL'
  | 'LOAD_SUBPACKAGE'
  | 'IS_SUBPACKAGE_CACHED'
  | 'CLEAR_SUBPACKAGE_CACHE'
  | 'GET_SUBPACKAGES'
  | 'PRECOMPILE_BYTECODE'
  | 'IS_BYTECODE_WARM'
  | 'CLEAR_BYTECODE_CACHE'
  | 'GET_BYTECODE_STATS'
  | 'VALIDATE_WASM_SUPPORT'
  | 'CONFIGURE_TRANSPARENCY'
  | 'SYNC_THEME_BACKGROUND'
  | 'GET_RENDER_LAYER_CONFIG'
  | 'GESTURE_SCROLL_UPDATE'
  | 'SHOULD_PARENT_INTERCEPT'
  | 'RESET_GESTURE_COORDINATOR'
  | 'EMBED_NATIVE_VIEW'
  | 'UPDATE_NATIVE_VIEW_BOUNDS'
  | 'REMOVE_NATIVE_VIEW'
  | 'GET_ACTIVE_NATIVE_VIEWS'
  | 'GET_API_CAPABILITIES'
  | 'REGISTER_CAPABILITY'
  | 'GET_SANDBOX_PROCESS_STATUS'
  | 'GET_STARTUP_BENCHMARK_REPORT'
  | 'RECORD_STARTUP_BENCHMARK_SAMPLE'
  | 'REPORT_METRICS'
  | 'SEND_APM_METRIC'
  | 'GET_APM_METRICS'
  | 'GET_APM_SUMMARY'
  | 'RECORD_BRIDGE_TIMING'
  | 'START_TRACE'
  | 'STOP_TRACE'
  | 'GET_TRACES'
  | 'GET_MEMORY_METRICS'
  | 'CUSTOM_AI_PREDICT';

declare interface DeviceInfo {
  model: string;
  manufacturer: string;
  brand: string;
  platform: string;
  androidVersion?: string;
  sdkInt?: number;
  screenWidthDp: number;
  screenHeightDp: number;
  density: number;
  batteryLevel: number;
  isCharging: boolean;
  appVersion: string;
}

declare interface LocationResult {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
}

declare interface GoatBridgeClientInterface {
  call<T = any>(action: GoatBridgeAction, payload?: any): Promise<T>;
  callNative<T = any>(action: GoatBridgeAction, payload?: any): Promise<T>;
  onEvent(event: string, handler: (data: any) => void): () => void;
  emitEvent(event: string, data: any): void;
}

declare namespace GoatBridge {
  function call<T = any>(action: GoatBridgeAction, payload?: any): Promise<T>;
  function callNative<T = any>(action: GoatBridgeAction, payload?: any): Promise<T>;
  function onEvent(event: string, handler: (data: any) => void): () => void;
  function emitEvent(event: string, data: any): void;
}

declare class MiniAppBridge implements GoatBridgeClientInterface {
  call<T = any>(action: GoatBridgeAction, payload?: any): Promise<T>;
  callNative<T = any>(action: GoatBridgeAction, payload?: any): Promise<T>;
  onEvent(event: string, handler: (data: any) => void): () => void;
  emitEvent(event: string, data: any): void;
}

declare interface GoatBridgeInterface extends GoatBridgeClientInterface {}

declare const bridge: MiniAppBridge;
declare const GoatBridge: GoatBridgeInterface;

interface Window {
  GoatBridge: GoatBridgeInterface;
  bridge: MiniAppBridge;
}
`;
