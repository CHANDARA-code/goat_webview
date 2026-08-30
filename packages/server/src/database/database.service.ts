import type * as schemaTypes from '../traces/schema/traces.schema';
import * as schema from '../traces/schema/traces.schema';
import * as otaSchema from '../ota/schema/ota.schema';
import * as paymentsSchema from '../payments/schema/payments.schema';
import * as manifestSchema from '../manifest/schema/manifest.schema';
import * as fs from 'fs';
import * as path from 'path';

export interface DatabaseServiceOptions {
  dbPath?: string;
  inMemory?: boolean;
}

export class DatabaseService {
  private sqlite: any;
  public db: any;

  constructor(options: DatabaseServiceOptions = {}) {
    const isMemory = options.inMemory || options.dbPath === ':memory:';
    let dbPath = options.dbPath || process.env.GOAT_DB_PATH || './data/goat_telemetry.db';

    let DatabaseClass: any;
    let drizzleFn: any;

    if (typeof (globalThis as any).Bun !== 'undefined') {
      const bunSqlite = require('bun:sqlite');
      DatabaseClass = bunSqlite.Database;
      const bunDrizzle = require('drizzle-orm/bun-sqlite');
      drizzleFn = bunDrizzle.drizzle;
    } else {
      const sqliteMod = 'better-sqlite3';
      DatabaseClass = require(sqliteMod);
      const drizzleMod = 'drizzle-orm/better-sqlite3';
      drizzleFn = require(drizzleMod).drizzle;
    }

    if (isMemory) {
      this.sqlite = new DatabaseClass(':memory:');
    } else {
      const dir = path.dirname(path.resolve(dbPath));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.sqlite = new DatabaseClass(dbPath);
      try {
        if (typeof this.sqlite.pragma === 'function') {
          this.sqlite.pragma('journal_mode = WAL');
        } else {
          this.sqlite.exec('PRAGMA journal_mode = WAL;');
        }
      } catch {}
    }

    try {
      if (typeof this.sqlite.pragma === 'function') {
        this.sqlite.pragma('foreign_keys = ON');
      } else {
        this.sqlite.exec('PRAGMA foreign_keys = ON;');
      }
    } catch {}

    this.migrate();
    const combinedSchema = { ...schema, ...otaSchema, ...paymentsSchema, ...manifestSchema };
    this.db = drizzleFn(this.sqlite, { schema: combinedSchema });
  }

