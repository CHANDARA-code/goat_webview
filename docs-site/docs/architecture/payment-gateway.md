---
sidebar_position: 8
title: Payment Gateway Proxy
---

# Payment Gateway Proxy & Security Gate Architecture

The **Goat Payment Gateway Proxy** lets mini-apps execute real-money checkouts — Alipay, Stripe, Stripe Link, PayPay, and Bakong KHQR, plus host-registered custom adapters — without ever letting untrusted mini-app JavaScript touch card data, provider secrets, or an unverified payment decision. Every `REQUEST_PAYMENT` bridge call passes through a 5-layer native **Payment Security Gate** before any provider SDK is invoked, and the **Server Payment Proxy** is the sole source of truth for terminal payment state.

---

## Threat Model

A mini-app is untrusted code running in a sandboxed web context. Left unconstrained, it could:
1. Call `REQUEST_PAYMENT` with no genuine user tap, moving money silently in the background.
2. Replay a previously valid signed intent, or fire the same intent twice concurrently, to double-charge.
3. Tamper with the JS-visible `amount`/`currency` fields after a backend has signed a lower/different amount (TOCTOU).
4. Supply its own "public key" inside the bridge payload to forge a fake backend approval.
5. Spoof a client-side cancellation after a payment has actually settled, to trick a merchant backend into believing a charge failed.

None of these are mitigated by trusting the web context — they are mitigated structurally: the only path from Zone 0 (mini-app JS) to money is through Zone 1 (the native gate), and Zone 1 runs all 5 layers before the payment adapter is ever called.

---

## Trust Zones

```
Zone 0  Mini-App Web Context (UNTRUSTED)          — holds only opaque intentId, amount, currency, signedPayload
Zone 1  Native Bridge + Payment Security Gate      — L1-L5, TRUSTED, host app process
Zone 2  Payment Adapters (Alipay/Stripe/Link/PayPay/Bakong + custom)  — TRUSTED, host-registered only
Zone 3  Provider surfaces (Stripe PaymentSheet, Alipay/PayPay app2app, Bakong bank apps)  — EXTERNAL
Zone 4  Goat Server Payment Proxy (packages/server)  — TRUSTED backend, holds PSP secrets in KMS/HSM
Zone 5  Mini-app developer backend                 — SEMI-TRUSTED, signs payment intents
Zone 6  PSP backends (Stripe, Alipay, PayPay, NBC Bakong)
```

The mini-app backend (Zone 5) creates an intent via the proxy, signs its canonical fields with its own Ed25519/ECDSA key, and relays the signed payload to the mini-app. Native (Zone 1) verifies that signature against a public key it fetches **out-of-band** from the proxy's tenant key directory — never from the bridge payload itself.

---

## The Payment Security Gate — Layer by Layer

| Layer | Responsibility | Hard-fails with |
| :--- | :--- | :--- |
| **L1** | User gesture freshness (10s window) + native progress/confirmation overlay, so a >10s backend round trip doesn't falsely reject a real tap. The overlay's own confirmation tap counts as a fresh gesture. | `GESTURE_REQUIRED`, `PAYMENT_CANCELLED` |
| **L2** | Backend payload integrity: Ed25519/ECDSA-P256 signature verified against a Zone-4-provisioned public key (never JS-supplied, never a device-derived fallback); expiry check; anti-TOCTOU comparison of JS-visible fields against the signed truth. | `PAYMENT_INTENT_INVALID`, `PAYMENT_INTENT_EXPIRED`, `PAYMENT_INTENT_MISMATCH` |
| **L3** | PCI-DSS tokenization: the bridge schema is a closed field allowlist; the adapter receives only an ephemeral, single-intent client token minted server-side — never a PSP secret, never raw card data. | — |
| **L4** | Anti-replay & idempotency: an in-memory per-`intentId` mutex rejects concurrent duplicate bridge calls; the server's `claim` call is the authoritative first-caller-wins race. | `PAYMENT_IN_PROGRESS` |
| **L5** | Origin & gateway allowlist: caller frame origin must be the sandboxed virtual origin; any PSP-hosted checkout redirect target must be in `manifest.security.paymentGateways`. App2app return navigation (Alipay/PayPay) is only trusted when it arrives as an HTTPS Universal Link (iOS) / App Link (Android) on a host-allowlisted domain — a legacy custom-scheme return (`goat://`, `alipays://`) is silently ignored, never trusted. | `ORIGIN_NOT_ALLOWED`, `GATEWAY_NOT_ALLOWED` |

A payment with no registered adapter fails `PROVIDER_NOT_REGISTERED` after L1-L5 pass but before any adapter code runs.

