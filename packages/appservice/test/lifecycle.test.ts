import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { MiniAppLifecycleFSM } from '../src/lifecycle/fsm.js';
import { IpcChannel } from '../src/ipc/channel.js';
import { InMemoryMessagePortPair } from '../src/simulation/in-memory-worker.js';
import { LifecyclePayload } from '../src/types.js';

describe('Mini-App Lifecycle FSM & Signal Broadcasting', () => {
  let pair: InMemoryMessagePortPair;
  let ipc: IpcChannel;
  let fsm: MiniAppLifecycleFSM;

  beforeEach(() => {
    pair = new InMemoryMessagePortPair();
    ipc = new IpcChannel('appservice', pair.port1);
    fsm = new MiniAppLifecycleFSM('lifecycle_test_app', ipc);
  });

  afterEach(() => {
    ipc.dispose();
  });

  it('progresses through valid lifecycle sequence: INIT -> LAUNCH_SUCCESS -> SUSPEND -> RESUME -> TERMINATE', () => {
    assert.strictEqual(fsm.getState(), 'UNINITIALIZED');

    fsm.transition('INIT');
    assert.strictEqual(fsm.getState(), 'LAUNCHING');

    fsm.transition('LAUNCH_SUCCESS');
    assert.strictEqual(fsm.getState(), 'RUNNING');

    fsm.transition('SUSPEND');
    assert.strictEqual(fsm.getState(), 'SUSPENDED');

    fsm.transition('RESUME');
    assert.strictEqual(fsm.getState(), 'RUNNING');

    fsm.transition('TERMINATE');
    assert.strictEqual(fsm.getState(), 'TERMINATED');
  });

  it('rejects invalid state transitions and throws descriptive Error', () => {
    assert.strictEqual(fsm.getState(), 'UNINITIALIZED');

    // Cannot suspend before launching
    assert.throws(
      () => {
        fsm.transition('SUSPEND');
      },
      /Invalid state transition/
    );
  });

  it('notifies registered observers on every state transition', () => {
    const history: string[] = [];

    fsm.onStateChange((payload: LifecyclePayload) => {
      history.push(`${payload.fromState}->${payload.toState}`);
    });

    fsm.transition('INIT');
    fsm.transition('LAUNCH_SUCCESS');
    fsm.transition('SUSPEND');

    assert.deepStrictEqual(history, [
      'UNINITIALIZED->LAUNCHING',
      'LAUNCHING->RUNNING',
      'RUNNING->SUSPENDED',
    ]);
  });

  it('transitions to CRASHED on FATAL_ERROR and permits terminal clean-up', () => {
    fsm.transition('INIT');
    fsm.transition('LAUNCH_SUCCESS');
    assert.strictEqual(fsm.getState(), 'RUNNING');

    fsm.transition('FATAL_ERROR', { reason: 'Out of memory' });
    assert.strictEqual(fsm.getState(), 'CRASHED');

    fsm.transition('TERMINATE');
    assert.strictEqual(fsm.getState(), 'TERMINATED');
  });
});
