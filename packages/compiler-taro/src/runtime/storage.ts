/**
 * @goat/compiler-taro - Storage JSAPI Runtime Bridge
 * Implements Taro.getStorage, setStorage, removeStorage, clearStorage,
 * getStorageInfo and their synchronous variants with 10MB quota tracking.
 */

import { invokeBridgeCallback } from './bridge.js';
import { syncStorage } from './sync-cache.js';
import {
  GetStorageOptions,
  GetStorageSuccessResult,
  SetStorageOptions,
  RemoveStorageOptions,
  ClearStorageOptions,
  GetStorageInfoOptions,
  GetStorageInfoSuccessResult,
  GeneralCallbackResult,
} from '../types.js';

/**
 * Taro.getStorage -> STORAGE_GET
 */
export async function getStorage(options: GetStorageOptions): Promise<GetStorageSuccessResult> {
  if (!options || typeof options.key !== 'string') {
    const err = { errMsg: 'getStorage:fail key is required', code: 'INVALID_ARGUMENT' };
    options?.fail?.(err);
    options?.complete?.(err);
    throw err;
  }

  // Check sync cache first
  if (syncStorage.has(options.key)) {
    const data = syncStorage.get(options.key);
    const res: GetStorageSuccessResult = {
      data,
      errMsg: 'getStorage:ok',
    };
    options.success?.(res);
    options.complete?.(res);
    return res;
  }

  return invokeBridgeCallback<GetStorageSuccessResult, GetStorageOptions>(
    'getStorage',
    'STORAGE_GET',
    { key: options.key },
    options,
    (res) => ({
      data: res?.data ?? res?.value ?? null,
    }),
    (err) => err?.message || 'data not found'
  );
}

/**
 * Taro.getStorageSync -> Synchronous In-Memory Cache
 */
export function getStorageSync(key: string): any {
  return syncStorage.get(key);
}

/**
 * Taro.setStorage -> STORAGE_SET
 */
export async function setStorage(options: SetStorageOptions): Promise<GeneralCallbackResult> {
  if (!options || typeof options.key !== 'string') {
    const err = { errMsg: 'setStorage:fail key is required', code: 'INVALID_ARGUMENT' };
    options?.fail?.(err);
    options?.complete?.(err);
    throw err;
  }

  try {
    syncStorage.set(options.key, options.data);
  } catch (err: any) {
    const errObj = { errMsg: `setStorage:fail ${err.message || 'quota exceeded'}`, code: 'STORAGE_QUOTA_EXCEEDED' };
    options.fail?.(errObj);
    options.complete?.(errObj);
    throw errObj;
  }

  return invokeBridgeCallback<GeneralCallbackResult, SetStorageOptions>(
    'setStorage',
    'STORAGE_SET',
    { key: options.key, data: options.data, value: typeof options.data === 'string' ? options.data : JSON.stringify(options.data) },
    options,
    () => ({ errMsg: 'setStorage:ok' }),
    (err) => err?.message || 'set storage failed'
  );
}

/**
 * Taro.setStorageSync -> Synchronous Cache + Write-Through
 */
export function setStorageSync(key: string, data: any): void {
  syncStorage.set(key, data);
}

/**
 * Taro.removeStorage -> STORAGE_REMOVE
 */
export async function removeStorage(options: RemoveStorageOptions): Promise<GeneralCallbackResult> {
  if (!options || typeof options.key !== 'string') {
    const err = { errMsg: 'removeStorage:fail key is required', code: 'INVALID_ARGUMENT' };
    options?.fail?.(err);
    options?.complete?.(err);
    throw err;
  }

  syncStorage.remove(options.key);

  return invokeBridgeCallback<GeneralCallbackResult, RemoveStorageOptions>(
    'removeStorage',
    'STORAGE_REMOVE',
    { key: options.key },
    options,
    () => ({ errMsg: 'removeStorage:ok' }),
    (err) => err?.message || 'remove storage failed'
  );
}

/**
 * Taro.removeStorageSync -> Synchronous Cache Eviction
 */
export function removeStorageSync(key: string): void {
  syncStorage.remove(key);
}

/**
 * Taro.clearStorage -> STORAGE_CLEAR
 */
export async function clearStorage(options: ClearStorageOptions = {}): Promise<GeneralCallbackResult> {
  syncStorage.clear();

  return invokeBridgeCallback<GeneralCallbackResult, ClearStorageOptions>(
    'clearStorage',
    'STORAGE_CLEAR',
    {},
    options,
    () => ({ errMsg: 'clearStorage:ok' }),
    (err) => err?.message || 'clear storage failed'
  );
}

/**
 * Taro.clearStorageSync -> Synchronous Cache Reset
 */
export function clearStorageSync(): void {
  syncStorage.clear();
}

/**
 * Taro.getStorageInfo -> Storage Metrics
 */
export async function getStorageInfo(options: GetStorageInfoOptions = {}): Promise<GetStorageInfoSuccessResult> {
  const info = syncStorage.getInfo();
  const res: GetStorageInfoSuccessResult = {
    keys: info.keys,
    currentSize: info.currentSize,
    limitSize: info.limitSize,
    errMsg: 'getStorageInfo:ok',
  };

  options.success?.(res);
  options.complete?.(res);
  return res;
}

/**
 * Taro.getStorageInfoSync -> Synchronous Storage Metrics
 */
export function getStorageInfoSync(): { keys: string[]; currentSize: number; limitSize: number } {
  return syncStorage.getInfo();
}
