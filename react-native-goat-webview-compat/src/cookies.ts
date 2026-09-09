import { GoatWebViewNativeModule } from 'react-native-goat-webview';

/**
 * react-native-webview's `CookieManager` surface (T11 / N7).
 *
 * Backed by the engine's existing COOKIE_* bridge actions through the TurboModule's generic
 * executeAction, so this needs no new native code.
 *
 * Every method resolves rather than throwing when the native module is unavailable (a bare JS
 * test environment, or a host that has not linked the native package). A cookie helper that
 * throws on a missing module would take down a screen that merely tried to read a cookie.
 */

const call = async (action: string, payload: Record<string, unknown>, appId?: string) => {
  const fn = GoatWebViewNativeModule.executeAction;
  if (typeof fn !== 'function') return null;
  try {
    return await fn(action, payload, appId);
  } catch {
    return null;
  }
};

export interface GoatCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
}

export const CookieManager = {
  async set(url: string, cookie: GoatCookie, appId?: string): Promise<boolean> {
    const res = await call(
      'COOKIE_SET',
      { url, name: cookie.name, value: cookie.value, domain: cookie.domain, path: cookie.path },
      appId
    );
    return res != null;
  },

  async get(url: string, appId?: string): Promise<Record<string, GoatCookie>> {
    const res = (await call('COOKIE_GET', { url }, appId)) as
      | { cookies?: Record<string, GoatCookie> }
      | null;
    return res?.cookies ?? {};
  },

  async clearByName(url: string, name: string, appId?: string): Promise<boolean> {
    const res = await call('COOKIE_REMOVE', { url, name }, appId);
    return res != null;
  },

  async clearAll(appId?: string): Promise<boolean> {
    const res = await call('COOKIE_REMOVE_ALL', {}, appId);
    return res != null;
  },
};
