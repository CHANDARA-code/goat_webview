import { createGoatServer } from '../src/server';
import { WebSocket } from 'ws';
import * as net from 'net';

async function runCDPStressTest() {
  console.log('=== RUNNING DEEP DIVE 2: CDP JSON-RPC & WEBSOCKET PROTOCOL RESILIENCE ===');
  const server = createGoatServer({
    port: 0,
    cdpPort: 0,
    safariPort: 0,
    inMemoryDb: true,
  });
  await server.start();
  const addr = server.httpServer.address() as any;
  const serverPort = addr.port;
  server.targetManager.setHostAndPort('127.0.0.1', serverPort);

  // 1. Test binary/garbage/malformed JSON-RPC frames
  console.log('Testing malformed frames...');
  const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/devtools/page/stress-fuzz-target`);
  await new Promise<void>((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  const malformedInputs = [
    'INVALID_NOT_JSON',
    '{"id": 1, "method": "Page.enable"', // unclosed
    'null',
    '12345',
    'true',
    '["an", "array"]',
    '{"noMethodOrId": true}',
    Buffer.from([0x00, 0xff, 0xfe, 0x12, 0x34]),
  ];

  for (const input of malformedInputs) {
    const errorPromise = new Promise<any>((resolve) => {
      const handler = (data: any) => {
        try {
          const parsed = JSON.parse(data.toString());
          ws.off('message', handler);
          resolve(parsed);
        } catch {
          // ignore
        }
      };
      ws.on('message', handler);
    });

    ws.send(input);
    const reply = await Promise.race([
      errorPromise,
      new Promise((res) => setTimeout(() => res('TIMEOUT_OR_IGNORED'), 100)),
    ]);

    // Either standard JSON-RPC parse error or graceful response without crashing server
    console.log(`Payload: ${typeof input === 'string' ? input.slice(0, 20) : 'Buffer'} -> Response:`, reply);
  }

  ws.close();

  // 2. High-concurrency WebSocket connection flood and abrupt socket destroy
  console.log('Testing 100 concurrent WebSocket connections with abrupt termination...');
  const sockets: WebSocket[] = [];
  for (let i = 0; i < 100; i++) {
    const s = new WebSocket(`ws://127.0.0.1:${serverPort}/devtools/page/flood-target-${i % 5}`);
    sockets.push(s);
  }

  await new Promise((res) => setTimeout(res, 100));

  // Flood messages across all sockets
  for (const s of sockets) {
    if (s.readyState === WebSocket.OPEN) {
      s.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
      s.send(JSON.stringify({ id: 2, method: 'Page.enable' }));
      s.send(JSON.stringify({ id: 3, method: 'UnknownDomain.method' }));
    }
  }

  await new Promise((res) => setTimeout(res, 50));

  // Forcefully terminate all sockets
  for (const s of sockets) {
    s.terminate();
  }

  await new Promise((res) => setTimeout(res, 100));

  // 3. Raw TCP socket flood with garbage HTTP upgrades
  console.log('Testing raw TCP socket upgrade fuzzing...');
  for (let i = 0; i < 20; i++) {
    const client = net.createConnection({ port: serverPort, host: '127.0.0.1' }, () => {
      client.write('GET /devtools/page/raw-tcp HTTP/1.1\r\nHost: 127.0.0.1\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n');
      client.write('RAW GARBAGE FRAME DATA \x00\xFF\xAA\xBB');
      setTimeout(() => client.destroy(), 20);
    });
  }

  await new Promise((res) => setTimeout(res, 100));

  // 4. Verify server is completely stable
  const checkWs = new WebSocket(`ws://127.0.0.1:${serverPort}/devtools/page/health-check`);
  await new Promise<void>((resolve, reject) => {
    checkWs.on('open', resolve);
    checkWs.on('error', reject);
  });

  const healthReply = new Promise<any>((resolve) => {
    checkWs.once('message', (data) => resolve(JSON.parse(data.toString())));
  });
  checkWs.send(JSON.stringify({ id: 999, method: 'Runtime.enable' }));
  const rep = await healthReply;
  console.log('Post-flood health check reply:', rep);
  if (rep.id !== 999) throw new Error('Health check reply ID mismatch');
  checkWs.close();

  await server.stop();
  console.log('=== DEEP DIVE 2 COMPLETED SUCCESSFULLY ===\n');
}

runCDPStressTest().catch((err) => {
  console.error('Deep dive 2 failed:', err);
  process.exit(1);
});
