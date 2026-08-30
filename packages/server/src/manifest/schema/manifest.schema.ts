import { sqliteTable, text, integer, blob, index, primaryKey } from 'drizzle-orm/sqlite-core';

export const manifestEntries = sqliteTable('manifest_entries', {
  appId: text('app_id').primaryKey(),
  manifestJson: text('manifest_json').notNull(),
  sha256: text('sha256').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const manifestAssets = sqliteTable(
  'manifest_assets',
  {
    appId: text('app_id').notNull(),
    assetPath: text('asset_path').notNull(),
    content: blob('content').notNull(),
    mimeType: text('mime_type').notNull(),
    sha256: text('sha256').notNull(),
    etag: text('etag').notNull(),
    size: integer('size').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.appId, table.assetPath] }),
    appIdx: index('idx_manifest_assets_app').on(table.appId),
  })
);
