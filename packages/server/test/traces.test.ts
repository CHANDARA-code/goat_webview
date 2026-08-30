import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createGoatServer, GoatServerInstance } from '../src/server';

describe('Bridge IPC Trace Persistence & Telemetry API', () => {
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

  it('should ingest single trace via POST /api/traces and query it', async () => {
    const tracePayload = {
      callId: 'call_test_001',
      appId: 'com.goat.wallet',
      action: 'BIOMETRIC_AUTH',
      direction: 'REQ',
      params: { prompt: 'Authenticate with FaceID', allowDeviceCredential: true },
      response: { authenticated: true, biometryType: 'face' },
      durationMs: 14.5,
      timestamp: Date.now(),
      thread: 'main',
    };

    const postRes = await request(server.app)
      .post('/api/traces')
      .send(tracePayload)
      .expect(201);

    expect(postRes.body.ingested).toBe(1);
    expect(postRes.body.trace.callId).toBe('call_test_001');
    expect(postRes.body.trace.status).toBe('SUCCESS');
    expect(postRes.body.trace.params.prompt).toBe('Authenticate with FaceID');

    // Query single trace by callId
    const getSingle = await request(server.app)
      .get('/api/traces/call_test_001')
      .expect(200);

    expect(getSingle.body.callId).toBe('call_test_001');
    expect(getSingle.body.action).toBe('BIOMETRIC_AUTH');
    expect(getSingle.body.response.authenticated).toBe(true);
  });

  it('should ingest batch of traces via POST /api/traces', async () => {
    const batch = [
      {
        callId: 'call_batch_1',
        appId: 'com.goat.test',
        action: 'STORAGE_GET',
        params: { key: 'user_id' },
        response: { value: '12345' },
        durationMs: 2.1,
        timestamp: Date.now() - 5000,
      },
      {
        callId: 'call_batch_2',
        appId: 'com.goat.test',
        action: 'API_REQUEST',
        params: { url: 'https://api.example.com/users' },
        error: { code: 'NETWORK_TIMEOUT', message: 'Connection timed out' },
        durationMs: 150.0,
        timestamp: Date.now() - 1000,
      },
    ];

    const postRes = await request(server.app)
      .post('/api/traces')
      .send({ traces: batch })
      .expect(201);

    expect(postRes.body.ingested).toBe(2);

    // Query list
    const listRes = await request(server.app)
      .get('/api/traces?appId=com.goat.test')
      .expect(200);

    expect(listRes.body.total).toBe(2);
    expect(listRes.body.data.length).toBe(2);
  });

  it('should filter traces by action, hasError, minDuration, and search', async () => {
    // Ingest sample data
    await request(server.app)
      .post('/api/traces')
      .send({
        traces: [
          { callId: 't1', appId: 'appA', action: 'SCAN_CODE', durationMs: 80, response: { data: 'https://goat.dev' } },
          { callId: 't2', appId: 'appA', action: 'SCAN_CODE', durationMs: 15, response: { data: '123' } },
          { callId: 't3', appId: 'appB', action: 'PAYMENT', durationMs: 250, error: { message: 'Card declined' } },
        ],
      });

    // Filter by action
    const actionRes = await request(server.app).get('/api/traces?action=SCAN_CODE').expect(200);
    expect(actionRes.body.total).toBe(2);

    // Filter by minDuration
    const durationRes = await request(server.app).get('/api/traces?minDuration=50').expect(200);
    expect(durationRes.body.total).toBe(2); // t1 (80) and t3 (250)

    // Filter by hasError
    const errorRes = await request(server.app).get('/api/traces?hasError=true').expect(200);
    expect(errorRes.body.total).toBe(1);
    expect(errorRes.body.data[0].callId).toBe('t3');

    // Search keyword
    const searchRes = await request(server.app).get('/api/traces?search=declined').expect(200);
    expect(searchRes.body.total).toBe(1);
    expect(searchRes.body.data[0].callId).toBe('t3');
  });

  it('should calculate aggregate statistics (p50, p95, p99, error rate, top slow actions)', async () => {
    const items = [
      { callId: 's1', appId: 'statsApp', action: 'FAST_ACTION', durationMs: 10, response: {} },
      { callId: 's2', appId: 'statsApp', action: 'FAST_ACTION', durationMs: 20, response: {} },
      { callId: 's3', appId: 'statsApp', action: 'FAST_ACTION', durationMs: 30, response: {} },
      { callId: 's4', appId: 'statsApp', action: 'SLOW_ACTION', durationMs: 100, response: {} },
      { callId: 's5', appId: 'statsApp', action: 'FAIL_ACTION', durationMs: 200, error: { message: 'failed' } },
    ];

    await request(server.app).post('/api/traces').send({ traces: items });

    const statsRes = await request(server.app)
      .get('/api/traces/stats?appId=statsApp')
      .expect(200);

    const stats = statsRes.body;
    expect(stats.totalCalls).toBe(5);
    expect(stats.errorCount).toBe(1);
    expect(stats.errorRate).toBe(20);
    expect(stats.avgLatencyMs).toBe(72);
    expect(stats.p50LatencyMs).toBe(30);
    expect(stats.p90LatencyMs).toBe(200);
    expect(stats.callsPerAction['FAST_ACTION']).toBe(3);
    expect(stats.callsPerAction['SLOW_ACTION']).toBe(1);
    expect(stats.topSlowActions[0].action).toBe('FAIL_ACTION');
    expect(stats.topSlowActions[1].action).toBe('SLOW_ACTION');
  });

  it('should manage dynamic mock rules via /api/mocks', async () => {
    // Create mock rule
    const createRes = await request(server.app)
      .post('/api/mocks')
      .send({
        action: 'FETCH_BALANCE',
        response: { currency: 'USD', balance: 9999.50 },
        delayMs: 10,
        enabled: true,
      })
      .expect(201);

    expect(createRes.body.action).toBe('FETCH_BALANCE');
    expect(createRes.body.response.balance).toBe(9999.50);

    // List mock rules
    const listRes = await request(server.app).get('/api/mocks').expect(200);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].action).toBe('FETCH_BALANCE');

    // Test matchMock service
    const matched = server.tracesService.matchMock('FETCH_BALANCE');
    expect(matched).not.toBeNull();
    expect(matched?.response.balance).toBe(9999.50);

    // Delete mock rule
    const delRes = await request(server.app).delete('/api/mocks/FETCH_BALANCE').expect(200);
    expect(delRes.body.success).toBe(true);

    const afterDel = await request(server.app).get('/api/mocks').expect(200);
    expect(afterDel.body.length).toBe(0);
  });

  it('should delete traces based on criteria', async () => {
    await request(server.app)
      .post('/api/traces')
      .send({
        traces: [
          { callId: 'd1', appId: 'delApp1', action: 'ACT1' },
          { callId: 'd2', appId: 'delApp2', action: 'ACT2' },
        ],
      });

    const delRes = await request(server.app).delete('/api/traces?appId=delApp1').expect(200);
    expect(delRes.body.deleted).toBe(1);

    const listRes = await request(server.app).get('/api/traces').expect(200);
    expect(listRes.body.total).toBe(1);
    expect(listRes.body.data[0].appId).toBe('delApp2');
  });
});
