/**
 * Goat WebView Task 10206 Tier 4: Real-World SuperApp Workflow Test Suite
 *
 * Full-lifecycle scenarios exercising the Payment Gateway Proxy the way a production mini-app
 * checkout flow actually would.
 */

import { describe, it, expect } from '../harness/test-runner.ts';
import {
  GoatPaymentGatewaySimulator,
  GoatServerPaymentProxySimulator,
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

export function registerTier4RealWorldScenariosTests(): void {
  describe('Task 10206 Tier 4 - Real-World SuperApp Workflows', () => {
    it('Scenario 1: Full Stripe PaymentSheet checkout succeeds end-to-end and is idempotently cached', async () => {
      const proxy = new GoatServerPaymentProxySimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair(SECRET).verify);
      const sim = new GoatPaymentGatewaySimulator({ appId: 'tenant-1', proxy, allowedOrigins: [ORIGIN], isGestureFresh: () => true });
      sim.registerAdapter({ providerId: 'stripe', processPayment: (r) => ({ status: 'SUCCEEDED', intentId: r.intentId, transactionHandle: 'txh_stripe_1' }) });

      const req = buildRequest();
      const outcome = await sim.requestPayment(req, ORIGIN);
      expect(outcome.status).toBe('SUCCEEDED');

      // Mini-app JS crashes and retries the exact same bridge call — must not double-charge.
      const retry = await sim.requestPayment(req, ORIGIN);
      expect(retry.transactionHandle).toBe('txh_stripe_1');
    });

    it('Scenario 2: Alipay app2app return is re-verified against the proxy, and a later spoofed FAILED cannot undo a real success', async () => {
      const proxy = new GoatServerPaymentProxySimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair(SECRET).verify);
      const sim = new GoatPaymentGatewaySimulator({ appId: 'tenant-1', proxy, allowedOrigins: [ORIGIN], isGestureFresh: () => true });

      sim.registerAdapter({
        providerId: 'alipay',
        // Simulates: app2app returns, native re-checks proxy state before trusting the deep link.
        processPayment: (r) => {
          const authoritative = proxy.query(r.intentId);
          if (authoritative.status === 'SUCCEEDED') return authoritative;
          return { status: 'PROCESSING', intentId: r.intentId };
        },
      });

      const req = buildRequest({ provider: 'alipay' });
      const initial = await sim.requestPayment(req, ORIGIN);
      expect(initial.status).toBe('PROCESSING');

      // PSP webhook settles the payment while the user is still in the Alipay app.
      proxy.applyWebhook('evt_alipay_settle', 'pi_1', { status: 'SUCCEEDED', intentId: 'pi_1', transactionHandle: 'txh_alipay_1' });

      // A forged/late "FAILED" webhook replay must not undo the settled payment.
      const forged = proxy.applyWebhook('evt_alipay_forged_fail', 'pi_1', { status: 'FAILED', intentId: 'pi_1' });
      expect(forged.record.status).toBe('SUCCEEDED');

      const finalState = await sim.queryPaymentStatus('pi_1');
      expect(finalState.status).toBe('SUCCEEDED');
      expect(finalState.transactionHandle).toBe('txh_alipay_1');
    });

    it('Scenario 3: Bakong KHQR — QR shown, user backgrounds the app to pay via bank app, onResume flushes the settlement', async () => {
      const proxy = new GoatServerPaymentProxySimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair(SECRET).verify);
      const sim = new GoatPaymentGatewaySimulator({ appId: 'tenant-1', proxy, allowedOrigins: [ORIGIN], isGestureFresh: () => true });

      let qrRendered = false;
      let bankAppSettled = false;
      sim.registerAdapter({
        providerId: 'bakong_khqr',
        processPayment: (r) => { qrRendered = true; return { status: 'PROCESSING', intentId: r.intentId }; },
        queryStatus: () => (bankAppSettled ? 'SUCCEEDED' : 'PROCESSING'),
      });

      const req = buildRequest({ provider: 'bakong_khqr', currency: 'KHR' });
      const initial = await sim.requestPayment(req, ORIGIN);
      expect(qrRendered).toBe(true);
      expect(initial.status).toBe('PROCESSING');

      // User leaves the app, scans the QR with their bank app, and pays.
      bankAppSettled = true;

      // App returns to foreground.
      let flushed: any = null;
      await sim.onAppResume((o) => { flushed = o; });
      expect(flushed.status).toBe('SUCCEEDED');
    });

    it('Scenario 4: PayPay decline followed by a user retry on a fresh intent succeeds', async () => {
      const proxy = new GoatServerPaymentProxySimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair(SECRET).verify);
      const sim = new GoatPaymentGatewaySimulator({ appId: 'tenant-1', proxy, allowedOrigins: [ORIGIN], isGestureFresh: () => true });

      let attempt = 0;
      sim.registerAdapter({
        providerId: 'paypay',
        processPayment: (r) => {
          attempt++;
          if (attempt === 1) return { status: 'FAILED', intentId: r.intentId, failureSubCode: 'AUTHENTICATION_FAILED' };
          return { status: 'SUCCEEDED', intentId: r.intentId, transactionHandle: 'txh_paypay_retry' };
        },
      });

      const declined = await sim.requestPayment(buildRequest({ provider: 'paypay', intentId: 'pi_paypay_1' }), ORIGIN);
      expect(declined.status).toBe('FAILED');
      expect(declined.failureSubCode).toBe('AUTHENTICATION_FAILED');

      // Mini-app backend creates a brand-new intent for the retry, per §9 (FAILED is terminal).
      const retried = await sim.requestPayment(buildRequest({ provider: 'paypay', intentId: 'pi_paypay_2' }), ORIGIN);
      expect(retried.status).toBe('SUCCEEDED');
      expect(retried.transactionHandle).toBe('txh_paypay_retry');
    });
  });
}
