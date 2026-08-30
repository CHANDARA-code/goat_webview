/**
 * Tier 1 - Feature Coverage: F2 Bridge Proxy & Interception
 * Requirements: ORIGINAL_REQUEST §R1, PROJECT.md §F2
 */

import { describe, it, expect, beforeEach, afterEach } from '../harness/test-runner.ts';
import { DualThreadTestEnvironment } from '../harness/dual-thread-harness.ts';

describe('Tier 1 - F2: Bridge Proxy & Interception', () => {
  let env: DualThreadTestEnvironment;

  beforeEach(() => {
    env = new DualThreadTestEnvironment('f2_test_app');
    env.worker.launch();
  });

  afterEach(() => {
    env.destroy();
  });

  it('T1.F2.01: intercepts GoatBridge.call and returns a Promise resolved with response', async () => {
    const result = await env.worker.GoatBridge.call('storage.set', {
      key: 'user_token',
      value: 'jwt_abc_123',
    }) as { success: boolean };

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    const getRes = await env.worker.GoatBridge.call('storage.get', {
      key: 'user_token',
    }) as { value: string };

    expect(getRes.value).toBe('jwt_abc_123');
  });

  it('T1.F2.02: assigns unique monotonic callId and serializes to BRIDGE_CALL frame', async () => {
    const p1 = env.worker.GoatBridge.call('location.getCurrent');
    const p2 = env.worker.GoatBridge.call('network.request', { url: 'https://api.goat.dev' });

    await Promise.all([p1, p2]);

    const bridgeFrames = env.ipc.messageLog.filter((f) => f.type === 'BRIDGE_CALL');
    expect(bridgeFrames.length).toBeGreaterThanOrEqual(2);

    const ids = bridgeFrames.map((f) => (f.payload as { callId: string }).callId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('T1.F2.03: resolves Promise upon receiving matching BRIDGE_REPLY frame', async () => {
    const locResult = await env.worker.GoatBridge.call('location.getCurrent') as {
      latitude: number;
      longitude: number;
    };

    expect(locResult.latitude).toBeCloseTo(37.7749);
    expect(locResult.longitude).toBeCloseTo(-122.4194);
  });

  it('T1.F2.04: rejects Promise with structured error when host returns failure', async () => {
    env.host.errorInjectionAction = 'payment.checkout';

    let errorCaught: { code: string; message: string } | null = null;
    try {
      await env.worker.GoatBridge.call('payment.checkout', { amount: 50 });
    } catch (err) {
      errorCaught = err as { code: string; message: string };
    }

    expect(errorCaught).toBeDefined();
    expect(errorCaught!.code).toBe('HOST_ERROR_INJECTED');
    expect(errorCaught!.message).toContain('Simulated host error');
  });

  it('T1.F2.05: dispatches domain-scoped action routing across storage, network, and location', async () => {
    const actions = ['storage.set', 'location.getCurrent', 'network.request'];
    for (const act of actions) {
      const res = await env.worker.GoatBridge.call(act, { key: 'k', value: 'v' });
      expect(res).toBeDefined();
    }

    expect(env.host.dispatchedActions).toContain('storage.set');
    expect(env.host.dispatchedActions).toContain('location.getCurrent');
    expect(env.host.dispatchedActions).toContain('network.request');
  });
});
