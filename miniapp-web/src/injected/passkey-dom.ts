/**
 * Rebuilds genuine WebAuthn DOM objects from the native bridge response.
 *
 * Two things libraries actually depend on and that a naive shim gets wrong:
 * `credential instanceof PublicKeyCredential` must hold (so the prototype has to be linked, not
 * just a plain object with the right keys), and `getPublicKey()` must return the real SPKI bytes
 * or `null` — never a zero-length `ArrayBuffer` stub, which reads as "a key of length 0" rather
 * than "no key" and silently breaks server-side registration.
 */

import { base64UrlToBuffer } from './passkey-base64url.js';

export interface NativeAttestationResponse {
  clientDataJSON: string;
  attestationObject: string;
  authenticatorData?: string;
  publicKey?: string | null;
  publicKeyAlgorithm?: number;
  transports?: string[];
}

export interface NativeAssertionResponse {
  clientDataJSON: string;
  authenticatorData: string;
  signature: string;
  userHandle?: string | null;
}

export interface NativeCredentialEnvelope<R> {
  id: string;
  rawId: string;
  type?: string;
  authenticatorAttachment?: string;
  response: R;
  clientExtensionResults?: Record<string, unknown>;
}

/**
 * Strips the CTAP2 PRF evaluation output before anything reaches page JavaScript. The raw 32-byte
 * PRF result is the vault master key; handing it to Zone 0 would let any XSS decrypt the vault
 * offline, which is the entire reason VAULT_ENCRYPT/VAULT_DECRYPT exist as native actions.
 */
export function scrubExtensionResults(results: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(results ?? {}) };
  delete out.prf;
  delete out.hmacGetSecret;
  delete out['hmac-secret'];
  return out;
}

export function ensureWebAuthnPrototypes(scope: any): void {
  if (typeof scope.PublicKeyCredential === 'undefined') {
    scope.PublicKeyCredential = function PublicKeyCredential(this: unknown) {};
  }
  if (typeof scope.AuthenticatorResponse === 'undefined') {
    scope.AuthenticatorResponse = function AuthenticatorResponse(this: unknown) {};
  }
  if (typeof scope.AuthenticatorAttestationResponse === 'undefined') {
    scope.AuthenticatorAttestationResponse = function AuthenticatorAttestationResponse(this: unknown) {};
    scope.AuthenticatorAttestationResponse.prototype = Object.create(scope.AuthenticatorResponse.prototype);
  }
  if (typeof scope.AuthenticatorAssertionResponse === 'undefined') {
    scope.AuthenticatorAssertionResponse = function AuthenticatorAssertionResponse(this: unknown) {};
    scope.AuthenticatorAssertionResponse.prototype = Object.create(scope.AuthenticatorResponse.prototype);
  }
}

function linkCredential(scope: any, envelope: NativeCredentialEnvelope<unknown>, response: object): any {
  const credential = Object.create(scope.PublicKeyCredential.prototype);
  const extensionResults = scrubExtensionResults(envelope.clientExtensionResults);

  Object.defineProperties(credential, {
    id: { value: envelope.id, enumerable: true },
    rawId: { value: base64UrlToBuffer(envelope.rawId), enumerable: true },
    type: { value: 'public-key', enumerable: true },
    response: { value: response, enumerable: true },
    authenticatorAttachment: {
      value: envelope.authenticatorAttachment ?? 'platform',
      enumerable: true,
    },
    getClientExtensionResults: { value: () => ({ ...extensionResults }) },
    toJSON: {
      value: () => ({
        id: envelope.id,
        rawId: envelope.rawId,
        type: 'public-key',
        clientExtensionResults: { ...extensionResults },
      }),
    },
  });
  return credential;
}

export function buildAttestationCredential(
  scope: any,
  envelope: NativeCredentialEnvelope<NativeAttestationResponse>
): any {
  ensureWebAuthnPrototypes(scope);
  const raw = envelope.response;

  const response = Object.create(scope.AuthenticatorAttestationResponse.prototype);
  const authenticatorData = raw.authenticatorData ? base64UrlToBuffer(raw.authenticatorData) : null;
  const publicKey = raw.publicKey ? base64UrlToBuffer(raw.publicKey) : null;

  Object.defineProperties(response, {
    clientDataJSON: { value: base64UrlToBuffer(raw.clientDataJSON), enumerable: true },
    attestationObject: { value: base64UrlToBuffer(raw.attestationObject), enumerable: true },
    getTransports: { value: () => [...(raw.transports ?? ['internal'])] },
    getAuthenticatorData: {
      value: () => {
        if (!authenticatorData) {
          throw new DOMException('Authenticator data unavailable', 'NotSupportedError');
        }
        return authenticatorData;
      },
    },
    getPublicKey: { value: () => publicKey },
    getPublicKeyAlgorithm: { value: () => raw.publicKeyAlgorithm ?? -7 },
  });

  return linkCredential(scope, envelope, response);
}

export function buildAssertionCredential(
  scope: any,
  envelope: NativeCredentialEnvelope<NativeAssertionResponse>
): any {
  ensureWebAuthnPrototypes(scope);
  const raw = envelope.response;

  const response = Object.create(scope.AuthenticatorAssertionResponse.prototype);
  Object.defineProperties(response, {
    clientDataJSON: { value: base64UrlToBuffer(raw.clientDataJSON), enumerable: true },
    authenticatorData: { value: base64UrlToBuffer(raw.authenticatorData), enumerable: true },
    signature: { value: base64UrlToBuffer(raw.signature), enumerable: true },
    userHandle: {
      value: raw.userHandle ? base64UrlToBuffer(raw.userHandle) : null,
      enumerable: true,
    },
  });

  return linkCredential(scope, envelope, response);
}
