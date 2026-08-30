/**
 * @goat/compiler-taro - System & Telemetry JSAPI Runtime Bridge
 * Implements Taro.getSystemInfo, getSystemInfoSync, getDeviceInfo,
 * getWindowInfo, getAppBaseInfo, and canIUse.
 */

import { invokeBridgeCallback, bridge } from './bridge.js';
import { getCachedSystemInfo, updateCachedSystemInfo } from './sync-cache.js';
import {
  GetSystemInfoOptions,
  SystemInfo,
  DeviceInfo,
  WindowInfo,
  AppBaseInfo,
  StandardCallbackOptions,
} from '../types.js';

const SUPPORTED_SCHEMAS = new Set([
  'request',
  'getStorage',
  'setStorage',
  'removeStorage',
  'clearStorage',
  'getStorageInfo',
  'getStorageSync',
  'setStorageSync',
  'removeStorageSync',
  'clearStorageSync',
  'getStorageInfoSync',
  'navigateTo',
  'redirectTo',
  'navigateBack',
  'switchTab',
  'reLaunch',
  'getCurrentPages',
  'showModal',
  'showToast',
  'hideToast',
  'showLoading',
  'hideLoading',
  'showActionSheet',
  'requestPayment',
  'getLocation',
  'chooseLocation',
  'openLocation',
  'getSystemInfo',
  'getSystemInfoSync',
  'getDeviceInfo',
  'getWindowInfo',
  'getAppBaseInfo',
  'canIUse',
  'vibrateShort',
  'vibrateLong',
  'setClipboardData',
  'getClipboardData',
  'setKeepScreenOn',
  'setScreenBrightness',
  'getScreenBrightness',
  'scanCode',
  'downloadFile',
  'uploadFile',
  'connectSocket',
  // Bridge Action mappings
  'API_REQUEST',
  'STORAGE_GET',
  'STORAGE_SET',
  'STORAGE_REMOVE',
  'STORAGE_CLEAR',
  'NAV_PUSH',
  'NAV_REPLACE',
  'NAV_POP',
  'TAB_SWITCH',
  'NAV_POP_TO_ROOT',
  'SHOW_MODAL',
  'SHOW_TOAST',
  'HIDE_TOAST',
  'SHOW_LOADING',
  'HIDE_LOADING',
  'SHOW_ACTION_SHEET',
  'REQUEST_PAYMENT',
  'OPEN_INVOICE',
  'GET_LOCATION',
  'CHOOSE_LOCATION',
  'OPEN_LOCATION',
  'GET_DEVICE_INFO',
  'GET_SAFE_AREA_INSETS',
  'HAPTIC_FEEDBACK',
  'CLIPBOARD_SET',
  'CLIPBOARD_GET',
  'SET_KEEP_SCREEN_ON',
  'SET_SCREEN_BRIGHTNESS',
  'GET_SCREEN_BRIGHTNESS',
  'SCAN_CODE',
  'DOWNLOAD_FILE',
  'UPLOAD_FILE',
  'WEBSOCKET_CONNECT',
]);

/**
 * Taro.getSystemInfo -> GET_DEVICE_INFO + GET_SAFE_AREA_INSETS
 */
export async function getSystemInfo(options: GetSystemInfoOptions = {}): Promise<SystemInfo> {
  return invokeBridgeCallback<SystemInfo, GetSystemInfoOptions>(
    'getSystemInfo',
    'GET_DEVICE_INFO',
    {},
    options,
    (res) => {
      const cached = getCachedSystemInfo();
      const updated: SystemInfo = {
        ...cached,
        brand: res?.brand || cached.brand,
        model: res?.model || cached.model,
        system: res?.system || cached.system,
        platform: (res?.platform as any) || 'goat',
        screenWidth: res?.screenWidth || cached.screenWidth,
        screenHeight: res?.screenHeight || cached.screenHeight,
        windowWidth: res?.windowWidth || cached.windowWidth,
        windowHeight: res?.windowHeight || cached.windowHeight,
        statusBarHeight: res?.statusBarHeight || cached.statusBarHeight,
        safeArea: res?.safeArea || cached.safeArea,
        errMsg: 'getSystemInfo:ok',
      };
      updateCachedSystemInfo(updated);
      return updated;
    },
    (err) => err?.message || 'getSystemInfo failed'
  );
}

/**
 * Taro.getSystemInfoSync -> Synchronous Snapshot
 */
export function getSystemInfoSync(): SystemInfo {
  return getCachedSystemInfo();
}

/**
 * Taro.getDeviceInfo -> GET_DEVICE_INFO
 */
export async function getDeviceInfo(options: StandardCallbackOptions<DeviceInfo> = {}): Promise<DeviceInfo> {
  return invokeBridgeCallback<DeviceInfo, StandardCallbackOptions<DeviceInfo>>(
    'getDeviceInfo',
    'GET_DEVICE_INFO',
    {},
    options,
    (res) => ({
      brand: res?.brand || 'Apple',
      model: res?.model || 'iPhone 15 Pro',
      system: res?.system || 'iOS 17.4',
      platform: res?.platform || 'goat',
      cpuType: res?.cpuType || 'arm64',
      memorySize: res?.memorySize || '8GB',
      errMsg: 'getDeviceInfo:ok',
    }),
    (err) => err?.message || 'getDeviceInfo failed'
  );
}

/**
 * Taro.getWindowInfo -> GET_SAFE_AREA_INSETS
 */
export async function getWindowInfo(options: StandardCallbackOptions<WindowInfo> = {}): Promise<WindowInfo> {
  return invokeBridgeCallback<WindowInfo, StandardCallbackOptions<WindowInfo>>(
    'getWindowInfo',
    'GET_SAFE_AREA_INSETS',
    {},
    options,
    (res) => ({
      pixelRatio: res?.pixelRatio || 3,
      screenWidth: res?.screenWidth || 393,
      screenHeight: res?.screenHeight || 852,
      windowWidth: res?.windowWidth || 393,
      windowHeight: res?.windowHeight || 852,
      statusBarHeight: res?.statusBarHeight || 44,
      safeArea: res?.safeArea || {
        left: 0,
        right: 393,
        top: 44,
        bottom: 818,
        width: 393,
        height: 774,
      },
      screenTop: res?.screenTop || 0,
      errMsg: 'getWindowInfo:ok',
    }),
    (err) => err?.message || 'getWindowInfo failed'
  );
}

/**
 * Taro.getAppBaseInfo -> Synchronous/Local MiniApp Runtime Info
 */
export function getAppBaseInfo(): AppBaseInfo {
  return {
    SDKVersion: '2.4.0',
    version: '1.0.0',
    language: 'en_US',
    platform: 'goat',
    theme: 'light',
    fontSizeSetting: 16,
    errMsg: 'getAppBaseInfo:ok',
  };
}

/**
 * Taro.canIUse -> Catalog check
 */
export function canIUse(schema: string): boolean {
  if (!schema || typeof schema !== 'string') return false;
  const clean = schema.replace(/^Taro\./, '').split('.')[0] || schema;
  return SUPPORTED_SCHEMAS.has(clean) || SUPPORTED_SCHEMAS.has(schema);
}
