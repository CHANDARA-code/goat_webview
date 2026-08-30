/**
 * Goat WebView Task 10206 Payment Gateway Proxy & Security Gate Multi-Platform Runtime Simulator
 *
 * Implements a TypeScript opaque-box model of `GoatPaymentGatewayManager` (Android Kotlin /
 * iOS Swift parity) plus the Server Payment Proxy's monotonic state engine, used to verify the
 * documented bridge contract (§8), the L1-L5 Payment Security Gate (§7), the intent state
 * machine (§9), and cross-platform parity (§10) without needing a real native build.
 */

import * as crypto from 'node:crypto';

export type GoatPaymentStatus =
  | 'CREATED'
  | 'CLAIMED'
  | 'PROCESSING'
  | 'DISMISSED'
  | 'AUTHORIZED'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

const TERMINAL_STATUSES = new Set<GoatPaymentStatus>(['SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED']);
export function isTerminal(status: GoatPaymentStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export const GoatPaymentErrorCode = {
  GESTURE_REQUIRED: 'GESTURE_REQUIRED',
  ORIGIN_NOT_ALLOWED: 'ORIGIN_NOT_ALLOWED',
  GATEWAY_NOT_ALLOWED: 'GATEWAY_NOT_ALLOWED',
  PAYMENT_INTENT_INVALID: 'PAYMENT_INTENT_INVALID',
  PAYMENT_INTENT_EXPIRED: 'PAYMENT_INTENT_EXPIRED',
  PAYMENT_INTENT_MISMATCH: 'PAYMENT_INTENT_MISMATCH',
  PROVIDER_NOT_REGISTERED: 'PROVIDER_NOT_REGISTERED',
  PAYMENT_IN_PROGRESS: 'PAYMENT_IN_PROGRESS',
  PAYMENT_CANCELLED: 'PAYMENT_CANCELLED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_TIMEOUT: 'PAYMENT_TIMEOUT',
} as const;

/**
 * Matches the native `GoatPaymentException` wire format (`"CODE: reason [SUB_CODE]"`) — the
 * bridge transport currently serializes failures via `exception.message` only, so `code`/
 * `subCode` are embedded as a parseable prefix, same as Android's and iOS's implementation.
 */
export class GoatPaymentException extends Error {
  public readonly code: string;
  public readonly subCode?: string;

  constructor(code: string, reason: string, subCode?: string) {
    let message = `${code}: ${reason}`;
    if (subCode) message += ` [${subCode}]`;
    super(message);
    this.code = code;
    this.subCode = subCode;
    this.name = 'GoatPaymentException';
  }
}

export interface SignedIntentFields {
  intentId: string;
  orderId: string;
  amount: number;
  currency: string;
  provider: string;
  nonce: string;
  expiresAt: number;
}

/** Encodes the same `base64(canonical) + "." + base64(signature)` format the native gate decodes. */
export function encodeSignedPayload(fields: SignedIntentFields, sign: (canonical: string) => string): string {
  const canonical = `${fields.intentId}|${fields.orderId}|${fields.amount}|${fields.currency}|${fields.provider}|${fields.nonce}|${fields.expiresAt}`;
  const canonicalB64 = Buffer.from(canonical, 'utf-8').toString('base64');
  const sigB64 = Buffer.from(sign(canonical), 'utf-8').toString('base64');
  return `${canonicalB64}.${sigB64}`;
}

function decodeSignedPayload(signedPayload: string): { fields: SignedIntentFields; signature: string } | null {
  const parts = signedPayload.split('.');
  if (parts.length !== 2) return null;
  try {
    const canonical = Buffer.from(parts[0], 'base64').toString('utf-8');
    const signature = Buffer.from(parts[1], 'base64').toString('utf-8');
    const segments = canonical.split('|');
    if (segments.length !== 7) return null;
    const fields: SignedIntentFields = {
      intentId: segments[0],
      orderId: segments[1],
      amount: Number(segments[2]),
      currency: segments[3],
      provider: segments[4],
      nonce: segments[5],
      expiresAt: Number(segments[6]),
    };
    return { fields, signature };
  } catch {
    return null;
  }
}

/**
 * App2App Deep-Link Protection (Task 10206 / §7 L5, threat A3) — a legacy unverified custom
 * scheme (`goat://`, `alipays://`) is never trusted as a payment return, even on an otherwise
 * allowlisted host; only an `https://` Universal/App Link on an allowlisted domain qualifies.
 */
export function isValidReturnUrl(rawUrl: string, allowedReturnDomains: string[]): boolean {
  if (allowedReturnDomains.length === 0) return false;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  return allowedReturnDomains.some((rawPattern) => {
    const pattern = rawPattern.toLowerCase().trim();
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(2);
      return host === suffix || host.endsWith(`.${suffix}`);
    }
    return host === pattern;
  });
}

