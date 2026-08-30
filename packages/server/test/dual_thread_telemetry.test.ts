import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createGoatServer, GoatServerInstance } from '../src/server';

describe('Dual-Thread Telemetry Fields & Multi-Lane Filtering', () => {
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

  it('ingests and queries dual-thread telemetry fields (threadLane, seqId, batchId, waterfall latencies)', async () => {
    const dualThreadTrace = {
      callId: 'call_dual_001',
      appId: 'com.goat.miniapp',
      action: 'HAPTIC_FEEDBACK',
      direction: 'REQ',
      threadLane: 'appservice_to_appview',
      seqId: 42,
      batchId: 'batch_999',
      workerIpcLatencyMs: 0.8,
      nativeExecutionLatencyMs: 2.5,
      domRenderLatencyMs: 0.5,
      parentCallId: 'parent_call_000',
      params: { style: 'heavy' },
      response: { success: true },
      durationMs: 3.8,
      timestamp: Date.now(),
    };

    const postRes = await request(server.httpServer)
      .post('/api/traces')
      .send(dualThreadTrace)
      .expect(201);

    expect(postRes.body.ingested).toBe(1);
    expect(postRes.body.trace.threadLane).toBe('appservice_to_appview');
    expect(postRes.body.trace.seqId).toBe(42);
    expect(postRes.body.trace.batchId).toBe('batch_999');
    expect(postRes.body.trace.workerIpcLatencyMs).toBe(0.8);
    expect(postRes.body.trace.nativeExecutionLatencyMs).toBe(2.5);
    expect(postRes.body.trace.domRenderLatencyMs).toBe(0.5);
    expect(postRes.body.trace.parentCallId).toBe('parent_call_000');

    // Query by ID
    const getRes = await request(server.httpServer)
      .get('/api/traces/call_dual_001')
      .expect(200);

    expect(getRes.body.threadLane).toBe('appservice_to_appview');
    expect(getRes.body.seqId).toBe(42);
    expect(getRes.body.batchId).toBe('batch_999');
    expect(getRes.body.workerIpcLatencyMs).toBe(0.8);
  });

  it('filters traces by threadLane and batchId', async () => {
    const traces = [
      {
        callId: 't_lane_1',
        appId: 'test_app',
        action: 'STORAGE_SET',
        threadLane: 'appservice_to_appview',
        batchId: 'b1',
        seqId: 1,
      },
      {
        callId: 't_lane_2',
        appId: 'test_app',
        action: 'NATIVE_DISPATCH',
        threadLane: 'appview_to_native',
        batchId: 'b1',
        seqId: 2,
      },
      {
        callId: 't_lane_3',
        appId: 'test_app',
        action: 'NATIVE_REPLY',
        threadLane: 'native_to_appview',
        batchId: 'b2',
        seqId: 3,
      },
    ];

    await request(server.httpServer)
      .post('/api/traces')
      .send({ traces })
      .expect(201);

    // Filter by threadLane
    const lane1Res = await request(server.httpServer)
      .get('/api/traces?threadLane=appservice_to_appview')
      .expect(200);
    expect(lane1Res.body.total).toBe(1);
    expect(lane1Res.body.data[0].callId).toBe('t_lane_1');

    const lane2Res = await request(server.httpServer)
      .get('/api/traces?threadLane=appview_to_native')
      .expect(200);
    expect(lane2Res.body.total).toBe(1);
    expect(lane2Res.body.data[0].callId).toBe('t_lane_2');

    // Filter by batchId
    const batchRes = await request(server.httpServer)
      .get('/api/traces?batchId=b1')
      .expect(200);
    expect(batchRes.body.total).toBe(2);
  });
});
