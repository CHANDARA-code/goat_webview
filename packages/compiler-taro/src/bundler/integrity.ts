/**
 * @goat/compiler-taro - SHA-256 Integrity Manifest Generator
 * Generates cryptographic SHA-256 checksums and file size telemetry
 * for tamper-proof mini-app bundle distribution (integrity.json).
 */

import { createHash } from 'node:crypto';
import { IntegrityManifest } from '../types.js';

/**
 * Computes SHA-256 digest string prefixed with 'sha256-'
 */
export function computeSha256(content: string | Buffer): string {
  const hash = createHash('sha256');
  hash.update(typeof content === 'string' ? Buffer.from(content, 'utf-8') : content);
  return `sha256-${hash.digest('hex')}`;
}

/**
 * Generates an integrity.json manifest object for a given bundle file tree
 */
export function generateIntegrityManifest(
  files: Record<string, string | Buffer>,
  metadata: {
    appId: string;
    version: string;
    target: 'dual-thread' | 'single-thread';
    timestamp?: number;
  }
): IntegrityManifest {
  const fileHashes: Record<string, string> = {};
  const fileSizes: Record<string, number> = {};
  let totalSizeBytes = 0;

  const sortedPaths = Object.keys(files).sort();

  for (const path of sortedPaths) {
    const content = files[path];
    if (content === undefined) continue;

    const byteLen = typeof content === 'string' ? Buffer.byteLength(content, 'utf-8') : content.length;
    const sha = computeSha256(content);

    fileHashes[path] = sha;
    fileSizes[path] = byteLen;
    totalSizeBytes += byteLen;
  }

  return {
    version: metadata.version,
    appId: metadata.appId,
    target: metadata.target,
    timestamp: metadata.timestamp || Date.now(),
    files: fileHashes,
    metadata: {
      totalFiles: sortedPaths.length,
      totalSizeBytes,
      fileSizes,
    },
  };
}

/**
 * Verifies a set of files against an integrity manifest
 */
export function verifyIntegrity(
  files: Record<string, string | Buffer>,
  manifest: IntegrityManifest
): {
  valid: boolean;
  missingFiles: string[];
  mismatchedFiles: string[];
} {
  const missingFiles: string[] = [];
  const mismatchedFiles: string[] = [];

  for (const [path, expectedHash] of Object.entries(manifest.files)) {
    const fileContent = files[path];
    if (fileContent === undefined) {
      missingFiles.push(path);
      continue;
    }

    const actualHash = computeSha256(fileContent);
    if (actualHash !== expectedHash) {
      mismatchedFiles.push(path);
    }
  }

  return {
    valid: missingFiles.length === 0 && mismatchedFiles.length === 0,
    missingFiles,
    mismatchedFiles,
  };
}
