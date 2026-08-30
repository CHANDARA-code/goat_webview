import express, { Express, Request, Response } from 'express';
import * as crypto from 'crypto';
import * as zlib from 'zlib';

export interface DiffOptions {
  minMatchLength?: number;
}

export interface PatchHeader {
  magic: string; // 'BSDIFF40'
  ctrlBlockLen: number;
  diffBlockLen: number;
  newFileSize: number;
}

export interface KeyPairResult {
  publicKeyPem: string;
  privateKeyPem: string;
  publicKeyBase64: string; // 32-byte raw
  keyId: string;
}

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

const ED25519_SPKI_DER_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/**
 * Generates an Ed25519 keypair for OTA package and patch signing.
 */
export function generateEd25519KeyPair(keyAlias?: string): KeyPairResult {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const spkiDer = publicKey.export({ type: 'spki', format: 'der' });
  const rawPub = spkiDer.subarray(ED25519_SPKI_DER_PREFIX.length);
  const publicKeyBase64 = rawPub.toString('base64');
  const keyId = keyAlias || `key_${crypto.randomBytes(8).toString('hex')}`;

  return {
    publicKeyPem,
    privateKeyPem,
    publicKeyBase64,
    keyId,
  };
}

/**
 * Signs payload data with Ed25519 private key, returning Base64 signature.
 */
export function signEd25519(data: Buffer, privateKeyPem: string): string {
  try {
    const privKey = crypto.createPrivateKey(privateKeyPem);
    const signature = crypto.sign(null, data, privKey);
    return signature.toString('base64');
  } catch (err: any) {
    throw new Error(`Ed25519 signing failed: ${err.message}`);
  }
}

/**
 * Verifies Ed25519 signature against data and public key (PEM or raw 32-byte Base64).
 */
export function verifyEd25519(data: Buffer, signatureBase64: string, publicKey: string): boolean {
  try {
    if (!signatureBase64 || typeof signatureBase64 !== 'string') return false;
    if (!publicKey || typeof publicKey !== 'string') return false;

    const signature = Buffer.from(signatureBase64, 'base64');
    if (signature.length !== 64) return false;

    let pubKey: crypto.KeyObject;
    const trimmed = publicKey.trim();
    if (trimmed.startsWith('-----BEGIN PUBLIC KEY-----')) {
      pubKey = crypto.createPublicKey(trimmed);
    } else {
      const rawPub = Buffer.from(trimmed, 'base64');
      if (rawPub.length !== 32) return false;
      const fullDer = Buffer.concat([ED25519_SPKI_DER_PREFIX, rawPub]);
      pubKey = crypto.createPublicKey({ key: fullDer, format: 'der', type: 'spki' });
    }

    return crypto.verify(null, data, pubKey, signature);
  } catch {
    return false;
  }
}

/**
 * Computes standard SHA-256 digest returning 64-char lowercase hex string.
 */
export function computeSha256(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex').toLowerCase();
}

/**
 * Pure TypeScript BSDIFF40 Binary Delta Differencing Engine.
 */
