import test from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridgeMock, eventBus } from '../src/index.js';

test('Domain 6: Hardware Sensors & Telephony', async (t) => {
  const bridge = new GoatBridgeMock();

  await t.test('Accelerometer streaming and get latest', async () => {
    const startRes = await bridge.callNative('START_ACCELEROMETER', { interval: 'game' });
    assert.equal(startRes.started, true);

    const latest = await bridge.callNative('GET_LATEST_ACCELEROMETER');
    assert.equal(typeof latest.x, 'number');
    assert.equal(typeof latest.y, 'number');
    assert.equal(typeof latest.z, 'number');

    const stopRes = await bridge.callNative('STOP_ACCELEROMETER');
    assert.equal(stopRes.stopped, true);
  });

  await t.test('Compass & Gyroscope streaming', async () => {
    const startCompass = await bridge.callNative('START_COMPASS');
    assert.equal(startCompass.started, true);

    const startGyro = await bridge.callNative('START_GYROSCOPE');
    assert.equal(startGyro.started, true);

    const latestGyro = await bridge.callNative('GET_LATEST_GYROSCOPE');
    assert.equal(typeof latestGyro.x, 'number');

    const stopGyro = await bridge.callNative('STOP_GYROSCOPE');
    assert.equal(stopGyro.stopped, true);
  });

  await t.test('Device motion streaming', async () => {
    const startMotion = await bridge.callNative('START_DEVICE_MOTION');
    assert.equal(startMotion.started, true);

    const latestMotion = await bridge.callNative('GET_LATEST_DEVICE_MOTION');
    assert.equal(typeof latestMotion.x, 'number');

    const stopMotion = await bridge.callNative('STOP_DEVICE_MOTION');
    assert.equal(stopMotion.stopped, true);
  });

  await t.test('Telephony: MAKE_PHONE_CALL and SEND_SMS', async () => {
    const callRes = await bridge.callNative('MAKE_PHONE_CALL', { phoneNumber: '+1 (800) 555-0199' });
    assert.equal(callRes.handled, true);
    assert.equal(callRes.phoneNumber, '+1 (800) 555-0199');

    const smsRes = await bridge.callNative('SEND_SMS', { phoneNumber: '+1 (800) 555-0199', body: 'Verification code' });
    assert.equal(smsRes.handled, true);
  });
});
