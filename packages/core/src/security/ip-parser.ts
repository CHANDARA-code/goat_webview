/**
 * @goat/core - Robust IP Parser, Normalizer & Zero-Trust Subnet Filter
 *
 * Implements RFC-compliant and socket-compatible IP parsing for IPv4 (standard dotted,
 * dword integer, hex, octal, dotless, mixed, URL-encoded) and IPv6 (standard, compressed,
 * ULA, link-local, IPv4-mapped, IPv4-translated).
 */

export interface ParsedIpAddress {
  raw: string;
  normalized: string;
  version: 4 | 6;
  isPrivateOrReserved: boolean;
  reason?: string;
  octets?: [number, number, number, number];
  words?: number[]; // 8 16-bit words for IPv6
  intVal?: number; // 32-bit unsigned for IPv4
}

/**
 * Safely decodes percent-encoded components in host string
 */
function safePercentDecode(host: string): string {
  try {
    return decodeURIComponent(host);
  } catch {
    return host;
  }
}

/**
 * Parses a single numeric token in decimal, hexadecimal (0x...), or octal (0...) notation.
 */
function parseNumericToken(token: string): { val: number; valid: boolean } {
  if (!token || typeof token !== 'string') return { val: 0, valid: false };
  const trimmed = token.trim();

  // Hexadecimal: 0x... or 0X...
  if (/^0x[0-9a-f]+$/i.test(trimmed)) {
    const val = parseInt(trimmed, 16);
    return { val, valid: !isNaN(val) && val >= 0 };
  }

  // Octal: 0 followed by 0-7 digits only (e.g. 0177, 0251, 0012)
  // Single '0' is decimal 0.
  if (/^0[0-7]+$/.test(trimmed)) {
    const val = parseInt(trimmed, 8);
    return { val, valid: !isNaN(val) && val >= 0 };
  }

  // Decimal: purely 0-9 digits
  if (/^[0-9]+$/.test(trimmed)) {
    const val = parseInt(trimmed, 10);
    return { val, valid: !isNaN(val) && val >= 0 };
  }

  return { val: 0, valid: false };
}

/**
 * Attempts to parse a host string as an IPv4 address according to BSD socket / inet_aton rules.
 * Supports:
 * - 4 parts (a.b.c.d, each 0..255)
 * - 3 parts (a.b.c, a,b 0..255, c 0..65535)
 * - 2 parts (a.b, a 0..255, b 0..16777215)
 * - 1 part (dword integer / hex / octal, 0..4294967295)
 */
export function parseIpv4(rawHost: string): ParsedIpAddress | null {
  const host = safePercentDecode(rawHost).trim().toLowerCase();

  // Must not contain IPv6 characters, whitespace, colons, or slashes
  if (host.includes(':') || host.includes('/') || /\s/.test(host)) {
    return null;
  }

  const parts = host.split('.');
  if (parts.length < 1 || parts.length > 4) {
    return null;
  }

  // Parse each part
  const parsedParts: number[] = [];
  for (const part of parts) {
    if (!part) return null;
    const { val, valid } = parseNumericToken(part);
    if (!valid) return null;
    parsedParts.push(val);
  }

  let num32 = 0;
  if (parsedParts.length === 1) {
    // Single integer / DWORD (e.g., 2130706433, 0x7f000001)
    if (parsedParts[0] < 0 || parsedParts[0] > 0xffffffff) return null;
    num32 = parsedParts[0];
  } else if (parsedParts.length === 2) {
    // 2 parts: a.b (a < 256, b < 16777216, e.g., 127.1 -> 127.0.0.1)
    if (parsedParts[0] > 255 || parsedParts[1] > 0xffffff) return null;
    num32 = ((parsedParts[0] << 24) >>> 0) + parsedParts[1];
  } else if (parsedParts.length === 3) {
    // 3 parts: a.b.c (a, b < 256, c < 65536, e.g., 127.0.1 -> 127.0.0.1)
    if (parsedParts[0] > 255 || parsedParts[1] > 255 || parsedParts[2] > 0xffff) return null;
    num32 = ((parsedParts[0] << 24) >>> 0) + ((parsedParts[1] << 16) >>> 0) + parsedParts[2];
  } else if (parsedParts.length === 4) {
    // 4 parts: a.b.c.d (each < 256)
    if (parsedParts.some((p) => p > 255)) return null;
    num32 =
      ((parsedParts[0] << 24) >>> 0) +
      ((parsedParts[1] << 16) >>> 0) +
      ((parsedParts[2] << 8) >>> 0) +
      parsedParts[3];
  }

  const o1 = (num32 >>> 24) & 0xff;
  const o2 = (num32 >>> 16) & 0xff;
  const o3 = (num32 >>> 8) & 0xff;
  const o4 = num32 & 0xff;
  const normalized = `${o1}.${o2}.${o3}.${o4}`;

  const { isForbidden, reason } = evaluateIpv4Subnet(o1, o2, o3, o4);

  return {
    raw: rawHost,
    normalized,
    version: 4,
    isPrivateOrReserved: isForbidden,
    reason,
    octets: [o1, o2, o3, o4],
    intVal: num32,
  };
}

