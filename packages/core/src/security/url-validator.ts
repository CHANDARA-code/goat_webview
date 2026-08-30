/**
 * @goat/core - Zero-Trust URL Validator & Security Policy Engine
 *
 * Enforces strict scheme whitelisting, cloud metadata hostname blocking,
 * alternate IP encoding detection, and spoof-proof domain allowlisting.
 */

import {
  InvalidUrlSchemeError,
  CloudMetadataBlockedError,
  SsrfBlockedError,
  DomainNotAllowedError,
  GoatSecurityError,
  SecurityErrorCode,
} from './errors.js';
import { parseAndEvaluateIp, parseIpv6 } from './ip-parser.js';

export interface UrlValidatorOptions {
  /** Allowed URL schemes. Default: ['https:', 'http:'] (or ['https:'] if requireHttps is true) */
  allowedSchemes?: string[];
  /** Enforces HTTPS-only (rejects cleartext HTTP). Default: false */
  requireHttps?: boolean;
  /** Optional domain allowlist (e.g. ['example.com', '*.myapp.com']). Default: none (all public domains allowed) */
  domainAllowlist?: string[];
  /** Allow embedded credentials in URL (user:pass@host). Default: false */
  allowEmbeddedCredentials?: boolean;
  /** Allow local loopback / private IP (for explicit local development mode). Default: false */
  allowPrivateRanges?: boolean;
}

export interface ValidatedUrlResult {
  url: URL;
  cleanUrlString: string;
  hostname: string;
  port: number;
  scheme: string;
  isLiteralIp: boolean;
  ipVersion?: 4 | 6;
  normalizedIp?: string;
}

const CLOUD_METADATA_HOSTNAMES = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
  'metadata.internal',
  'internal.metadata',
  'fd00:ec2::254',
  '[fd00:ec2::254]',
  '100.100.100.200', // Alibaba Cloud IMDS
]);

const LOCALHOST_NAMES = new Set([
  'localhost',
  'ip6-localhost',
  'ip6-loopback',
  'localhost.localdomain',
  '0.0.0.0',
]);

const FORBIDDEN_SCHEMES = new Set([
  'file:',
  'javascript:',
  'data:',
  'gopher:',
  'dict:',
  'ftp:',
  'ldap:',
  'ldaps:',
  'blob:',
  'about:',
  'vbscript:',
  'view-source:',
  'tftp:',
  'telnet:',
  'ssh:',
  'jar:',
]);

/**
 * Safely decodes percent-encoded components
 */
