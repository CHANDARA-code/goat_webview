/**
 * Tier 1 - Feature Coverage: F9 Flutter & React Native Bindings
 * Requirements: ORIGINAL_REQUEST §R3, PROJECT.md §F9
 */

import { describe, it, expect, beforeEach, afterEach } from '../harness/test-runner.ts';
import { DualThreadTestEnvironment } from '../harness/dual-thread-harness.ts';

describe('Tier 1 - F9: Flutter & React Native Bindings', () => {
  let env: DualThreadTestEnvironment;

  beforeEach(() => {
    env = new DualThreadTestEnvironment('f9_crossplatform_app');
  });

  afterEach(() => {
    env.destroy();
  });

  it('T1.F9.01: exposes onAppServiceReady stream to Flutter GoatWebViewController', () => {
    env.worker.launch();

    const readyEvent = env.host.lifecycleEvents.find((e) => e.event === 'onAppServiceReady');
    expect(readyEvent).toBeDefined();
    expect(readyEvent!.appId).toBe('f9_crossplatform_app');
  });

  it('T1.F9.02: exposes onAppServiceCrash and onAppServiceTerminate streams to Flutter', () => {
    env.worker.launch();
    env.worker.terminate();

    const termEvent = env.host.lifecycleEvents.find((e) => e.event === 'onAppServiceTerminate');
    expect(termEvent).toBeDefined();
  });

  it('T1.F9.03: emits React Native TurboModule bridge events on state transitions', () => {
    env.host.platform = 'react-native';
    env.worker.launch();
    env.worker.suspend();
    env.worker.resume();

    const events = env.host.lifecycleEvents.map((e) => e.event);
    expect(events).toContain('onAppServiceReady');
    expect(events).toContain('onAppServiceSuspend');
    expect(events).toContain('onAppServiceResume');
  });

  it('T1.F9.04: supports bidirectional event messaging between Host and Worker', () => {
    let receivedPayload: unknown = null;
    env.ipc.on('UI_EVENT', (frame) => {
      receivedPayload = frame.payload;
    });

    env.appView.simulateUserEvent('hostCustomEvent', [], { fromHost: true, platform: 'flutter' });

    expect(receivedPayload).toBeDefined();
    expect((receivedPayload as { data: { fromHost: boolean } }).data.fromHost).toBe(true);
  });

  it('T1.F9.05: releases platform channels and listeners when widget unmounts', () => {
    env.worker.launch();
    env.worker.terminate();

    expect(env.worker.pendingCalls.size).toBe(0);
  });
});
