import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { WebSocket } from 'ws';
import { createGoatServer, GoatServerInstance } from '../src/server';

describe('Wireless QR Pairing & WebSocket Tunneling Gateway', () => {
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
    server.pairingManager.setHostAndPort('127.0.0.1', serverPort);
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should initialize pairing session with QR terminal, SVG and data URL', async () => {
    const initRes = await request(server.app)
      .post('/api/pair/init')
      .send({ appId: 'com.goat.demo', port: serverPort })
      .expect(201);

    expect(initRes.body.token).toMatch(/^pair_tok_/);
    expect(initRes.body.status).toBe('PENDING');
    expect(initRes.body.pairingUrl).toContain('goat://pair?');
    expect(initRes.body.qrTerminal).toBeDefined();
    expect(initRes.body.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(initRes.body.qrSvg).toContain('<svg');
  });

  it('should complete device handshake and promote session to ACTIVE', async () => {
    const initRes = await request(server.app)
      .post('/api/pair/init')
      .send({ appId: 'com.goat.demo' });
    const token = initRes.body.token;

    const handshakePayload = {
      token,
      deviceInfo: {
        platform: 'android' as const,
        osVersion: '14.0',
        model: 'Pixel 9 Pro',
        screen: { width: 1080, height: 2400, scale: 3 },
      },
    };

    const handshakeRes = await request(server.app)
      .post('/api/pair/handshake')
      .send(handshakePayload)
      .expect(200);

    expect(handshakeRes.body.status).toBe('ACTIVE');
    expect(handshakeRes.body.deviceName).toBe('Pixel 9 Pro');
    expect(handshakeRes.body.platform).toBe('android');

    // Query status
    const statusRes = await request(server.app).get(`/api/pair/status/${token}`).expect(200);
    expect(statusRes.body.status).toBe('ACTIVE');
    expect(statusRes.body.deviceName).toBe('Pixel 9 Pro');

    // Query sessions list
    const sessionsRes = await request(server.app).get('/api/sessions').expect(200);
    expect(sessionsRes.body.total).toBeGreaterThanOrEqual(1);
  });

  it('should serve QR code in SVG and terminal format', async () => {
    const initRes = await request(server.app)
      .post('/api/pair/init')
      .send({ appId: 'com.goat.qr' });
    const token = initRes.body.token;

    const svgRes = await request(server.app).get(`/api/pair/qr/${token}?format=svg`).expect(200);
    expect(svgRes.headers['content-type']).toContain('image/svg+xml');
    const svgContent = svgRes.text || (Buffer.isBuffer(svgRes.body) ? svgRes.body.toString('utf8') : String(svgRes.body));
    expect(svgContent).toContain('<svg');

    const termRes = await request(server.app).get(`/api/pair/qr/${token}?format=terminal`).expect(200);
    expect(termRes.headers['content-type']).toContain('text/plain');
    const termContent = termRes.text || (Buffer.isBuffer(termRes.body) ? termRes.body.toString('utf8') : String(termRes.body));
    expect(termContent.length).toBeGreaterThan(10);
  });

  it('should stream HMR and bundle updates across WebSocket tunnel between publisher and subscriber', async () => {
    const initRes = await request(server.app)
      .post('/api/pair/init')
      .send({ appId: 'com.goat.tunnel' });
    const token = initRes.body.token;
    await request(server.app)
      .post('/api/pair/handshake')
      .send({ token, deviceInfo: { name: 'tunnel-device', platform: 'web', osVersion: '1.0' } })
      .expect(200);
    const publisherWs = new WebSocket(`ws://127.0.0.1:${serverPort}/tunnel/${token}`);
    const subscriberWs = new WebSocket(`ws://127.0.0.1:${serverPort}/tunnel/${token}`);

    await Promise.all([
      new Promise<void>((res) => publisherWs.on('open', res)),
      new Promise<void>((res) => subscriberWs.on('open', res)),
    ]);

    // Join publisher
    publisherWs.send(JSON.stringify({ type: 'JOIN', role: 'publisher' }));

    // Subscriber waits for HMR message
    const hmrPromise = new Promise<any>((resolve) => {
      subscriberWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'HMR_UPDATE') {
          resolve(msg);
        }
      });
    });

    // Publisher sends HMR update
    publisherWs.send(
      JSON.stringify({
        type: 'HMR_UPDATE',
        data: {
          file: 'src/App.tsx',
          hash: 'abc12345',
          updates: [{ type: 'js-update', path: '/src/App.tsx' }],
        },
      })
    );

    const received = await hmrPromise;
    expect(received.type).toBe('HMR_UPDATE');
    expect(received.data.file).toBe('src/App.tsx');
    expect(received.data.hash).toBe('abc12345');

    publisherWs.close();
    subscriberWs.close();
    await new Promise((res) => setTimeout(res, 20));
  });

  it('should reject WebSocket tunnel upgrades with invalid or closed session tokens', async () => {
    const invalidWs = new WebSocket(`ws://127.0.0.1:${serverPort}/tunnel/pair_tok_does_not_exist`);
    let invalidStatusCode = 0;
    let invalidOpened = false;
    invalidWs.on('unexpected-response', (_req, res) => {
      invalidStatusCode = res.statusCode;
    });
    invalidWs.on('open', () => {
      invalidOpened = true;
    });
    invalidWs.on('error', () => {});
    await new Promise<void>((resolve) => {
      invalidWs.on('unexpected-response', () => resolve());
      invalidWs.on('close', () => resolve());
      setTimeout(resolve, 2000);
    });
    expect(invalidOpened).toBe(false);
    expect(invalidStatusCode).toBe(401);

    const initRes = await request(server.app)
      .post('/api/pair/init')
      .send({ appId: 'com.goat.tunnel_closed' });
    const closedToken = initRes.body.token;
    expect(server.pairingManager.closeSession(closedToken)).toBe(true);

    const closedWs = new WebSocket(`ws://127.0.0.1:${serverPort}/tunnel/${closedToken}`);
    let closedStatusCode = 0;
    let closedOpened = false;
    closedWs.on('unexpected-response', (_req, res) => {
      closedStatusCode = res.statusCode;
    });
    closedWs.on('open', () => {
      closedOpened = true;
    });
    closedWs.on('error', () => {});
    await new Promise<void>((resolve) => {
      closedWs.on('unexpected-response', () => resolve());
      closedWs.on('close', () => resolve());
      setTimeout(resolve, 2000);
    });
    expect(closedOpened).toBe(false);
    expect(closedStatusCode).toBe(403);
  });

  it('should reject WebSocket tunnel upgrades for PENDING sessions until handshake completes', async () => {
    const initRes = await request(server.app)
      .post('/api/pair/init')
      .send({ appId: 'com.goat.tunnel_pending' });
    const pendingToken = initRes.body.token;

    const pendingWs = new WebSocket(`ws://127.0.0.1:${serverPort}/tunnel/${pendingToken}`);
    let pendingStatusCode = 0;
    let pendingOpened = false;
    pendingWs.on('unexpected-response', (_req, res) => {
      pendingStatusCode = res.statusCode;
    });
    pendingWs.on('open', () => {
      pendingOpened = true;
    });
    pendingWs.on('error', () => {});
    await new Promise<void>((resolve) => {
      pendingWs.on('unexpected-response', () => resolve());
      pendingWs.on('close', () => resolve());
      setTimeout(resolve, 2000);
    });
    expect(pendingOpened).toBe(false);
    expect(pendingStatusCode).toBe(403);
  });

  it('should reject handshake on CLOSED pairing sessions', async () => {
    const initRes = await request(server.app)
      .post('/api/pair/init')
      .send({ appId: 'com.goat.closed_test' });
    const token = initRes.body.token;

    // First complete handshake to make it ACTIVE
    await request(server.app)
      .post('/api/pair/handshake')
      .send({
        token,
        deviceInfo: {
          platform: 'ios' as const,
          osVersion: '17.0',
          deviceName: 'iPhone 15',
        },
      })
      .expect(200);

    // Close the session
    const closed = server.pairingManager.closeSession(token);
    expect(closed).toBe(true);

    const statusRes = await request(server.app).get(`/api/pair/status/${token}`).expect(200);
    expect(statusRes.body.status).toBe('CLOSED');

    // Attempting handshake on the CLOSED session must be rejected with 404
    const rejectRes = await request(server.app)
      .post('/api/pair/handshake')
      .send({
        token,
        deviceInfo: {
          platform: 'ios' as const,
          osVersion: '17.0',
          deviceName: 'iPhone 15 Re-Handshake',
        },
      })
      .expect(404);

    expect(rejectRes.body.error).toContain('Pairing session not found or closed');

    // Session status remains CLOSED
    const finalStatus = await request(server.app).get(`/api/pair/status/${token}`).expect(200);
    expect(finalStatus.body.status).toBe('CLOSED');
  });

  it('should reject handshake on expired pairing sessions (>24h TTL)', async () => {
    const initRes = await request(server.app)
      .post('/api/pair/init')
      .send({ appId: 'com.goat.expired_test' });
    const token = initRes.body.token;

    // Simulate expired session connected 25 hours ago
    const session = server.pairingManager.getSession(token);
    expect(session).toBeDefined();
    session!.connectedAt = Date.now() - 25 * 60 * 60 * 1000;

    const rejectRes = await request(server.app)
      .post('/api/pair/handshake')
      .send({
        token,
        deviceInfo: {
          platform: 'android' as const,
          osVersion: '14.0',
          deviceName: 'Pixel 9',
        },
      })
      .expect(404);

    expect(rejectRes.body.error).toContain('Pairing session not found or closed');
  });

  it('should generate pairing tokens with 128-bit entropy (32 hex chars)', async () => {
    const initRes = await request(server.app)
      .post('/api/pair/init')
      .send({ appId: 'com.goat.entropy' })
      .expect(201);

    expect(initRes.body.token).toMatch(/^pair_tok_[0-9a-f]{32}$/);
  });

  it('should reject handshake on sessions expired after the 15-minute TTL', async () => {
    const initRes = await request(server.app)
      .post('/api/pair/init')
      .send({ appId: 'com.goat.ttl_15min' });
    const token = initRes.body.token;

    const session = server.pairingManager.getSession(token);
    expect(session).toBeDefined();
    session!.connectedAt = Date.now() - 16 * 60 * 1000;

    await request(server.app)
      .post('/api/pair/handshake')
      .send({
        token,
        deviceInfo: {
          platform: 'android' as const,
          osVersion: '14.0',
          deviceName: 'Pixel 9',
        },
      })
      .expect(404);
  });

  it('should enforce the 5-attempt pairing verification rate limit per token', async () => {
    const bogusToken = 'pair_tok_bogus_attempt_limit';
    const payload = {
      token: bogusToken,
      deviceInfo: {
        platform: 'android' as const,
        osVersion: '14.0',
        deviceName: 'Brute Forcer',
      },
    };

    for (let i = 0; i < 5; i++) {
      await request(server.app)
        .post('/api/pair/handshake')
        .send(payload)
        .expect(404);
    }

    const rateLimited = await request(server.app)
      .post('/api/pair/handshake')
      .send(payload)
      .expect(500);

    expect(rateLimited.body.error).toContain('rate limit');
  });
});