export function generateBsdiffPatch(oldBuffer: Buffer, newBuffer: Buffer, options: DiffOptions = {}): Buffer {
  const minMatch = options.minMatchLength || 8;
  const oldLen = oldBuffer.length;
  const newLen = newBuffer.length;

  const controlTuples: Array<{ diffLen: number; extraLen: number; seekOffset: number }> = [];
  const diffChunks: Buffer[] = [];
  const extraChunks: Buffer[] = [];

  let currentOldPos = 0;
  let newPos = 0;

  const matchMap = new Map<string, number[]>();
  if (minMatch > 0 && oldLen >= minMatch) {
    for (let i = 0; i <= oldLen - minMatch; i++) {
      const key = oldBuffer.subarray(i, i + minMatch).toString('binary');
      let arr = matchMap.get(key);
      if (!arr) {
        arr = [];
        matchMap.set(key, arr);
      }
      arr.push(i);
    }
  }

  while (newPos < newLen) {
    let bestOldPos = -1;
    let bestMatchLen = 0;

    if (minMatch > 0 && newPos + minMatch <= newLen) {
      const key = newBuffer.subarray(newPos, newPos + minMatch).toString('binary');
      const candidates = matchMap.get(key);
      if (candidates) {
        for (const candidatePos of candidates) {
          let matchLen = 0;
          while (
            newPos + matchLen < newLen &&
            candidatePos + matchLen < oldLen &&
            newBuffer[newPos + matchLen] === oldBuffer[candidatePos + matchLen]
          ) {
            matchLen++;
          }
          if (matchLen > bestMatchLen) {
            bestMatchLen = matchLen;
            bestOldPos = candidatePos;
          }
        }
      }
    }

    if (bestMatchLen >= minMatch && bestOldPos >= 0) {
      if (currentOldPos !== bestOldPos) {
        const seek = bestOldPos - currentOldPos;
        controlTuples.push({
          diffLen: 0,
          extraLen: 0,
          seekOffset: seek,
        });
        currentOldPos = bestOldPos;
      }

      const diffBuf = Buffer.alloc(bestMatchLen);
      for (let i = 0; i < bestMatchLen; i++) {
        diffBuf[i] = (newBuffer[newPos + i] - oldBuffer[bestOldPos + i] + 256) & 0xff;
      }
      diffChunks.push(diffBuf);

      controlTuples.push({
        diffLen: bestMatchLen,
        extraLen: 0,
        seekOffset: 0,
      });

      newPos += bestMatchLen;
      currentOldPos += bestMatchLen;
    } else {
      let extraStart = newPos;
      let nextMatchPos = newLen;

      if (minMatch > 0) {
        for (let searchPos = newPos + 1; searchPos <= newLen - minMatch; searchPos++) {
          const key = newBuffer.subarray(searchPos, searchPos + minMatch).toString('binary');
          if (matchMap.has(key)) {
            nextMatchPos = searchPos;
            break;
          }
        }
      }

      const extraLen = nextMatchPos - extraStart;
      const extraBuf = Buffer.from(newBuffer.subarray(extraStart, extraStart + extraLen));
      extraChunks.push(extraBuf);

      controlTuples.push({
        diffLen: 0,
        extraLen: extraLen,
        seekOffset: 0,
      });

      newPos += extraLen;
    }
  }

  const ctrlBuf = Buffer.alloc(controlTuples.length * 24);
  for (let i = 0; i < controlTuples.length; i++) {
    const t = controlTuples[i];
    ctrlBuf.writeBigInt64LE(BigInt(t.diffLen), i * 24);
    ctrlBuf.writeBigInt64LE(BigInt(t.extraLen), i * 24 + 8);
    ctrlBuf.writeBigInt64LE(BigInt(t.seekOffset), i * 24 + 16);
  }

  const allDiff = Buffer.concat(diffChunks);
  const allExtra = Buffer.concat(extraChunks);

  const gzipCtrl = zlib.gzipSync(ctrlBuf);
  const gzipDiff = zlib.gzipSync(allDiff);
  const gzipExtra = zlib.gzipSync(allExtra);

  const header = Buffer.alloc(32);
  header.write('BSDIFF40', 0, 8, 'ascii');
  header.writeBigInt64LE(BigInt(gzipCtrl.length), 8);
  header.writeBigInt64LE(BigInt(gzipDiff.length), 16);
  header.writeBigInt64LE(BigInt(newLen), 24);

  return Buffer.concat([header, gzipCtrl, gzipDiff, gzipExtra]);
}

/**
 * Pure TypeScript BSDIFF40 Binary Delta Patcher.
 */
