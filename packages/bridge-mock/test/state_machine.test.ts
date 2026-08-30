import test from 'node:test';
import assert from 'node:assert/strict';
import { mockState, GoatBridgeMock } from '../src/index.js';

test('In-Memory Mock State Machine: Snapshot, Restore, Reset & Mutators', async (t) => {
  const bridge = new GoatBridgeMock();

  await t.test('Mutating state reflects in bridge calls', async () => {
    mockState.battery.level = 42;
    mockState.battery.isCharging = true;
    mockState.location.latitude = 40.7128;
    mockState.location.longitude = -74.0060;

    const devInfo = await bridge.callNative('GET_DEVICE_INFO');
    assert.equal(devInfo.batteryLevel, 42);
    assert.equal(devInfo.isCharging, true);

    const loc = await bridge.callNative('GET_LOCATION');
    assert.equal(loc.latitude, 40.7128);
    assert.equal(loc.longitude, -74.0060);
  });

  await t.test('Snapshot and Restore restores exact state including peripheral properties', async () => {
    await bridge.callNative('STORAGE_SET', { key: 'snapshot_key', value: 'snapshot_val' });
    mockState.badgeCount = 42;
    mockState.audio = { status: 'playing', currentTime: 15, duration: 200 };
    mockState.pushToken = 'custom_fcm_token_12345';
    mockState.httpAuthCreds.set('api.internal.com', { username: 'admin', password: 'secretpassword' });
    mockState.isTransparentWindow = true;
    mockState.windowBgHex = '#1E1E2E';
    mockState.pushTopics.add('sports');
    mockState.pushTopics.add('news');
    mockState.pendingNotifications = [{ title: 'Alert', content: 'You have a message', data: { id: 99 } }];
    mockState.enforceGestureFreshness = true;
    mockState.enforceDialogCooldown = true;
    mockState.binaryPorts.set('port_99', { queue: [{ dataBase64: 'QUJD', seq: 1 }], closed: false, currentSeq: 1 });

    const snap = mockState.snapshot();

    // Mutate state after snapshot
    await bridge.callNative('STORAGE_SET', { key: 'snapshot_key', value: 'mutated_val' });
    mockState.brightness = 0.12;
    mockState.badgeCount = 0;
    mockState.audio.status = 'stopped';
    mockState.httpAuthCreds.clear();
    mockState.pushTopics.clear();
    mockState.isTransparentWindow = false;
    mockState.windowBgHex = '#FFFFFF';
    mockState.pendingNotifications = [];
    mockState.enforceGestureFreshness = false;
    mockState.enforceDialogCooldown = false;
    mockState.binaryPorts.clear();

    const mutatedVal = await bridge.callNative('STORAGE_GET', { key: 'snapshot_key' });
    assert.equal(mutatedVal.value, 'mutated_val');

    // Restore snapshot
    mockState.restore(snap);

    const restoredVal = await bridge.callNative('STORAGE_GET', { key: 'snapshot_key' });
    assert.equal(restoredVal.value, 'snapshot_val');
    assert.equal(mockState.brightness, snap.brightness);
    assert.equal(mockState.badgeCount, 42);
    assert.equal(mockState.audio.status, 'playing');
    assert.equal(mockState.audio.currentTime, 15);
    assert.equal(mockState.pushToken, 'custom_fcm_token_12345');
    assert.equal(mockState.httpAuthCreds.get('api.internal.com')?.username, 'admin');
    assert.equal(mockState.httpAuthCreds.get('api.internal.com')?.password, 'secretpassword');
    assert.equal(mockState.isTransparentWindow, true);
    assert.equal(mockState.windowBgHex, '#1E1E2E');
    assert.equal(mockState.pushTopics.has('sports'), true);
    assert.equal(mockState.pushTopics.has('news'), true);
    assert.equal(mockState.pendingNotifications.length, 1);
    assert.equal(mockState.pendingNotifications[0].title, 'Alert');
    assert.equal(mockState.enforceGestureFreshness, true);
    assert.equal(mockState.enforceDialogCooldown, true);
    assert.equal(mockState.binaryPorts.get('port_99')?.queue[0].dataBase64, 'QUJD');
  });

  await t.test('Reset restores defaults', async () => {
    await bridge.callNative('STORAGE_SET', { key: 'dummy', value: '123' });
    mockState.badgeCount = 99;
    mockState.reset();

    const dev = await bridge.callNative('GET_DEVICE_INFO');
    assert.equal(dev.batteryLevel, 95);
    assert.equal(mockState.badgeCount, 0);

    const dummyVal = await bridge.callNative('STORAGE_GET', { key: 'dummy' });
    assert.equal(dummyVal.value, null);
  });

  await t.test('Deep clone isolation: mutating restored objects does not mutate snapshot', async () => {
    mockState.reset();
    mockState.storage.set('app_1', new Map([['foo', 'bar']]));
    mockState.cookies.set('app_1', [{ name: 'sess', value: '123' }]);
    mockState.contacts = [{ name: 'Alice', phoneNumber: '555-1234' }];
    mockState.bleDevices = [{ deviceId: 'BLE:1', name: 'Device 1', rssi: -60, isConnectable: true }];

    const snap = mockState.snapshot();

    // Restore
    mockState.restore(snap);

    // Mutate state deeply
    mockState.storage.get('app_1')?.set('foo', 'mutated_after_restore');
    mockState.cookies.get('app_1')![0].value = 'mutated_cookie';
    mockState.contacts[0].name = 'Mutated Alice';
    mockState.bleDevices[0].name = 'Mutated BLE';

    // Verify snapshot was not mutated
    assert.equal(snap.storage['app_1']['foo'], 'bar');
    assert.equal(snap.cookies['app_1'][0].value, '123');
    assert.equal(snap.contacts[0].name, 'Alice');
    assert.equal(snap.bleDevices[0].name, 'Device 1');
  });
});
