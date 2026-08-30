/**
 * @goat/compiler-taro - Universal Taro JSAPI Runtime Bridge Shim
 * Exports the complete 44-JSAPI Taro runtime shim with Promise/Callback duality,
 * synchronous in-memory cache, and direct Goat IPC message framing.
 */

import { bridge } from './bridge.js';
import * as network from './network.js';
import * as storage from './storage.js';
import * as router from './router.js';
import * as ui from './ui.js';
import * as system from './system.js';
import * as payment from './payment.js';
import * as location from './location.js';
import * as media from './media.js';

export { bridge } from './bridge.js';
export { syncStorage, getCachedSystemInfo, updateCachedSystemInfo } from './sync-cache.js';

export const Taro = {
  // 1. Network
  request: network.request,
  downloadFile: network.downloadFile,
  uploadFile: network.uploadFile,
  connectSocket: network.connectSocket,

  // 2-11. Storage
  getStorage: storage.getStorage,
  getStorageSync: storage.getStorageSync,
  setStorage: storage.setStorage,
  setStorageSync: storage.setStorageSync,
  removeStorage: storage.removeStorage,
  removeStorageSync: storage.removeStorageSync,
  clearStorage: storage.clearStorage,
  clearStorageSync: storage.clearStorageSync,
  getStorageInfo: storage.getStorageInfo,
  getStorageInfoSync: storage.getStorageInfoSync,

  // 12-17. Router
  navigateTo: router.navigateTo,
  redirectTo: router.redirectTo,
  navigateBack: router.navigateBack,
  switchTab: router.switchTab,
  reLaunch: router.reLaunch,
  getCurrentPages: router.getCurrentPages,

  // 18-23. UI
  showModal: ui.showModal,
  showToast: ui.showToast,
  hideToast: ui.hideToast,
  showLoading: ui.showLoading,
  hideLoading: ui.hideLoading,
  showActionSheet: ui.showActionSheet,

  // 24. Payment
  requestPayment: payment.requestPayment,

  // 25-27. Location
  getLocation: location.getLocation,
  chooseLocation: location.chooseLocation,
  openLocation: location.openLocation,

  // 28-33. System
  getSystemInfo: system.getSystemInfo,
  getSystemInfoSync: system.getSystemInfoSync,
  getDeviceInfo: system.getDeviceInfo,
  getWindowInfo: system.getWindowInfo,
  getAppBaseInfo: system.getAppBaseInfo,
  canIUse: system.canIUse,

  // 34-40. Media, Haptics, Clipboard, Screen
  vibrateShort: media.vibrateShort,
  vibrateLong: media.vibrateLong,
  setClipboardData: media.setClipboardData,
  getClipboardData: media.getClipboardData,
  setKeepScreenOn: media.setKeepScreenOn,
  setScreenBrightness: media.setScreenBrightness,
  getScreenBrightness: media.getScreenBrightness,

  // 41. ScanCode
  scanCode: media.scanCode,

  // Internal test helpers
  __bridge: bridge,
  __resetPageStack: router.__resetPageStack,
};

// Bind to global environment if available
if (typeof globalThis !== 'undefined') {
  (globalThis as any).Taro = Taro;
}

export default Taro;
