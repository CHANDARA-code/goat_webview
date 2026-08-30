/**
 * @goat/bridge-mock - Domain 2: Multi-Tenant Storage & Sandboxing Handlers (16 Actions)
 */

import { mockState } from '../state/store.js';
import { CookieItem } from '../types.js';
import { GoatBridgeError, BridgeErrorCodes } from '../errors.js';

export class StorageHandlers {
  private static readonly MAX_STORAGE_BYTES = 10 * 1024 * 1024; // 10MB quota

  /**
   * Action 13: STORAGE_SET
   */
  public static storageSet(payload: any = {}, callerAppId: string = mockState.defaultAppId): { saved: boolean; key: string; appId: string } {
    const key = payload.key;
    if (typeof key !== 'string' || key.trim() === '') {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Storage key must be a non-empty string');
    }
    const rawVal = payload.value !== undefined ? payload.value : payload.data;
    const value = typeof rawVal === 'string' ? rawVal : JSON.stringify(rawVal);
    const appId = payload.appId || callerAppId;

    const map = mockState.getAppStorage(appId);

    // Calculate current usage
    let currentBytes = 0;
    for (const [k, v] of map.entries()) {
      if (k !== key) {
        currentBytes += k.length + v.length;
      }
    }
    const newBytes = currentBytes + key.length + value.length;
    if (newBytes > this.MAX_STORAGE_BYTES) {
      throw new GoatBridgeError(
        BridgeErrorCodes.STORAGE_QUOTA_EXCEEDED,
        `Storage quota of 10MB exceeded for appId "${appId}"`
      );
    }

    map.set(key, value);
    return { saved: true, key, appId };
  }

  /**
   * Action 14: STORAGE_GET
   */
  public static storageGet(payload: any = {}, callerAppId: string = mockState.defaultAppId): { key: string; value: string | null; data?: any } {
    const key = payload.key;
    if (typeof key !== 'string') {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Storage key must be a string');
    }
    const appId = payload.appId || callerAppId;
    const map = mockState.getAppStorage(appId);
    const value = map.has(key) ? map.get(key)! : null;
    return { key, value, data: value };
  }

  /**
   * Action 15: STORAGE_REMOVE
   */
  public static storageRemove(payload: any = {}, callerAppId: string = mockState.defaultAppId): { removed: boolean; key: string } {
    const key = payload.key;
    if (typeof key !== 'string') {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Storage key must be a string');
    }
    const appId = payload.appId || callerAppId;
    const map = mockState.getAppStorage(appId);
    const removed = map.delete(key);
    return { removed, key };
  }

  /**
   * Action 16: STORAGE_CLEAR
   */
  public static storageClear(payload: any = {}, callerAppId: string = mockState.defaultAppId): { cleared: boolean; appId: string } {
    const appId = payload.appId || callerAppId;
    const map = mockState.getAppStorage(appId);
    map.clear();
    return { cleared: true, appId };
  }

  /**
   * Action 17: SECURE_STORAGE_SET
   */
  public static secureStorageSet(payload: any = {}, callerAppId: string = mockState.defaultAppId): { saved: boolean; key: string; appId: string } {
    const key = payload.key;
    if (typeof key !== 'string' || key.trim() === '') {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Secure storage key must be a non-empty string');
    }
    const rawVal = payload.value !== undefined ? payload.value : payload.data;
    const value = typeof rawVal === 'string' ? rawVal : JSON.stringify(rawVal);
    const appId = payload.appId || callerAppId;

    const map = mockState.getAppSecureStorage(appId);
    map.set(key, value);
    return { saved: true, key, appId };
  }

  /**
   * Action 18: SECURE_STORAGE_GET
   */
  public static secureStorageGet(payload: any = {}, callerAppId: string = mockState.defaultAppId): { key: string; value: string | null } {
    const key = payload.key;
    if (typeof key !== 'string') {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Secure storage key must be a string');
    }
    const appId = payload.appId || callerAppId;
    const map = mockState.getAppSecureStorage(appId);
    const value = map.has(key) ? map.get(key)! : null;
    return { key, value };
  }

  /**
   * Action 19: SECURE_STORAGE_REMOVE
   */
  public static secureStorageRemove(payload: any = {}, callerAppId: string = mockState.defaultAppId): { removed: boolean; key: string } {
    const key = payload.key;
    if (typeof key !== 'string') {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Secure storage key must be a string');
    }
    const appId = payload.appId || callerAppId;
    const map = mockState.getAppSecureStorage(appId);
    const removed = map.delete(key);
    return { removed, key };
  }

