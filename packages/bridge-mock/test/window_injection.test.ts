import test from 'node:test';
import assert from 'node:assert/strict';
import { installGoatBridgeMock, eventBus } from '../src/index.js';

test('Window Injection & WebKit / Android PostMessage Interfaces', async (t) => {
  const fakeWindow: any = {};
  const bridge = installGoatBridgeMock(fakeWindow);

  await t.test('Attaches window.GoatBridge, webkit messageHandlers, and nativeBridge', () => {
    assert.equal(fakeWindow.GoatBridge, bridge);
    assert.equal(typeof fakeWindow.webkit.messageHandlers.goatBridge.postMessage, 'function');
    assert.equal(typeof fakeWindow.webkit.messageHandlers.nativeBridge.postMessage, 'function');
    assert.equal(typeof fakeWindow.nativeBridge.postMessage, 'function');
  });

  await t.test('EventBus publishes and unsubscribes events cleanly', () => {
    let receivedPayload: any = null;
    const unsub = bridge.on('LOCATION_CHANGE', (data) => {
      receivedPayload = data;
    });

    bridge.emit('LOCATION_CHANGE', { latitude: 37.123, longitude: -122.456 });
    assert.equal(receivedPayload.latitude, 37.123);

    unsub();
    bridge.emit('LOCATION_CHANGE', { latitude: 0, longitude: 0 });
    assert.equal(receivedPayload.latitude, 37.123); // Not changed after unsub
  });

  await t.test('postMessage dispatches and executes native action', async () => {
    const rawReq = JSON.stringify({
      id: 'req_test_101',
      action: 'GET_DEVICE_INFO',
      payload: {},
    });

    fakeWindow.nativeBridge.postMessage(rawReq);
    // Give async event loop tick
    await new Promise((r) => setTimeout(r, 10));
  });
});
