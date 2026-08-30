/**
 * @goat/compiler-uniapp System & Device JSAPI Shims
 */
import { callBridgeAction } from './bridge.js';
import type {
  AppBaseInfoResult,
  DeviceInfoResult,
  GetClipboardDataOptions,
  GetSystemInfoOptions,
  MakePhoneCallOptions,
  SetClipboardDataOptions,
  SystemInfo,
  UniError,
  VibrateOptions,
  WindowInfoResult,
} from '../types.js';

let cachedSystemInfo: SystemInfo = {
  brand: 'Goat',
  model: 'GoatSimulator',
  pixelRatio: 2,
  screenWidth: 375,
  screenHeight: 812,
  windowWidth: 375,
  windowHeight: 734,
  statusBarHeight: 44,
  language: 'en',
  version: '1.0.0',
  system: 'GoatOS 1.0',
  platform: 'devtools',
  fontSizeSetting: 16,
  SDKVersion: '1.0.0',
  benchmarkLevel: 50,
  safeArea: {
    left: 0,
    right: 375,
    top: 44,
    bottom: 778,
    width: 375,
    height: 734,
  },
  safeAreaInsets: {
    top: 44,
    right: 0,
    bottom: 34,
    left: 0,
  },
  errMsg: 'getSystemInfo:ok',
};

export function updateSystemInfoCache(info: Partial<SystemInfo>): void {
  cachedSystemInfo = { ...cachedSystemInfo, ...info };
}

/**
 * uni.getSystemInfo
 */
export async function getSystemInfo(options?: GetSystemInfoOptions): Promise<SystemInfo> {
  try {
    const [devInfo, safeArea]: any = await Promise.all([
      callBridgeAction('GET_DEVICE_INFO', {}).catch(() => ({})),
      callBridgeAction('GET_SAFE_AREA_INSETS', {}).catch(() => ({})),
    ]);

    const screenWidth = devInfo?.screenWidthDp || cachedSystemInfo.screenWidth;
    const screenHeight = devInfo?.screenHeightDp || cachedSystemInfo.screenHeight;
    const statusBarHeight = safeArea?.top ?? devInfo?.statusBarHeight ?? cachedSystemInfo.statusBarHeight;
    const bottomInset = safeArea?.bottom ?? 34;

    const info: SystemInfo = {
      brand: devInfo?.brand || cachedSystemInfo.brand,
      model: devInfo?.model || cachedSystemInfo.model,
      pixelRatio: devInfo?.density || cachedSystemInfo.pixelRatio,
      screenWidth,
      screenHeight,
      windowWidth: screenWidth,
      windowHeight: screenHeight - statusBarHeight - bottomInset,
      statusBarHeight,
      language: devInfo?.language || cachedSystemInfo.language,
      version: devInfo?.appVersion || cachedSystemInfo.version,
      system: devInfo?.system || cachedSystemInfo.system,
      platform: devInfo?.platform || cachedSystemInfo.platform,
      fontSizeSetting: devInfo?.fontSizeSetting || cachedSystemInfo.fontSizeSetting,
      SDKVersion: cachedSystemInfo.SDKVersion,
      benchmarkLevel: devInfo?.benchmarkLevel || cachedSystemInfo.benchmarkLevel,
      safeArea: {
        left: safeArea?.left ?? 0,
        right: screenWidth - (safeArea?.right ?? 0),
        top: statusBarHeight,
        bottom: screenHeight - bottomInset,
        width: screenWidth - (safeArea?.left ?? 0) - (safeArea?.right ?? 0),
        height: screenHeight - statusBarHeight - bottomInset,
      },
      safeAreaInsets: {
        top: statusBarHeight,
        right: safeArea?.right ?? 0,
        bottom: bottomInset,
        left: safeArea?.left ?? 0,
      },
      errMsg: 'getSystemInfo:ok',
    };

    cachedSystemInfo = info;
    options?.success?.(info);
    options?.complete?.(info);
    return info;
  } catch (err: any) {
    const error: UniError = { errMsg: `getSystemInfo:fail ${err.message || 'error'}` };
    options?.fail?.(error);
    options?.complete?.(error);
    return Promise.reject(error);
  }
}

/**
 * uni.getSystemInfoSync
 */
export function getSystemInfoSync(): SystemInfo {
  return { ...cachedSystemInfo };
}

/**
 * uni.getDeviceInfo
 */
export async function getDeviceInfo(options?: { success?: (res: DeviceInfoResult) => void }): Promise<DeviceInfoResult> {
  const dev: any = await callBridgeAction('GET_DEVICE_INFO', {}).catch(() => ({}));
  const res: DeviceInfoResult = {
    brand: dev?.brand || cachedSystemInfo.brand,
    model: dev?.model || cachedSystemInfo.model,
    system: dev?.system || cachedSystemInfo.system,
    platform: dev?.platform || cachedSystemInfo.platform,
    errMsg: 'getDeviceInfo:ok',
  };
  options?.success?.(res);
  return res;
}

/**
 * uni.getWindowInfo
 */
