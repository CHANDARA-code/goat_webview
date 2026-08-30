import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import {
  KeyPairResult,
  InvalidKeyError,
  InvalidSignatureError,
} from '../types/ota.types';

// Standard ASN.1 DER prefix for Ed25519 SubjectPublicKeyInfo (SPKI) - 12 bytes
export const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export class OtaCryptoService {
  public static readonly ED25519_SPKI_PREFIX = ED25519_SPKI_PREFIX;

  /**
   * Generates a new Ed25519 keypair formatted with SPKI PEM, PKCS#8 PEM,
   * raw 32-byte Base64, and unique keyId.
   */
  public generateKeyPair(keyAlias?: string): KeyPairResult {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const spkiDer = crypto.createPublicKey(publicKey).export({ type: 'spki', format: 'der' });
    const rawPublicKey = spkiDer.subarray(spkiDer.length - 32);
    const publicKeyBase64 = rawPublicKey.toString('base64');
    const keyId = keyAlias || `key_${this.computeSha256(rawPublicKey).substring(0, 16)}`;

    return {
      publicKeyPem: publicKey,
      privateKeyPem: privateKey,
      publicKeyBase64,
      keyId,
      keyAlias,
      createdAt: Date.now(),
    };
  }

  /**
   * Signs data buffer with an Ed25519 private key in PEM format.
   * Returns Base64-encoded 64-byte signature.
   */
  public sign(data: Buffer, privateKeyPem: string): string {
    if (!privateKeyPem || typeof privateKeyPem !== 'string') {
      throw new InvalidKeyError('Private key is required for Ed25519 signing');
    }

    try {
      const privateKey = crypto.createPrivateKey(privateKeyPem);
      const signature = crypto.sign(null, data, privateKey);
      return signature.toString('base64');
    } catch (err: any) {
      if (err instanceof InvalidKeyError) throw err;
      throw new InvalidSignatureError(`Ed25519 signing failed: ${err.message || err}`);
    }
  }

  /**
   * Verifies an Ed25519 signature against data and a public key
   * (supports SPKI PEM, raw 32-byte Base64, 64-char Hex, or Buffer).
   */
  public verify(
    data: Buffer,
    signatureBase64: string,
    publicKey: string | Buffer
  ): boolean {
    try {
      if (!signatureBase64 || typeof signatureBase64 !== 'string') {
        return false;
      }
      if (!publicKey) {
        return false;
      }

      let keyObject: crypto.KeyObject;

      if (typeof publicKey === 'string') {
        const trimmed = publicKey.trim();
        if (trimmed.length === 0) return false;

        if (trimmed.includes('-----BEGIN PUBLIC KEY-----')) {
          keyObject = crypto.createPublicKey(trimmed);
        } else if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
          const rawBuf = Buffer.from(trimmed, 'hex');
          const spkiDer = Buffer.concat([ED25519_SPKI_PREFIX, rawBuf]);
          keyObject = crypto.createPublicKey({ key: spkiDer, format: 'der', type: 'spki' });
        } else {
          const rawBuf = Buffer.from(trimmed, 'base64');
          if (rawBuf.length === 32) {
            const spkiDer = Buffer.concat([ED25519_SPKI_PREFIX, rawBuf]);
            keyObject = crypto.createPublicKey({ key: spkiDer, format: 'der', type: 'spki' });
          } else {
            keyObject = crypto.createPublicKey({ key: rawBuf, format: 'der', type: 'spki' });
          }
        }
      } else {
        if (publicKey.length === 32) {
          const spkiDer = Buffer.concat([ED25519_SPKI_PREFIX, publicKey]);
          keyObject = crypto.createPublicKey({ key: spkiDer, format: 'der', type: 'spki' });
        } else {
          keyObject = crypto.createPublicKey({ key: publicKey, format: 'der', type: 'spki' });
        }
      }

      const signature = Buffer.from(signatureBase64, 'base64');
      if (signature.length !== 64) {
        return false;
      }

      return crypto.verify(null, data, keyObject, signature);
    } catch {
      return false;
    }
  }

  /**
   * Computes the SHA-256 hash of a buffer or string as a 64-char lowercase hex string.
   */
  public computeSha256(data: Buffer | string): string {
    const buf = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
    return crypto.createHash('sha256').update(buf).digest('hex').toLowerCase();
  }

  /**
   * Computes the SHA-256 hash of a file on disk.
   */
  public async computeFileSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex').toLowerCase()));
      stream.on('error', reject);
    });
  }
}

// Module-level standalone convenience exports
const defaultCryptoService = new OtaCryptoService();

export function generateEd25519KeyPair(keyAlias?: string): KeyPairResult {
  return defaultCryptoService.generateKeyPair(keyAlias);
}

export function signEd25519(data: Buffer, privateKeyPem: string): string {
  return defaultCryptoService.sign(data, privateKeyPem);
}

export function verifyEd25519(
  data: Buffer,
  signatureBase64: string,
  publicKey: string | Buffer
): boolean {
  return defaultCryptoService.verify(data, signatureBase64, publicKey);
}

export function computeSha256(data: Buffer | string): string {
  return defaultCryptoService.computeSha256(data);
}

export function computeFileSha256(filePath: string): Promise<string> {
  return defaultCryptoService.computeFileSha256(filePath);
}
