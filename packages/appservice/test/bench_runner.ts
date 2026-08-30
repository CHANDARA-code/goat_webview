import { performance } from 'node:perf_hooks';
import { MessageChannel } from 'node:worker_threads';
import { IpcChannel } from '/Users/chandara-dgc/Documents/working/goat_webview/goat_webview/packages/appservice/dist/src/ipc/channel.js';
import { MessagePortTransport } from '/Users/chandara-dgc/Documents/working/goat_webview/goat_webview/packages/appservice/dist/src/ipc/transport.js';
import { DualThreadTestEnvironment } from '/Users/chandara-dgc/Documents/working/goat_webview/goat_webview/packages/appservice/dist/src/simulation/dual-thread-harness.js';
import { RpcPromiseTable } from '/Users/chandara-dgc/Documents/working/goat_webview/goat_webview/packages/appservice/dist/src/bridge/rpc-table.js';

async function main() {
  console.log('=== EMPIRICAL LATENCY & STRESS BENCHMARK RUNNER ===');

  // 1. Cold-Path Latency (100 fresh environments)
  const COLD_N = 100;
  const coldLatencies: number[] = [];
  for (let i = 0; i < COLD_N; i++) {
    const env = new DualThreadTestEnvironment(`cold_bench_${i}`);
    const t0 = performance.now();
    await env.worker.bridge.call('storage.get', { key: `k_${i}` });
    const t1 = performance.now();
    coldLatencies.push(t1 - t0);
    env.destroy();
  }
  coldLatencies.sort((a, b) => a - b);
  const coldAvg = coldLatencies.reduce((a, b) => a + b, 0) / COLD_N;
  const coldP50 = coldLatencies[Math.floor(COLD_N * 0.50)];
  const coldP90 = coldLatencies[Math.floor(COLD_N * 0.90)];
  const coldP95 = coldLatencies[Math.floor(COLD_N * 0.95)];
  const coldP99 = coldLatencies[Math.floor(COLD_N * 0.99)];
  const coldMax = coldLatencies[COLD_N - 1];

  console.log('\n[1. Cold-Path Latency (100 fresh environments)]');
  console.log(`  Iterations: ${COLD_N}`);
  console.log(`  Average   : ${coldAvg.toFixed(4)} ms`);
  console.log(`  p50       : ${coldP50.toFixed(4)} ms`);
  console.log(`  p90       : ${coldP90.toFixed(4)} ms`);
  console.log(`  p95       : ${coldP95.toFixed(4)} ms`);
  console.log(`  p99       : ${coldP99.toFixed(4)} ms`);
  console.log(`  Max       : ${coldMax.toFixed(4)} ms`);

  // 2. Warm-Path Latency (10,000 calls post 1,000 warmup)
  const WARM_N = 10000;
  const env = new DualThreadTestEnvironment('warm_bench_standalone');
  for (let i = 0; i < 1000; i++) {
    await env.worker.bridge.call('storage.get', { key: 'warmup' });
  }
  const warmLatencies: number[] = new Array(WARM_N);
  for (let i = 0; i < WARM_N; i++) {
    const t0 = performance.now();
    await env.worker.bridge.call('storage.get', { key: `warm_${i}` });
    const t1 = performance.now();
    warmLatencies[i] = t1 - t0;
  }
  env.destroy();

  warmLatencies.sort((a, b) => a - b);
  const warmAvg = warmLatencies.reduce((a, b) => a + b, 0) / WARM_N;
  const warmP50 = warmLatencies[Math.floor(WARM_N * 0.50)];
  const warmP90 = warmLatencies[Math.floor(WARM_N * 0.90)];
  const warmP95 = warmLatencies[Math.floor(WARM_N * 0.95)];
  const warmP99 = warmLatencies[Math.floor(WARM_N * 0.99)];
  const warmMax = warmLatencies[WARM_N - 1];

  console.log('\n[2. Warm-Path Latency (10,000 calls post-warmup)]');
  console.log(`  Iterations: ${WARM_N.toLocaleString()}`);
  console.log(`  Average   : ${warmAvg.toFixed(4)} ms`);
  console.log(`  p50       : ${warmP50.toFixed(4)} ms`);
  console.log(`  p90       : ${warmP90.toFixed(4)} ms`);
  console.log(`  p95       : ${warmP95.toFixed(4)} ms`);
  console.log(`  p99       : ${warmP99.toFixed(4)} ms`);
  console.log(`  Max       : ${warmMax.toFixed(4)} ms`);

  // 3. High-Throughput Burst Stress (10,000 concurrent calls)
  const BURST_N = 10000;
  const burstEnv = new DualThreadTestEnvironment('burst_bench');
  const tBurst0 = performance.now();
  const burstPromises: Promise<any>[] = [];
  for (let i = 0; i < BURST_N; i++) {
    burstPromises.push(burstEnv.worker.bridge.call('storage.set', { key: `k_${i}`, value: `v_${i}` }));
  }
  const burstResults = await Promise.all(burstPromises);
  const tBurst1 = performance.now();
  const burstTotalMs = tBurst1 - tBurst0;
  const opsPerSec = (BURST_N / (burstTotalMs / 1000)).toFixed(0);

  console.log('\n[3. High-Throughput Burst Stress (10,000 concurrent calls)]');
  console.log(`  Total Calls     : ${BURST_N.toLocaleString()}`);
  console.log(`  Total Time      : ${burstTotalMs.toFixed(2)} ms`);
  console.log(`  Throughput      : ${Number(opsPerSec).toLocaleString()} calls/sec`);
  console.log(`  Resolved Calls  : ${burstResults.length.toLocaleString()} (100%)`);
  console.log(`  Pending Left    : ${burstEnv.worker.pendingCalls.size}`);
  console.log(`  Host Actions    : ${burstEnv.host.dispatchedActions.length.toLocaleString()}`);
  burstEnv.destroy();

  // 4. Memory & Timeout Churn
  if (typeof global.gc === 'function') {
    global.gc();
    global.gc();
  }
  const initHeap = process.memoryUsage().heapUsed;
  const rpcTable = new RpcPromiseTable(10);
  const CHURN_TOTAL = 20000;
  const CHURN_BATCH = 5000;
  for (let b = 0; b < 4; b++) {
    const promises: Promise<any>[] = [];
    for (let i = 0; i < CHURN_BATCH; i++) {
      const callId = `churn_${b}_${i}`;
      promises.push(
        new Promise((resolve, reject) => {
          rpcTable.register(callId, 'action.churn', resolve, reject, 10);
          if (i % 2 === 0) {
            rpcTable.resolve(callId, { ok: true });
          }
        }).catch(() => {})
      );
    }
    await new Promise((r) => setTimeout(r, 25));
    await Promise.all(promises);
  }
  if (typeof global.gc === 'function') {
    global.gc();
    global.gc();
  }
  const finalHeap = process.memoryUsage().heapUsed;
  const heapDiffMb = (finalHeap - initHeap) / (1024 * 1024);

  console.log('\n[4. Timeout & Memory Leak Verification (20,000 churn cycles)]');
  console.log(`  Total Cycles    : ${CHURN_TOTAL.toLocaleString()}`);
  console.log(`  Pending Count   : ${rpcTable.pendingCount}`);
  console.log(`  Heap Delta      : ${heapDiffMb.toFixed(2)} MB`);
  console.log(`  Memory Clean    : ${rpcTable.pendingCount === 0 && heapDiffMb < 25 ? 'YES' : 'NO'}`);
}

main().catch(console.error);
