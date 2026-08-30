# Payment Gateway Proxy & Payment Security Gate — Architecture

**Task:** 10206 · `adaptableServerPaymentGatewayAndSecurityGate`  
**Category / Phase:** Bridge APIs / Payments · P1 · Phase 10 (Source-Verified II)  
**Status:** Architecture Specification (Enhanced & Hardened)  
**Author:** leavchandara · 2026-08-28 (Enhanced 2026-08-28)  

> Purpose of this document: define the architecture *before* code, and give an honest
> assessment of how strong the design is — where it is robust, where it depends on a
> decision, and where a residual risk is accepted.

---

## 1. Scope

### In scope
- Native **payment gateway proxy manager** (`GoatPaymentGatewayManager`) + pluggable **SPI** (`GoatPaymentAdapter`).
- **Built-in adapters:** Alipay, Stripe, Stripe Link, PayPay, Bakong KHQR.
- **Developer-authored custom adapters** via `registerAdapter(adapter)` (host app compile-time only).
- **Payment Security Gate** — 5 independent layers, each a hard stop.
- **Server Payment Proxy** (`packages/server`) — holds PSP secrets, receives webhooks, is the source of truth for intent state, enforces anti-replay / idempotency, and provisions tenant public keys.
- Bridge actions: `REQUEST_PAYMENT`, `QUERY_PAYMENT_STATUS`, `CANCEL_PAYMENT`.
- Cross-platform parity: Android, iOS, React Native, Flutter.

### Out of scope (v1)
- Refunds, disputes, chargebacks, partial capture, multi-capture.
- Recurring / subscription billing schedules (single `PaymentIntent` per request only).
- Storing a merchant's PSP account credentials on-device (never — see §7 L3).
- Dynamic loading of payment adapters from mini-app JS or remote scripts (strictly prohibited).
- Replacing the existing `IAP_PURCHASE` / `OPEN_INVOICE` digital-goods path (Task 10121); this task is the *external payment rail*, IAP stays for store-billed digital goods.

---

## 2. Design goals & non-goals

| Goal | How it shows up in the design |
| :--- | :--- |
| **Untrusted web context can never move money silently** | Every state-changing call passes the gesture gate + signed-intent gate + native progress/confirmation overlay before any SDK is touched. |
| **PCI-DSS scope stays at SAQ-A / SAQ-A-EP** | Card data entry UI is always PSP-owned; the bridge IPC schema is a strict field allowlist; PAN/CVV/secret keys are structurally unable to cross the JS thread. |
| **No PSP secret on the device** | Secret API keys live only in the Server Payment Proxy (KMS/HSM). The device receives ephemeral, single-intent client tokens. |
| **Server is the source of truth (Monotonic State)** | Native "success" or "cancel" is provisional; terminal intent state is strictly owned by the proxy (which reconciles PSP webhooks). `SUCCEEDED` is immutable. |
| **Adapters are swappable without touching core** | SPI mirrors the proven `GoatBridgePlugin` model already shipping across 6 feature modules and 4 platforms. |
| **Defense in depth** | 5 layers are independent: breaking one does not open the path. Thread-safe in-memory mutexes prevent concurrent execution races. |
| **Smooth User & Developer Experience** | Instant native progress overlay prevents UI freeze; safe actionable error sub-codes give mini-apps UI recovery paths; KHQR features instant `onResume` lifecycle refresh. |

