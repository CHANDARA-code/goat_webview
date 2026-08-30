/**
 * @goat/compiler-taro - Synchronous In-Memory Cache
 * Provides sub-millisecond synchronous Storage and SystemInfo access with write-through IPC.
 */

import { bridge } from './bridge.js';
import { SystemInfo } from '../types.js';

const STORAGE_LIMIT_BYTES = 10 * 1024 * 1024; // 10MB

export class SyncStorageCache {
  private readonly store = new Map<string, any>();
  private currentBytes = 0;

  public get(key: string): any {
    if (!key || typeof key !== 'string') return '';
    return this.store.has(key) ? this.store.get(key) : '';
  }

  public set(key: string, data: any): void {
    if (!key || typeof key !== 'string') {
      throw new Error('setStorageSync: key must be a non-empty string');
    }

    const serialized = typeof data === 'string' ? data : JSON.stringify(data);
    const itemBytes = new TextEncoder().encode(serialized).length;

    // Check size difference
    const existingVal = this.store.get(key);
    const existingBytes = existingVal
      ? new TextEncoder().encode(typeof existingVal === 'string' ? existingVal : JSON.stringify(existingVal)).length
      : 0;

    const newTotal = this.currentBytes - existingBytes + itemBytes;
    if (newTotal > STORAGE_LIMIT_BYTES) {
      throw new Error('setStorageSync:fail storage quota of 10MB exceeded');
    }

    this.store.set(key, data);
    this.currentBytes = newTotal;

    // Asynchronous write-through to host persistence
    bridge.callNative('STORAGE_SET', { key, value: serialized, data }).catch((err) => {
      console.warn('[SyncStorageCache] Failed to write-through STORAGE_SET:', err);
    });
  }

  public remove(key: string): void {
    if (!key || typeof key !== 'string') return;
    const existingVal = this.store.get(key);
    if (existingVal !== undefined) {
      const existingBytes = new TextEncoder().encode(
        typeof existingVal === 'string' ? existingVal : JSON.stringify(existingVal)
      ).length;
      this.currentBytes = Math.max(0, this.currentBytes - existingBytes);
      this.store.delete(key);

      bridge.callNative('STORAGE_REMOVE', { key }).catch((err) => {
        console.warn('[SyncStorageCache] Failed to write-through STORAGE_REMOVE:', err);
      });
    }
  }

  public clear(): void {
    this.store.clear();
    this.currentBytes = 0;

    bridge.callNative('STORAGE_CLEAR', {}).catch((err) => {
      console.warn('[SyncStorageCache] Failed to write-through STORAGE_CLEAR:', err);
    });
  }

  public getInfo(): { keys: string[]; currentSize: number; limitSize: number } {
    return {
      keys: Array.from(this.store.keys()),
      currentSize: Math.ceil(this.currentBytes / 1024), // in KB
      limitSize: 10240, // 10MB in KB
    };
  }

  public has(key: string): boolean {
    return this.store.has(key);
  }
}

export const syncStorage = new SyncStorageCache();

// Cached System Info snapshot
let cachedSystemInfo: SystemInfo = {
  brand: 'Apple',
  model: 'iPhone 15 Pro',
  pixelRatio: 3,
  screenWidth: 393,
  screenHeight: 852,
  windowWidth: 393,
  windowHeight: 852,
  statusBarHeight: 44,
  language: 'en_US',
  version: '1.0.0',
  system: 'iOS 17.4',
  platform: 'goat',
  fontSizeSetting: 16,
  SDKVersion: '2.4.0',
  benchmarkLevel: 50,
  safeArea: {
    left: 0,
    right: 393,
    top: 44,
    bottom: 818,
    width: 393,
    height: 774,
  },
  theme: 'light',
  errMsg: 'getSystemInfoSync:ok',
};

export function getCachedSystemInfo(): SystemInfo {
  return { ...cachedSystemInfo };
}

export function updateCachedSystemInfo(update: Partial<SystemInfo>): void {
  cachedSystemInfo = {
    ...cachedSystemInfo,
    ...update,
    errMsg: 'getSystemInfoSync:ok',
  };
}
