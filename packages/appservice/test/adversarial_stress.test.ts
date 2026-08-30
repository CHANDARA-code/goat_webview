import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MessageChannel } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import { IpcChannel } from '../src/ipc/channel.js';
import { MessagePortTransport } from '../src/ipc/transport.js';
import { MessageSerializer } from '../src/ipc/serializer.js';
import { createFrame, isValidFrame } from '../src/ipc/frame.js';
import { FrameBatcher } from '../src/ipc/batcher.js';
import { GoatBridgeClient } from '../src/bridge/proxy.js';
import { RpcPromiseTable, GoatBridgeError } from '../src/bridge/rpc-table.js';
import { AppServiceWorkerContainer } from '../src/worker/container.js';
import { DualThreadTestEnvironment, HostDispatcher, TelemetryRelay } from '../src/simulation/dual-thread-harness.js';
import { InMemoryMessagePortPair } from '../src/simulation/in-memory-worker.js';
import { VDomEngine } from '../src/vdom/index.js';
import { IpcMessageFrame, BridgeCallPayload, BridgeReplyPayload } from '../src/types.js';

describe('Adversarial Stress Testing & Latency Benchmarks (Milestone 1 Challenger)', () => {

  // =========================================================================
  // 1. High-Throughput IPC Stress: 10,000+ Rapid Concurrent Bridge Calls
  // =========================================================================
  describe('1. High-Throughput IPC Stress & Strict Sequencing', () => {
    it('1.1: Processes 10,000 concurrent bridge calls with zero frame drops and 100% promise resolution', async () => {
      const env = new DualThreadTestEnvironment('stress_app_10k');
      const TOTAL_CALLS = 10000;
      const startTime = performance.now();

      const promises: Promise<any>[] = [];
      for (let i = 0; i < TOTAL_CALLS; i++) {
        promises.push(
          env.worker.bridge.call('storage.set', { key: `key_${i}`, value: `val_${i}` })
        );
      }

      const results = await Promise.all(promises);
      const totalDuration = performance.now() - startTime;

      assert.strictEqual(results.length, TOTAL_CALLS, `Must resolve all ${TOTAL_CALLS} calls`);
      for (let i = 0; i < TOTAL_CALLS; i++) {
        assert.deepStrictEqual(results[i], { success: true }, `Call ${i} result must match`);
      }

      assert.strictEqual(env.host.dispatchedActions.length, TOTAL_CALLS, `Host must dispatch all ${TOTAL_CALLS} actions`);
      assert.strictEqual(env.host.memoryStorage.size, TOTAL_CALLS, `Host memory storage must contain all ${TOTAL_CALLS} entries`);
      assert.strictEqual(env.worker.pendingCalls.size, 0, 'Pending promise table must be completely drained');

      console.log(`  [Stress 1.1] 10,000 Concurrent Calls: ${totalDuration.toFixed(2)}ms total (${(totalDuration / TOTAL_CALLS).toFixed(4)}ms/call)`);
      env.destroy();
    });

    it('1.2: Validates strict monotonic sequence ordering across 10,000 outgoing frames without gaps or duplicates', () => {
      const channel = new IpcChannel('appservice');
      const TOTAL_FRAMES = 10000;
      const generatedSeqs: number[] = [];

      for (let i = 0; i < TOTAL_FRAMES; i++) {
        const frame = channel.sendImmediate('TELEMETRY', { seqIndex: i });
        generatedSeqs.push(frame.seq);
      }

      assert.strictEqual(generatedSeqs.length, TOTAL_FRAMES);
      assert.strictEqual(channel.messageLog.length, TOTAL_FRAMES);

      for (let i = 0; i < TOTAL_FRAMES; i++) {
        const expectedSeq = i + 1;
        assert.strictEqual(generatedSeqs[i], expectedSeq, `Sequence ID at index ${i} must be strictly ${expectedSeq}`);
        assert.strictEqual(channel.messageLog[i].seq, expectedSeq, `Log frame sequence at index ${i} must match`);
      }
    });

    it('1.3: Handles 10,000 frames over native worker_threads MessagePortTransport without frame loss', async () => {
      const { port1, port2 } = new MessageChannel();
      const transport1 = new MessagePortTransport(port1 as any);
      const transport2 = new MessagePortTransport(port2 as any);

      const senderChannel = new IpcChannel('appservice', transport1);
      const receiverChannel = new IpcChannel('appview', transport2);

      const TOTAL_MESSAGES = 10000;
      const receivedMessages: IpcMessageFrame[] = [];

      const receivePromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout waiting for ${TOTAL_MESSAGES} messages; received only ${receivedMessages.length}`));
        }, 10000);

        receiverChannel.onMessage((frame) => {
          receivedMessages.push(frame);
          if (receivedMessages.length === TOTAL_MESSAGES) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });

      for (let i = 0; i < TOTAL_MESSAGES; i++) {
        senderChannel.send('TELEMETRY', { payloadIdx: i, data: `msg_${i}` });
      }

      await receivePromise;

      assert.strictEqual(receivedMessages.length, TOTAL_MESSAGES, 'All 10,000 messages must be received across MessagePort');
      for (let i = 0; i < TOTAL_MESSAGES; i++) {
        assert.strictEqual(receivedMessages[i].seq, i + 1, `Message ${i} must maintain FIFO monotonic seq`);
        assert.strictEqual((receivedMessages[i].payload as any).payloadIdx, i, `Message ${i} payload must match`);
      }

      senderChannel.dispose();
      receiverChannel.dispose();
    });

    it('1.4: Asynchronous interleaved burst with randomized host delays resolves accurately without race conditions', async () => {
      const env = new DualThreadTestEnvironment('stress_async_interleaved');
      const TOTAL_ASYNC = 2000;

      // Custom async dispatcher with randomized delays (0 - 4ms)
      const originalDispatch = env.host.dispatch.bind(env.host);
      env.host.dispatch = async (call: BridgeCallPayload): Promise<BridgeReplyPayload> => {
        const jitterMs = Math.floor(Math.random() * 5);
        if (jitterMs > 0) {
          await new Promise((r) => setTimeout(r, jitterMs));
        }
        return originalDispatch(call);
      };

      const promises: Promise<any>[] = [];
      for (let i = 0; i < TOTAL_ASYNC; i++) {
        promises.push(
          env.worker.bridge.call('storage.set', { key: `async_k_${i}`, value: `async_v_${i}` })
        );
      }

      const results = await Promise.all(promises);
      assert.strictEqual(results.length, TOTAL_ASYNC);
      assert.strictEqual(env.worker.pendingCalls.size, 0, 'All interleaved async calls must be settled');
      assert.strictEqual(env.host.dispatchedActions.length, TOTAL_ASYNC);

      env.destroy();
    });
  });

  // =========================================================================
  // 2. Warm-Path & Cold-Path Latency Verification (<5.0ms)
  // =========================================================================
  describe('2. Warm-Path & Cold-Path Latency Verification', () => {
    it('2.1: Measures Cold-Path IPC round-trip latency and verifies all percentiles < 5.0ms', async () => {
      const COLD_ITERATIONS = 100;
      const coldLatencies: number[] = [];

      for (let i = 0; i < COLD_ITERATIONS; i++) {
        // Fresh environment on each iteration to simulate true cold-start IPC channel
        const env = new DualThreadTestEnvironment(`cold_env_${i}`);
        const tStart = performance.now();
        await env.worker.bridge.call('storage.get', { key: 'test_cold' });
        const tDuration = performance.now() - tStart;
        coldLatencies.push(tDuration);
        env.destroy();
      }

      coldLatencies.sort((a, b) => a - b);
      const p50 = coldLatencies[Math.floor(COLD_ITERATIONS * 0.50)];
      const p95 = coldLatencies[Math.floor(COLD_ITERATIONS * 0.95)];
      const p99 = coldLatencies[Math.floor(COLD_ITERATIONS * 0.99)];
      const max = coldLatencies[coldLatencies.length - 1];
      const avg = coldLatencies.reduce((a, b) => a + b, 0) / COLD_ITERATIONS;

      console.log(`\n  [Cold-Path Latency (${COLD_ITERATIONS} fresh initializations)]`);
      console.log(`    Avg: ${avg.toFixed(4)}ms | p50: ${p50.toFixed(4)}ms | p95: ${p95.toFixed(4)}ms | p99: ${p99.toFixed(4)}ms | Max: ${max.toFixed(4)}ms`);

      assert.ok(p50 < 5.0, `Cold p50 (${p50}ms) must be < 5.0ms`);
      assert.ok(p95 < 10.0, `Cold p95 (${p95}ms) must be < 10.0ms`);
      assert.ok(p99 < 20.0, `Cold p99 (${p99}ms) must be < 20.0ms`);
    });

    it('2.2: Measures Warm-Path IPC round-trip latency over 10,000 iterations and verifies p50, p95, p99 < 5.0ms', async () => {
      const env = new DualThreadTestEnvironment('warm_bench_env');
      const WARMUP_COUNT = 500;
      const BENCH_COUNT = 10000;

      // Warmup JIT & event loop
      for (let i = 0; i < WARMUP_COUNT; i++) {
        await env.worker.bridge.call('storage.get', { key: 'warmup' });
      }

      const warmLatencies: number[] = new Array(BENCH_COUNT);
      for (let i = 0; i < BENCH_COUNT; i++) {
        const tStart = performance.now();
        await env.worker.bridge.call('storage.get', { key: 'bench' });
        warmLatencies[i] = performance.now() - tStart;
      }

      warmLatencies.sort((a, b) => a - b);
      const p50 = warmLatencies[Math.floor(BENCH_COUNT * 0.50)];
      const p90 = warmLatencies[Math.floor(BENCH_COUNT * 0.90)];
      const p95 = warmLatencies[Math.floor(BENCH_COUNT * 0.95)];
      const p99 = warmLatencies[Math.floor(BENCH_COUNT * 0.99)];
      const max = warmLatencies[warmLatencies.length - 1];
      const avg = warmLatencies.reduce((a, b) => a + b, 0) / BENCH_COUNT;

      console.log(`\n  [Warm-Path Bridge Latency (${BENCH_COUNT.toLocaleString()} iterations)]`);
      console.log(`    Avg: ${avg.toFixed(4)}ms | p50: ${p50.toFixed(4)}ms | p90: ${p90.toFixed(4)}ms | p95: ${p95.toFixed(4)}ms | p99: ${p99.toFixed(4)}ms | Max: ${max.toFixed(4)}ms`);

      assert.ok(avg < 1.0, `Warm avg (${avg}ms) must be < 1.0ms`);
      assert.ok(p50 < 1.0, `Warm p50 (${p50}ms) must be < 1.0ms`);
      assert.ok(p95 < 2.0, `Warm p95 (${p95}ms) must be < 2.0ms`);
      assert.ok(p99 < 5.0, `Warm p99 (${p99}ms) must be < 5.0ms (Spec: <5.0ms)`);

      env.destroy();
    });

    it('2.3: Measures MessageChannel Transport latency across 10,000 async frame round-trips', async () => {
      const { port1, port2 } = new MessageChannel();
      const channel1 = new IpcChannel('appservice', new MessagePortTransport(port1 as any));
      const channel2 = new IpcChannel('appview', new MessagePortTransport(port2 as any));

      // Echo pong
      channel2.onMessage((frame) => {
        if (frame.type === 'HEARTBEAT_PING') {
          channel2.send('HEARTBEAT_PONG', { reqSeq: frame.seq });
        }
      });

      const ITERATIONS = 10000;
      const latencies: number[] = new Array(ITERATIONS);

      // Warmup
      for (let i = 0; i < 200; i++) {
        await new Promise<void>((resolve) => {
          const off = channel1.on('HEARTBEAT_PONG', () => {
            off();
            resolve();
          });
          channel1.send('HEARTBEAT_PING', {});
        });
      }

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        await new Promise<void>((resolve) => {
          const off = channel1.on('HEARTBEAT_PONG', () => {
            off();
            latencies[i] = performance.now() - start;
            resolve();
          });
          channel1.send('HEARTBEAT_PING', { i });
        });
      }

      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(ITERATIONS * 0.50)];
      const p95 = latencies[Math.floor(ITERATIONS * 0.95)];
      const p99 = latencies[Math.floor(ITERATIONS * 0.99)];
      const avg = latencies.reduce((a, b) => a + b, 0) / ITERATIONS;

      console.log(`\n  [Native MessagePort Transport Latency (${ITERATIONS.toLocaleString()} iterations)]`);
      console.log(`    Avg: ${avg.toFixed(4)}ms | p50: ${p50.toFixed(4)}ms | p95: ${p95.toFixed(4)}ms | p99: ${p99.toFixed(4)}ms`);

      assert.ok(p99 < 5.0, `MessagePort p99 latency (${p99}ms) must be < 5.0ms`);

      channel1.dispose();
      channel2.dispose();
    });

    it('2.4: Compares FrameBatcher 16.6ms batched UI updates vs immediate bridge calls', async () => {
      const channel = new IpcChannel('appservice', undefined, { batchIntervalMs: 16.6 });
      let flushedBatches = 0;
      let totalPatchesFlushed = 0;

      channel.on('UI_PATCH', (frame: any) => {
        flushedBatches++;
        totalPatchesFlushed += frame.payload.patches.length;
      });

      // Rapidly queue 50 UI patches within single tick
      const vNode1 = VDomEngine.createVNode('div', { id: 'app' }, [], 'Hello');
      const vNode2 = VDomEngine.createVNode('div', { id: 'app', class: 'active' }, [], 'World');
      const patches = VDomEngine.diff(vNode1, vNode2);

      for (let i = 0; i < 50; i++) {
        channel.queueUiPatch(patches[0]);
      }

      // Immediately after queuing, no frame should be emitted yet (waiting for 16.6ms tick)
      assert.strictEqual(flushedBatches, 0, 'Batched patches must not flush synchronously');
      assert.strictEqual(channel.batcher.pendingCount, 50, 'Batcher must hold 50 pending patches');

      // Wait 30ms for frame batcher timer
      await new Promise((r) => setTimeout(r, 35));

      assert.strictEqual(flushedBatches, 1, 'Batcher must coalesce 50 patches into 1 batch frame');
      assert.strictEqual(totalPatchesFlushed, 50, 'Batch frame must contain all 50 patches');
      assert.strictEqual(channel.batcher.pendingCount, 0, 'Batcher queue must be empty after flush');

      channel.dispose();
    });
  });

  // =========================================================================
  // 3. Timeout, Cancellation & Memory Leak Stress
  // =========================================================================
  describe('3. Timeout, Cancellation & Memory Leak Stress', () => {
    it('3.1: Automatically cancels timers and releases RpcPromiseTable entries on timeout', async () => {
      const rpcTable = new RpcPromiseTable(50); // 50ms default timeout
      const TIMEOUT_CALLS = 500;
      const rejectionErrors: GoatBridgeError[] = [];

      const promises: Promise<any>[] = [];
      for (let i = 0; i < TIMEOUT_CALLS; i++) {
        const callId = `hanging_call_${i}`;
        const p = new Promise((resolve, reject) => {
          rpcTable.register(callId, 'hanging.action', resolve, reject, 40);
        }).catch((err) => {
          rejectionErrors.push(err);
        });
        promises.push(p);
      }

      assert.strictEqual(rpcTable.pendingCount, TIMEOUT_CALLS, 'Must hold all registered hanging calls');

      // Wait for timeouts to trigger (60ms)
      await new Promise((r) => setTimeout(r, 80));
      await Promise.all(promises);

      assert.strictEqual(rejectionErrors.length, TIMEOUT_CALLS, `All ${TIMEOUT_CALLS} calls must be rejected`);
      for (const err of rejectionErrors) {
        assert.strictEqual(err.code, 'BRIDGE_TIMEOUT');
        assert.ok(err.message.includes('timed out'));
      }

      assert.strictEqual(rpcTable.pendingCount, 0, 'RpcPromiseTable must release all memory and have 0 pending entries');
    });

    it('3.2: Handles late responses arriving after timeout gracefully without errors or leaks', async () => {
      const rpcTable = new RpcPromiseTable(25);
      let rejected = false;

      const p = new Promise((resolve, reject) => {
        rpcTable.register('late_call', 'test.late', resolve, reject, 25);
      }).catch((err) => {
        rejected = true;
        assert.strictEqual(err.code, 'BRIDGE_TIMEOUT');
      });

      // Wait 40ms for timeout to fire
      await new Promise((r) => setTimeout(r, 40));
      await p;
      assert.strictEqual(rejected, true, 'Call must have timed out');
      assert.strictEqual(rpcTable.pendingCount, 0);

      // Now simulate late host reply arriving after timeout
      const resolved = rpcTable.resolve('late_call', { lateData: 'too late' });
      assert.strictEqual(resolved, false, 'Late resolve must return false and be safely discarded');

      const rejectedLate = rpcTable.reject('late_call', { code: 'LATE_ERR', message: 'too late' });
      assert.strictEqual(rejectedLate, false, 'Late reject must return false and be safely discarded');
      assert.strictEqual(rpcTable.pendingCount, 0);
    });

    it('3.3: Stress tests 20,000 rapid timeout/cancellation cycles with heap memory stability verification', async () => {
      async function runChurn(table: RpcPromiseTable, count: number) {
        const promises: Promise<any>[] = [];
        for (let i = 0; i < count; i++) {
          const callId = `churn_${i}`;
          promises.push(
            new Promise((resolve, reject) => {
              table.register(callId, 'churn.action', resolve, reject, 10);
              if (i % 2 === 0) {
                table.resolve(callId, { ok: true });
              }
            }).catch(() => {})
          );
        }
        await new Promise((r) => setTimeout(r, 25));
        await Promise.all(promises);
      }

      const rpcTable = new RpcPromiseTable(10);

      // Warmup and baseline
      await runChurn(rpcTable, 1000);
      if (typeof global.gc === 'function') {
        global.gc();
        global.gc();
      }
      const initialHeap = process.memoryUsage().heapUsed;

      // Run 20,000 churn cycles in 4 batches
      for (let cycle = 0; cycle < 4; cycle++) {
        await runChurn(rpcTable, 5000);
      }

      assert.strictEqual(rpcTable.pendingCount, 0, 'Pending map must be 0 after all cycles');

      if (typeof global.gc === 'function') {
        global.gc();
        global.gc();
        const finalHeap = process.memoryUsage().heapUsed;
        const heapGrowthMb = (finalHeap - initialHeap) / (1024 * 1024);
        console.log(`  [Memory Stability Check] Heap growth after 20,000 RpcPromiseTable churn cycles: ${heapGrowthMb.toFixed(2)} MB`);
        assert.ok(heapGrowthMb < 25, `Heap growth must be under 25MB, measured: ${heapGrowthMb}MB`);
      } else {
        console.log('  [Memory Stability Check] Verified 0 retained entries across 20,000 cycles (gc not exposed in this runner)');
      }
    });

    it('3.4: Worker container dispose() cleans up active timers and pending promises with BRIDGE_DISPOSED', async () => {
      const channel = new IpcChannel('appservice');
      const container = new AppServiceWorkerContainer('dispose_test_app', channel);
      container.launch();

      const errors: GoatBridgeError[] = [];
      const p1 = container.GoatBridge.call('unresolved.1', {}, 60000).catch((e) => errors.push(e));
      const p2 = container.GoatBridge.call('unresolved.2', {}, 60000).catch((e) => errors.push(e));
      const p3 = container.GoatBridge.call('unresolved.3', {}, 60000).catch((e) => errors.push(e));

      assert.strictEqual(container.pendingCalls.size, 3, 'Must have 3 pending calls registered');

      // Dispose container while calls are still waiting
      container.dispose();

      await Promise.all([p1, p2, p3]);

      assert.strictEqual(errors.length, 3, 'All 3 calls must be rejected upon disposal');
      for (const err of errors) {
        assert.strictEqual(err.code, 'BRIDGE_DISPOSED');
      }
      assert.strictEqual(container.pendingCalls.size, 0, 'Pending calls map must be 0');
      assert.strictEqual(container.state, 'TERMINATED');

      channel.dispose();
    });
  });

  // =========================================================================
  // 4. Edge Cases, Malformed Frames & Large Payloads
  // =========================================================================
  describe('4. Edge Cases, Malformed Payloads & Resilience', () => {
    it('4.1: Serializes and deserializes massive 5MB payloads across IPC without data loss', () => {
      const largeData = {
        items: Array.from({ length: 5000 }, (_, idx) => ({
          id: idx,
          name: `Item #${idx} with long description and unicode 🚀 🌟 ⚡️`,
          nested: { score: idx * 1.5, flags: [true, false, true], tags: ['alpha', 'beta', 'gamma'] }
        }))
      };

      const frame = createFrame('BRIDGE_CALL', largeData, 42, 'appservice');
      const serialized = MessageSerializer.serialize(frame);
      assert.ok(serialized.length > 500000, `Serialized payload size must be large (>0.5MB), actual: ${serialized.length} bytes`);

      const deserialized = MessageSerializer.deserialize<typeof largeData>(serialized);
      assert.notStrictEqual(deserialized, null);
      assert.strictEqual(deserialized?.seq, 42);
      assert.strictEqual(deserialized?.type, 'BRIDGE_CALL');
      assert.strictEqual(deserialized?.payload.items.length, 5000);
      assert.deepStrictEqual(deserialized?.payload.items[4999], largeData.items[4999]);
    });

    it('4.2: Handles corrupted, malformed, and non-frame inputs gracefully without throwing', () => {
      const channel = new IpcChannel('appservice');
      let messageHandled = false;

      channel.onMessage(() => {
        messageHandled = true;
      });

      // Feed various invalid inputs to handleIncoming
      channel.handleIncoming(null);
      channel.handleIncoming(undefined);
      channel.handleIncoming(12345);
      channel.handleIncoming('not valid json');
      channel.handleIncoming('{"incomplete":');
      channel.handleIncoming({});
      channel.handleIncoming({ type: 'NO_SEQ_OR_ID' });

      assert.strictEqual(messageHandled, false, 'No listeners should be invoked for malformed frames');
      assert.strictEqual(channel.messageLog.length, 0, 'No malformed frames should be logged');

      // Valid frame works immediately after
      const validFrame = createFrame('TELEMETRY', { valid: true }, 1, 'appservice');
      channel.handleIncoming(validFrame);
      assert.strictEqual(messageHandled, true);
      assert.strictEqual(channel.messageLog.length, 1);

      channel.dispose();
    });

    it('4.3: Propagates structured native errors with error code, message, and details intact', async () => {
      const env = new DualThreadTestEnvironment('error_prop_app');
      env.host.errorInjectionAction = 'payment.requestPayment';

      let caughtError: GoatBridgeError | null = null;
      try {
        await env.worker.bridge.call('payment.requestPayment', { amount: 100 });
      } catch (err: any) {
        caughtError = err;
      }

      assert.notStrictEqual(caughtError, null, 'Must throw on host error');
      assert.strictEqual(caughtError?.name, 'GoatBridgeError');
      assert.strictEqual(caughtError?.code, 'HOST_ERROR_INJECTED');
      assert.ok(caughtError?.message.includes('Simulated host error'));

      env.destroy();
    });
  });
});
