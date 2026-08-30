/**
 * Goat WebView Task 10206 Tier 3: Cross-Feature Interaction Test Suite
 *
 * Complex pairwise scenarios combining two or more Payment Security Gate layers.
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
    intentId: overrides.intentId ?? 'pi_1', orderId: overrides.orderId ?? 'order_1',
    amount: overrides.amount ?? 4999, currency: overrides.currency ?? 'USD',
    provider: overrides.provider ?? 'stripe', nonce: overrides.nonce ?? 'nonce_1',
    expiresAt: overrides.expiresAt ?? Date.now() + 300_000,
  };
  return {
    provider: fields.provider, orderId: fields.orderId, intentId: fields.intentId,
    amount: fields.amount, currency: fields.currency, nonce: fields.nonce,
    signedPayload: encodeSignedPayload(fields, keyPair.sign), gatewayDomain: overrides.gatewayDomain,
  } satisfies GoatPaymentRequest;
}

export function registerTier3CrossFeatureTests(): void {
  describe('Task 10206 Tier 3 - Cross-Feature Interactions', () => {
    it('TC-P3-01: Stale gesture + overlay decline + retry with fresh overlay-confirmed gesture eventually succeeds', async () => {
      const proxy = new GoatServerPaymentProxySimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair(SECRET).verify);
      let allowOverlay = false;
      const sim = new GoatPaymentGatewaySimulator({
        appId: 'tenant-1', proxy, allowedOrigins: [ORIGIN],
        overlayPresenter: async () => allowOverlay,
        isGestureFresh: () => false,
      });
      sim.registerAdapter({ providerId: 'stripe', processPayment: (r) => ({ status: 'SUCCEEDED', intentId: r.intentId }) });

      const req = buildRequest();
      await expect(sim.requestPayment(req, ORIGIN)).rejects(GoatPaymentErrorCode.PAYMENT_CANCELLED);

      allowOverlay = true;
      const outcome = await sim.requestPayment(buildRequest({ intentId: 'pi_retry' }), ORIGIN);
      expect(outcome.status).toBe('SUCCEEDED');
    });

    it('TC-P3-02: Origin allowlist is checked even when the signature and amount are otherwise perfectly valid', async () => {
      const proxy = new GoatServerPaymentProxySimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair(SECRET).verify);
      const sim = new GoatPaymentGatewaySimulator({ appId: 'tenant-1', proxy, allowedOrigins: [ORIGIN], isGestureFresh: () => true });
      sim.registerAdapter({ providerId: 'stripe', processPayment: (r) => ({ status: 'SUCCEEDED', intentId: r.intentId }) });
      await expect(sim.requestPayment(buildRequest(), 'https://impersonator.example.com')).rejects(GoatPaymentErrorCode.ORIGIN_NOT_ALLOWED);
    });

    it('TC-P3-03: A mutex-blocked duplicate call does not consume the idempotency cache slot of the winning call', async () => {
      const proxy = new GoatServerPaymentProxySimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair(SECRET).verify);
      const sim = new GoatPaymentGatewaySimulator({ appId: 'tenant-1', proxy, allowedOrigins: [ORIGIN], isGestureFresh: () => true });
      sim.registerAdapter({
        providerId: 'stripe',
        processPayment: async (r) => { await new Promise((res) => setTimeout(res, 20)); return { status: 'SUCCEEDED', intentId: r.intentId, transactionHandle: 'txh_winner' }; },
      });
      const req = buildRequest();
      const winner = sim.requestPayment(req, ORIGIN);
      await new Promise((res) => setTimeout(res, 3));
      await expect(sim.requestPayment(req, ORIGIN)).rejects(GoatPaymentErrorCode.PAYMENT_IN_PROGRESS);
      const result = await winner;
      expect(result.transactionHandle).toBe('txh_winner');

      const replay = await sim.requestPayment(req, ORIGIN);
      expect(replay.transactionHandle).toBe('txh_winner');
    });

    it('TC-P3-04: KHQR non-blocking return interacts correctly with a subsequent onAppResume flush and a QUERY_PAYMENT_STATUS poll', async () => {
      const proxy = new GoatServerPaymentProxySimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair(SECRET).verify);
      const sim = new GoatPaymentGatewaySimulator({ appId: 'tenant-1', proxy, allowedOrigins: [ORIGIN], isGestureFresh: () => true });
      let khqrStatus: any = 'PROCESSING';
      sim.registerAdapter({
        providerId: 'bakong_khqr',
        processPayment: (r) => ({ status: 'PROCESSING', intentId: r.intentId }),
        queryStatus: () => khqrStatus,
      });

      const req = buildRequest({ provider: 'bakong_khqr' });
      const initial = await sim.requestPayment(req, ORIGIN);
      expect(initial.status).toBe('PROCESSING');

      const midPoll = await sim.queryPaymentStatus('pi_1');
      expect(midPoll.status).toBe('PROCESSING');

      khqrStatus = 'SUCCEEDED';
      let asyncOutcome: any = null;
      await sim.onAppResume((o) => { asyncOutcome = o; });
      expect(asyncOutcome.status).toBe('SUCCEEDED');

      const finalPoll = await sim.queryPaymentStatus('pi_1');
      expect(finalPoll.status).toBe('SUCCEEDED');
    });

    it('TC-P3-05: A gateway domain check and a signature check both fire independently — either alone is sufficient to block', async () => {
      const proxy = new GoatServerPaymentProxySimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair(SECRET).verify);
      const sim = new GoatPaymentGatewaySimulator({
        appId: 'tenant-1', proxy, allowedOrigins: [ORIGIN], allowedGatewayDomains: ['checkout.stripe.com'], isGestureFresh: () => true,
      });
      const badGateway = buildRequest({ intentId: 'pi_bad_gw', gatewayDomain: 'evil.example.com' });
      await expect(sim.requestPayment(badGateway, ORIGIN)).rejects(GoatPaymentErrorCode.GATEWAY_NOT_ALLOWED);

      const badSig = buildRequest({ intentId: 'pi_bad_sig', gatewayDomain: 'checkout.stripe.com' });
      const tampered = { ...badSig, signedPayload: badSig.signedPayload.slice(0, -2) + 'ZZ' };
      await expect(sim.requestPayment(tampered, ORIGIN)).rejects(GoatPaymentErrorCode.PAYMENT_INTENT_INVALID);
    });
  });
}
