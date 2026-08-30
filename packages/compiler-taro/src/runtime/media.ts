/**
 * @goat/compiler-taro - Media, Haptics & Device Controls JSAPI Bridge
 * Implements Taro.scanCode, vibrateShort, vibrateLong, setClipboardData,
 * getClipboardData, setKeepScreenOn, setScreenBrightness, and getScreenBrightness.
 */

import { invokeBridgeCallback } from './bridge.js';
import {
  ScanCodeOptions,
  ScanCodeSuccessResult,
  VibrateShortOptions,
  VibrateLongOptions,
  SetClipboardDataOptions,
  GetClipboardDataOptions,
  GetClipboardDataSuccessResult,
  SetKeepScreenOnOptions,
  SetScreenBrightnessOptions,
  GetScreenBrightnessOptions,
  GetScreenBrightnessSuccessResult,
  GeneralCallbackResult,
} from '../types.js';

/**
 * Taro.scanCode -> SCAN_CODE
 */
export async function scanCode(options: ScanCodeOptions = {}): Promise<ScanCodeSuccessResult> {
  const payload = {
    onlyFromCamera: options.onlyFromCamera ?? false,
    scanType: options.scanType || ['qrCode', 'barCode'],
  };

  return invokeBridgeCallback<ScanCodeSuccessResult, ScanCodeOptions>(
    'scanCode',
    'SCAN_CODE',
    payload,
    options,
    (res) => ({
      result: res?.result || 'https://goat-engine.dev',
      scanType: res?.scanType || 'QR_CODE',
      charSet: res?.charSet || 'UTF-8',
      path: res?.path,
      rawData: res?.rawData,
    }),
    (err) => {
      if (err?.code === 'USER_CANCELLED') return 'cancel';
      if (err?.code === 'PERMISSION_DENIED') return 'auth deny';
      return err?.message || 'scan code failed';
    }
  );
}

/**
 * Taro.vibrateShort -> HAPTIC_FEEDBACK (medium impact)
 */
export async function vibrateShort(options: VibrateShortOptions = {}): Promise<GeneralCallbackResult> {
  const style = options.type || 'medium';
  const payload = {
    type: 'impact',
    style,
  };

  return invokeBridgeCallback<GeneralCallbackResult, VibrateShortOptions>(
    'vibrateShort',
    'HAPTIC_FEEDBACK',
    payload,
    options,
    () => ({ errMsg: 'vibrateShort:ok' }),
    (err) => err?.message || 'vibrate short failed'
  );
}

/**
 * Taro.vibrateLong -> HAPTIC_FEEDBACK (heavy impact)
 */
export async function vibrateLong(options: VibrateLongOptions = {}): Promise<GeneralCallbackResult> {
  const payload = {
    type: 'impact',
    style: 'heavy',
  };

  return invokeBridgeCallback<GeneralCallbackResult, VibrateLongOptions>(
    'vibrateLong',
    'HAPTIC_FEEDBACK',
    payload,
    options,
    () => ({ errMsg: 'vibrateLong:ok' }),
    (err) => err?.message || 'vibrate long failed'
  );
}

/**
 * Taro.setClipboardData -> CLIPBOARD_SET
 */
export async function setClipboardData(options: SetClipboardDataOptions): Promise<GeneralCallbackResult> {
  if (!options || typeof options.data !== 'string') {
    const err = { errMsg: 'setClipboardData:fail data is required', code: 'INVALID_ARGUMENT' };
    options?.fail?.(err);
    options?.complete?.(err);
    throw err;
  }

  const payload = { data: options.data };

  return invokeBridgeCallback<GeneralCallbackResult, SetClipboardDataOptions>(
    'setClipboardData',
    'CLIPBOARD_SET',
    payload,
    options,
    () => ({ errMsg: 'setClipboardData:ok' }),
    (err) => err?.message || 'set clipboard failed'
  );
}

/**
 * Taro.getClipboardData -> CLIPBOARD_GET
 */
export async function getClipboardData(options: GetClipboardDataOptions = {}): Promise<GetClipboardDataSuccessResult> {
  return invokeBridgeCallback<GetClipboardDataSuccessResult, GetClipboardDataOptions>(
    'getClipboardData',
    'CLIPBOARD_GET',
    {},
    options,
    (res) => ({
      data: typeof res?.data === 'string' ? res.data : '',
    }),
    (err) => err?.message || 'get clipboard failed'
  );
}

/**
 * Taro.setKeepScreenOn -> SET_KEEP_SCREEN_ON
 */
export async function setKeepScreenOn(options: SetKeepScreenOnOptions): Promise<GeneralCallbackResult> {
  if (!options || typeof options.keepScreenOn !== 'boolean') {
    const err = { errMsg: 'setKeepScreenOn:fail keepScreenOn is required', code: 'INVALID_ARGUMENT' };
    options?.fail?.(err);
    options?.complete?.(err);
    throw err;
  }

  const payload = { keepScreenOn: options.keepScreenOn };

  return invokeBridgeCallback<GeneralCallbackResult, SetKeepScreenOnOptions>(
    'setKeepScreenOn',
    'SET_KEEP_SCREEN_ON',
    payload,
    options,
    () => ({ errMsg: 'setKeepScreenOn:ok' }),
    (err) => err?.message || 'set keep screen on failed'
  );
}

/**
 * Taro.setScreenBrightness -> SET_SCREEN_BRIGHTNESS
 */
export async function setScreenBrightness(options: SetScreenBrightnessOptions): Promise<GeneralCallbackResult> {
  if (!options || typeof options.value !== 'number') {
    const err = { errMsg: 'setScreenBrightness:fail value is required', code: 'INVALID_ARGUMENT' };
    options?.fail?.(err);
    options?.complete?.(err);
    throw err;
  }

  const clamped = Math.max(0.0, Math.min(1.0, options.value));
  const payload = { value: clamped };

  return invokeBridgeCallback<GeneralCallbackResult, SetScreenBrightnessOptions>(
    'setScreenBrightness',
    'SET_SCREEN_BRIGHTNESS',
    payload,
    options,
    () => ({ errMsg: 'setScreenBrightness:ok' }),
    (err) => err?.message || 'set screen brightness failed'
  );
}

/**
 * Taro.getScreenBrightness -> GET_SCREEN_BRIGHTNESS
 */
export async function getScreenBrightness(options: GetScreenBrightnessOptions = {}): Promise<GetScreenBrightnessSuccessResult> {
  return invokeBridgeCallback<GetScreenBrightnessSuccessResult, GetScreenBrightnessOptions>(
    'getScreenBrightness',
    'GET_SCREEN_BRIGHTNESS',
    {},
    options,
    (res) => ({
      value: typeof res?.value === 'number' ? res.value : 0.8,
    }),
    (err) => err?.message || 'get screen brightness failed'
  );
}