/**
 * Checks an IPv4 octet quadruple against all RFC private, loopback, link-local,
 * cloud metadata, multicast, and reserved subnets.
 */
export function evaluateIpv4Subnet(
  a: number,
  b: number,
  c: number,
  d: number
): { isForbidden: boolean; reason?: string } {
  // 0.0.0.0/8 - Current network / Unspecified
  if (a === 0) {
    return { isForbidden: true, reason: 'RFC 1122 ' + `${a}.${b}.${c}.${d}` + ' (Current network / Unspecified 0.0.0.0/8)' };
  }

  // 127.0.0.0/8 - Loopback
  if (a === 127) {
    return { isForbidden: true, reason: 'RFC 1122 ' + `${a}.${b}.${c}.${d}` + ' (Loopback 127.0.0.0/8)' };
  }

  // 10.0.0.0/8 - RFC 1918 Private Class A
  if (a === 10) {
    return { isForbidden: true, reason: 'RFC 1918 ' + `${a}.${b}.${c}.${d}` + ' (Private Class A 10.0.0.0/8)' };
  }

  // 172.16.0.0/12 - RFC 1918 Private Class B (172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) {
    return { isForbidden: true, reason: 'RFC 1918 ' + `${a}.${b}.${c}.${d}` + ' (Private Class B 172.16.0.0/12)' };
  }

  // 192.168.0.0/16 - RFC 1918 Private Class C
  if (a === 192 && b === 168) {
    return { isForbidden: true, reason: 'RFC 1918 ' + `${a}.${b}.${c}.${d}` + ' (Private Class C 192.168.0.0/16)' };
  }

  // 169.254.0.0/16 - RFC 3927 Link-Local & Cloud Metadata IMDS
  if (a === 169 && b === 254) {
    if (c === 169 && d === 254) {
      return { isForbidden: true, reason: 'Cloud IMDS Metadata Endpoint (169.254.169.254)' };
    }
    return { isForbidden: true, reason: 'RFC 3927 ' + `${a}.${b}.${c}.${d}` + ' (Link-Local 169.254.0.0/16)' };
  }

  // 100.64.0.0/10 - RFC 6598 Carrier-Grade NAT (100.64.0.0 - 100.127.255.255)
  if (a === 100 && b >= 64 && b <= 127) {
    return { isForbidden: true, reason: 'RFC 6598 ' + `${a}.${b}.${c}.${d}` + ' (Carrier-Grade NAT 100.64.0.0/10)' };
  }

  // 192.0.0.0/24 - RFC 6890 IETF Protocol Assignments
  if (a === 192 && b === 0 && c === 0) {
    return { isForbidden: true, reason: 'RFC 6890 ' + `${a}.${b}.${c}.${d}` + ' (IETF Protocol Assignments 192.0.0.0/24)' };
  }

  // 192.0.2.0/24 - RFC 5737 TEST-NET-1
  if (a === 192 && b === 0 && c === 2) {
    return { isForbidden: true, reason: 'RFC 5737 ' + `${a}.${b}.${c}.${d}` + ' (Documentation TEST-NET-1 192.0.2.0/24)' };
  }

  // 198.18.0.0/15 - RFC 2544 Benchmarking (198.18.0.0 - 198.19.255.255)
  if (a === 198 && (b === 18 || b === 19)) {
    return { isForbidden: true, reason: 'RFC 2544 ' + `${a}.${b}.${c}.${d}` + ' (Benchmarking 198.18.0.0/15)' };
  }

  // 198.51.100.0/24 - RFC 5737 TEST-NET-2
  if (a === 198 && b === 51 && c === 100) {
    return { isForbidden: true, reason: 'RFC 5737 ' + `${a}.${b}.${c}.${d}` + ' (Documentation TEST-NET-2 198.51.100.0/24)' };
  }

  // 203.0.113.0/24 - RFC 5737 TEST-NET-3
  if (a === 203 && b === 0 && c === 113) {
    return { isForbidden: true, reason: 'RFC 5737 ' + `${a}.${b}.${c}.${d}` + ' (Documentation TEST-NET-3 203.0.113.0/24)' };
  }

  // 224.0.0.0/4 - RFC 5771 Multicast (224.0.0.0 - 239.255.255.255)
  if (a >= 224 && a <= 239) {
    return { isForbidden: true, reason: 'RFC 5771 ' + `${a}.${b}.${c}.${d}` + ' (Multicast 224.0.0.0/4)' };
  }

  // 240.0.0.0/4 - RFC 1112 Reserved / Future use & 255.255.255.255 Broadcast
  if (a >= 240) {
    return { isForbidden: true, reason: 'RFC 1112 ' + `${a}.${b}.${c}.${d}` + ' (Reserved / Broadcast 240.0.0.0/4)' };
  }

  return { isForbidden: false };
}