export function applyBsdiffPatch(oldBuffer: Buffer, patchBuffer: Buffer, expectedTargetSha256?: string): Buffer {
  if (patchBuffer.length < 32) {
    throw new Error(`Invalid patch: header size ${patchBuffer.length} is less than 32 bytes`);
  }

  const magic = patchBuffer.subarray(0, 8).toString('ascii');
  if (magic !== 'BSDIFF40') {
    throw new Error(`Invalid patch magic header: expected 'BSDIFF40', got '${magic}'`);
  }

  const ctrlBlockLen = Number(patchBuffer.readBigInt64LE(8));
  const diffBlockLen = Number(patchBuffer.readBigInt64LE(16));
  const newFileSize = Number(patchBuffer.readBigInt64LE(24));

  if (ctrlBlockLen < 0 || diffBlockLen < 0 || newFileSize < 0) {
    throw new Error('Invalid patch: negative block length in header');
  }

  const ctrlStart = 32;
  const diffStart = ctrlStart + ctrlBlockLen;
  const extraStart = diffStart + diffBlockLen;

  if (patchBuffer.length < extraStart) {
    throw new Error('Invalid patch: patch buffer truncated before extra block');
  }

  const gzipCtrl = patchBuffer.subarray(ctrlStart, diffStart);
  const gzipDiff = patchBuffer.subarray(diffStart, extraStart);
  const gzipExtra = patchBuffer.subarray(extraStart);

  let ctrlBuf: Buffer;
  let diffBuf: Buffer;
  let extraBuf: Buffer;

  try {
    ctrlBuf = zlib.gunzipSync(gzipCtrl);
    diffBuf = zlib.gunzipSync(gzipDiff);
    extraBuf = zlib.gunzipSync(gzipExtra);
  } catch (err: any) {
    throw new Error(`Failed to decompress patch blocks: ${err.message}`);
  }

  const newBuffer = Buffer.alloc(newFileSize);
  let oldPos = 0;
  let newPos = 0;
  let diffPos = 0;
  let extraPos = 0;

  const numTuples = Math.floor(ctrlBuf.length / 24);
  for (let i = 0; i < numTuples; i++) {
    const diffLen = Number(ctrlBuf.readBigInt64LE(i * 24));
    const extraLen = Number(ctrlBuf.readBigInt64LE(i * 24 + 8));
    const seekOffset = Number(ctrlBuf.readBigInt64LE(i * 24 + 16));

    for (let j = 0; j < diffLen; j++) {
      if (newPos + j >= newFileSize) {
        throw new Error('Patch overflow: new buffer index out of bounds during diff copy');
      }
      const oldByte = oldPos + j >= 0 && oldPos + j < oldBuffer.length ? oldBuffer[oldPos + j] : 0;
      const diffByte = diffPos + j < diffBuf.length ? diffBuf[diffPos + j] : 0;
      newBuffer[newPos + j] = (oldByte + diffByte) & 0xff;
    }
    newPos += diffLen;
    oldPos += diffLen;
    diffPos += diffLen;

    for (let j = 0; j < extraLen; j++) {
      if (newPos + j >= newFileSize) {
        throw new Error('Patch overflow: new buffer index out of bounds during extra copy');
      }
      const extraByte = extraPos + j < extraBuf.length ? extraBuf[extraPos + j] : 0;
      newBuffer[newPos + j] = extraByte;
    }
    newPos += extraLen;
    extraPos += extraLen;

    oldPos += seekOffset;
  }

  if (newPos !== newFileSize) {
    throw new Error(`Corrupted patch: reconstructed size ${newPos} does not match expected size ${newFileSize}`);
  }

  if (expectedTargetSha256) {
    const actualSha = crypto.createHash('sha256').update(newBuffer).digest('hex');
    if (actualSha.toLowerCase() !== expectedTargetSha256.toLowerCase()) {
      throw new Error(`Target SHA-256 hash mismatch: expected ${expectedTargetSha256}, got ${actualSha}`);
    }
  }

  return newBuffer;
}

/**
 * Deterministic hash bucket generator.
 */
export function computeDeviceCanaryBucket(appId: string, deviceId: string): number {
  if (!deviceId) return 0;
  const hash = crypto.createHash('sha256').update(`${appId}:${deviceId}`).digest();
  return hash.readUInt32BE(0) % 100;
}

/**
 * Determines if device qualifies for canary percentage.
 */
export function isDeviceInCanaryBucket(appId: string, deviceId: string, rolloutPercentage: number): boolean {
  const clamped = Math.max(0, Math.min(100, Math.floor(rolloutPercentage)));
  if (clamped <= 0) return false;
  if (clamped >= 100) return true;
  const bucket = computeDeviceCanaryBucket(appId, deviceId);
  return bucket < clamped;
}

/**
 * Robust SemVer comparison.
 */
export function compareSemver(v1?: string, v2?: string): number {
  const p1 = String(v1 || '0.0.0').replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0);
  const p2 = String(v2 || '0.0.0').replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0);

  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Evaluates update eligibility based on platform, engine version, canary bucket, and rollback state.
 */
