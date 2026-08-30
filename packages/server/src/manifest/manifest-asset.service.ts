import * as crypto from 'crypto';
import * as path from 'path';
import { eq, and } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { manifestEntries, manifestAssets } from './schema/manifest.schema';
import { MiniAppManifest, MiniAppManifestSchema, AssetRecord } from './manifest.types';

const DEFAULT_APP_ID = 'com.goat.default';
const DEFAULT_MANIFEST = {
  appId: DEFAULT_APP_ID,
  name: 'Goat MiniApp Container',
  version: '1.4.0',
  description: 'Default Goat MiniApp Runtime Container',
  entry: 'index.html',
  pages: ['pages/home', 'pages/settings'],
  window: {
    navigationBarTitleText: 'Goat MiniApp',
    navigationBarBackgroundColor: '#1e1e2e',
    navigationBarTextStyle: 'white',
  },
};
const DEFAULT_INDEX_HTML =
  '<!DOCTYPE html><html><head><title>Goat MiniApp</title></head><body><h1>Goat MiniApp Running</h1></body></html>';

export class ManifestAssetService {
  private readonly db: any;

  constructor(dbService: DatabaseService) {
    this.db = dbService.db;
    if (!this.getManifest(DEFAULT_APP_ID)) {
      this.registerManifest(DEFAULT_APP_ID, DEFAULT_MANIFEST as MiniAppManifest);
    }
    if (!this.getAsset(DEFAULT_APP_ID, 'index.html')) {
      this.registerAsset(DEFAULT_APP_ID, 'index.html', Buffer.from(DEFAULT_INDEX_HTML), 'text/html');
    }
  }

  public validateManifest(data: unknown): { success: boolean; data?: MiniAppManifest; error?: string } {
    const result = MiniAppManifestSchema.safeParse(data);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      return { success: false, error: issues };
    }
    return { success: true, data: result.data };
  }

  public registerManifest(appId: string, manifest: MiniAppManifest): MiniAppManifest {
    const validation = this.validateManifest(manifest);
    if (!validation.success) {
      throw new Error(`Invalid manifest for ${appId}: ${validation.error}`);
    }
    const validated = validation.data!;
    const jsonStr = JSON.stringify(validated);
    const sha256 = crypto.createHash('sha256').update(jsonStr).digest('hex');
    validated.sha256 = sha256;

    this.db
      .insert(manifestEntries)
      .values({
        appId,
        manifestJson: jsonStr,
        sha256,
        updatedAt: Date.now(),
      })
      .onConflictDoUpdate({
        target: manifestEntries.appId,
        set: { manifestJson: jsonStr, sha256, updatedAt: Date.now() },
      })
      .run();
    return validated;
  }

  public getManifest(appId: string): MiniAppManifest | undefined {
    const row = this.db
      .select()
      .from(manifestEntries)
      .where(eq(manifestEntries.appId, appId))
      .get();
    if (!row) return undefined;
    try {
      return JSON.parse(row.manifestJson) as MiniAppManifest;
    } catch {
      return undefined;
    }
  }

  public canonicalizePath(rawPath: string): string {
    if (!rawPath) return '';
    const normalized = path.posix.normalize(rawPath.replace(/\\/g, '/'));
    return normalized
      .replace(/^(\.\.\/|\.\.)+/, '')
      .replace(/^\/+/, '')
      .replace(/^\.$/, '');
  }

  public registerAsset(
    appId: string,
    relativePath: string,
    content: Buffer | string,
    mimeType?: string
  ): AssetRecord {
    const cleanPath = this.canonicalizePath(relativePath);
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const etag = `"${sha256}"`;
    const resolvedMime = mimeType || this.detectMimeType(cleanPath);
    const now = Date.now();

    const record: AssetRecord = {
      appId,
      path: cleanPath,
      content: buffer,
      mimeType: resolvedMime,
      sha256,
      etag,
      size: buffer.length,
      updatedAt: now,
    };

    this.db
      .insert(manifestAssets)
      .values({
        appId,
        assetPath: cleanPath,
        content: buffer,
        mimeType: resolvedMime,
        sha256,
        etag,
        size: buffer.length,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [manifestAssets.appId, manifestAssets.assetPath],
        set: { content: buffer, mimeType: resolvedMime, sha256, etag, size: buffer.length, updatedAt: now },
      })
      .run();
    return record;
  }

  public getAsset(appId: string, relativePath: string): AssetRecord | undefined {
    const cleanPath = this.canonicalizePath(relativePath);
    const row = this.db
      .select()
      .from(manifestAssets)
      .where(and(eq(manifestAssets.appId, appId), eq(manifestAssets.assetPath, cleanPath)))
      .get();
    if (!row) return undefined;
    const buffer = Buffer.isBuffer(row.content) ? row.content : Buffer.from(row.content as any);
    return {
      appId: row.appId,
      path: row.assetPath,
      content: buffer,
      mimeType: row.mimeType,
      sha256: row.sha256,
      etag: row.etag,
      size: row.size,
      updatedAt: row.updatedAt,
    };
  }

  public listAssets(appId: string): AssetRecord[] {
    const rows: any[] = this.db
      .select()
      .from(manifestAssets)
      .where(eq(manifestAssets.appId, appId))
      .all();
    return rows.map((row) => ({
      appId: row.appId,
      path: row.assetPath,
      content: Buffer.isBuffer(row.content) ? row.content : Buffer.from(row.content as any),
      mimeType: row.mimeType,
      sha256: row.sha256,
      etag: row.etag,
      size: row.size,
      updatedAt: row.updatedAt,
    }));
  }

  private detectMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.html':
      case '.htm':
        return 'text/html; charset=utf-8';
      case '.js':
      case '.mjs':
      case '.cjs':
        return 'application/javascript; charset=utf-8';
      case '.json':
        return 'application/json; charset=utf-8';
      case '.css':
        return 'text/css; charset=utf-8';
      case '.svg':
        return 'image/svg+xml';
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      case '.wasm':
        return 'application/wasm';
      case '.bin':
      case '.goat':
      case '.goatbc':
        return 'application/octet-stream';
      default:
        return 'application/octet-stream';
    }
  }
}
