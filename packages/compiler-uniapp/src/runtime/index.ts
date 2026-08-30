/**
 * @goat/compiler-uniapp Unified Runtime JSAPI Bridge Shims
 * Complete implementation of the global `uni` object for Goat WebView runtimes.
 */
import { callBridgeAction, getBridgeTransport, setBridgeTransport } from './bridge.js';
import {
  clearStorage,
  clearStorageSync,
  getStorage,
  getStorageInfo,
  getStorageInfoSync,
  getStorageSync,
  removeStorage,
  removeStorageSync,
  setStorage,
  setStorageSync,
} from './storage.js';
import {
  getPageStack,
  navigateBack,
  navigateTo,
  preloadPage,
  redirectTo,
  registerTabPages,
  reLaunch,
  resetPageStack,
  switchTab,
} from './router.js';
import {
  hideLoading,
  hideToast,
  setNavigationBarColor,
  setNavigationBarTitle,
  showActionSheet,
  showLoading,
  showModal,
  showToast,
} from './ui.js';
import { downloadFile, request, uploadFile } from './network.js';
import {
  canIUse,
  getAppBaseInfo,
  getClipboardData,
  getDeviceInfo,
  getSystemInfo,
  getSystemInfoSync,
  getWindowInfo,
  makePhoneCall,
  setClipboardData,
  updateSystemInfoCache,
  vibrateLong,
  vibrateShort,
} from './system.js';
import { requestPayment } from './payment.js';
import {
  chooseImage,
  chooseLocation,
  chooseMedia,
  getLocation,
  openLocation,
  previewImage,
  scanCode,
} from './media.js';
import { px2rpx, rpx2px, transformRpxInCss } from './rpx.js';

export const uni = {
  // Network
  request,
  downloadFile,
  uploadFile,

  // Storage
  setStorage,
  setStorageSync,
  getStorage,
  getStorageSync,
  removeStorage,
  removeStorageSync,
  clearStorage,
  clearStorageSync,
  getStorageInfo,
  getStorageInfoSync,

  // Navigation
  navigateTo,
  redirectTo,
  navigateBack,
  switchTab,
  reLaunch,
  preloadPage,

  // UI
  showToast,
  hideToast,
  showLoading,
  hideLoading,
  showModal,
  showActionSheet,
  setNavigationBarTitle,
  setNavigationBarColor,

  // System & Device
  getSystemInfo,
  getSystemInfoSync,
  getDeviceInfo,
  getWindowInfo,
  getAppBaseInfo,
  canIUse,
  vibrateShort,
  vibrateLong,
  setClipboardData,
  getClipboardData,
  makePhoneCall,

  // Payment
  requestPayment,

  // Media & Location
  scanCode,
  chooseImage,
  chooseMedia,
  previewImage,
  getLocation,
  chooseLocation,
  openLocation,

  // Utilities
  rpx2px,
  px2rpx,
};

// Global injection into globalThis / window
if (typeof globalThis !== 'undefined') {
  (globalThis as unknown as { uni: typeof uni }).uni = uni;
}

export {
  // Bridge controls
  setBridgeTransport,
  getBridgeTransport,
  callBridgeAction,

  // Network
  request,
  downloadFile,
  uploadFile,

  // Storage
  setStorage,
  setStorageSync,
  getStorage,
  getStorageSync,
  removeStorage,
  removeStorageSync,
  clearStorage,
  clearStorageSync,
  getStorageInfo,
  getStorageInfoSync,

  // Navigation
  navigateTo,
  redirectTo,
  navigateBack,
  switchTab,
  reLaunch,
  preloadPage,
  registerTabPages,
  getPageStack,
  resetPageStack,

  // UI
  showToast,
  hideToast,
  showLoading,
  hideLoading,
  showModal,
  showActionSheet,
  setNavigationBarTitle,
  setNavigationBarColor,

  // System & Device
  getSystemInfo,
  getSystemInfoSync,
  getDeviceInfo,
  getWindowInfo,
  getAppBaseInfo,
  canIUse,
  vibrateShort,
  vibrateLong,
  setClipboardData,
  getClipboardData,
  makePhoneCall,
  updateSystemInfoCache,

  // Payment
  requestPayment,

  // Media & Location
  scanCode,
  chooseImage,
  chooseMedia,
  previewImage,
  getLocation,
  chooseLocation,
  openLocation,

  // Responsive units
  rpx2px,
  px2rpx,
  transformRpxInCss,
};

export default uni;
