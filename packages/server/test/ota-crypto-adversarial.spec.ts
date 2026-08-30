import { describe, it, expect } from 'vitest';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  generateEd25519KeyPair,
  signEd25519,
  verifyEd25519,
  computeSha256,
  computeFileSha256,
  OtaCryptoService,
  ED25519_SPKI_PREFIX,
} from '../src/ota/services/ota-crypto.service';
import { InvalidKeyError, InvalidSignatureError } from '../src/ota/types/ota.types';

describe('Ed25519 Cryptographic Pipeline Adversarial Challenge Suite', () => {
  const service = new OtaCryptoService();

  // =========================================================================
  // 1. EXHAUSTIVE 1-BIT MUTATION SWEEPS (Signature & Payload)
  // =========================================================================
  describe('1. Exhaustive 1-Bit Mutation Sweeps', () => {
    it('should strictly reject signature for 1-bit mutations across all 64 bytes (512 total bit flips)', () => {
      const kp = generateEd25519KeyPair('bit-mutation-test');
      const payload = Buffer.from('CRITICAL_SYSTEM_FIRMWARE_PAYLOAD_V2_INTEGRITY_CHECK_2026');
      const validSigBase64 = signEd25519(payload, kp.privateKeyPem);
      const rawSig = Buffer.from(validSigBase64, 'base64');
      expect(rawSig.length).toBe(64);

      let rejectedCount = 0;
      let totalTests = 0;

      // Exhaustively test every byte (0..63) and every bit (0..7)
      for (let byteIdx = 0; byteIdx < rawSig.length; byteIdx++) {
        for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
          totalTests++;
          const mutatedSig = Buffer.from(rawSig);
          mutatedSig[byteIdx] ^= 1 << bitIdx;

          const mutatedBase64 = mutatedSig.toString('base64');

          // Verify with PEM, raw Base64, and Hex public keys
          const isValidPem = verifyEd25519(payload, mutatedBase64, kp.publicKeyPem);
          const isValidBase64 = verifyEd25519(payload, mutatedBase64, kp.publicKeyBase64);

          if (!isValidPem && !isValidBase64) {
            rejectedCount++;
          }
        }
      }

      expect(totalTests).toBe(512);
      expect(rejectedCount).toBe(512);
    });

    it('should strictly reject signature for 1-bit mutations across all payload bytes', () => {
      const kp = generateEd25519KeyPair('payload-bit-mutation');
      const payload = Buffer.from('PAYLOAD_TO_MUTATE_ACROSS_EVERY_SINGLE_BIT_POSITION_64_BYTES_DATA');
      const signature = signEd25519(payload, kp.privateKeyPem);
      const originalSha = computeSha256(payload);

      let rejectedCount = 0;
      let shaChangedCount = 0;
      const totalTests = payload.length * 8;

      for (let byteIdx = 0; byteIdx < payload.length; byteIdx++) {
        for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
          const mutatedPayload = Buffer.from(payload);
          mutatedPayload[byteIdx] ^= 1 << bitIdx;

          const isValid = verifyEd25519(mutatedPayload, signature, kp.publicKeyPem);
          const mutatedSha = computeSha256(mutatedPayload);

          if (!isValid) rejectedCount++;
          if (mutatedSha !== originalSha) shaChangedCount++;
        }
      }

      expect(rejectedCount).toBe(totalTests);
      expect(shaChangedCount).toBe(totalTests);
    });

    it('should reject signature when payload has byte insertions or truncations', () => {
      const kp = generateEd25519KeyPair();
      const payload = Buffer.from('STANDARD_OTA_BUNDLE_STREAM');
      const signature = signEd25519(payload, kp.privateKeyPem);

      // Truncate 1 byte from end
      const truncatedEnd = payload.subarray(0, payload.length - 1);
      expect(verifyEd25519(truncatedEnd, signature, kp.publicKeyPem)).toBe(false);

      // Truncate 1 byte from start
      const truncatedStart = payload.subarray(1);
      expect(verifyEd25519(truncatedStart, signature, kp.publicKeyPem)).toBe(false);

      // Append 1 byte
      const appended = Buffer.concat([payload, Buffer.from([0x00])]);
      expect(verifyEd25519(appended, signature, kp.publicKeyPem)).toBe(false);

      // Prepend 1 byte
      const prepended = Buffer.concat([Buffer.from([0x00]), payload]);
      expect(verifyEd25519(prepended, signature, kp.publicKeyPem)).toBe(false);

      // Insert byte in middle
      const inserted = Buffer.concat([
        payload.subarray(0, 10),
        Buffer.from([0xff]),
        payload.subarray(10),
      ]);
      expect(verifyEd25519(inserted, signature, kp.publicKeyPem)).toBe(false);
    });
  });

  // =========================================================================
  // 2. KEY CONFUSION & ALGORITHM CONFUSION ATTACKS
  // =========================================================================
  describe('2. Key Confusion & Cross-Algorithm Attacks', () => {
    it('should reject verification when given RSA-2048 public key PEM instead of Ed25519', () => {
      const kpEd = generateEd25519KeyPair('ed-key');
      const payload = Buffer.from('Important payload');
      const signature = signEd25519(payload, kpEd.privateKeyPem);

      // Generate RSA KeyPair
      const { publicKey: rsaPublicPem } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      // Verify should return false, never throw or pass
      expect(verifyEd25519(payload, signature, rsaPublicPem)).toBe(false);
    });

    it('should reject verification when given ECDSA (P-256 / secp256k1) public key PEM', () => {
      const kpEd = generateEd25519KeyPair('ed-key');
      const payload = Buffer.from('Important payload');
      const signature = signEd25519(payload, kpEd.privateKeyPem);

      // Generate ECDSA KeyPair
      const { publicKey: ecPublicPem } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      expect(verifyEd25519(payload, signature, ecPublicPem)).toBe(false);
    });

    it('should reject verification with corrupted SPKI DER prefixes', () => {
      const kp = generateEd25519KeyPair();
      const payload = Buffer.from('Data payload');
      const signature = signEd25519(payload, kp.privateKeyPem);
      const rawPub = Buffer.from(kp.publicKeyBase64, 'base64');

      // Test every byte mutation in the 12-byte ED25519_SPKI_PREFIX
      for (let i = 0; i < ED25519_SPKI_PREFIX.length; i++) {
        const corruptPrefix = Buffer.from(ED25519_SPKI_PREFIX);
        corruptPrefix[i] ^= 0xff; // Invert byte

        const corruptDer = Buffer.concat([corruptPrefix, rawPub]);
        // Pass as raw buffer
        expect(verifyEd25519(payload, signature, corruptDer)).toBe(false);
      }
    });

    it('should safely reject keys with trailing or prepended garbage bytes', () => {
      const kp = generateEd25519KeyPair();
      const payload = Buffer.from('Payload');
      const signature = signEd25519(payload, kp.privateKeyPem);
      const rawPub = Buffer.from(kp.publicKeyBase64, 'base64');

      // 33 bytes (1 extra byte)
      const extendedPub = Buffer.concat([rawPub, Buffer.from([0x00])]);
      expect(verifyEd25519(payload, signature, extendedPub)).toBe(false);
      expect(verifyEd25519(payload, signature, extendedPub.toString('base64'))).toBe(false);

      // 31 bytes (1 byte short)
      const truncatedPub = rawPub.subarray(0, 31);
      expect(verifyEd25519(payload, signature, truncatedPub)).toBe(false);
      expect(verifyEd25519(payload, signature, truncatedPub.toString('base64'))).toBe(false);

      // 63 bytes & 65 bytes
      expect(verifyEd25519(payload, signature, Buffer.alloc(63))).toBe(false);
      expect(verifyEd25519(payload, signature, Buffer.alloc(65))).toBe(false);
    });

    it('should safely reject hostile input strings in public key (injection, special chars, null bytes)', () => {
      const payload = Buffer.from('Data');
      const dummySig = Buffer.alloc(64).toString('base64');

      const hostileInputs = [
        '\x00'.repeat(32),
        '../../../etc/passwd',
        "'; DROP TABLE ota_releases; --",
        '<script>alert(1)</script>',
        '🔥'.repeat(32),
        'A'.repeat(100000), // Very long string
        '-----BEGIN PUBLIC KEY-----\nMIIB...malformed...==\n-----END PUBLIC KEY-----',
        '0123456789abcdef'.repeat(4) + 'g', // 65 chars, non-hex 'g'
        '0123456789abcdef'.repeat(3) + '1234567', // 55 chars hex
        'undefined',
        'null',
        '[object Object]',
        '==invalid-base64==',
      ];

      for (const input of hostileInputs) {
        expect(() => verifyEd25519(payload, dummySig, input)).not.toThrow();
        expect(verifyEd25519(payload, dummySig, input)).toBe(false);
      }
    });
  });

  // =========================================================================
  // 3. PRIVATE KEY SIGNING ERROR HANDLING & BOUNDARIES
  // =========================================================================
  describe('3. Private Key Signing Boundaries & Error Trapping', () => {
    it('should throw InvalidKeyError when private key is null, empty, or invalid type', () => {
      const payload = Buffer.from('Data');

      expect(() => signEd25519(payload, '' as any)).toThrow(InvalidKeyError);
      expect(() => signEd25519(payload, null as any)).toThrow(InvalidKeyError);
      expect(() => signEd25519(payload, undefined as any)).toThrow(InvalidKeyError);
      expect(() => signEd25519(payload, 12345 as any)).toThrow(InvalidKeyError);
    });

    it('should throw InvalidSignatureError when given malformed private key PEM or public key as private key', () => {
      const payload = Buffer.from('Data');

      // Malformed PEM
      expect(() => signEd25519(payload, '-----BEGIN PRIVATE KEY-----\nGARBAGE\n-----END PRIVATE KEY-----')).toThrow(InvalidSignatureError);

      // Public key PEM passed as private key
      const kp = generateEd25519KeyPair();
      expect(() => signEd25519(payload, kp.publicKeyPem)).toThrow(InvalidSignatureError);
    });

    it('documents empirical behavior when RSA or ECDSA private key is passed to signEd25519', () => {
      const payload = Buffer.from('Data');

      // RSA Private Key produces 256-byte signature
      const { privateKey: rsaPrivatePem } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      const rsaSigBase64 = signEd25519(payload, rsaPrivatePem);
      const rsaSigBuf = Buffer.from(rsaSigBase64, 'base64');
      expect(rsaSigBuf.length).toBe(256); // 256 bytes instead of 64 bytes

      // Verification under authentic Ed25519 public key strictly rejects the 256-byte RSA signature
      const edKp = generateEd25519KeyPair();
      expect(verifyEd25519(payload, rsaSigBase64, edKp.publicKeyPem)).toBe(false);
      expect(verifyEd25519(payload, rsaSigBase64, edKp.publicKeyBase64)).toBe(false);

      // ECDSA Private Key: either throws InvalidSignatureError (Bun/BoringSSL) or produces ~71B ASN.1 DER (Node/OpenSSL)
      const { privateKey: ecPrivatePem } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      try {
        const ecSigBase64 = signEd25519(payload, ecPrivatePem);
        expect(verifyEd25519(payload, ecSigBase64, edKp.publicKeyPem)).toBe(false);
      } catch (err: any) {
        expect(err).toBeInstanceOf(InvalidSignatureError);
      }
    });
  });

  // =========================================================================
  // 4. HIGH CONCURRENCY STRESS & RACE CONDITION TESTING
  // =========================================================================
  describe('4. High Concurrency & Massive Parallelism Stress', () => {
    it('should execute 500 simultaneous sign and verify operations without state bleed or race conditions', async () => {
      const keypairs = Array.from({ length: 10 }, (_, i) => generateEd25519KeyPair(`concurrent-kp-${i}`));
      const CONCURRENCY_COUNT = 500;

      const tasks = Array.from({ length: CONCURRENCY_COUNT }, (_, idx) => {
        const kp = keypairs[idx % keypairs.length];
        const payloadSize = (idx % 20 + 1) * 512; // 512B to 10KB
        const payload = crypto.randomBytes(payloadSize);
        const shouldCorrupt = idx % 5 === 0; // 20% of requests intentionally corrupted

        return (async () => {
          const sig = signEd25519(payload, kp.privateKeyPem);
          let testSig = sig;
          if (shouldCorrupt) {
            const sigBuf = Buffer.from(sig, 'base64');
            sigBuf[idx % 64] ^= 0xaa;
            testSig = sigBuf.toString('base64');
          }

          // Test verification with both PEM and raw base64
          const validPem = verifyEd25519(payload, testSig, kp.publicKeyPem);
          const validBase64 = verifyEd25519(payload, testSig, kp.publicKeyBase64);

          // Verify SHA-256
          const sha = computeSha256(payload);
          const expectedSha = crypto.createHash('sha256').update(payload).digest('hex');

          return {
            idx,
            expectedValid: !shouldCorrupt,
            validPem,
            validBase64,
            shaMatches: sha === expectedSha,
          };
        })();
      });

      const results = await Promise.all(tasks);
      expect(results.length).toBe(CONCURRENCY_COUNT);

      for (const res of results) {
        expect(res.validPem).toBe(res.expectedValid);
        expect(res.validBase64).toBe(res.expectedValid);
        expect(res.shaMatches).toBe(true);
      }
    });

    it('should handle 1,000 rapid sequential key generation calls with zero collision in keyId or public keys', () => {
      const COUNT = 1000;
      const keyIds = new Set<string>();
      const pubKeys = new Set<string>();

      for (let i = 0; i < COUNT; i++) {
        const kp = generateEd25519KeyPair();
        expect(keyIds.has(kp.keyId)).toBe(false);
        expect(pubKeys.has(kp.publicKeyBase64)).toBe(false);
        keyIds.add(kp.keyId);
        pubKeys.add(kp.publicKeyBase64);
      }

      expect(keyIds.size).toBe(COUNT);
      expect(pubKeys.size).toBe(COUNT);
    });
  });

  // =========================================================================
  // 5. TIMING AND PERFORMANCE STRESS
  // =========================================================================
  describe('5. Timing, ReDoS & Performance Safety', () => {
    it('should not exhibit ReDoS or catastrophic slowdown on pathological strings in verify()', () => {
      const payload = Buffer.from('Test Data');
      const dummySig = Buffer.alloc(64).toString('base64');

      // Test regex `/^[0-9a-fA-F]{64}$/` against very long hex-like strings
      const longHexPrefix = 'a'.repeat(200000) + '!';
      const t0 = performance.now();
      const res = verifyEd25519(payload, dummySig, longHexPrefix);
      const elapsed = performance.now() - t0;

      expect(res).toBe(false);
      expect(elapsed).toBeLessThan(100); // Must resolve in < 100ms
    });

    it('should verify signatures within tight latency bounds (< 5ms per signature on modern runtime)', () => {
      const kp = generateEd25519KeyPair();
      const payload = crypto.randomBytes(4096);
      const sig = signEd25519(payload, kp.privateKeyPem);

      const iterations = 100;
      const t0 = performance.now();
      for (let i = 0; i < iterations; i++) {
        const valid = verifyEd25519(payload, sig, kp.publicKeyPem);
        expect(valid).toBe(true);
      }
      const avgMs = (performance.now() - t0) / iterations;

      expect(avgMs).toBeLessThan(5.0); // Sub-5ms verification bound
    });
  });

  // =========================================================================
  // 6. FILE SHA-256 HASHING STREAMING & ERROR ROBUSTNESS
  // =========================================================================
  describe('6. File SHA-256 Hashing Streaming & Error Robustness', () => {
    it('should compute exact SHA-256 for empty file and 10MB binary file', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ota-crypto-test-'));
      const emptyFile = path.join(tmpDir, 'empty.bin');
      const largeFile = path.join(tmpDir, 'large.bin');

      try {
        fs.writeFileSync(emptyFile, Buffer.alloc(0));
        const emptySha = await computeFileSha256(emptyFile);
        expect(emptySha).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

        const largeBuffer = crypto.randomBytes(10 * 1024 * 1024); // 10MB
        fs.writeFileSync(largeFile, largeBuffer);
        const largeSha = await computeFileSha256(largeFile);
        const expectedSha = computeSha256(largeBuffer);
        expect(largeSha).toBe(expectedSha);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('should reject computeFileSha256 promise with ENOENT for non-existent file', async () => {
      const nonExistent = `/non_existent_path_${Date.now()}_file.bin`;
      await expect(computeFileSha256(nonExistent)).rejects.toThrow();
    });
  });
});
