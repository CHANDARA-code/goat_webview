/**
 * @goat/core - DNS Rebinding & Socket Pinning Defense Engine
 *
 * Mitigates Time-of-Check to Time-of-Use (TOCTOU) DNS race conditions
 * by binding validated host resolutions to pinned IP addresses and detecting
 * dynamic DNS rebinding transitions.
 */

import { DnsRebindingError, SsrfBlockedError } from './errors.js';
import { DnsResolver, validateHostnameDns } from './dns-resolver.js';
import { parseAndEvaluateIp } from './ip-parser.js';

export interface PinnedHostConnection {
  hostname: string;
  pinnedIp: string;
  port: number;
  allVerifiedIps: string[];
  resolvedAt: number;
  ttlMs: number;
}

export class DnsPinningManager {
  private pinnedCache: Map<string, PinnedHostConnection> = new Map();
  private defaultTtlMs: number;

  constructor(defaultTtlMs: number = 30000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Resolve and pin a hostname to a verified clean IP.
   */
  public async resolveAndPin(
    hostname: string,
    port: number,
    resolver: DnsResolver,
    options: { allowPrivateRanges?: boolean; ttlMs?: number } = {}
  ): Promise<PinnedHostConnection> {
    const key = `${hostname.toLowerCase().trim()}:${port}`;
    const ttl = options.ttlMs || this.defaultTtlMs;

    // Check if we already have a fresh pinned connection
    const cached = this.pinnedCache.get(key);
    if (cached && Date.now() - cached.resolvedAt < cached.ttlMs) {
      return cached;
    }

    const validation = await validateHostnameDns(hostname, resolver, {
      allowPrivateRanges: options.allowPrivateRanges,
    });

    const pinned: PinnedHostConnection = {
      hostname: hostname.toLowerCase().trim(),
      pinnedIp: validation.pinnedIp,
      port,
      allVerifiedIps: validation.cleanIps,
      resolvedAt: Date.now(),
      ttlMs: ttl,
    };

    this.pinnedCache.set(key, pinned);
    return pinned;
  }

  /**
   * Detects TOCTOU DNS Rebinding by comparing a pre-flight check with a connection-time lookup.
   * If the domain changes from public to a private IP or fails validation, throws DnsRebindingError.
   */
  public async verifyAgainstRebinding(
    hostname: string,
    pinnedIp: string,
    resolver: DnsResolver,
    options: { allowPrivateRanges?: boolean } = {}
  ): Promise<boolean> {
    const currentIps = await resolver.resolve(hostname);

    for (const ip of currentIps) {
      const ipResult = parseAndEvaluateIp(ip);
      if (!ipResult) {
        throw new DnsRebindingError(
          `DNS Rebinding detected for "${hostname}": Resolved to invalid address "${ip}"`
        );
      }

      // If the IP changed to a private/reserved address at connect time -> REBINDING ATTACK!
      if (!options.allowPrivateRanges && ipResult.isPrivateOrReserved) {
        throw new DnsRebindingError(
          `DNS Rebinding attack detected for host "${hostname}"! Domain re-resolved to forbidden private address "${ip}" (${ipResult.reason})`,
          {
            hostname,
            previousPinnedIp: pinnedIp,
            newReboundIp: ip,
            reason: ipResult.reason,
          }
        );
      }
    }

    return true;
  }

  /**
   * Clear pinned connections cache
   */
  public clear(): void {
    this.pinnedCache.clear();
  }
}
