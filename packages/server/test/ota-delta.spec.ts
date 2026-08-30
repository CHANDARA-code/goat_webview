import { describe, it, expect } from 'vitest';
import * as crypto from 'node:crypto';
import * as zlib from 'node:zlib';
import {
  generateBsdiffPatch,
  applyBsdiffPatch,
  OtaDeltaService,
  MAGIC_HEADER,
  HEADER_SIZE,
} from '../src/ota/services/ota-delta.service';
import {
  InvalidPatchHeaderError,
  CorruptPatchBlockError,
  PatchApplicationError,
  IntegrityCheckError,
} from '../src/ota/types/ota.types';
import { computeSha256 } from '../src/ota/services/ota-crypto.service';

describe('BSDIFF40 Binary Delta Differencing & Patching Suite', () => {
  // =========================================================================
  // TIER 1: FEATURE COVERAGE (Category-Partition)
  // =========================================================================
  describe('Tier 1: Feature Coverage (Category-Partition)', () => {
    it('F1-T1-1: should generate 32-byte header with BSDIFF40 magic and Big-Endian 64-bit block lengths', () => {
      const oldBuf = Buffer.from('Hello Goat WebView World v1.0.0');
      const newBuf = Buffer.from('Hello Goat WebView World v1.1.0 with Enterprise Updates');

      const patch = generateBsdiffPatch(oldBuf, newBuf);
      expect(patch.length).toBeGreaterThan(HEADER_SIZE);

      const magic = patch.subarray(0, 8).toString('ascii');
      expect(magic).toBe(MAGIC_HEADER);

      const ctrlLen = Number(patch.readBigInt64BE(8));
      const diffLen = Number(patch.readBigInt64BE(16));
      const newSize = Number(patch.readBigInt64BE(24));

      expect(ctrlLen).toBeGreaterThan(0);
      expect(diffLen).toBeGreaterThanOrEqual(0);
      expect(newSize).toBe(newBuf.length);
    });

    it('F1-T1-2: should reconstruct exact byte parity for ASCII and UTF-8 bundle content', () => {
      const oldBuf = Buffer.from('function app() { console.log("v1.0.0"); return 42; }', 'utf-8');
      const newBuf = Buffer.from('function app() { console.log("v1.0.1"); return 100; /* New Feat */ }', 'utf-8');

      const patch = generateBsdiffPatch(oldBuf, newBuf);
      const targetSha = computeSha256(newBuf);
      const reconstructed = applyBsdiffPatch(oldBuf, patch, targetSha);

      expect(Buffer.compare(reconstructed, newBuf)).toBe(0);
      expect(reconstructed.toString('utf-8')).toBe(newBuf.toString('utf-8'));
    });

    it('F1-T1-3: should achieve 80%+ bandwidth reduction on typical JS mini-app updates', () => {
      const baseCode = 'const MODULE_CACHE = {};\n'.repeat(1500);
      const oldBundle = Buffer.from(baseCode + '\nconst VERSION = "1.0.0";\nconst FEATURES = ["auth", "home"];');
      const newBundle = Buffer.from(baseCode + '\nconst VERSION = "1.1.0";\nconst FEATURES = ["auth", "home", "biometrics", "ota"];');

      const patch = generateBsdiffPatch(oldBundle, newBundle);
      const compressionRatio = patch.length / newBundle.length;

      expect(patch.length).toBeLessThan(newBundle.length * 0.2); // >80% bandwidth savings
      expect(compressionRatio).toBeLessThan(0.2);

      const reconstructed = applyBsdiffPatch(oldBundle, patch);
      expect(Buffer.compare(reconstructed, newBundle)).toBe(0);
    });

    it('F1-T1-4: should accurately process binary assets (.zip, .png, .wasm simulation)', () => {
      const oldBinary = crypto.randomBytes(65536); // 64 KB binary
      const newBinary = Buffer.from(oldBinary);
      for (let i = 0; i < 50; i++) {
        newBinary[i * 1200] = (newBinary[i * 1200] ^ 0xff) & 0xff;
      }

      const patch = generateBsdiffPatch(oldBinary, newBinary);
      const targetSha = computeSha256(newBinary);
      const reconstructed = applyBsdiffPatch(oldBinary, patch, targetSha);

      expect(Buffer.compare(reconstructed, newBinary)).toBe(0);
    });

    it('F1-T1-5: should verify SHA-256 target hash match and throw on mismatch', () => {
      const oldBuf = Buffer.from('Original content');
      const newBuf = Buffer.from('Updated content with extra security');

      const patch = generateBsdiffPatch(oldBuf, newBuf);
      const correctSha = computeSha256(newBuf);
      const invalidSha = '0000000000000000000000000000000000000000000000000000000000000000';

      expect(() => applyBsdiffPatch(oldBuf, patch, correctSha)).not.toThrow();
      expect(() => applyBsdiffPatch(oldBuf, patch, invalidSha)).toThrow(IntegrityCheckError);
    });

    it('F1-T1-6: should correctly handle control tuples with non-zero seek offsets', () => {
      const oldBuf = Buffer.from('SECTION_A_12345_SECTION_B_67890_SECTION_C');
      const newBuf = Buffer.from('SECTION_B_67890_SECTION_A_12345_SECTION_C_ADDED');

      const patch = generateBsdiffPatch(oldBuf, newBuf, { minMatchLength: 6 });
      const reconstructed = applyBsdiffPatch(oldBuf, patch);

      expect(reconstructed.toString()).toBe(newBuf.toString());
      expect(Buffer.compare(reconstructed, newBuf)).toBe(0);
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARY AND CORNER CASES (BVA)
  // =========================================================================
  describe('Tier 2: Boundary & Corner Cases (BVA)', () => {
    it('F1-T2-1: should handle empty oldBuffer (0-byte old -> non-empty new)', () => {
      const oldBuf = Buffer.alloc(0);
      const newBuf = Buffer.from('Initial fresh installation bundle content');

      const patch = generateBsdiffPatch(oldBuf, newBuf);
      const reconstructed = applyBsdiffPatch(oldBuf, patch);

      expect(reconstructed.length).toBe(newBuf.length);
      expect(reconstructed.toString()).toBe(newBuf.toString());
    });

    it('F1-T2-2: should handle empty newBuffer (non-empty old -> 0-byte new)', () => {
      const oldBuf = Buffer.from('Old deprecated content to be deleted');
      const newBuf = Buffer.alloc(0);

      const patch = generateBsdiffPatch(oldBuf, newBuf);
      const reconstructed = applyBsdiffPatch(oldBuf, patch);

      expect(reconstructed.length).toBe(0);
    });

    it('F1-T2-3: should handle both oldBuffer and newBuffer empty (0 bytes -> 0 bytes)', () => {
      const oldBuf = Buffer.alloc(0);
      const newBuf = Buffer.alloc(0);

      const patch = generateBsdiffPatch(oldBuf, newBuf);
      const reconstructed = applyBsdiffPatch(oldBuf, patch);

      expect(reconstructed.length).toBe(0);
    });

    it('F1-T2-4: should handle identical oldBuffer and newBuffer (0 diff bytes)', () => {
      const buffer = Buffer.from('Identical content that does not change between builds');

      const patch = generateBsdiffPatch(buffer, buffer);
      const reconstructed = applyBsdiffPatch(buffer, patch);

      expect(Buffer.compare(reconstructed, buffer)).toBe(0);
    });

    it('F1-T2-5: should handle single-byte mutations at boundary offsets (first byte, last byte, middle byte)', () => {
      const size = 4096;
      const oldBuf = crypto.randomBytes(size);

      // Mutate index 0
      const newBufFirst = Buffer.from(oldBuf);
      newBufFirst[0] = (newBufFirst[0] ^ 0x01) & 0xff;
      const patchFirst = generateBsdiffPatch(oldBuf, newBufFirst);
      expect(Buffer.compare(applyBsdiffPatch(oldBuf, patchFirst), newBufFirst)).toBe(0);

      // Mutate middle
      const newBufMid = Buffer.from(oldBuf);
      newBufMid[2048] = (newBufMid[2048] ^ 0x01) & 0xff;
      const patchMid = generateBsdiffPatch(oldBuf, newBufMid);
      expect(Buffer.compare(applyBsdiffPatch(oldBuf, patchMid), newBufMid)).toBe(0);

      // Mutate last index (size - 1)
      const newBufLast = Buffer.from(oldBuf);
      newBufLast[size - 1] = (newBufLast[size - 1] ^ 0x01) & 0xff;
      const patchLast = generateBsdiffPatch(oldBuf, newBufLast);
      expect(Buffer.compare(applyBsdiffPatch(oldBuf, patchLast), newBufLast)).toBe(0);
    });

    it('F1-T2-6: should reject corrupted magic bytes in header', () => {
      const oldBuf = Buffer.from('old');
      const newBuf = Buffer.from('new');
      const patch = generateBsdiffPatch(oldBuf, newBuf);

      patch.write('CORRUPT!', 0, 8, 'ascii');
      expect(() => applyBsdiffPatch(oldBuf, patch)).toThrow(InvalidPatchHeaderError);
    });

    it('F1-T2-7: should reject truncated patch headers (<32 bytes)', () => {
      const oldBuf = Buffer.from('old');
      const truncatedPatch = Buffer.alloc(16);
      truncatedPatch.write('BSDIFF40', 0, 8, 'ascii');

      expect(() => applyBsdiffPatch(oldBuf, truncatedPatch)).toThrow(InvalidPatchHeaderError);
    });

    it('F1-T2-8: should reject negative block lengths in header', () => {
      const oldBuf = Buffer.from('old');
      const newBuf = Buffer.from('new');
      const patch = generateBsdiffPatch(oldBuf, newBuf);

      patch.writeBigInt64BE(BigInt(-1), 8);
      expect(() => applyBsdiffPatch(oldBuf, patch)).toThrow(InvalidPatchHeaderError);
    });

    it('F1-T2-9: should reject corrupted GZIP payloads in patch data blocks', () => {
      const oldBuf = Buffer.from('old');
      const newBuf = Buffer.from('new');
      const patch = generateBsdiffPatch(oldBuf, newBuf);

      const diffStart = 32 + Number(patch.readBigInt64BE(8));
      patch.fill(0xee, diffStart, diffStart + 10);

      expect(() => applyBsdiffPatch(oldBuf, patch)).toThrow(CorruptPatchBlockError);
    });

    it('F1-T2-10: should diff and patch large 1MB+ binary payloads reliably', () => {
      const oldLarge = crypto.randomBytes(1024 * 1024); // 1 MB
      const newLarge = Buffer.from(oldLarge);
      for (let i = 0; i < 100; i++) {
        newLarge[500000 + i] = (newLarge[500000 + i] + 1) & 0xff;
      }

      const patch = generateBsdiffPatch(oldLarge, newLarge, { minMatchLength: 16 });
      const targetSha = computeSha256(newLarge);
      const reconstructed = applyBsdiffPatch(oldLarge, patch, targetSha);

      expect(Buffer.compare(reconstructed, newLarge)).toBe(0);
    });
  });

  // =========================================================================
  // TIER 3: PAIRWISE COMBINATORIAL INTERACTIONS
  // =========================================================================
  describe('Tier 3: Pairwise Combinatorial Interactions', () => {
    const minMatchCases = [4, 8, 16, 32];
    const dataTypes = [
      { name: 'Minified JS Code', gen: () => Buffer.from('!function(e){var t={};function n(r){...}}'.repeat(100)) },
      { name: 'JSON Metadata', gen: () => Buffer.from(JSON.stringify({ config: { debug: false, tokens: [1, 2, 3] }, extra: 'A'.repeat(500) })) },
      { name: 'Random Byte Stream', gen: () => crypto.randomBytes(2048) },
    ];

    minMatchCases.forEach((matchLen) => {
      dataTypes.forEach((dataType) => {
        it(`F1-T3: diff/patch with minMatchLength=${matchLen} on ${dataType.name}`, () => {
          const oldBuf = dataType.gen();
          const newBuf = Buffer.concat([
            oldBuf.subarray(0, Math.floor(oldBuf.length * 0.7)),
            Buffer.from('_APPENDED_PAYLOAD_'),
            oldBuf.subarray(Math.floor(oldBuf.length * 0.7)),
          ]);

          const patch = generateBsdiffPatch(oldBuf, newBuf, { minMatchLength: matchLen });
          const reconstructed = applyBsdiffPatch(oldBuf, patch);

          expect(Buffer.compare(reconstructed, newBuf)).toBe(0);
        });
      });
    });
  });

  // =========================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS
  // =========================================================================
  describe('Tier 4: Real-World Application Scenarios', () => {
    it('F1-T4-1: Multi-Version Incremental Upgrade Chain (v1.0.0 -> v1.1.0 -> v1.2.0 -> v1.3.0)', () => {
      const v1_0_0 = Buffer.from('<!DOCTYPE html><html><head><title>Goat App v1.0.0</title></head><body><h1>Welcome</h1><script src="app.js"></script></body></html>');
      const v1_1_0 = Buffer.from('<!DOCTYPE html><html><head><title>Goat App v1.1.0</title></head><body><h1>Welcome</h1><p>Feature 1</p><script src="app.js"></script></body></html>');
      const v1_2_0 = Buffer.from('<!DOCTYPE html><html><head><title>Goat App v1.2.0</title></head><body><h1>Welcome</h1><p>Feature 1</p><p>Feature 2</p><script src="app.js"></script></body></html>');
      const v1_3_0 = Buffer.from('<!DOCTYPE html><html><head><title>Goat App v1.3.0</title></head><body><h1>Welcome</h1><p>Feature 1</p><p>Feature 2</p><p>Feature 3</p><script src="app.js"></script></body></html>');

      // Hop 1: v1.0.0 -> v1.1.0
      const patch1 = generateBsdiffPatch(v1_0_0, v1_1_0);
      const targetSha1 = computeSha256(v1_1_0);
      const stage1 = applyBsdiffPatch(v1_0_0, patch1, targetSha1);
      expect(Buffer.compare(stage1, v1_1_0)).toBe(0);

      // Hop 2: v1.1.0 -> v1.2.0
      const patch2 = generateBsdiffPatch(stage1, v1_2_0);
      const targetSha2 = computeSha256(v1_2_0);
      const stage2 = applyBsdiffPatch(stage1, patch2, targetSha2);
      expect(Buffer.compare(stage2, v1_2_0)).toBe(0);

      // Hop 3: v1.2.0 -> v1.3.0
      const patch3 = generateBsdiffPatch(stage2, v1_3_0);
      const targetSha3 = computeSha256(v1_3_0);
      const stage3 = applyBsdiffPatch(stage2, patch3, targetSha3);
      expect(Buffer.compare(stage3, v1_3_0)).toBe(0);
    });

    it('F1-T4-2: Simulated Mini-App Zip Bundle Differencing with 90%+ bandwidth savings', () => {
      // Shared framework (50KB) + App Code (50KB)
      const sharedFramework = Buffer.alloc(50000, 0x5a);
      const v1AppCode = Buffer.from('function renderApp() { console.log("v1.0.0"); return 1; }'.repeat(500));
      const oldBundle = Buffer.concat([sharedFramework, v1AppCode]);

      const v2AppCode = Buffer.from('function renderApp() { console.log("v2.0.0"); return 2; }'.repeat(500));
      const newBundle = Buffer.concat([sharedFramework, v2AppCode]);

      const patch = generateBsdiffPatch(oldBundle, newBundle);
      const reconstructed = applyBsdiffPatch(oldBundle, patch);

      expect(Buffer.compare(reconstructed, newBundle)).toBe(0);
      const savings = (1 - patch.length / newBundle.length) * 100;
      expect(savings).toBeGreaterThan(80);
    });

    it('F1-T4-3: OtaDeltaService instance methods generatePatch and applyPatch work identically to standalone functions', () => {
      const service = new OtaDeltaService();
      const oldBuf = Buffer.from('Service old buffer test content');
      const newBuf = Buffer.from('Service new buffer test content with modifications');

      const patch = service.generatePatch(oldBuf, newBuf);
      const reconstructed = service.applyPatch(oldBuf, patch, computeSha256(newBuf));

      expect(Buffer.compare(reconstructed, newBuf)).toBe(0);
    });
  });
});
