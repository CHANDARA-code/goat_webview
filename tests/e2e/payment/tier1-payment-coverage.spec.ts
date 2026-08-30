/**
 * Goat WebView Task 10206 Tier 1: Feature Coverage Test Suite (F1-F12)
 *
 * Exhaustive nominal coverage of the Payment Gateway Proxy & Payment Security Gate:
 * - F1: L1 User Gesture Freshness Gate & Native Progress Overlay
 * - F2: L2 Backend Payload Integrity (signature, expiry, anti-TOCTOU)
 * - F3: L5 Origin & Gateway Domain Allowlist
 * - F4: L4 Anti-Replay, Idempotency & Mutex
 * - F5: L3 PCI-DSS Tokenization
 * - F6: Adapter Registry & Routing
 * - F7: Intent State Machine & Resumability (DISMISSED, onAppResume)
 * - F8: Server Monotonic State Engine
 * - F9: Safe Error Sub-Codes
 * - F10: React Native Bridge Pass-Through Parity
 * - F11: Flutter MethodChannel Pass-Through Parity
 * - F12: Bakong KHQR Non-Blocking Adapter Behavior
 * - F13: L5 App2App Universal/App Link Return Verification
 */

import { describe, it, expect } from '../harness/test-runner.ts';
import {
  GoatPaymentGatewaySimulator,
  GoatServerPaymentProxySimulator,
  GoatPaymentException,
  GoatPaymentErrorCode,
  ReactNativeGoatPaymentSimulator,
  FlutterGoatPaymentSimulator,
  encodeSignedPayload,
  makeTestKeyPair,
  type GoatPaymentRequest,
} from '../harness/payment-simulator.ts';

const ORIGIN = 'https://tenant-1.appassets.androidplatform.net';

function buildRequest(overrides: Partial<GoatPaymentRequest & { amount: number; expiresAt: number }> = {}, keyPair = makeTestKeyPair('tenant-1-secret')) {
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
    provider: fields.provider,
    orderId: fields.orderId,
    intentId: fields.intentId,
    amount: fields.amount,
    currency: fields.currency,
    nonce: fields.nonce,
    signedPayload,
    gatewayDomain: overrides.gatewayDomain,
  };
  return { request, keyPair };
}

function makeSimulator(overrides: Partial<{ overlayPresenter: any; allowedGatewayDomains: string[]; allowedReturnDomains: string[]; isGestureFresh: boolean }> = {}) {
  const proxy = new GoatServerPaymentProxySimulator();
  let gestureFresh = overrides.isGestureFresh ?? true;
  const sim = new GoatPaymentGatewaySimulator({
    appId: 'tenant-1',
    proxy,
    allowedOrigins: [ORIGIN],
    allowedGatewayDomains: overrides.allowedGatewayDomains,
    allowedReturnDomains: overrides.allowedReturnDomains,
    overlayPresenter: overrides.overlayPresenter,
    isGestureFresh: () => gestureFresh,
    recordUserGesture: () => { gestureFresh = true; },
  });
  return { sim, proxy };
}

