import { createSign } from 'node:crypto';
import type {
  GoogleWalletIssuerCredentials,
  GoogleWalletObject,
  SaveJwtOptions,
} from './google-wallet.types.js';

/**
 * Issues Google Wallet "save to wallet" JWTs (PASS-G-08).
 *
 * Server-side on purpose: the JWT is signed with the issuer's service-account private key, which
 * must never reach a device. The client half validates only the JWT's *structure* — it has no key
 * and cannot verify the signature — so this is where the pass actually becomes trustworthy.
 *
 * Signing is RS256 via Node's own crypto. No JWT library is pulled in: the payload is a plain
 * object, the signature is one `createSign` call, and a dependency here would be more surface than
 * the twenty lines it replaces.
 */
export class GoogleWalletIssuer {
  constructor(private readonly credentials: GoogleWalletIssuerCredentials) {
    if (!credentials.issuerEmail) {
      throw new Error('GoogleWalletIssuer requires an issuerEmail (the service account address)');
    }
    if (!credentials.privateKeyPem?.includes('PRIVATE KEY')) {
      throw new Error('GoogleWalletIssuer requires a PEM-encoded RSA private key');
    }
  }

  /**
   * Builds and signs the JWT a client hands to `WALLET_SAVE_PASS` with provider GOOGLE_WALLET.
   *
   * `origins` is not optional in practice: Google refuses a save initiated from an origin the JWT
   * does not name, so an empty list produces a pass that silently never saves.
   */
  createSaveJwt(objects: GoogleWalletObject[], options: SaveJwtOptions): string {
    if (objects.length === 0) {
      throw new Error('createSaveJwt needs at least one pass object');
    }
    if (!options.origins || options.origins.length === 0) {
      throw new Error(
        'createSaveJwt needs at least one origin; Google rejects a save from an unlisted origin'
      );
    }

    const payload = {
      iss: this.credentials.issuerEmail,
      aud: 'google',
      typ: 'savetowallet',
      iat: options.issuedAtEpochSeconds ?? Math.floor(Date.now() / 1000),
      origins: options.origins,
      payload: GoogleWalletIssuer.groupObjects(objects),
    };

    const header = { alg: 'RS256', typ: 'JWT' };
    const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
    const signature = createSign('RSA-SHA256')
      .update(signingInput)
      .sign(this.credentials.privateKeyPem);

    return `${signingInput}.${base64ToUrl(signature.toString('base64'))}`;
  }

  /** Groups objects into the `genericObjects` / `loyaltyObjects` / `boardingPassObjects` arrays. */
  static groupObjects(objects: GoogleWalletObject[]): Record<string, unknown[]> {
    const grouped: Record<string, unknown[]> = {};
    for (const entry of objects) {
      const key =
        entry.kind === 'generic'
          ? 'genericObjects'
          : entry.kind === 'loyalty'
            ? 'loyaltyObjects'
            : 'boardingPassObjects';
      const { extra, ...rest } = entry.object as unknown as Record<string, unknown> & {
        extra?: Record<string, unknown>;
      };
      (grouped[key] ??= []).push({ ...rest, ...(extra ?? {}) });
    }
    return grouped;
  }

  /** The `passTypeIdentifier:serialNumber` id the client uses to track this pass. */
  static passIdFor(object: { id: string; classId: string }): string {
    return `${object.classId}:${object.id}`;
  }
}

function b64url(value: string): string {
  return base64ToUrl(Buffer.from(value, 'utf8').toString('base64'));
}

function base64ToUrl(value: string): string {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
