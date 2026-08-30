import test from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridgeMock, mockState, BridgeErrorCodes } from '../src/index.js';

test('Domain 8: Biometrics & Permissions', async (t) => {
  const bridge = new GoatBridgeMock();

  await t.test('CHECK_BIOMETRIC_SUPPORT', async () => {
    const support = await bridge.callNative('CHECK_BIOMETRIC_SUPPORT');
    assert.equal(support.supported, true);
    assert.equal(support.biometryType, 'face');
  });

  await t.test('BIOMETRIC_AUTH in auto-auth mode returns simulated token', async () => {
    const authRes = await bridge.callNative('BIOMETRIC_AUTH', { title: 'Face ID Test' });
    assert.equal(authRes.authenticated, true);
    assert.match(authRes.token!, /^sim_bio_tok_/);
  });

  await t.test('BIOMETRIC_AUTH rejects if biometric permission is not granted', async () => {
    mockState.permissions.set('BIOMETRIC', false);
    await assert.rejects(
      () => bridge.callNative('BIOMETRIC_AUTH'),
      (err: any) => err.code === BridgeErrorCodes.PERMISSION_DENIED
    );
    mockState.permissions.set('BIOMETRIC', true);
  });

  await t.test('CHECK_PERMISSION, REQUEST_PERMISSION, AUTHORIZE, GET_SETTING, OPEN_SETTING', async () => {
    const checkRes = await bridge.callNative('CHECK_PERMISSION', { scope: 'CAMERA' });
    assert.equal(checkRes.granted, true);

    const reqRes = await bridge.callNative('REQUEST_PERMISSION', { scope: 'CAMERA' });
    assert.equal(reqRes.granted, true);

    const authRes = await bridge.callNative('AUTHORIZE', { scope: 'MICROPHONE', granted: true });
    assert.equal(authRes.granted, true);

    const settingRes = await bridge.callNative('GET_SETTING');
    assert.equal(typeof settingRes.authSetting, 'object');
    assert.equal(settingRes.authSetting['scope.camera'], true);

    const openSettingRes = await bridge.callNative('OPEN_SETTING');
    assert.equal(openSettingRes.opened, true);
  });

  await t.test('AUDIT_SANDBOX_HEADERS verifies COOP/COEP isolation', async () => {
    const auditRes = await bridge.callNative('AUDIT_SANDBOX_HEADERS');
    assert.equal(auditRes.coopHeaderPresent, true);
    assert.equal(auditRes.coepHeaderPresent, true);
    assert.equal(auditRes.status, 'HERMETIC_ISOLATION_CONFIRMED');
  });
});
