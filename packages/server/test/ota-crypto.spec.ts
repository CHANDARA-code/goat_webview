import { describe, it, expect } from 'vitest';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createGoatServer } from '../src/server';
import {
  generateEd25519KeyPair,
  signEd25519,
  verifyEd25519,
  computeSha256,
  OtaCryptoService,
} from '../src/ota/services/ota-crypto.service';

describe('Ed25519 Cryptographic Signing & SHA-256 Integrity Suite', () => {
  // =========================================================================
  // TIER 1: FEATURE COVERAGE (Category-Partition)
  // =========================================================================
  describe('Tier 1: Feature Coverage (Category-Partition)', () => {
    it('F2-T1-1: should generate valid Ed25519 keypair with PEM and 32-byte raw base64 representations', () => {
      const kp = generateEd25519KeyPair('test-key-2026');

      expect(kp.keyId).toBe('test-key-2026');
      expect(kp.publicKeyPem).toContain('-----BEGIN PUBLIC KEY-----');
      expect(kp.publicKeyPem).toContain('-----END PUBLIC KEY-----');
      expect(kp.privateKeyPem).toContain('-----BEGIN PRIVATE KEY-----');
      expect(kp.privateKeyPem).toContain('-----END PRIVATE KEY-----');

      const rawPubBuf = Buffer.from(kp.publicKeyBase64, 'base64');
      expect(rawPubBuf.length).toBe(32);
      expect(kp.publicKeyBase64.length).toBe(44);
    });

    it('F2-T1-2: should sign and verify arbitrary data buffer with PEM public key', () => {
      const kp = generateEd25519KeyPair();
      const payload = Buffer.from('Goat OTA Release Bundle v1.4.0 payload with embedded webview assets');

      const signature = signEd25519(payload, kp.privateKeyPem);
      expect(typeof signature).toBe('string');
      expect(Buffer.from(signature, 'base64').length).toBe(64);

      const isValid = verifyEd25519(payload, signature, kp.publicKeyPem);
      expect(isValid).toBe(true);
    });

    it('F2-T1-3: should verify signature using raw 32-byte base64 public key representation', () => {
      const kp = generateEd25519KeyPair();
      const payload = Buffer.from('BSDIFF40 binary differential patch stream content');

      const signature = signEd25519(payload, kp.privateKeyPem);
      const isValid = verifyEd25519(payload, signature, kp.publicKeyBase64);
      expect(isValid).toBe(true);
    });

    it('F2-T1-4: should compute exact 64-char lowercase hexadecimal SHA-256 digest', () => {
      const payload = Buffer.from('Goat WebView OTA Integrity Check');
      const hash = computeSha256(payload);

      expect(hash).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
      expect(hash).toBe(crypto.createHash('sha256').update(payload).digest('hex').toLowerCase());
    });

    it('F2-T1-5: should strictly reject signature when payload is modified by 1 bit', () => {
      const kp = generateEd25519KeyPair();
      const originalPayload = Buffer.from('Authentic mini-app bytecode chunk');
      const signature = signEd25519(originalPayload, kp.privateKeyPem);

      const tamperedPayload = Buffer.from(originalPayload);
      tamperedPayload[0] ^= 0x01;

      expect(verifyEd25519(tamperedPayload, signature, kp.publicKeyPem)).toBe(false);
      expect(verifyEd25519(tamperedPayload, signature, kp.publicKeyBase64)).toBe(false);
    });

    it('F2-T1-6: should strictly reject signature when verified against a different public key', () => {
      const kp1 = generateEd25519KeyPair('app-1');
      const kp2 = generateEd25519KeyPair('app-2');
      const payload = Buffer.from('Signed data for tenant app 1');

      const signature = signEd25519(payload, kp1.privateKeyPem);

      expect(verifyEd25519(payload, signature, kp2.publicKeyPem)).toBe(false);
      expect(verifyEd25519(payload, signature, kp2.publicKeyBase64)).toBe(false);
    });

    it('F2-T1-7: should verify signature using 64-char Hex and Buffer public key formats', () => {
      const kp = generateEd25519KeyPair();
      const payload = Buffer.from('Testing hex and buffer public key format interop');
      const signature = signEd25519(payload, kp.privateKeyPem);

      const rawPubBuf = Buffer.from(kp.publicKeyBase64, 'base64');
      const hexPubKey = rawPubBuf.toString('hex');

      expect(verifyEd25519(payload, signature, hexPubKey)).toBe(true);
      expect(verifyEd25519(payload, signature, rawPubBuf)).toBe(true);
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARY AND CORNER CASES (BVA)
  // =========================================================================
  describe('Tier 2: Boundary & Corner Cases (BVA)', () => {
    it('F2-T2-1: should sign and verify 0-byte empty buffer', () => {
      const kp = generateEd25519KeyPair();
      const emptyBuf = Buffer.alloc(0);

      const signature = signEd25519(emptyBuf, kp.privateKeyPem);
      expect(verifyEd25519(emptyBuf, signature, kp.publicKeyPem)).toBe(true);
    });

    it('F2-T2-2: should sign and verify large 5MB binary buffer', () => {
      const kp = generateEd25519KeyPair();
      const largeBuf = crypto.randomBytes(5 * 1024 * 1024); // 5 MB

      const signature = signEd25519(largeBuf, kp.privateKeyPem);
      expect(verifyEd25519(largeBuf, signature, kp.publicKeyPem)).toBe(true);
    });

    it('F2-T2-3: should verify all-zero and all-0xFF buffers', () => {
      const kp = generateEd25519KeyPair();
      const allZeros = Buffer.alloc(65536, 0x00);
      const allOnes = Buffer.alloc(65536, 0xff);

      const sigZeros = signEd25519(allZeros, kp.privateKeyPem);
      const sigOnes = signEd25519(allOnes, kp.privateKeyPem);

      expect(verifyEd25519(allZeros, sigZeros, kp.publicKeyPem)).toBe(true);
      expect(verifyEd25519(allOnes, sigOnes, kp.publicKeyPem)).toBe(true);
    });

    it('F2-T2-4: should reject malformed or truncated signature strings without crashing', () => {
      const kp = generateEd25519KeyPair();
      const payload = Buffer.from('Test Data');

      expect(verifyEd25519(payload, '', kp.publicKeyPem)).toBe(false);
      expect(verifyEd25519(payload, 'not-base64!@#$', kp.publicKeyPem)).toBe(false);
      expect(verifyEd25519(payload, Buffer.alloc(32).toString('base64'), kp.publicKeyPem)).toBe(false);
      expect(verifyEd25519(payload, Buffer.alloc(128).toString('base64'), kp.publicKeyPem)).toBe(false);
    });

    it('F2-T2-5: should reject malformed public keys without throwing unhandled exceptions', () => {
      const payload = Buffer.from('Test Data');
      const dummySig = Buffer.alloc(64).toString('base64');

      expect(verifyEd25519(payload, dummySig, '')).toBe(false);
      expect(verifyEd25519(payload, dummySig, 'invalid_key_string')).toBe(false);
      expect(verifyEd25519(payload, dummySig, '-----BEGIN PUBLIC KEY-----\nCorruptedKeyContent\n-----END PUBLIC KEY-----')).toBe(false);
    });

    it('F2-T2-6: should match NIST standard SHA-256 for empty buffer', () => {
      const emptyBuf = Buffer.alloc(0);
      const hash = computeSha256(emptyBuf);
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('F2-T2-7: should sign and verify Unicode, emoji, and binary control characters', () => {
      const kp = generateEd25519KeyPair();
      const utf8Data = Buffer.from('🐐 Goat WebView 🚀 汉语 / 日本語 / Русский \x00\x01\x1b\x7f\xff', 'utf-8');

      const signature = signEd25519(utf8Data, kp.privateKeyPem);
      expect(verifyEd25519(utf8Data, signature, kp.publicKeyPem)).toBe(true);
    });

    it('F2-T2-8: should generate unique keypairs on successive calls', () => {
      const kp1 = generateEd25519KeyPair();
      const kp2 = generateEd25519KeyPair();

      expect(kp1.publicKeyPem).not.toBe(kp2.publicKeyPem);
      expect(kp1.privateKeyPem).not.toBe(kp2.privateKeyPem);
      expect(kp1.publicKeyBase64).not.toBe(kp2.publicKeyBase64);
      expect(kp1.keyId).not.toBe(kp2.keyId);
    });
  });

  // =========================================================================
  // TIER 3: PAIRWISE COMBINATORIAL INTERACTIONS
  // =========================================================================
  describe('Tier 3: Pairwise Combinatorial Interactions', () => {
    it('F2-T3-1: should sign and verify across 5 distinct key rotations and payload types', () => {
      const keypairs = Array.from({ length: 5 }, (_, i) => generateEd25519KeyPair(`rotation-${i + 1}`));
      const payloads = [
        { type: 'Full Zip Bundle', data: Buffer.from('PK\x03\x04...mock_zip_archive_data...') },
        { type: 'BSDIFF40 Patch', data: Buffer.from('BSDIFF40...mock_patch_binary_stream...') },
        { type: 'JSON Manifest', data: Buffer.from('{"version":"2.0.0","mandatory":true}') },
      ];

      for (const kp of keypairs) {
        for (const p of payloads) {
          const sig = signEd25519(p.data, kp.privateKeyPem);
          expect(verifyEd25519(p.data, sig, kp.publicKeyPem)).toBe(true);
          expect(verifyEd25519(p.data, sig, kp.publicKeyBase64)).toBe(true);
        }
      }
    });

    it('F2-T3-2: should handle 100 concurrent asynchronous signing operations without collision', async () => {
      const kp = generateEd25519KeyPair();
      const ops = Array.from({ length: 100 }, (_, idx) => {
        const data = Buffer.from(`Concurrent Payload Transaction #${idx} timestamp=${Date.now()}`);
        return (async () => {
          const sig = signEd25519(data, kp.privateKeyPem);
          const valid = verifyEd25519(data, sig, kp.publicKeyPem);
          return { valid, idx };
        })();
      });

      const results = await Promise.all(ops);
      expect(results.length).toBe(100);
      expect(results.every((r) => r.valid)).toBe(true);
    });
  });

  // =========================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS
  // =========================================================================
  describe('Tier 4: Real-World Application Scenario', () => {
    it('F2-T4-1: Active Adversary Attack Defense (MITM payload alteration & signature forgery)', () => {
      const serverKeyPair = generateEd25519KeyPair('goat-server-prod-2026');
      const genuineBundle = Buffer.from('GENUINE_GOAT_WEBVIEW_MINIAPP_BUNDLE_V2.0.0_JS_BYTECODE');
      const genuineSignature = signEd25519(genuineBundle, serverKeyPair.privateKeyPem);
      const genuineSha256 = computeSha256(genuineBundle);

      const trustedClientPublicKey = serverKeyPair.publicKeyPem;

      const adversaryBundle = Buffer.from('MALICIOUS_TAMPERED_BUNDLE_WITH_EXPLOIT_PAYLOAD');

      // Attack Vector A: Attacker forwards original genuine signature with tampered bundle
      const vectorA_Result = verifyEd25519(adversaryBundle, genuineSignature, trustedClientPublicKey);
      expect(vectorA_Result).toBe(false);

      // Attack Vector B: Attacker generates their own rogue Ed25519 keypair and signs tampered bundle
      const rogueKeyPair = generateEd25519KeyPair('adversary-fake-key');
      const rogueSignature = signEd25519(adversaryBundle, rogueKeyPair.privateKeyPem);
      const vectorB_Result = verifyEd25519(adversaryBundle, rogueSignature, trustedClientPublicKey);
      expect(vectorB_Result).toBe(false);

      // Attack Vector C: Attacker attempts to forge signature by random bit flipping on genuine signature
      const forgedSigBytes = Buffer.from(genuineSignature, 'base64');
      forgedSigBytes[10] ^= 0x55;
      const forgedSignature = forgedSigBytes.toString('base64');
      const vectorC_Result = verifyEd25519(genuineBundle, forgedSignature, trustedClientPublicKey);
      expect(vectorC_Result).toBe(false);

      // Attack Vector D: Attacker alters SHA-256 target hash
      const adversarySha = computeSha256(adversaryBundle);
      expect(adversarySha).not.toBe(genuineSha256);

      // Client strictly verifies genuine payload
      expect(verifyEd25519(genuineBundle, genuineSignature, trustedClientPublicKey)).toBe(true);
      expect(computeSha256(genuineBundle)).toBe(genuineSha256);
    });

    it('F2-T4-2: OtaCryptoService instance methods work identically to standalone functions', () => {
      const service = new OtaCryptoService();
      const kp = service.generateKeyPair('service-test');
      const data = Buffer.from('Testing service instance methods');

      const sig = service.sign(data, kp.privateKeyPem);
      expect(service.verify(data, sig, kp.publicKeyPem)).toBe(true);
      expect(service.verify(data, sig, kp.publicKeyBase64)).toBe(true);

      const hash = service.computeSha256(data);
      expect(hash).toBe(computeSha256(data));
    });
  });
});

describe('OTA signing key persistence across restarts', () => {
  it('persists a signing key for an app that has no pre-existing ota_apps row', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'goat-ota-key-'));
    const dbPath = path.join(dir, 'ota.db');
    const appId = 'com.goat.freshkey';
    try {
      const first = createGoatServer({ port: 0, cdpPort: 0, safariPort: 0, dbPath, inMemoryDb: false });
      const firstKey = first.otaService.getOrCreateAppSigningKey(appId);
      expect(firstKey.publicKeyPem).toContain('-----BEGIN PUBLIC KEY-----');
      first.dbService.close();

      const second = createGoatServer({ port: 0, cdpPort: 0, safariPort: 0, dbPath, inMemoryDb: false });
      try {
        const secondKey = second.otaService.getOrCreateAppSigningKey(appId);
        expect(secondKey.keyId).toBe(firstKey.keyId);
        expect(secondKey.publicKeyPem).toBe(firstKey.publicKeyPem);

        const payload = Buffer.from('bundle signed before the restart');
        const signature = signEd25519(payload, firstKey.privateKeyPem);
        expect(verifyEd25519(payload, signature, secondKey.publicKeyPem)).toBe(true);
      } finally {
        second.dbService.close();
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
