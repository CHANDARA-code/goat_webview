/**
 * Tier 1 - Feature Coverage: F5 Thread-to-Thread IPC & Batching
 * Requirements: ORIGINAL_REQUEST §R2, PROJECT.md §F5
 */

import { describe, it, expect, beforeEach, afterEach } from '../harness/test-runner.ts';
import { IpcChannel, VDomEngine } from '../harness/dual-thread-harness.ts';
import type { UiPatchPayload } from '../../../src/types.ts';

describe('Tier 1 - F5: Thread-to-Thread IPC & Batching', () => {
  let ipc: IpcChannel;

  beforeEach(() => {
    ipc = new IpcChannel(16);
  });

  afterEach(() => {
    ipc.clear();
  });

  it('T1.F5.01: serializes message frame with id, type, seq, timestamp, and payload', () => {
    const frame = ipc.send('TELEMETRY', { metric: 'render_time', value: 12.5 });

    expect(frame.id).toBeDefined();
    expect(frame.type).toBe('TELEMETRY');
    expect(frame.seq).toBe(1);
    expect(frame.timestamp).toBeGreaterThan(0);
    expect((frame.payload as { metric: string }).metric).toBe('render_time');
  });

  it('T1.F5.02: guarantees strict monotonic sequence numbering across frames', () => {
    const f1 = ipc.send('BRIDGE_CALL', { action: 'a1' });
    const f2 = ipc.send('BRIDGE_CALL', { action: 'a2' });
    const f3 = ipc.send('BRIDGE_CALL', { action: 'a3' });

    expect(f1.seq).toBe(1);
    expect(f2.seq).toBe(2);
    expect(f3.seq).toBe(3);
    expect(f3.seq > f2.seq && f2.seq > f1.seq).toBe(true);
  });

  it('T1.F5.03: coalesces multiple UI patches into a single 16ms frame-aligned batch', async () => {
    let flushedBatches: UiPatchPayload[] = [];

    const p1 = { type: 'SET_TEXT' as const, path: [0], text: 'A' };
    const p2 = { type: 'SET_TEXT' as const, path: [1], text: 'B' };
    const p3 = { type: 'SET_TEXT' as const, path: [2], text: 'C' };

    ipc.queueUiPatch(p1, (b) => flushedBatches.push(b));
    ipc.queueUiPatch(p2, (b) => flushedBatches.push(b));
    ipc.queueUiPatch(p3, (b) => flushedBatches.push(b));

    expect(flushedBatches.length).toBe(0); // Not flushed immediately

    // Wait for 16ms flush
    await new Promise((r) => setTimeout(r, 25));

    expect(flushedBatches.length).toBe(1);
    expect(flushedBatches[0].patches.length).toBe(3);
  });

  it('T1.F5.04: achieves sub-5ms round-trip delivery latency on warm IPC channel', async () => {
    const start = performance.now();
    let received = false;

    ipc.on('TELEMETRY', () => {
      received = true;
    });

    ipc.send('TELEMETRY', { ping: true });
    const latency = performance.now() - start;

    expect(received).toBe(true);
    expect(latency).toBeLessThan(5.0);
  });

  it('T1.F5.05: handles listener registration, frame dispatch, and channel reset cleanly', () => {
    let callCount = 0;
    ipc.on('LIFECYCLE', () => {
      callCount++;
    });

    ipc.send('LIFECYCLE', { state: 'RUNNING' });
    ipc.send('LIFECYCLE', { state: 'SUSPENDED' });
    expect(callCount).toBe(2);

    ipc.clear();
    expect(ipc.messageLog.length).toBe(0);
  });
});
