import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { WebSocket } from 'ws';
import { createGoatServer, GoatServerInstance } from '../src/server';

describe('CDP Remote Debugging Relay & Discovery (Port 9222)', () => {
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

  it('should return valid /json/version discovery schema', async () => {
    const res = await request(server.app).get('/json/version').expect(200);

    expect(res.body).toHaveProperty('Browser');
    expect(res.body['Protocol-Version']).toBe('1.3');
    expect(res.body).toHaveProperty('User-Agent');
    expect(res.body).toHaveProperty('V8-Version');
    expect(res.body).toHaveProperty('WebKit-Version');
    expect(res.body).toHaveProperty('webSocketDebuggerUrl');
  });

  it('should list inspectable targets via /json/list and /json', async () => {
    const resList = await request(server.app).get('/json/list').expect(200);
    expect(Array.isArray(resList.body)).toBe(true);
    expect(resList.body.length).toBeGreaterThan(0);
    expect(resList.body[0]).toHaveProperty('id');
    expect(resList.body[0]).toHaveProperty('webSocketDebuggerUrl');
    expect(resList.body[0].type).toBe('page');

    const resJson = await request(server.app).get('/json').expect(200);
    expect(resJson.body.length).toBe(resList.body.length);
  });

  it('should create new target via /json/new and activate/close it', async () => {
    const newRes = await request(server.app)
      .get('/json/new?url=https://goat.dev/demo&title=DemoApp')
      .expect(201);

    const targetId = newRes.body.id;
    expect(newRes.body.url).toBe('https://goat.dev/demo');
    expect(newRes.body.title).toBe('DemoApp');

    // Activate
    const activateRes = await request(server.app).get(`/json/activate/${targetId}`).expect(200);
    expect(activateRes.text).toBe('Target activated');

    // Close
    const closeRes = await request(server.app).get(`/json/close/${targetId}`).expect(200);
    expect(closeRes.text).toBe('Target is closing');

    // Confirm closed
    const afterClose = await request(server.app).get(`/json/activate/${targetId}`).expect(404);
    expect(afterClose.text).toBe('No such target');
  });

  it('should handle CDP WebSocket debugger commands and GoatBridge domain', async () => {
    const wsUrl = `ws://127.0.0.1:${serverPort}/devtools/page/test-target-cdp`;
    const ws = new WebSocket(wsUrl);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    // Send Runtime.enable
    const runtimeEnablePromise = new Promise<any>((resolve) => {
      const handler = (data: any) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === 1) {
          ws.off('message', handler);
          resolve(msg);
        }
      };
      ws.on('message', handler);
    });

    ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable', params: {} }));
    const reply = await runtimeEnablePromise;
    expect(reply.id).toBe(1);
    expect(reply.result).toBeDefined();

    // Send GoatBridge.setMockResponse command
    const mockPromise = new Promise<any>((resolve) => {
      const handler = (data: any) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === 2) {
          ws.off('message', handler);
          resolve(msg);
        }
      };
      ws.on('message', handler);
    });

    ws.send(
      JSON.stringify({
        id: 2,
        method: 'GoatBridge.setMockResponse',
        params: {
          action: 'GET_LOCATION',
          mockResult: { latitude: 37.7749, longitude: -122.4194 },
          delayMs: 5,
        },
      })
    );

    const mockReply = await mockPromise;
    expect(mockReply.id).toBe(2);
    expect(mockReply.result.success).toBe(true);

    // Verify mock was saved in TracesService
    const matched = server.tracesService.matchMock('GET_LOCATION');
    expect(matched?.response.latitude).toBe(37.7749);

    ws.close();
  });

  it('should relay GoatBridge events from target to debugger and handle mock replies', async () => {
    const targetId = 'relay-test-target';
    const debuggerWs = new WebSocket(`ws://127.0.0.1:${serverPort}/devtools/page/${targetId}`);
    const targetWs = new WebSocket(`ws://127.0.0.1:${serverPort}/devtools/target/${targetId}`);

    await Promise.all([
      new Promise<void>((res) => debuggerWs.on('open', res)),
      new Promise<void>((res) => targetWs.on('open', res)),
    ]);

    // Set mock response
    server.tracesService.setMock({
      action: 'SCAN_BARCODE',
      response: { code: 'BAR_98765' },
      delayMs: 5,
    });

    // Listen on target for mockReply
    const mockReplyPromise = new Promise<any>((resolve) => {
      targetWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.method === 'GoatBridge.mockReply') {
          resolve(msg);
        }
      });
    });

    // Target emits GoatBridge.messageSent
    targetWs.send(
      JSON.stringify({
        method: 'GoatBridge.messageSent',
        params: {
          callId: 'call_scan_1',
          action: 'SCAN_BARCODE',
          params: {},
          timestamp: Date.now(),
        },
      })
    );

    const mockReplyMsg = await mockReplyPromise;
    expect(mockReplyMsg.params.action).toBe('SCAN_BARCODE');
    expect(mockReplyMsg.params.result.code).toBe('BAR_98765');

    debuggerWs.close();
    targetWs.close();
  });

  it('should safely handle malformed WebSocket frames and invalid framing without server crash', async () => {
    const net = await import('net');

    // Send malformed WebSocket frames (RSV bits set: 0b11000000 = 0xc0) over raw TCP connection
    await new Promise<void>((resolve) => {
      const client = net.createConnection({ port: serverPort, host: '127.0.0.1' }, () => {
        client.write(
          'GET /devtools/page/fuzz-malformed HTTP/1.1\r\n' +
          'Host: 127.0.0.1\r\n' +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n' +
          'Sec-WebSocket-Version: 13\r\n\r\n'
        );

        setTimeout(() => {
          // Send invalid frame with RSV2 and RSV3 bits set (\xC0)
          client.write(Buffer.from([0xC0, 0x04, 0xDE, 0xAD, 0xBE, 0xEF]));
          setTimeout(() => {
            client.destroy();
            resolve();
          }, 50);
        }, 50);
      });
      client.on('error', () => resolve());
    });

    // Also test raw malformed frames on /tunnel/
    await new Promise<void>((resolve) => {
      const client = net.createConnection({ port: serverPort, host: '127.0.0.1' }, () => {
        client.write(
          'GET /tunnel/fuzz-tunnel HTTP/1.1\r\n' +
          'Host: 127.0.0.1\r\n' +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n' +
          'Sec-WebSocket-Version: 13\r\n\r\n'
        );

        setTimeout(() => {
          client.write(Buffer.from([0xC0, 0xFF, 0xAA, 0xBB, 0xCC, 0xDD]));
          setTimeout(() => {
            client.destroy();
            resolve();
          }, 50);
        }, 50);
      });
      client.on('error', () => resolve());
    });

    // Verify server remains fully functional
    const healthRes = await request(server.app).get('/api/health').expect(200);
    expect(healthRes.body.status).toBe('ok');

    // Verify valid WebSocket connection still functions normally
    const normalWs = new WebSocket(`ws://127.0.0.1:${serverPort}/devtools/page/healthy-target`);
    await new Promise<void>((res, rej) => {
      normalWs.on('open', res);
      normalWs.on('error', rej);
    });
    normalWs.close();
  });
});
