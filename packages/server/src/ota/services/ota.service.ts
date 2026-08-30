import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { eq, and, desc } from "drizzle-orm";
import { DatabaseService } from "../../database/database.service";
import {
  otaApps,
  otaKeys,
  otaReleases,
  otaPatches,
  otaRolloutRules,
  otaTelemetry,
} from "../schema/ota.schema";
import {
  OtaDeltaService,
  generateBsdiffPatch,
  applyBsdiffPatch,
} from "./ota-delta.service";
import {
  OtaCryptoService,
  generateEd25519KeyPair,
  signEd25519,
  verifyEd25519,
  computeSha256,
} from "./ota-crypto.service";
import {
  OtaGovernanceService,
  isValidSemver,
  compareSemver,
  isDeviceInCanaryBucket,
} from "./ota-governance.service";
import {
  CheckUpdateQuery,
  CheckUpdateResponse,
  PublishReleaseBody,
  TelemetryReport,
} from "../types/ota.types";

// ─── AES-256-GCM key envelope helpers (C1 fix) ───────────────────────────────
const KEY_ENC_SECRET = process.env.KEY_ENCRYPTION_SECRET || "";
const KEY_ENC_ALG = "aes-256-gcm";

function deriveAesKey(secret: string): Buffer {
  // HKDF-like: SHA-256 of secret with fixed info string produces a 32-byte key
  return crypto
    .createHash("sha256")
    .update(`goat-ota-key-enc:${secret}`)
    .digest();
}

