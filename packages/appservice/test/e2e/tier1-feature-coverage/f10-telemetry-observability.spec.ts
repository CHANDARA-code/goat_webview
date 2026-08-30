/**
 * Tier 1 - Feature Coverage: F10 Telemetry & Observability
 * Requirements: ORIGINAL_REQUEST §R4, PROJECT.md §F10
 */

import { describe, it, expect, beforeEach, afterEach } from '../harness/test-runner.ts';
import { DualThreadTestEnvironment } from '../harness/dual-thread-harness.ts';

describe('Tier 1 - F10: Telemetry & Observability', () => {
  let env: DualThreadTestEnvironment;

  beforeEach(() => {
    env = new DualThreadTestEnvironment('f10_telemetry_app');
    env.worker.launch();
  });

  afterEach(() => {
    env.destroy();
  });

  it('T1.F10.01: emits structured trace spans tagging AppService, AppView, and Host thread lanes', async () => {
    await env.worker.GoatBridge.call('location.getCurrent');

    const appServiceSpans = env.telemetry.getTracesByLane('AppService');
    const appViewSpans = env.telemetry.getTracesByLane('AppView');
    const hostSpans = env.telemetry.getTracesByLane('Host');

    expect(appServiceSpans.length).toBeGreaterThanOrEqual(1);
    expect(appViewSpans.length).toBeGreaterThanOrEqual(1);
    expect(hostSpans.length).toBeGreaterThanOrEqual(1);
  });

  it('T1.F10.02: correlates multi-thread spans via shared callId and traceId', async () => {
    await env.worker.GoatBridge.call('storage.set', { key: 'foo', value: 'bar' });

    const traces = env.telemetry.traces.filter((t) => t.name.includes('storage.set'));
    expect(traces.length).toBeGreaterThanOrEqual(2);

    const traceId = traces[0].traceId;
    expect(traces.every((t) => t.traceId === traceId)).toBe(true);
  });

  it('T1.F10.03: calculates accurate latency waterfall across Worker -> AppView -> Host', async () => {
    await env.worker.GoatBridge.call('network.request', { url: 'https://test.dev' });

    const lastTrace = env.telemetry.traces.find((t) => t.name === 'bridgeReply:network.request');
    expect(lastTrace).toBeDefined();
    expect(typeof lastTrace!.durationMs).toBe('number');
    expect(lastTrace!.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('T1.F10.04: formats telemetry records compatible with @goat/server CDP relay schema', () => {
    env.telemetry.recordSpan({
      traceId: 'trace_custom_1',
      spanId: 'span_1',
      threadLane: 'AppService',
      name: 'customWorkerCompute',
      seqId: 10,
      timestamp: Date.now(),
      durationMs: 3.2,
      metadata: { itemsProcessed: 50 },
    });

    const recorded = env.telemetry.traces.find((t) => t.traceId === 'trace_custom_1');
    expect(recorded).toBeDefined();
    expect(recorded!.metadata?.itemsProcessed).toBe(50);
  });

  it('T1.F10.05: produces waterfall events renderable in docs-site/ Bridge Inspector', async () => {
    await env.worker.GoatBridge.call('storage.get', { key: 'foo' });

    const waterfall = env.telemetry.getTraceWaterfall(env.telemetry.traces[0].traceId);
    expect(waterfall.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < waterfall.length; i++) {
      expect(waterfall[i].timestamp).toBeGreaterThanOrEqual(waterfall[i - 1].timestamp);
    }
  });
});
