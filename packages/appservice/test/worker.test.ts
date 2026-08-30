import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { IpcChannel } from '../src/ipc/channel.js';
import { AppServiceWorkerContainer } from '../src/worker/container.js';
import { InMemoryMessagePortPair } from '../src/simulation/in-memory-worker.js';

describe('AppService Worker Runtime & Sandbox', () => {
  let pair: InMemoryMessagePortPair;
  let ipc: IpcChannel;
  let worker: AppServiceWorkerContainer;

  beforeEach(() => {
    pair = new InMemoryMessagePortPair();
    ipc = new IpcChannel('appservice', pair.port1);
    worker = new AppServiceWorkerContainer('test_app_worker', ipc);
  });

  afterEach(() => {
    worker.destroy();
    ipc.dispose();
  });

  it('executes JS logic in sandboxed context and computes arithmetic results', () => {
    worker.launch();
    assert.strictEqual(worker.state, 'RUNNING');

    const result = worker.evaluateScript(`
      const x = 15;
      const y = 25;
      return x + y;
    `);

    assert.strictEqual(result, 40);
  });

  it('strictly isolates global DOM objects (window, document, HTMLElement, localStorage)', () => {
    worker.launch();

    const domCheck = worker.evaluateScript(`
      return {
        hasWindow: typeof window !== 'undefined' && window !== undefined,
        hasDocument: typeof document !== 'undefined' && document !== undefined,
        hasHTMLElement: typeof HTMLElement !== 'undefined' && HTMLElement !== undefined,
        hasLocalStorage: typeof localStorage !== 'undefined' && localStorage !== undefined
      };
    `) as { hasWindow: boolean; hasDocument: boolean; hasHTMLElement: boolean; hasLocalStorage: boolean };

    assert.strictEqual(domCheck.hasWindow, false);
    assert.strictEqual(domCheck.hasDocument, false);
    assert.strictEqual(domCheck.hasHTMLElement, false);
    assert.strictEqual(domCheck.hasLocalStorage, false);
  });

  it('handles setData mutations and maintains internal worker state', () => {
    worker.launch();

    worker.evaluateScript(`
      setData({ username: 'goat_dev', level: 99 });
    `);

    assert.strictEqual(worker.data.username, 'goat_dev');
    assert.strictEqual(worker.data.level, 99);
  });

  it('catches runtime evaluation errors, transitions to CRASHED, and fires error boundary', () => {
    worker.launch();
    assert.strictEqual(worker.state, 'RUNNING');

    assert.throws(
      () => {
        worker.evaluateScript('throw new Error("Simulated worker fatal exception");');
      },
      /Simulated worker fatal exception/
    );

    assert.strictEqual(worker.state, 'CRASHED');
  });

  it('loads full mini-app bundle and executes App.onLaunch', () => {
    let onLaunchCalled = false;

    worker.loadBundle(`
      App({
        onLaunch() {
          setData({ initialized: true });
        }
      });
      Page({
        id: 'home_page',
        data: { count: 0 },
        onTap() {
          setData({ count: 1 });
        }
      });
    `);

    assert.strictEqual(worker.state, 'RUNNING');
    assert.strictEqual(worker.data.initialized, true);
    assert.ok(worker.evaluator.getPage('home_page'));
  });

  it('prevents script execution after termination', () => {
    worker.launch();
    worker.terminate();
    assert.strictEqual(worker.state, 'TERMINATED');

    assert.throws(
      () => {
        worker.evaluateScript('return 123;');
      },
      /Cannot execute script in TERMINATED state/
    );
  });
});
