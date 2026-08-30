import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createGoatServer, GoatServerInstance } from '../src/server';

describe('Database Schema, Indices & Edge Cases', () => {
  let server: GoatServerInstance;

  beforeEach(async () => {
    server = createGoatServer({
      port: 0,
      cdpPort: 0,
      safariPort: 0,
      inMemoryDb: true,
      enableCors: true,
    });
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should create required SQLite tables and indices on boot', () => {
    const sqlite = server.dbService.getRawSqlite();
    
    // Check tables
    const tables = sqlite
      .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
      .all()
      .map((t: any) => t.name);

    expect(tables).toContain('traces');
    expect(tables).toContain('sessions');
    expect(tables).toContain('mock_rules');

    // Check indices on traces
    const indices = sqlite
      .prepare(`SELECT name FROM sqlite_master WHERE type='index'`)
      .all()
      .map((i: any) => i.name);

    expect(indices).toContain('idx_traces_app_timestamp');
    expect(indices).toContain('idx_traces_action');
    expect(indices).toContain('idx_traces_call_id');
    expect(indices).toContain('idx_traces_created_at');
    expect(indices).toContain('idx_traces_status');
    expect(indices).toContain('idx_sessions_app_id');
    expect(indices).toContain('idx_mock_rules_app_action');
  });

  it('should handle mock rule priority (app-specific overrides wildcard)', async () => {
    // Wildcard mock rule for GET_USER
    server.tracesService.setMock({
      appId: '*',
      action: 'GET_USER',
      response: { role: 'guest' },
    });

    // App-specific mock rule for GET_USER
    server.tracesService.setMock({
      appId: 'com.goat.admin',
      action: 'GET_USER',
      response: { role: 'superadmin' },
    });

    // Other app matches wildcard
    const guestMatch = server.tracesService.matchMock('GET_USER', 'com.goat.shop');
    expect(guestMatch?.response.role).toBe('guest');

    // com.goat.admin matches app-specific rule
    const adminMatch = server.tracesService.matchMock('GET_USER', 'com.goat.admin');
    expect(adminMatch?.response.role).toBe('superadmin');
  });

  it('should handle empty stats gracefully without division by zero', async () => {
    const emptyStats = server.tracesService.getStats({ appId: 'non_existent' });
    expect(emptyStats.totalCalls).toBe(0);
    expect(emptyStats.errorCount).toBe(0);
    expect(emptyStats.errorRate).toBe(0);
    expect(emptyStats.avgLatencyMs).toBe(0);
    expect(emptyStats.p50LatencyMs).toBe(0);
    expect(emptyStats.p99LatencyMs).toBe(0);
    expect(emptyStats.topSlowActions).toEqual([]);
  });

  it('should handle large batches of 100 traces and calculate accurate percentiles', async () => {
    const batch = [];
    for (let i = 1; i <= 100; i++) {
      batch.push({
        callId: `batch_call_${i}`,
        appId: 'com.goat.perf',
        action: i % 2 === 0 ? 'ACTION_EVEN' : 'ACTION_ODD',
        durationMs: i * 2, // 2ms to 200ms
        status: (i === 50 || i === 100) ? ('ERROR' as const) : ('SUCCESS' as const),
        timestamp: Date.now() - (100 - i) * 1000,
      });
    }

    server.tracesService.ingestTraces(batch);

    const stats = server.tracesService.getStats({ appId: 'com.goat.perf' });
    expect(stats.totalCalls).toBe(100);
    expect(stats.errorCount).toBe(2);
    expect(stats.errorRate).toBe(2);
    expect(stats.p50LatencyMs).toBe(102); // 51st element (index 50) -> 51 * 2 = 102ms
    expect(stats.p90LatencyMs).toBe(182); // 91st element (index 90) -> 91 * 2 = 182ms
    expect(stats.p99LatencyMs).toBe(200); // 100th element -> 200ms
    expect(stats.callsPerAction['ACTION_EVEN']).toBe(50);
    expect(stats.callsPerAction['ACTION_ODD']).toBe(50);
  });
});
