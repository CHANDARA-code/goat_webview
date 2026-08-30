import { describe, it, expect } from "vitest";
import * as crypto from "node:crypto";
import * as zlib from "node:zlib";
import {
  generateBsdiffPatch,
  applyBsdiffPatch,
  OtaDeltaService,
  MAGIC_HEADER,
  HEADER_SIZE,
} from "../src/ota/services/ota-delta.service";
import {
  InvalidPatchHeaderError,
  CorruptPatchBlockError,
  PatchApplicationError,
  IntegrityCheckError,
  OtaErrorCode,
} from "../src/ota/types/ota.types";
import { computeSha256 } from "../src/ota/services/ota-crypto.service";

describe("Adversarial & Empirical Stress Verification for BSDIFF40 Delta Engine", () => {
  const deltaService = new OtaDeltaService();

  // =========================================================================
  // ATTACK VECTOR 1: Extreme Buffer Sizes & Pathological Binary Payloads
  // =========================================================================
  describe("Attack Vector 1: Extreme Buffer Sizes & Pathological Binary Payloads", () => {
    it("ADV-1.1: Multi-megabyte (4 MB) random payload with scattered block mutations", () => {
      const size = 4 * 1024 * 1024; // 4 MB
      const oldBuf = crypto.randomBytes(size);
      const newBuf = Buffer.from(oldBuf);

      // Mutate 500 scattered blocks of 16 bytes each
      for (let i = 0; i < 500; i++) {
        const offset = Math.floor(Math.random() * (size - 32));
        for (let j = 0; j < 16; j++) {
          newBuf[offset + j] = (newBuf[offset + j] ^ 0xaa) & 0xff;
        }
      }

      const patch = generateBsdiffPatch(oldBuf, newBuf);
      expect(patch.length).toBeGreaterThan(HEADER_SIZE);

      const targetSha = computeSha256(newBuf);
      const reconstructed = applyBsdiffPatch(oldBuf, patch, targetSha);

      expect(reconstructed.length).toBe(newBuf.length);
      expect(Buffer.compare(reconstructed, newBuf)).toBe(0);
    }, 45000);

    it("ADV-1.2: Pathological all-zero (0x00) 2 MB buffers with middle block replacement", () => {
      const size = 2 * 1024 * 1024; // 2 MB all zeros
      const oldBuf = Buffer.alloc(size, 0);
      const newBuf = Buffer.alloc(size, 0);

      // Replace middle 100 KB with 0xff
      newBuf.fill(0xff, 1024 * 1024, 1024 * 1024 + 100 * 1024);

      const patch = generateBsdiffPatch(oldBuf, newBuf);
      const targetSha = computeSha256(newBuf);
      const reconstructed = applyBsdiffPatch(oldBuf, patch, targetSha);

      expect(Buffer.compare(reconstructed, newBuf)).toBe(0);
    }, 30000);

    it("ADV-1.3: High-entropy uncorrelated random noise (no common substrings >= 4 bytes)", () => {
      const size = 64 * 1024; // 64 KB completely distinct random buffers
      const oldBuf = crypto.randomBytes(size);
      const newBuf = crypto.randomBytes(size);

      const patch = generateBsdiffPatch(oldBuf, newBuf);
      const targetSha = computeSha256(newBuf);
      const reconstructed = applyBsdiffPatch(oldBuf, patch, targetSha);

      expect(Buffer.compare(reconstructed, newBuf)).toBe(0);
    });

    it("ADV-1.4: Single-byte repetitive cyclic patterns (0xAA 0x55 alternations)", () => {
      const size = 128 * 1024;
      const oldBuf = Buffer.alloc(size);
      const newBuf = Buffer.alloc(size + 1024);

      for (let i = 0; i < size; i++) {
        oldBuf[i] = i % 2 === 0 ? 0xaa : 0x55;
      }
      for (let i = 0; i < newBuf.length; i++) {
        newBuf[i] = i % 2 === 0 ? 0xaa : 0x55;
      }

      const patch = generateBsdiffPatch(oldBuf, newBuf);
      const reconstructed = applyBsdiffPatch(oldBuf, patch);

      expect(Buffer.compare(reconstructed, newBuf)).toBe(0);
    });

    it("ADV-1.5: 1-byte insertion at index 0 (full phase-shift / offset cascade)", () => {
      const size = 100 * 1024; // 100 KB
      const oldBuf = crypto.randomBytes(size);
      // Prepend a single byte 0x99, shifting entire content by +1 offset
      const newBuf = Buffer.concat([Buffer.from([0x99]), oldBuf]);

      const patch = generateBsdiffPatch(oldBuf, newBuf);
      const reconstructed = applyBsdiffPatch(oldBuf, patch);

      expect(Buffer.compare(reconstructed, newBuf)).toBe(0);
    });
  });

  // =========================================================================
  // ATTACK VECTOR 2: Header Magic, Structure & Dimension Corruption
  // =========================================================================
  describe("Attack Vector 2: Header Magic, Structure & Dimension Corruption", () => {
    it("ADV-2.1: Rejects header with mutated magic bytes (e.g. BSDIFF41, ASDIFF40, null bytes)", () => {
      const oldBuf = Buffer.from("Base buffer");
      const newBuf = Buffer.from("Target buffer");
      const validPatch = generateBsdiffPatch(oldBuf, newBuf);

      const invalidMagics = [
        "BSDIFF41",
        "ASDIFF40",
        "bsdiff40",
        "\0SDIFF40",
        "BSDIFF\0\0",
        "12345678",
        "        ",
      ];

      for (const magic of invalidMagics) {
        const corrupted = Buffer.from(validPatch);
        corrupted.write(magic, 0, 8, "ascii");
        expect(
          () => applyBsdiffPatch(oldBuf, corrupted),
          `Should reject magic: ${magic}`,
        ).toThrow(InvalidPatchHeaderError);
      }
    });

    it("ADV-2.2: Rejects sub-32 byte truncated headers", () => {
      const oldBuf = Buffer.from("Base content");
      for (const len of [0, 1, 7, 8, 15, 16, 23, 24, 31]) {
        const truncated = Buffer.alloc(len);
        if (len >= 8) truncated.write(MAGIC_HEADER, 0, 8, "ascii");
        expect(() => applyBsdiffPatch(oldBuf, truncated)).toThrow(
          InvalidPatchHeaderError,
        );
      }
    });

    it("ADV-2.3: Rejects negative 64-bit dimensions in header", () => {
      const oldBuf = Buffer.from("Base");
      const newBuf = Buffer.from("New");
      const patch = generateBsdiffPatch(oldBuf, newBuf);

      // Negative ctrlBlockLen
      const patchNegCtrl = Buffer.from(patch);
      patchNegCtrl.writeBigInt64BE(BigInt(-1), 8);
      expect(() => applyBsdiffPatch(oldBuf, patchNegCtrl)).toThrow(
        InvalidPatchHeaderError,
      );

      // Negative diffBlockLen
      const patchNegDiff = Buffer.from(patch);
      patchNegDiff.writeBigInt64BE(BigInt(-500), 16);
      expect(() => applyBsdiffPatch(oldBuf, patchNegDiff)).toThrow(
        InvalidPatchHeaderError,
      );

      // Negative newFileSize
      const patchNegSize = Buffer.from(patch);
      patchNegSize.writeBigInt64BE(BigInt(-9999999), 24);
      expect(() => applyBsdiffPatch(oldBuf, patchNegSize)).toThrow(
        InvalidPatchHeaderError,
      );
    });

    it("ADV-2.4: Rejects astronomically large block lengths exceeding buffer size", () => {
      const oldBuf = Buffer.from("Base");
      const newBuf = Buffer.from("New");
      const patch = generateBsdiffPatch(oldBuf, newBuf);

      // Set ctrlBlockLen to 1,000,000,000 bytes
      const patchHuge = Buffer.from(patch);
      patchHuge.writeBigInt64BE(BigInt(1_000_000_000), 8);
      expect(() => applyBsdiffPatch(oldBuf, patchHuge)).toThrow(
        InvalidPatchHeaderError,
      );
    });
  });

  // =========================================================================
  // ATTACK VECTOR 3: Compressed Stream Fuzzing & GZIP Corruption
  // =========================================================================
  describe("Attack Vector 3: Compressed Stream Fuzzing & GZIP Corruption", () => {
    it("ADV-3.1: Rejects truncated GZIP streams in control, diff, and extra blocks", () => {
      const oldBuf = Buffer.from(
        "Version 1 base content with sufficient length for compression testing",
      );
      const newBuf = Buffer.from(
        "Version 2 target content with brand new sections appended at the end",
      );
      const patch = generateBsdiffPatch(oldBuf, newBuf);

      const ctrlLen = Number(patch.readBigInt64BE(8));
      const diffLen = Number(patch.readBigInt64BE(16));

      // Truncate control stream (chop 5 bytes)
      const patchShortCtrl = Buffer.concat([
        patch.subarray(0, 32 + ctrlLen - 5),
        patch.subarray(32 + ctrlLen),
      ]);
      expect(() => applyBsdiffPatch(oldBuf, patchShortCtrl)).toThrow();

      // Truncate extra stream
      const patchShortExtra = patch.subarray(0, patch.length - 10);
      expect(() => applyBsdiffPatch(oldBuf, patchShortExtra)).toThrow();
    });

    it("ADV-3.2: Fuzzes 100 arbitrary bit flips across compressed payload and verifies strict error throwing", () => {
      const base = crypto.randomBytes(2048);
      const oldBuf = Buffer.concat([base, crypto.randomBytes(2048)]);
      const newBuf = Buffer.concat([base, crypto.randomBytes(2048)]);
      const validPatch = generateBsdiffPatch(oldBuf, newBuf);
      const targetSha256 = computeSha256(newBuf);

      for (let i = 0; i < 100; i++) {
        const corrupted = Buffer.from(validPatch);
        const byteIndex =
          32 + Math.floor(Math.random() * (validPatch.length - 32));
        const bitMask = 1 << Math.floor(Math.random() * 8);
        corrupted[byteIndex] = (corrupted[byteIndex] ^ bitMask) & 0xff;

        expect(() => {
          applyBsdiffPatch(oldBuf, corrupted, targetSha256);
        }).toThrow();
      }
    });

    it("ADV-3.3: Rejects completely zeroed GZIP payload blocks", () => {
      const oldBuf = Buffer.from("Base data");
      const newBuf = Buffer.from("Target data");
      const patch = generateBsdiffPatch(oldBuf, newBuf);

      const zeroed = Buffer.from(patch);
      zeroed.fill(0x00, 32); // zero out all compressed streams

      expect(() => applyBsdiffPatch(oldBuf, zeroed)).toThrow(
        CorruptPatchBlockError,
      );
    });
  });

  // =========================================================================
  // ATTACK VECTOR 4: Control Stream & Deserialization Attacks
  // =========================================================================
  describe("Attack Vector 4: Control Stream & Deserialization Attacks", () => {
    function synthesizeCustomPatch(
      newFileSize: number,
      controlRecords: Array<[number, number, number]>,
      diffPayload: Buffer,
      extraPayload: Buffer,
    ): Buffer {
      const ctrlBuf = Buffer.alloc(controlRecords.length * 12);
      for (let i = 0; i < controlRecords.length; i++) {
        const [diff, extra, seek] = controlRecords[i];
        ctrlBuf.writeInt32BE(diff, i * 12);
        ctrlBuf.writeInt32BE(extra, i * 12 + 4);
        ctrlBuf.writeInt32BE(seek, i * 12 + 8);
      }

      const ctrlGzip = zlib.gzipSync(ctrlBuf);
      const diffGzip = zlib.gzipSync(diffPayload);
      const extraGzip = zlib.gzipSync(extraPayload);

      const header = Buffer.alloc(HEADER_SIZE);
      header.write(MAGIC_HEADER, 0, 8, "ascii");
      header.writeBigInt64BE(BigInt(ctrlGzip.length), 8);
      header.writeBigInt64BE(BigInt(diffGzip.length), 16);
      header.writeBigInt64BE(BigInt(newFileSize), 24);

      return Buffer.concat([header, ctrlGzip, diffGzip, extraGzip]);
    }

    it("ADV-4.1: Rejects negative diffBytesCount in control tuple", () => {
      const oldBuf = Buffer.from("Old data");
      const patch = synthesizeCustomPatch(
        10,
        [[-5, 0, 0]],
        Buffer.alloc(0),
        Buffer.alloc(0),
      );
      expect(() => applyBsdiffPatch(oldBuf, patch)).toThrow(
        PatchApplicationError,
      );
    });

    it("ADV-4.2: Rejects negative extraBytesCount in control tuple", () => {
      const oldBuf = Buffer.from("Old data");
      const patch = synthesizeCustomPatch(
        10,
        [[0, -10, 0]],
        Buffer.alloc(0),
        Buffer.alloc(0),
      );
      expect(() => applyBsdiffPatch(oldBuf, patch)).toThrow(
        PatchApplicationError,
      );
    });

    it("ADV-4.3: Rejects diff count exceeding target newFileSize", () => {
      const oldBuf = Buffer.from("Old data");
      const patch = synthesizeCustomPatch(
        10,
        [[50, 0, 0]],
        Buffer.alloc(50),
        Buffer.alloc(0),
      );
      expect(() => applyBsdiffPatch(oldBuf, patch)).toThrow(
        PatchApplicationError,
      );
    });

    it("ADV-4.4: Rejects extra count exceeding target newFileSize", () => {
      const oldBuf = Buffer.from("Old data");
      const patch = synthesizeCustomPatch(
        10,
        [[0, 50, 0]],
        Buffer.alloc(0),
        Buffer.alloc(50),
      );
      expect(() => applyBsdiffPatch(oldBuf, patch)).toThrow(
        PatchApplicationError,
      );
    });

    it("ADV-4.5: Rejects diff stream underflow (control asks for more bytes than available)", () => {
      const oldBuf = Buffer.from("Old data");
      // Control asks for 10 diff bytes, but diff payload is only 4 bytes
      const patch = synthesizeCustomPatch(
        10,
        [[10, 0, 0]],
        Buffer.alloc(4),
        Buffer.alloc(0),
      );
      expect(() => applyBsdiffPatch(oldBuf, patch)).toThrow(
        PatchApplicationError,
      );
    });

    it("ADV-4.6: Rejects extra stream underflow (control asks for more bytes than available)", () => {
      const oldBuf = Buffer.from("Old data");
      // Control asks for 10 extra bytes, but extra payload is only 3 bytes
      const patch = synthesizeCustomPatch(
        10,
        [[0, 10, 0]],
        Buffer.alloc(0),
        Buffer.alloc(3),
      );
      expect(() => applyBsdiffPatch(oldBuf, patch)).toThrow(
        PatchApplicationError,
      );
    });

    it("ADV-4.7: Handles extreme negative and positive seek offsets safely (out-of-bounds oldPos)", () => {
      const oldBuf = Buffer.from("Hello");
      // Tuple 1: copy 5 diff bytes with seek +2,000,000,000
      // Tuple 2: copy 5 diff bytes with seek -4,000,000,000
      // Out of bounds reads safely return oldByte = 0
      const patch = synthesizeCustomPatch(
        10,
        [
          [5, 0, 2_000_000],
          [5, 0, -4_000_000],
        ],
        Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
        Buffer.alloc(0),
      );

      const reconstructed = applyBsdiffPatch(oldBuf, patch);
      expect(reconstructed.length).toBe(10);
      expect(Buffer.isBuffer(reconstructed)).toBe(true);
    });

    it("ADV-4.8: Rejects premature end of control stream (newPos < newFileSize)", () => {
      const oldBuf = Buffer.from("Old data");
      // Target is 100 bytes, but control tuple only reconstructs 10 bytes
      const patch = synthesizeCustomPatch(
        100,
        [[10, 0, 0]],
        Buffer.alloc(10),
        Buffer.alloc(0),
      );
      expect(() => applyBsdiffPatch(oldBuf, patch)).toThrow(
        PatchApplicationError,
      );
    });
  });

  // =========================================================================
  // ATTACK VECTOR 5: Suffix & N-gram Hash Collision Stress-Testing
  // =========================================================================
  describe("Attack Vector 5: Suffix & N-gram Hash Collision Stress-Testing", () => {
    it("ADV-5.1: Handles 10,000 identical 4-byte N-gram collisions without performance cliff or candidate overflow", () => {
      // 10,000 repeats of 'AAAA'
      const oldBuf = Buffer.from("AAAA".repeat(10000));
      const newBuf = Buffer.from("AAAA".repeat(10000) + "BBBB");

      const start = Date.now();
      const patch = generateBsdiffPatch(oldBuf, newBuf);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(5000); // Must complete within 5s due to candidate pruning cap
      const reconstructed = applyBsdiffPatch(oldBuf, patch);
      expect(Buffer.compare(reconstructed, newBuf)).toBe(0);
    });

    it("ADV-5.2: Combinatorial permutation: block reordering (Block A <-> Block B)", () => {
      const blockA = Buffer.alloc(2048, 0x11);
      const blockB = Buffer.alloc(2048, 0x22);
      const blockC = Buffer.alloc(2048, 0x33);

      const oldBuf = Buffer.concat([blockA, blockB, blockC]);
      const newBuf = Buffer.concat([blockC, blockA, blockB]); // Permuted order

      const patch = generateBsdiffPatch(oldBuf, newBuf);
      const reconstructed = applyBsdiffPatch(oldBuf, patch);

      expect(Buffer.compare(reconstructed, newBuf)).toBe(0);
    });

    it("ADV-5.3: MinMatchLength boundary variation (1, 2, 3, 4, 8, 32, 64, 128)", () => {
      const oldBuf = Buffer.from(
        "THE_QUICK_BROWN_FOX_JUMPS_OVER_THE_LAZY_DOG_1234567890",
      );
      const newBuf = Buffer.from(
        "THE_FAST_BROWN_FOX_LEAPS_OVER_THE_LAZY_CANINE_1234567890_EXTRA",
      );

      for (const minMatch of [1, 2, 3, 4, 8, 32, 64, 128]) {
        const patch = generateBsdiffPatch(oldBuf, newBuf, {
          minMatchLength: minMatch,
        });
        const reconstructed = applyBsdiffPatch(oldBuf, patch);
        expect(
          Buffer.compare(reconstructed, newBuf),
          `Failed with minMatchLength=${minMatch}`,
        ).toBe(0);
      }
    });
  });

  // =========================================================================
  // ATTACK VECTOR 6: Byte-for-Byte Exact Parity & Integrity Verification
  // =========================================================================
  describe("Attack Vector 6: Byte-for-Byte Exact Parity & Integrity Verification", () => {
    it("ADV-6.1: 50 randomized fuzzing trials with variable sizes, offsets, and mutations", () => {
      for (let trial = 0; trial < 50; trial++) {
        const oldSize = Math.floor(Math.random() * 8192) + 64;
        const oldBuf = crypto.randomBytes(oldSize);

        // Generate newBuf by copying and mutating
        const newBuf = Buffer.from(oldBuf);
        const mutationCount = Math.floor(Math.random() * 20) + 1;
        for (let m = 0; m < mutationCount; m++) {
          const idx = Math.floor(Math.random() * newBuf.length);
          newBuf[idx] = (newBuf[idx] ^ 0x5a) & 0xff;
        }

        const patch = generateBsdiffPatch(oldBuf, newBuf);
        const targetSha = computeSha256(newBuf);
        const reconstructed = applyBsdiffPatch(oldBuf, patch, targetSha);

        expect(Buffer.compare(reconstructed, newBuf)).toBe(0);
      }
    });

    it("ADV-6.2: Target SHA-256 validation accepts uppercase, lowercase, and whitespace variations", () => {
      const oldBuf = Buffer.from("Base SHA test");
      const newBuf = Buffer.from("New SHA test");
      const patch = generateBsdiffPatch(oldBuf, newBuf);

      const targetSha = computeSha256(newBuf);
      // Lowercase
      expect(() =>
        applyBsdiffPatch(oldBuf, patch, targetSha.toLowerCase()),
      ).not.toThrow();
      // Uppercase
      expect(() =>
        applyBsdiffPatch(oldBuf, patch, targetSha.toUpperCase()),
      ).not.toThrow();
      // Padded whitespace
      expect(() =>
        applyBsdiffPatch(oldBuf, patch, `  ${targetSha}  \n`),
      ).not.toThrow();
      // Empty string should skip check
      expect(() => applyBsdiffPatch(oldBuf, patch, "")).not.toThrow();
      expect(() => applyBsdiffPatch(oldBuf, patch, "   ")).not.toThrow();
    });

    it("ADV-6.3: Mutating base buffer post-application does not mutate reconstructed result", () => {
      const oldBuf = Buffer.from("Immutable base buffer");
      const newBuf = Buffer.from("Target reconstructed buffer");

      const patch = generateBsdiffPatch(oldBuf, newBuf);
      const reconstructed = applyBsdiffPatch(oldBuf, patch);

      // Mutate oldBuf
      oldBuf.fill(0xff);

      expect(Buffer.compare(reconstructed, newBuf)).toBe(0);
    });
  });
});
