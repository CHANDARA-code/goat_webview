import { z } from 'zod';

// ============================================================================
// 1. DELTA ENGINE TYPES & SCHEMAS (BSDIFF40)
// ============================================================================

export interface DiffOptions {
  /** Minimum length of matching substring to consider (default: 4) */
  minMatchLength?: number;
  /** Chunk size for suffix / hash partitioning (default: 65536) */
  chunkSize?: number;
}

export interface PatchHeader {
  /** Must match 'BSDIFF40' */
  magic: string;
  /** Length of the compressed control block in bytes */
  ctrlBlockLen: number;
  /** Length of the compressed diff block in bytes */
  diffBlockLen: number;
  /** Expected byte length of the reconstructed target file */
  newFileSize: number;
}

export interface ControlEntry {
  /** Number of bytes to read from diff stream and add modulo 256 to oldBuffer */
  diffLen: number;
  /** Number of bytes to copy verbatim from extra stream to target buffer */
  extraLen: number;
  /** Relative offset to seek in oldBuffer (signed) */
  seekOffset: number;
}

export interface DeltaMetrics {
  oldSize: number;
  newSize: number;
  patchSize: number;
  savingsBytes: number;
  savingsRatio: number; // e.g. 0.92 for 92% bandwidth reduction
  durationMs: number;
}

export interface DeltaGenerationResult {
  patchBuffer: Buffer;
  header: PatchHeader;
  metrics: DeltaMetrics;
  sha256: string;
  targetSha256: string;
}

// ============================================================================
// 2. CRYPTO SERVICE TYPES & SCHEMAS (Ed25519 & SHA-256)
// ============================================================================

export type SignatureAlgorithm = 'Ed25519';

export interface KeyPairResult {
  /** PEM format (SPKI for public, PKCS#8 for private) */
  publicKeyPem: string;
  privateKeyPem: string;
  /** Raw 32-byte Ed25519 public key encoded as Base64 (44 chars) */
  publicKeyBase64: string;
  /** Unique key identifier (e.g. keyAlias or hash prefix) */
  keyId: string;
  /** Human-readable key alias */
  keyAlias?: string;
  /** Timestamp when keypair was generated */
  createdAt: number;
}

export interface SignedPayload<T = unknown> {
  data: T;
  signature: string; // Base64
  signatureAlgorithm: SignatureAlgorithm;
  keyId: string;
  sha256: string;
}

export interface CryptoVerificationResult {
  valid: boolean;
  reason?: string;
  keyId?: string;
}

// ============================================================================
// 3. OTA DATABASE & ENTITY RECORDS (M2-M5 Alignment)
// ============================================================================

export interface OtaAppRecord {
  id: string;
  appId: string;
  name: string;
  description?: string | null;
  defaultChannel: string;
  createdAt: number;
  updatedAt: number;
}

export type OtaReleaseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'ROLLED_BACK';

export interface OtaReleaseRecord {
  id: string;
  appId: string;
  version: string;
  channel: string;
  bundlePath: string;
  bundleSha256: string;
  bundleSize: number;
  signature: string;
  signatureAlgorithm: SignatureAlgorithm;
  keyId: string;
  minEngineVersion?: string | null;
  releaseNotes?: string | null;
  isMandatory: boolean;
  status: OtaReleaseStatus;
  createdAt: number;
}

export interface OtaPatchRecord {
  id: string;
  appId: string;
  fromVersion: string;
  toVersion: string;
  patchPath: string;
  patchSha256: string;
  targetSha256: string;
  patchSize: number;
  targetSize: number;
  signature: string;
  savingsRatio: number;
  createdAt: number;
}

export interface OtaRolloutRuleRecord {
  id: string;
  appId: string;
  version: string;
  channel: string;
  percentage: number; // 0 to 100
  targetPlatforms?: string[] | null;
  minClientVersion?: string | null;
  maxClientVersion?: string | null;
  isActive: boolean;
  isRollback: boolean;
  rollbackToVersion?: string | null;
  updatedAt: number;
}

export interface OtaSigningKeyRecord {
  id: string;
  keyId: string;
  appId: string;
  keyAlias: string;
  publicKeyPem: string;
  publicKeyBase64: string;
  privateKeyPemEncrypted?: string | null;
  isActive: boolean;
  createdAt: number;
}

export interface OtaTelemetryRecord {
  id: string;
  appId: string;
  deviceId: string;
  fromVersion?: string | null;
  targetVersion: string;
  updateType: 'DELTA' | 'FULL';
  eventType:
    | 'CHECK'
    | 'DOWNLOAD_START'
    | 'DOWNLOAD_SUCCESS'
    | 'DOWNLOAD_FAIL'
    | 'PATCH_APPLY_SUCCESS'
    | 'PATCH_APPLY_FAIL'
    | 'FALLBACK_TO_FULL';
  durationMs?: number | null;
  bytesTransferred?: number | null;
  errorMessage?: string | null;
  platform?: string | null;
  timestamp: number;
}

// ============================================================================
// 4. API REQUEST/RESPONSE CONTRACTS & ZOD SCHEMAS
// ============================================================================