/**
 * Attempts to parse an IPv6 address string into 8 16-bit integer words.
 * Supports:
 * - standard full notation (8 hex words: 2001:0db8:...)
 * - compressed notation (::)
 * - IPv4-mapped / embedded notation (::ffff:127.0.0.1, 0:0:0:0:0:ffff:10.0.0.1)
 * - IPv4-translated notation (64:ff9b::127.0.0.1)
 * - bracketed form ([::1])
 * - zone ID (%eth0)
 */
export function parseIpv6(rawHost: string): ParsedIpAddress | null {
  let host = safePercentDecode(rawHost).trim().toLowerCase();

  // Strip brackets if present
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1).trim();
  }

  // Strip zone ID (e.g., %eth0 or %1)
  if (host.includes('%')) {
    host = host.split('%')[0];
  }

  // Must contain colons to be IPv6
  if (!host.includes(':')) {
    return null;
  }

  // Check if it ends with an embedded IPv4 address (e.g. ::ffff:127.0.0.1 or 64:ff9b::192.168.1.1)
  const lastColonIndex = host.lastIndexOf(':');
  const tail = host.substring(lastColonIndex + 1);
  let embeddedIpv4: ParsedIpAddress | null = null;

  if (tail.includes('.')) {
    embeddedIpv4 = parseIpv4(tail);
    if (!embeddedIpv4 || !embeddedIpv4.octets) {
      return null;
    }
    // Replace the IPv4 tail with two 16-bit hex words: (o1 << 8 | o2).toString(16):(o3 << 8 | o4).toString(16)
    const [o1, o2, o3, o4] = embeddedIpv4.octets;
    const w1 = ((o1 << 8) | o2).toString(16);
    const w2 = ((o3 << 8) | o4).toString(16);
    host = host.substring(0, lastColonIndex + 1) + `${w1}:${w2}`;
  }

  // Split on '::'
  const doubleColonParts = host.split('::');
  if (doubleColonParts.length > 2) {
    return null; // Only one '::' permitted
  }

  let words: number[] = [];

  if (doubleColonParts.length === 2) {
    const leftStr = doubleColonParts[0];
    const rightStr = doubleColonParts[1];

    const leftWords = leftStr ? leftStr.split(':') : [];
    const rightWords = rightStr ? rightStr.split(':') : [];

    const totalProvided = leftWords.length + rightWords.length;
    if (totalProvided > 7) {
      return null;
    }

    const zerosCount = 8 - totalProvided;
    const middleWords: string[] = new Array(zerosCount).fill('0');

    const allWordStrings = [...leftWords, ...middleWords, ...rightWords];
    if (allWordStrings.length !== 8) return null;

    for (const w of allWordStrings) {
      if (!/^[0-9a-f]{1,4}$/i.test(w)) return null;
      words.push(parseInt(w, 16));
    }
  } else {
    // Exactly 8 parts
    const wordStrings = host.split(':');
    if (wordStrings.length !== 8) return null;

    for (const w of wordStrings) {
      if (!/^[0-9a-f]{1,4}$/i.test(w)) return null;
      words.push(parseInt(w, 16));
    }
  }

  // Build canonical IPv6 representation
  const canonical = words.map((w) => w.toString(16)).join(':');

  const { isForbidden, reason } = evaluateIpv6Subnet(words, embeddedIpv4);

  return {
    raw: rawHost,
    normalized: canonical,
    version: 6,
    isPrivateOrReserved: isForbidden,
    reason,
    words,
  };
}

