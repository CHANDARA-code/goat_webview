/**
 * @goat/compiler-uniapp Storage JSAPI Shims
 * Synchronous local memory cache with asynchronous native bridge persistence.
 */
import { callBridgeAction, createUniApiWrapper } from './bridge.js';
import type {
  ClearStorageOptions,
  GetStorageInfoOptions,
  GetStorageOptions,
  RemoveStorageOptions,
  SetStorageOptions,
  StorageInfoResult,
  UniCallbackOptions,
  UniError,
} from '../types.js';

// In-memory synchronous cache
const syncStorageCache = new Map<string, unknown>();

export function getSyncCache(): Map<string, unknown> {
  return syncStorageCache;
}

export function clearSyncCache(): void {
  syncStorageCache.clear();
}

/**
 * uni.setStorage
 */
export function setStorage(options: SetStorageOptions): Promise<{ errMsg: string }> {
  if (!options || typeof options.key !== 'string' || !options.key) {
    const err: UniError = { errMsg: 'setStorage:fail key must be a non-empty string' };
    options?.fail?.(err);
    options?.complete?.(err);
    return Promise.reject(err);
  }

  // Update synchronous cache immediately
  syncStorageCache.set(options.key, options.data);

  let serializedValue: string;
  try {
    serializedValue = JSON.stringify(options.data);
  } catch (err: any) {
    const error: UniError = { errMsg: `setStorage:fail ${err.message || 'serialization error'}` };
    options.fail?.(error);
    options.complete?.(error);
    return Promise.reject(error);
  }

  return callBridgeAction('STORAGE_SET', {
    key: options.key,
    value: serializedValue,
  })
    .then(() => {
      const res = { errMsg: 'setStorage:ok' };
      options.success?.(res);
      options.complete?.(res);
      return res;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: `setStorage:fail ${err?.message || 'storage error'}` };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.setStorageSync
 */
export function setStorageSync(key: string, data: unknown): void {
  if (!key || typeof key !== 'string') {
    throw new Error('setStorageSync: key must be a non-empty string');
  }

  syncStorageCache.set(key, data);

  let serializedValue: string;
  try {
    serializedValue = JSON.stringify(data);
  } catch {
    serializedValue = String(data);
  }

  // Fire background native sync
  callBridgeAction('STORAGE_SET', { key, value: serializedValue }).catch(() => {
    // Non-blocking background error suppression
  });
}

/**
 * uni.getStorage
 */
export function getStorage(options: GetStorageOptions): Promise<{ data: unknown; errMsg: string }> {
  if (!options || typeof options.key !== 'string' || !options.key) {
    const err: UniError = { errMsg: 'getStorage:fail key must be a non-empty string' };
    options?.fail?.(err);
    options?.complete?.(err);
    return Promise.reject(err);
  }

  // Check sync cache first
  if (syncStorageCache.has(options.key)) {
    const cachedData = syncStorageCache.get(options.key);
    const res = { data: cachedData, errMsg: 'getStorage:ok' };
    options.success?.(res);
    options.complete?.(res);
    return Promise.resolve(res);
  }

  return callBridgeAction('STORAGE_GET', { key: options.key })
    .then((nativeRes: any) => {
      if (nativeRes?.value === undefined || nativeRes?.value === null) {
        const error: UniError = { errMsg: 'getStorage:fail data not found' };
        options.fail?.(error);
        options.complete?.(error);
        return Promise.reject(error);
      }

      let parsedData = nativeRes.value;
      try {
        parsedData = JSON.parse(nativeRes.value);
      } catch {
        // Use raw string if not JSON
      }

      syncStorageCache.set(options.key, parsedData);
      const res = { data: parsedData, errMsg: 'getStorage:ok' };
      options.success?.(res);
      options.complete?.(res);
      return res;
    })
    .catch((err: any) => {
      const error: UniError = {
        errMsg: err.errMsg || `getStorage:fail ${err.message || 'data not found'}`,
      };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.getStorageSync
 */
export function getStorageSync(key: string): unknown {
  if (!key || typeof key !== 'string') {
    return '';
  }

  if (syncStorageCache.has(key)) {
    return syncStorageCache.get(key);
  }

  return '';
}

/**
 * uni.removeStorage
 */
export function removeStorage(options: RemoveStorageOptions): Promise<{ errMsg: string }> {
  if (!options || typeof options.key !== 'string' || !options.key) {
    const err: UniError = { errMsg: 'removeStorage:fail key must be a non-empty string' };
    options?.fail?.(err);
    options?.complete?.(err);
    return Promise.reject(err);
  }

  syncStorageCache.delete(options.key);

  return callBridgeAction('STORAGE_REMOVE', { key: options.key })
    .then(() => {
      const res = { errMsg: 'removeStorage:ok' };
      options.success?.(res);
      options.complete?.(res);
      return res;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: `removeStorage:fail ${err.message || 'error'}` };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.removeStorageSync
 */
export function removeStorageSync(key: string): void {
  if (!key || typeof key !== 'string') return;
  syncStorageCache.delete(key);
  callBridgeAction('STORAGE_REMOVE', { key }).catch(() => {});
}

/**
 * uni.clearStorage
 */
export function clearStorage(options?: ClearStorageOptions): Promise<{ errMsg: string }> {
  syncStorageCache.clear();

  return callBridgeAction('STORAGE_CLEAR', {})
    .then(() => {
      const res = { errMsg: 'clearStorage:ok' };
      options?.success?.(res);
      options?.complete?.(res);
      return res;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: `clearStorage:fail ${err.message || 'error'}` };
      options?.fail?.(error);
      options?.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.clearStorageSync
 */
export function clearStorageSync(): void {
  syncStorageCache.clear();
  callBridgeAction('STORAGE_CLEAR', {}).catch(() => {});
}

/**
 * uni.getStorageInfo
 */
export function getStorageInfo(options?: GetStorageInfoOptions): Promise<StorageInfoResult> {
  const keys = Array.from(syncStorageCache.keys());
  let currentSize = 0;
  for (const [k, v] of syncStorageCache.entries()) {
    currentSize += (k.length + (JSON.stringify(v) || '').length);
  }
  const result: StorageInfoResult = {
    keys,
    currentSize: Math.ceil(currentSize / 1024),
    limitSize: 10240, // 10MB default
    errMsg: 'getStorageInfo:ok',
  };

  options?.success?.(result);
  options?.complete?.(result);
  return Promise.resolve(result);
}

/**
 * uni.getStorageInfoSync
 */
export function getStorageInfoSync(): Omit<StorageInfoResult, 'errMsg'> {
  const keys = Array.from(syncStorageCache.keys());
  let currentSize = 0;
  for (const [k, v] of syncStorageCache.entries()) {
    currentSize += (k.length + (JSON.stringify(v) || '').length);
  }
  return {
    keys,
    currentSize: Math.ceil(currentSize / 1024),
    limitSize: 10240,
  };
}
