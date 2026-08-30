/**
 * @goat/compiler-uniapp Bridge Transport & Dual-Return Wrapper
 */
import type { UniCallbackOptions, UniError } from '../types.js';

export type BridgeTransport = (
  action: string,
  payload: Record<string, unknown>
) => Promise<unknown>;

let customTransport: BridgeTransport | null = null;

export function setBridgeTransport(transport: BridgeTransport | null): void {
  customTransport = transport;
}

export function getBridgeTransport(): BridgeTransport | null {
  return customTransport;
}

export interface NativeBridgeInterface {
  callNative?: (action: string, payload?: Record<string, unknown>) => Promise<unknown>;
  invoke?: (action: string, payload?: Record<string, unknown>, callback?: (res: unknown) => void) => void;
  postMessage?: (message: string) => void;
}

declare global {
  interface Window {
    GoatBridge?: NativeBridgeInterface;
    __GOAT_BRIDGE_TRANSPORT__?: BridgeTransport;
  }
}

export async function callBridgeAction(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<unknown> {
  // 1. Custom transport if registered
  if (customTransport) {
    return customTransport(action, payload);
  }

  // 2. Global window transport
  if (typeof window !== 'undefined') {
    if (window.__GOAT_BRIDGE_TRANSPORT__) {
      return window.__GOAT_BRIDGE_TRANSPORT__(action, payload);
    }

    if (window.GoatBridge?.callNative) {
      return window.GoatBridge.callNative(action, payload);
    }
  }

  // 3. GlobalThis check (e.g. in Web Worker isolate)
  const g = globalThis as unknown as { GoatBridge?: NativeBridgeInterface; __GOAT_BRIDGE_TRANSPORT__?: BridgeTransport };
  if (g.__GOAT_BRIDGE_TRANSPORT__) {
    return g.__GOAT_BRIDGE_TRANSPORT__(action, payload);
  }
  if (g.GoatBridge?.callNative) {
    return g.GoatBridge.callNative(action, payload);
  }

  // 4. Default fallback mock / simulation for headless test environments
  return simulateBridgeAction(action, payload);
}

/**
 * Fallback bridge simulation for Node.js / unit testing when no native host is attached.
 */
function simulateBridgeAction(action: string, payload: Record<string, unknown>): Promise<unknown> {
  switch (action) {
    case 'API_REQUEST':
      return Promise.resolve({
        statusCode: 200,
        data: { ok: true },
        header: { 'content-type': 'application/json' },
        cookies: [],
      });

    case 'STORAGE_SET':
    case 'STORAGE_REMOVE':
    case 'STORAGE_CLEAR':
      return Promise.resolve({ success: true });

    case 'STORAGE_GET':
      return Promise.resolve({ value: null });

    case 'NAV_PUSH':
    case 'NAV_REPLACE':
    case 'NAV_POP':
    case 'TAB_SWITCH':
    case 'NAV_POP_TO_ROOT':
      return Promise.resolve({ success: true, stackDepth: 1 });

    case 'SHOW_TOAST':
    case 'HIDE_TOAST':
    case 'SHOW_LOADING':
    case 'HIDE_LOADING':
    case 'SET_NAV_BAR_TITLE':
    case 'SET_NAV_BAR_COLOR':
      return Promise.resolve({ success: true });

    case 'SHOW_MODAL':
      return Promise.resolve({ confirm: true, cancel: false });

    case 'SHOW_ACTION_SHEET':
      return Promise.resolve({ tapIndex: 0 });

    case 'OPEN_INVOICE':
    case 'REQUEST_PAYMENT':
      return Promise.resolve({ status: 'SUCCESS', transactionId: `tx_${Date.now()}` });

    case 'SCAN_CODE':
      return Promise.resolve({ result: 'https://goat-engine.dev', scanType: 'QR_CODE', charSet: 'UTF-8' });

    case 'GET_DEVICE_INFO':
      return Promise.resolve({
        brand: 'Goat',
        model: 'GoatSimulator',
        system: 'GoatOS 1.0',
        platform: 'devtools',
        screenWidthDp: 375,
        screenHeightDp: 812,
        density: 3,
        fontSizeSetting: 16,
      });

    case 'GET_SAFE_AREA_INSETS':
      return Promise.resolve({
        top: 44,
        bottom: 34,
        left: 0,
        right: 0,
      });

    case 'HAPTIC_FEEDBACK':
      return Promise.resolve({ triggered: true });

    case 'CLIPBOARD_SET':
    case 'MAKE_PHONE_CALL':
      return Promise.resolve({ success: true });

    case 'CLIPBOARD_GET':
      return Promise.resolve({ text: '' });

    case 'CAN_I_USE':
      return Promise.resolve({ supported: true });

    case 'CHOOSE_MEDIA':
      return Promise.resolve({
        tempFilePaths: ['/tmp/media_1.png'],
        tempFiles: [{ path: '/tmp/media_1.png', size: 1024 }],
      });

    case 'PREVIEW_IMAGE':
      return Promise.resolve({ success: true });

    case 'GET_LOCATION':
      return Promise.resolve({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 0,
        accuracy: 5,
        altitude: 0,
      });

    case 'CHOOSE_LOCATION':
      return Promise.resolve({
        name: 'Market St',
        address: 'San Francisco, CA',
        latitude: 37.7749,
        longitude: -122.4194,
      });

    case 'OPEN_LOCATION':
      return Promise.resolve({ success: true });

    case 'DOWNLOAD_FILE':
      return Promise.resolve({ savedPath: '/tmp/downloaded_file', statusCode: 200 });

    case 'UPLOAD_FILE':
      return Promise.resolve({ data: '{"uploaded":true}', status: 200 });

    default:
      return Promise.resolve({ success: true });
  }
}

export function createUniApiWrapper<TReq extends object, TRes>(
  apiName: string,
  bridgeAction: string,
  payloadTransformer: (req: TReq) => Record<string, unknown>,
  responseTransformer: (nativeRes: any, req: TReq) => TRes
) {
  return function (options: TReq & UniCallbackOptions<TRes> = {} as any): Promise<TRes> {
    try {
      const payload = payloadTransformer(options);

      return callBridgeAction(bridgeAction, payload)
        .then((nativeRes: any) => {
          const transformed = responseTransformer(nativeRes, options);
          options.success?.(transformed);
          options.complete?.(transformed);
          return transformed;
        })
        .catch((err: any) => {
          const errMsg = err?.errMsg || `${apiName}:fail ${err?.message || 'internal error'}`;
          const errObj: UniError = {
            errMsg,
            code: err?.code || 'BRIDGE_ERROR',
            details: err?.details || err,
          };
          options.fail?.(errObj);
          options.complete?.(errObj);
          return Promise.reject(errObj);
        });
    } catch (validationErr: any) {
      const errMsg = `${apiName}:fail ${validationErr.message || 'invalid arguments'}`;
      const errObj: UniError = {
        errMsg,
        code: 'INVALID_ARGUMENTS',
      };
      options.fail?.(errObj);
      options.complete?.(errObj);
      return Promise.reject(errObj);
    }
  };
}
