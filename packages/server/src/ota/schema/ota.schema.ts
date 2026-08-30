import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * ota_apps: Multi-tenant application registry.
 */
export const otaApps = sqliteTable(
  'ota_apps',
  {
    id: text('id').primaryKey(), // e.g. 'com.goat.test' or 'miniapp-demo'
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').notNull().default('ACTIVE'), // 'ACTIVE' | 'ARCHIVED'
    defaultChannel: text('default_channel').notNull().default('production'),
    activeSigningKeyId: text('active_signing_key_id'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => ({
    statusIdx: index('idx_ota_apps_status').on(table.status),
  })
);

/**
 * ota_keys: Ed25519 cryptographic signing keypairs per tenant.
 */
export const otaKeys = sqliteTable(
  'ota_keys',
  {
    id: text('id').primaryKey(), // e.g. 'key_ed25519_demo_v1'
    appId: text('app_id').references(() => otaApps.id, { onDelete: 'cascade' }),
    keyAlias: text('key_alias').notNull(),
    algorithm: text('algorithm').notNull().default('Ed25519'),
    publicKey: text('public_key').notNull(), // SPKI PEM or Base64 raw 32 bytes
    publicKeyBase64: text('public_key_base64').notNull(),
    privateKeyEncrypted: text('private_key_encrypted'), // PKCS#8 PEM
    isActive: integer('is_active').notNull().default(1),
    createdAt: integer('created_at').notNull(),
  },
  (table) => ({
    appIdIdx: index('idx_ota_keys_app_id').on(table.appId),
  })
);

/**
 * ota_releases: Published release bundles.
 */
export const otaReleases = sqliteTable(
  'ota_releases',
  {
    id: text('id').primaryKey(), // e.g. 'rel_miniapp-demo_1.3.0_1724746800000'
    appId: text('app_id').notNull().references(() => otaApps.id, { onDelete: 'cascade' }),
    version: text('version').notNull(), // SemVer e.g. '1.3.0'
    channel: text('channel').notNull().default('production'), // 'production' | 'staging' | 'beta' | 'canary'
    bundleFilename: text('bundle_filename').notNull(),
    bundlePath: text('bundle_path').notNull(),
    bundleUrl: text('bundle_url').notNull(),
    bundleSize: integer('bundle_size').notNull(),
    sha256: text('sha256').notNull(),
    signature: text('signature').notNull(),
    signatureAlgorithm: text('signature_algorithm').notNull().default('Ed25519'),
    keyId: text('key_id'),
    minEngineVersion: text('min_engine_version'),
    targetPlatforms: text('target_platforms').default('*'), // JSON array or '*'
    releaseNotes: text('release_notes'),
    status: text('status').notNull().default('ACTIVE'), // 'ACTIVE' | 'ROLLED_BACK' | 'ARCHIVED'
    isMandatory: integer('is_mandatory').notNull().default(0),
    rolloutPercentage: integer('rollout_percentage').notNull().default(100),
    createdAt: integer('created_at').notNull(),
  },
  (table) => ({
    appVersionUniq: uniqueIndex('uniq_ota_releases_app_version').on(table.appId, table.version),
    appStatusIdx: index('idx_ota_releases_app_status').on(table.appId, table.status),
    appChannelIdx: index('idx_ota_releases_app_channel').on(table.appId, table.channel),
    createdAtIdx: index('idx_ota_releases_created_at').on(table.createdAt),
  })
);

/**
 * ota_patches: Precomputed BSDIFF40 binary differential patches between releases.
 */
export const otaPatches = sqliteTable(
  'ota_patches',
  {
    id: text('id').primaryKey(), // e.g. 'patch_1.2.0_to_1.3.0'
    appId: text('app_id').notNull().references(() => otaApps.id, { onDelete: 'cascade' }),
    sourceReleaseId: text('source_release_id').notNull().references(() => otaReleases.id, { onDelete: 'cascade' }),
    targetReleaseId: text('target_release_id').notNull().references(() => otaReleases.id, { onDelete: 'cascade' }),
    sourceVersion: text('source_version').notNull(),
    targetVersion: text('target_version').notNull(),
    patchFilename: text('patch_filename').notNull(),
    patchPath: text('patch_path').notNull(),
    patchUrl: text('patch_url').notNull(),
    patchSize: integer('patch_size').notNull(),
    sourceSize: integer('source_size').notNull(),
    targetSize: integer('target_size').notNull(),
    savingsPercentage: real('savings_percentage').notNull(), // e.g. 95.7
    sha256: text('sha256').notNull(), // Hash of .patch file
    targetSha256: text('target_sha256').notNull(), // Target bundle hash for post-patch validation
    signature: text('signature').notNull(),
    signatureAlgorithm: text('signature_algorithm').notNull().default('Ed25519'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => ({
    lookupIdx: index('idx_ota_patches_lookup').on(table.appId, table.sourceVersion, table.targetVersion),
    targetReleaseIdx: index('idx_ota_patches_target_rel').on(table.targetReleaseId),
  })
);

/**
 * ota_rollout_rules: Traffic governance, percentage-based canary rollout, and instant rollback.
 */
export const otaRolloutRules = sqliteTable(
  'ota_rollout_rules',
  {
    id: text('id').primaryKey(),
    appId: text('app_id').notNull().references(() => otaApps.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull().default('production'),
    targetReleaseId: text('target_release_id').notNull().references(() => otaReleases.id, { onDelete: 'cascade' }),
    targetVersion: text('target_version').notNull(),
    percentage: integer('percentage').notNull().default(100), // 0 to 100
    platforms: text('platforms').notNull().default('*'), // JSON array or '*'
    minEngineVersion: text('min_engine_version'),
    isActive: integer('is_active').notNull().default(1),
    isRollback: integer('is_rollback').notNull().default(0),
    rollbackReason: text('rollback_reason'),
    fallbackReleaseId: text('fallback_release_id').references(() => otaReleases.id),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => ({
    appActiveIdx: index('idx_ota_rollout_app_active').on(table.appId, table.isActive),
    appChannelActiveIdx: index('idx_ota_rollout_app_channel_active').on(table.appId, table.channel, table.isActive),
  })
);

/**
 * ota_telemetry: Real-time client device update telemetry ingestion.
 */
export const otaTelemetry = sqliteTable(
  'ota_telemetry',
  {
    id: text('id').primaryKey(),
    appId: text('app_id').notNull(),
    deviceId: text('device_id').notNull(),
    platform: text('platform').notNull(),
    osVersion: text('os_version'),
    fromVersion: text('from_version'),
    toVersion: text('to_version').notNull(),
    updateType: text('update_type').notNull(), // 'DELTA' | 'FULL'
    status: text('status').notNull(), // 'CHECK_HIT' | 'DOWNLOAD_SUCCESS' | 'APPLY_SUCCESS' | 'APPLY_FAILED' | 'CHECKSUM_FAILED' | 'SIGNATURE_FAILED'
    errorReason: text('error_reason'),
    durationMs: real('duration_ms').default(0.0),
    downloadBytes: integer('download_bytes').default(0),
    ipAddress: text('ip_address'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => ({
    appStatusIdx: index('idx_ota_telemetry_app_status').on(table.appId, table.status),
    createdAtIdx: index('idx_ota_telemetry_created_at').on(table.createdAt),
  })
);
