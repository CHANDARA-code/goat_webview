/**
 * @goat/bridge-mock - Passkeys & the hardware vault (5 actions)
 *
 * The vault mock keeps a per-vault map rather than a real cipher, but it preserves the two
 * properties a mini-app can actually observe and depend on: an envelope carries no key material,
 * and an envelope sealed by one appId/vaultId cannot be opened under another.
 */

import { mockState } from '../state/store.js';
import { GoatBridgeError, BridgeErrorCodes } from '../errors.js';

interface StoredVaultEntry {
  appId: string;
  vaultId: string;
  plaintext: string;
}

export class PasskeyHandlers {
  private static vaultStore = new Map<string, StoredVaultEntry>();
  private static counter = 0;

  private static b64url(value: string): string {
    return Buffer.from(value, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /** Action 151: PASSKEY_CHECK_SUPPORT */
  public static checkSupport(): {
    supported: boolean;
    platformAuthenticator: boolean;
    conditionalMediation: boolean;
    prfSupported: boolean;
    biometryType: string;
    hasEnrolledBiometrics: boolean;
    vaultMode: string;
  } {
    return {
      supported: true,
      platformAuthenticator: true,
      conditionalMediation: false,
      prfSupported: true,
      biometryType: 'fingerprint',
      hasEnrolledBiometrics: true,
      vaultMode: 'hardware_keystore',
    };
  }

  /** Action 152: PASSKEY_REGISTER */
  public static register(payload: any = {}): Record<string, unknown> {
    if (!payload.optionsJson) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing required "optionsJson"');
    }
    if (!mockState.isUserGestureFresh(10000)) {
      throw new GoatBridgeError(
        BridgeErrorCodes.GESTURE_REQUIRED,
        'Passkey registration requires a recent user gesture'
      );
    }
    const id = this.b64url(`mock-credential-${++this.counter}`);
    return {
      id,
      rawId: id,
      type: 'public-key',
      authenticatorAttachment: 'platform',
      response: {
        clientDataJSON: this.b64url(JSON.stringify({ type: 'webauthn.create', challenge: 'mock' })),
        attestationObject: this.b64url('mock-attestation-object'),
        publicKey: this.b64url('mock-spki-public-key'),
        publicKeyAlgorithm: -7,
        transports: ['internal'],
      },
      // Deliberately no `prf`: the master key never crosses the bridge, on device or in the mock.
      clientExtensionResults: { credProps: { rk: true } },
    };
  }

  /** Action 153: PASSKEY_ASSERT */
  public static assert(payload: any = {}): Record<string, unknown> {
    if (!payload.optionsJson) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing required "optionsJson"');
    }
    if (!mockState.isUserGestureFresh(10000)) {
      throw new GoatBridgeError(
        BridgeErrorCodes.GESTURE_REQUIRED,
        'Passkey assertion requires a recent user gesture'
      );
    }
    const id = this.b64url('mock-credential-1');
    return {
      id,
      rawId: id,
      type: 'public-key',
      authenticatorAttachment: 'platform',
      response: {
        clientDataJSON: this.b64url(JSON.stringify({ type: 'webauthn.get', challenge: 'mock' })),
        authenticatorData: this.b64url('mock-authenticator-data'),
        signature: this.b64url('mock-signature'),
        userHandle: this.b64url('mock-user'),
      },
      clientExtensionResults: {},
    };
  }

  /** Action 154: VAULT_ENCRYPT */
  public static encryptVault(payload: any = {}): Record<string, unknown> {
    const vaultId = payload.vaultId;
    const plaintext = payload.plaintext;
    if (!vaultId) throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing required "vaultId"');
    if (typeof plaintext !== 'string') {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing required "plaintext"');
    }
    const appId = payload.appId ?? 'default';
    const handle = `${appId}:${vaultId}:${++this.counter}`;
    this.vaultStore.set(handle, { appId, vaultId, plaintext });

    return {
      version: 1,
      vaultMode: 'hardware_keystore',
      appId,
      vaultId,
      salt: this.b64url(`salt-${handle}`),
      iv: this.b64url(`iv-${this.counter}`),
      ciphertext: this.b64url(handle),
      tag: this.b64url(`tag-${this.counter}`),
    };
  }

  /** Action 155: VAULT_DECRYPT */
  public static decryptVault(payload: any = {}): { plaintext: string } {
    const vaultId = payload.vaultId;
    const envelope = payload.envelope;
    if (!vaultId) throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing required "vaultId"');
    if (!envelope || typeof envelope !== 'object') {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing required "envelope"');
    }
    const appId = payload.appId ?? 'default';
    const handle = Buffer.from(
      String(envelope.ciphertext ?? '').replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8');

    const entry = this.vaultStore.get(handle);
    if (!entry || entry.appId !== appId || entry.vaultId !== vaultId) {
      throw new GoatBridgeError(
        BridgeErrorCodes.VAULT_DECRYPTION_FAILED,
        'Authentication tag verification failed, or the envelope belongs to another tenant or vault'
      );
    }
    return { plaintext: entry.plaintext };
  }

  public static reset(): void {
    this.vaultStore.clear();
    this.counter = 0;
  }
}
