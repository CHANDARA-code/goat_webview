/**
 * Transparent W3C WebAuthn Level 3 polyfill.
 *
 * Intercepts `navigator.credentials.create/get` so an unmodified dApp or `@simplewebauthn/browser`
 * consumer runs inside a mini-app with no knowledge of goat, and routes the ceremony to the
 * platform authenticator through PASSKEY_REGISTER / PASSKEY_ASSERT.
 *
 * Non-public-key calls (PasswordCredential, FederatedCredential) fall through to the original
 * implementation untouched.
 */

import { GoatWeb3Transport } from './goat-web3-bridge.js';
import { bufferToBase64Url, coerceToBase64Url } from './passkey-base64url.js';
import {
  buildAssertionCredential,
  buildAttestationCredential,
  ensureWebAuthnPrototypes,
} from './passkey-dom.js';

export const DEFAULT_APP_ID = 'default';

const BRIDGE_CODE_TO_DOM_EXCEPTION: Record<string, string> = {
  USER_CANCELLED: 'NotAllowedError',
  USER_CANCEL: 'NotAllowedError',
  GESTURE_REQUIRED: 'NotAllowedError',
  NOT_SUPPORTED: 'NotSupportedError',
  PASSKEY_UNSUPPORTED: 'NotSupportedError',
  SECURITY_ERROR: 'SecurityError',
  ORIGIN_NOT_ALLOWED: 'SecurityError',
  RP_ID_NOT_ALLOWED: 'SecurityError',
  INVALID_STATE: 'InvalidStateError',
  NO_CREDENTIAL_FOUND: 'InvalidStateError',
  CONSTRAINT_ERROR: 'ConstraintError',
  TIMEOUT: 'TimeoutError',
};

export function mapBridgeErrorToDOMException(err: unknown): DOMException {
  const message = err instanceof Error ? err.message : String(err ?? 'WebAuthn operation failed');
  const explicitCode = (err as any)?.code;
  const matched =
    (typeof explicitCode === 'string' && BRIDGE_CODE_TO_DOM_EXCEPTION[explicitCode]) ||
    BRIDGE_CODE_TO_DOM_EXCEPTION[
      Object.keys(BRIDGE_CODE_TO_DOM_EXCEPTION).find((code) => message.includes(code)) ?? ''
    ];
  return new DOMException(message, matched ?? 'UnknownError');
}

/**
 * Removes `prf` from outgoing extensions. A page must not be able to ask the authenticator to
 * evaluate the vault's PRF salt for it — that evaluation is the vault master key, and it only ever
 * happens inside VAULT_ENCRYPT / VAULT_DECRYPT, natively.
 */
export function serializeExtensions(ext: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!ext) return undefined;
  const out: Record<string, unknown> = { ...ext };
  delete out.prf;
  delete out.hmacGetSecret;
  delete out['hmac-secret'];
  return out;
}

function serializeDescriptors(list: any[] | undefined) {
  if (!Array.isArray(list)) return undefined;
  return list.map((entry) => ({
    type: entry?.type ?? 'public-key',
    id: coerceToBase64Url(entry?.id),
    ...(entry?.transports ? { transports: entry.transports } : {}),
  }));
}