function encryptPrivateKey(pem: string): string {
  if (!KEY_ENC_SECRET) {
    // Warn but don't block in dev/test environments without a secret configured
    console.warn(
      "[OTA] KEY_ENCRYPTION_SECRET is not set — private key stored with weak envelope",
    );
    return Buffer.from(pem, "utf-8").toString("base64");
  }
  const key = deriveAesKey(KEY_ENC_SECRET);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(KEY_ENC_ALG, key, iv);
  const ct = Buffer.concat([cipher.update(pem, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: base64(iv:tag:ciphertext)
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

function decryptPrivateKey(stored: string): string {
  if (!KEY_ENC_SECRET) {
    // Fallback for environments without a secret (dev/test)
    return Buffer.from(stored, "base64").toString("utf-8");
  }
  const buf = Buffer.from(stored, "base64");
  if (buf.length < 28) throw new Error("Stored key envelope too short");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const key = deriveAesKey(KEY_ENC_SECRET);
  const decipher = crypto.createDecipheriv(KEY_ENC_ALG, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ct).toString("utf-8") + decipher.final("utf-8");
}

// ─── Path validation helpers (C2 fix) ────────────────────────────────────────
const SAFE_ID_RE = /^[a-zA-Z0-9._-]{1,128}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+/;

function assertSafeId(value: string, label: string): void {
  if (!SAFE_ID_RE.test(value)) {
    const err: any = new Error(
      `Invalid ${label}: must match [a-zA-Z0-9._-]{1,128}`,
    );
    err.status = 400;
    throw err;
  }
}

function assertContainedPath(resolved: string, storageDir: string): void {
  const absStorage = path.resolve(storageDir);
  if (!resolved.startsWith(absStorage + path.sep) && resolved !== absStorage) {
    const err: any = new Error("Path escape detected — access denied");
    err.status = 400;
    throw err;
  }
}

// ─── Simple bounded LRU-style Map (H3 fix) ───────────────────────────────────
class BoundedMap<V> extends Map<string, V> {
  constructor(private readonly maxEntries: number) {
    super();
  }
  override set(key: string, value: V): this {
    if (this.size >= this.maxEntries && !this.has(key)) {
      // Evict oldest entry
      const firstKey = this.keys().next().value;
      if (firstKey !== undefined) this.delete(firstKey);
    }
    return super.set(key, value);
  }
}

export interface OtaServiceOptions {
  storageDir?: string;
  baseUrl?: string;
}

export class OtaService {
  private readonly storageDir: string;
  private readonly deltaService: OtaDeltaService;
  private readonly cryptoService: OtaCryptoService;
  private readonly governanceService: OtaGovernanceService;

  // H3: Bounded in-memory caches (max 64 entries each)
  private readonly memoryBundles = new BoundedMap<Buffer>(64);
  private readonly memoryPatches = new BoundedMap<Buffer>(128);
  private readonly memoryKeys = new BoundedMap<{
    privateKeyPem: string;
    publicKeyPem: string;
    publicKeyBase64: string;
    keyId: string;
  }>(32);

  constructor(
    private readonly dbService: DatabaseService,
    options: OtaServiceOptions = {},
  ) {
    this.storageDir =
      options.storageDir || path.resolve(__dirname, "../../../../data/ota");
    this.deltaService = new OtaDeltaService();
    this.cryptoService = new OtaCryptoService();
    this.governanceService = new OtaGovernanceService();

    this.ensureStorageDirectories();
  }

  private ensureStorageDirectories(): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
      const bundlesDir = path.join(this.storageDir, "bundles");
      const patchesDir = path.join(this.storageDir, "patches");
      if (!fs.existsSync(bundlesDir))
        fs.mkdirSync(bundlesDir, { recursive: true });
      if (!fs.existsSync(patchesDir))
        fs.mkdirSync(patchesDir, { recursive: true });
    } catch {
      // If filesystem is read-only (e.g. some lambda / in-memory test environments), fallback gracefully
    }
  }

  /**
   * Retrieves or generates Ed25519 signing keypair for an app tenant.
   * C1: Private keys are encrypted with AES-256-GCM before storage.
   */
  public getOrCreateAppSigningKey(appId: string): {
    privateKeyPem: string;
    publicKeyPem: string;
    publicKeyBase64: string;
    keyId: string;
  } {
    // H4/M5: Cache includes the real keyId from DB so it's consistent
    if (this.memoryKeys.has(appId)) {
      return this.memoryKeys.get(appId)!;
    }

    try {
      const existingKeys = this.dbService.db
        .select()
        .from(otaKeys)
        .where(and(eq(otaKeys.appId, appId), eq(otaKeys.isActive, 1)))
        .all();

      if (existingKeys && existingKeys.length > 0) {
        const k = existingKeys[0];
        // C1/H6: Decrypt the private key from the DB
        let privateKeyPem: string;
        try {
          privateKeyPem = decryptPrivateKey(k.privateKeyEncrypted || "");
        } catch {
          privateKeyPem = k.privateKeyEncrypted || ""; // graceful fallback for pre-existing unencrypted keys
        }
        const res = {
          privateKeyPem,
          publicKeyPem: k.publicKey,
          publicKeyBase64: k.publicKeyBase64,
          keyId: k.id,
        };
        this.memoryKeys.set(appId, res);
        return res;
      }
    } catch (err) {
      console.error(`[OTA] Failed to fetch signing key for ${appId}:`, err);
    }

    // Generate new keypair
    const kp = generateEd25519KeyPair(`key-${appId}`);
    const keyId = `key_${appId}_${crypto.randomBytes(8).toString("hex")}`;

    try {
      // C1: Encrypt private key before storing
      const encryptedPem = encryptPrivateKey(kp.privateKeyPem);
      const now = Date.now();
      // ota_keys.app_id is a FK onto ota_apps: without the parent row the key insert
      // fails with SQLITE_CONSTRAINT_FOREIGNKEY and the key silently never persists.
      this.dbService.db
        .insert(otaApps)
        .values({
          id: appId,
          name: appId,
          description: null,
          status: "ACTIVE",
          defaultChannel: "production",
          activeSigningKeyId: keyId,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .run();
      this.dbService.db
        .insert(otaKeys)
        .values({
          id: keyId,
          appId,
          keyAlias: `key-${appId}`,
          algorithm: "Ed25519",
          publicKey: kp.publicKeyPem,
          publicKeyBase64: kp.publicKeyBase64,
          privateKeyEncrypted: encryptedPem,
          isActive: 1,
          createdAt: now,
        })
        .run();
    } catch (err) {
      console.error(
        `[OTA] Failed to persist signing key for ${appId} — bundles signed with it will fail verification after a restart:`,
        err,
      );
    }

    const keyObj = {
      privateKeyPem: kp.privateKeyPem,
      publicKeyPem: kp.publicKeyPem,
      publicKeyBase64: kp.publicKeyBase64,
      keyId,
    };
    this.memoryKeys.set(appId, keyObj);
    return keyObj;
  }

  public getAppPublicKey(appId: string): string {
    return this.getOrCreateAppSigningKey(appId).publicKeyPem;
  }

  /**
   * Registers a new tenant app or returns existing record.
   */
  public getOrCreateApp(
    appId: string,
    name?: string,
    description?: string,
  ): any {
    try {
      const existing = this.dbService.db
        .select()
        .from(otaApps)
        .where(eq(otaApps.id, appId))
        .all();
      if (existing && existing.length > 0) {
        return existing[0];
      }
    } catch {}

    const appName = name || appId;
    const now = Date.now();
    const newApp = {
      id: appId,
      name: appName,
      description: description || null,
      status: "ACTIVE",
      defaultChannel: "production",
      activeSigningKeyId: `key-${appId}`,
      createdAt: now,
      updatedAt: now,
    };

    try {
      this.dbService.db.insert(otaApps).values(newApp).run();
    } catch {}

    this.getOrCreateAppSigningKey(appId);
    return newApp;
  }

  public listApps(): any[] {
    try {
      return this.dbService.db.select().from(otaApps).all();
    } catch {
      return [];
    }
  }

  public getApp(appId: string): any | null {
    try {
      const rows = this.dbService.db
        .select()
        .from(otaApps)
        .where(eq(otaApps.id, appId))
        .all();
      return rows.length > 0 ? rows[0] : null;
    } catch {
      return null;
    }
  }

  /**
   * Publishes a new release bundle, signs with Ed25519, and generates BSDIFF40 delta patches.
   */
  public async publishRelease(
    appId: string,
    params: {
      version: string;
      channel?: string;
      rolloutPercentage?: number;
      bundleBuffer: Buffer;
      releaseNotes?: string;
      minEngineVersion?: string;
      targetPlatforms?: string[] | string;
      isMandatory?: boolean;
    },
  ): Promise<{
    success: boolean;
    release: any;
    patches: any[];
    rollout: any;
  }> {
    const {
      version,
      channel = "production",
      rolloutPercentage = 100,
      bundleBuffer,
      releaseNotes,
      minEngineVersion,
      isMandatory = false,
    } = params;

    if (!version || !isValidSemver(version)) {
      throw new Error(`Invalid SemVer version: ${version}`);
    }

    // C2: Validate appId and version against strict allowlist to prevent path traversal
    assertSafeId(appId, "appId");
    if (!SEMVER_RE.test(version)) {
      const err: any = new Error(`Invalid version format: ${version}`);
      err.status = 400;
      throw err;
    }

    if (!bundleBuffer || bundleBuffer.length === 0) {
      throw new Error("Bundle buffer cannot be empty");
    }

    this.getOrCreateApp(appId);

    // Conflict Check: prevent duplicate version publication for same app
    try {
      const existing = this.dbService.db
        .select()
        .from(otaReleases)
        .where(
          and(eq(otaReleases.appId, appId), eq(otaReleases.version, version)),
        )
        .all();

      if (existing && existing.length > 0) {
        const err: any = new Error(
          `Release version ${version} already exists for app ${appId}`,
        );
        err.status = 409;
        throw err;
      }
    } catch (err: any) {
      if (err.status === 409) throw err;
    }

    // C2: Build and validate storage paths with containment check
    const bundleFilename = "bundle.zip";
    const bundleRelativeDir = path.join("bundles", appId, version);
    const bundleStorageDir = path.resolve(this.storageDir, bundleRelativeDir);
    assertContainedPath(bundleStorageDir, this.storageDir);
    const bundleFilePath = path.join(bundleStorageDir, bundleFilename);
    const bundleUrl = `/api/v1/ota/bundles/${appId}/${version}/bundle.zip`;

    // H1: Atomic file write via .tmp + renameSync
    try {
      if (!fs.existsSync(bundleStorageDir)) {
        fs.mkdirSync(bundleStorageDir, { recursive: true });
      }
      const tmpPath = bundleFilePath + ".tmp";
      fs.writeFileSync(tmpPath, bundleBuffer);
      fs.renameSync(tmpPath, bundleFilePath);
    } catch (err) {
      console.error(
        `[OTA] Failed to write bundle to disk for ${appId}@${version}:`,
        err,
      );
      // Continue — memory fallback is available
    }

    this.memoryBundles.set(`${appId}:${version}`, bundleBuffer);

    // Cryptographic signing
    const key = this.getOrCreateAppSigningKey(appId);
    const bundleSha256 = computeSha256(bundleBuffer);
    const bundleSig = signEd25519(bundleBuffer, key.privateKeyPem);

    let platformsStr = "*";
    if (params.targetPlatforms) {
      if (Array.isArray(params.targetPlatforms)) {
        platformsStr = JSON.stringify(params.targetPlatforms);
      } else {
        platformsStr = String(params.targetPlatforms);
      }
    }

    // L6: Use cryptographically random release ID to avoid timestamp collisions under load
    const releaseId = `rel_${appId}_${version}_${crypto.randomBytes(6).toString("hex")}`;
    const newRelease = {
      id: releaseId,
      appId,
      version,
      channel,
      bundleFilename,
      bundlePath: bundleFilePath,
      bundleUrl,
      bundleSize: bundleBuffer.length,
      fileSize: bundleBuffer.length,
      sha256: bundleSha256,
      signature: bundleSig,
      signatureAlgorithm: "Ed25519",
      keyId: key.keyId,
      minEngineVersion: minEngineVersion || null,
      targetPlatforms: platformsStr,
      releaseNotes: releaseNotes || null,
      status: "ACTIVE",
      isMandatory: isMandatory ? 1 : 0,
      rolloutPercentage: Number(rolloutPercentage),
      createdAt: Date.now(),
    };

    try {
      this.dbService.db.insert(otaReleases).values(newRelease).run();
    } catch (err) {
      // H2: Propagate — a silent swallow here means admin gets fake 201 on DB failure
      throw new Error(
        `Failed to persist release record for ${appId}@${version}: ${(err as any)?.message ?? err}`,
      );
    }

    // Query prior active releases to generate binary differential delta patches
    let priorReleases: any[] = [];
    try {
      priorReleases = this.dbService.db
        .select()
        .from(otaReleases)
        .where(
          and(eq(otaReleases.appId, appId), eq(otaReleases.status, "ACTIVE")),
        )
        .all()
        .filter((r: any) => r.version !== version);
    } catch {}

    const generatedPatches: any[] = [];
    const patchStorageBase = path.join(this.storageDir, "patches", appId);
    try {
      if (!fs.existsSync(patchStorageBase))
        fs.mkdirSync(patchStorageBase, { recursive: true });
    } catch {}

    for (const prior of priorReleases) {
      let oldBuf: Buffer | null = this.getBundleBuffer(appId, prior.version);
      if (!oldBuf && prior.bundlePath && fs.existsSync(prior.bundlePath)) {
        try {
          oldBuf = fs.readFileSync(prior.bundlePath);
        } catch {}
      }

      if (oldBuf && oldBuf.length > 0) {
        const patchBuf = generateBsdiffPatch(oldBuf, bundleBuffer);
        const patchFilename = `${prior.version}_to_${version}.patch`;
        const patchFilePath = path.join(patchStorageBase, patchFilename);
        const patchUrl = `/api/v1/ota/patches/${appId}/${prior.version}/${version}/patch.bin`;

        try {
          fs.writeFileSync(patchFilePath, patchBuf);
        } catch {}

        this.memoryPatches.set(
          `${appId}:${prior.version}:${version}`,
          patchBuf,
        );

        const patchSha = computeSha256(patchBuf);
        const patchSig = signEd25519(patchBuf, key.privateKeyPem);
        const savingsPercentage = Math.max(
          0,
          (1 - patchBuf.length / bundleBuffer.length) * 100,
        );

        const patchRec = {
          id: `patch_${appId}_${prior.version}_to_${version}`,
          appId,
          sourceReleaseId: prior.id,
          targetReleaseId: releaseId,
          sourceVersion: prior.version,
          targetVersion: version,
          fromVersion: prior.version,
          toVersion: version,
          patchFilename,
          patchPath: patchFilePath,
          patchUrl,
          patchSize: patchBuf.length,
          sourceSize: oldBuf.length,
          targetSize: bundleBuffer.length,
          savingsPercentage: Number(savingsPercentage.toFixed(2)),
          sha256: patchSha,
          targetSha256: bundleSha256,
          signature: patchSig,
          signatureAlgorithm: "Ed25519",
          createdAt: Date.now(),
        };

        try {
          this.dbService.db.insert(otaPatches).values(patchRec).run();
        } catch {}

        generatedPatches.push(patchRec);
      }
    }

    // Upsert Rollout Rule
    const ruleId = `rule_${appId}_${channel}_${Date.now()}`;
    const rolloutRec = {
      id: ruleId,
      appId,
      channel,
      targetReleaseId: releaseId,
      targetVersion: version,
      percentage: Number(rolloutPercentage),
      platforms: platformsStr,
      minEngineVersion: minEngineVersion || null,
      isActive: 1,
      isRollback: 0,
      rollbackReason: null,
      fallbackReleaseId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      // Deactivate previous active rules for this app & channel
      this.dbService.db
        .update(otaRolloutRules)
        .set({ isActive: 0 })
        .where(
          and(
            eq(otaRolloutRules.appId, appId),
            eq(otaRolloutRules.channel, channel),
          ),
        )
        .run();

      this.dbService.db.insert(otaRolloutRules).values(rolloutRec).run();
    } catch {}

    return {
      success: true,
      release: newRelease,
      patches: generatedPatches,
      rollout: { appId, percentage: Number(rolloutPercentage), channel },
    };
  }

  /**
   * Evaluates client update request and determines whether to serve a DELTA patch or FULL bundle.
   */
  public checkUpdate(params: CheckUpdateQuery): CheckUpdateResponse {
    const {
      appId,
      currentVersion,
      platform,
      deviceId = "default",
      engineVersion,
      channel = "production",
    } = params;

    if (!appId || !currentVersion) {
      throw new Error("Query parameters appId and currentVersion are required");
    }

    // 1. Check for Active Rollback Rule
    try {
      const activeRollbacks = this.dbService.db
        .select()
        .from(otaRolloutRules)
        .where(
          and(
            eq(otaRolloutRules.appId, appId),
            eq(otaRolloutRules.isActive, 1),
            eq(otaRolloutRules.isRollback, 1),
          ),
        )
        .all();

      if (activeRollbacks && activeRollbacks.length > 0) {
        const rollbackRule = activeRollbacks[0];
        if (currentVersion === rollbackRule.targetVersion) {
          return {
            status: "NO_UPDATE",
            appId,
            currentVersion,
            message: "Client is on active rollback version",
          };
        }

        const targetRelList = this.dbService.db
          .select()
          .from(otaReleases)
          .where(
            and(
              eq(otaReleases.appId, appId),
              eq(otaReleases.version, rollbackRule.targetVersion),
            ),
          )
          .all();

        if (targetRelList && targetRelList.length > 0) {
          const targetRel = targetRelList[0];
          return {
            status: "UPDATE_AVAILABLE",
            appId,
            targetVersion: targetRel.version,
            updateType: "FULL",
            downloadUrl: `/api/v1/ota/bundles/${appId}/${targetRel.version}/bundle.zip`,
            sha256: targetRel.sha256,
            targetBundleSha256: targetRel.sha256,
            signature: targetRel.signature,
            signatureAlgorithm: "Ed25519",
            keyId: targetRel.keyId || `key-${appId}`,
            fileSize: targetRel.bundleSize,
            targetFileSize: targetRel.bundleSize,
            baseVersion: currentVersion,
            isRollback: true,
            mandatory: true,
            releaseNotes: targetRel.releaseNotes || undefined,
          };
        }
      }
    } catch {}

    // 2. Fetch Active Release for appId & channel
    let appReleases: any[] = [];
    try {
      appReleases = this.dbService.db
        .select()
        .from(otaReleases)
        .where(
          and(
            eq(otaReleases.appId, appId),
            eq(otaReleases.channel, channel),
            eq(otaReleases.status, "ACTIVE"),
          ),
        )
        .orderBy(desc(otaReleases.createdAt))
        .all();
    } catch {}

    if (!appReleases || appReleases.length === 0) {
      return {
        status: "NO_UPDATE",
        appId,
        currentVersion,
        message: "No releases found for app and channel",
      };
    }

    const latest = appReleases[0];

    // 3. Up-to-date Check
    if (currentVersion === latest.version) {
      return {
        status: "NO_UPDATE",
        appId,
        currentVersion,
        message: "Application is up to date",
      };
    }

    // 4. Platform Filter Check
    if (platform && latest.targetPlatforms) {
      try {
        let platformsArr: string[] = [];
        if (latest.targetPlatforms.startsWith("[")) {
          platformsArr = JSON.parse(latest.targetPlatforms);
        } else {
          platformsArr = latest.targetPlatforms
            .split(",")
            .map((s: string) => s.trim());
        }
        const lower = platformsArr.map((p) => p.toLowerCase());
        if (
          !lower.includes("*") &&
          !lower.includes("all") &&
          !lower.includes(platform.toLowerCase())
        ) {
          return {
            status: "NO_UPDATE",
            appId,
            currentVersion,
            message: `Platform ${platform} is not supported`,
          };
        }
      } catch {}
    }

    // 5. Min Engine Version Check
    if (latest.minEngineVersion && engineVersion) {
      if (compareSemver(engineVersion, latest.minEngineVersion) < 0) {
        return {
          status: "NO_UPDATE",
          appId,
          currentVersion,
          message: `Host engine update required: client ${engineVersion} is below minimum ${latest.minEngineVersion}`,
        };
      }
    }

    // 6. Canary Rollout Check
    let rolloutPct = latest.rolloutPercentage ?? 100;
    try {
      const activeRule = this.dbService.db
        .select()
        .from(otaRolloutRules)
        .where(
          and(
            eq(otaRolloutRules.appId, appId),
            eq(otaRolloutRules.channel, channel),
            eq(otaRolloutRules.isActive, 1),
          ),
        )
        .all();
      if (activeRule && activeRule.length > 0) {
        rolloutPct = activeRule[0].percentage;
      }
    } catch {}

    const isEligible = isDeviceInCanaryBucket(appId, deviceId, rolloutPct);
    if (!isEligible) {
      return {
        status: "NO_UPDATE",
        appId,
        currentVersion,
        message: "Device outside canary rollout threshold",
      };
    }

    // 7. Look up precomputed delta patch
    let deltaPatch: any = null;
    try {
      const patches = this.dbService.db
        .select()
        .from(otaPatches)
        .where(
          and(
            eq(otaPatches.appId, appId),
            eq(otaPatches.sourceVersion, currentVersion),
            eq(otaPatches.targetVersion, latest.version),
          ),
        )
        .all();
      if (patches && patches.length > 0) {
        deltaPatch = patches[0];
      }
    } catch {}

    if (deltaPatch) {
      return {
        status: "UPDATE_AVAILABLE",
        appId,
        targetVersion: latest.version,
        updateType: "DELTA",
        downloadUrl: `/api/v1/ota/patches/${appId}/${currentVersion}/${latest.version}/patch.bin`,
        sha256: deltaPatch.sha256,
        targetBundleSha256: latest.sha256,
        signature: deltaPatch.signature,
        signatureAlgorithm: "Ed25519",
        keyId: latest.keyId || `key-${appId}`,
        fileSize: deltaPatch.patchSize,
        targetFileSize: latest.bundleSize,
        baseVersion: currentVersion,
        isRollback: false,
        mandatory: latest.isMandatory === 1,
        releaseNotes: latest.releaseNotes || undefined,
      };
    }

    return {
      status: "UPDATE_AVAILABLE",
      appId,
      targetVersion: latest.version,
      updateType: "FULL",
      downloadUrl: `/api/v1/ota/bundles/${appId}/${latest.version}/bundle.zip`,
      sha256: latest.sha256,
      targetBundleSha256: latest.sha256,
      signature: latest.signature,
      signatureAlgorithm: "Ed25519",
      keyId: latest.keyId || `key-${appId}`,
      fileSize: latest.bundleSize,
      targetFileSize: latest.bundleSize,
      baseVersion: currentVersion,
      isRollback: false,
      mandatory: latest.isMandatory === 1,
      releaseNotes: latest.releaseNotes || undefined,
    };
  }

  public setRolloutPercentage(
    appId: string,
    percentage: number,
    channel = "production",
  ): { success: boolean; appId: string; rolloutPercentage: number } {
    if (typeof percentage !== "number" || percentage < 0 || percentage > 100) {
      throw new Error("rolloutPercentage must be a number between 0 and 100");
    }

    const pct = Math.max(0, Math.min(100, Math.floor(percentage)));
    try {
      this.dbService.db
        .update(otaReleases)
        .set({ rolloutPercentage: pct })
        .where(
          and(eq(otaReleases.appId, appId), eq(otaReleases.channel, channel)),
        )
        .run();

      this.dbService.db
        .update(otaRolloutRules)
        .set({ percentage: pct, updatedAt: Date.now() })
        .where(
          and(
            eq(otaRolloutRules.appId, appId),
            eq(otaRolloutRules.channel, channel),
            eq(otaRolloutRules.isActive, 1),
          ),
        )
        .run();

      const activeRules = this.dbService.db
        .select()
        .from(otaRolloutRules)
        .where(
          and(
            eq(otaRolloutRules.appId, appId),
            eq(otaRolloutRules.channel, channel),
            eq(otaRolloutRules.isActive, 1),
          ),
        )
        .all();

      if (!activeRules || activeRules.length === 0) {
        const releases = this.dbService.db
          .select()
          .from(otaReleases)
          .where(
            and(eq(otaReleases.appId, appId), eq(otaReleases.channel, channel)),
          )
          .orderBy(desc(otaReleases.createdAt))
          .all();
        if (releases && releases.length > 0) {
          const latest = releases[0];
          this.dbService.db
            .insert(otaRolloutRules)
            .values({
              id: `rule_${appId}_${channel}_${Date.now()}`,
              appId,
              channel,
              targetReleaseId: latest.id,
              targetVersion: latest.version,
              percentage: pct,
              platforms: latest.targetPlatforms || "*",
              minEngineVersion: latest.minEngineVersion,
              isActive: 1,
              isRollback: 0,
              rollbackReason: null,
              fallbackReleaseId: null,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            })
            .run();
        }
      }
    } catch {}

    return { success: true, appId, rolloutPercentage: pct };
  }

  /**
   * Triggers an emergency 1-click rollback to a designated target version.
   */
  public triggerRollback(
    appId: string,
    targetVersion: string,
    reason?: string,
    channel = "production",
  ): any {
    if (!targetVersion) {
      throw new Error("targetVersion is required");
    }

    const releases = this.listReleases(appId);
    const targetRel = releases.find((r) => r.version === targetVersion);
    if (!targetRel) {
      const err: any = new Error(
        `Target rollback version ${targetVersion} does not exist`,
      );
      err.status = 404;
      throw err;
    }

    const ruleId = `rollback_${appId}_${Date.now()}`;
    const rule = {
      id: ruleId,
      appId,
      channel,
      targetReleaseId: targetRel.id,
      targetVersion,
      percentage: 100,
      platforms: "*",
      isActive: 1,
      isRollback: 1,
      rollbackReason: reason || "Administrative Rollback",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      // Deactivate other rules
      this.dbService.db
        .update(otaRolloutRules)
        .set({ isActive: 0 })
        .where(
          and(
            eq(otaRolloutRules.appId, appId),
            eq(otaRolloutRules.channel, channel),
          ),
        )
        .run();

      this.dbService.db.insert(otaRolloutRules).values(rule).run();
    } catch {}

    return { success: true, rollback: rule };
  }

  /**
   * Lists published releases for an app with patch counts.
   */
  public listReleases(appId: string): any[] {
    try {
      const releases = this.dbService.db
        .select()
        .from(otaReleases)
        .where(eq(otaReleases.appId, appId))
        .orderBy(desc(otaReleases.createdAt))
        .all();

      const patches = this.dbService.db
        .select()
        .from(otaPatches)
        .where(eq(otaPatches.appId, appId))
        .all();

      return releases.map((r: any) => {
        const patchCount = patches.filter(
          (p: any) =>
            p.targetVersion === r.version || p.toVersion === r.version,
        ).length;
        return { ...r, patchCount, fileSize: r.bundleSize || r.fileSize };
      });
    } catch {
      return [];
    }
  }

  /**
   * Lists generated delta patches for an app.
   */
  public listPatches(appId: string): any[] {
    try {
      return this.dbService.db
        .select()
        .from(otaPatches)
        .where(eq(otaPatches.appId, appId))
        .all();
    } catch {
      return [];
    }
  }

  /**
   * Records client update telemetry.
   */
  public recordTelemetry(report: TelemetryReport): void {
    const id = `tel_${crypto.randomBytes(8).toString("hex")}`;
    try {
      this.dbService.db
        .insert(otaTelemetry)
        .values({
          id,
          appId: report.appId,
          deviceId: report.deviceId,
          platform: report.platform || "unknown",
          fromVersion: report.fromVersion || null,
          toVersion: report.targetVersion,
          updateType: report.updateType,
          status: report.eventType,
          errorReason: report.errorMessage || null,
          durationMs: report.durationMs || 0.0,
          downloadBytes: report.bytesTransferred || 0,
          createdAt: report.timestamp || Date.now(),
        })
        .run();
    } catch {}
  }

  /**
   * Aggregates telemetry stats & bandwidth savings for an app.
   */
  public getAppStats(appId: string): {
    appId: string;
    totalReleases: number;
    totalPatches: number;
    avgBandwidthSavingsPercent: number;
    activeRolloutPercentage: number;
    activeVersion: string | null;
  } {
    const releases = this.listReleases(appId);
    const patches = this.listPatches(appId);

    let avgSavings = 0;
    if (patches.length > 0) {
      const sum = patches.reduce(
        (acc: number, p: any) => acc + (p.savingsPercentage || 0),
        0,
      );
      avgSavings = Number((sum / patches.length).toFixed(1));
    }

    let activeRollout = 100;
    let activeVer = releases.length > 0 ? releases[0].version : null;

    try {
      const rules = this.dbService.db
        .select()
        .from(otaRolloutRules)
        .where(
          and(
            eq(otaRolloutRules.appId, appId),
            eq(otaRolloutRules.isActive, 1),
          ),
        )
        .all();
      if (rules && rules.length > 0) {
        activeRollout = rules[0].percentage;
        activeVer = rules[0].targetVersion;
      }
    } catch {}

    return {
      appId,
      totalReleases: releases.length,
      totalPatches: patches.length,
      avgBandwidthSavingsPercent: avgSavings,
      activeRolloutPercentage: activeRollout,
      activeVersion: activeVer,
    };
  }

  /**
   * Retrieves bundle binary from memory cache or filesystem.
   */
  public getBundleBuffer(appId: string, version: string): Buffer | null {
    const memKey = `${appId}:${version}`;
    if (this.memoryBundles.has(memKey)) {
      return this.memoryBundles.get(memKey)!;
    }

    const filePath = path.join(
      this.storageDir,
      "bundles",
      appId,
      version,
      "bundle.zip",
    );
    if (fs.existsSync(filePath)) {
      try {
        const buf = fs.readFileSync(filePath);
        this.memoryBundles.set(memKey, buf);
        return buf;
      } catch {}
    }

    return null;
  }

  /**
   * Retrieves patch binary from memory cache or filesystem.
   */
  public getPatchBuffer(
    appId: string,
    fromVersion: string,
    toVersion: string,
  ): Buffer | null {
    const memKey = `${appId}:${fromVersion}:${toVersion}`;
    if (this.memoryPatches.has(memKey)) {
      return this.memoryPatches.get(memKey)!;
    }

    const filePath = path.join(
      this.storageDir,
      "patches",
      appId,
      `${fromVersion}_to_${toVersion}.patch`,
    );
    if (fs.existsSync(filePath)) {
      try {
        const buf = fs.readFileSync(filePath);
        this.memoryPatches.set(memKey, buf);
        return buf;
      } catch {}
    }

    return null;
  }
}