**Non-goals:** being a PSP, custom card vaulting, offline payments, and being "provider-agnostic" at the *protocol* level (each adapter owns its provider's quirks — the manager only owns the security envelope).

---

## 3. Threat model

### Assets
1. Movement of real funds (authorization + capture).
2. PSP secret API keys and webhook signing secrets.
3. Cardholder data (PAN, CVV, expiry) — must never be in Goat's scope.
4. The mini-app's payment-intent signing key.
5. Transaction integrity: amount, currency, order binding.

### Attacker capabilities assumed
- **A1 — Malicious / compromised mini-app JS.** Full control of the web context, can call any bridge action with any payload, can race and replay, can spoof `origin` fields inside the payload body, can lie about `amount`.
- **A2 — Network attacker (MITM).** Can observe/modify traffic not protected by TLS + pinning; can attempt DNS rebinding.
- **A3 — Malicious deep-link responder.** Registers a scheme and tries to feed a forged "payment succeeded" return URL or intercept custom schemes.
- **A4 — Replaying client.** Re-sends a previously valid, signed `REQUEST_PAYMENT` (same device, another device, after reinstall).
- **A5 — Malicious custom adapter author.** Ships a `GoatPaymentAdapter` that tries to exfiltrate tokens, block the thread, or call host internals.
- **A6 — Local attacker with device clock control.** Shifts wall-clock to defeat freshness / expiry windows.
- **A7 — Compromised PSP-hosted checkout page** loaded in a WebView.
- **A8 — Concurrent double-bridge caller.** Rapidly invokes `REQUEST_PAYMENT` twice simultaneously to race native network calls before `/claim` completes.
- **A9 — Spoofed client cancellation.** Client sends `POST /confirm (CANCELLED)` right after authorizing in a bank app to trick the merchant backend while funds were captured.

### Explicitly out of model
- A rooted/jailbroken device with a live debugger attached to the host process (host-process compromise is game over for any in-process design).
- A compromised Server Payment Proxy (its own hardening is a separate track).

---

## 4. Trust zones & high-level architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  ZONE 0 — Mini-App Web Context  (goat:// / https://*.appassets.androidplatform.net)       │
│  UNTRUSTED. Holds only: opaque intentId, amount, currency, orderId, nonce, signedPayload  │
└───────────────────────────────┬──────────────────────────────────────────────────────────┘
                                │  Bridge IPC  (strict field allowlist — §8)
                                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  ZONE 1 — Native Bridge + PAYMENT SECURITY GATE   (host app process, TRUSTED)             │
│                                                                                          │
│   GoatBridgeActionHandler.executeAction("REQUEST_PAYMENT", payload)                       │
│        │                                                                                  │
│        ├─ Thread-Safe Mutex Lock (ConcurrentHashMap<intentId, Mutex>)                     │
│        ├─ L1  User Gesture Freshness Gate & Native Progress Overlay                       │
│        ├─ L5  Origin & Gateway Domain Allowlist (HTTPS Universal / App Links required)    │
│        ├─ L2  Backend Payload Integrity (Asymmetric ECDSA/Ed25519 via Server-Provisioned Key)│
│        ├─ L4  Anti-Replay + Idempotency (local store + server claim — authoritative)      │
│        └─ L3  Tokenization & Credential Isolation (ephemeral client token, memory only)   │
│        │                                                                                  │
│        ▼                                                                                  │
│   GoatPaymentGatewayManager.route(request)                                                │
└───────────────────────────────┬──────────────────────────────────────────────────────────┘
                                │  adapter.processPayment(...)  in isolated CoroutineScope
                                ▼
┌───────────────────────────────────────────────┐   ┌──────────────────────────────────────┐
│  ZONE 2 — Payment Adapters  (in-process,       │   │  ZONE 3 — Provider surfaces (EXTERNAL)│
│  TRUSTED, host-registered, capability-scoped) │   │  - Stripe PaymentSheet / StoreKit    │
│  built-in: Alipay·Stripe·Link·PayPay·KHQR      │──►│  - Alipay / PayPay app2app deep link │
│  + host-registered GoatPaymentAdapter SPI      │   │  - Bakong KHQR QR + bank apps        │
│                                               │   │  - Allowlisted PSP-hosted checkout URL│
└───────────────────────────────┬───────────────┘   └──────────────────────────────────────┘
                                │  confirm / claim / client-token  (mTLS + pinning)
                                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  ZONE 4 — Goat Server Payment Proxy   (packages/server, TRUSTED backend)                  │
│  - Holds PSP secret keys in KMS/HSM (never leaves)                                        │
│  - Provisions & caches Zone 5 Tenant Public Keys (out-of-band directory)                 │
│  - Creates PSP PaymentIntents; mints ephemeral client tokens                             │
│  - Monotonic state engine (SUCCEEDED is immutable) + idempotency ledger                  │
│  - Normalizes + forwards webhooks to the mini-app developer backend (Zone 5)             │
└───────┬──────────────────────────────────────────────────────────────────┬───────────────┘
        │ create/confirm                                                   │ webhook (PSP-signed)
        ▼                                                                  ▼
┌───────────────────────┐                                    ┌────────────────────────────────┐
│ ZONE 5 — Mini-App dev │  signs payment intent with key;    │ ZONE 6 — PSP backends          │
│ backend (SEMI-TRUSTED)│  public key registered in Zone 4   │ Stripe · Alipay · PayPay · NBC │
└───────────────────────┘                                    │ Bakong                          │
                                                             └────────────────────────────────┘
```

**Key structural property:** the only path from Zone 0 to money is through Zone 1, and Zone 1
runs all 5 layers before `GoatPaymentGatewayManager.route` is ever called. There is no
"fast path", no bypass action, and no free-form field the web context can use to smuggle data.

---

## 5. Component responsibilities

### 5.1 `GoatPaymentGatewayManager` (core, per platform)
- Owns adapter registry (`ConcurrentHashMap<providerId, GoatPaymentAdapter>`), built-ins pre-registered, custom via `registerAdapter` (host app code only).
- Owns **in-memory thread-safe mutex map** (`ConcurrentHashMap<intentId, Mutex>`) to block concurrent double-bridge calls (A8).
- Owns **Native Progress / Confirmation Overlay** management, anchoring native user gestures and showing instant visual feedback.
- Owns an **In-Flight Watchdog Timer** (45 s default) to auto-release stuck `PAYMENT_IN_PROGRESS` locks.
- Listens to **App Lifecycle Events (`onResume`)** to trigger immediate status query flushes for backgrounded app2app/KHQR payments.
- Owns the **payment intent state machine** (§9) and local idempotency store.
- Talks to the Server Payment Proxy (claim → client-token → confirm).
- Never returns tokens/secrets to the bridge — only the normalized outcome or safe error sub-code.

### 5.2 `GoatPaymentAdapter` SPI
```kotlin
interface GoatPaymentAdapter {
    val providerId: String                       // "alipay", "stripe", "link", "paypay", "bakong_khqr", or custom

    suspend fun processPayment(request: GoatPaymentRequest, ctx: GoatPaymentContext): GoatPaymentOutcome
    suspend fun queryStatus(intentId: String, ctx: GoatPaymentContext): GoatPaymentStatus
    suspend fun cancelPayment(intentId: String, ctx: GoatPaymentContext): GoatPaymentStatus
}
```
- `GoatPaymentRequest` carries only tokenized/opaque fields (§8) plus the *proxy-issued* ephemeral client token, injected by the manager (not by JS).
- `GoatPaymentContext` is a **capability-scoped** object: presenter handle for native sheets, an outbound HTTP client already bound to the allowlist + pinning, a structured logger. It deliberately does **not** expose `GoatSecureStorageManager`, the tenant signing key, or arbitrary `Context`/`Activity`.
- **Registration Rules:**
  - `GoatPaymentGatewayManager.registerAdapter(adapter)` is strictly callable **only by host application code during application startup**.
  - Mini-apps are **strictly forbidden** from registering adapters dynamically via JS or reflection.
  - Contract enforced: non-blank unique `providerId`, not shadowing a built-in unless `allowOverride = true`, methods must be `suspend` (no blocking the caller).

### 5.3 Built-in adapters

| Adapter | Native mechanism | Card data touches Goat? | UX & Resumability Details |
| :--- | :--- | :--- | :--- |
| **Stripe** | Stripe Android/iOS SDK `PaymentSheet` with an ephemeral client secret minted by proxy | No — PSP-owned UI | Sheet dismissal yields `DISMISSED` (intent stays `CLAIMED` for retry). Hard cancel yields `CANCELLED`. |
| **Stripe Link** | Same Stripe SDK; Link inside `PaymentSheet`, or allowlisted hosted redirect | No | HTTPS Universal/App Links enforced for redirect return. |
| **Alipay** | Alipay SDK `PayTask` (Android) / `AlipaySDK` (iOS) or `alipays://` deep link | No | Result re-verified via proxy (`/confirm`), never trusted from deep-link params. |
| **PayPay** | PayPay OPA SDK / `paypay://` app2app deep link; OPA payment created server-side | No | Same deep-link re-verification rule + Universal Links return. |
| **Bakong KHQR** | Proxy generates NBC KHQR string; native renders QR sheet + polls `queryStatus` | No card rail | Polling: 1s for first 15s, 3s thereafter. Triggers immediate `queryStatus` on app `onResume`. |

Built-in adapters live in **separate feature modules** (`android/feature-payments-*`, iOS SPM targets, `packages/*`) so a host links only the PSPs it uses — the zero-bloat split established by Task 10202.

### 5.4 Server Payment Proxy (`packages/server/src/payments/`)
- `payments.controller.ts` — `POST /pay/intents` (create), `POST /pay/intents/:id/claim`, `GET /pay/intents/:id/client-token`, `POST /pay/intents/:id/confirm`, `POST /pay/intents/:id/cancel`, `GET /pay/intents/:id`.
- `tenant-keys.controller.ts` — Out-of-band directory servicing Zone 1's public key lookups for Zone 5 tenants.
- `payments-webhook.controller.ts` — one route per PSP; verifies PSP signature, dedupes by PSP event id, enforces **monotonic state updates**, normalizes, forwards to mini-app backend callback URL.
- `payments-idempotency.service.ts` — authoritative ledger keyed by `(tenantAppId, idempotencyKey)` → terminal result; TTL'd nonce table.
- `drivers/` — server drivers holding secret keys in KMS/HSM (Stripe, Alipay, PayPay, Bakong).

> **Reference-implementation status (v1.0.0):** the Stripe, Alipay and PayPay server drivers are
> self-documented **reference simulations** — they mint local client tokens and simulate the PSP
> round trip without making any real PSP network call, and must not be pointed at production
> traffic. Only the Bakong KHQR driver produces genuinely real (EMVCo-compliant, non-networked)
> output. Production drivers are a per-merchant integration task: each real driver must implement
> the PSP's API (with its own credentials/KMS) behind the same `PaymentDriver` interface.

---

## 6. End-to-end call flow — `REQUEST_PAYMENT`

```
User taps "Pay"  ──► WebView.dispatchTouchEvent ──► abuseGuard.recordUserGesture()   (already wired: GoatView.kt:279)

Mini-app JS                          Mini-app backend (Zone 5)                 Goat Server Proxy (Zone 4)
   │  "checkout"                          │                                         │
   │ ───────────────────────────────────► │  POST /pay/intents {order, amount, cur} │
   │                                      │ ──────────────────────────────────────► │  create PSP PaymentIntent
   │                                      │                                         │  return {intentId, expiresAt,
   │                                      │ ◄────────────────────────────────────── │   clientTokenHandle}
   │                                      │  sign canonical payload w/ tenant key   │
   │ ◄─────────────────────────────────── │  {intentId, orderId, amount, currency,  │
   │   signedPayload                      │   provider, nonce, expiresAt, sig}      │
   │                                                                                 
   ▼
bridge.call("REQUEST_PAYMENT", { provider, orderId, intentId, amount, currency, nonce, signedPayload })
   │
   ▼   GoatBridgeActionHandler.executeAction
   ├─ L4 Mutex: acquire Mutex(intentId)                                           locked ─► reject PAYMENT_IN_PROGRESS
   ├─ L1 Gesture Gate: check isGestureFresh() OR show Native Overlay                no touch ─► reject GESTURE_REQUIRED
   │      (Native Overlay presents immediate loading/confirmation screen, anchoring a 0ms fresh gesture)
   ▼
   GoatPaymentGatewayManager.requestPayment
   ├─ L5  caller origin ∈ allowlist (GoatSecurityManager.isOriginAllowed)  no ─► reject ORIGIN_NOT_ALLOWED
   │      provider gateway domains ∈ manifest.security.paymentGateways      no ─► reject GATEWAY_NOT_ALLOWED
   ├─ L2  fetch tenant public key from Zone 4 directory (cached in GoatSecureStorageManager)
   │      canonicalize {intentId,orderId,amount,currency,provider,nonce,expiresAt}
   │      verify sig with Zone 5 Public Key (ECDSA P-256 / Ed25519)        bad ─► reject PAYMENT_INTENT_INVALID
   │      now > expiresAt ?                                                yes ─► reject PAYMENT_INTENT_EXPIRED
   │      payload.amount == signed.amount && payload.currency == signed ?   no ─► reject PAYMENT_INTENT_MISMATCH   (anti-TOCTOU, A1)
   ├─ L4  nonce/intentId already terminal in local store ?                 yes ─► return prior outcome (no re-charge)
   │      POST /pay/intents/{intentId}/claim  (server-authoritative)   conflict ─► return proxy's terminal outcome
   ├─ L3  GET /pay/intents/{intentId}/client-token → ephemeralToken       (native memory only; never to JS)
   ▼
   adapter = registry[provider]                                          missing ─► reject PROVIDER_NOT_REGISTERED
   CoroutineScope(SupervisorJob()+Dispatchers.IO).withTimeout(45_000) {
       adapter.processPayment(GoatPaymentRequest(opaque… + ephemeralToken), ctx)
   }
   │        └─ presents Stripe PaymentSheet / Alipay PayTask / paypay:// / KHQR sheet / allowlisted checkout URL
   ▼
   outcome {status, providerRef, transactionHandle, failureSubCode}
   ├─ POST /pay/intents/{intentId}/confirm  → proxy returns AUTHORITATIVE MONOTONIC terminal state
   ├─ persist terminal result in idempotency store (GoatSecureStorageManager, per-tenant)
   ├─ release Mutex(intentId)
   ▼
bridge resolves →  { status: "SUCCESS" | "CANCELLED" | "FAILED" | "DISMISSED",
                      intentId, transactionHandle, amount, currency,
                      failureSubCode }                                      ← no token, no PAN, no secret

… asynchronously:  PSP ──► POST /pay/webhooks/{psp} ──► verify PSP sig, dedupe by event id,
                    monotonic transition check ──► POST {miniAppBackend.callbackUrl} (allowlisted)
```

---

## 7. The Payment Security Gate — layer by layer

### L1 — User Gesture Freshness Gate & Native Progress Overlay  🟢
- **Reuses** `GoatAbuseGuardManager.isGestureFresh()` (10 s window), gating state-changing bridge calls.
- **2-Hop Network Latency Mitigation:** To prevent false `GESTURE_REQUIRED` rejections when backend RTTs take >10 seconds, `REQUEST_PAYMENT` triggers an immediate **Native Progress / Confirmation Overlay**. 
- The overlay displays order amount, currency, merchant name, and a loading indicator. The user's explicit confirmation interaction on this native overlay anchors a **$0\text{ ms}$ fresh native gesture**, insulating the execution from network latency.
- Uses `SystemClock.elapsedRealtime()` (Android) / `CACurrentMediaTime()` (iOS) monotonic clocks to prevent local clock manipulation (A6).

### L2 — Backend Payload Integrity Verification (Asymmetric Hardened)  🟢
- **Key Model:** Strictly **asymmetric-only** verification — Ed25519 or ECDSA P-256.
- **Out-of-Band Key Provisioning:** Zone 1 (Native) fetches the tenant's public key directly from Zone 4 (Server Proxy's trusted directory `GET /tenant-keys/:tenantAppId`), cached securely in `GoatSecureStorageManager`. The mini-app JS (Zone 0) is **strictly forbidden** from supplying public keys inside the IPC payload.
- 🚫 **Explicitly forbidden:** Device-derived key fallback (such as IAP's deterministic key) is barred for payments. Lack of a valid server-provisioned public key causes a hard failure (`PAYMENT_INTENT_INVALID`).
- **Anti-TOCTOU (A1):** Native re-checks `payload.amount` / `payload.currency` against signed values. JS-supplied values are display-only.
- Expiry check: `now > expiresAt` $\Rightarrow$ `PAYMENT_INTENT_EXPIRED` (default TTL: 5 min).

### L3 — PCI-DSS Tokenization & Credential Isolation  🟢
- The bridge IPC payload schema is a **closed allowlist** of primitive fields (§8). No free-form maps or raw credential fields exist.
- PSP secret keys: only in Zone 4 (KMS/HSM). The device gets a **single-intent, short-lived client token**, fetched native-side (L3 step), held in native memory, handed to the adapter, and **never** placed in a bridge response.
- Card entry UI is always PSP-owned (`PaymentSheet`, Alipay/PayPay app, bank app). Custom adapters are contractually forbidden from rendering PAN/CVV fields.
- Keeps host at **SAQ-A / SAQ-A-EP**.

### L4 — Server Proxy Anti-Replay, Idempotency & In-Memory Mutex  🟢
- **Thread-Safe Mutex Lock (A8 Mitigation):** `GoatPaymentGatewayManager` acquires an atomic lock (`ConcurrentHashMap<String, Mutex>`) on `intentId` BEFORE invoking async `/claim` calls. Duplicate bridge calls for the same `intentId` receive `PAYMENT_IN_PROGRESS`.
- **Two-Tier Idempotency:**
  1. *Local*: `nonce` + `intentId` terminal-result map in `GoatSecureStorageManager`.
  2. *Authoritative*: `POST /pay/intents/:id/claim` on proxy — first caller wins, others receive recorded terminal state.
- Nonce single-use lifecycle with 5-minute TTL + 2-minute grace.

### L5 — Origin, Gateway & Universal Link Allowlist  🟢
- **Caller Origin:** `GoatSecurityManager.isOriginAllowed(origin)` enforces virtual origin sandbox.
- **Gateway Domains:** Checked via `GoatContentBlocker.isUriAllowed(uri, manifest.security.paymentGateways)`.
- **App2App Deep-Link Protection (A3 Mitigation):** Return URLs MUST use **Android App Links** and **iOS Universal Links** (`https://domain.com/payment/return`) backed by verified `assetlinks.json` / `apple-app-site-association`. Legacy unverified schemes (`goat://`) are barred for payment returns.
- **Hosted Checkout Isolation:** Dedicated WebView with bridge injection disabled and ephemeral storage.

---

## 8. Bridge API contract

### Request — `REQUEST_PAYMENT`
```json
{
  "id": "req_pay_001",
  "action": "REQUEST_PAYMENT",
  "payload": {
    "provider": "stripe",
    "orderId": "order_8842",
    "intentId": "pi_goat_a1b2c3",
    "amount": 4999,
    "currency": "USD",
    "nonce": "9f2c…64hex",
    "signedPayload": "base64url(sig over canonical intent)"
  }
}
```

### Success Response
```json
{
  "id": "req_pay_001",
  "data": {
    "status": "SUCCESS",
    "intentId": "pi_goat_a1b2c3",
    "transactionHandle": "txh_opaque_99a8b7",
    "amount": 4999,
    "currency": "USD"
  }
}
```

### Non-Terminal Dismissal Response
```json
{
  "id": "req_pay_001",
  "data": {
    "status": "DISMISSED",
    "intentId": "pi_goat_a1b2c3",
    "amount": 4999,
    "currency": "USD"
  }
}
```

### Error Response & Safe Sub-Codes
```json
{
  "id": "req_pay_001",
  "error": {
    "code": "PAYMENT_FAILED",
    "message": "Payment declined by issuing bank",
    "subCode": "CARD_DECLINED_INSUFFICIENT_FUNDS"
  }
}
```

### Standard Error Codes & Actionable Sub-Codes

| Code | Layer | Sub-Code (if applicable) | Meaning & UI Recovery Guidance |
| :--- | :--- | :--- | :--- |
| `GESTURE_REQUIRED` | L1 | — | No fresh native touch (< 10 s). Prompt user to re-tap. |
| `ORIGIN_NOT_ALLOWED` | L5 | — | Caller frame origin not sandboxed virtual origin. |
| `GATEWAY_NOT_ALLOWED` | L5 | — | Redirect target missing from `manifest.security.paymentGateways`. |
| `PAYMENT_INTENT_INVALID` | L2 | — | Signature verification failed or missing public key. |
| `PAYMENT_INTENT_EXPIRED` | L2 | — | `now > expiresAt`. Re-create intent. |
| `PAYMENT_INTENT_MISMATCH` | L2 | — | JS `amount`/`currency` $\neq$ signed values (anti-TOCTOU). |
| `PROVIDER_NOT_REGISTERED` | mgr | — | No adapter registered for `provider`. |
| `PAYMENT_IN_PROGRESS` | mgr | — | Another bridge call for this `intentId` is mid-flight. |
| `PAYMENT_CANCELLED` | adapter | — | User explicitly canceled order/checkout. |
| `PAYMENT_FAILED` | adapter/proxy | `CARD_DECLINED_INSUFFICIENT_FUNDS`<br/>`CARD_EXPIRED`<br/>`AUTHENTICATION_FAILED`<br/>`NETWORK_TIMEOUT` | Actionable, non-sensitive failure reason for mini-app UI guidance. |
| `PAYMENT_TIMEOUT` | mgr | `STUCK_PAYMENT_WATCHDOG_RELEASED` | Adapter exceeded timeout (45 s). Watchdog cleared lock. |

---

## 9. Payment intent state machine

```
        create (Zone 5→4)
   ─────────────────────────►  CREATED
                                  │ claim (L4)
                                  ▼
                                CLAIMED ◄────────┐
                                  │              │ dismiss sheet
                                  │ adapter.processPayment
                                  ▼              │
                               PROCESSING ───────┴──► DISMISSED    (non-terminal, retryable)
                                  │
                                  ├─────────────────► FAILED       (terminal)
                                  ├─────────────────► CANCELLED    (terminal)
                     ┌────────────┴────────────┐
                     ▼                         ▼
                AUTHORIZED  ── capture ──────► SUCCEEDED            (terminal, IMMUTABLE)
                     │                                        
                     └── expiry / cancel ─────► EXPIRED / CANCELLED (terminal)
```

### Strict Monotonic Transition Rules

To prevent client-side cancellation spoofing (A9) or timing races from corrupting settled payments:

| Current State in Proxy | Incoming `/confirm` Action | PSP Webhook Event | Resulting Final State | Rule Rationale |
| :--- | :--- | :--- | :--- | :--- |
| `CLAIMED` / `PROCESSING` | `SUCCEEDED` | — | `SUCCEEDED` | Standard success transition. |
| `CLAIMED` / `PROCESSING` | `CANCELLED` | — | `CANCELLED` | Client canceled before capture. |
| **`SUCCEEDED`** | `CANCELLED` (Client) | — | **`SUCCEEDED`** | **Monotonic Rule:** Client cannot downgrade a captured payment. |
| `CANCELLED` | — | `charge.succeeded` | **`SUCCEEDED`** | **Monotonic Rule:** Webhook settlement overrides provisional client cancellation. |
| **`SUCCEEDED`** | — | `charge.failed` | **`SUCCEEDED`** | Terminal `SUCCEEDED` state is immutable in v1. |

---

## 10. Cross-platform parity

| Platform | Gate + manager | Adapter SPI | Built-in adapters |
| :--- | :--- | :--- | :--- |
| **Android** | `GoatPaymentGatewayManager.kt` in `android/core`; L1 in `GoatBridgeActionHandler`; Mutex in `ConcurrentHashMap` | `GoatPaymentAdapter` (Kotlin `interface`, `suspend`) | `android/feature-payments-{stripe,alipay,paypay,bakong}` |
| **iOS** | `GoatPaymentGatewayManager.swift` in `ios/Sources/GoatWebView`; L1 in `GoatScriptMessageHandler` + `GoatAbuseGuard` | `GoatPaymentAdapter` (`protocol`, `async throws`) | SPM targets per PSP |
| **React Native** | Pass-through: `NativeGoatWebViewModule` $\rightarrow$ native manager (no JS gate logic) | Host registers native adapters; RN cannot define in JS | Inherits native |
| **Flutter** | `MethodChannel` $\rightarrow$ native manager | Same as RN | Inherits native |

The web/JS layers **never** implement gate logic — they only marshal calls. Server proxy (`packages/server`) is shared by all four platforms.

---

## 11. Design strength scorecard

| # | Mechanism | Strength | Rationale | Hardened Mitigation |
| :-- | :-- | :-: | :-- | :-- |
| L1 | Gesture & Progress Overlay | 🟢 Strong | Reuses shipped gate + Native Progress Overlay anchors 0ms gesture | Monotonic clocks (`elapsedRealtime`) prevent A6 clock shifts; Overlay eliminates 2-hop RTT timeout. |
| L2 | Asymmetric Intent Integrity | 🟢 Strong | Ed25519 / ECDSA P-256 signature verification via Zone 4 provisioned key | Zone 4 provisions public keys out-of-band; JS key supply forbidden; device-derived fallback barred. |
| L3 | Credential Isolation | 🟢 Strong | Closed IPC field allowlist, PSP-owned card UI, single-intent client tokens | Custom adapters restricted to host app compile-time registration. |
| L4 | Mutex & Anti-Replay | 🟢 Strong | Atomic thread-safe in-memory mutex + two-tier server authoritative claim | In-memory mutex blocks concurrent double-bridge calls (A8); proxy ledger survives reinstall. |
| L5 | Origin & Universal Link Allowlist | 🟢 Strong | Virtual origin sandbox + HTTPS Universal/App Links requirement | Unverified custom schemes (`goat://`) barred for app2app returns. |
| SPI | Adapter Isolation | 🟢 Hardened | Host-only registration + capability-scoped context + 45s watchdog | Mini-app dynamic adapter loading strictly prohibited. Host app owns code audit. |
| Proxy | Monotonic State Engine | 🟢 Strong | PSP secrets in KMS/HSM; webhook reconciliation; strictly monotonic states | `SUCCEEDED` state is immutable; client `CANCELLED` cannot override PSP webhook (A9). |
| Proxy | PSP driver integrations | 🟡 Reference only | Stripe/Alipay/PayPay drivers are **simulations** that make no real PSP network call (§5); only Bakong KHQR emits genuinely real EMVCo output | Design is sound and the `PaymentDriver` seam is production-shaped, but each real driver is a per-merchant integration task that must be written and certified before any production traffic. |
| UX | Resumability & Recovery | 🟢 Strong | `DISMISSED` state, `onResume` lifecycle hook for KHQR, safe error sub-codes | Prevents intent trashing, speeds up QR recovery, gives mini-apps actionable UI recovery. |

---

## 12. Reuse map (what already exists vs. what's net-new)

| Need | Existing asset | Net-new |
| :--- | :--- | :--- |
| Gesture gate | `GoatAbuseGuardManager` / `GoatAbuseGuard` | Add 2 actions to `PRIVILEGED_ACTIONS` + Native Progress Overlay |
| Signature verify | `GoatSecurityManager.verifyBytesSignature` | Canonicalization spec + Zone 4 Public Key Directory integration |
| Origin allowlist | `GoatSecurityManager.isOriginAllowed` | — |
| Domain allowlist | `GoatContentBlocker.isUriAllowed` | `manifest.security.paymentGateways` field + Universal Link verifier |
| Encrypted at-rest store | `GoatSecureStorageManager` | Idempotency & cached tenant public key namespace |
| Plugin SPI shape | `GoatBridgePlugin` (+ `.swift`), `GoatPluginRegistry` | `GoatPaymentAdapter`, `GoatPaymentGatewayManager` |
| App lifecycle hooks | `GoatView` lifecycle listener | `onResume` payment status flush trigger |
| Server crypto / KMS | `ota-crypto.service.ts`, `GoatSecureEnclaveKeyRotator` | `packages/server/src/payments/*` |

Roughly **75% reuse**, reinforcing security through established primitives.

---

## 13. Hardened decisions & defaults

1. **L2 Key Model:** Asymmetric-only (ECDSA P-256 / Ed25519). HMAC compat disabled by default for v1.
2. **Public Key Provisioning:** Zone 4 (Server Proxy) maintains the tenant public key directory. Zone 1 fetches keys out-of-band during verification. JS context cannot supply keys.
3. **Custom Adapters:** Host-app compile-time registration only (`registerAdapter`). Dynamic loading from mini-apps is prohibited.
4. **KHQR Polling & Lifecycle Budget:** 1 s initial interval (first 15 s), 3 s thereafter up to 3 min. Mandatory immediate status flush on `onResume`.
5. **Intent TTL & Watchdog:** Intent TTL = 5 min (plus 2 min nonce grace). Manager in-flight watchdog = 45 s.
6. **State Monotonicity:** Terminal `SUCCEEDED` is immutable. Webhook settlement overrides client cancellation.

---

## 14. Test strategy

- **Unit Tests:**
  - Layer isolation: stale gesture $\Rightarrow$ `GESTURE_REQUIRED`; tampered `signedPayload` $\Rightarrow$ `PAYMENT_INTENT_INVALID`; amount mismatch $\Rightarrow$ `PAYMENT_INTENT_MISMATCH`; expired intent $\Rightarrow$ `PAYMENT_INTENT_EXPIRED`.
  - Mutex lock: concurrent multi-threaded bridge calls for same `intentId` $\Rightarrow$ second call receives `PAYMENT_IN_PROGRESS`.
- **Adversarial & Security Tests:**
  - Forged origin in payload body ignored.
  - Device-key signed intent must fail.
  - Client-sent `CANCELLED` after proxy receives `charge.succeeded` webhook must preserve `SUCCEEDED`.
  - JS-supplied public key in IPC payload must be ignored in favor of Zone 4 directory.
- **UX & Lifecycle Tests:**
  - Sheet dismissal returns `DISMISSED` without invalidating the intent.
  - App backgrounding during KHQR followed by `onResume` triggers immediate status query.
  - Watchdog releases lock after 45 s timeout.
- **Cross-Platform Parity:**
  - Automated test matrix across Android, iOS, React Native, and Flutter via `scripts/verify-all.sh`.

---

## 15. Proposed file layout

```
android/core/src/main/java/com/goat/webview/payments/
    GoatPaymentGatewayManager.kt      (Mutex, State Machine, Overlay, Lifecycle hooks)
    GoatPaymentAdapter.kt             (Host SPI interface)
    GoatPaymentModels.kt              (Request, Outcome, Status, Context, SafeSubCodes)
    GoatPaymentIntentStore.kt         (Local idempotency & public key store)
    GoatPaymentProgressOverlay.kt     (Native loading & gesture anchor overlay)
android/feature-payments-stripe/…   feature-payments-alipay/…  -paypay/…  -bakong/…
ios/Sources/GoatWebView/
    GoatPaymentGatewayManager.swift
    GoatPaymentAdapter.swift
    GoatPaymentModels.swift
    GoatPaymentProgressOverlay.swift
packages/server/src/payments/
    payments.controller.ts
    tenant-keys.controller.ts         (Out-of-band public key directory)
    payments-webhook.controller.ts    (Monotonic state engine)
    payments-proxy.service.ts
    payments-idempotency.service.ts
    drivers/{stripe,alipay,paypay,bakong}.driver.ts
docs-site/docs/architecture/payment-gateway.md   (published version of this doc)
```