export const CheckUpdateQuerySchema = z.object({
  appId: z.string().min(1, 'appId is required'),
  currentVersion: z.string().min(1, 'currentVersion is required'),
  platform: z.string().optional().default('all'),
  deviceId: z.string().optional().default('default-device'),
  engineVersion: z.string().optional(),
  channel: z.string().optional().default('production'),
});

export type CheckUpdateQuery = z.infer<typeof CheckUpdateQuerySchema>;

export interface UpdateAvailableResponse {
  status: 'UPDATE_AVAILABLE';
  appId: string;
  targetVersion: string;
  updateType: 'DELTA' | 'FULL';
  downloadUrl: string;
  sha256: string;
  targetBundleSha256: string;
  signature: string;
  signatureAlgorithm: SignatureAlgorithm;
  keyId: string;
  fileSize: number;
  targetFileSize: number;
  baseVersion?: string;
  isRollback: boolean;
  mandatory: boolean;
  releaseNotes?: string;
}

export interface NoUpdateResponse {
  status: 'NO_UPDATE';
  appId: string;
  currentVersion: string;
  message: string;
}

export type CheckUpdateResponse = UpdateAvailableResponse | NoUpdateResponse;

export const PublishReleaseBodySchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+/, 'Version must follow SemVer format'),
  channel: z.string().optional().default('production'),
  rolloutPercentage: z.number().min(0).max(100).optional().default(100),
  minEngineVersion: z.string().optional(),
  releaseNotes: z.string().optional(),
  isMandatory: z.boolean().optional().default(false),
});

export type PublishReleaseBody = z.infer<typeof PublishReleaseBodySchema>;

export const RollbackRequestSchema = z.object({
  targetVersion: z.string().min(1, 'targetVersion is required'),
  reason: z.string().optional(),
});

export type RollbackRequest = z.infer<typeof RollbackRequestSchema>;

export const TelemetryReportSchema = z.object({
  appId: z.string().min(1),
  deviceId: z.string().min(1),
  fromVersion: z.string().optional(),
  targetVersion: z.string().min(1),
  updateType: z.enum(['DELTA', 'FULL']),
  eventType: z.enum([
    'CHECK',
    'DOWNLOAD_START',
    'DOWNLOAD_SUCCESS',
    'DOWNLOAD_FAIL',
    'PATCH_APPLY_SUCCESS',
    'PATCH_APPLY_FAIL',
    'FALLBACK_TO_FULL',
  ]),
  durationMs: z.number().optional(),
  bytesTransferred: z.number().optional(),
  errorMessage: z.string().optional(),
  platform: z.string().optional(),
  timestamp: z.number().optional().default(() => Date.now()),
});

export type TelemetryReport = z.infer<typeof TelemetryReportSchema>;

// ============================================================================
// 5. ERROR HIERARCHY
// ============================================================================

export enum OtaErrorCode {
  INVALID_HEADER = 'OTA_INVALID_PATCH_HEADER',
  CORRUPT_BLOCK = 'OTA_CORRUPT_PATCH_BLOCK',
  PATCH_APPLICATION_FAILED = 'OTA_PATCH_APPLICATION_FAILED',
  INTEGRITY_MISMATCH = 'OTA_INTEGRITY_MISMATCH',
  INVALID_KEY = 'OTA_INVALID_KEY',
  INVALID_SIGNATURE = 'OTA_INVALID_SIGNATURE',
  VERIFICATION_FAILED = 'OTA_VERIFICATION_FAILED',
  UNSUPPORTED_VERSION = 'OTA_UNSUPPORTED_VERSION',
  RELEASE_NOT_FOUND = 'OTA_RELEASE_NOT_FOUND',
}

export class OtaError extends Error {
  constructor(
    public readonly code: OtaErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(`[${code}] ${message}`);
    this.name = 'OtaError';
  }
}

export class BsdiffError extends OtaError {}

export class InvalidPatchHeaderError extends BsdiffError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(OtaErrorCode.INVALID_HEADER, message, details);
    this.name = 'InvalidPatchHeaderError';
  }
}

export class CorruptPatchBlockError extends BsdiffError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(OtaErrorCode.CORRUPT_BLOCK, message, details);
    this.name = 'CorruptPatchBlockError';
  }
}

export class PatchApplicationError extends BsdiffError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(OtaErrorCode.PATCH_APPLICATION_FAILED, message, details);
    this.name = 'PatchApplicationError';
  }
}

export class IntegrityCheckError extends BsdiffError {
  constructor(expectedSha256: string, actualSha256: string) {
    super(
      OtaErrorCode.INTEGRITY_MISMATCH,
      `Target reconstructed bundle SHA-256 mismatch. Expected: ${expectedSha256}, Actual: ${actualSha256}`,
      { expectedSha256, actualSha256 }
    );
    this.name = 'IntegrityCheckError';
  }
}

export class OtaCryptoError extends OtaError {}

export class InvalidKeyError extends OtaCryptoError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(OtaErrorCode.INVALID_KEY, message, details);
    this.name = 'InvalidKeyError';
  }
}

export class InvalidSignatureError extends OtaCryptoError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(OtaErrorCode.INVALID_SIGNATURE, message, details);
    this.name = 'InvalidSignatureError';
  }
}
