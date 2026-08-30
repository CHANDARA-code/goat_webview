import { DatabaseService } from '../src/database/database.service';
import { TracesService } from '../src/traces/traces.service';
import * as fs from 'fs';
import * as path from 'path';

async function runTraceStressTest() {
  console.log('=== RUNNING DEEP DIVE 1: HIGH CONCURRENCY TRACE INGESTION & STATS ACCURACY ===');
  const testDbPath = path.resolve('./data/stress_test_disk.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  const dbService = new DatabaseService({ dbPath: testDbPath });
  const tracesService = new TracesService(dbService);

  const TOTAL_TRACES = 5000;
  console.log(`Ingesting ${TOTAL_TRACES} traces concurrently...`);

  const t0 = Date.now();
  const promises: Promise<any>[] = [];

  // Ingest in chunks of 50 concurrent promises
  const batchSize = 100;
  for (let b = 0; b < TOTAL_TRACES; b += batchSize) {
    const chunk: any[] = [];
    for (let i = 0; i < batchSize; i++) {
      const idx = b + i;
      chunk.push({
        callId: `call_disk_${idx}`,
        appId: 'com.goat.stress.disk',
        action: `ACTION_${idx % 10}`,
        durationMs: (idx % 500) + 0.5,
        status: idx % 20 === 0 ? 'ERROR' : 'SUCCESS',
        timestamp: Date.now() - (TOTAL_TRACES - idx) * 10,
      });
    }
    promises.push(Promise.resolve().then(() => tracesService.ingestTraces(chunk)));
  }

  await Promise.all(promises);
  const ingestionTime = Date.now() - t0;
  console.log(`Successfully ingested ${TOTAL_TRACES} traces in ${ingestionTime}ms (${((TOTAL_TRACES / ingestionTime) * 1000).toFixed(0)} traces/sec)`);

  // Verify SQLite row count
  const rawSqlite = dbService.getRawSqlite();
  const rowCount = rawSqlite.prepare('SELECT COUNT(*) as cnt FROM traces WHERE app_id = ?').get('com.goat.stress.disk') as any;
  console.log(`SQLite verified row count: ${rowCount.cnt} (Expected: ${TOTAL_TRACES})`);
  if (rowCount.cnt !== TOTAL_TRACES) {
    throw new Error(`Data loss detected! Row count mismatch: ${rowCount.cnt} vs ${TOTAL_TRACES}`);
  }

  // Verify percentiles computation
  const stats = tracesService.getStats({ appId: 'com.goat.stress.disk' });
  console.log('Stats Result:', {
    totalCalls: stats.totalCalls,
    errorCount: stats.errorCount,
    errorRate: `${stats.errorRate}%`,
    avgLatencyMs: stats.avgLatencyMs,
    p50LatencyMs: stats.p50LatencyMs,
    p90LatencyMs: stats.p90LatencyMs,
    p95LatencyMs: stats.p95LatencyMs,
    p99LatencyMs: stats.p99LatencyMs,
    topSlowActionsCount: stats.topSlowActions.length,
  });

  if (stats.totalCalls !== TOTAL_TRACES) throw new Error('Stats totalCalls mismatch');
  if (stats.errorCount !== TOTAL_TRACES / 20) throw new Error('Stats errorCount mismatch');
  if (stats.p50LatencyMs <= 0 || stats.p99LatencyMs <= stats.p50LatencyMs) {
    throw new Error('Percentiles invalid');
  }

  // Cleanup
  dbService.close();
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  const walPath = `${testDbPath}-wal`;
  const shmPath = `${testDbPath}-shm`;
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

  console.log('=== DEEP DIVE 1 COMPLETED SUCCESSFULLY ===\n');
}

runTraceStressTest().catch((err) => {
  console.error('Deep dive 1 failed:', err);
  process.exit(1);
});
