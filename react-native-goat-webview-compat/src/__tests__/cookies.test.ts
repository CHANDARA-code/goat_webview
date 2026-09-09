import { CookieManager } from '../cookies';
import { GoatWebViewNativeModule } from 'react-native-goat-webview';

describe('T11/N7 — CookieManager over the engine COOKIE_* actions', () => {
  const mod = GoatWebViewNativeModule as unknown as {
    executeAction?: jest.Mock;
  };

  afterEach(() => {
    delete mod.executeAction;
  });

  it('maps set/get/clear onto the documented bridge actions', async () => {
    const calls: Array<[string, Record<string, unknown>, string | undefined]> = [];
    mod.executeAction = jest.fn(async (action, payload, appId) => {
      calls.push([action, payload as Record<string, unknown>, appId]);
      return { cookies: { sid: { name: 'sid', value: 'abc' } } };
    });

    await CookieManager.set('https://example.com', { name: 'sid', value: 'abc' }, 'tenant');
    await CookieManager.get('https://example.com', 'tenant');
    await CookieManager.clearByName('https://example.com', 'sid', 'tenant');
    await CookieManager.clearAll('tenant');

    expect(calls.map((c) => c[0])).toEqual([
      'COOKIE_SET',
      'COOKIE_GET',
      'COOKIE_REMOVE',
      'COOKIE_REMOVE_ALL',
    ]);
    expect(calls.every((c) => c[2] === 'tenant')).toBe(true);
  });

  it('returns the cookie map from a COOKIE_GET response', async () => {
    mod.executeAction = jest.fn(async () => ({ cookies: { sid: { name: 'sid', value: 'abc' } } }));
    const cookies = await CookieManager.get('https://example.com');
    expect(cookies.sid.value).toBe('abc');
  });

  it('resolves empty rather than throwing when the native module is absent', async () => {
    // A host that has not linked the native package, or a bare JS test env. Throwing here would
    // take down a screen that merely tried to read a cookie.
    delete mod.executeAction;
    await expect(CookieManager.get('https://example.com')).resolves.toEqual({});
    await expect(CookieManager.clearAll()).resolves.toBe(false);
  });

  it('reports failure instead of throwing when native rejects', async () => {
    mod.executeAction = jest.fn(async () => {
      throw new Error('native blew up');
    });
    await expect(CookieManager.set('https://x', { name: 'a', value: 'b' })).resolves.toBe(false);
    await expect(CookieManager.get('https://x')).resolves.toEqual({});
  });
});