export function extractQueryParam(rawUrl: string, name: string): string | null {
  try {
    return new URL(rawUrl).searchParams.get(name);
  } catch {
    return null;
  }
}

export interface GoatPaymentRequest {
  provider: string;
  orderId: string;
  intentId: string;
  amount: number;
  currency: string;
  nonce: string;
  signedPayload: string;
  gatewayDomain?: string;
}

export interface GoatPaymentOutcome {
  status: GoatPaymentStatus;
  intentId: string;
  transactionHandle?: string;
  providerRef?: string;
  failureSubCode?: string;
}

export interface GoatPaymentAdapter {
  providerId: string;
  processPayment(request: GoatPaymentRequest & { ephemeralClientToken?: string }): Promise<GoatPaymentOutcome> | GoatPaymentOutcome;
  queryStatus?(intentId: string): Promise<GoatPaymentStatus> | GoatPaymentStatus;
  cancelPayment?(intentId: string): Promise<GoatPaymentStatus> | GoatPaymentStatus;
}

/** Server Payment Proxy simulator — the single authoritative source of intent state. */
export class GoatServerPaymentProxySimulator {
  private tenantKeys = new Map<string, { verify: (canonical: string, signature: string) => boolean }>();
  private records = new Map<string, GoatPaymentOutcome & { claimed?: boolean }>();
  private claimedSet = new Set<string>();
  private webhookEventIds = new Set<string>();

  registerTenantKey(tenantAppId: string, verify: (canonical: string, signature: string) => boolean): void {
    this.tenantKeys.set(tenantAppId, { verify });
  }

  fetchTenantVerifier(tenantAppId: string) {
    return this.tenantKeys.get(tenantAppId);
  }

  claim(intentId: string): { claimed: boolean; record?: GoatPaymentOutcome } {
    const existing = this.records.get(intentId);
    if (this.claimedSet.has(intentId)) {
      return { claimed: false, record: existing };
    }
    this.claimedSet.add(intentId);
    if (!existing) this.records.set(intentId, { status: 'CLAIMED', intentId });
    return { claimed: true };
  }

  mintClientToken(intentId: string): string {
    return `ephemeral_token_${intentId}`;
  }

  confirm(intentId: string, outcome: GoatPaymentOutcome): GoatPaymentOutcome {
    const existing = this.records.get(intentId);
    if (existing?.status === 'SUCCEEDED') return existing;
    this.records.set(intentId, outcome);
    return outcome;
  }

  cancel(intentId: string): GoatPaymentOutcome {
    const existing = this.records.get(intentId);
    if (existing?.status === 'SUCCEEDED') return existing;
    const cancelled: GoatPaymentOutcome = { status: 'CANCELLED', intentId };
    this.records.set(intentId, cancelled);
    return cancelled;
  }

  query(intentId: string): GoatPaymentOutcome {
    return this.records.get(intentId) ?? { status: 'CREATED', intentId };
  }

  applyWebhook(eventId: string, intentId: string, outcome: GoatPaymentOutcome): { applied: boolean; record: GoatPaymentOutcome } {
    if (this.webhookEventIds.has(eventId)) {
      return { applied: false, record: this.query(intentId) };
    }
    this.webhookEventIds.add(eventId);
    return { applied: true, record: this.confirm(intentId, outcome) };
  }
}

/** Deterministic HMAC-SHA256-style stand-in signer/verifier pair for E2E fixtures. */
export function makeTestKeyPair(secret: string) {
  const digest = (canonical: string) => crypto.createHash('sha256').update(`${canonical}::${secret}`).digest('hex');
  return {
    sign: (canonical: string) => digest(canonical),
    verify: (canonical: string, signature: string) => signature === digest(canonical),
  };
}

export interface GoatPaymentGatewaySimulatorOptions {
  appId: string;
  proxy: GoatServerPaymentProxySimulator;
  allowedOrigins: string[];
  allowedGatewayDomains?: string[];
  allowedReturnDomains?: string[];
  overlayPresenter?: (req: { provider: string; amount: number; currency: string }) => Promise<boolean> | boolean;
  watchdogMs?: number;
  isGestureFresh?: () => boolean;
  recordUserGesture?: () => void;
}

const BUILT_IN_PROVIDERS = new Set(['alipay', 'stripe', 'link', 'paypay', 'bakong_khqr']);

/** Android/iOS `GoatPaymentGatewayManager` parity model. */
export class GoatPaymentGatewaySimulator {
  private opts: GoatPaymentGatewaySimulatorOptions;
  private adapters = new Map<string, GoatPaymentAdapter>();
  private lockedIntents = new Set<string>();
  private pendingProviderByIntent = new Map<string, string>();
  private gestureFresh: boolean;