---

## Bridge Contract

```json
// REQUEST_PAYMENT
{
  "provider": "stripe",
  "orderId": "order_8842",
  "intentId": "pi_goat_a1b2c3",
  "amount": 4999,
  "currency": "USD",
  "nonce": "9f2c…64hex",
  "signedPayload": "base64(canonical).base64(signature)"
}
```

Success/dismissal resolve as bridge data (`status: "SUCCEEDED" | "DISMISSED"`); `FAILED`/`CANCELLED` surface as a bridge error carrying a stable `code` and, where actionable, a safe `subCode` (`CARD_DECLINED_INSUFFICIENT_FUNDS`, `CARD_EXPIRED`, `AUTHENTICATION_FAILED`, `NETWORK_TIMEOUT`, `STUCK_PAYMENT_WATCHDOG_RELEASED`) — never a raw PSP error message that could leak sensitive detail.

---

## Intent State Machine

```
CREATED -> CLAIMED -> PROCESSING -> SUCCEEDED / FAILED / CANCELLED / EXPIRED
                        │
                        └──► DISMISSED (non-terminal — intent stays CLAIMED, retryable)
```

**Monotonic rule:** once an intent reaches `SUCCEEDED`, that state is immutable. A client-sent `CANCELLED` cannot downgrade it, and a `charge.failed` webhook arriving after settlement is ignored. Conversely, a PSP webhook `charge.succeeded` **overrides** a provisional client-side `CANCELLED` — the server, not the device, is the source of truth.

---

## Component Responsibilities

- **`GoatPaymentGatewayManager`** (Android `object`-style manager / iOS `final class`) — owns the adapter registry, the per-`intentId` lock map, the L1-L5 gate, a 45s in-flight watchdog that auto-releases orphaned locks, and a background 1s/3s Bakong KHQR poller that runs independently of any single bridge call's watchdog window. `handleReturnUrl` is the host-facing entry point for app2app return navigation — call it from the host's Universal Link / App Link handler (`application(_:continue:restorationHandler:)` on iOS, `onNewIntent` on Android), mirroring `GoatOAuthSessionManager.handleRedirectUri`.
- **`GoatPaymentAdapter`** SPI — `processPayment` / `queryStatus` / `cancelPayment`. Built-in adapters live behind zero-bloat feature modules (`android/feature-payments-{stripe,alipay,paypay,bakong}`, flat Swift files on iOS); custom adapters register only via host application startup code — never from mini-app JS.
- **Server Payment Proxy** (`packages/server/src/payments/`) — `payments.controller.ts` (`POST /pay/intents`, `/claim`, `/client-token`, `/confirm`, `/cancel`, `GET /pay/intents/:id`), `tenant-keys.controller.ts` (Zone 4 public key directory), `payments-webhook.controller.ts` (PSP webhook reconciliation with dedupe + monotonic transitions), and one `PaymentDriver` per PSP holding that PSP's secret.

---

## Cross-Platform Parity

| Platform | Gate + manager | Adapter SPI |
| :--- | :--- | :--- |
| Android | `GoatPaymentGatewayManager.kt` in `android/core`, mutex via `kotlinx.coroutines.sync.Mutex` | `GoatPaymentAdapter` (Kotlin `interface`, `suspend`) |
| iOS | `GoatPaymentGatewayManager.swift`, lock via `NSLock`-guarded set, timeout via `withThrowingTaskGroup` | `GoatPaymentAdapter` (`protocol`, `async throws`) |
| React Native | `@goat-webview/payments` — pass-through only | Host registers native adapters |
| Flutter | `goat_webview_payments` — `MethodChannel` pass-through only | Host registers native adapters |

The web/JS layers on every platform never implement gate logic — they only marshal `REQUEST_PAYMENT` / `QUERY_PAYMENT_STATUS` / `CANCEL_PAYMENT` calls through to the native manager described above.

---

## Test Strategy

- **Native unit tests** (`GoatPaymentGatewayManagerTest.kt`, `GoatPaymentGatewayManagerTests.swift`, plus one test file per built-in adapter): layer isolation, mutex/watchdog behavior, DISMISSED non-terminal handling, KHQR background polling, monotonic state.
- **Server tests** (`payments.spec.ts`, `payments-security-adversarial.spec.ts`): REST contract, claim races, webhook dedupe, monotonic transitions, KHQR EMV-QR builder correctness.
- **4-Tier E2E opaque-box suite** (`tests/e2e/payment/`): feature coverage, boundary/corner cases, cross-feature interactions, and real-world SuperApp checkout scenarios across all four platforms' documented contract.
