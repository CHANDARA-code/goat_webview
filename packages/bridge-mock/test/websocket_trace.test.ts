import test from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridgeMock, traceClient, mockState } from '../src/index.js';

test('WebSocket Trace Client & CDP Relay Telemetry', async (t) => {
  const bridge = new GoatBridgeMock();

  await t.test('Bridge calls generate and record TraceEnvelopes', async () => {
    const prevTraceCount = mockState.traces.length;
    await bridge.callNative('GET_DEVICE_INFO');

    assert.equal(mockState.traces.length, prevTraceCount + 1);
    const lastTrace = mockState.traces[mockState.traces.length - 1];
    assert.equal(lastTrace.action, 'GET_DEVICE_INFO');
    assert.equal(lastTrace.response?.code, 200);
    assert.equal(typeof lastTrace.durationMs, 'number');
    assert.equal(lastTrace.thread, 'mock-main-thread');
  });

  await t.test('CDP setMockResponse dynamically overrides bridge responses', async () => {
    traceClient.setMockResponse('GET_LOCATION', {
      latitude: 51.5074,
      longitude: -0.1278,
      speed: 10.5,
      accuracy: 2.0,
      altitude: 35.0,
    });

    const mockLoc = await bridge.callNative('GET_LOCATION');
    assert.equal(mockLoc.latitude, 51.5074);
    assert.equal(mockLoc.longitude, -0.1278);

    traceClient.clearMockOverrides();
    const originalLoc = await bridge.callNative('GET_LOCATION');
    assert.equal(originalLoc.latitude, mockState.location.latitude);
  });
});