  constructor(opts: GoatPaymentGatewaySimulatorOptions) {
    this.opts = opts;
    this.gestureFresh = opts.isGestureFresh ? opts.isGestureFresh() : false;
  }

  registerAdapter(adapter: GoatPaymentAdapter, allowOverride = false): void {
    if (!adapter.providerId.trim()) {
      throw new GoatPaymentException('INVALID_ADAPTER', 'providerId must not be blank');
    }
    if (!allowOverride && BUILT_IN_PROVIDERS.has(adapter.providerId) && this.adapters.has(adapter.providerId)) {
      throw new GoatPaymentException('INVALID_ADAPTER', `Provider '${adapter.providerId}' is already registered as built-in.`);
    }
    this.adapters.set(adapter.providerId, adapter);
  }

  setGestureFresh(fresh: boolean): void {
    this.gestureFresh = fresh;
  }

  async requestPayment(request: GoatPaymentRequest, callerOrigin: string | undefined): Promise<GoatPaymentOutcome> {
    if (this.lockedIntents.has(request.intentId)) {
      throw new GoatPaymentException(GoatPaymentErrorCode.PAYMENT_IN_PROGRESS, `Another bridge call for intentId '${request.intentId}' is mid-flight.`);
    }
    this.lockedIntents.add(request.intentId);
    try {
      return await this.executeGated(request, callerOrigin);
    } finally {
      this.lockedIntents.delete(request.intentId);
    }
  }

  async queryPaymentStatus(intentId: string): Promise<GoatPaymentOutcome> {
    return this.opts.proxy.query(intentId);
  }

  async cancelPayment(intentId: string): Promise<GoatPaymentOutcome> {
    const existing = this.opts.proxy.query(intentId);
    if (isTerminal(existing.status)) return existing;
    const providerId = this.pendingProviderByIntent.get(intentId);
    if (providerId) {
      const adapter = this.adapters.get(providerId);
      await adapter?.cancelPayment?.(intentId);
    }
    return this.opts.proxy.cancel(intentId);
  }

  async onAppResume(onAsyncTerminalOutcome?: (outcome: GoatPaymentOutcome) => void): Promise<void> {
    for (const [intentId, providerId] of Array.from(this.pendingProviderByIntent.entries())) {
      const adapter = this.adapters.get(providerId);
      if (!adapter?.queryStatus) continue;
      const status = await adapter.queryStatus(intentId);
      if (isTerminal(status)) {
        const confirmed = this.opts.proxy.confirm(intentId, { status, intentId });
        this.pendingProviderByIntent.delete(intentId);
        onAsyncTerminalOutcome?.(confirmed);
      }
    }
  }

  /**
   * Host-facing entry point for app2app payment return navigation (Task 10206 / §7 L5, A3).
   * Returns `undefined` and does nothing if `returnUrl` is not an HTTPS Universal/App Link
   * matching `allowedReturnDomains` — a legacy custom-scheme return is silently ignored rather
   * than trusted. A valid return only triggers a re-check against the server proxy; the URL's
   * own query params are never trusted for the payment outcome.
   */
  async handleReturnUrl(returnUrl: string, onAsyncTerminalOutcome?: (outcome: GoatPaymentOutcome) => void): Promise<GoatPaymentOutcome | undefined> {
    if (!isValidReturnUrl(returnUrl, this.opts.allowedReturnDomains ?? [])) {
      return undefined;
    }
    const intentId = extractQueryParam(returnUrl, 'intentId');
    if (!intentId) return undefined;

    const outcome = this.opts.proxy.query(intentId);
    if (isTerminal(outcome.status)) {
      this.pendingProviderByIntent.delete(intentId);
      onAsyncTerminalOutcome?.(outcome);
    }
    return outcome;
  }

