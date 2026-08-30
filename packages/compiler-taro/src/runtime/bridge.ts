/**
 * @goat/compiler-taro - JSAPI Runtime Bridge Client
 * IPC bridge proxy connecting Taro API calls to the native Goat WebView runtime.
 */

import { StandardCallbackOptions, BridgeCallPayload, BridgeReplyPayload } from '../types.js';

export type BridgeCallerFn = (action: string, payload: Record<string, unknown>, timeoutMs?: number) => Promise<any>;

export class GoatRuntimeBridge {
  private customCaller?: BridgeCallerFn;
  private callCounter = 0;
  private readonly defaultTimeoutMs = 15000;
  private readonly mockDataStore = new Map<string, any>();

  /**
   * Configures a custom bridge caller function (useful for tests and custom containers)
   */
  public setBridgeCaller(caller: BridgeCallerFn | undefined): void {
    this.customCaller = caller;
  }

  /**
   * Low-level bridge invocation mapping to Goat IPC action
   */
  public async callNative<T = any>(
    action: string,
    payload: Record<string, unknown> = {},
    timeoutMs?: number
  ): Promise<T> {
    // 1. If custom caller registered, use it
    if (this.customCaller) {
      return this.customCaller(action, payload, timeoutMs);
    }

    // 2. If running inside Goat WebView with global __GOAT_BRIDGE__ or GoatBridge
    const globalObj = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});
    const nativeBridge = (globalObj as any).__GOAT_BRIDGE__ || (globalObj as any).GoatBridge;

    if (nativeBridge && typeof nativeBridge.call === 'function') {
      return nativeBridge.call(action, payload, timeoutMs);
    }
    if (nativeBridge && typeof nativeBridge.callNative === 'function') {
      return nativeBridge.callNative(action, payload, timeoutMs);
    }

    // 3. Fallback: Internal mock simulator for testing and standalone dev mode
    return this.fallbackSimulateCall<T>(action, payload);
  }

  /**
   * Internal simulation handler for zero-dependency test execution
   */
  private async fallbackSimulateCall<T = any>(action: string, payload: Record<string, any>): Promise<T> {
    switch (action) {
      case 'API_REQUEST': {
        if (!payload.url || typeof payload.url !== 'string') {
          throw { code: 'INVALID_ARGUMENT', message: 'URL is required' };
        }
        if (payload.url.startsWith('http://127.0.0.1') || payload.url.startsWith('http://169.254.169.254')) {
          throw { code: 'SSRF_BLOCKED', message: 'Private host blocked' };
        }
        return {
          data: { success: true, url: payload.url, method: payload.method || 'GET' },
          statusCode: 200,
          header: { 'content-type': 'application/json' },
          cookies: [],
        } as T;
      }

      case 'STORAGE_GET': {
        const key = payload.key;
        if (!this.mockDataStore.has(key)) {
          throw { code: 'NOT_FOUND', message: 'data not found' };
        }
        return { data: this.mockDataStore.get(key) } as T;
      }

      case 'STORAGE_SET': {
        this.mockDataStore.set(payload.key, payload.data ?? payload.value);
        return { success: true } as T;
      }

      case 'STORAGE_REMOVE': {
        this.mockDataStore.delete(payload.key);
        return { success: true } as T;
      }

      case 'STORAGE_CLEAR': {
        this.mockDataStore.clear();
        return { success: true } as T;
      }

      case 'NAV_PUSH':
      case 'NAV_REPLACE':
      case 'NAV_POP':
      case 'TAB_SWITCH':
      case 'NAV_POP_TO_ROOT': {
        return { success: true } as T;
      }

      case 'SHOW_MODAL': {
        return { confirm: true, cancel: false } as T;
      }

      case 'SHOW_TOAST':
      case 'HIDE_TOAST':
      case 'SHOW_LOADING':
      case 'HIDE_LOADING': {
        return { success: true } as T;
      }

      case 'SHOW_ACTION_SHEET': {
        if (!payload.itemList || !Array.isArray(payload.itemList) || payload.itemList.length === 0) {
          throw { code: 'INVALID_ARGUMENT', message: 'itemList must contain at least 1 item' };
        }
        return { tapIndex: 0 } as T;
      }

      case 'REQUEST_PAYMENT':
      case 'OPEN_INVOICE': {
        return { success: true } as T;
      }

      case 'GET_LOCATION': {
        return {
          latitude: 37.7749,
          longitude: -122.4194,
          speed: 0,
          accuracy: 5,
          altitude: 10,
          verticalAccuracy: 5,
          horizontalAccuracy: 5,
        } as T;
      }

      case 'CHOOSE_LOCATION': {
        return {
          name: 'Goat Park',
          address: '123 Market St, San Francisco, CA',
          latitude: 37.7749,
          longitude: -122.4194,
        } as T;
      }

      case 'OPEN_LOCATION': {
        return { success: true } as T;
      }

      case 'GET_DEVICE_INFO': {
        return {
          brand: 'Apple',
          model: 'iPhone 15 Pro',
          system: 'iOS 17.4',
          platform: 'goat',
          cpuType: 'arm64',
          memorySize: '8GB',
        } as T;
      }

      case 'GET_SAFE_AREA_INSETS': {
        return {
          pixelRatio: 3,
          screenWidth: 393,
          screenHeight: 852,
          windowWidth: 393,
          windowHeight: 852,
          statusBarHeight: 44,
          safeArea: {
            left: 0,
            right: 393,
            top: 44,
            bottom: 818,
            width: 393,
            height: 774,
          },
        } as T;
      }

      case 'HAPTIC_FEEDBACK': {
        return { success: true } as T;
      }

      case 'CLIPBOARD_SET': {
        this.mockDataStore.set('__clipboard__', payload.data);
        return { success: true } as T;
      }

      case 'CLIPBOARD_GET': {
        return { data: this.mockDataStore.get('__clipboard__') || '' } as T;
      }

      case 'SET_KEEP_SCREEN_ON':
      case 'SET_SCREEN_BRIGHTNESS': {
        return { success: true } as T;
      }

      case 'GET_SCREEN_BRIGHTNESS': {
        return { value: 0.8 } as T;
      }

      case 'SCAN_CODE': {
        return {
          result: 'https://goat-engine.dev/qr',
          scanType: 'QR_CODE',
          charSet: 'UTF-8',
        } as T;
      }

      case 'DOWNLOAD_FILE': {
        return {
          tempFilePath: 'goat://tmp/download_file_123.bin',
          statusCode: 200,
        } as T;
      }

      case 'UPLOAD_FILE': {
        return {
          data: '{"uploaded":true}',
          statusCode: 200,
        } as T;
      }

      default: {
        return { success: true, action } as T;
      }
    }
  }
}

