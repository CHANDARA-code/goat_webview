import { describe, it } from 'node:test';
import assert from 'node:assert';
import { bridge } from '../miniapp-bridge.js';

describe('Cookie & Credential Management Unit Suite (Milestone 1/3)', () => {
  it('should set, get, remove, and clear cookies via bridge', async () => {
    const setRes = await bridge.setCookie({
      url: 'https://tenant1.appassets.androidplatform.net/',
      value: 'session_token=xyz123; Path=/; Secure',
      appId: 'tenant1'
    });
    assert.strictEqual(setRes, true);

    const cookies = await bridge.getCookies('https://tenant1.appassets.androidplatform.net/', 'tenant1');
    assert.ok(Array.isArray(cookies) || typeof cookies === 'string');

    const removeRes = await bridge.removeCookie(
      'https://tenant1.appassets.androidplatform.net/',
      'session_token',
      undefined,
      '/',
      'tenant1'
    );
    assert.strictEqual(removeRes, true);

    const clearRes = await bridge.clearCookies('tenant1');
    assert.strictEqual(clearRes, true);
  });
});
