/**
 * Goat WebView Task 10206 Tier 2: Boundary & Corner Case Test Suite
 *
 * Edge-value and malformed-input coverage for the Payment Security Gate.
 */

import { describe, it, expect } from '../harness/test-runner.ts';
import {
  GoatPaymentGatewaySimulator,
  GoatServerPaymentProxySimulator,
  GoatPaymentErrorCode,
  encodeSignedPayload,
  makeTestKeyPair,
  type GoatPaymentRequest,
} from '../harness/payment-simulator.ts';

const ORIGIN = 'https://tenant-1.appassets.androidplatform.net';
const SECRET = 'tenant-1-secret';

function buildRequest(overrides: Partial<GoatPaymentRequest & { amount: number; expiresAt: number }> = {}) {
  const keyPair = makeTestKeyPair(SECRET);
  const fields = {
    intentId: overrides.intentId ?? 'pi_1',
    orderId: overrides.orderId ?? 'order_1',
    amount: overrides.amount ?? 4999,
    currency: overrides.currency ?? 'USD',
    provider: overrides.provider ?? 'stripe',
    nonce: overrides.nonce ?? 'nonce_1',
    expiresAt: overrides.expiresAt ?? Date.now() + 300_000,
  };
  const signedPayload = encodeSignedPayload(fields, keyPair.sign);
  const request: GoatPaymentRequest = {
    provider: fields.provider, orderId: fields.orderId, intentId: fields.intentId,
    amount: fields.amount, currency: fields.currency, nonce: fields.nonce,
    signedPayload, gatewayDomain: overrides.gatewayDomain,
  };
  return request;
}

function makeSimulator(allowedGatewayDomains?: string[]) {
  const proxy = new GoatServerPaymentProxySimulator();
  proxy.registerTenantKey('tenant-1', makeTestKeyPair(SECRET).verify);
  const sim = new GoatPaymentGatewaySimulator({
    appId: 'tenant-1', proxy, allowedOrigins: [ORIGIN], allowedGatewayDomains,
    isGestureFresh: () => true,
  });
  return { sim, proxy };
}

export function registerTier2BoundaryCornerTests(): void {
  describe('Task 10206 Tier 2 - Boundary & Corner Cases', () => {
    it('TC-P2-B01: Zero-amount intent is accepted and processed normally', async () => {
      const { sim } = makeSimulator();
      sim.registerAdapter({ providerId: 'stripe', processPayment: (r) => ({ status: 'SUCCEEDED', intentId: r.intentId }) });
      const outcome = await sim.requestPayment(buildRequest({ amount: 0 }), ORIGIN);
      expect(outcome.status).toBe('SUCCEEDED');
    });

    it('TC-P2-B02: A very large amount (Number.MAX_SAFE_INTEGER) round-trips without corruption', async () => {
      const { sim } = makeSimulator();
      sim.registerAdapter({ providerId: 'stripe', processPayment: (r) => ({ status: 'SUCCEEDED', intentId: r.intentId }) });
      const outcome = await sim.requestPayment(buildRequest({ amount: Number.MAX_SAFE_INTEGER }), ORIGIN);
      expect(outcome.status).toBe('SUCCEEDED');
    });

    it('TC-P2-B03: A malformed signedPayload missing the "." separator rejects PAYMENT_INTENT_INVALID', async () => {
      const { sim } = makeSimulator();
      const req = buildRequest();
      await expect(sim.requestPayment({ ...req, signedPayload: 'not-base64-no-dot' }, ORIGIN)).rejects(GoatPaymentErrorCode.PAYMENT_INTENT_INVALID);
    });

    it('TC-P2-B04: An empty signedPayload rejects PAYMENT_INTENT_INVALID', async () => {
      const { sim } = makeSimulator();
      const req = buildRequest();
      await expect(sim.requestPayment({ ...req, signedPayload: '' }, ORIGIN)).rejects(GoatPaymentErrorCode.PAYMENT_INTENT_INVALID);
    });

    it('TC-P2-B05: expiresAt exactly equal to now is still valid (inclusive boundary)', async () => {
      const { sim } = makeSimulator();
      sim.registerAdapter({ providerId: 'stripe', processPayment: (r) => ({ status: 'SUCCEEDED', intentId: r.intentId }) });
      const realNow = Date.now;
      try {
        const fixedNow = 1700000000000;
        Date.now = () => fixedNow;
        const outcome = await sim.requestPayment(buildRequest({ expiresAt: fixedNow }), ORIGIN);
        expect(outcome.status).toBe('SUCCEEDED');
      } finally {
        Date.now = realNow;
      }
    });

    it('TC-P2-B06: expiresAt one millisecond in the past rejects PAYMENT_INTENT_EXPIRED', async () => {
      const { sim } = makeSimulator();
      await expect(sim.requestPayment(buildRequest({ expiresAt: Date.now() - 1 }), ORIGIN)).rejects(GoatPaymentErrorCode.PAYMENT_INTENT_EXPIRED);
    });

    it('TC-P2-B07: A gateway subdomain matches a wildcard-equivalent parent-domain allowlist entry', async () => {
      const { sim } = makeSimulator(['stripe.com']);
      sim.registerAdapter({ providerId: 'stripe', processPayment: (r) => ({ status: 'SUCCEEDED', intentId: r.intentId }) });
      const outcome = await sim.requestPayment(buildRequest({ gatewayDomain: 'checkout.stripe.com' }), ORIGIN);
      expect(outcome.status).toBe('SUCCEEDED');
    });

    it('TC-P2-B08: An unrelated domain sharing only a suffix substring is NOT matched (no partial-string bypass)', async () => {
      const { sim } = makeSimulator(['stripe.com']);
      await expect(sim.requestPayment(buildRequest({ gatewayDomain: 'evilstripe.com' }), ORIGIN)).rejects(GoatPaymentErrorCode.GATEWAY_NOT_ALLOWED);
    });

    it('TC-P2-B09: Calling CANCEL_PAYMENT twice on an already-cancelled intent is idempotent', async () => {
      const { sim } = makeSimulator();
      const first = await sim.cancelPayment('pi_never_created');
      const second = await sim.cancelPayment('pi_never_created');
      expect(first.status).toBe(second.status);
    });

    it('TC-P2-B10: QUERY_PAYMENT_STATUS on a never-claimed intent returns the default CREATED state', async () => {
      const { sim } = makeSimulator();
      const outcome = await sim.queryPaymentStatus('pi_unknown');
      expect(outcome.status).toBe('CREATED');
    });

    it('TC-P2-B11: A single-character provider id that is not registered still fails safely with PROVIDER_NOT_REGISTERED', async () => {
      const { sim } = makeSimulator();
      await expect(sim.requestPayment(buildRequest({ provider: 'x' }), ORIGIN)).rejects(GoatPaymentErrorCode.PROVIDER_NOT_REGISTERED);
    });
  });
}
