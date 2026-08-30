import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { IpcChannel } from '../src/ipc/channel.js';
import { FrameBatcher } from '../src/ipc/batcher.js';
import { InMemoryMessagePortPair } from '../src/simulation/in-memory-worker.js';
import { UiPatchPayload, VDomPatch } from '../src/types.js';

describe('IPC Framing, Monotonic Sequence & FrameBatcher', () => {
  let pair: InMemoryMessagePortPair;
  let senderChannel: IpcChannel;
  let receiverChannel: IpcChannel;

  beforeEach(() => {
    pair = new InMemoryMessagePortPair();
    senderChannel = new IpcChannel('appservice', pair.port1);
    receiverChannel = new IpcChannel('appview', pair.port2);
  });

  afterEach(() => {
    senderChannel.dispose();
    receiverChannel.dispose();
  });

  it('serializes and validates message frames with monotonic sequence numbering', async () => {
    const receivedFrames: any[] = [];
    receiverChannel.onMessage((frame) => {
      receivedFrames.push(frame);
    });

    senderChannel.send('TELEMETRY', { metric: 'fps', value: 60 });
    senderChannel.send('LIFECYCLE', { state: 'RUNNING' });
    senderChannel.send('BRIDGE_CALL', { action: 'storage.get' });

    // Wait for microtasks
    await new Promise((r) => setTimeout(r, 10));

    assert.strictEqual(receivedFrames.length, 3);
    assert.strictEqual(receivedFrames[0].seq, 1);
    assert.strictEqual(receivedFrames[1].seq, 2);
    assert.strictEqual(receivedFrames[2].seq, 3);
    assert.strictEqual(receivedFrames[0].type, 'TELEMETRY');
    assert.strictEqual(receivedFrames[1].type, 'LIFECYCLE');
    assert.strictEqual(receivedFrames[2].type, 'BRIDGE_CALL');
  });

  it('FrameBatcher accumulates patches and flushes automatically on 16.6ms window', async () => {
    let receivedBatch: UiPatchPayload | null = null;
    receiverChannel.on('UI_PATCH', (frame) => {
      receivedBatch = frame.payload as UiPatchPayload;
    });

    const batcher = new FrameBatcher('root_test', senderChannel, { batchIntervalMs: 16.6 });

    const p1: VDomPatch = { type: 'SET_TEXT', path: [0], text: 'A' };
    const p2: VDomPatch = { type: 'SET_TEXT', path: [1], text: 'B' };
    const p3: VDomPatch = { type: 'SET_TEXT', path: [2], text: 'C' };

    batcher.enqueuePatches([p1]);
    batcher.enqueuePatches([p2, p3]);

    assert.strictEqual(receivedBatch, null); // Not flushed immediately

    // Wait for 16.6ms flush
    await new Promise((r) => setTimeout(r, 35));

    assert.ok(receivedBatch);
    const batch = receivedBatch as UiPatchPayload;
    assert.strictEqual(batch.patches.length, 3);
    batcher.dispose();
  });

  it('allows immediate manual flush of FrameBatcher without waiting for timer', () => {
    let receivedBatch: UiPatchPayload | null = null;
    receiverChannel.on('UI_PATCH', (frame) => {
      receivedBatch = frame.payload as UiPatchPayload;
    });

    const batcher = new FrameBatcher('root_manual', senderChannel, { batchIntervalMs: 50 });
    batcher.enqueuePatches([{ type: 'CREATE', path: [], vnode: { tag: 'div' } }]);
    assert.strictEqual(batcher.pendingCount, 1);

    const flushed = batcher.flush();
    assert.ok(flushed);
    assert.strictEqual(batcher.pendingCount, 0);
    batcher.dispose();
  });
});
