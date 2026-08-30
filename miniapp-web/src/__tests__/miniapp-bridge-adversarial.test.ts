import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridge } from '../miniapp-bridge.js';

describe('Adversarial Challenge: MiniAppBridge SDK & Identity Parity (Task 10203)', () => {
  let bridge: GoatBridge;
  const uuidV4Regex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

  beforeEach(() => {
    bridge = new GoatBridge();
  });

  it('ADV-WEB-1: getDeviceInfo returns full schema with valid installGuid structure', async () => {
    const info = await bridge.getDeviceInfo();
    assert.ok(info, 'getDeviceInfo must return non-null object');
    assert.strictEqual(typeof info.model, 'string');
    assert.strictEqual(typeof info.manufacturer, 'string');
    assert.strictEqual(typeof info.brand, 'string');
    assert.strictEqual(typeof info.appVersion, 'string');
    assert.strictEqual(typeof info.installGuid, 'string');
    assert.ok(info.installGuid.length > 0, 'installGuid must be non-empty');
    assert.ok(info.installGuid.startsWith('guid-mock') || uuidV4Regex.test(info.installGuid), 'installGuid must have valid format');
  });

  it('ADV-WEB-2: getInstallGuid matches getDeviceInfo().installGuid exactly across multiple invocations', async () => {
    const info = await bridge.getDeviceInfo();
    const guid = await bridge.getInstallGuid();
    assert.strictEqual(guid, info.installGuid);

    // Repeated calls
    for (let i = 0; i < 50; i++) {
      const g = await bridge.getInstallGuid();
      assert.strictEqual(g, guid, `Invocation ${i} must return invariant installGuid`);
    }
  });

  it('ADV-WEB-3: Native message dispatch handles rapid interleaved GET_DEVICE_INFO calls', async () => {
    const promises = Array.from({ length: 100 }, () => bridge.getDeviceInfo());
    const results = await Promise.all(promises);
    assert.strictEqual(results.length, 100);
    const firstGuid = results[0].installGuid;
    for (const res of results) {
      assert.strictEqual(res.installGuid, firstGuid);
    }
  });
});
