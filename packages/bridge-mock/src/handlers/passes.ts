/**
 * @goat/bridge-mock - Digital wallet passes (5 actions)
 *
 * Keeps a per-appId store so the mock preserves the property a caller can observe on device:
 * a pass is a bearer token, and one mini-app cannot see another's.
 */

import { GoatBridgeError, BridgeErrorCodes } from '../errors.js';

interface StoredPass {
  appId: string;
  passId: string;
  provider: string;
  payload: string;
}

export class PassHandlers {
  private static store = new Map<string, StoredPass>();

  private static key(appId: string, passId: string): string {
    return `${appId}::${passId}`;
  }

  private static passIdFrom(metadata: any): string | null {
    const type = metadata?.passTypeIdentifier;
    const serial = metadata?.serialNumber;
    if (!type || !serial) return null;
    return `${type}:${serial}`;
  }

  /** Structural JWT check, mirroring the native validator. */
  private static isValidJwt(value: string): boolean {
    const parts = String(value).split('.');
    return parts.length === 3 && parts.every((p) => p.length > 0 && /^[A-Za-z0-9_-]+$/.test(p));
  }

  /** Action 206: WALLET_SAVE_PASS */
  public static savePass(payload: any = {}): Record<string, unknown> {
    const provider = String(payload.provider ?? '').toUpperCase();
    if (!['GOOGLE_WALLET', 'APPLE_WALLET', 'GENERIC'].includes(provider)) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, "Unknown or missing 'provider'");
    }
    if (typeof payload.payload !== 'string' || !payload.payload) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, "Missing 'payload'");
    }
    if (provider === 'GOOGLE_WALLET' && !this.isValidJwt(payload.payload)) {
      throw new GoatBridgeError(BridgeErrorCodes.PASS_INVALID, 'Pass JWT is structurally malformed');
    }

    const appId = payload.appId ?? 'default';
    const passId = this.passIdFrom(payload.metadata);
    if (provider === 'GENERIC' && !passId) {
      throw new GoatBridgeError(
        BridgeErrorCodes.INVALID_ARGUMENT,
        'A generic pass needs passTypeIdentifier and serialNumber'
      );
    }

    const alreadyAdded = passId ? this.store.has(this.key(appId, passId)) : false;
    if (passId) {
      this.store.set(this.key(appId, passId), { appId, passId, provider, payload: payload.payload });
    }
    return { state: 'ADDED', passId, provider, alreadyAdded };
  }

  /** Action 207: WALLET_GET_PASS_STATE */
  public static getPassState(payload: any = {}): Record<string, unknown> {
    const passId = payload.passId;
    if (!passId) throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, "Missing 'passId'");
    const provider = String(payload.provider ?? 'GENERIC').toUpperCase();
    const appId = payload.appId ?? 'default';

    // Google Wallet exposes no "does the user hold this pass" query, so an unobserved pass is
    // UNKNOWN rather than NOT_ADDED -- reporting absence would invite a duplicate.
    const held = this.store.has(this.key(appId, passId));
    let state: string;
    if (held) state = 'ADDED';
    else if (provider === 'GOOGLE_WALLET') state = 'UNKNOWN';
    else state = 'NOT_ADDED';

    return { passId, provider, state };
  }

  /** Action 208: WALLET_OPEN_PASS */
  public static openPass(payload: any = {}): Record<string, unknown> {
    const passId = payload.passId;
    if (!passId) throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, "Missing 'passId'");
    const provider = String(payload.provider ?? 'GENERIC').toUpperCase();
    return { passId, opened: provider !== 'GENERIC' };
  }

  /** Action 209: WALLET_LIST_PASSES */
  public static listPasses(payload: any = {}): Record<string, unknown> {
    const appId = payload.appId ?? 'default';
    const passIds = [...this.store.values()]
      .filter((p) => p.appId === appId)
      .map((p) => p.passId)
      .sort();
    return { count: passIds.length, passIds };
  }

  /** Action 210: WALLET_DELETE_PASS */
  public static deletePass(payload: any = {}): Record<string, unknown> {
    const passId = payload.passId;
    if (!passId) throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, "Missing 'passId'");
    const appId = payload.appId ?? 'default';
    return { passId, deleted: this.store.delete(this.key(appId, passId)) };
  }

  public static reset(): void {
    this.store.clear();
  }
}
