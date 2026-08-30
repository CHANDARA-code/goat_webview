/**
 * Tier 1 - Feature Coverage: F3 Lifecycle Management
 * Requirements: ORIGINAL_REQUEST §R1, PROJECT.md §F3
 */

import { describe, it, expect, beforeEach, afterEach } from '../harness/test-runner.ts';
import { DualThreadTestEnvironment } from '../harness/dual-thread-harness.ts';

describe('Tier 1 - F3: Lifecycle Management', () => {
  let env: DualThreadTestEnvironment;

  beforeEach(() => {
    env = new DualThreadTestEnvironment('f3_test_app');
  });

  afterEach(() => {
    env.destroy();
  });

  it('T1.F3.01: starts in UNINITIALIZED and transitions to RUNNING on launch()', () => {
    expect(env.worker.state).toBe('UNINITIALIZED');

    env.worker.launch();
    expect(env.worker.state).toBe('RUNNING');

    const readyEvent = env.host.lifecycleEvents.find((e) => e.event === 'onAppServiceReady');
    expect(readyEvent).toBeDefined();
    expect(readyEvent!.appId).toBe('f3_test_app');
  });

  it('T1.F3.02: transitions to SUSPENDED on backgrounding and emits onAppServiceSuspend', () => {
    env.worker.launch();
    env.worker.suspend();

    expect(env.worker.state).toBe('SUSPENDED');
    const suspendEvent = env.host.lifecycleEvents.find((e) => e.event === 'onAppServiceSuspend');
    expect(suspendEvent).toBeDefined();
  });

  it('T1.F3.03: transitions from SUSPENDED to RUNNING on resume() and emits onAppServiceResume', () => {
    env.worker.launch();
    env.worker.suspend();
    expect(env.worker.state).toBe('SUSPENDED');

    env.worker.resume();
    expect(env.worker.state).toBe('RUNNING');

    const resumeEvent = env.host.lifecycleEvents.find((e) => e.event === 'onAppServiceResume');
    expect(resumeEvent).toBeDefined();
  });

  it('T1.F3.04: transitions to TERMINATED on terminate() and prevents subsequent operations', () => {
    env.worker.launch();
    env.worker.terminate();

    expect(env.worker.state).toBe('TERMINATED');
    const termEvent = env.host.lifecycleEvents.find((e) => e.event === 'onAppServiceTerminate');
    expect(termEvent).toBeDefined();
  });

  it('T1.F3.05: transitions to CRASHED on unhandled worker exception and notifies host', () => {
    env.worker.launch();

    try {
      env.worker.evaluateScript('throw new Error("Worker out of memory simulated");');
    } catch {
      // expected
    }

    expect(env.worker.state).toBe('CRASHED');
    const crashEvent = env.host.lifecycleEvents.find((e) => e.event === 'onAppServiceCrash');
    expect(crashEvent).toBeDefined();
    expect(crashEvent!.details?.error).toContain('Worker out of memory simulated');
  });
});