export function evaluateGovernance(params: UpdateEvaluationParams): GovernanceResult {
  const bucket = computeDeviceCanaryBucket(params.appId, params.deviceId || 'default');

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

  if (params.currentVersion === params.releaseVersion) {
    return {
      isEligible: false,
      isRollback: false,
      targetVersion: params.releaseVersion,
      reason: 'Client is already on latest version',
      bucket,
    };
  }

  if (params.targetPlatforms && params.targetPlatforms.length > 0 && params.platform) {
    const normPlatforms = params.targetPlatforms.map((p) => p.toLowerCase());
    if (!normPlatforms.includes(params.platform.toLowerCase())) {
      return {
        isEligible: false,
        isRollback: false,
        targetVersion: params.releaseVersion,
        reason: `Platform ${params.platform} not supported by release`,
        bucket,
      };
    }
  }

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

  const eligible = isDeviceInCanaryBucket(params.appId, params.deviceId || '', params.rolloutPercentage);
  return {
    isEligible: eligible,
    isRollback: false,
    targetVersion: params.releaseVersion,
    reason: eligible ? 'Device eligible in canary rollout' : 'Device bucket outside rollout threshold',
    bucket,
  };
}

/**
 * Creates an in-memory OTA Express App for testing.
 */
export function createOtaApp(): {
  app: Express;
  reset: () => void;
  getAppPublicKey: (appId: string) => string;
} {
  const app: Express = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  let releases: Map<string, any[]> = new Map();
  let patches: Map<string, any[]> = new Map();
  let appKeys: Map<string, { privateKeyPem: string; publicKeyPem: string; publicKeyBase64: string }> = new Map();
  let rollbackRules: Map<string, any> = new Map();
  let rolloutRules: Map<string, number> = new Map();
  let bundleStore: Map<string, Buffer> = new Map();
  let patchStore: Map<string, Buffer> = new Map();

  const reset = () => {
    releases.clear();
    patches.clear();
    appKeys.clear();
    rollbackRules.clear();
    rolloutRules.clear();
    bundleStore.clear();
    patchStore.clear();
  };

  const getOrCreateKey = (appId: string) => {
    if (!appKeys.has(appId)) {
      const kp = generateEd25519KeyPair(`key-${appId}`);
      appKeys.set(appId, kp);
    }
    return appKeys.get(appId)!;
  };

  const isValidSemver = (v: string): boolean => {
    return /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/.test(
      v
    );
  };

  // Release Publishing API
  app.post('/api/v1/ota/apps/:appId/releases', (req: Request, res: Response): void => {
    const { appId } = req.params;
    const { version, channel = 'production', rolloutPercentage = 100, bundleBase64, releaseNotes, minEngineVersion, targetPlatforms } = req.body;

    if (!version || !isValidSemver(version)) {
      res.status(400).json({ error: `Invalid SemVer version: ${version}` });
      return;
    }

    if (!bundleBase64 || typeof bundleBase64 !== 'string') {
      res.status(400).json({ error: 'Missing bundle payload (bundleBase64 required)' });
      return;
    }

    const appReleases = releases.get(appId) || [];
    if (appReleases.some((r) => r.version === version)) {
      res.status(409).json({ error: `Release version ${version} already exists for app ${appId}` });
      return;
    }

    const bundleBuf = Buffer.from(bundleBase64, 'base64');
    if (bundleBuf.length === 0) {
      res.status(400).json({ error: 'Bundle buffer cannot be empty' });
      return;
    }

    const key = getOrCreateKey(appId);
    const bundleSha256 = computeSha256(bundleBuf);
    const bundleSig = signEd25519(bundleBuf, key.privateKeyPem);

    bundleStore.set(`${appId}:${version}`, bundleBuf);

    const newRelease = {
      id: `rel_${crypto.randomBytes(6).toString('hex')}`,
      appId,
      version,
      channel,
      rolloutPercentage: Number(rolloutPercentage),
      fileSize: bundleBuf.length,
      sha256: bundleSha256,
      signature: bundleSig,
      signatureAlgorithm: 'Ed25519',
      minEngineVersion,
      targetPlatforms: targetPlatforms || ['android', 'ios', 'web', 'react-native', 'flutter'],
      releaseNotes,
      createdAt: Date.now(),
    };

    const appPatches = patches.get(appId) || [];
    const generatedPatches: any[] = [];

    for (const prior of appReleases) {
      const oldBuf = bundleStore.get(`${appId}:${prior.version}`);
      if (oldBuf) {
        const patchBuf = generateBsdiffPatch(oldBuf, bundleBuf);
        const patchSha = computeSha256(patchBuf);
        const patchSig = signEd25519(patchBuf, key.privateKeyPem);
        patchStore.set(`${appId}:${prior.version}:${version}`, patchBuf);

        const patchRec = {
          id: `patch_${crypto.randomBytes(6).toString('hex')}`,
          appId,
          fromVersion: prior.version,
          toVersion: version,
          patchSize: patchBuf.length,
          sha256: patchSha,
          signature: patchSig,
          createdAt: Date.now(),
        };
        appPatches.push(patchRec);
        generatedPatches.push(patchRec);
      }
    }

    appReleases.push(newRelease);
    releases.set(appId, appReleases);
    patches.set(appId, appPatches);
    rolloutRules.set(appId, Number(rolloutPercentage));

    res.status(201).json({
      success: true,
      release: newRelease,
      patches: generatedPatches,
      rollout: { appId, percentage: Number(rolloutPercentage), channel },
    });
  });

  // Client Update Check
  app.get('/api/v1/ota/check-update', (req: Request, res: Response): void => {
    const { appId, currentVersion, platform, deviceId = 'default', engineVersion, channel = 'production' } = req.query as Record<string, string>;

    if (!appId || !currentVersion) {
      res.status(400).json({ error: 'Query parameters appId and currentVersion are required' });
      return;
    }

    const rollback = rollbackRules.get(appId);
    if (rollback && rollback.active) {
      if (currentVersion === rollback.targetVersion) {
        res.json({
          status: 'NO_UPDATE',
          appId,
          currentVersion,
          message: 'Client is on active rollback version',
        });
        return;
      }
      const targetRel = (releases.get(appId) || []).find((r) => r.version === rollback.targetVersion);
      if (targetRel) {
        res.json({
          status: 'UPDATE_AVAILABLE',
          appId,
          targetVersion: targetRel.version,
          updateType: 'FULL',
          downloadUrl: `/api/v1/ota/bundles/${appId}/${targetRel.version}/bundle.zip`,
          sha256: targetRel.sha256,
          targetBundleSha256: targetRel.sha256,
          signature: targetRel.signature,
          signatureAlgorithm: 'Ed25519',
          fileSize: targetRel.fileSize,
          targetFileSize: targetRel.fileSize,
          baseVersion: currentVersion,
          isRollback: true,
          mandatory: true,
        });
        return;
      }
    }

    const appReleases = releases.get(appId) || [];
    const matchingReleases = appReleases.filter((r) => r.channel === channel);
    if (matchingReleases.length === 0) {
      res.json({ status: 'NO_UPDATE', appId, currentVersion, message: 'No releases found for app and channel' });
      return;
    }

    const latest = matchingReleases[matchingReleases.length - 1];

    if (currentVersion === latest.version) {
      res.json({ status: 'NO_UPDATE', appId, currentVersion, message: 'Application is up to date' });
      return;
    }

    if (platform && latest.targetPlatforms && !latest.targetPlatforms.includes(platform.toLowerCase())) {
      res.json({ status: 'NO_UPDATE', appId, currentVersion, message: `Platform ${platform} is not supported` });
      return;
    }

    const rolloutPct = rolloutRules.get(appId) ?? latest.rolloutPercentage ?? 100;
    const isEligible = isDeviceInCanaryBucket(appId, deviceId, rolloutPct);

    if (!isEligible) {
      res.json({ status: 'NO_UPDATE', appId, currentVersion, message: 'Device outside canary rollout threshold' });
      return;
    }

    const appPatches = patches.get(appId) || [];
    const deltaPatch = appPatches.find((p) => p.fromVersion === currentVersion && p.toVersion === latest.version);

    if (deltaPatch) {
      res.json({
        status: 'UPDATE_AVAILABLE',
        appId,
        targetVersion: latest.version,
        updateType: 'DELTA',
        downloadUrl: `/api/v1/ota/patches/${appId}/${currentVersion}/${latest.version}/patch.bin`,
        sha256: deltaPatch.sha256,
        targetBundleSha256: latest.sha256,
        signature: deltaPatch.signature,
        signatureAlgorithm: 'Ed25519',
        fileSize: deltaPatch.patchSize,
        targetFileSize: latest.fileSize,
        baseVersion: currentVersion,
        isRollback: false,
        mandatory: false,
      });
    } else {
      res.json({
        status: 'UPDATE_AVAILABLE',
        appId,
        targetVersion: latest.version,
        updateType: 'FULL',
        downloadUrl: `/api/v1/ota/bundles/${appId}/${latest.version}/bundle.zip`,
        sha256: latest.sha256,
        targetBundleSha256: latest.sha256,
        signature: latest.signature,
        signatureAlgorithm: 'Ed25519',
        fileSize: latest.fileSize,
        targetFileSize: latest.fileSize,
        baseVersion: currentVersion,
        isRollback: false,
        mandatory: false,
      });
    }
  });

  // Static Bundle Download
  app.get('/api/v1/ota/bundles/:appId/:version/bundle.zip', (req: Request, res: Response): void => {
    const { appId, version } = req.params;
    const buf = bundleStore.get(`${appId}:${version}`);
    if (!buf) {
      res.status(404).json({ error: 'Bundle not found' });
      return;
    }

    const etag = `"${computeSha256(buf).substring(0, 16)}"`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', buf.length);
    res.setHeader('ETag', etag);
    res.setHeader('Accept-Ranges', 'bytes');

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : buf.length - 1;
      const chunk = buf.subarray(start, end + 1);
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${buf.length}`);
      res.setHeader('Content-Length', chunk.length);
      res.send(chunk);
      return;
    }

    res.status(200).send(buf);
  });

  // Static Patch Download
  app.get('/api/v1/ota/patches/:appId/:fromVersion/:toVersion/patch.bin', (req: Request, res: Response): void => {
    const { appId, fromVersion, toVersion } = req.params;
    const buf = patchStore.get(`${appId}:${fromVersion}:${toVersion}`);
    if (!buf) {
      res.status(404).json({ error: 'Patch not found' });
      return;
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', buf.length);
    res.setHeader('ETag', `"${computeSha256(buf).substring(0, 16)}"`);
    res.status(200).send(buf);
  });

  // List Releases
  app.get('/api/v1/ota/apps/:appId/releases', (req: Request, res: Response): void => {
    const { appId } = req.params;
    const list = releases.get(appId) || [];
    const appPatches = patches.get(appId) || [];

    const result = list.map((r) => {
      const patchCount = appPatches.filter((p) => p.toVersion === r.version).length;
      return { ...r, patchCount };
    });

    res.json({ appId, count: result.length, releases: result });
  });

  // Rollout Adjustment API
  app.post('/api/v1/ota/apps/:appId/rollout', (req: Request, res: Response): void => {
    const { appId } = req.params;
    const { rolloutPercentage } = req.body;

    if (rolloutPercentage === undefined || typeof rolloutPercentage !== 'number' || rolloutPercentage < 0 || rolloutPercentage > 100) {
      res.status(400).json({ error: 'rolloutPercentage must be a number between 0 and 100' });
      return;
    }

    rolloutRules.set(appId, rolloutPercentage);
    res.json({ success: true, appId, rolloutPercentage });
  });

  // Rollback API
  app.post('/api/v1/ota/apps/:appId/rollback', (req: Request, res: Response): void => {
    const { appId } = req.params;
    const { targetVersion, reason } = req.body;

    if (!targetVersion) {
      res.status(400).json({ error: 'targetVersion is required' });
      return;
    }

    const appReleases = releases.get(appId) || [];
    if (!appReleases.some((r) => r.version === targetVersion)) {
      res.status(404).json({ error: `Target rollback version ${targetVersion} does not exist` });
      return;
    }

    const rule = {
      appId,
      targetVersion,
      reason: reason || 'Administrative Rollback',
      active: true,
      createdAt: Date.now(),
    };
    rollbackRules.set(appId, rule);

    res.json({ success: true, rollback: rule });
  });

  // Admin Dashboard UI
  const renderDashboardHtml = () => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Goat OTA Release Management Dashboard</title>
      <style>body { font-family: sans-serif; background: #0f172a; color: #f8fafc; }</style>
    </head>
    <body>
      <header><h1>Goat OTA Enterprise Release Dashboard</h1></header>
      <main>
        <section id="releases-table"><h2>Published Releases</h2></section>
        <section id="canary-governance"><h2>Live Canary Slider</h2><input type="range" min="0" max="100" id="canary-slider"/></section>
        <section id="delta-savings"><h2>Bandwidth Savings Metrics</h2></section>
        <section id="upload-modal"><h2>Bundle Upload Modal</h2></section>
      </main>
    </body>
    </html>
  `;

  app.get('/admin/ota', (req: Request, res: Response): void => {
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(renderDashboardHtml());
  });

  app.get('/dashboard/ota', (req: Request, res: Response): void => {
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(renderDashboardHtml());
  });

  const getAppPublicKey = (appId: string): string => {
    return getOrCreateKey(appId).publicKeyPem;
  };

  (app as any).getAppPublicKey = getAppPublicKey;
  app.locals.getAppPublicKey = getAppPublicKey;

  return { app, reset, getAppPublicKey };
}
