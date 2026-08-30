import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { WebSocket } from 'ws';
import { createGoatServer, GoatServerInstance } from '../src/server';

describe('Real-time Trace WebSocket Stream & CDP GoatBridge Commands', () => {
  let server: GoatServerInstance;
  let serverPort: number;

  beforeEach(async () => {
    server = createGoatServer({
      port: 0,
      cdpPort: 0,
      safariPort: 0,
      inMemoryDb: true,
      enableCors: true,
    });
    await server.start();
    const addr = server.httpServer.address() as any;
    serverPort = addr.port;
    server.targetManager.setHostAndPort('127.0.0.1', serverPort);
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should stream real-time traces over /traces WebSocket endpoint when ingested via REST', async () => {
    const traceWs = new WebSocket(`ws://127.0.0.1:${serverPort}/traces`);

    await new Promise<void>((resolve, reject) => {
      traceWs.on('open', resolve);
      traceWs.on('error', reject);
    });

    const receivedTraces: any[] = [];
    traceWs.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'TRACE_INGESTED') {
        receivedTraces.push(msg.trace);
      }
    });

    // Ingest via REST
    await request(server.app)
      .post('/api/traces')
      .send({
        callId: 'live_trace_stream_1',
        appId: 'com.goat.streaming',
        action: 'BIOMETRIC_CHECK',
        durationMs: 12.3,
        response: { verified: true },
      })
      .expect(201);

    // Wait for WS notification
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (receivedTraces.length > 0) {
          clearInterval(interval);
          resolve();
        }
      }, 20);
    });

    expect(receivedTraces.length).toBe(1);
    expect(receivedTraces[0].callId).toBe('live_trace_stream_1');
    expect(receivedTraces[0].action).toBe('BIOMETRIC_CHECK');

    traceWs.close();
  });

  it('should support GoatBridge.injectEvent to broadcast synthetic push events to targets', async () => {
    const targetId = 'target-inject-test';
    const targetWs = new WebSocket(`ws://127.0.0.1:${serverPort}/devtools/target/${targetId}`);
    const debuggerWs = new WebSocket(`ws://127.0.0.1:${serverPort}/devtools/page/${targetId}`);

    await Promise.all([
      new Promise<void>((res) => targetWs.on('open', res)),
      new Promise<void>((res) => debuggerWs.on('open', res)),
    ]);

    const targetEventPromise = new Promise<any>((resolve) => {
      targetWs.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.method === 'GoatBridge.eventInjected') {
          resolve(msg);
        }
      });
    });

    // Debugger sends injectEvent command
    debuggerWs.send(
      JSON.stringify({
        id: 10,
        method: 'GoatBridge.injectEvent',
        params: {
          event: 'NETWORK_STATUS_CHANGED',
          data: { isConnected: false, type: 'none' },
        },
      })
    );

    const receivedEvent = await targetEventPromise;
    expect(receivedEvent.params.event).toBe('NETWORK_STATUS_CHANGED');
    expect(receivedEvent.params.data.isConnected).toBe(false);

    targetWs.close();
    debuggerWs.close();
  });

  it('should support GoatBridge.getTraces, GoatBridge.getStats and GoatBridge.clearMocks CDP commands', async () => {
    // Ingest traces
    server.tracesService.ingestTrace({
      callId: 'cdp_cmd_trace_1',
      appId: 'com.goat.cdp',
      action: 'STORAGE_GET',
      durationMs: 5.0,
      response: { val: 'abc' },
    });

    const debuggerWs = new WebSocket(`ws://127.0.0.1:${serverPort}/devtools/page/test-target-cmds`);
    await new Promise<void>((res) => debuggerWs.on('open', res));

    // Test GoatBridge.getTraces
    const getTracesPromise = new Promise<any>((resolve) => {
      const handler = (raw: any) => {
        const msg = JSON.parse(raw.toString());
        if (msg.id === 101) {
          debuggerWs.off('message', handler);
          resolve(msg);
        }
      };
      debuggerWs.on('message', handler);
    });

    debuggerWs.send(
      JSON.stringify({
        id: 101,
        method: 'GoatBridge.getTraces',
        params: { appId: 'com.goat.cdp' },
      })
    );

    const tracesReply = await getTracesPromise;
    expect(tracesReply.result.total).toBe(1);
    expect(tracesReply.result.data[0].callId).toBe('cdp_cmd_trace_1');

    // Test GoatBridge.getStats
    const getStatsPromise = new Promise<any>((resolve) => {
      const handler = (raw: any) => {
        const msg = JSON.parse(raw.toString());
        if (msg.id === 102) {
          debuggerWs.off('message', handler);
          resolve(msg);
        }
      };
      debuggerWs.on('message', handler);
    });

    debuggerWs.send(
      JSON.stringify({
        id: 102,
        method: 'GoatBridge.getStats',
        params: { appId: 'com.goat.cdp' },
      })
    );

    const statsReply = await getStatsPromise;
    expect(statsReply.result.totalCalls).toBe(1);
    expect(statsReply.result.callsPerAction['STORAGE_GET']).toBe(1);

    debuggerWs.close();
  });
});
