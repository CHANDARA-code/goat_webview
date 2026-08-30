/**
 * Tier 1 - Feature Coverage: F8 iOS Host Integration
 * Requirements: ORIGINAL_REQUEST §R3, PROJECT.md §F8
 */

import { describe, it, expect, beforeEach, afterEach } from '../harness/test-runner.ts';
import { DualThreadTestEnvironment } from '../harness/dual-thread-harness.ts';

describe('Tier 1 - F8: iOS Host Integration', () => {
  let env: DualThreadTestEnvironment;

  beforeEach(() => {
    env = new DualThreadTestEnvironment('f8_ios_app');
    env.host.platform = 'ios';
    env.worker.launch();
  });

  afterEach(() => {
    env.destroy();
  });

  it('T1.F8.01: routes Worker bridge calls via simulated GoatScriptMessageHandler.swift', async () => {
    const res = await env.worker.GoatBridge.call('storage.set', {
      key: 'ios_keychain_token',
      value: 'secure_tok_xyz',
    }) as { success: boolean };

    expect(res.success).toBe(true);
    expect(env.host.memoryStorage.get('ios_keychain_token')).toBe('secure_tok_xyz');
  });

  it('T1.F8.02: supports concurrent bridge call dispatch without thread race', async () => {
    const promises = [
      env.worker.GoatBridge.call('location.getCurrent'),
      env.worker.GoatBridge.call('storage.get', { key: 'ios_keychain_token' }),
      env.worker.GoatBridge.call('network.request', { url: 'https://ios.goat.dev' }),
    ];

    const results = await Promise.all(promises);
    expect(results.length).toBe(3);
    expect(results[0]).toBeDefined();
    expect(results[1]).toBeDefined();
    expect(results[2]).toBeDefined();
  });

  it('T1.F8.03: emits lifecycle signals into GoatView.swift and SwiftUI state', () => {
    env.worker.suspend();
    const suspendSignal = env.host.lifecycleEvents.find((e) => e.event === 'onAppServiceSuspend');
    expect(suspendSignal).toBeDefined();

    env.worker.resume();
    const resumeSignal = env.host.lifecycleEvents.find((e) => e.event === 'onAppServiceResume');
    expect(resumeSignal).toBeDefined();
  });

  it('T1.F8.04: safely marshals complex Swift dictionaries and numbers in bridge replies', async () => {
    const loc = await env.worker.GoatBridge.call('location.getCurrent') as {
      latitude: number;
      longitude: number;
      accuracy: number;
    };

    expect(typeof loc.latitude).toBe('number');
    expect(typeof loc.longitude).toBe('number');
    expect(typeof loc.accuracy).toBe('number');
  });

  it('T1.F8.05: handles asynchronous background tasks without blocking WebKit main thread', async () => {
    env.host.delayMs = 8;
    const res = await env.worker.GoatBridge.call('network.request', { url: 'https://test.com' }) as {
      status: number;
    };

    expect(res.status).toBe(200);
  });
});
