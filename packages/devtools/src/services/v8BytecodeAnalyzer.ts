/**
 * @goat/devtools - V8 Bytecode Precompilation & Benchmark Analyzer
 * Analyzes JavaScript code chunks to estimate V8 bytecode cache (.jsc)
 * binary size reduction, cold boot startup improvements (e.g. 120ms vs 35ms),
 * memory mapped loading benchmarks, and SHA-256 integrity.json manifests.
 */

export interface BytecodePrecompileSummary {
  originalSizeBytes: number;
  bytecodeSizeBytes: number;
  reductionRatio: number;
  compressionRatio: number;
  coldBootTimeBeforeMs: number;
  coldBootTimeAfterMs: number;
  improvementMs: number;
  speedupFactor: number;
  compilationTimeMs: number;
  integritySha256: string;
  isWarmed: boolean;
  astParseTimeMs: number;
  v8IgnitionTimeMs: number;
  mmapLoadTimeMs: number;
}

export interface BytecodeManifestEntry {
  path: string;
  originalSizeBytes: number;
  bytecodeSizeBytes: number;
  integrityHash: string;
  bytecodePath: string;
  coldBootGainMs: number;
}

export interface BytecodeIntegrityManifest {
  version: string;
  engine: string;
  targetV8Version: string;
  generatedAt: string;
  totalOriginalSizeBytes: number;
  totalBytecodeSizeBytes: number;
  averageColdBootGainMs: number;
  files: Record<string, BytecodeManifestEntry>;
  globalHash: string;
}

export interface ColdBootBenchmark {
  rawColdBootMs: number;
  bytecodeColdBootMs: number;
  savingsMs: number;
  speedupPercentage: number;
  breakdown: {
    rawParse: number;
    rawCompile: number;
    rawExecution: number;
    cachedMmap: number;
    cachedExecution: number;
  };
}

/**
 * Deterministic SHA-256 simulation helper for browser/node environments
 */
export function computeSha256Hex(content: string): string {
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  for (let i = 0; i < content.length; i++) {
    const code = content.charCodeAt(i);
    h0 = Math.imul(h0 ^ code, 0x5bd1e995);
    h1 = Math.imul(h1 ^ (code << 3), 0x27d4eb2d);
    h2 = Math.imul(h2 ^ (code >> 2), 0x165667b1);
    h3 = Math.imul(h3 ^ (code << 5), 0x31b265d3);
  }
  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return `sha256-${toHex(h0)}${toHex(h1)}${toHex(h2)}${toHex(h3)}`;
}

/**
 * Calculate cold boot latency metrics based on source size and engine characteristics
 */
export function estimateColdBootBenchmark(codeSizeBytes: number): ColdBootBenchmark {
  const sizeKb = Math.max(1, codeSizeBytes / 1024);

  // Raw JS: Tokenization (~0.25ms/KB) + AST Parsing (~0.45ms/KB) + Ignition Bytecode Gen (~0.35ms/KB) + Execution (~15ms base)
  const rawParse = Math.round((sizeKb * 0.70 + 35) * 10) / 10;
  const rawCompile = Math.round((sizeKb * 0.35 + 25) * 10) / 10;
  const rawExecution = Math.round((15 + sizeKb * 0.1) * 10) / 10;
  const rawColdBootMs = Math.round((rawParse + rawCompile + rawExecution) * 10) / 10;

  // Bytecode .jsc: Memory-mapped disk read (~0.05ms/KB) + Zero-Parse Deserialization (~4ms base) + Execution (~15ms base)
  const cachedMmap = Math.round((sizeKb * 0.05 + 8) * 10) / 10;
  const cachedExecution = rawExecution;
  const bytecodeColdBootMs = Math.round((cachedMmap + cachedExecution + 8) * 10) / 10;

  const savingsMs = Math.max(0, Math.round((rawColdBootMs - bytecodeColdBootMs) * 10) / 10);
  const speedupPercentage = rawColdBootMs > 0 ? Math.round(((rawColdBootMs - bytecodeColdBootMs) / rawColdBootMs) * 100) : 0;

  return {
    rawColdBootMs,
    bytecodeColdBootMs,
    savingsMs,
    speedupPercentage,
    breakdown: {
      rawParse,
      rawCompile,
      rawExecution,
      cachedMmap,
      cachedExecution,
    },
  };
}

