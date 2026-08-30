import { describe, it } from 'node:test';
import assert from 'node:assert';
import { runBenchmark } from './benchmark.js';

describe('IPC Warm-Path Round-Trip Latency (<5.0ms Quality Gate)', () => {
  it('measures 5,000 round-trip IPC frames and validates p99 < 5.0ms', async () => {
    const results = await runBenchmark(5000);
    assert.ok(results.p99 < 5.0, `p99 latency (${results.p99.toFixed(4)}ms) must be < 5.0ms`);
    assert.ok(results.avg < 2.0, `Average latency (${results.avg.toFixed(4)}ms) must be < 2.0ms`);
  });
});
