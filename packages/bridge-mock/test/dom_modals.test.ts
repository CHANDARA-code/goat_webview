import test from 'node:test';
import assert from 'node:assert/strict';
import {
  biometricModal,
  scannerModal,
  permissionModal,
  externalLinkModal,
  mockState,
} from '../src/index.js';

test('Interactive DOM Modal Subsystems', async (t) => {
  await t.test('Biometric modal subsystem handles headless resolution and lockout', async () => {
    mockState.biometrics.supported = true;
    mockState.biometrics.autoAuthSuccess = true;
    mockState.biometrics.isLockedOut = false;

    const res = await biometricModal.prompt({ title: 'Unlock Vault' });
    assert.equal(res.authenticated, true);
    assert.match(res.token!, /^sim_bio_tok_/);

    // Test lockout
    mockState.biometrics.isLockedOut = true;
    const lockRes = await biometricModal.prompt();
    assert.equal(lockRes.authenticated, false);
    assert.equal(lockRes.error, 'BIOMETRIC_LOCKOUT');
    mockState.biometrics.isLockedOut = false;
  });

  await t.test('Scanner modal subsystem returns mock code payload', async () => {
    mockState.scanner.mockScanResult = 'https://goat.dev/pay?invoice=99281';
    const scanRes = await scannerModal.prompt({ promptMessage: 'Scan merchant QR' });
    assert.equal(scanRes.result, 'https://goat.dev/pay?invoice=99281');
    assert.equal(scanRes.scanType, 'QR_CODE');
  });

  await t.test('Permission priming dialog modal returns scope grant', async () => {
    const permRes = await permissionModal.prompt('CAMERA', 'We need your camera to take photos');
    assert.equal(permRes.scope, 'CAMERA');
    assert.equal(permRes.granted, true);
  });

  await t.test('External link warning modal extracts destinationHost', async () => {
    const linkRes = await externalLinkModal.prompt({ url: 'https://docs.goat.dev/guide' });
    assert.equal(linkRes.opened, true);
    assert.equal(linkRes.destinationHost, 'docs.goat.dev');
  });
});