  private migrate(): void {
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        token TEXT,
        app_id TEXT NOT NULL,
        device_name TEXT NOT NULL,
        platform TEXT NOT NULL,
        os_version TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        connected_at INTEGER NOT NULL,
        disconnected_at INTEGER,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        device_info TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_app_id ON sessions(app_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

      CREATE TABLE IF NOT EXISTS traces (
        id TEXT PRIMARY KEY,
        call_id TEXT NOT NULL,
        app_id TEXT NOT NULL,
        session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        direction TEXT NOT NULL DEFAULT 'REQ',
        params TEXT,
        payload TEXT,
        response TEXT,
        error TEXT,
        error_message TEXT,
        status TEXT NOT NULL DEFAULT 'SUCCESS',
        duration_ms REAL DEFAULT 0.0,
        timestamp INTEGER NOT NULL,
        start_time INTEGER,
        end_time INTEGER,
        thread TEXT DEFAULT 'main',
        thread_lane TEXT,
        seq_id INTEGER,
        batch_id TEXT,
        worker_ipc_latency_ms REAL,
        native_execution_latency_ms REAL,
        dom_render_latency_ms REAL,
        parent_call_id TEXT,
        ip TEXT DEFAULT '127.0.0.1',
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_traces_app_timestamp ON traces(app_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_traces_action ON traces(action);
      CREATE INDEX IF NOT EXISTS idx_traces_call_id ON traces(call_id);
      CREATE INDEX IF NOT EXISTS idx_traces_created_at ON traces(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_traces_status ON traces(status);
      CREATE INDEX IF NOT EXISTS idx_traces_thread_lane ON traces(thread_lane);

      CREATE TABLE IF NOT EXISTS mock_rules (
        id TEXT PRIMARY KEY,
        app_id TEXT NOT NULL DEFAULT '*',
        action TEXT NOT NULL,
        response TEXT,
        response_payload TEXT,
        delay_ms INTEGER NOT NULL DEFAULT 0,
        should_fail INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_mock_rules_app_action ON mock_rules(app_id, action);
      CREATE INDEX IF NOT EXISTS idx_mock_rules_action ON mock_rules(action);

      -- =======================================================================
      -- OTA DATABASE TABLES & INDEXES
      -- =======================================================================

      CREATE TABLE IF NOT EXISTS ota_apps (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        default_channel TEXT NOT NULL DEFAULT 'production',
        active_signing_key_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ota_apps_status ON ota_apps(status);

      CREATE TABLE IF NOT EXISTS ota_keys (
        id TEXT PRIMARY KEY,
        app_id TEXT REFERENCES ota_apps(id) ON DELETE CASCADE,
        key_alias TEXT NOT NULL,
        algorithm TEXT NOT NULL DEFAULT 'Ed25519',
        public_key TEXT NOT NULL,
        public_key_base64 TEXT NOT NULL,
        private_key_encrypted TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ota_keys_app_id ON ota_keys(app_id);

      CREATE TABLE IF NOT EXISTS ota_releases (
        id TEXT PRIMARY KEY,
        app_id TEXT NOT NULL REFERENCES ota_apps(id) ON DELETE CASCADE,
        version TEXT NOT NULL,
        channel TEXT NOT NULL DEFAULT 'production',
        bundle_filename TEXT NOT NULL,
        bundle_path TEXT NOT NULL,
        bundle_url TEXT NOT NULL,
        bundle_size INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        signature TEXT NOT NULL,
        signature_algorithm TEXT NOT NULL DEFAULT 'Ed25519',
        key_id TEXT,
        min_engine_version TEXT,
        target_platforms TEXT DEFAULT '*',
        release_notes TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        is_mandatory INTEGER NOT NULL DEFAULT 0,
        rollout_percentage INTEGER NOT NULL DEFAULT 100,
        created_at INTEGER NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uniq_ota_releases_app_version ON ota_releases(app_id, version);
      CREATE INDEX IF NOT EXISTS idx_ota_releases_app_status ON ota_releases(app_id, status);
      CREATE INDEX IF NOT EXISTS idx_ota_releases_app_channel ON ota_releases(app_id, channel);
      CREATE INDEX IF NOT EXISTS idx_ota_releases_created_at ON ota_releases(created_at);

      CREATE TABLE IF NOT EXISTS ota_patches (
        id TEXT PRIMARY KEY,
        app_id TEXT NOT NULL REFERENCES ota_apps(id) ON DELETE CASCADE,
        source_release_id TEXT NOT NULL REFERENCES ota_releases(id) ON DELETE CASCADE,
        target_release_id TEXT NOT NULL REFERENCES ota_releases(id) ON DELETE CASCADE,
        source_version TEXT NOT NULL,
        target_version TEXT NOT NULL,
        patch_filename TEXT NOT NULL,
        patch_path TEXT NOT NULL,
        patch_url TEXT NOT NULL,
        patch_size INTEGER NOT NULL,
        source_size INTEGER NOT NULL,
        target_size INTEGER NOT NULL,
        savings_percentage REAL NOT NULL,
        sha256 TEXT NOT NULL,
        target_sha256 TEXT NOT NULL,
        signature TEXT NOT NULL,
        signature_algorithm TEXT NOT NULL DEFAULT 'Ed25519',
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ota_patches_lookup ON ota_patches(app_id, source_version, target_version);
      CREATE INDEX IF NOT EXISTS idx_ota_patches_target_rel ON ota_patches(target_release_id);

      CREATE TABLE IF NOT EXISTS ota_rollout_rules (
        id TEXT PRIMARY KEY,
        app_id TEXT NOT NULL REFERENCES ota_apps(id) ON DELETE CASCADE,
        channel TEXT NOT NULL DEFAULT 'production',
        target_release_id TEXT NOT NULL REFERENCES ota_releases(id) ON DELETE CASCADE,
        target_version TEXT NOT NULL,
        percentage INTEGER NOT NULL DEFAULT 100,
        platforms TEXT NOT NULL DEFAULT '*',
        min_engine_version TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        is_rollback INTEGER NOT NULL DEFAULT 0,
        rollback_reason TEXT,
        fallback_release_id TEXT REFERENCES ota_releases(id),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ota_rollout_app_active ON ota_rollout_rules(app_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_ota_rollout_app_channel_active ON ota_rollout_rules(app_id, channel, is_active);

      CREATE TABLE IF NOT EXISTS ota_telemetry (
        id TEXT PRIMARY KEY,
        app_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        os_version TEXT,
        from_version TEXT,
        to_version TEXT NOT NULL,
        update_type TEXT NOT NULL,
        status TEXT NOT NULL,
        error_reason TEXT,
        duration_ms REAL DEFAULT 0.0,
        download_bytes INTEGER DEFAULT 0,
        ip_address TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ota_telemetry_app_status ON ota_telemetry(app_id, status);
      CREATE INDEX IF NOT EXISTS idx_ota_telemetry_created_at ON ota_telemetry(created_at);

      CREATE TABLE IF NOT EXISTS payment_intents (
        intent_id TEXT PRIMARY KEY,
        tenant_app_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL,
        nonce TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'CREATED',
        claimed INTEGER NOT NULL DEFAULT 0,
        transaction_handle TEXT,
        provider_ref TEXT,
        provider_intent_ref TEXT,
        failure_sub_code TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_payment_intents_tenant ON payment_intents(tenant_app_id);

      CREATE TABLE IF NOT EXISTS payment_webhook_events (
        event_id TEXT PRIMARY KEY,
        processed_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS manifest_entries (
        app_id TEXT PRIMARY KEY,
        manifest_json TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS manifest_assets (
        app_id TEXT NOT NULL,
        asset_path TEXT NOT NULL,
        content BLOB NOT NULL,
        mime_type TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        etag TEXT NOT NULL,
        size INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (app_id, asset_path)
      );

      CREATE INDEX IF NOT EXISTS idx_manifest_assets_app ON manifest_assets(app_id);

      CREATE TABLE IF NOT EXISTS tenant_keys (
        tenant_app_id TEXT PRIMARY KEY,
        key_base64 TEXT NOT NULL,
        algorithm TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  public getRawSqlite(): any {
    return this.sqlite;
  }

  public close(): void {
    try {
      this.sqlite.close();
    } catch {
      // ignore if already closed
    }
  }
}