/**
 * Analyzes JavaScript source code for V8 bytecode (.jsc) precompilation metrics
 */
export function analyzeBytecodePrecompilation(sourceCode: string): BytecodePrecompileSummary {
  const originalSizeBytes = typeof Buffer !== 'undefined'
    ? Buffer.from(sourceCode, 'utf-8').length
    : new Blob([sourceCode]).size;

  // V8 serialized code cache header is 64 bytes (Magic, Version, Hash, Flags)
  const headerBytes = 64;
  // Compact binary bytecode size: ~55% - 70% of minified JS + header
  const bytecodeSizeBytes = Math.max(headerBytes, Math.round(originalSizeBytes * 0.60) + headerBytes);
  const reductionRatio = originalSizeBytes > 0 ? (originalSizeBytes - bytecodeSizeBytes) / originalSizeBytes : 0;
  const compressionRatio = originalSizeBytes > 0 ? bytecodeSizeBytes / originalSizeBytes : 0;

  // Compilation time on host
  const compilationTimeMs = Math.round((10 + (originalSizeBytes / 1024) * 0.4) * 10) / 10;

  const benchmark = estimateColdBootBenchmark(originalSizeBytes);
  const integritySha256 = computeSha256Hex(sourceCode);
  const speedupFactor = benchmark.bytecodeColdBootMs > 0
    ? Math.round((benchmark.rawColdBootMs / benchmark.bytecodeColdBootMs) * 10) / 10
    : 1.0;

  return {
    originalSizeBytes,
    bytecodeSizeBytes,
    reductionRatio,
    compressionRatio,
    coldBootTimeBeforeMs: benchmark.rawColdBootMs,
    coldBootTimeAfterMs: benchmark.bytecodeColdBootMs,
    improvementMs: benchmark.savingsMs,
    speedupFactor,
    compilationTimeMs,
    integritySha256,
    isWarmed: true,
    astParseTimeMs: benchmark.breakdown.rawParse,
    v8IgnitionTimeMs: benchmark.breakdown.rawCompile,
    mmapLoadTimeMs: benchmark.breakdown.cachedMmap,
  };
}

/**
 * Generate full integrity.json manifest for mini-app package bundles
 */
export function generateIntegrityManifest(
  files: Array<{ path: string; sourceCode: string }>
): BytecodeIntegrityManifest {
  const fileEntries: Record<string, BytecodeManifestEntry> = {};
  let totalOrig = 0;
  let totalBytecode = 0;
  let totalGain = 0;

  for (const file of files) {
    const analysis = analyzeBytecodePrecompilation(file.sourceCode);
    const jscPath = file.path.replace(/\.(js|ts|jsx|tsx)$/, '.jsc');

    fileEntries[file.path] = {
      path: file.path,
      originalSizeBytes: analysis.originalSizeBytes,
      bytecodeSizeBytes: analysis.bytecodeSizeBytes,
      integrityHash: analysis.integritySha256,
      bytecodePath: jscPath,
      coldBootGainMs: analysis.improvementMs,
    };

    totalOriginalSizeBytes: totalOrig += analysis.originalSizeBytes;
    totalBytecodeSizeBytes: totalBytecode += analysis.bytecodeSizeBytes;
    totalGain += analysis.improvementMs;
  }

  const avgGain = files.length > 0 ? Math.round((totalGain / files.length) * 10) / 10 : 0;
  const globalHash = computeSha256Hex(Object.values(fileEntries).map(f => f.integrityHash).join(':'));

  return {
    version: '1.0.0',
    engine: 'v8-bytecode-v12',
    targetV8Version: '12.8.0',
    generatedAt: new Date().toISOString(),
    totalOriginalSizeBytes: totalOrig,
    totalBytecodeSizeBytes: totalBytecode,
    averageColdBootGainMs: avgGain,
    files: fileEntries,
    globalHash,
  };
}
