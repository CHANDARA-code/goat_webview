import test from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridgeMock, mockState, BridgeErrorCodes } from '../src/index.js';

test('Domain 1: Core & System Lifecycle', async (t) => {
  const bridge = new GoatBridgeMock();

  await t.test('GET_DEVICE_INFO returns complete device metrics', async () => {
    const res = await bridge.callNative('GET_DEVICE_INFO');
    assert.equal(res.model, 'Pixel 9 Pro (Simulated)');
    assert.equal(res.platform, 'mock-browser');
    assert.equal(res.batteryLevel, 95);
    assert.equal(res.isCharging, false);
    assert.equal(res.sdkInt, 35);
  });

  await t.test('HAPTIC_FEEDBACK triggers vibration simulation', async () => {
    const res = await bridge.callNative('HAPTIC_FEEDBACK', { type: 'impact', style: 'heavy' });
    assert.equal(res.triggered, true);
    assert.equal(res.type, 'impact');
    assert.equal(res.style, 'heavy');
  });

  await t.test('SET_STATUS_BAR_THEME updates status bar dark mode', async () => {
    const res = await bridge.callNative('SET_STATUS_BAR_THEME', { isDark: true });
    assert.equal(res.updated, true);
    assert.equal(res.isDark, true);
    assert.equal(mockState.statusBarDark, true);
  });

  await t.test('SET_SCREEN_BRIGHTNESS clamps brightness between 0.0 and 1.0', async () => {
    const res1 = await bridge.callNative('SET_SCREEN_BRIGHTNESS', { value: 0.75 });
    assert.equal(res1.value, 0.75);
    assert.equal(res1.updated, true);

    const resGet = await bridge.callNative('GET_SCREEN_BRIGHTNESS');
    assert.equal(resGet.value, 0.75);

    const resClamp = await bridge.callNative('SET_SCREEN_BRIGHTNESS', { value: 2.5 });
    assert.equal(resClamp.value, 1.0);
  });

  await t.test('SET_KEEP_SCREEN_ON updates state', async () => {
    const res = await bridge.callNative('SET_KEEP_SCREEN_ON', { keepScreenOn: true });
    assert.equal(res.keepScreenOn, true);
    assert.equal(mockState.keepScreenOn, true);
  });

  await t.test('CLIPBOARD_SET and CLIPBOARD_GET interact with mock clipboard', async () => {
    await bridge.callNative('CLIPBOARD_SET', { text: 'Secret Coupon CODE 2026' });
    const res = await bridge.callNative('CLIPBOARD_GET');
    assert.equal(res.text, 'Secret Coupon CODE 2026');
    assert.equal(res.hasContent, true);
  });

  await t.test('NAVIGATE_BACK handles empty and populated stacks', async () => {
    const res = await bridge.callNative('NAVIGATE_BACK');
    assert.equal(typeof res.handled, 'boolean');
  });

  await t.test('CAN_I_USE correctly identifies supported and unsupported actions', async () => {
    const res1 = await bridge.callNative('CAN_I_USE', { action: 'GET_LOCATION' });
    assert.equal(res1.supported, true);

    const res2 = await bridge.callNative('CAN_I_USE', { action: 'NON_EXISTENT_FUTURE_API' });
    assert.equal(res2.supported, false);
  });

  await t.test('START_OAUTH_SESSION validates HTTPS and returns mock callback', async () => {
    const res = await bridge.callNative('START_OAUTH_SESSION', {
      authUrl: 'https://auth.goat.dev/login',
      redirectScheme: 'goat://oauth',
    });
    assert.equal(res.status, 'SUCCESS');
    assert.match(res.callbackUrl, /^goat:\/\/oauth\?code=/);
  });

  await t.test('START_OAUTH_SESSION rejects insecure HTTP authUrl', async () => {
    await assert.rejects(
      () => bridge.callNative('START_OAUTH_SESSION', { authUrl: 'http://insecure.dev' }),
      (err: any) => err.code === BridgeErrorCodes.SECURITY_VIOLATION
    );
  });

  await t.test('CANCEL_OAUTH_SESSION cancels session', async () => {
    const res = await bridge.callNative('CANCEL_OAUTH_SESSION');
    assert.equal(res.cancelled, true);
  });
});
