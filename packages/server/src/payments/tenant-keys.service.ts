import { eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { tenantKeys } from './schema/payments.schema';
import { TenantPublicKeyRecord } from './payments.types';

/**
 * Zone 4 out-of-band tenant public key directory (Task 10206 / §7 L2). Native fetches a
 * tenant's public key from here directly — the mini-app JS is never trusted to supply one.
 */
export class TenantKeysService {
  private readonly db: any;

  constructor(dbService: DatabaseService) {
    this.db = dbService.db;
  }

  public register(record: TenantPublicKeyRecord): void {
    const now = Date.now();
    this.db
      .insert(tenantKeys)
      .values({
        tenantAppId: record.tenantAppId,
        keyBase64: record.keyBase64,
        algorithm: record.algorithm,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: tenantKeys.tenantAppId,
        set: {
          keyBase64: record.keyBase64,
          algorithm: record.algorithm,
          updatedAt: now,
        },
      })
      .run();
  }

  public get(tenantAppId: string): TenantPublicKeyRecord | undefined {
    const row = this.db
      .select()
      .from(tenantKeys)
      .where(eq(tenantKeys.tenantAppId, tenantAppId))
      .get();
    if (!row) return undefined;
    return {
      tenantAppId: row.tenantAppId,
      keyBase64: row.keyBase64,
      algorithm: row.algorithm as TenantPublicKeyRecord['algorithm'],
    };
  }
}
