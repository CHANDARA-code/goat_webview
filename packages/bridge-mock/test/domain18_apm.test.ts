import test from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridgeMock } from '../src/index.js';

test('Domain 18: Capability Discovery & APM Telemetry', async (t) => {
  const bridge = new GoatBridgeMock();

  await t.test('GET_API_CAPABILITIES lists registered bridge capabilities', async () => {
    const caps = await bridge.callNative('GET_API_CAPABILITIES');
    assert.equal(caps.totalCapabilities >= 185, true);

    const storageCaps = await bridge.callNative('GET_API_CAPABILITIES', { category: 'STORAGE' });
    assert.equal(storageCaps.capabilities.length >= 10, true);
  });

  await t.test('REGISTER_CAPABILITY adds dynamic plugin capability', async () => {
    const regRes = await bridge.callNative('REGISTER_CAPABILITY', {
      actionName: 'CUSTOM_AI_INFERENCE',
      category: 'AI_PLUGINS',
      isSupported: true,
    });
    assert.equal(regRes.registered, true);

    const canUse = bridge.canIUse('CUSTOM_AI_INFERENCE');
    assert.equal(canUse, true);
  });

  await t.test('GET_SANDBOX_PROCESS_STATUS inspects process isolation status', async () => {
    const status = await bridge.callNative('GET_SANDBOX_PROCESS_STATUS');
    assert.equal(status.isAlive, true);
    assert.equal(status.isInitialized, true);
    assert.equal(typeof status.pid, 'number');
  });

  await t.test('GET_STARTUP_BENCHMARK_REPORT and RECORD_STARTUP_BENCHMARK_SAMPLE', async () => {
    const recordRes = await bridge.callNative('RECORD_STARTUP_BENCHMARK_SAMPLE', {
      coldStartTimeMs: 130.0,
      warmStartTimeMs: 22.0,
    });
    assert.equal(recordRes.recorded, true);

    const report = await bridge.callNative('GET_STARTUP_BENCHMARK_REPORT');
    assert.equal(report.isColdBootWithinSla, true);
    assert.equal(report.isWarmBootWithinSla, true);
  });

  await t.test('REPORT_METRICS, GET_APM_METRICS, RECORD_BRIDGE_TIMING', async () => {
    const reportRes = await bridge.callNative('REPORT_METRICS', {
      fcpMs: 250,
      lcpMs: 800,
      inpMs: 45,
      cls: 0.02,
      bridgeLatencyAvgMs: 3.2,
    });
    assert.equal(reportRes.recorded, true);
    assert.equal(reportRes.isSlaViolation, false);

    const apmSummary = await bridge.callNative('GET_APM_METRICS');
    assert.equal(apmSummary.totalReports >= 1, true);

    const timingRes = await bridge.callNative('RECORD_BRIDGE_TIMING', { action: 'GET_LOCATION', durationMs: 4.5 });
    assert.equal(timingRes.recorded, true);
  });

  await t.test('OpenTelemetry Distributed Tracing: START_TRACE, STOP_TRACE, GET_TRACES', async () => {
    const trace1 = await bridge.callNative('START_TRACE', { operationName: 'fetch_feed_catalog' });
    assert.match(trace1.traceparent, /^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);
    assert.equal(trace1.operationName, 'fetch_feed_catalog');

    const traceStats1 = await bridge.callNative('GET_TRACES');
    assert.equal(traceStats1.activeSpanCount >= 1, true);

    const stopTraceRes = await bridge.callNative('STOP_TRACE', { spanId: trace1.spanId });
    assert.equal(stopTraceRes.stopped, true);

    const traceStats2 = await bridge.callNative('GET_TRACES');
    assert.equal(traceStats2.completedSpanCount >= 1, true);
  });

  await t.test('GET_MEMORY_METRICS returns heap & RAM utilization', async () => {
    const mem = await bridge.callNative('GET_MEMORY_METRICS');
    assert.equal(mem.totalMemoryMb, 256.0);
    assert.equal(mem.maxMemoryMb, 512.0);
  });
});
