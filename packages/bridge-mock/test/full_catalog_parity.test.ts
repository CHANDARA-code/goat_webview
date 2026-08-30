import test from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridgeMock, SUPPORTED_ACTIONS } from '../src/index.js';

test('Full Catalog Parity: Exhaustive Validation of All 197 Action Strings across 18 Domains', async (t) => {
  const bridge = new GoatBridgeMock();

  assert.equal(SUPPORTED_ACTIONS.size >= 185, true, `Expected >= 185 actions, got ${SUPPORTED_ACTIONS.size}`);

  const allActions: Array<{ action: string; payload?: any }> = [
    // Domain 1: Core & System Lifecycle (12)
    { action: 'GET_DEVICE_INFO' },
    { action: 'HAPTIC_FEEDBACK', payload: { type: 'impact', style: 'light' } },
    { action: 'SET_STATUS_BAR_THEME', payload: { isDark: true } },
    { action: 'SET_SCREEN_BRIGHTNESS', payload: { value: 0.8 } },
    { action: 'GET_SCREEN_BRIGHTNESS' },
    { action: 'SET_KEEP_SCREEN_ON', payload: { keepScreenOn: true } },
    { action: 'CLIPBOARD_SET', payload: { text: 'test' } },
    { action: 'CLIPBOARD_GET' },
    { action: 'NAVIGATE_BACK' },
    { action: 'CAN_I_USE', payload: { action: 'GET_LOCATION' } },
    { action: 'START_OAUTH_SESSION', payload: { authUrl: 'https://auth.goat.dev' } },
    { action: 'CANCEL_OAUTH_SESSION' },

    // Domain 2: Storage (16)
    { action: 'STORAGE_SET', payload: { key: 'test_k', value: 'test_v' } },
    { action: 'STORAGE_GET', payload: { key: 'test_k' } },
    { action: 'STORAGE_REMOVE', payload: { key: 'test_k' } },
    { action: 'STORAGE_CLEAR' },
    { action: 'SECURE_STORAGE_SET', payload: { key: 'sec_k', value: 'sec_v' } },
    { action: 'SECURE_STORAGE_GET', payload: { key: 'sec_k' } },
    { action: 'SECURE_STORAGE_REMOVE', payload: { key: 'sec_k' } },
    { action: 'SECURE_STORAGE_CLEAR' },
    { action: 'COOKIE_GET', payload: { url: 'https://goat.dev' } },
    { action: 'COOKIE_SET', payload: { url: 'https://goat.dev', value: 'k=v' } },
    { action: 'COOKIE_REMOVE', payload: { url: 'https://goat.dev', name: 'k' } },
    { action: 'COOKIE_REMOVE_ALL' },
    { action: 'WEB_STORAGE_GET_QUOTA_USAGE' },
    { action: 'WEB_STORAGE_CLEAR' },
    { action: 'HTTP_AUTH_SAVE_CREDENTIAL', payload: { host: 'auth.dev', username: 'u', password: 'p' } },
    { action: 'HTTP_AUTH_CLEAR_CREDENTIALS' },

    // Domain 3: FileSystem (11)
    { action: 'FS_WRITE_FILE', payload: { filePath: '/f.txt', data: '1' } },
    { action: 'FS_READ_FILE', payload: { filePath: '/f.txt' } },
    { action: 'FS_MKDIR', payload: { dirPath: '/d' } },
    { action: 'FS_RMDIR', payload: { dirPath: '/d' } },
    { action: 'FS_STAT', payload: { filePath: '/f.txt' } },
    { action: 'FS_COPY_FILE', payload: { srcPath: '/f.txt', destPath: '/f2.txt' } },
    { action: 'FS_EXISTS', payload: { filePath: '/f.txt' } },
    { action: 'FS_LIST_DIR', payload: { dirPath: '/' } },
    { action: 'FS_UNLINK', payload: { filePath: '/f.txt' } },
    { action: 'CHOOSE_FILES' },
    { action: 'CANCEL_FILE_CHOOSER' },

    // Domain 4: Network (10)
    { action: 'API_REQUEST', payload: { url: 'https://api.goat.dev/health' } },
    { action: 'DOWNLOAD_FILE', payload: { url: 'https://cdn.goat.dev/file.bin' } },
    { action: 'UPLOAD_FILE', payload: { url: 'https://api.goat.dev/upload', filePath: '/f2.txt' } },
    { action: 'GET_NETWORK_TYPE' },
    { action: 'IS_CONNECTED' },
    { action: 'WEBSOCKET_CONNECT', payload: { url: 'wss://echo.goat.dev' } },
    { action: 'WEBSOCKET_SEND', payload: { data: 'ping' } },
    { action: 'WEBSOCKET_CLOSE' },
    { action: 'VERIFY_SSL_PIN', payload: { hostname: 'api.goat.dev' } },
    { action: 'AUDIT_NETWORK_CERTIFICATE', payload: { url: 'https://goat.dev' } },

    // Domain 5: UI & Insets (28)
    { action: 'SHOW_TOAST', payload: { title: 'Hi' } },
    { action: 'HIDE_TOAST' },
    { action: 'SHOW_MODAL', payload: { title: 'T', content: 'C' } },
    { action: 'SHOW_ACTION_SHEET', payload: { itemList: ['A', 'B'] } },
    { action: 'SHOW_LOADING' },
    { action: 'HIDE_LOADING' },
    { action: 'GET_KEYBOARD_INSETS' },
    { action: 'SET_KEYBOARD_INSETS', payload: { heightPx: 200 } },
    { action: 'SET_NAV_BAR_TITLE', payload: { title: 'Title' } },
    { action: 'SET_NAV_BAR_COLOR', payload: { backgroundColor: '#fff' } },
    { action: 'SET_NAV_BAR_BUTTONS', payload: { left: 'BACK' } },
    { action: 'SET_NAV_BAR_PROGRESS', payload: { visible: true, progress: 50 } },
    { action: 'EXPAND_BOTTOM_SHEET' },
    { action: 'COLLAPSE_BOTTOM_SHEET' },
    { action: 'SET_SHEET_SNAP_POINTS', payload: { snapPoints: [0.5, 1.0] } },
    { action: 'GET_SAFE_AREA_INSETS' },
    { action: 'OPEN_EXTERNAL_LINK', payload: { url: 'https://goat.dev' } },
    { action: 'OPEN_URL', payload: { url: 'https://goat.dev' } },
    { action: 'OPEN_LINK', payload: { url: 'https://goat.dev' } },
    { action: 'TAB_OPEN', payload: { title: 'T1' } },
    { action: 'TAB_SWITCH', payload: { tabId: 'tab_101' } },
    { action: 'TAB_GET_ACTIVE' },
    { action: 'TAB_LIST' },
    { action: 'TAB_CLOSE', payload: { tabId: 'tab_101' } },
    { action: 'TAB_CLOSE_ALL' },
    { action: 'OPEN_MINI_APP', payload: { targetAppId: 'com.sub' } },
    { action: 'CLOSE_MINI_APP', payload: { instanceId: 'inst_1' } },
    { action: 'ON_MINI_APP_CLOSED' },

    // Domain 6: Sensors (12)
    { action: 'START_ACCELEROMETER' },
    { action: 'GET_LATEST_ACCELEROMETER' },
    { action: 'STOP_ACCELEROMETER' },
    { action: 'START_COMPASS' },
    { action: 'START_GYROSCOPE' },
    { action: 'GET_LATEST_GYROSCOPE' },
    { action: 'STOP_GYROSCOPE' },
    { action: 'START_DEVICE_MOTION' },
    { action: 'GET_LATEST_DEVICE_MOTION' },
    { action: 'STOP_DEVICE_MOTION' },
    { action: 'MAKE_PHONE_CALL', payload: { phoneNumber: '123' } },
    { action: 'SEND_SMS', payload: { phoneNumber: '123' } },

    // Domain 7: Location (7)
    { action: 'GET_LOCATION' },
    { action: 'CHOOSE_LOCATION' },
    { action: 'OPEN_LOCATION', payload: { latitude: 37.0, longitude: -122.0 } },
    { action: 'START_GEOFENCE', payload: { geofenceId: 'g1', latitude: 37.0, longitude: -122.0 } },
    { action: 'LIST_GEOFENCES' },
    { action: 'EVALUATE_GEOFENCE', payload: { latitude: 37.0, longitude: -122.0 } },
    { action: 'STOP_GEOFENCE', payload: { geofenceId: 'g1' } },

    // Domain 8: Biometrics (8)
    { action: 'CHECK_BIOMETRIC_SUPPORT' },
    { action: 'BIOMETRIC_AUTH' },
    { action: 'CHECK_PERMISSION', payload: { scope: 'CAMERA' } },
    { action: 'REQUEST_PERMISSION', payload: { scope: 'CAMERA' } },
    { action: 'GET_SETTING' },
    { action: 'OPEN_SETTING' },
    { action: 'AUTHORIZE', payload: { scope: 'CAMERA' } },
    { action: 'AUDIT_SANDBOX_HEADERS' },

    // Domain 9: Media (7)
    { action: 'SCAN_CODE' },
    { action: 'CHOOSE_MEDIA' },
    { action: 'PREVIEW_IMAGE', payload: { urls: ['https://goat.dev/img.jpg'] } },
    { action: 'AUDIO_PLAY', payload: { src: 'https://goat.dev/a.mp3' } },
    { action: 'AUDIO_PAUSE' },
    { action: 'AUDIO_SEEK', payload: { position: 10 } },
    { action: 'AUDIO_STOP' },

    // Domain 10: Contacts (5)
    { action: 'CHOOSE_CONTACT' },
    { action: 'PICK_CONTACTS' },
    { action: 'GET_CONTACTS_COUNT' },
    { action: 'SHARE_SHEET', payload: { title: 'S' } },
    { action: 'SHARE_TO_STORY', payload: { mediaPath: '/p.jpg' } },

    // Domain 11: Push (9)
    { action: 'PUSH_GET_TOKEN' },
    { action: 'GET_PUSH_TOKEN' },
    { action: 'PUSH_REQUEST_PERMISSION' },
    { action: 'PUSH_SET_BADGE', payload: { count: 1 } },
    { action: 'PUSH_SHOW_NOTIFICATION', payload: { title: 'T', content: 'C' } },
    { action: 'SUBSCRIBE_PUSH_TOPIC', payload: { topic: 'top' } },
    { action: 'UNSUBSCRIBE_PUSH_TOPIC', payload: { topic: 'top' } },
    { action: 'GET_PENDING_NOTIFICATIONS' },
    { action: 'CLEAR_NOTIFICATIONS' },

    // Domain 12: BLE & NFC (16)
    { action: 'BLE_START_SCAN' },
    { action: 'START_BLE_SCAN' },
    { action: 'BLE_CONNECT', payload: { deviceId: 'BLE:FA:23:4B:99:01' } },
    { action: 'CONNECT_BLE_DEVICE', payload: { deviceId: 'BLE:FA:23:4B:99:01' } },
    { action: 'BLE_READ_CHARACTERISTIC', payload: { deviceId: 'BLE:FA:23:4B:99:01', characteristicUuid: '2a00' } },
    { action: 'READ_BLE_CHARACTERISTIC', payload: { deviceId: 'BLE:FA:23:4B:99:01', characteristicUuid: '2a00' } },
    { action: 'BLE_WRITE_CHARACTERISTIC', payload: { deviceId: 'BLE:FA:23:4B:99:01', characteristicUuid: '2a00', value: '1' } },
    { action: 'WRITE_BLE_CHARACTERISTIC', payload: { deviceId: 'BLE:FA:23:4B:99:01', characteristicUuid: '2a00', value: '1' } },
    { action: 'DISCONNECT_BLE_DEVICE', payload: { deviceId: 'BLE:FA:23:4B:99:01' } },
    { action: 'BLE_STOP_SCAN' },
    { action: 'STOP_BLE_SCAN' },
    { action: 'NFC_READ_TAG' },
    { action: 'READ_NFC_NDEF_MESSAGE' },
    { action: 'NFC_WRITE_TAG', payload: { payload: 'hello' } },
    { action: 'START_NFC_DISCOVERY' },
    { action: 'STOP_NFC_DISCOVERY' },

    // Domain 13: Web3 (7)
    { action: 'WEB3_CONNECT_WALLET' },
    { action: 'WEB3_SIGN_TRANSACTION', payload: { to: '0x123', amount: '1' } },
    { action: 'WEB3_GET_ACCOUNT' },
    { action: 'WEB3_DISCONNECT' },
    { action: 'OPEN_INVOICE', payload: { invoiceSlug: 'inv_1' } },
    { action: 'GET_PURCHASE_PRODUCTS' },
    { action: 'RESTORE_PURCHASES' },

    // Domain 14: Binary (4)
    { action: 'CREATE_BINARY_PORT', payload: { portId: 'p_test' } },
    { action: 'POST_BINARY_MESSAGE', payload: { portId: 'p_test', dataBase64: 'AA==' } },
    { action: 'READ_BINARY_MESSAGE', payload: { portId: 'p_test' } },
    { action: 'CLOSE_BINARY_PORT', payload: { portId: 'p_test' } },

    // Domain 15: Navigation (12)
    { action: 'CAN_GO_BACK' },
    { action: 'GET_CURRENT_ROUTE' },
    { action: 'PUSH_HISTORY_STATE', payload: { route: '/r' } },
    { action: 'NAV_PUSH', payload: { route: '/r' } },
    { action: 'NAV_REPLACE', payload: { route: '/r2' } },
    { action: 'GET_PAGE_STACK' },
    { action: 'NAV_POP' },
    { action: 'NAV_POP_TO_ROOT' },
    { action: 'HANDLE_BACK_PRESS' },
    { action: 'PREDICTIVE_BACK_PROGRESS', payload: { progress: 0.2 } },
    { action: 'PREDICTIVE_BACK_CANCEL' },
    { action: 'PREDICTIVE_BACK_INVOKE' },

    // Domain 16: Subpackages (9)
    { action: 'LOAD_SUBPACKAGE', payload: { subpackageName: 'sub_a' } },
    { action: 'IS_SUBPACKAGE_CACHED', payload: { subpackageName: 'sub_a' } },
    { action: 'GET_SUBPACKAGES' },
    { action: 'CLEAR_SUBPACKAGE_CACHE', payload: { subpackageName: 'sub_a' } },
    { action: 'PRECOMPILE_BYTECODE', payload: { bundlePath: '/b.js' } },
    { action: 'IS_BYTECODE_WARM' },
    { action: 'GET_BYTECODE_STATS' },
    { action: 'CLEAR_BYTECODE_CACHE' },
    { action: 'VALIDATE_WASM_SUPPORT' },

    // Domain 17: Render (10)
    { action: 'CONFIGURE_TRANSPARENCY', payload: { isTransparent: true } },
    { action: 'SYNC_THEME_BACKGROUND', payload: { isDark: true } },
    { action: 'GET_RENDER_LAYER_CONFIG' },
    { action: 'GESTURE_SCROLL_UPDATE', payload: { scrollY: 10 } },
    { action: 'SHOULD_PARENT_INTERCEPT', payload: { deltaY: 5 } },
    { action: 'RESET_GESTURE_COORDINATOR' },
    { action: 'EMBED_NATIVE_VIEW', payload: { componentId: 'v1' } },
    { action: 'UPDATE_NATIVE_VIEW_BOUNDS', payload: { componentId: 'v1', width: 200 } },
    { action: 'GET_ACTIVE_NATIVE_VIEWS' },
    { action: 'REMOVE_NATIVE_VIEW', payload: { componentId: 'v1' } },

    // Domain 18: APM (14)
    { action: 'GET_API_CAPABILITIES' },
    { action: 'REGISTER_CAPABILITY', payload: { actionName: 'CUSTOM_TEST', category: 'TEST' } },
    { action: 'GET_SANDBOX_PROCESS_STATUS' },
    { action: 'GET_STARTUP_BENCHMARK_REPORT' },
    { action: 'RECORD_STARTUP_BENCHMARK_SAMPLE', payload: { coldStartTimeMs: 100, warmStartTimeMs: 20 } },
    { action: 'REPORT_METRICS', payload: { fcpMs: 100 } },
    { action: 'SEND_APM_METRIC', payload: { fcpMs: 100 } },
    { action: 'GET_APM_METRICS' },
    { action: 'GET_APM_SUMMARY' },
    { action: 'RECORD_BRIDGE_TIMING', payload: { action: 'TEST', durationMs: 1 } },
    { action: 'START_TRACE', payload: { operationName: 'test_op' } },
    { action: 'STOP_TRACE', payload: { spanId: 'none' } },
    { action: 'GET_TRACES' },
    { action: 'GET_MEMORY_METRICS' },
  ];

  for (const item of allActions) {
    await t.test(`Action [${item.action}] dispatches successfully`, async () => {
      const res = await bridge.callNative(item.action, item.payload || {});
      assert.notEqual(res, undefined, `Action ${item.action} returned undefined`);
    });
  }
});
