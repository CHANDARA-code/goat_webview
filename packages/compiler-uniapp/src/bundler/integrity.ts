/**
 * @goat/compiler-uniapp Cryptographic SHA-256 Integrity Generator & Verifier
 */
import { computeByteLength, computeSha256 } from '../utils/hash.js';
import type { BundleFileArtifact, IntegrityFileInfo, IntegrityManifest } from '../types.js';

export function generateIntegrityManifest(
  artifacts: BundleFileArtifact[]
): IntegrityManifest {
  const files: Record<string, IntegrityFileInfo> = {};
  let totalBytes = 0;

  for (const artifact of artifacts) {
    // Normalize path to forward slashes without leading slash
    const normalizedPath = artifact.path.replace(/^\//, '').replace(/\\/g, '/');

    // Do not include integrity.json in its own checksum map
    if (normalizedPath === 'integrity.json') {
      continue;
    }

    const sha256 = computeSha256(artifact.content);
    const size = computeByteLength(artifact.content);

    files[normalizedPath] = {
      sha256,
      size,
    };
    totalBytes += size;
  }

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    algorithm: 'sha256',
    files,
    totalBytes,
  };
}

export function verifyBundleIntegrity(
  artifacts: BundleFileArtifact[],
  manifest: IntegrityManifest
): { valid: boolean; mismatchedFiles: string[]; missingFiles: string[] } {
  const mismatchedFiles: string[] = [];
  const missingFiles: string[] = [];
  const artifactMap = new Map<string, BundleFileArtifact>();

  for (const a of artifacts) {
    const norm = a.path.replace(/^\//, '').replace(/\\/g, '/');
    artifactMap.set(norm, a);
  }

  for (const [expectedPath, expectedInfo] of Object.entries(manifest.files)) {
    const artifact = artifactMap.get(expectedPath);
    if (!artifact) {
      missingFiles.push(expectedPath);
      continue;
    }

    const actualHash = computeSha256(artifact.content);
    const actualSize = computeByteLength(artifact.content);

    if (actualHash !== expectedInfo.sha256 || actualSize !== expectedInfo.size) {
      mismatchedFiles.push(expectedPath);
    }
  }

  return {
    valid: mismatchedFiles.length === 0 && missingFiles.length === 0,
    mismatchedFiles,
    missingFiles,
  };
}
