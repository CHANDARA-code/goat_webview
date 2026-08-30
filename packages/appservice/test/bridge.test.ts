import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { IpcChannel } from '../src/ipc/channel.js';
import { GoatBridgeClient } from '../src/bridge/proxy.js';
import { AppViewBridgeForwarder } from '../src/renderer/bridge-forwarder.js';
import { InMemoryMessagePortPair } from '../src/simulation/in-memory-worker.js';
import { MockBridgeTransport } from '../src/simulation/mock-bridge-transport.js';

describe('Bridge Proxy & RPC Protocol', () => {
  let pair: InMemoryMessagePortPair;
  let workerIpc: IpcChannel;
  let renderIpc: IpcChannel;
  let bridge: GoatBridgeClient;
  let mockHost: MockBridgeTransport;
  let forwarder: AppViewBridgeForwarder;

  beforeEach(() => {
    pair = new InMemoryMessagePortPair();
    workerIpc = new IpcChannel('appservice', pair.port1);
    renderIpc = new IpcChannel('appview', pair.port2);
    bridge = new GoatBridgeClient('test_bridge_app', workerIpc, 2000);
    mockHost = new MockBridgeTransport();
    forwarder = new AppViewBridgeForwarder(renderIpc, mockHost);

    // Forward reply frames from render side back to worker
    workerIpc.on('BRIDGE_REPLY', (frame) => {
      bridge.handleReply(frame.payload as any);
    });
  });

  afterEach(() => {
    bridge.dispose();
    forwarder.dispose();
    workerIpc.dispose();
    renderIpc.dispose();
  });

  it('dispatches GoatBridge.call and resolves upon receiving reply from host', async () => {
    const res = await bridge.call<{ success: boolean }>('storage.set', {
      key: 'auth_token',
      value: 'xyz_987',
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(mockHost.memoryStorage.get('auth_token'), 'xyz_987');

    const getRes = await bridge.call<{ value: string }>('storage.get', { key: 'auth_token' });
    assert.strictEqual(getRes.value, 'xyz_987');
  });

  it('assigns unique callIds for concurrent bridge requests', async () => {
    const p1 = bridge.call('location.getCurrent');
    const p2 = bridge.call('network.request', { url: 'https://goat.dev' });
    const p3 = bridge.call('storage.get', { key: 'non_existent' });

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    assert.ok(r1);
    assert.ok(r2);
    assert.ok(r3);
    assert.strictEqual(mockHost.dispatchedActions.length, 3);
  });

  it('rejects with structured GoatBridgeError when host throws an error', async () => {
    mockHost.errorInjectionAction = 'payment.checkout';

    await assert.rejects(
      async () => {
        await bridge.call('payment.checkout', { amount: 100 });
      },
      (err: any) => {
        return err.code === 'HOST_ERROR_INJECTED' && err.message.includes('Simulated host error');
      }
    );
  });

  it('rejects with BRIDGE_TIMEOUT when RPC call exceeds timeout duration', async () => {
    mockHost.delayMs = 100;

    await assert.rejects(
      async () => {
        // Short timeout of 20ms
        await bridge.call('location.getCurrent', {}, 20);
      },
      (err: any) => {
        return err.code === 'BRIDGE_TIMEOUT';
      }
    );
  });

  it('supports event subscription via on / emit / off', () => {
    let eventReceived = false;
    let receivedPayload: any = null;

    const unsubscribe = bridge.on('networkStatusChange', (payload) => {
      eventReceived = true;
      receivedPayload = payload;
    });

    bridge.emit('networkStatusChange', { isConnected: true, networkType: 'wifi' });
    assert.strictEqual(eventReceived, true);
    assert.strictEqual(receivedPayload.networkType, 'wifi');

    eventReceived = false;
    unsubscribe();
    bridge.emit('networkStatusChange', { isConnected: false });
    assert.strictEqual(eventReceived, false);
  });
});
