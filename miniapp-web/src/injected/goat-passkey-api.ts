/**
 * `window.goat.passkey` and `window.goat.vault` — the ergonomic layer above the WebAuthn polyfill.
 *
 * The vault deliberately has no `deriveKey`. Encryption and decryption happen natively so the
 * CTAP2 PRF output never enters this realm; JavaScript sees ciphertext envelopes and plaintext,
 * never a key.
 */

import { GoatWeb3Transport } from './goat-web3-bridge.js';
import { bufferToBase64Url } from './passkey-base64url.js';

export type VaultMode = 'webauthn_prf' | 'hardware_se_local' | 'hardware_keystore' | 'none';

export interface BiometricStatus {
  supported: boolean;
  biometryType: 'faceID' | 'touchID' | 'opticID' | 'fingerprint' | 'none';
  hasEnrolledBiometrics: boolean;
  prfSupported: boolean;
  vaultMode: VaultMode;
}

export interface PasskeyRegisterOptions {
  username: string;
  displayName?: string;
  userId?: string;
  rpId?: string;
  rpName?: string;
  challenge?: string;
  requirePrf?: boolean;
}

export interface PasskeyAuthenticateOptions {
  challenge?: string;
  rpId?: string;
  allowedCredentialIds?: string[];
  userVerification?: 'required' | 'preferred' | 'discouraged';
}

export interface VaultCiphertextEnvelope {
  version: number;
  vaultMode: VaultMode;
  appId: string;
  vaultId: string;
  salt: string;
  iv: string;
  ciphertext: string;
  tag: string;
}

export interface VaultDecryptResult {
  plaintext: string;
  /**
   * Present when native re-encrypted the vault under a stronger derivation (the iOS 17 Secure
   * Enclave -> iOS 18 CTAP2 PRF upgrade). Persist it, replacing the envelope you passed in —
   * ignoring it is safe today but leaves the vault on the legacy, device-local key.
   */
  migratedEnvelope?: VaultCiphertextEnvelope;
}

function randomChallenge(): string {
  const bytes = new Uint8Array(32);
  const cryptoRef = (globalThis as any).crypto;
  if (cryptoRef?.getRandomValues) {
    cryptoRef.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return bufferToBase64Url(bytes);
}

function textToBase64Url(value: string | Uint8Array): string {
  if (typeof value !== 'string') return bufferToBase64Url(value);
  const encoder = new TextEncoder();
  return bufferToBase64Url(encoder.encode(value));
}

export function createPasskeyNamespace(scope: any, transport: GoatWeb3Transport) {
  const appId = () => scope.__GOAT_APP_ID__ ?? scope.goatAppId ?? 'default';
  const hostname = () => scope.location?.hostname ?? '';

  const passkey = {
    async isSupported(): Promise<boolean> {
      try {
        const res: any = await transport.call('PASSKEY_CHECK_SUPPORT', {});
        return !!res?.supported;
      } catch {
        return false;
      }
    },

    async checkBiometrics(): Promise<BiometricStatus> {
      const res: any = await transport.call('PASSKEY_CHECK_SUPPORT', {});
      return {
        supported: !!res?.supported,
        biometryType: res?.biometryType ?? 'none',
        hasEnrolledBiometrics: !!res?.hasEnrolledBiometrics,
        prfSupported: !!res?.prfSupported,
        vaultMode: res?.vaultMode ?? 'none',
      };
    },

    async register(options: PasskeyRegisterOptions) {
      if (!options?.username) throw new TypeError('goat.passkey.register requires a username');
      const rpId = options.rpId || hostname();
      const optionsJson = JSON.stringify({
        rp: { id: rpId, name: options.rpName ?? rpId },
        user: {
          id: options.userId ?? textToBase64Url(options.username),
          name: options.username,
          displayName: options.displayName ?? options.username,
        },
        challenge: options.challenge ?? randomChallenge(),
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey: 'preferred',
          userVerification: 'required',
        },
        attestation: 'none',
      });

      return transport.call('PASSKEY_REGISTER', {
        appId: appId(),
        optionsJson,
        rpId,
        requirePrf: options.requirePrf === true,
      });
    },

    async authenticate(options: PasskeyAuthenticateOptions = {}) {
      const rpId = options.rpId || hostname();
      const optionsJson = JSON.stringify({
        challenge: options.challenge ?? randomChallenge(),
        rpId,
        allowCredentials: options.allowedCredentialIds?.map((id) => ({ type: 'public-key', id })),
        userVerification: options.userVerification ?? 'required',
      });

      return transport.call('PASSKEY_ASSERT', {
        appId: appId(),
        optionsJson,
        rpId,
      });
    },
  };

  const vault = {
    async encrypt(vaultId: string, plaintext: string | Uint8Array): Promise<VaultCiphertextEnvelope> {
      if (!vaultId) throw new TypeError('goat.vault.encrypt requires a vaultId');
      const asText = typeof plaintext === 'string' ? plaintext : new TextDecoder().decode(plaintext);
      return transport.call<VaultCiphertextEnvelope>('VAULT_ENCRYPT', {
        appId: appId(),
        vaultId,
        plaintext: asText,
      });
    },

    async decrypt(vaultId: string, envelope: VaultCiphertextEnvelope): Promise<VaultDecryptResult> {
      if (!vaultId) throw new TypeError('goat.vault.decrypt requires a vaultId');
      if (!envelope) throw new TypeError('goat.vault.decrypt requires an envelope');
      return transport.call<VaultDecryptResult>('VAULT_DECRYPT', {
        appId: appId(),
        vaultId,
        envelope: envelope as unknown as Record<string, unknown>,
      });
    },
  };

  return { passkey, vault };
}

export function installPasskeyNamespace(
  scope: any,
  transport: GoatWeb3Transport
): { installed: boolean; reason?: string } {
  if (!scope) return { installed: false, reason: 'no-window' };
  if (scope.__goat_passkey_api_installed__) return { installed: false, reason: 'already-initialized' };
  scope.__goat_passkey_api_installed__ = true;

  const { passkey, vault } = createPasskeyNamespace(scope, transport);
  const goat = scope.goat ?? (scope.goat = {});
  if (!goat.passkey) goat.passkey = Object.freeze(passkey);
  if (!goat.vault) goat.vault = Object.freeze(vault);

  return { installed: true };
}
