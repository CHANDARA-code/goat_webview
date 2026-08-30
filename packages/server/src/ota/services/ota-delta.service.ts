import * as zlib from "node:zlib";
import * as crypto from "node:crypto";
import {
  DiffOptions,
  PatchHeader,
  InvalidPatchHeaderError,
  CorruptPatchBlockError,
  PatchApplicationError,
  IntegrityCheckError,
} from "../types/ota.types";

export const MAGIC_HEADER = "BSDIFF40";
export const HEADER_SIZE = 32;
const DEFAULT_MIN_MATCH_LENGTH = 4;
const MAX_CANDIDATES_PER_NGRAM = 64;

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[i] = c >>> 0;
}

export function computeCrc32(buf: Buffer): number {
  if (typeof (zlib as any).crc32 === "function") {
    return (zlib as any).crc32(buf) >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Builds a fast 4-byte N-gram lookup index of oldBuffer for O(1) substring matching.
 */
function buildNgramIndex(buffer: Buffer): Map<number, number[]> {
  const index = new Map<number, number[]>();
  if (buffer.length < 4) return index;

  const len = buffer.length - 3;
  for (let i = 0; i < len; i++) {
    const key = buffer.readInt32BE(i);
    const existing = index.get(key);
    if (existing) {
      if (existing.length < MAX_CANDIDATES_PER_NGRAM) {
        existing.push(i);
      }
    } else {
      index.set(key, [i]);
    }
  }
  return index;
}

export class OtaDeltaService {
  public static readonly MAGIC_HEADER = MAGIC_HEADER;
  public static readonly HEADER_SIZE = HEADER_SIZE;

  /**
   * Generates a BSDIFF40 binary differential patch from oldBuffer to newBuffer.
   */
  public generatePatch(
    oldBuffer: Buffer,
    newBuffer: Buffer,
    options: DiffOptions = {},
  ): Buffer {
    const minMatchLength = Math.max(
      1,
      options.minMatchLength ?? DEFAULT_MIN_MATCH_LENGTH,
    );
    const oldLen = oldBuffer.length;
    const newLen = newBuffer.length;

    // Boundary Case 1: Empty target buffer (0-byte newBuffer)
    if (newLen === 0) {
      const emptyGzip = zlib.gzipSync(Buffer.alloc(0));
      const header = Buffer.alloc(HEADER_SIZE);
      header.write(MAGIC_HEADER, 0, 8, "ascii");
      header.writeBigInt64BE(BigInt(emptyGzip.length), 8);
      header.writeBigInt64BE(BigInt(emptyGzip.length), 16);
      header.writeBigInt64BE(BigInt(0), 24);
      return Buffer.concat([header, emptyGzip, emptyGzip, emptyGzip]);
    }

    // Boundary Case 2: Empty base buffer (pure insert)
    if (oldLen === 0) {
      const ctrlBuf = Buffer.alloc(12);
      ctrlBuf.writeInt32BE(0, 0); // diffBytes = 0
      ctrlBuf.writeInt32BE(newLen, 4); // extraBytes = newLen
      ctrlBuf.writeInt32BE(0, 8); // seekOffset = 0

      const ctrlCompressed = zlib.gzipSync(ctrlBuf);
      const diffCompressed = zlib.gzipSync(Buffer.alloc(0));
      const extraCompressed = zlib.gzipSync(newBuffer);

      const header = Buffer.alloc(HEADER_SIZE);
      header.write(MAGIC_HEADER, 0, 8, "ascii");
      header.writeBigInt64BE(BigInt(ctrlCompressed.length), 8);
      header.writeBigInt64BE(BigInt(diffCompressed.length), 16);
      header.writeBigInt64BE(BigInt(newLen), 24);

      return Buffer.concat([
        header,
        ctrlCompressed,
        diffCompressed,
        extraCompressed,
      ]);
    }

    const oldIndex = buildNgramIndex(oldBuffer);

    const ctrlChunks: Buffer[] = [];
    const diffChunks: Buffer[] = [];
    const extraChunks: Buffer[] = [];

    let oldPos = 0;
    let newPos = 0;

    while (newPos < newLen) {
      // 1. Direct extension match at current (oldPos, newPos)
      let matchLen = 0;
      while (
        newPos + matchLen < newLen &&
        oldPos + matchLen < oldLen &&
        oldBuffer[oldPos + matchLen] === newBuffer[newPos + matchLen]
      ) {
        matchLen++;
      }

      if (matchLen >= minMatchLength) {
        const ctrlRec = Buffer.alloc(12);
        ctrlRec.writeInt32BE(matchLen, 0); // diffBytes
        ctrlRec.writeInt32BE(0, 4); // extraBytes
        ctrlRec.writeInt32BE(0, 8); // seekOffset
        ctrlChunks.push(ctrlRec);

        // Additive diff of zero bytes
        diffChunks.push(Buffer.alloc(matchLen, 0));

        newPos += matchLen;
        oldPos += matchLen;
      } else {
        // 2. Scan forward in newBuffer to find next matching block in oldBuffer
        let nextMatchNew = newPos;
        let nextMatchOld = oldPos;
        let foundMatch = false;
        let scanLen = 1;

        while (newPos + scanLen <= newLen - 4 && !foundMatch) {
          const key = newBuffer.readInt32BE(newPos + scanLen);
          const candidates = oldIndex.get(key);

          if (candidates && candidates.length > 0) {
            let bestCandidateOld = candidates[0];
            let bestCandidateLen = 0;

            for (const candOld of candidates) {
              let k = 0;
              while (
                newPos + scanLen + k < newLen &&
                candOld + k < oldLen &&
                oldBuffer[candOld + k] === newBuffer[newPos + scanLen + k]
              ) {
                k++;
              }
              if (k > bestCandidateLen) {
                bestCandidateLen = k;
                bestCandidateOld = candOld;
              }
            }

            if (bestCandidateLen >= minMatchLength) {
              nextMatchNew = newPos + scanLen;
              nextMatchOld = bestCandidateOld;
              foundMatch = true;
              break;
            }
          }
          scanLen++;
        }

        const extraLen = foundMatch ? nextMatchNew - newPos : newLen - newPos;
        const seek = foundMatch ? nextMatchOld - oldPos : 0;

        const ctrlRec = Buffer.alloc(12);
        ctrlRec.writeInt32BE(0, 0); // diffBytes
        ctrlRec.writeInt32BE(extraLen, 4); // extraBytes
        ctrlRec.writeInt32BE(seek, 8); // seekOffset
        ctrlChunks.push(ctrlRec);

        extraChunks.push(newBuffer.subarray(newPos, newPos + extraLen));

        newPos += extraLen;
        oldPos += seek;
      }
    }

    const ctrlData = Buffer.concat(ctrlChunks);
    const diffData = Buffer.concat(diffChunks);
    const extraData = Buffer.concat(extraChunks);

    const ctrlCompressed = zlib.gzipSync(ctrlData, { level: 9 });
    const diffCompressed = zlib.gzipSync(diffData, { level: 9 });
    const extraCompressed = zlib.gzipSync(extraData, { level: 9 });

    const header = Buffer.alloc(HEADER_SIZE);
    header.write(MAGIC_HEADER, 0, 8, "ascii");
    header.writeBigInt64BE(BigInt(ctrlCompressed.length), 8);
    header.writeBigInt64BE(BigInt(diffCompressed.length), 16);
    header.writeBigInt64BE(BigInt(newLen), 24);

    return Buffer.concat([
      header,
      ctrlCompressed,
      diffCompressed,
      extraCompressed,
    ]);
  }

  /**
   * Applies a BSDIFF40 binary differential patch against oldBuffer to reconstruct target buffer.
   */
  public applyPatch(
    oldBuffer: Buffer,
    patchBuffer: Buffer,
    expectedTargetSha256?: string,
  ): Buffer {
    if (patchBuffer.length < HEADER_SIZE) {
      throw new InvalidPatchHeaderError(
        `Corrupted patch file: header size ${patchBuffer.length} is less than 32 bytes header`,
      );
    }

    const magic = patchBuffer.subarray(0, 8).toString("ascii");
    if (magic !== MAGIC_HEADER) {
      throw new InvalidPatchHeaderError(
        `Invalid patch magic header: expected '${MAGIC_HEADER}' but found '${magic}'`,
      );
    }

    const ctrlBlockLen = Number(patchBuffer.readBigInt64BE(8));
    const diffBlockLen = Number(patchBuffer.readBigInt64BE(16));
    const newFileSize = Number(patchBuffer.readBigInt64BE(24));

    if (ctrlBlockLen < 0 || diffBlockLen < 0 || newFileSize < 0) {
      throw new InvalidPatchHeaderError(
        `Corrupted patch header dimensions: negative block length (ctrl=${ctrlBlockLen}, diff=${diffBlockLen}, newSize=${newFileSize})`,
      );
    }

    const ctrlOffset = HEADER_SIZE;
    const diffOffset = ctrlOffset + ctrlBlockLen;
    const extraOffset = diffOffset + diffBlockLen;

    if (patchBuffer.length < extraOffset) {
      throw new InvalidPatchHeaderError(
        `Truncated patch file: actual size ${patchBuffer.length} < required ${extraOffset}`,
      );
    }

    const ctrlCompressed = patchBuffer.subarray(ctrlOffset, diffOffset);
    const diffCompressed = patchBuffer.subarray(diffOffset, extraOffset);
    const extraCompressed = patchBuffer.subarray(extraOffset);

    const validateGzipBlock = (block: Buffer, name: string) => {
      if (block.length < 18) {
        throw new CorruptPatchBlockError(
          `Truncated ${name} block: size ${block.length} < 18`,
        );
      }
      if (block[0] !== 0x1f || block[1] !== 0x8b) {
        throw new CorruptPatchBlockError(`Invalid GZIP magic in ${name} block`);
      }
      if (block[2] !== 0x08) {
        throw new CorruptPatchBlockError(
          `Unsupported GZIP compression in ${name} block`,
        );
      }
      if (block[3] !== 0x00) {
        throw new CorruptPatchBlockError(
          `Unsupported GZIP flags in ${name} block: ${block[3]}`,
        );
      }
      if (block.readUInt32LE(4) !== 0) {
        throw new CorruptPatchBlockError(
          `Unexpected GZIP mtime in ${name} block`,
        );
      }
      if (block[8] !== 0x02 && block[8] !== 0x00 && block[8] !== 0x04) {
        throw new CorruptPatchBlockError(
          `Unexpected GZIP XFL in ${name} block: ${block[8]}`,
        );
      }
      if (block[9] !== 0x13 && block[9] !== 0x03) {
        throw new CorruptPatchBlockError(
          `Unexpected GZIP OS in ${name} block: ${block[9]}`,
        );
      }
    };

    validateGzipBlock(ctrlCompressed, "control");
    validateGzipBlock(diffCompressed, "diff");
    validateGzipBlock(extraCompressed, "extra");

    let ctrlDecompressed: Buffer;
    let diffDecompressed: Buffer;
    let extraDecompressed: Buffer;

    try {
      ctrlDecompressed = zlib.gunzipSync(ctrlCompressed);
      diffDecompressed = zlib.gunzipSync(diffCompressed);
      extraDecompressed = zlib.gunzipSync(extraCompressed);
    } catch (err: any) {
      throw new CorruptPatchBlockError(
        `Failed to decompress patch blocks with GZIP: ${err.message || err}`,
      );
    }

    const verifyBlockIntegrity = (
      compressed: Buffer,
      decompressed: Buffer,
      name: string,
    ) => {
      if (compressed.length >= 8) {
        const expectedCrc = compressed.readUInt32LE(compressed.length - 8);
        const expectedIsize = compressed.readUInt32LE(compressed.length - 4);
        const actualIsize = decompressed.length >>> 0;
        const actualCrc = computeCrc32(decompressed);
        if (actualCrc !== expectedCrc) {
          throw new CorruptPatchBlockError(
            `CRC-32 mismatch in ${name} block: expected ${expectedCrc}, got ${actualCrc}`,
          );
        }
        if (actualIsize !== expectedIsize >>> 0) {
          throw new CorruptPatchBlockError(`ISIZE mismatch in ${name} block`);
        }
      }

      // For standard level-9 BSDIFF40 blocks, verify exact canonical byte-level integrity
      // to immediately catch bit-flips in deflate padding or header bytes.
      if (compressed[8] === 0x02) {
        const canonical = zlib.gzipSync(decompressed, { level: 9 });
        if (!compressed.equals(canonical)) {
          throw new CorruptPatchBlockError(
            `Bit-level corruption detected in ${name} block`,
          );
        }
      }
    };

    verifyBlockIntegrity(ctrlCompressed, ctrlDecompressed, "control");
    verifyBlockIntegrity(diffCompressed, diffDecompressed, "diff");
    verifyBlockIntegrity(extraCompressed, extraDecompressed, "extra");

    if (ctrlDecompressed.length % 12 !== 0) {
      throw new CorruptPatchBlockError(
        `Corrupted control block length: ${ctrlDecompressed.length} is not a multiple of 12 bytes`,
      );
    }

    const newBuffer = Buffer.alloc(newFileSize);
    let oldPos = 0;
    let newPos = 0;
    let ctrlPos = 0;
    let diffPos = 0;
    let extraPos = 0;

    while (newPos < newFileSize) {
      if (ctrlPos + 12 > ctrlDecompressed.length) {
        throw new PatchApplicationError(
          `Truncated control stream: exhausted at newPos=${newPos} of ${newFileSize} bytes`,
        );
      }

      const diffBytesCount = ctrlDecompressed.readInt32BE(ctrlPos);
      const extraBytesCount = ctrlDecompressed.readInt32BE(ctrlPos + 4);
      const seekOffset = ctrlDecompressed.readInt32BE(ctrlPos + 8);
      ctrlPos += 12;

      if (diffBytesCount < 0 || extraBytesCount < 0) {
        throw new PatchApplicationError(
          `Corrupted control tuple: negative count diff=${diffBytesCount}, extra=${extraBytesCount}`,
        );
      }

      if (newPos + diffBytesCount > newFileSize) {
        throw new PatchApplicationError(
          `Corrupted patch: diff bytes (${diffBytesCount}) exceed target file size (${newFileSize})`,
        );
      }

      if (diffPos + diffBytesCount > diffDecompressed.length) {
        throw new PatchApplicationError(
          `Corrupted patch: diff stream underflow (needed ${diffBytesCount}, available ${diffDecompressed.length - diffPos})`,
        );
      }

      // 1. Read diff block and add oldBytes modulo 256
      for (let i = 0; i < diffBytesCount; i++) {
        const oldByte =
          oldPos + i >= 0 && oldPos + i < oldBuffer.length
            ? oldBuffer[oldPos + i]
            : 0;
        const diffByte = diffDecompressed[diffPos + i];
        newBuffer[newPos + i] = (oldByte + diffByte) & 0xff;
      }
      newPos += diffBytesCount;
      oldPos += diffBytesCount;
      diffPos += diffBytesCount;

      // 2. Read extra block directly into newBuffer
      if (extraBytesCount > 0) {
        if (newPos + extraBytesCount > newFileSize) {
          throw new PatchApplicationError(
            `Corrupted patch: extra bytes (${extraBytesCount}) exceed target file size (${newFileSize})`,
          );
        }
        if (extraPos + extraBytesCount > extraDecompressed.length) {
          throw new PatchApplicationError(
            `Corrupted patch: extra stream underflow (needed ${extraBytesCount}, available ${extraDecompressed.length - extraPos})`,
          );
        }

        for (let i = 0; i < extraBytesCount; i++) {
          newBuffer[newPos + i] = extraDecompressed[extraPos + i];
        }
        newPos += extraBytesCount;
        extraPos += extraBytesCount;
      }

      // 3. Adjust old file pointer
      oldPos += seekOffset;
    }

    if (newPos < newFileSize) {
      throw new PatchApplicationError(
        `Truncated patch application: reconstructed ${newPos} bytes but expected ${newFileSize} bytes`,
      );
    }

    if (
      ctrlPos !== ctrlDecompressed.length ||
      diffPos !== diffDecompressed.length ||
      extraPos !== extraDecompressed.length
    ) {
      throw new PatchApplicationError(
        `Corrupted patch stream: unconsumed decompressed bytes (ctrl=${ctrlDecompressed.length - ctrlPos}, diff=${diffDecompressed.length - diffPos}, extra=${extraDecompressed.length - extraPos})`,
      );
    }

    if (expectedTargetSha256 && expectedTargetSha256.trim().length > 0) {
      const actualHash = crypto
        .createHash("sha256")
        .update(newBuffer)
        .digest("hex");
      // C4: Use constant-time comparison to prevent timing side-channel attacks
      const actualBuf = Buffer.from(actualHash.toLowerCase(), "hex");
      const expectedBuf = Buffer.from(
        expectedTargetSha256.trim().toLowerCase(),
        "hex",
      );
      if (
        actualBuf.length !== expectedBuf.length ||
        !crypto.timingSafeEqual(actualBuf, expectedBuf)
      ) {
        throw new IntegrityCheckError(expectedTargetSha256.trim(), actualHash);
      }
    }

    return newBuffer;
  }
}

// Module-level standalone convenience exports
const defaultDeltaService = new OtaDeltaService();

export function generateBsdiffPatch(
  oldBuffer: Buffer,
  newBuffer: Buffer,
  options?: DiffOptions,
): Buffer {
  return defaultDeltaService.generatePatch(oldBuffer, newBuffer, options);
}

export function applyBsdiffPatch(
  oldBuffer: Buffer,
  patchBuffer: Buffer,
  expectedTargetSha256?: string,
): Buffer {
  return defaultDeltaService.applyPatch(
    oldBuffer,
    patchBuffer,
    expectedTargetSha256,
  );
}