function safePercentDecode(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

/**
 * Preprocesses URL to handle percent-decoding, unbracketed IPv6 addresses,
 * and zone identifiers in authority component.
 */
function preprocessUrlString(rawUrl: string): string {
  const match = rawUrl.match(/^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^/?#]+)(.*)$/);
  if (match) {
    const proto = match[1];
    let auth = match[2];
    const rest = match[3] || '';

    // First decode percent-encoded tokens in authority (e.g. %31%32%37.0.0.1 -> 127.0.0.1)
    auth = safePercentDecode(auth);

    // Strip IPv6 zone identifier (%eth0) if present in IPv6 address
    if (auth.includes('%') && (auth.includes(':') || auth.startsWith('['))) {
      auth = auth.replace(/%[a-zA-Z0-9_-]+/g, '');
    }

    // If auth does not have brackets, but is or contains IPv6 (2+ colons)
    if (!auth.startsWith('[') && !auth.endsWith(']')) {
      if (parseIpv6(auth)) {
        auth = `[${auth}]`;
      } else {
        const lastColon = auth.lastIndexOf(':');
        if (lastColon > 0) {
          const potentialHost = auth.substring(0, lastColon);
          const potentialPort = auth.substring(lastColon + 1);
          if (/^[0-9]+$/.test(potentialPort) && parseIpv6(potentialHost)) {
            auth = `[${potentialHost}]:${potentialPort}`;
          }
        }
      }
    }
    return `${proto}${auth}${rest}`;
  }
  return rawUrl;
}

/**
 * Checks whether a given hostname matches an allowlist pattern safely,
 * preventing subdomain spoofing and suffix collisions (e.g. example.com.attacker.com).
 */
export function isDomainAllowed(hostname: string, allowlist: string[]): boolean {
  if (!allowlist || allowlist.length === 0) return true;
  const host = hostname.toLowerCase().trim().replace(/\.$/, ''); // Strip trailing FQDN dot

  for (const pattern of allowlist) {
    const cleanPattern = pattern.toLowerCase().trim().replace(/\.$/, '');

    if (cleanPattern.startsWith('*.')) {
      const baseDomain = cleanPattern.slice(2);
      // Matches 'sub.example.com', 'a.b.example.com', or exact 'example.com'
      if (host === baseDomain || host.endsWith('.' + baseDomain)) {
        return true;
      }
    } else if (cleanPattern.startsWith('.')) {
      const baseDomain = cleanPattern.slice(1);
      if (host === baseDomain || host.endsWith('.' + baseDomain)) {
        return true;
      }
    } else {
      // Exact match
      if (host === cleanPattern) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Validates a URL against zero-trust SSRF, scheme, cloud metadata, and domain policies.
 */
export function validateUrl(
  inputUrl: string | URL,
  options: UrlValidatorOptions = {}
): ValidatedUrlResult {
  let parsedUrl: URL;
  let rawString = typeof inputUrl === 'string' ? inputUrl.trim() : inputUrl.toString().trim();

  if (!rawString) {
    throw new GoatSecurityError(SecurityErrorCode.INVALID_URL, 'URL cannot be empty');
  }

  // Preprocess to support percent-decoding, unbracketed IPv6 and zone IDs in URLs gracefully
  rawString = preprocessUrlString(rawString);

  try {
    parsedUrl = new URL(rawString);
  } catch (err: any) {
    throw new GoatSecurityError(SecurityErrorCode.INVALID_URL, `Malformed URL: ${rawString}`);
  }

  const scheme = parsedUrl.protocol.toLowerCase();

  // 1. Check for explicitly forbidden schemes
  if (FORBIDDEN_SCHEMES.has(scheme)) {
    throw new InvalidUrlSchemeError(
      `Forbidden URL scheme "${scheme}". Only standard web protocols are permitted.`
    );
  }

  // 2. Validate scheme against allowed schemes
  const effectiveAllowedSchemes = options.allowedSchemes
    ? options.allowedSchemes.map((s) => (s.endsWith(':') ? s.toLowerCase() : `${s.toLowerCase()}:`))
    : options.requireHttps
    ? ['https:']
    : ['https:', 'http:'];

  if (options.requireHttps && scheme === 'http:') {
    throw new GoatSecurityError(
      SecurityErrorCode.CLEARTEXT_HTTP_BLOCKED,
      'Cleartext HTTP request blocked: HTTPS is strictly required by security policy'
    );
  }

  if (!effectiveAllowedSchemes.includes(scheme)) {
    throw new InvalidUrlSchemeError(
      `URL scheme "${scheme}" is not in the allowed schemes list (${effectiveAllowedSchemes.join(', ')})`
    );
  }

  // 3. Embedded credentials check
  if (!options.allowEmbeddedCredentials && (parsedUrl.username || parsedUrl.password)) {
    throw new GoatSecurityError(
      SecurityErrorCode.INVALID_URL,
      'URL contains embedded user credentials which are forbidden to prevent credential leakage'
    );
  }

  let hostname = parsedUrl.hostname.toLowerCase().trim();
  // Strip trailing dot from FQDN e.g. "example.com."
  if (hostname.endsWith('.')) {
    hostname = hostname.slice(0, -1);
  }

  // Strip brackets for IPv6 hostnames
  const unbracketedHost = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;

  // 4. Cloud Metadata Hostnames Check
  if (
    CLOUD_METADATA_HOSTNAMES.has(hostname) ||
    CLOUD_METADATA_HOSTNAMES.has(unbracketedHost) ||
    hostname.endsWith('.metadata.google.internal') ||
    hostname.endsWith('.instance-data')
  ) {
    throw new CloudMetadataBlockedError(
      `Request to cloud metadata endpoint "${hostname}" is strictly blocked`
    );
  }

  // 5. Localhost names Check
  if (!options.allowPrivateRanges) {
    if (
      LOCALHOST_NAMES.has(hostname) ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local')
    ) {
      throw new SsrfBlockedError(`Request to local hostname "${hostname}" is blocked`);
    }
  }

  // 6. Check if host is a literal IP representation (IPv4 standard, dword, hex, octal, dotless, IPv6)
  const ipResult = parseAndEvaluateIp(hostname);
  let isLiteralIp = false;
  let ipVersion: (4 | 6) | undefined;
  let normalizedIp: string | undefined;

  if (ipResult) {
    isLiteralIp = true;
    ipVersion = ipResult.version;
    normalizedIp = ipResult.normalized;

    if (!options.allowPrivateRanges && ipResult.isPrivateOrReserved) {
      throw new SsrfBlockedError(
        `SSRF Blocked: Destination IP "${hostname}" (${ipResult.normalized}) resolves to forbidden range: ${ipResult.reason}`,
        {
          rawHost: hostname,
          normalizedIp: ipResult.normalized,
          reason: ipResult.reason,
          version: ipResult.version,
        }
      );
    }
  }

  // 7. Domain Allowlist Check
  if (options.domainAllowlist && options.domainAllowlist.length > 0) {
    if (!isDomainAllowed(hostname, options.domainAllowlist)) {
      throw new DomainNotAllowedError(
        `Domain "${hostname}" is not permitted by domain allowlist policy`
      );
    }
  }

  const defaultPort = scheme === 'https:' || scheme === 'wss:' ? 443 : 80;
  const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : defaultPort;

  return {
    url: parsedUrl,
    cleanUrlString: parsedUrl.toString(),
    hostname,
    port,
    scheme,
    isLiteralIp,
    ipVersion,
    normalizedIp,
  };
}
