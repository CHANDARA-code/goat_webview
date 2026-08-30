import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createGoatServer, GoatServerInstance } from '../src/server';

const PAYMENTS_AUTH = { Authorization: 'Bearer test_payments_token' };
const ADMIN_AUTH = { Authorization: 'Bearer test_admin_token' };
const WEBHOOK_SECRET = 'test_webhook_secret';

describe('Payment Gateway Proxy API (Task 10206)', () => {
  let server: GoatServerInstance;

  beforeEach(async () => {
    process.env.GOAT_PAYMENTS_TOKEN = 'test_payments_token';
    process.env.GOAT_ADMIN_TOKEN = 'test_admin_token';
    process.env.GOAT_WEBHOOK_SHARED_SECRET = WEBHOOK_SECRET;
    server = createGoatServer({ port: 0, cdpPort: 0, safariPort: 0, inMemoryDb: true, enableCors: true });
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
    delete process.env.GOAT_PAYMENTS_TOKEN;
    delete process.env.GOAT_ADMIN_TOKEN;
    delete process.env.GOAT_WEBHOOK_SHARED_SECRET;
  });

  async function createIntent(provider = 'stripe', overrides: Partial<Record<string, unknown>> = {}) {
    const res = await request(server.app)
      .post('/api/pay/intents')
      .send({ tenantAppId: 'tenant-1', orderId: 'order_1', provider, amount: 4999, currency: 'USD', ...overrides })
      .expect(201);
    return res.body;
  }

  it('registers and retrieves a tenant public key', async () => {
    await request(server.app)
      .post('/api/tenant-keys/tenant-1')
      .set(ADMIN_AUTH)
      .send({ publicKeyBase64: 'ZmFrZS1rZXktYnl0ZXM=', algorithm: 'Ed25519' })
      .expect(201);

    const res = await request(server.app).get('/api/tenant-keys/tenant-1').expect(200);
    expect(res.body.publicKeyBase64).toBe('ZmFrZS1rZXktYnl0ZXM=');
    expect(res.body.algorithm).toBe('Ed25519');
  });

  it('404s for an unregistered tenant public key', async () => {
    await request(server.app).get('/api/tenant-keys/unknown-tenant').expect(404);
  });

  it('creates a payment intent in CREATED status', async () => {
    const intent = await createIntent();
    expect(intent.status).toBe('CREATED');
    expect(intent.intentId).toMatch(/^pi_goat_/);
    expect(intent.nonce).toBeTruthy();
    expect(intent.expiresAt).toBeGreaterThan(Date.now());
  });

  it('rejects intent creation for an unregistered provider', async () => {
    const res = await request(server.app)
      .post('/api/pay/intents')
      .send({ tenantAppId: 'tenant-1', orderId: 'order_1', provider: 'unknown_psp', amount: 100, currency: 'USD' })
      .expect(400);
    expect(res.body.code).toBe('PROVIDER_NOT_REGISTERED');
  });

  it('the first claim wins; a second claim for the same intent is rejected with the prior state', async () => {
    const intent = await createIntent();

    const first = await request(server.app)
      .post(`/api/pay/intents/${intent.intentId}/claim`)
      .send({ tenantAppId: 'tenant-1' })
      .expect(200);
    expect(first.body.claimed).toBe(true);

    const second = await request(server.app)
      .post(`/api/pay/intents/${intent.intentId}/claim`)
      .send({ tenantAppId: 'tenant-1' })
      .expect(200);
    expect(second.body.claimed).toBe(false);
    expect(second.body.priorOutcome.intentId).toBe(intent.intentId);
  });

  it('mints an opaque client token per PSP without ever exposing a secret key', async () => {
    for (const provider of ['stripe', 'link', 'alipay', 'paypay']) {
      const intent = await createIntent(provider);
      const res = await request(server.app).get(`/api/pay/intents/${intent.intentId}/client-token`).expect(200);
      expect(typeof res.body.clientToken).toBe('string');
      expect(res.body.clientToken.length).toBeGreaterThan(0);
      expect(res.body.clientToken).not.toContain('sk_'.repeat(1)); // never the raw secret key prefix pattern
    }
  });

  it('mints a well-formed Bakong KHQR string ending in a 4-hex-digit CRC', async () => {
    const intent = await createIntent('bakong_khqr', { currency: 'KHR' });
    const res = await request(server.app).get(`/api/pay/intents/${intent.intentId}/client-token`).expect(200);
    const qr: string = res.body.clientToken;
    expect(qr.startsWith('000201')).toBe(true);
    expect(qr.slice(-8, -4)).toBe('6304');
    expect(qr.slice(-4)).toMatch(/^[0-9A-F]{4}$/);
  });

  it('confirms an intent to a terminal state', async () => {
    const intent = await createIntent();
    const res = await request(server.app)
      .post(`/api/pay/intents/${intent.intentId}/confirm`)
      .set(PAYMENTS_AUTH)
      .send({ status: 'SUCCEEDED', transactionHandle: 'txh_1', tenantAppId: 'tenant-1' })
      .expect(200);
    expect(res.body.status).toBe('SUCCEEDED');
    expect(res.body.transactionHandle).toBe('txh_1');
  });

  it('cancels a pending intent', async () => {
    const intent = await createIntent();
    const res = await request(server.app)
      .post(`/api/pay/intents/${intent.intentId}/cancel`)
      .set(PAYMENTS_AUTH)
      .send({ tenantAppId: 'tenant-1' })
      .expect(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  it('queries an intent by id', async () => {
    const intent = await createIntent();
    const res = await request(server.app).get(`/api/pay/intents/${intent.intentId}`).expect(200);
    expect(res.body.intentId).toBe(intent.intentId);
    expect(res.body.status).toBe('CREATED');
  });

  it('404s for an unknown intentId across all intent routes', async () => {
    await request(server.app).get('/api/pay/intents/pi_does_not_exist').expect(404);
    await request(server.app)
      .post('/api/pay/intents/pi_does_not_exist/cancel')
      .set(PAYMENTS_AUTH)
      .send({ tenantAppId: 'tenant-1' })
      .expect(404);
    await request(server.app)
      .post('/api/pay/intents/pi_does_not_exist/confirm')
      .set(PAYMENTS_AUTH)
      .send({ status: 'SUCCEEDED', tenantAppId: 'tenant-1' })
      .expect(404);
  });

  it('applies a webhook event and dedupes a replayed eventId', async () => {
    const intent = await createIntent();
    const first = await request(server.app)
      .post('/api/pay/webhooks/stripe')
      .set('x-goat-webhook-secret', WEBHOOK_SECRET)
      .send({ eventId: 'evt_1', intentId: intent.intentId, status: 'SUCCEEDED', transactionHandle: 'txh_webhook' })
      .expect(200);
    expect(first.body.applied).toBe(true);
    expect(first.body.status).toBe('SUCCEEDED');

    const replay = await request(server.app)
      .post('/api/pay/webhooks/stripe')
      .set('x-goat-webhook-secret', WEBHOOK_SECRET)
      .send({ eventId: 'evt_1', intentId: intent.intentId, status: 'FAILED' })
      .expect(200);
    expect(replay.body.applied).toBe(false);
    expect(replay.body.status).toBe('SUCCEEDED');
  });

  it('rejects unauthenticated confirm and cancel with 401', async () => {
    const intent = await createIntent();
    await request(server.app)
      .post(`/api/pay/intents/${intent.intentId}/confirm`)
      .send({ status: 'SUCCEEDED', tenantAppId: 'tenant-1' })
      .expect(401);
    await request(server.app)
      .post(`/api/pay/intents/${intent.intentId}/cancel`)
      .send({ tenantAppId: 'tenant-1' })
      .expect(401);
  });

  it('rejects confirm with a wrong bearer token', async () => {
    const intent = await createIntent();
    await request(server.app)
      .post(`/api/pay/intents/${intent.intentId}/confirm`)
      .set({ Authorization: 'Bearer wrong_token' })
      .send({ status: 'SUCCEEDED', tenantAppId: 'tenant-1' })
      .expect(401);
  });

  it('rejects confirm and cancel for a non-owning tenant with 403', async () => {
    const intent = await createIntent();
    await request(server.app)
      .post(`/api/pay/intents/${intent.intentId}/confirm`)
      .set(PAYMENTS_AUTH)
      .send({ status: 'SUCCEEDED', tenantAppId: 'attacker-tenant' })
      .expect(403);
    await request(server.app)
      .post(`/api/pay/intents/${intent.intentId}/cancel`)
      .set(PAYMENTS_AUTH)
      .send({ tenantAppId: 'attacker-tenant' })
      .expect(403);
  });

  it('rejects unauthenticated tenant public key registration with 401', async () => {
    await request(server.app)
      .post('/api/tenant-keys/tenant-1')
      .send({ publicKeyBase64: 'ZmFrZS1rZXktYnl0ZXM=' })
      .expect(401);
  });

  it('rejects webhooks with an invalid shared secret', async () => {
    await request(server.app)
      .post('/api/pay/webhooks/stripe')
      .set('x-goat-webhook-secret', 'wrong_secret')
      .send({ eventId: 'evt_1', intentId: 'pi_1', status: 'SUCCEEDED' })
      .expect(401);
  });

  it('rejects webhooks when no shared secret is configured (fail-closed)', async () => {
    delete process.env.GOAT_WEBHOOK_SHARED_SECRET;
    const localServer = createGoatServer({ port: 0, cdpPort: 0, safariPort: 0, inMemoryDb: true });
    await localServer.start();
    try {
      await request(localServer.app)
        .post('/api/pay/webhooks/stripe')
        .set('x-goat-webhook-secret', 'anything')
        .send({ eventId: 'evt_1', intentId: 'pi_1', status: 'SUCCEEDED' })
        .expect(503);
    } finally {
      await localServer.stop();
      process.env.GOAT_WEBHOOK_SHARED_SECRET = WEBHOOK_SECRET;
    }
  });
});
