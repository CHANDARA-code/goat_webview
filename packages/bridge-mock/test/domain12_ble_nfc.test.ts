import test from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridgeMock, mockState } from '../src/index.js';

test('Domain 12: Bluetooth Low Energy & NFC', async (t) => {
  mockState.reset();
  const bridge = new GoatBridgeMock();

  await t.test('BLE scanning, connection, and GATT characteristic read/write', async () => {
    // Start BLE scan
    const scanRes = await bridge.callNative('BLE_START_SCAN');
    assert.equal(scanRes.isScanning, true);
    assert.equal(scanRes.devices.length >= 1, true);

    const deviceId = scanRes.devices[0].deviceId;

    // Connect device
    const connRes = await bridge.callNative('BLE_CONNECT', { deviceId });
    assert.equal(connRes.connected, true);
    assert.equal(connRes.deviceId, deviceId);

    // Read characteristic
    const readRes = await bridge.callNative('BLE_READ_CHARACTERISTIC', {
      deviceId,
      characteristicUuid: '00002a00-0000-1000-8000-00805f9b34fb',
    });
    assert.equal(typeof readRes.value, 'string');

    // Write characteristic
    const writeRes = await bridge.callNative('BLE_WRITE_CHARACTERISTIC', {
      deviceId,
      characteristicUuid: '00002a00-0000-1000-8000-00805f9b34fb',
      value: 'Updated POS Terminal',
    });
    assert.equal(writeRes.written, true);

    // Read back written value
    const readBack = await bridge.callNative('BLE_READ_CHARACTERISTIC', {
      deviceId,
      characteristicUuid: '00002a00-0000-1000-8000-00805f9b34fb',
    });
    assert.equal(readBack.value, 'Updated POS Terminal');

    // Disconnect
    const disconnRes = await bridge.callNative('DISCONNECT_BLE_DEVICE', { deviceId });
    assert.equal(disconnRes.disconnected, true);

    // Stop scan
    const stopScan = await bridge.callNative('BLE_STOP_SCAN');
    assert.equal(stopScan.stopped, true);
  });

  await t.test('NFC: NFC_READ_TAG, NFC_WRITE_TAG, START_NFC_DISCOVERY, STOP_NFC_DISCOVERY', async () => {
    mockState.reset();
    const readNfc = await bridge.callNative('NFC_READ_TAG');
    assert.equal(readNfc.type, 'NDEF_TEXT');
    assert.equal(readNfc.payload, 'https://goat.dev/nfc/tap-to-open');

    const writeNfc = await bridge.callNative('NFC_WRITE_TAG', { payload: 'https://goat.dev/promo/new-user' });
    assert.equal(writeNfc.written, true);

    const readUpdated = await bridge.callNative('NFC_READ_TAG');
    assert.equal(readUpdated.payload, 'https://goat.dev/promo/new-user');

    const startDisc = await bridge.callNative('START_NFC_DISCOVERY');
    assert.equal(startDisc.started, true);

    const stopDisc = await bridge.callNative('STOP_NFC_DISCOVERY');
    assert.equal(stopDisc.stopped, true);
  });
});