export function registerTier1PaymentCoverageTests(): void {
  // ==========================================================================
  // F1: L1 User Gesture Freshness Gate & Native Progress Overlay
  // ==========================================================================
  describe('Task 10206 Tier 1 - F1: L1 Gesture Freshness Gate', () => {
    it('TC-P1-F01-01: Fresh gesture allows REQUEST_PAYMENT through immediately', async () => {
      const { sim, proxy } = makeSimulator({ isGestureFresh: true });
      proxy.registerTenantKey('tenant-1', makeTestKeyPair('tenant-1-secret').verify);
      sim.registerAdapter({ providerId: 'stripe', processPayment: (r) => ({ status: 'SUCCEEDED', intentId: r.intentId }) });
      const { request } = buildRequest();
      const outcome = await sim.requestPayment(request, ORIGIN);
      expect(outcome.status).toBe('SUCCEEDED');
    });

    it('TC-P1-F01-02: Stale gesture with no overlay rejects GESTURE_REQUIRED', async () => {
      const { sim, proxy } = makeSimulator({ isGestureFresh: false });
      proxy.registerTenantKey('tenant-1', makeTestKeyPair('tenant-1-secret').verify);
      const { request } = buildRequest();
      await expect(sim.requestPayment(request, ORIGIN)).rejects(GoatPaymentErrorCode.GESTURE_REQUIRED);
    });

    it('TC-P1-F01-03: Native overlay confirmation anchors a fresh gesture and lets the request through', async () => {
      let overlayShown = false;
      const { sim, proxy } = makeSimulator({
        isGestureFresh: false,
        overlayPresenter: async () => { overlayShown = true; return true; },
      });
      proxy.registerTenantKey('tenant-1', makeTestKeyPair('tenant-1-secret').verify);
      sim.registerAdapter({ providerId: 'stripe', processPayment: (r) => ({ status: 'SUCCEEDED', intentId: r.intentId }) });
      const { request } = buildRequest();
      const outcome = await sim.requestPayment(request, ORIGIN);
      expect(overlayShown).toBe(true);
      expect(outcome.status).toBe('SUCCEEDED');
    });

    it('TC-P1-F01-04: Overlay decline maps to PAYMENT_CANCELLED without invoking the adapter', async () => {
      let adapterCalled = false;
      const { sim, proxy } = makeSimulator({ isGestureFresh: false, overlayPresenter: async () => false });
      proxy.registerTenantKey('tenant-1', makeTestKeyPair('tenant-1-secret').verify);
      sim.registerAdapter({ providerId: 'stripe', processPayment: () => { adapterCalled = true; return { status: 'SUCCEEDED', intentId: 'pi_1' }; } });
      const { request } = buildRequest();
      await expect(sim.requestPayment(request, ORIGIN)).rejects(GoatPaymentErrorCode.PAYMENT_CANCELLED);
      expect(adapterCalled).toBe(false);
    });
  });

  // ==========================================================================
  // F2: L2 Backend Payload Integrity
  // ==========================================================================
  describe('Task 10206 Tier 1 - F2: L2 Signature Integrity, Expiry & Anti-TOCTOU', () => {
    it('TC-P1-F02-01: Tampered signature rejects PAYMENT_INTENT_INVALID', async () => {
      const { sim, proxy } = makeSimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair('tenant-1-secret').verify);
      const { request } = buildRequest();
      const tampered = { ...request, signedPayload: request.signedPayload.slice(0, -4) + 'XXXX' };
      await expect(sim.requestPayment(tampered, ORIGIN)).rejects(GoatPaymentErrorCode.PAYMENT_INTENT_INVALID);
    });

    it('TC-P1-F02-02: Expired intent rejects PAYMENT_INTENT_EXPIRED', async () => {
      const { sim, proxy } = makeSimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair('tenant-1-secret').verify);
      const { request } = buildRequest({ expiresAt: Date.now() - 1_000 });
      await expect(sim.requestPayment(request, ORIGIN)).rejects(GoatPaymentErrorCode.PAYMENT_INTENT_EXPIRED);
    });

    it('TC-P1-F02-03: JS-tampered amount after signing rejects PAYMENT_INTENT_MISMATCH (anti-TOCTOU)', async () => {
      const { sim, proxy } = makeSimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair('tenant-1-secret').verify);
      const { request } = buildRequest({ amount: 4999 });
      const tampered = { ...request, amount: 1 };
      await expect(sim.requestPayment(tampered, ORIGIN)).rejects(GoatPaymentErrorCode.PAYMENT_INTENT_MISMATCH);
    });

    it('TC-P1-F02-04: JS-supplied device key fallback is rejected when no Zone 4 key is provisioned', async () => {
      const { sim } = makeSimulator(); // no registerTenantKey call
      const { request } = buildRequest();
      await expect(sim.requestPayment(request, ORIGIN)).rejects(GoatPaymentErrorCode.PAYMENT_INTENT_INVALID);
    });

    it('TC-P1-F02-05: A signature produced by the wrong tenant secret is rejected', async () => {
      const { sim, proxy } = makeSimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair('tenant-1-secret').verify);
      const { request } = buildRequest({}, makeTestKeyPair('attacker-secret'));
      await expect(sim.requestPayment(request, ORIGIN)).rejects(GoatPaymentErrorCode.PAYMENT_INTENT_INVALID);
    });
  });

  // ==========================================================================
  // F3: L5 Origin & Gateway Domain Allowlist
  // ==========================================================================
  describe('Task 10206 Tier 1 - F3: L5 Origin & Gateway Allowlist', () => {
    it('TC-P1-F03-01: Disallowed caller origin rejects ORIGIN_NOT_ALLOWED', async () => {
      const { sim, proxy } = makeSimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair('tenant-1-secret').verify);
      const { request } = buildRequest();
      await expect(sim.requestPayment(request, 'https://evil.example.com')).rejects(GoatPaymentErrorCode.ORIGIN_NOT_ALLOWED);
    });

    it('TC-P1-F03-02: Disallowed gateway domain rejects GATEWAY_NOT_ALLOWED', async () => {
      const { sim, proxy } = makeSimulator({ allowedGatewayDomains: ['checkout.stripe.com'] });
      proxy.registerTenantKey('tenant-1', makeTestKeyPair('tenant-1-secret').verify);
      const { request } = buildRequest({ gatewayDomain: 'phishing.example.com' });
      await expect(sim.requestPayment(request, ORIGIN)).rejects(GoatPaymentErrorCode.GATEWAY_NOT_ALLOWED);
    });

    it('TC-P1-F03-03: An allowlisted gateway domain passes through cleanly', async () => {
      const { sim, proxy } = makeSimulator({ allowedGatewayDomains: ['checkout.stripe.com'] });
      proxy.registerTenantKey('tenant-1', makeTestKeyPair('tenant-1-secret').verify);
      sim.registerAdapter({ providerId: 'stripe', processPayment: (r) => ({ status: 'SUCCEEDED', intentId: r.intentId }) });
      const { request } = buildRequest({ gatewayDomain: 'checkout.stripe.com' });
      const outcome = await sim.requestPayment(request, ORIGIN);
      expect(outcome.status).toBe('SUCCEEDED');
    });
  });

  // ==========================================================================
  // F4: L4 Anti-Replay, Idempotency & Mutex
  // ==========================================================================
  describe('Task 10206 Tier 1 - F4: L4 Idempotency & Mutex', () => {
    it('TC-P1-F04-01: Concurrent duplicate REQUEST_PAYMENT calls reject the second with PAYMENT_IN_PROGRESS', async () => {
      const { sim, proxy } = makeSimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair('tenant-1-secret').verify);
      sim.registerAdapter({
        providerId: 'stripe',
        processPayment: async (r) => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          return { status: 'SUCCEEDED', intentId: r.intentId };
        },
      });
      const { request } = buildRequest();
      const first = sim.requestPayment(request, ORIGIN);
      await new Promise((resolve) => setTimeout(resolve, 5));
      await expect(sim.requestPayment(request, ORIGIN)).rejects(GoatPaymentErrorCode.PAYMENT_IN_PROGRESS);
      const firstResult = await first;
      expect(firstResult.status).toBe('SUCCEEDED');
    });

    it('TC-P1-F04-02: A repeated bridge call for an already-terminal intent returns the cached outcome without recharging', async () => {
      const { sim, proxy } = makeSimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair('tenant-1-secret').verify);
      let processCalls = 0;
      sim.registerAdapter({ providerId: 'stripe', processPayment: (r) => { processCalls++; return { status: 'SUCCEEDED', intentId: r.intentId }; } });
      const { request } = buildRequest();
      await sim.requestPayment(request, ORIGIN);
      const second = await sim.requestPayment(request, ORIGIN);
      expect(second.status).toBe('SUCCEEDED');
      expect(processCalls).toBe(1);
    });

    it('TC-P1-F04-03: A server-side claim conflict returns the prior outcome without invoking the adapter', async () => {
      const { sim, proxy } = makeSimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair('tenant-1-secret').verify);
      proxy.claim('pi_1');
      proxy.confirm('pi_1', { status: 'SUCCEEDED', intentId: 'pi_1', transactionHandle: 'txh_prior' });
      let adapterCalled = false;
      sim.registerAdapter({ providerId: 'stripe', processPayment: () => { adapterCalled = true; return { status: 'SUCCEEDED', intentId: 'pi_1' }; } });
      const { request } = buildRequest();
      const outcome = await sim.requestPayment(request, ORIGIN);
      expect(outcome.transactionHandle).toBe('txh_prior');
      expect(adapterCalled).toBe(false);
    });
  });

  // ==========================================================================
  // F5: L3 PCI-DSS Tokenization
  // ==========================================================================
  describe('Task 10206 Tier 1 - F5: L3 Tokenization & Credential Isolation', () => {
    it('TC-P1-F05-01: The adapter receives a native-minted ephemeral client token, never null', async () => {
      const { sim, proxy } = makeSimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair('tenant-1-secret').verify);
      let seenToken: string | undefined;
      sim.registerAdapter({ providerId: 'stripe', processPayment: (r) => { seenToken = r.ephemeralClientToken; return { status: 'SUCCEEDED', intentId: r.intentId }; } });
      const { request } = buildRequest();
      await sim.requestPayment(request, ORIGIN);
      expect(seenToken).toBeDefined();
      expect(seenToken).toContain('pi_1');
    });

    it('TC-P1-F05-02: The bridge request schema carries no raw card fields', () => {
      const { request } = buildRequest();
      const keys = Object.keys(request);
      expect(keys).not.toContain('cardNumber');
      expect(keys).not.toContain('cvv');
      expect(keys).not.toContain('apiSecretKey');
    });
  });

  // ==========================================================================
  // F6: Adapter Registry & Routing
  // ==========================================================================
  describe('Task 10206 Tier 1 - F6: Adapter Registry & Routing', () => {
    it('TC-P1-F06-01: An unregistered provider rejects PROVIDER_NOT_REGISTERED', async () => {
      const { sim, proxy } = makeSimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair('tenant-1-secret').verify);
      const { request } = buildRequest({ provider: 'unknown_psp' });
      await expect(sim.requestPayment(request, ORIGIN)).rejects(GoatPaymentErrorCode.PROVIDER_NOT_REGISTERED);
    });

    it('TC-P1-F06-02: Registering a second adapter under a built-in providerId without allowOverride throws', () => {
      const { sim } = makeSimulator();
      sim.registerAdapter({ providerId: 'stripe', processPayment: () => ({ status: 'SUCCEEDED', intentId: 'pi_1' }) });
      expect(() => {
        sim.registerAdapter({ providerId: 'stripe', processPayment: () => ({ status: 'SUCCEEDED', intentId: 'pi_1' }) });
      }).toThrow();
    });

    it('TC-P1-F06-03: A custom, non-built-in provider registers and routes correctly', async () => {
      const { sim, proxy } = makeSimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair('tenant-1-secret').verify);
      sim.registerAdapter({ providerId: 'custom_wallet', processPayment: (r) => ({ status: 'SUCCEEDED', intentId: r.intentId, providerRef: 'custom_ref' }) });
      const { request } = buildRequest({ provider: 'custom_wallet' });
      const outcome = await sim.requestPayment(request, ORIGIN);
      expect(outcome.providerRef).toBe('custom_ref');
    });
  });

  // ==========================================================================
  // F7: Intent State Machine & Resumability
  // ==========================================================================
  describe('Task 10206 Tier 1 - F7: State Machine & Resumability', () => {
    it('TC-P1-F07-01: DISMISSED is non-terminal — the intent stays retryable', async () => {
      const { sim, proxy } = makeSimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair('tenant-1-secret').verify);
      sim.registerAdapter({ providerId: 'stripe', processPayment: (r) => ({ status: 'DISMISSED', intentId: r.intentId }) });
      const { request } = buildRequest();
      const outcome = await sim.requestPayment(request, ORIGIN);
      expect(outcome.status).toBe('DISMISSED');
    });

    it('TC-P1-F07-02: onAppResume flushes a backgrounded pending intent to a terminal state', async () => {
      const { sim, proxy } = makeSimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair('tenant-1-secret').verify);
      let queryResult: any = 'PROCESSING';
      sim.registerAdapter({
        providerId: 'bakong_khqr',
        processPayment: (r) => ({ status: 'PROCESSING', intentId: r.intentId }),
        queryStatus: () => queryResult,
      });
      const { request } = buildRequest({ provider: 'bakong_khqr' });
      await sim.requestPayment(request, ORIGIN);

      let asyncOutcome: any = null;
      queryResult = 'SUCCEEDED';
      await sim.onAppResume((o) => { asyncOutcome = o; });
      expect(asyncOutcome.status).toBe('SUCCEEDED');
    });
  });

  // ==========================================================================
  // F8: Server Monotonic State Engine
  // ==========================================================================
  describe('Task 10206 Tier 1 - F8: Server Monotonic State Engine', () => {
    it('TC-P1-F08-01: A SUCCEEDED intent cannot be downgraded by a subsequent client CANCELLED', async () => {
      const { sim, proxy } = makeSimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair('tenant-1-secret').verify);
      sim.registerAdapter({ providerId: 'stripe', processPayment: (r) => ({ status: 'SUCCEEDED', intentId: r.intentId }) });
      const { request } = buildRequest();
      await sim.requestPayment(request, ORIGIN);
      const cancelled = await sim.cancelPayment('pi_1');
      expect(cancelled.status).toBe('SUCCEEDED');
    });

    it('TC-P1-F08-02: A PSP webhook charge.succeeded overrides a provisional client-sent CANCELLED', async () => {
      const { proxy } = makeSimulator();
      proxy.confirm('pi_2', { status: 'CANCELLED', intentId: 'pi_2' });
      const { record } = proxy.applyWebhook('evt_1', 'pi_2', { status: 'SUCCEEDED', intentId: 'pi_2', transactionHandle: 'txh_settled' });
      expect(record.status).toBe('SUCCEEDED');
    });

    it('TC-P1-F08-03: A replayed webhook eventId does not double-apply', () => {
      const { proxy } = makeSimulator();
      proxy.applyWebhook('evt_dup', 'pi_3', { status: 'SUCCEEDED', intentId: 'pi_3' });
      const second = proxy.applyWebhook('evt_dup', 'pi_3', { status: 'FAILED', intentId: 'pi_3' });
      expect(second.applied).toBe(false);
      expect(second.record.status).toBe('SUCCEEDED');
    });
  });

  // ==========================================================================
  // F9: Safe Error Sub-Codes
  // ==========================================================================
  describe('Task 10206 Tier 1 - F9: Safe Error Sub-Codes', () => {
    it('TC-P1-F09-01: A declined card FAILED outcome carries a safe, actionable sub-code', async () => {
      const { sim, proxy } = makeSimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair('tenant-1-secret').verify);
      sim.registerAdapter({
        providerId: 'stripe',
        processPayment: (r) => ({ status: 'FAILED', intentId: r.intentId, failureSubCode: 'CARD_DECLINED_INSUFFICIENT_FUNDS' }),
      });
      const { request } = buildRequest();
      const outcome = await sim.requestPayment(request, ORIGIN);
      expect(outcome.status).toBe('FAILED');
      expect(outcome.failureSubCode).toBe('CARD_DECLINED_INSUFFICIENT_FUNDS');
    });

    it('TC-P1-F09-02: GoatPaymentException instances always carry a stable machine-readable code', async () => {
      const { sim } = makeSimulator({ isGestureFresh: false });
      const { request } = buildRequest();
      try {
        await sim.requestPayment(request, ORIGIN);
        throw new Error('should have thrown');
      } catch (e) {
        expect(e instanceof GoatPaymentException).toBe(true);
        expect((e as GoatPaymentException).code).toBe(GoatPaymentErrorCode.GESTURE_REQUIRED);
      }
    });
  });

  // ==========================================================================
  // F10 & F11: React Native & Flutter Pass-Through Parity
  // ==========================================================================
  describe('Task 10206 Tier 1 - F10/F11: Cross-Platform Bridge Pass-Through Parity', () => {
    it('TC-P1-F10-01: React Native wrapper marshals REQUEST_PAYMENT to native with zero client-side gate logic', () => {
      const rn = new ReactNativeGoatPaymentSimulator();
      const result = rn.handleAction('REQUEST_PAYMENT');
      expect(result.forwardedToNative).toBe(true);
    });

    it('TC-P1-F11-01: Flutter MethodChannel wrapper marshals CANCEL_PAYMENT to native with zero client-side gate logic', () => {
      const flutter = new FlutterGoatPaymentSimulator();
      const result = flutter.handleAction('CANCEL_PAYMENT');
      expect(result.forwardedToNative).toBe(true);
    });
  });

  // ==========================================================================
  // F12: Bakong KHQR Non-Blocking Adapter Behavior
  // ==========================================================================
  describe('Task 10206 Tier 1 - F12: Bakong KHQR Non-Blocking Adapter Behavior', () => {
    it('TC-P1-F12-01: processPayment returns PROCESSING immediately after rendering the QR, without blocking on settlement', async () => {
      const { sim, proxy } = makeSimulator();
      proxy.registerTenantKey('tenant-1', makeTestKeyPair('tenant-1-secret').verify);
      let qrShown = false;
      sim.registerAdapter({
        providerId: 'bakong_khqr',
        processPayment: (r) => { qrShown = true; return { status: 'PROCESSING', intentId: r.intentId }; },
      });
      const { request } = buildRequest({ provider: 'bakong_khqr' });
      const outcome = await sim.requestPayment(request, ORIGIN);
      expect(qrShown).toBe(true);
      expect(outcome.status).toBe('PROCESSING');
    });
  });

  // ==========================================================================
  // F13: L5 App2App Universal/App Link Return Verification
  // ==========================================================================
  describe('Task 10206 Tier 1 - F13: App2App Universal/App Link Return Verification', () => {
    it('TC-P1-F13-01: A verified HTTPS return link on an allowlisted domain re-checks the proxy and resolves to the terminal outcome', async () => {
      const { sim, proxy } = makeSimulator({ allowedReturnDomains: ['pay.tenant-1.com'] });
      proxy.registerTenantKey('tenant-1', makeTestKeyPair('tenant-1-secret').verify);
      sim.registerAdapter({ providerId: 'alipay', processPayment: (r) => ({ status: 'PROCESSING', intentId: r.intentId }) });
      const { request } = buildRequest({ provider: 'alipay' });
      await sim.requestPayment(request, ORIGIN);
      proxy.confirm('pi_1', { status: 'SUCCEEDED', intentId: 'pi_1', transactionHandle: 'txh_return' });

      const outcome = await sim.handleReturnUrl('https://pay.tenant-1.com/payment/return?intentId=pi_1');

      expect(outcome?.status).toBe('SUCCEEDED');
      expect(outcome?.transactionHandle).toBe('txh_return');
    });

    it('TC-P1-F13-02: A legacy unverified custom-scheme return is silently ignored, even on an allowlisted host', async () => {
      const { sim, proxy } = makeSimulator({ allowedReturnDomains: ['pay.tenant-1.com'] });
      proxy.confirm('pi_forged', { status: 'SUCCEEDED', intentId: 'pi_forged' });

      const outcome = await sim.handleReturnUrl('goat://pay.tenant-1.com/payment/return?intentId=pi_forged');

      expect(outcome).toBeUndefined();
    });

    it('TC-P1-F13-03: A return link on a non-allowlisted domain is rejected', async () => {
      const { sim } = makeSimulator({ allowedReturnDomains: ['pay.tenant-1.com'] });
      const outcome = await sim.handleReturnUrl('https://evil.example.com/return?intentId=pi_1');
      expect(outcome).toBeUndefined();
    });

    it('TC-P1-F13-04: A return link is rejected outright when no allowedReturnDomains are configured', async () => {
      const { sim } = makeSimulator();
      const outcome = await sim.handleReturnUrl('https://pay.tenant-1.com/payment/return?intentId=pi_1');
      expect(outcome).toBeUndefined();
    });
  });
}
