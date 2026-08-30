/**
 * @goat/core - Zero-Trust DNS Resolver & Validation Engine
 *
 * Resolves all A/AAAA records for hostnames, evaluates every record against
 * forbidden IP subnets, and provides deterministic mocking for DNS rebinding tests.
 */

import * as dns from 'node:dns/promises';
import { SsrfBlockedError, GoatSecurityError, SecurityErrorCode } from './errors.js';
import { parseAndEvaluateIp, isForbiddenIp } from './ip-parser.js';

export interface DnsResolver {
  resolve(hostname: string): Promise<string[]>;
}

/**
 * System DNS resolver using Node's standard dns.promises.lookup with all: true.
 */
export class SystemDnsResolver implements DnsResolver {
  public async resolve(hostname: string): Promise<string[]> {
    try {
      const records = await dns.lookup(hostname, { all: true });
      if (!records || records.length === 0) {
        throw new Error(`No DNS records found for host "${hostname}"`);
      }
      return records.map((r: { address: string }) => r.address);
    } catch (err: any) {
      throw new GoatSecurityError(
        SecurityErrorCode.INVALID_URL,
        `DNS resolution failed for host "${hostname}": ${err.message}`
      );
    }
  }
}

/**
 * Deterministic Mock DNS resolver for security testing and DNS Rebinding simulation.
 */
export class MockDnsResolver implements DnsResolver {
  private staticMappings: Map<string, string[]> = new Map();
  private dynamicSequences: Map<string, string[][]> = new Map();
  private callCounts: Map<string, number> = new Map();

  /**
   * Register static DNS mapping for a hostname
   */
  public register(hostname: string, ips: string[]): this {
    this.staticMappings.set(hostname.toLowerCase().trim(), [...ips]);
    return this;
  }

  /**
   * Register a dynamic DNS Rebinding sequence for a hostname
   * (e.g. returns clean public IP on first check, then private loopback/IMDS IP on second check)
   */
  public registerRebinding(hostname: string, query1Ips: string[], query2Ips: string[]): this {
    return this.registerSequence(hostname, [query1Ips, query2Ips]);
  }

  /**
   * Register an arbitrary sequence of DNS responses for repeated queries
   */
  public registerSequence(hostname: string, sequence: string[][]): this {
    this.dynamicSequences.set(hostname.toLowerCase().trim(), [...sequence]);
    return this;
  }

  /**
   * Get total lookup count for a hostname
   */
  public getLookupCount(hostname: string): number {
    return this.callCounts.get(hostname.toLowerCase().trim()) || 0;
  }

  /**
   * Reset all registered mappings and counts
   */
  public clear(): void {
    this.staticMappings.clear();
    this.dynamicSequences.clear();
    this.callCounts.clear();
  }

  public async resolve(hostname: string): Promise<string[]> {
    const host = hostname.toLowerCase().trim();
    const count = this.callCounts.get(host) || 0;
    this.callCounts.set(host, count + 1);

    // Check dynamic sequence first
    if (this.dynamicSequences.has(host)) {
      const seq = this.dynamicSequences.get(host)!;
      const index = Math.min(count, seq.length - 1);
      return [...seq[index]];
    }

    // Check static mapping
    if (this.staticMappings.has(host)) {
      return [...this.staticMappings.get(host)!];
    }

    // Fallback: If host is already an IP address, return it
    const ipCheck = parseAndEvaluateIp(host);
    if (ipCheck) {
      return [ipCheck.normalized];
    }

    throw new GoatSecurityError(
      SecurityErrorCode.INVALID_URL,
      `Mock DNS resolution failed: No records configured for host "${hostname}"`
    );
  }
}

export interface DnsValidationResult {
  hostname: string;
  resolvedIps: string[];
  cleanIps: string[];
  pinnedIp: string;
}

/**
 * Resolves a hostname and validates all returned A/AAAA records against forbidden subnets.
 * Fails closed if ANY resolved IP address is in a private, loopback, or cloud metadata range.
 */
export async function validateHostnameDns(
  hostname: string,
  resolver: DnsResolver = new SystemDnsResolver(),
  options: { allowPrivateRanges?: boolean } = {}
): Promise<DnsValidationResult> {
  const host = hostname.toLowerCase().trim();

  // If host is already a literal IP, validate directly
  const directIp = parseAndEvaluateIp(host);
  if (directIp) {
    if (!options.allowPrivateRanges && directIp.isPrivateOrReserved) {
      throw new SsrfBlockedError(
        `SSRF Blocked: Destination IP "${hostname}" (${directIp.normalized}) is in forbidden range: ${directIp.reason}`,
        {
          hostname,
          resolvedIp: directIp.normalized,
          reason: directIp.reason,
        }
      );
    }
    return {
      hostname: host,
      resolvedIps: [directIp.normalized],
      cleanIps: [directIp.normalized],
      pinnedIp: directIp.normalized,
    };
  }

  // Resolve DNS records
  const resolvedIps = await resolver.resolve(host);
  if (!resolvedIps || resolvedIps.length === 0) {
    throw new GoatSecurityError(
      SecurityErrorCode.INVALID_URL,
      `DNS lookup returned zero addresses for host "${host}"`
    );
  }

  const cleanIps: string[] = [];

  // Inspect EVERY resolved IP address
  for (const ip of resolvedIps) {
    const ipResult = parseAndEvaluateIp(ip);
    if (!ipResult) {
      throw new SsrfBlockedError(
        `DNS resolution returned invalid IP format "${ip}" for host "${host}"`
      );
    }

    if (!options.allowPrivateRanges && ipResult.isPrivateOrReserved) {
      throw new SsrfBlockedError(
        `SSRF Blocked: Host "${host}" resolved to forbidden IP address "${ip}" (${ipResult.normalized}): ${ipResult.reason}`,
        {
          hostname: host,
          resolvedIp: ipResult.normalized,
          allResolvedIps: resolvedIps,
          reason: ipResult.reason,
        }
      );
    }

    cleanIps.push(ipResult.normalized);
  }

  return {
    hostname: host,
    resolvedIps,
    cleanIps,
    pinnedIp: cleanIps[0],
  };
}