  /**
   * Action 20: SECURE_STORAGE_CLEAR
   */
  public static secureStorageClear(payload: any = {}, callerAppId: string = mockState.defaultAppId): { cleared: boolean; appId: string } {
    const appId = payload.appId || callerAppId;
    const map = mockState.getAppSecureStorage(appId);
    map.clear();
    return { cleared: true, appId };
  }

  /**
   * Action 21: COOKIE_GET
   */
  public static getCookies(payload: any = {}, callerAppId: string = mockState.defaultAppId): { cookies: CookieItem[]; totalCount: number } {
    const appId = payload.appId || callerAppId;
    const cookiesList = mockState.cookies.get(appId) || [];
    return { cookies: [...cookiesList], totalCount: cookiesList.length };
  }

  /**
   * Action 22: COOKIE_SET
   */
  public static setCookie(payload: any = {}, callerAppId: string = mockState.defaultAppId): { success: boolean; url: string } {
    const url = payload.url || 'https://goat.dev';
    const value = payload.value || '';
    const appId = payload.appId || callerAppId;

    if (!mockState.cookies.has(appId)) {
      mockState.cookies.set(appId, []);
    }
    const cookiesList = mockState.cookies.get(appId)!;

    // Parse name=value
    const parts = value.split(';')[0].split('=');
    const name = parts[0]?.trim() || 'mockCookie';
    const val = parts.slice(1).join('=').trim();

    // Upsert cookie
    const idx = cookiesList.findIndex((c) => c.name === name);
    const item: CookieItem = { name, value: val, domain: payload.domain, path: payload.path || '/' };
    if (idx >= 0) {
      cookiesList[idx] = item;
    } else {
      cookiesList.push(item);
    }

    return { success: true, url };
  }

  /**
   * Action 23: COOKIE_REMOVE
   */
  public static removeCookie(payload: any = {}, callerAppId: string = mockState.defaultAppId): { removed: boolean; name: string } {
    const name = payload.name || '';
    const appId = payload.appId || callerAppId;
    const cookiesList = mockState.cookies.get(appId) || [];
    const idx = cookiesList.findIndex((c) => c.name === name);
    if (idx >= 0) {
      cookiesList.splice(idx, 1);
      return { removed: true, name };
    }
    return { removed: false, name };
  }

  /**
   * Action 24: COOKIE_REMOVE_ALL
   */
  public static clearCookies(payload: any = {}, callerAppId: string = mockState.defaultAppId): { cleared: boolean } {
    const appId = payload.appId || callerAppId;
    mockState.cookies.delete(appId);
    return { cleared: true };
  }

  /**
   * Action 25: WEB_STORAGE_GET_QUOTA_USAGE
   */
  public static getWebStorageQuotaUsage(payload: any = {}, callerAppId: string = mockState.defaultAppId): { usageBytes: number; quotaBytes: number; remainingBytes: number } {
    const appId = payload.appId || callerAppId;
    const map = mockState.getAppStorage(appId);
    let usageBytes = 0;
    for (const [k, v] of map.entries()) {
      usageBytes += k.length + v.length;
    }
    const quotaBytes = this.MAX_STORAGE_BYTES;
    const remainingBytes = Math.max(0, quotaBytes - usageBytes);
    return { usageBytes, quotaBytes, remainingBytes };
  }

  /**
   * Action 26: WEB_STORAGE_CLEAR
   */
  public static clearWebStorage(payload: any = {}, callerAppId: string = mockState.defaultAppId): { cleared: boolean; freedBytes: number } {
    const appId = payload.appId || callerAppId;
    const map = mockState.getAppStorage(appId);
    let freedBytes = 0;
    for (const [k, v] of map.entries()) {
      freedBytes += k.length + v.length;
    }
    map.clear();
    return { cleared: true, freedBytes };
  }

  /**
   * Action 27: HTTP_AUTH_SAVE_CREDENTIAL
   */
  public static saveHttpAuthCredential(payload: any = {}): { saved: boolean; host: string } {
    const host = payload.host;
    const username = payload.username || '';
    const password = payload.password || '';
    if (!host) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing host for HTTP Auth credential');
    }
    mockState.httpAuthCreds.set(host, { username, password });
    return { saved: true, host };
  }

  /**
   * Action 28: HTTP_AUTH_CLEAR_CREDENTIALS
   */
  public static clearHttpAuthCredentials(payload: any = {}): { cleared: boolean } {
    if (payload.host) {
      mockState.httpAuthCreds.delete(payload.host);
    } else {
      mockState.httpAuthCreds.clear();
    }
    return { cleared: true };
  }
}