export const bridge = new GoatRuntimeBridge();

/**
 * Universal wrapper supporting both Promise and Callback (success, fail, complete) paradigms.
 */
export async function invokeBridgeCallback<TResult extends { errMsg: string }, TOptions extends StandardCallbackOptions<TResult>>(
  apiName: string,
  action: string,
  payload: Record<string, unknown>,
  options: TOptions = {} as TOptions,
  transformSuccess?: (nativeRes: any) => Partial<TResult>,
  transformFail?: (err: any) => string
): Promise<TResult> {
  try {
    const nativeRes = await bridge.callNative(action, payload, (options as any).timeout);
    const transformed = transformSuccess ? transformSuccess(nativeRes) : nativeRes;
    const result = {
      ...transformed,
      errMsg: `${apiName}:ok`,
    } as TResult;

    try {
      options.success?.(result);
    } catch (e) {
      console.error(`[Taro.${apiName}] Error in success callback:`, e);
    }
    try {
      options.complete?.(result);
    } catch (e) {
      console.error(`[Taro.${apiName}] Error in complete callback:`, e);
    }

    return result;
  } catch (error: any) {
    const errMsgDetail = transformFail
      ? transformFail(error)
      : error?.message || error?.errMsg || 'unknown error';

    const formattedErrMsg = errMsgDetail.startsWith(`${apiName}:fail`)
      ? errMsgDetail
      : `${apiName}:fail ${errMsgDetail}`;

    const errObj = {
      errMsg: formattedErrMsg,
      code: error?.code || 'NATIVE_ERROR',
      details: error?.details || error,
    };

    try {
      options.fail?.(errObj);
    } catch (e) {
      console.error(`[Taro.${apiName}] Error in fail callback:`, e);
    }
    try {
      options.complete?.(errObj);
    } catch (e) {
      console.error(`[Taro.${apiName}] Error in complete callback:`, e);
    }

    throw errObj;
  }
}