export function getWindowInfo(): WindowInfoResult {
  return {
    windowWidth: cachedSystemInfo.windowWidth,
    windowHeight: cachedSystemInfo.windowHeight,
    screenWidth: cachedSystemInfo.screenWidth,
    screenHeight: cachedSystemInfo.screenHeight,
    statusBarHeight: cachedSystemInfo.statusBarHeight,
    pixelRatio: cachedSystemInfo.pixelRatio,
    safeArea: cachedSystemInfo.safeArea,
    safeAreaInsets: cachedSystemInfo.safeAreaInsets,
    errMsg: 'getWindowInfo:ok',
  };
}

/**
 * uni.getAppBaseInfo
 */
export function getAppBaseInfo(): AppBaseInfoResult {
  return {
    appId: 'com.goat.uniapp',
    appName: 'UniApp Mini-Program',
    appVersion: cachedSystemInfo.version,
    appVersionCode: 1,
    language: cachedSystemInfo.language,
    version: cachedSystemInfo.version,
    SDKVersion: cachedSystemInfo.SDKVersion,
    errMsg: 'getAppBaseInfo:ok',
  };
}

/**
 * uni.canIUse
 */
export function canIUse(schema: string): boolean {
  if (!schema || typeof schema !== 'string') return false;

  const supportedActions = new Set([
    'request',
    'getStorage',
    'setStorage',
    'removeStorage',
    'clearStorage',
    'navigateTo',
    'redirectTo',
    'navigateBack',
    'switchTab',
    'reLaunch',
    'showToast',
    'hideToast',
    'showLoading',
    'hideLoading',
    'showModal',
    'showActionSheet',
    'setNavigationBarTitle',
    'setNavigationBarColor',
    'requestPayment',
    'scanCode',
    'getSystemInfo',
    'getSystemInfoSync',
    'downloadFile',
    'uploadFile',
    'getLocation',
    'chooseLocation',
    'openLocation',
    'chooseImage',
    'previewImage',
    'vibrateShort',
    'vibrateLong',
    'setClipboardData',
    'getClipboardData',
    'makePhoneCall',
    'canIUse',
  ]);

  const normalized = schema.replace(/^uni\./, '');
  return supportedActions.has(normalized);
}

/**
 * uni.vibrateShort
 */
export function vibrateShort(options?: VibrateOptions): Promise<{ errMsg: string }> {
  return callBridgeAction('HAPTIC_FEEDBACK', { type: 'LIGHT' })
    .then(() => {
      const res = { errMsg: 'vibrateShort:ok' };
      options?.success?.(res);
      options?.complete?.(res);
      return res;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: `vibrateShort:fail ${err.message || 'error'}` };
      options?.fail?.(error);
      options?.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.vibrateLong
 */
export function vibrateLong(options?: VibrateOptions): Promise<{ errMsg: string }> {
  return callBridgeAction('HAPTIC_FEEDBACK', { type: 'HEAVY' })
    .then(() => {
      const res = { errMsg: 'vibrateLong:ok' };
      options?.success?.(res);
      options?.complete?.(res);
      return res;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: `vibrateLong:fail ${err.message || 'error'}` };
      options?.fail?.(error);
      options?.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.setClipboardData
 */
export function setClipboardData(options: SetClipboardDataOptions): Promise<{ errMsg: string }> {
  if (!options || typeof options.data !== 'string') {
    const err: UniError = { errMsg: 'setClipboardData:fail data is required' };
    options?.fail?.(err);
    options?.complete?.(err);
    return Promise.reject(err);
  }

  return callBridgeAction('CLIPBOARD_SET', { text: options.data })
    .then(() => {
      const res = { errMsg: 'setClipboardData:ok' };
      options.success?.(res);
      options.complete?.(res);
      return res;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: `setClipboardData:fail ${err.message || 'error'}` };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.getClipboardData
 */
export function getClipboardData(options?: GetClipboardDataOptions): Promise<{ data: string; errMsg: string }> {
  return callBridgeAction('CLIPBOARD_GET', {})
    .then((nativeRes: any) => {
      const res = {
        data: nativeRes?.text || '',
        errMsg: 'getClipboardData:ok',
      };
      options?.success?.(res);
      options?.complete?.(res);
      return res;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: `getClipboardData:fail ${err.message || 'error'}` };
      options?.fail?.(error);
      options?.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.makePhoneCall
 */
export function makePhoneCall(options: MakePhoneCallOptions): Promise<{ errMsg: string }> {
  if (!options || typeof options.phoneNumber !== 'string' || !options.phoneNumber.trim()) {
    const err: UniError = { errMsg: 'makePhoneCall:fail phoneNumber is required' };
    options?.fail?.(err);
    options?.complete?.(err);
    return Promise.reject(err);
  }

  return callBridgeAction('MAKE_PHONE_CALL', { phoneNumber: options.phoneNumber })
    .then(() => {
      const res = { errMsg: 'makePhoneCall:ok' };
      options.success?.(res);
      options.complete?.(res);
      return res;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: `makePhoneCall:fail ${err.message || 'error'}` };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}
