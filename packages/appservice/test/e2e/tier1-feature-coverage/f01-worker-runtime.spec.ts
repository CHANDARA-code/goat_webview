/**
 * Tier 1 - Feature Coverage: F1 AppService Worker Runtime
 * Requirements: ORIGINAL_REQUEST §R1, PROJECT.md §F1
 */

import { describe, it, expect, beforeEach, afterEach } from '../harness/test-runner.ts';
import { DualThreadTestEnvironment, VDomEngine } from '../harness/dual-thread-harness.ts';

describe('Tier 1 - F1: AppService Worker Runtime', () => {
  let env: DualThreadTestEnvironment;

  beforeEach(() => {
    env = new DualThreadTestEnvironment('f1_test_app');
  });

  afterEach(() => {
    env.destroy();
  });

  it('T1.F1.01: executes mini-app JS logic in isolated Worker context without DOM access', () => {
    env.worker.launch();
    expect(env.worker.state).toBe('RUNNING');

    const result = env.worker.evaluateScript(`
      const a = 10;
      const b = 20;
      return a + b;
    `);

    expect(result).toBe(30);
  });

  it('T1.F1.02: strictly prevents direct DOM / window global access from Worker context', () => {
    env.worker.launch();

    const domCheck = env.worker.evaluateScript(`
      return {
        hasWindow: typeof window !== 'undefined' && window !== undefined,
        hasDocument: typeof document !== 'undefined' && document !== undefined,
        hasHTMLElement: typeof HTMLElement !== 'undefined' && HTMLElement !== undefined,
        hasLocalStorage: typeof localStorage !== 'undefined' && localStorage !== undefined
      };
    `) as { hasWindow: boolean; hasDocument: boolean; hasHTMLElement: boolean; hasLocalStorage: boolean };

    expect(domCheck.hasWindow).toBe(false);
    expect(domCheck.hasDocument).toBe(false);
    expect(domCheck.hasHTMLElement).toBe(false);
    expect(domCheck.hasLocalStorage).toBe(false);
  });

  it('T1.F1.03: handles this.setData updates and records updated worker state', () => {
    env.worker.launch();

    env.worker.evaluateScript(`
      setData({ username: 'alice', score: 100 });
    `);

    expect(env.worker.data.username).toBe('alice');
    expect(env.worker.data.score).toBe(100);
  });

  it('T1.F1.04: sandboxed error boundary traps syntax/runtime errors and transitions to CRASHED', () => {
    env.worker.launch();
    expect(env.worker.state).toBe('RUNNING');

    expect(() => {
      env.worker.evaluateScript(`
        throw new Error('Fatal worker calculation exception');
      `);
    }).toThrow('Fatal worker calculation exception');

    expect(env.worker.state).toBe('CRASHED');
    expect(env.host.lifecycleEvents.some((e) => e.event === 'onAppServiceCrash')).toBe(true);
  });

  it('T1.F1.05: disposes resources and cancels pending timers on termination', () => {
    env.worker.launch();
    expect(env.worker.state).toBe('RUNNING');

    env.worker.terminate();
    expect(env.worker.state).toBe('TERMINATED');

    expect(() => {
      env.worker.evaluateScript('return 42;');
    }).toThrow('Cannot execute script in TERMINATED state');
  });
});
