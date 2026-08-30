import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createGoatServer, GoatServerInstance } from '../src/server';
import { buildKhqrString } from '../src/payments/drivers/bakong.driver';
import { PaymentsIdempotencyService } from '../src/payments/payments-idempotency.service';
import { TenantKeysService } from '../src/payments/tenant-keys.service';
import { DatabaseService } from '../src/database/database.service';

const PAYMENTS_AUTH = { Authorization: 'Bearer test_payments_token' };
const WEBHOOK_SECRET = 'test_webhook_secret';

describe('Payment Gateway Proxy — Monotonic State & Anti-Replay Adversarial Suite (Task 10206)', () => {
  let server: GoatServerInstance;

  beforeEach(async () => {
    process.env.GOAT_PAYMENTS_TOKEN = 'test_payments_token';
    process.env.GOAT_WEBHOOK_SHARED_SECRET = WEBHOOK_SECRET;
    server = createGoatServer({ port: 0, cdpPort: 0, safariPort: 0, inMemoryDb: true, enableCors: true });
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
    delete process.env.GOAT_PAYMENTS_TOKEN;
    delete process.env.GOAT_WEBHOOK_SHARED_SECRET;
  });

  async function createIntent() {
    const res = await request(server.app)
      .post('/api/pay/intents')
      .send({ tenantAppId: 'tenant-1', orderId: 'order_1', provider: 'stripe', amount: 4999, currency: 'USD' })
      .expect(201);
    return res.body;
  }

  it('a terminal SUCCEEDED intent is immutable — a later client CANCELLED confirm cannot downgrade it', async () => {
    const intent = await createIntent();
    await request(server.app).post(`/api/pay/intents/${intent.intentId}/confirm`).set(PAYMENTS_AUTH).send({ status: 'SUCCEEDED', tenantAppId: 'tenant-1' }).expect(200);

    const downgraded = await request(server.app)
      .post(`/api/pay/intents/${intent.intentId}/confirm`)
      .set(PAYMENTS_AUTH)
      .send({ status: 'CANCELLED', tenantAppId: 'tenant-1' })
      .expect(200);

    expect(downgraded.body.status).toBe('SUCCEEDED');
  });

  it('SUCCEEDED is immutable against an explicit /cancel call too', async () => {
    const intent = await createIntent();
    await request(server.app).post(`/api/pay/intents/${intent.intentId}/confirm`).set(PAYMENTS_AUTH).send({ status: 'SUCCEEDED', tenantAppId: 'tenant-1' }).expect(200);

    const cancelled = await request(server.app)
      .post(`/api/pay/intents/${intent.intentId}/cancel`)
      .set(PAYMENTS_AUTH)
      .send({ tenantAppId: 'tenant-1' })
      .expect(200);

    expect(cancelled.body.status).toBe('SUCCEEDED');
  });

  it('a PSP webhook charge.succeeded overrides a provisional client-sent CANCELLED (A9)', async () => {
    const intent = await createIntent();
    await request(server.app).post(`/api/pay/intents/${intent.intentId}/confirm`).set(PAYMENTS_AUTH).send({ status: 'CANCELLED', tenantAppId: 'tenant-1' }).expect(200);

    const webhook = await request(server.app)
      .post('/api/pay/webhooks/stripe')
      .set('x-goat-webhook-secret', WEBHOOK_SECRET)
      .send({ eventId: 'evt_settle_1', intentId: intent.intentId, status: 'SUCCEEDED', transactionHandle: 'txh_settled' })
      .expect(200);

    expect(webhook.body.status).toBe('SUCCEEDED');
    const record = await request(server.app).get(`/api/pay/intents/${intent.intentId}`).expect(200);
    expect(record.body.status).toBe('SUCCEEDED');
  });

  it('a duplicate webhook eventId for a terminal charge.failed after SUCCEEDED does not resurrect FAILED', async () => {
    const intent = await createIntent();
    await request(server.app)
      .post('/api/pay/webhooks/stripe')
      .set('x-goat-webhook-secret', WEBHOOK_SECRET)
      .send({ eventId: 'evt_a', intentId: intent.intentId, status: 'SUCCEEDED' })
      .expect(200);

    const failedAttempt = await request(server.app)
      .post('/api/pay/webhooks/stripe')
      .set('x-goat-webhook-secret', WEBHOOK_SECRET)
      .send({ eventId: 'evt_b', intentId: intent.intentId, status: 'FAILED' })
      .expect(200);

    expect(failedAttempt.body.status).toBe('SUCCEEDED');
  });

  it('rejects a claim attempt with a tenantAppId that does not own the intent', async () => {
    const intent = await createIntent();
    await request(server.app)
      .post(`/api/pay/intents/${intent.intentId}/claim`)
      .send({ tenantAppId: 'attacker-tenant' })
      .expect(403);
  });

  it('a second concurrent claim for the same intentId is rejected server-side (anti double-bridge, A8)', async () => {
    const intent = await createIntent();
    const [first, second] = await Promise.all([
      request(server.app).post(`/api/pay/intents/${intent.intentId}/claim`).send({ tenantAppId: 'tenant-1' }),
      request(server.app).post(`/api/pay/intents/${intent.intentId}/claim`).send({ tenantAppId: 'tenant-1' }),
    ]);
    const claims = [first.body.claimed, second.body.claimed];
    expect(claims.filter((c) => c === true).length).toBe(1);
    expect(claims.filter((c) => c === false).length).toBe(1);
  });

  it('rejects a webhook with an invalid shared-secret header when one is configured', async () => {
    const intent = await request(server.app)
      .post('/api/pay/intents')
      .send({ tenantAppId: 'tenant-1', orderId: 'order_1', provider: 'stripe', amount: 100, currency: 'USD' })
      .expect(201);

    await request(server.app)
      .post('/api/pay/webhooks/stripe')
      .set('x-goat-webhook-secret', 'wrong_secret')
      .send({ eventId: 'evt_x', intentId: intent.body.intentId, status: 'SUCCEEDED' })
      .expect(401);

    await request(server.app)
      .post('/api/pay/webhooks/stripe')
      .set('x-goat-webhook-secret', WEBHOOK_SECRET)
      .send({ eventId: 'evt_x', intentId: intent.body.intentId, status: 'SUCCEEDED' })
      .expect(200);
  });

  it('rejects webhooks entirely when no shared secret is configured (fail-closed)', async () => {
    delete process.env.GOAT_WEBHOOK_SHARED_SECRET;
    const localServer = createGoatServer({ port: 0, cdpPort: 0, safariPort: 0, inMemoryDb: true });
    await localServer.start();
    try {
      await request(localServer.app)
        .post('/api/pay/webhooks/stripe')
        .set('x-goat-webhook-secret', 'anything')
        .send({ eventId: 'evt_x', intentId: 'pi_x', status: 'SUCCEEDED' })
        .expect(503);
    } finally {
      await localServer.stop();
      process.env.GOAT_WEBHOOK_SHARED_SECRET = WEBHOOK_SECRET;
    }
  });

  it('persists payment intents across service restarts', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'goat-payments-'));
    const dbPath = path.join(dir, 'ledger.db');
    try {
      const first = new DatabaseService({ dbPath });
      const svc1 = new PaymentsIdempotencyService(first);
      const created = svc1.createIntent({ tenantAppId: 't1', orderId: 'o1', provider: 'stripe', amount: 100, currency: 'USD' });
      svc1.transition(created.intentId, 'SUCCEEDED', { transactionHandle: 'txh_restart' });
      first.close();

      const second = new DatabaseService({ dbPath });
      const svc2 = new PaymentsIdempotencyService(second);
      try {
        const reloaded = svc2.getIntent(created.intentId);
        expect(reloaded).toBeDefined();
        expect(reloaded?.status).toBe('SUCCEEDED');
        expect(reloaded?.transactionHandle).toBe('txh_restart');
      } finally {
        second.close();
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('persists tenant signing keys across service restarts', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'goat-tenant-keys-'));
    const dbPath = path.join(dir, 'keys.db');
    try {
      const first = new DatabaseService({ dbPath });
      const svc1 = new TenantKeysService(first);
      svc1.register({ tenantAppId: 'tenant-restart', keyBase64: 'a2V5X2Jhc2U2NA==', algorithm: 'Ed25519' });
      svc1.register({ tenantAppId: 'tenant-rotate', keyBase64: 'b2xkX2tleQ==', algorithm: 'ECDSA_P256' });
      first.close();

      const second = new DatabaseService({ dbPath });
      const svc2 = new TenantKeysService(second);
      try {
        expect(svc2.get('tenant-restart')?.keyBase64).toBe('a2V5X2Jhc2U2NA==');
        expect(svc2.get('tenant-restart')?.algorithm).toBe('Ed25519');
        expect(svc2.get('tenant-rotate')?.algorithm).toBe('ECDSA_P256');
      } finally {
        second.close();
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('registering the same tenant twice upserts the key instead of duplicating rows', () => {
    const db = new DatabaseService({ dbPath: ':memory:', inMemory: true });
    const svc = new TenantKeysService(db);
    svc.register({ tenantAppId: 'tenant-upsert', keyBase64: 'a2V5X3Yx', algorithm: 'Ed25519' });
    svc.register({ tenantAppId: 'tenant-upsert', keyBase64: 'a2V5X3Yy', algorithm: 'ECDSA_P256' });

    expect(svc.get('tenant-upsert')?.keyBase64).toBe('a2V5X3Yy');
    expect(svc.get('tenant-upsert')?.algorithm).toBe('ECDSA_P256');
    expect(svc.get('tenant-unknown')).toBeUndefined();
    db.close();
  });

  it('expired intents transition to EXPIRED via purgeExpired without touching terminal ones', () => {
    const db = new DatabaseService({ dbPath: ':memory:', inMemory: true });
    const svc = new PaymentsIdempotencyService(db);
    const active = svc.createIntent({ tenantAppId: 't1', orderId: 'o1', provider: 'stripe', amount: 100, currency: 'USD' });
    const settled = svc.createIntent({ tenantAppId: 't1', orderId: 'o2', provider: 'stripe', amount: 100, currency: 'USD' });
    svc.transition(settled.intentId, 'SUCCEEDED');

    const farFuture = Date.now() + 10 * 60_000;
    svc.purgeExpired(farFuture);

    expect(svc.getIntent(active.intentId)?.status).toBe('EXPIRED');
    expect(svc.getIntent(settled.intentId)?.status).toBe('SUCCEEDED');
    db.close();
  });

  it('KHQR builder produces a stable, verifiable CRC for identical inputs', () => {
    const params = {
      bakongAccountId: 'merchant@devbank',
      merchantName: 'Goat WebView Merchant',
      merchantCity: 'Phnom Penh',
      amount: 49.99,
      currency: 'USD' as const,
      billNumber: 'order_1',
    };
    const first = buildKhqrString(params);
    const second = buildKhqrString(params);
    expect(first).toBe(second);

    const tampered = buildKhqrString({ ...params, amount: 1.0 });
    expect(tampered).not.toBe(first);
    // CRC must differ whenever the payload differs.
    expect(tampered.slice(-4)).not.toBe(first.slice(-4));
  });
});