export function serializeCreationOptions(publicKey: any): Record<string, unknown> {
  if (!publicKey) throw new TypeError('options.publicKey is required for public-key credentials');
  if (!publicKey.user) throw new TypeError('options.publicKey.user is required');
  if (!publicKey.challenge) throw new TypeError('options.publicKey.challenge is required');

  return {
    rp: publicKey.rp,
    user: {
      id: coerceToBase64Url(publicKey.user.id),
      name: publicKey.user.name,
      displayName: publicKey.user.displayName,
    },
    challenge: coerceToBase64Url(publicKey.challenge),
    pubKeyCredParams: publicKey.pubKeyCredParams ?? [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    timeout: publicKey.timeout,
    excludeCredentials: serializeDescriptors(publicKey.excludeCredentials),
    authenticatorSelection: publicKey.authenticatorSelection,
    attestation: publicKey.attestation,
    hints: publicKey.hints,
    extensions: serializeExtensions(publicKey.extensions),
  };
}

export function serializeRequestOptions(publicKey: any): Record<string, unknown> {
  if (!publicKey) throw new TypeError('options.publicKey is required for public-key credentials');
  if (!publicKey.challenge) throw new TypeError('options.publicKey.challenge is required');

  return {
    challenge: coerceToBase64Url(publicKey.challenge),
    timeout: publicKey.timeout,
    rpId: publicKey.rpId,
    allowCredentials: serializeDescriptors(publicKey.allowCredentials),
    userVerification: publicKey.userVerification,
    hints: publicKey.hints,
    extensions: serializeExtensions(publicKey.extensions),
  };
}

function resolveAppId(scope: any): string {
  return scope.__GOAT_APP_ID__ ?? scope.goatAppId ?? DEFAULT_APP_ID;
}

function resolveHostname(scope: any): string {
  return scope.location?.hostname ?? '';
}

export interface WebAuthnPolyfillInstallResult {
  installed: boolean;
  reason?: string;
}

export function installWebAuthnPolyfill(
  scope: any,
  transport: GoatWeb3Transport
): WebAuthnPolyfillInstallResult {
  if (!scope || !scope.navigator) return { installed: false, reason: 'no-navigator' };
  if (scope.__goat_webauthn_installed__) return { installed: false, reason: 'already-initialized' };
  scope.__goat_webauthn_installed__ = true;

  ensureWebAuthnPrototypes(scope);
  const original = scope.navigator.credentials;

  const goatCredentials = {
    async create(options?: any): Promise<any> {
      if (!options || !options.publicKey) {
        if (original?.create) return original.create(options);
        throw new DOMException('Only public-key credentials are supported', 'NotSupportedError');
      }

      const serialized = serializeCreationOptions(options.publicKey);
      let res: any;
      try {
        res = await transport.call('PASSKEY_REGISTER', {
          appId: resolveAppId(scope),
          optionsJson: JSON.stringify(serialized),
          rpId: options.publicKey.rp?.id || resolveHostname(scope),
        });
      } catch (err) {
        throw mapBridgeErrorToDOMException(err);
      }
      return buildAttestationCredential(scope, res);
    },

    async get(options?: any): Promise<any> {
      if (!options || !options.publicKey) {
        if (original?.get) return original.get(options);
        throw new DOMException('Only public-key credentials are supported', 'NotSupportedError');
      }
      if (options.mediation === 'conditional') {
        throw new DOMException('Conditional mediation is unavailable in a WebView', 'NotSupportedError');
      }

      const serialized = serializeRequestOptions(options.publicKey);
      let res: any;
      try {
        res = await transport.call('PASSKEY_ASSERT', {
          appId: resolveAppId(scope),
          optionsJson: JSON.stringify(serialized),
          rpId: options.publicKey.rpId || resolveHostname(scope),
        });
      } catch (err) {
        throw mapBridgeErrorToDOMException(err);
      }
      return buildAssertionCredential(scope, res);
    },

    async store(credential: any): Promise<any> {
      return original?.store ? original.store(credential) : undefined;
    },

    async preventSilentAccess(): Promise<void> {
      return original?.preventSilentAccess ? original.preventSilentAccess() : undefined;
    },
  };

  try {
    Object.defineProperty(scope.navigator, 'credentials', {
      value: goatCredentials,
      configurable: true,
      writable: true,
    });
  } catch {
    scope.navigator.credentials = goatCredentials;
  }

  scope.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = async function () {
    try {
      const support: any = await transport.call('PASSKEY_CHECK_SUPPORT', {});
      return !!support?.supported;
    } catch {
      return false;
    }
  };

  // Conditional UI (autofill) has no WebView surface to attach to.
  scope.PublicKeyCredential.isConditionalMediationAvailable = async function () {
    return false;
  };

  scope.PublicKeyCredential.parseCreationOptionsFromJSON = (json: any) => json;
  scope.PublicKeyCredential.parseRequestOptionsFromJSON = (json: any) => json;

  return { installed: true };
}

export { bufferToBase64Url };
