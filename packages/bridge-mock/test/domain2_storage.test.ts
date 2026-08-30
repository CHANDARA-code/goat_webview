import test from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridgeMock, mockState, BridgeErrorCodes } from '../src/index.js';

test('Domain 2: Multi-Tenant Storage & Sandboxing', async (t) => {
  const bridge = new GoatBridgeMock({ appId: 'app_tenant_alpha' });
  const bridgeBeta = new GoatBridgeMock({ appId: 'app_tenant_beta' });

  await t.test('STORAGE_SET and STORAGE_GET with tenant isolation', async () => {
    await bridge.callNative('STORAGE_SET', { key: 'user_name', value: 'Alice' });
    const getAlpha = await bridge.callNative('STORAGE_GET', { key: 'user_name' });
    assert.equal(getAlpha.value, 'Alice');

    // Tenant Beta should not see Alpha's key
    const getBeta = await bridgeBeta.callNative('STORAGE_GET', { key: 'user_name' });
    assert.equal(getBeta.value, null);
  });

  await t.test('STORAGE_REMOVE and STORAGE_CLEAR', async () => {
    await bridge.callNative('STORAGE_SET', { key: 'temp_key', value: 'temp_val' });
    const removeRes = await bridge.callNative('STORAGE_REMOVE', { key: 'temp_key' });
    assert.equal(removeRes.removed, true);

    const getRes = await bridge.callNative('STORAGE_GET', { key: 'temp_key' });
    assert.equal(getRes.value, null);

    await bridge.callNative('STORAGE_SET', { key: 'k1', value: 'v1' });
    await bridge.callNative('STORAGE_SET', { key: 'k2', value: 'v2' });
    const clearRes = await bridge.callNative('STORAGE_CLEAR');
    assert.equal(clearRes.cleared, true);

    const getK1 = await bridge.callNative('STORAGE_GET', { key: 'k1' });
    assert.equal(getK1.value, null);
  });

  await t.test('SECURE_STORAGE_SET / GET / REMOVE / CLEAR', async () => {
    await bridge.callNative('SECURE_STORAGE_SET', { key: 'api_token', value: 'secret_jwt_token_9912' });
    const getSec = await bridge.callNative('SECURE_STORAGE_GET', { key: 'api_token' });
    assert.equal(getSec.value, 'secret_jwt_token_9912');

    const remSec = await bridge.callNative('SECURE_STORAGE_REMOVE', { key: 'api_token' });
    assert.equal(remSec.removed, true);

    const clearSec = await bridge.callNative('SECURE_STORAGE_CLEAR');
    assert.equal(clearSec.cleared, true);
  });

  await t.test('COOKIE_SET / GET / REMOVE / REMOVE_ALL', async () => {
    await bridge.callNative('COOKIE_SET', { url: 'https://goat.dev', value: 'sessionId=abc123xyz; Path=/' });
    const cookiesRes = await bridge.callNative('COOKIE_GET', { url: 'https://goat.dev' });
    assert.equal(cookiesRes.totalCount >= 1, true);
    assert.equal(cookiesRes.cookies.some((c: any) => c.name === 'sessionId' && c.value === 'abc123xyz'), true);

    await bridge.callNative('COOKIE_REMOVE', { url: 'https://goat.dev', name: 'sessionId' });
    const afterRem = await bridge.callNative('COOKIE_GET', { url: 'https://goat.dev' });
    assert.equal(afterRem.cookies.some((c: any) => c.name === 'sessionId'), false);

    await bridge.callNative('COOKIE_SET', { url: 'https://goat.dev', value: 'pref=dark' });
    await bridge.callNative('COOKIE_REMOVE_ALL');
    const afterClear = await bridge.callNative('COOKIE_GET', { url: 'https://goat.dev' });
    assert.equal(afterClear.totalCount, 0);
  });

  await t.test('WEB_STORAGE_GET_QUOTA_USAGE and WEB_STORAGE_CLEAR', async () => {
    await bridge.callNative('STORAGE_SET', { key: 'test_quota_key', value: 'test_quota_value' });
    const usage = await bridge.callNative('WEB_STORAGE_GET_QUOTA_USAGE');
    assert.equal(usage.usageBytes > 0, true);
    assert.equal(usage.quotaBytes, 10 * 1024 * 1024);

    const clearRes = await bridge.callNative('WEB_STORAGE_CLEAR');
    assert.equal(clearRes.cleared, true);
  });

  await t.test('HTTP_AUTH_SAVE_CREDENTIAL and HTTP_AUTH_CLEAR_CREDENTIALS', async () => {
    const saveRes = await bridge.callNative('HTTP_AUTH_SAVE_CREDENTIAL', {
      host: 'api.internal.goat.dev',
      username: 'admin',
      password: 'password123',
    });
    assert.equal(saveRes.saved, true);
    assert.equal(saveRes.host, 'api.internal.goat.dev');

    const clearRes = await bridge.callNative('HTTP_AUTH_CLEAR_CREDENTIALS', { host: 'api.internal.goat.dev' });
    assert.equal(clearRes.cleared, true);
  });

  await t.test('STORAGE_SET rejects empty or non-string key', async () => {
    await assert.rejects(
      () => bridge.callNative('STORAGE_SET', { key: '', value: 'val' }),
      (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
    );
  });
});
