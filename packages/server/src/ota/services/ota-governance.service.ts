import * as crypto from 'node:crypto';

export interface RollbackRule {
  appId: string;
  targetVersion: string;
  channel?: string;
  reason?: string;
  active: boolean;
  createdAt: number;
}

export interface UpdateEvaluationParams {
  appId: string;
  currentVersion: string;
  platform?: string;
  deviceId?: string;
  engineVersion?: string;
  channel?: string;
  releaseVersion: string;
  rolloutPercentage: number;
  minEngineVersion?: string;
  targetPlatforms?: string[];
  activeRollback?: RollbackRule | null;
}

export interface GovernanceResult {
  isEligible: boolean;
  isRollback: boolean;
  targetVersion: string;
  reason: string;
  bucket: number;
}

/**
 * Computes deterministic canary bucket (0..99) using SHA-256 hash modulo 100.
 */
export function computeDeviceCanaryBucket(appId: string, deviceId: string): number {
  if (!deviceId) return 0;
  const hash = crypto.createHash('sha256').update(`${appId}:${deviceId}`).digest();
  return hash.readUInt32BE(0) % 100;
}

/**
 * Determines whether a device falls within the canary rollout percentage.
 */
export function isDeviceInCanaryBucket(appId: string, deviceId: string, rolloutPercentage: number): boolean {
  const clamped = Math.max(0, Math.min(100, Math.floor(rolloutPercentage)));
  if (clamped <= 0) return false;
  if (clamped >= 100) return true;
  const bucket = computeDeviceCanaryBucket(appId, deviceId);
  return bucket < clamped;
}

export function isEligibleForCanary(appId: string, deviceId: string, percentage: number): boolean {
  return isDeviceInCanaryBucket(appId, deviceId, percentage);
}

/**
 * Robust SemVer comparison function returning:
 *  1 if v1 > v2
 * -1 if v1 < v2
 *  0 if v1 === v2
 */
export function compareSemver(v1?: string, v2?: string): number {
  const clean1 = String(v1 || '0.0.0').replace(/^v/, '');
  const clean2 = String(v2 || '0.0.0').replace(/^v/, '');

  // Extract core version (before '-' or '+')
  const [core1, pre1] = clean1.split('-');
  const [core2, pre2] = clean2.split('-');

  const p1 = core1.split('.').map((x) => parseInt(x, 10) || 0);
  const p2 = core2.split('.').map((x) => parseInt(x, 10) || 0);

  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  // Pre-release versions have lower precedence than normal version
  if (!pre1 && pre2) return 1;
  if (pre1 && !pre2) return -1;
  if (pre1 && pre2) {
    return pre1.localeCompare(pre2);
  }

  return 0;
}

/**
 * Validates SemVer format.
 */
export function isValidSemver(v: string): boolean {
  if (!v || typeof v !== 'string') return false;
  return /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/.test(
    v.trim()
  );
}

/**
 * Checks if targetVersion is newer than currentVersion.
 */
export function isNewerVersion(currentVersion: string, targetVersion: string): boolean {
  return compareSemver(targetVersion, currentVersion) > 0;
}

/**
 * Evaluates traffic governance based on rollback rules, platform filters,
 * minimum engine version requirements, and deterministic canary percentage bucketing.
 */
export function evaluateGovernance(params: UpdateEvaluationParams): GovernanceResult {
  const bucket = computeDeviceCanaryBucket(params.appId, params.deviceId || 'default');

  // 1. Rollback Check
  if (params.activeRollback && params.activeRollback.active) {
    const rollbackTarget = params.activeRollback.targetVersion;
    if (params.currentVersion === rollbackTarget) {
      return {
        isEligible: false,
        isRollback: true,
        targetVersion: rollbackTarget,
        reason: 'Current version matches active rollback target',
        bucket,
      };
    }
    return {
      isEligible: true,
      isRollback: true,
      targetVersion: rollbackTarget,
      reason: `Emergency Rollback active to ${rollbackTarget}`,
      bucket,
    };
  }

  // 2. Up-to-date Check
  if (params.currentVersion === params.releaseVersion) {
    return {
      isEligible: false,
      isRollback: false,
      targetVersion: params.releaseVersion,
      reason: 'Client is already on latest version',
      bucket,
    };
  }

  // 3. Platform Filter Check
  if (params.targetPlatforms && params.targetPlatforms.length > 0 && params.platform) {
    const normPlatforms = params.targetPlatforms.map((p) => p.toLowerCase());
    const isWildcard = normPlatforms.includes('*') || normPlatforms.includes('all');
    if (!isWildcard && !normPlatforms.includes(params.platform.toLowerCase())) {
      return {
        isEligible: false,
        isRollback: false,
        targetVersion: params.releaseVersion,
        reason: `Platform ${params.platform} not supported by release`,
        bucket,
      };
    }
  }

  // 4. Min Engine Version Check
  if (params.minEngineVersion && params.engineVersion) {
    if (compareSemver(params.engineVersion, params.minEngineVersion) < 0) {
      return {
        isEligible: false,
        isRollback: false,
        targetVersion: params.releaseVersion,
        reason: `Client engine version ${params.engineVersion} is below required minEngineVersion ${params.minEngineVersion}`,
        bucket,
      };
    }
  }

  // 5. Canary Rollout Percentage Check
  const eligible = isDeviceInCanaryBucket(params.appId, params.deviceId || '', params.rolloutPercentage);
  return {
    isEligible: eligible,
    isRollback: false,
    targetVersion: params.releaseVersion,
    reason: eligible ? 'Device eligible in canary rollout' : 'Device bucket outside rollout threshold',
    bucket,
  };
}

export class OtaGovernanceService {
  public computeCanaryBucket(appId: string, deviceId: string): number {
    return computeDeviceCanaryBucket(appId, deviceId);
  }

  public isDeviceEligible(appId: string, deviceId: string, rolloutPercentage: number): boolean {
    return isDeviceInCanaryBucket(appId, deviceId, rolloutPercentage);
  }

  public compareVersions(v1?: string, v2?: string): number {
    return compareSemver(v1, v2);
  }

  public isValidVersion(version: string): boolean {
    return isValidSemver(version);
  }

  public isNewer(currentVersion: string, targetVersion: string): boolean {
    return isNewerVersion(currentVersion, targetVersion);
  }

  public evaluate(params: UpdateEvaluationParams): GovernanceResult {
    return evaluateGovernance(params);
  }
}
