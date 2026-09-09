/**
 * DSL method name -> engine bridge action.
 *
 * Kept as one plain object rather than per-DSL tables: WeChat's `wx.*` and Alibaba's `my.*` share
 * almost every method name, and duplicating the mapping is how the two drift apart. A DSL that
 * genuinely differs gets an entry in its own alias table instead (see `wechat/` and `alibaba/`).
 */
export const DSL_ACTION_MAP: Readonly<Record<string, string>> = Object.freeze({
  // storage
  setStorage: 'STORAGE_SET',
  getStorage: 'STORAGE_GET',
  removeStorage: 'STORAGE_REMOVE',
  clearStorage: 'STORAGE_CLEAR',
  // device / system
  getSystemInfo: 'GET_DEVICE_INFO',
  getNetworkType: 'GET_NETWORK_STATUS',
  vibrateShort: 'HAPTIC_FEEDBACK',
  vibrateLong: 'HAPTIC_FEEDBACK',
  setKeepScreenOn: 'SET_KEEP_SCREEN_ON',
  setScreenBrightness: 'SET_SCREEN_BRIGHTNESS',
  getScreenBrightness: 'GET_SCREEN_BRIGHTNESS',
  // clipboard
  setClipboardData: 'CLIPBOARD_SET',
  getClipboardData: 'CLIPBOARD_GET',
  // ui
  showToast: 'SHOW_TOAST',
  hideToast: 'HIDE_TOAST',
  showModal: 'SHOW_MODAL',
  showLoading: 'SHOW_LOADING',
  hideLoading: 'HIDE_LOADING',
  showActionSheet: 'SHOW_ACTION_SHEET',
  // navigation
  navigateBack: 'NAVIGATE_BACK',
  // media / scanning
  scanCode: 'SCAN_CODE',
  // network
  request: 'API_REQUEST',
});

/** DSL globals this adapter installs. */
export const DSL_GLOBALS = Object.freeze(['wx', 'my', 'uni'] as const);