/**
 * Checks an 8-word IPv6 address against all forbidden ranges:
 * - ::/128 (Unspecified)
 * - ::1/128 (Loopback)
 * - ::ffff:0:0/96 (IPv4-Mapped IPv6)
 * - 64:ff9b::/96 (IPv4-IPv6 Translation)
 * - 100::/64 (Discard-Only Prefix)
 * - 2001:db8::/32 (Documentation)
 * - fc00::/7 (Unique Local Address ULA)
 * - fe80::/10 (Link-Local Unicast)
 * - ff00::/8 (Multicast)
 * - fd00:ec2::254/128 (AWS Nitro IMDSv2 IPv6)
 */
export function evaluateIpv6Subnet(
  words: number[],
  embeddedIpv4: ParsedIpAddress | null
): { isForbidden: boolean; reason?: string } {
  // Check ::/128 (All zeros - Unspecified)
  if (words.every((w) => w === 0)) {
    return { isForbidden: true, reason: 'IPv6 Unspecified Address (::/128)' };
  }

  // Check ::1/128 (Loopback)
  if (
    words[0] === 0 &&
    words[1] === 0 &&
    words[2] === 0 &&
    words[3] === 0 &&
    words[4] === 0 &&
    words[5] === 0 &&
    words[6] === 0 &&
    words[7] === 1
  ) {
    return { isForbidden: true, reason: 'IPv6 Loopback Address (::1/128)' };
  }

  // Check ::ffff:0:0/96 (IPv4-Mapped IPv6)
  if (
    words[0] === 0 &&
    words[1] === 0 &&
    words[2] === 0 &&
    words[3] === 0 &&
    words[4] === 0 &&
    words[5] === 0xffff
  ) {
    const o1 = (words[6] >> 8) & 0xff;
    const o2 = words[6] & 0xff;
    const o3 = (words[7] >> 8) & 0xff;
    const o4 = words[7] & 0xff;
    const ipv4Check = evaluateIpv4Subnet(o1, o2, o3, o4);
    if (ipv4Check.isForbidden) {
      return {
        isForbidden: true,
        reason: `IPv4-Mapped IPv6 address targeting forbidden IPv4 ${o1}.${o2}.${o3}.${o4}: ${ipv4Check.reason}`,
      };
    }
    // Also block if embedded IPv4 check failed
    if (embeddedIpv4?.isPrivateOrReserved) {
      return {
        isForbidden: true,
        reason: `IPv4-Mapped IPv6 address targeting private IPv4: ${embeddedIpv4.reason}`,
      };
    }
  }

  // Check 64:ff9b::/96 (IPv4/IPv6 Translation)
  if (
    words[0] === 0x0064 &&
    words[1] === 0xff9b &&
    words[2] === 0 &&
    words[3] === 0 &&
    words[4] === 0 &&
    words[5] === 0
  ) {
    const o1 = (words[6] >> 8) & 0xff;
    const o2 = words[6] & 0xff;
    const o3 = (words[7] >> 8) & 0xff;
    const o4 = words[7] & 0xff;
    const ipv4Check = evaluateIpv4Subnet(o1, o2, o3, o4);
    if (ipv4Check.isForbidden) {
      return {
        isForbidden: true,
        reason: `IPv4/IPv6 Translation address targeting forbidden IPv4: ${ipv4Check.reason}`,
      };
    }
  }

  // Check fc00::/7 (Unique Local Address ULA: 0xfc00 to 0xfdff in first word)
  // First 7 bits are 1111110 -> 0xfc00 to 0xfdff
  const w0 = words[0];
  if ((w0 & 0xfe00) === 0xfc00) {
    // Specifically check AWS Nitro IMDSv2 IPv6: fd00:ec2::254
    if (
      words[0] === 0xfd00 &&
      words[1] === 0x0ec2 &&
      words[2] === 0 &&
      words[3] === 0 &&
      words[4] === 0 &&
      words[5] === 0 &&
      words[6] === 0 &&
      words[7] === 0x0254
    ) {
      return { isForbidden: true, reason: 'AWS Nitro IMDSv2 IPv6 Metadata Endpoint (fd00:ec2::254)' };
    }
    return { isForbidden: true, reason: 'RFC 4193 IPv6 Unique Local Address ULA (fc00::/7)' };
  }

  // Check fe80::/10 (Link-Local Unicast: 0xfe80 to 0xfebf in first word)
  // First 10 bits are 1111111010 -> 0xfe80 to 0xfebf
  if ((w0 & 0xffc0) === 0xfe80) {
    return { isForbidden: true, reason: 'RFC 4291 IPv6 Link-Local Unicast (fe80::/10)' };
  }

  // Check ff00::/8 (Multicast: 0xff00 to 0xffff in first word)
  if ((w0 & 0xff00) === 0xff00) {
    return { isForbidden: true, reason: 'RFC 4291 IPv6 Multicast (ff00::/8)' };
  }

  // Check 100::/64 (Discard-Only Prefix)
  if (words[0] === 0x0100 && words[1] === 0 && words[2] === 0 && words[3] === 0) {
    return { isForbidden: true, reason: 'RFC 6666 IPv6 Discard-Only Prefix (100::/64)' };
  }

  // Check 2001:db8::/32 (Documentation Prefix)
  if (words[0] === 0x2001 && words[1] === 0x0db8) {
    return { isForbidden: true, reason: 'RFC 3849 IPv6 Documentation Prefix (2001:db8::/32)' };
  }

  return { isForbidden: false };
}

/**
 * Universal IP Parser & Normalizer: Parses any raw host string (IPv4 or IPv6,
 * any encoding) and evaluates whether it represents an IP and whether it is in a
 * forbidden/private/reserved subnet.
 */
export function parseAndEvaluateIp(rawHost: string): ParsedIpAddress | null {
  if (!rawHost || typeof rawHost !== 'string') return null;

  // First try IPv6 (handles brackets, colons)
  const ipv6Result = parseIpv6(rawHost);
  if (ipv6Result) return ipv6Result;

  // Next try IPv4 (handles standard, dword, hex, octal, dotless, mixed)
  const ipv4Result = parseIpv4(rawHost);
  if (ipv4Result) return ipv4Result;

  return null;
}

/**
 * Convenience helper: Returns true if the host string is an IP address
 * that resolves to a private or blocked subnet.
 */
export function isForbiddenIp(rawHost: string): boolean {
  const result = parseAndEvaluateIp(rawHost);
  return result ? result.isPrivateOrReserved : false;
}