  private async executeGated(request: GoatPaymentRequest, callerOrigin: string | undefined): Promise<GoatPaymentOutcome> {
    // L1 — gesture freshness gate + native overlay anchoring.
    if (!this.gestureFresh) {
      if (!this.opts.overlayPresenter) {
        throw new GoatPaymentException(GoatPaymentErrorCode.GESTURE_REQUIRED, "Privileged action 'REQUEST_PAYMENT' requires a recent user gesture (< 10s).");
      }
      const confirmed = await this.opts.overlayPresenter({ provider: request.provider, amount: request.amount, currency: request.currency });
      if (!confirmed) {
        throw new GoatPaymentException(GoatPaymentErrorCode.PAYMENT_CANCELLED, 'User declined the native payment confirmation overlay.');
      }
      this.gestureFresh = true;
      this.opts.recordUserGesture?.();
    }

    // L5 — origin & gateway allowlist.
    if (!callerOrigin || !this.opts.allowedOrigins.includes(callerOrigin)) {
      throw new GoatPaymentException(GoatPaymentErrorCode.ORIGIN_NOT_ALLOWED, `Caller frame origin '${callerOrigin}' is not sandboxed.`);
    }
    if (request.gatewayDomain && this.opts.allowedGatewayDomains?.length) {
      const allowed = this.opts.allowedGatewayDomains.some((d) => request.gatewayDomain === d || request.gatewayDomain?.endsWith(`.${d}`));
      if (!allowed) {
        throw new GoatPaymentException(GoatPaymentErrorCode.GATEWAY_NOT_ALLOWED, `Gateway domain '${request.gatewayDomain}' is not allowlisted.`);
      }
    }

    // L2 — signature integrity, expiry, anti-TOCTOU.
    const decoded = decodeSignedPayload(request.signedPayload);
    if (!decoded) {
      throw new GoatPaymentException(GoatPaymentErrorCode.PAYMENT_INTENT_INVALID, 'Malformed signedPayload.');
    }
    const verifier = this.opts.proxy.fetchTenantVerifier(this.opts.appId);
    if (!verifier) {
      throw new GoatPaymentException(GoatPaymentErrorCode.PAYMENT_INTENT_INVALID, 'No tenant public key provisioned by Zone 4 directory.');
    }
    const canonical = `${decoded.fields.intentId}|${decoded.fields.orderId}|${decoded.fields.amount}|${decoded.fields.currency}|${decoded.fields.provider}|${decoded.fields.nonce}|${decoded.fields.expiresAt}`;
    if (!verifier.verify(canonical, decoded.signature)) {
      throw new GoatPaymentException(GoatPaymentErrorCode.PAYMENT_INTENT_INVALID, 'Backend payload signature verification failed.');
    }
    if (Date.now() > decoded.fields.expiresAt) {
      throw new GoatPaymentException(GoatPaymentErrorCode.PAYMENT_INTENT_EXPIRED, `Payment intent expired at ${decoded.fields.expiresAt}.`);
    }
    if (
      decoded.fields.intentId !== request.intentId ||
      decoded.fields.orderId !== request.orderId ||
      decoded.fields.amount !== request.amount ||
      decoded.fields.currency !== request.currency ||
      decoded.fields.provider !== request.provider
    ) {
      throw new GoatPaymentException(GoatPaymentErrorCode.PAYMENT_INTENT_MISMATCH, 'Request fields do not match the signed intent payload.');
    }

    // L4a — local idempotency short-circuit.
    const existing = this.opts.proxy.query(request.intentId);
    if (isTerminal(existing.status)) return existing;

    // L4b — server-authoritative claim.
    const claim = this.opts.proxy.claim(request.intentId);
    if (!claim.claimed) {
      if (claim.record && isTerminal(claim.record.status)) return claim.record;
      throw new GoatPaymentException(GoatPaymentErrorCode.PAYMENT_IN_PROGRESS, 'Intent already claimed by another request.');
    }

    // L3 — ephemeral single-intent client token, native memory only.
    const clientToken = this.opts.proxy.mintClientToken(request.intentId);

    const adapter = this.adapters.get(request.provider);
    if (!adapter) {
      throw new GoatPaymentException(GoatPaymentErrorCode.PROVIDER_NOT_REGISTERED, `No adapter registered for provider '${request.provider}'.`);
    }
    this.pendingProviderByIntent.set(request.intentId, request.provider);

    const adapterOutcome = await adapter.processPayment({ ...request, ephemeralClientToken: clientToken });
    const confirmed = this.opts.proxy.confirm(request.intentId, adapterOutcome);
    if (isTerminal(confirmed.status)) {
      this.pendingProviderByIntent.delete(request.intentId);
    }
    return confirmed;
  }
}

/** Proves the RN bridge wrapper is a thin pass-through with zero client-side gate logic. */
export class ReactNativeGoatPaymentSimulator {
  readonly supportedActions = ['REQUEST_PAYMENT', 'QUERY_PAYMENT_STATUS', 'CANCEL_PAYMENT'];
  handleAction(action: string): { success: boolean; action: string; forwardedToNative: boolean } {
    return { success: true, action, forwardedToNative: this.supportedActions.includes(action) };
  }
}

/** Proves the Flutter MethodChannel wrapper is a thin pass-through with zero client-side gate logic. */
export class FlutterGoatPaymentSimulator {
  readonly supportedActions = ['REQUEST_PAYMENT', 'QUERY_PAYMENT_STATUS', 'CANCEL_PAYMENT'];
  handleAction(action: string): { success: boolean; action: string; forwardedToNative: boolean } {
    return { success: true, action, forwardedToNative: this.supportedActions.includes(action) };
  }
}
