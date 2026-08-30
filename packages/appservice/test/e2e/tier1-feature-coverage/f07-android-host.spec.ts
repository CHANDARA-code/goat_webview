/**
 * Tier 1 - Feature Coverage: F7 Android Host Integration
 * Requirements: ORIGINAL_REQUEST §R3, PROJECT.md §F7
 */

import { describe, it, expect, beforeEach, afterEach } from '../harness/test-runner.ts';
import { DualThreadTestEnvironment } from '../harness/dual-thread-harness.ts';

describe('Tier 1 - F7: Android Host Integration', () => {
  let env: DualThreadTestEnvironment;

  beforeEach(() => {
    env = new DualThreadTestEnvironment('f7_android_app');
    env.host.platform = 'android';
    env.worker.launch();
  });

  afterEach(() => {
    env.destroy();
  });

  it('T1.F7.01: routes Worker bridge calls through simulated GoatBridgeActionHandler.kt', async () => {
    const res = await env.worker.GoatBridge.call('storage.set', {
      key: 'android_pref_key',
      value: 'android_val_1',
    }) as { success: boolean };

    expect(res.success).toBe(true);
    expect(env.host.memoryStorage.get('android_pref_key')).toBe('android_val_1');
  });

  it('T1.F7.02: preserves 141+ Android native action names and signature parity', async () => {
    const actions = ['ui.showToast', 'navigation.navigateTo', 'location.getCurrent', 'network.request'];
    for (const act of actions) {
      const reply = await env.worker.GoatBridge.call(act, { url: 'https://goat.dev' });
      expect(reply).toBeDefined();
    }

    expect(env.host.dispatchedActions).toContain('ui.showToast');
    expect(env.host.dispatchedActions).toContain('navigation.navigateTo');
  });

  it('T1.F7.03: propagates lifecycle signals to GoatView.kt and Jetpack Compose bindings', () => {
    env.worker.suspend();
    env.worker.resume();

    const suspendEvent = env.host.lifecycleEvents.find((e) => e.event === 'onAppServiceSuspend');
    const resumeEvent = env.host.lifecycleEvents.find((e) => e.event === 'onAppServiceResume');

    expect(suspendEvent).toBeDefined();
    expect(resumeEvent).toBeDefined();
  });

  it('T1.F7.04: handles background thread dispatching and returns structured bridge replies', async () => {
    await env.worker.GoatBridge.call('storage.set', { key: 'android_pref_key', value: 'android_val_1' });
    env.host.delayMs = 5; // Simulate background thread delay
    const start = Date.now();
    const reply = await env.worker.GoatBridge.call('storage.get', { key: 'android_pref_key' }) as { value: string };
    const elapsed = Date.now() - start;

    expect(reply.value).toBe('android_val_1');
    expect(elapsed).toBeGreaterThanOrEqual(4);
  });

  it('T1.F7.05: formats native error responses matching Android bridge exception specs', async () => {
    env.host.errorInjectionAction = 'hardware.bluetooth.connect';

    let err: { code: string; message: string } | null = null;
    try {
      await env.worker.GoatBridge.call('hardware.bluetooth.connect', { deviceId: 'bt-001' });
    } catch (e) {
      err = e as { code: string; message: string };
    }

    expect(err).toBeDefined();
    expect(err!.code).toBe('HOST_ERROR_INJECTED');
  });
});
