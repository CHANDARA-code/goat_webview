import { describe, it } from 'node:test';
import assert from 'node:assert';
import { IpcChannel } from '../src/ipc/channel.js';
import { InMemoryMessagePortPair } from '../src/simulation/in-memory-worker.js';

export async function runBenchmark(iterations: number = 10000): Promise<{
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}> {
  const pair = new InMemoryMessagePortPair();
  const appServiceChannel = new IpcChannel('appservice', pair.port1);
  const appViewChannel = new IpcChannel('appview', pair.port2);

  // AppView echoes ping back to pong
  appViewChannel.onMessage((frame) => {
    if (frame.type === 'HEARTBEAT_PING') {
      appViewChannel.send('HEARTBEAT_PONG', { originalTimestamp: frame.timestamp, seq: frame.seq });
    }
  });

  const latencies: number[] = [];

  // Warm-up phase (500 iterations)
  for (let i = 0; i < 500; i++) {
    await new Promise<void>((resolve) => {
      const unsubscribe = appServiceChannel.onMessage((frame) => {
        if (frame.type === 'HEARTBEAT_PONG') {
          unsubscribe();
          resolve();
        }
      });
      appServiceChannel.send('HEARTBEAT_PING', { index: i });
    });
  }

  // Benchmark phase
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const unsubscribe = appServiceChannel.onMessage((frame) => {
        if (frame.type === 'HEARTBEAT_PONG') {
          unsubscribe();
          const duration = performance.now() - start;
          latencies.push(duration);
          resolve();
        }
      });
      appServiceChannel.send('HEARTBEAT_PING', { index: i });
    });
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(iterations * 0.50)];
  const p95 = latencies[Math.floor(iterations * 0.95)];
  const p99 = latencies[Math.floor(iterations * 0.99)];
  const avg = latencies.reduce((a, b) => a + b, 0) / iterations;

  console.log(`\n===============================================================`);
  console.log(`📊 [Goat WebView Dual-Thread IPC] Round-Trip Latency Benchmark`);
  console.log(`===============================================================`);
  console.log(`  Iterations : ${iterations.toLocaleString()}`);
  console.log(`  Average    : ${avg.toFixed(4)} ms`);
  console.log(`  p50        : ${p50.toFixed(4)} ms`);
  console.log(`  p95        : ${p95.toFixed(4)} ms`);
  console.log(`  p99        : ${p99.toFixed(4)} ms`);
  console.log(`  Gate Check : ${p99 < 5.0 ? '✅ PASSED (<5.0ms)' : '❌ FAILED (>=5.0ms)'}`);
  console.log(`===============================================================\n`);

  assert.ok(p99 < 5.0, `p99 latency (${p99}ms) must be < 5.0ms`);
  assert.ok(avg < 2.0, `Average latency (${avg}ms) must be < 2.0ms`);

  return { avg, p50, p95, p99 };
}

// Standalone execution if run directly
if (process.argv[1]?.endsWith('benchmark.js') || process.argv[1]?.endsWith('benchmark.ts')) {
  runBenchmark(10000)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Benchmark failed:', err);
      process.exit(1);
    });
}
