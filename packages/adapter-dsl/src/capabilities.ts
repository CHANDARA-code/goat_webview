import { DSL_ACTION_MAP } from './actionMap';

/**
 * T3 — capability discovery.
 *
 * `canIUse` is synchronous in every real DSL, but the authoritative answer lives natively, so the
 * host side resolves an action name against the engine's CAN_I_USE and caches it. A miss is
 * reported as CAPABILITY_NOT_INSTALLED rather than a generic false, so a mini-app calling into an
 * unlinked feature module gets a diagnosable reason instead of silence.
 */

export const CAPABILITY_NOT_INSTALLED = 'CAPABILITY_NOT_INSTALLED';

export interface CapabilityQuery {
  (action: string, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
}

/** Maps a DSL method (`scanCode`) to its engine action (`SCAN_CODE`), or passes through. */
export function resolveAction(schema: string): string {
  const key = String(schema ?? '').split('.')[0] ?? '';
  return DSL_ACTION_MAP[key] ?? key;
}

/** True when the adapter itself knows the method, independent of native support. */
export function isMappedLocally(schema: string): boolean {
  const key = String(schema ?? '').split('.')[0] ?? '';
  return Object.prototype.hasOwnProperty.call(DSL_ACTION_MAP, key);
}

export class CapabilityRegistry {
  private readonly cache = new Map<string, boolean>();

  constructor(private readonly query: CapabilityQuery) {}

  /** Cached, so repeated canIUse calls in a render loop do not each cross the bridge. */
  async canIUse(schema: string): Promise<boolean> {
    const action = resolveAction(schema);
    const cached = this.cache.get(action);
    if (cached !== undefined) return cached;

    try {
      const res = await this.query('CAN_I_USE', { action });
      const ok = Boolean(res?.['supported'] ?? res?.['available']);
      this.cache.set(action, ok);
      return ok;
    } catch {
      // A bridge failure is not evidence the capability is missing, so it is not cached.
      return false;
    }
  }

  /**
   * @returns the reason a call would fail, or null when it would be accepted.
   */
  async explain(schema: string): Promise<string | null> {
    if (await this.canIUse(schema)) return null;
    return CAPABILITY_NOT_INSTALLED;
  }

  invalidate(): void {
    this.cache.clear();
  }
}
