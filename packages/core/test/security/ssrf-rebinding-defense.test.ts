/**
 * @goat/core - Enterprise Zero-Trust SSRF & DNS Rebinding Defense Test Suite
 *
 * Comprehensive validation covering:
 * - RFC 1918 IPv4 Private Subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
 * - IPv4 Loopback (127.0.0.0/8, 0.0.0.0/8) & Link-Local/Cloud Metadata (169.254.0.0/16)
 * - IPv6 ULA (fc00::/7), Link-Local (fe80::/10), Loopback (::1), IPv4-Mapped IPv6 (::ffff:0:0/96)
 * - Alternate IP Encodings (Dword, Hex, Octal, Dotless, Mixed, URL-encoded, Overflows)
 * - DNS Rebinding & TOCTOU Socket Pinning Mitigations (TTL-0 simulation, multi-homed records, sequence transitions)
 * - 3xx Redirect Chain 5-Layer Re-validation (301/302/303/307/308, scheme drops, credential stripping, multi-hop)
 * - URL Scheme Whitelisting, WebSocket Validation & Domain Suffix Collision Defense
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  parseIpv4,
  parseIpv6,
  parseAndEvaluateIp,
  isForbiddenIp,
  validateUrl,
  isDomainAllowed,
  validateHostnameDns,
  MockDnsResolver,
  DnsPinningManager,
  safeFetch,
  SsrfBlockedError,
  DnsRebindingError,
  InvalidUrlSchemeError,
  RedirectBlockedError,
  DomainNotAllowedError,
  CloudMetadataBlockedError,
  GoatSecurityError,
  SecurityErrorCode,
} from '../../src/index.js';

describe('Zero-Trust SSRF & DNS Rebinding Defense Suite', () => {
  let mockDns: MockDnsResolver;

  beforeEach(() => {
    mockDns = new MockDnsResolver();
    mockDns.register('example.com', ['93.184.216.34']);
    mockDns.register('safe-api.org', ['104.21.45.67']);
    mockDns.register('sub.safe-api.org', ['104.21.45.68']);
    mockDns.register('cdn.allowed.net', ['151.101.1.67']);
  });

  // =========================================================================
  // 1. IPv4 Private & Reserved Subnets (RFC 1918, Loopback, Link-Local, IMDS)
  // =========================================================================
  describe('1. IPv4 Private & Reserved Subnet Enforcement', () => {
    it('blocks RFC 1918 Class A (10.0.0.0/8) private addresses and verifies boundary', () => {
      const vectors = [
        '10.0.0.1',
        '10.255.255.255',
        '10.10.10.10',
        '10.0.1.254',
        '10.128.0.1',
        '10.0.0.0',
      ];
      for (const ip of vectors) {
        expect(isForbiddenIp(ip)).toBe(true);
        expect(() => validateUrl(`https://${ip}/admin`)).toThrow(SsrfBlockedError);
      }

      // Boundary tests: 9.255.255.255 is public, 11.0.0.0 is public
      expect(isForbiddenIp('9.255.255.255')).toBe(false);
      expect(isForbiddenIp('11.0.0.0')).toBe(false);
      expect(validateUrl('https://11.0.0.1/api').hostname).toBe('11.0.0.1');
    });

    it('blocks RFC 1918 Class B (172.16.0.0/12) private addresses and verifies boundary', () => {
      const privateVectors = [
        '172.16.0.1',
        '172.16.255.255',
        '172.20.10.5',
        '172.31.255.254',
        '172.31.255.255',
        '172.16.0.0',
      ];
      for (const ip of privateVectors) {
        expect(isForbiddenIp(ip)).toBe(true);
        expect(() => validateUrl(`https://${ip}/api`)).toThrow(SsrfBlockedError);
      }

      // Boundary checks: 172.15.255.255 is public, 172.32.0.1 is public
      expect(isForbiddenIp('172.15.255.255')).toBe(false);
      expect(isForbiddenIp('172.32.0.1')).toBe(false);
      expect(validateUrl('https://172.32.0.1/public').hostname).toBe('172.32.0.1');
    });

    it('blocks RFC 1918 Class C (192.168.0.0/16) private addresses and verifies boundary', () => {
      const vectors = [
        '192.168.0.1',
        '192.168.1.1',
        '192.168.254.254',
        '192.168.100.50',
        '192.168.255.255',
        '192.168.0.0',
      ];
      for (const ip of vectors) {
        expect(isForbiddenIp(ip)).toBe(true);
        expect(() => validateUrl(`https://${ip}/router`)).toThrow(SsrfBlockedError);
      }

      // Boundary checks: 192.167.255.255 is public, 192.169.0.1 is public
      expect(isForbiddenIp('192.167.255.255')).toBe(false);
      expect(isForbiddenIp('192.169.0.1')).toBe(false);
    });

    it('blocks Loopback addresses (127.0.0.0/8)', () => {
      const vectors = [
        '127.0.0.1',
        '127.0.0.2',
        '127.1.2.3',
        '127.255.255.254',
        '127.255.255.255',
        '127.0.1.1',
      ];
      for (const ip of vectors) {
        expect(isForbiddenIp(ip)).toBe(true);
        expect(() => validateUrl(`https://${ip}:8080/debug`)).toThrow(SsrfBlockedError);
      }
    });

    it('blocks 0.0.0.0/8 Unspecified / Current Network', () => {
      const vectors = ['0.0.0.0', '0.0.0.1', '0.255.255.255'];
      for (const ip of vectors) {
        expect(isForbiddenIp(ip)).toBe(true);
        expect(() => validateUrl(`https://${ip}/`)).toThrow(SsrfBlockedError);
      }
    });

    it('blocks Link-Local & AWS/GCP/Azure IMDS Cloud Metadata (169.254.0.0/16)', () => {
      const vectors = [
        '169.254.169.254', // IMDS
        '169.254.1.1',
        '169.254.254.254',
        '169.254.0.1',
        '169.254.255.255',
        '169.254.0.0',
      ];
      for (const ip of vectors) {
        expect(isForbiddenIp(ip)).toBe(true);
        expect(() => validateUrl(`https://${ip}/latest/meta-data/`)).toThrow(SsrfBlockedError);
      }

      // Boundary checks: 169.253.255.255 is public, 169.255.0.1 is public
      expect(isForbiddenIp('169.253.255.255')).toBe(false);
      expect(isForbiddenIp('169.255.0.1')).toBe(false);
    });

    it('blocks CGNAT (100.64.0.0/10), Multicast (224.0.0.0/4), and Reserved (240.0.0.0/4)', () => {
      const forbidden = [
        '100.64.0.1',
        '100.127.255.255',
        '224.0.0.1',
        '239.255.255.255',
        '240.0.0.1',
        '255.255.255.255',
        '192.0.2.1', // TEST-NET-1
        '198.51.100.1', // TEST-NET-2
        '203.0.113.1', // TEST-NET-3
      ];
      for (const ip of forbidden) {
        expect(isForbiddenIp(ip)).toBe(true);
        expect(() => validateUrl(`https://${ip}/`)).toThrow(SsrfBlockedError);
      }
    });

    it('permits valid public IPv4 addresses', () => {
      const publicIps = [
        '93.184.216.34', // example.com
        '8.8.8.8',
        '1.1.1.1',
        '142.250.190.46',
        '151.101.1.67',
      ];
      for (const ip of publicIps) {
        expect(isForbiddenIp(ip)).toBe(false);
        const res = validateUrl(`https://${ip}/api`);
        expect(res.hostname).toBe(ip);
        expect(res.isLiteralIp).toBe(true);
        expect(res.ipVersion).toBe(4);
      }
    });
  });

  // =========================================================================
  // 2. IPv6 Ranges (Loopback, ULA, Link-Local, IPv4-Mapped, IMDSv2)
  // =========================================================================
  describe('2. IPv6 Private, ULA & Reserved Ranges', () => {
    it('blocks IPv6 Loopback (::1)', () => {
      const loopbacks = [
        '::1',
        '[::1]',
        '0000:0000:0000:0000:0000:0000:0000:0001',
        '[0:0:0:0:0:0:0:1]',
      ];
      for (const host of loopbacks) {
        expect(isForbiddenIp(host)).toBe(true);
        const urlHost = host.startsWith('[') ? host : `[${host}]`;
        expect(() => validateUrl(`https://${urlHost}:8443/admin`)).toThrow(SsrfBlockedError);
      }
    });

    it('blocks IPv6 Unspecified (::/128)', () => {
      const unspecified = ['::', '[::]', '0:0:0:0:0:0:0:0', '[0000:0000:0000:0000:0000:0000:0000:0000]'];
      for (const host of unspecified) {
        expect(isForbiddenIp(host)).toBe(true);
        const urlHost = host.startsWith('[') ? host : `[${host}]`;
        expect(() => validateUrl(`https://${urlHost}/`)).toThrow(SsrfBlockedError);
      }
    });

    it('blocks IPv6 Unique Local Address ULA (fc00::/7)', () => {
      const ula = [
        'fc00::1',
        '[fc00::1]',
        'fd00::1',
        '[fd00::1]',
        'fd12:3456:789a:1::1',
        '[fdfe:dcba:9876::1]',
      ];
      for (const host of ula) {
        expect(isForbiddenIp(host)).toBe(true);
        const urlHost = host.startsWith('[') ? host : `[${host}]`;
        expect(() => validateUrl(`https://${urlHost}/intranet`)).toThrow(SsrfBlockedError);
      }
    });

    it('blocks AWS Nitro IMDSv2 IPv6 (fd00:ec2::254)', () => {
      const imds = ['fd00:ec2::254', '[fd00:ec2::254]'];
      for (const host of imds) {
        expect(isForbiddenIp(host)).toBe(true);
        const urlHost = host.startsWith('[') ? host : `[${host}]`;
        expect(() => validateUrl(`https://${urlHost}/latest/meta-data/`)).toThrow(SsrfBlockedError);
      }
    });

    it('blocks IPv6 Link-Local Unicast (fe80::/10)', () => {
      const linkLocal = [
        'fe80::1',
        '[fe80::1]',
        'fe80::dead:beef',
        '[fe80::dead:beef]',
        'fe80::1%eth0',
        'fe80::200:5efe:10.0.0.1',
      ];
      for (const host of linkLocal) {
        expect(isForbiddenIp(host)).toBe(true);
        const urlHost = host.startsWith('[') ? host : `[${host}]`;
        expect(() => validateUrl(`https://${urlHost}/`)).toThrow(SsrfBlockedError);
      }
    });

    it('blocks IPv4-Mapped IPv6 addressing private/loopback IPv4 targets', () => {
      const mappedVectors = [
        '::ffff:127.0.0.1',
        '[::ffff:127.0.0.1]',
        '::ffff:10.0.0.1',
        '[::ffff:10.0.0.1]',
        '::ffff:169.254.169.254',
        '[::ffff:169.254.169.254]',
        '::ffff:192.168.1.1',
        '[::ffff:192.168.1.1]',
        '0:0:0:0:0:ffff:172.16.0.1',
        '[0:0:0:0:0:ffff:172.16.0.1]',
        '64:ff9b::127.0.0.1', // IPv4/IPv6 translation
      ];
      for (const host of mappedVectors) {
        expect(isForbiddenIp(host)).toBe(true);
        const urlHost = host.startsWith('[') ? host : `[${host}]`;
        expect(() => validateUrl(`https://${urlHost}/`)).toThrow(SsrfBlockedError);
      }
    });

    it('permits valid public IPv6 addresses', () => {
      const publicIpv6 = [
        '2606:4700:4700::1111', // Cloudflare DNS
        '[2606:4700:4700::1111]',
        '2001:4860:4860::8888', // Google DNS
        '[2001:4860:4860::8888]',
      ];
      for (const host of publicIpv6) {
        expect(isForbiddenIp(host)).toBe(false);
        const urlHost = host.startsWith('[') ? host : `[${host}]`;
        const res = validateUrl(`https://${urlHost}/`);
        expect(res.isLiteralIp).toBe(true);
        expect(res.ipVersion).toBe(6);
      }
    });
  });

  // =========================================================================
  // 3. Alternative IP Encodings (Dword, Hex, Octal, Dotless, Mixed, URL-encoded)
  // =========================================================================
  describe('3. Alternative IP Encoding Vectors', () => {
    it('decodes and blocks Dword (Integer) representations of private IPs', () => {
      const dwordVectors = [
        { dword: '2130706433', mapsTo: '127.0.0.1' },
        { dword: '2852039166', mapsTo: '169.254.169.254' },
        { dword: '167772161', mapsTo: '10.0.0.1' },
        { dword: '3232235521', mapsTo: '192.168.0.1' },
        { dword: '2886729729', mapsTo: '172.16.0.1' },
        { dword: '0', mapsTo: '0.0.0.0' },
      ];

      for (const { dword, mapsTo } of dwordVectors) {
        const parsed = parseIpv4(dword);
        expect(parsed).not.toBeNull();
        expect(parsed?.normalized).toBe(mapsTo);
        expect(parsed?.isPrivateOrReserved).toBe(true);
        expect(() => validateUrl(`https://${dword}/`)).toThrow(SsrfBlockedError);
      }
    });

    it('decodes and blocks Hexadecimal representations of private IPs', () => {
      const hexVectors = [
        { hex: '0x7f000001', mapsTo: '127.0.0.1' },
        { hex: '0xa9fea9fe', mapsTo: '169.254.169.254' },
        { hex: '0x0a000001', mapsTo: '10.0.0.1' },
        { hex: '0xc0a80001', mapsTo: '192.168.0.1' },
        { hex: '0xac100001', mapsTo: '172.16.0.1' },
        { hex: '0x7f.0x0.0x0.0x1', mapsTo: '127.0.0.1' },
        { hex: '0x0a.0x0.0x0.0x1', mapsTo: '10.0.0.1' },
        { hex: '0xa9.0xfe.0xa9.0xfe', mapsTo: '169.254.169.254' },
      ];

      for (const { hex, mapsTo } of hexVectors) {
        const parsed = parseIpv4(hex);
        expect(parsed).not.toBeNull();
        expect(parsed?.normalized).toBe(mapsTo);
        expect(parsed?.isPrivateOrReserved).toBe(true);
        expect(() => validateUrl(`https://${hex}/`)).toThrow(SsrfBlockedError);
      }
    });

    it('decodes and blocks Octal representations of private IPs', () => {
      const octalVectors = [
        { octal: '0177.0.0.1', mapsTo: '127.0.0.1' },
        { octal: '0177.0000.0000.0001', mapsTo: '127.0.0.1' },
        { octal: '0251.0376.0251.0376', mapsTo: '169.254.169.254' },
        { octal: '0012.0.0.1', mapsTo: '10.0.0.1' },
        { octal: '0300.0250.0.01', mapsTo: '192.168.0.1' },
        { octal: '0254.020.0.01', mapsTo: '172.16.0.1' },
      ];

      for (const { octal, mapsTo } of octalVectors) {
        const parsed = parseIpv4(octal);
        expect(parsed).not.toBeNull();
        expect(parsed?.normalized).toBe(mapsTo);
        expect(parsed?.isPrivateOrReserved).toBe(true);
        expect(() => validateUrl(`https://${octal}/`)).toThrow(SsrfBlockedError);
      }
    });

    it('decodes and blocks Dotless & Short notation IPv4 formats', () => {
      const shortVectors = [
        { short: '127.1', mapsTo: '127.0.0.1' },
        { short: '10.1', mapsTo: '10.0.0.1' },
        { short: '172.16.1', mapsTo: '172.16.0.1' },
        { short: '192.168.1', mapsTo: '192.168.0.1' },
        { short: '169.254.1', mapsTo: '169.254.0.1' },
        { short: '127.0.1', mapsTo: '127.0.0.1' },
      ];

      for (const { short, mapsTo } of shortVectors) {
        const parsed = parseIpv4(short);
        expect(parsed).not.toBeNull();
        expect(parsed?.normalized).toBe(mapsTo);
        expect(parsed?.isPrivateOrReserved).toBe(true);
        expect(() => validateUrl(`https://${short}/`)).toThrow(SsrfBlockedError);
      }
    });

    it('decodes and blocks Mixed encoding vectors', () => {
      const mixedVectors = [
        { mixed: '0x7f.0.0.1', mapsTo: '127.0.0.1' },
        { mixed: '127.0x0.0.1', mapsTo: '127.0.0.1' },
        { mixed: '0177.0x0.0.1', mapsTo: '127.0.0.1' },
        { mixed: '10.0x00.0.1', mapsTo: '10.0.0.1' },
        { mixed: '0x7f.1', mapsTo: '127.0.0.1' },
        { mixed: '012.1', mapsTo: '10.0.0.1' },
      ];

      for (const { mixed, mapsTo } of mixedVectors) {
        const parsed = parseIpv4(mixed);
        expect(parsed).not.toBeNull();
        expect(parsed?.normalized).toBe(mapsTo);
        expect(parsed?.isPrivateOrReserved).toBe(true);
        expect(() => validateUrl(`https://${mixed}/`)).toThrow(SsrfBlockedError);
      }
    });

    it('decodes and blocks URL-encoded / Percent-encoded IP hostnames', () => {
      const encodedVectors = [
        '%31%32%37.0.0.1',
        '127.%30.0.1',
        '169.254.%31%36%39.%32%35%34',
        '%30%78%37%66.0.0.1',
        '%32%31%33%30%37%30%36%34%33%33',
      ];

      for (const enc of encodedVectors) {
        expect(() => validateUrl(`https://${enc}/`)).toThrow(SsrfBlockedError);
      }
    });

    it('handles numeric overflows gracefully without false positive passes', () => {
      // 32-bit integer overflow (4294967296 is 2^32)
      expect(parseIpv4('4294967296')).toBeNull();
      // 24-bit part overflow in 2-part notation (127.16777216 is 127.(2^24))
      expect(parseIpv4('127.16777216')).toBeNull();
      // 16-bit part overflow in 3-part notation (127.0.65536)
      expect(parseIpv4('127.0.65536')).toBeNull();
      // 8-bit octet overflow in 4-part notation (127.0.0.256)
      expect(parseIpv4('127.0.0.256')).toBeNull();
    });
  });

  // =========================================================================
  // 4. DNS Rebinding & TOCTOU Socket Pinning Mitigations
  // =========================================================================
  describe('4. DNS Rebinding & TOCTOU Socket Pinning Defenses', () => {
    it('detects and blocks DNS resolving to private IP addresses (fail-closed)', async () => {
      mockDns.register('evil-private.corp', ['10.0.0.5']);
      mockDns.register('local-test.me', ['127.0.0.1']);
      mockDns.register('cloud-metadata-alias.com', ['169.254.169.254']);

      await expect(validateHostnameDns('evil-private.corp', mockDns)).rejects.toThrow(
        SsrfBlockedError
      );
      await expect(validateHostnameDns('local-test.me', mockDns)).rejects.toThrow(
        SsrfBlockedError
      );
      await expect(validateHostnameDns('cloud-metadata-alias.com', mockDns)).rejects.toThrow(
        SsrfBlockedError
      );
    });

    it('fails closed when multi-homed DNS records contain ANY private IP address', async () => {
      // Mixed public and private A records
      mockDns.register('mixed-records.attacker.com', ['93.184.216.34', '192.168.1.1']);

      await expect(validateHostnameDns('mixed-records.attacker.com', mockDns)).rejects.toThrow(
        SsrfBlockedError
      );
    });

    it('simulates and mitigates Dynamic TTL-0 DNS Rebinding via Socket Pinning', async () => {
      const pinningMgr = new DnsPinningManager(10000);

      // Rebinding attacker domain: Query 1 returns safe public IP, Query 2 returns loopback!
      mockDns.registerRebinding('rebind.attacker.com', ['93.184.216.34'], ['127.0.0.1']);

      // 1. Initial Resolution & Pinning
      const pinnedConn = await pinningMgr.resolveAndPin('rebind.attacker.com', 443, mockDns);
      expect(pinnedConn.pinnedIp).toBe('93.184.216.34');
      expect(pinnedConn.hostname).toBe('rebind.attacker.com');

      // 2. Verify Rebinding Detection
      await expect(
        pinningMgr.verifyAgainstRebinding(
          'rebind.attacker.com',
          pinnedConn.pinnedIp,
          mockDns
        )
      ).rejects.toThrow(DnsRebindingError);
    });

    it('verifies sequential DNS transitions across multi-step query sequences', async () => {
      const pinningMgr = new DnsPinningManager(10000);

      // Multi-step sequence: Safe -> Safe -> Private (Rebind)
      mockDns.registerSequence('seq.attacker.com', [
        ['93.184.216.34'],
        ['93.184.216.35'],
        ['169.254.169.254'],
      ]);

      const pin1 = await pinningMgr.resolveAndPin('seq.attacker.com', 443, mockDns);
      expect(pin1.pinnedIp).toBe('93.184.216.34');

      // 2nd lookup is still public -> passes
      const isOk = await pinningMgr.verifyAgainstRebinding('seq.attacker.com', pin1.pinnedIp, mockDns);
      expect(isOk).toBe(true);

      // 3rd lookup hits private address (169.254.169.254) -> detected and throws DnsRebindingError!
      await expect(
        pinningMgr.verifyAgainstRebinding('seq.attacker.com', pin1.pinnedIp, mockDns)
      ).rejects.toThrow(DnsRebindingError);
    });

    it('blocks direct cloud metadata domain names prior to DNS lookup', () => {
      const cloudDomains = [
        'metadata.google.internal',
        'sub.metadata.google.internal',
        'instance-data',
        'metadata.internal',
      ];
      for (const domain of cloudDomains) {
        expect(() => validateUrl(`http://${domain}/computeMetadata/v1/`)).toThrow(
          CloudMetadataBlockedError
        );
      }
    });
  });

  // =========================================================================
  // 5. 3xx Redirect Chain 5-Layer Re-validation
  // =========================================================================
  describe('5. 3xx Redirect Chain Re-validation Defenses', () => {
    it('blocks HTTP 301/302 redirects targeting private IPv4 addresses', async () => {
      // Mock transport that returns 302 Redirect to 127.0.0.1
      const redirectTransport = async (url: string, init: RequestInit) => {
        if (url === 'https://example.com/redirect-to-localhost') {
          return new Response(null, {
            status: 302,
            headers: { Location: 'https://127.0.0.1:8443/admin' },
          });
        }
        return new Response('ok', { status: 200 });
      };

      await expect(
        safeFetch('https://example.com/redirect-to-localhost', {
          dnsResolver: mockDns,
          customTransport: redirectTransport,
        })
      ).rejects.toThrow(SsrfBlockedError);
    });

    it('blocks HTTP redirects targeting Cloud IMDS metadata endpoints', async () => {
      const redirectTransport = async (url: string) => {
        if (url === 'https://example.com/redirect-to-imds') {
          return new Response(null, {
            status: 307,
            headers: { Location: 'http://169.254.169.254/latest/meta-data/' },
          });
        }
        return new Response('ok', { status: 200 });
      };

      await expect(
        safeFetch('https://example.com/redirect-to-imds', {
          dnsResolver: mockDns,
          customTransport: redirectTransport,
        })
      ).rejects.toThrow(SsrfBlockedError);
    });

    it('blocks HTTP redirects targeting forbidden schemes (file:, javascript:, data:, gopher:)', async () => {
      const dangerousSchemes = [
        'file:///etc/passwd',
        'javascript:alert(document.cookie)',
        'data:text/html,<script>alert(1)</script>',
        'gopher://127.0.0.1:70/',
        'dict://127.0.0.1:2628/',
      ];

      for (const schemeTarget of dangerousSchemes) {
        const transport = async (url: string) => {
          return new Response(null, {
            status: 302,
            headers: { Location: schemeTarget },
          });
        };

        await expect(
          safeFetch('https://example.com/redirect-attack', {
            dnsResolver: mockDns,
            customTransport: transport,
          })
        ).rejects.toThrow(InvalidUrlSchemeError);
      }
    });

    it('blocks HTTP redirects targeting alternate IP encodings (Hex, Octal, IPv6 ULA)', async () => {
      const alternateTargets = [
        'http://0x7f000001/admin',
        'http://0177.0.0.1/admin',
        'http://2130706433/admin',
        'https://[fc00::1]/admin',
        'https://[::ffff:127.0.0.1]/admin',
      ];

      for (const target of alternateTargets) {
        const transport = async (url: string) => {
          return new Response(null, {
            status: 302,
            headers: { Location: target },
          });
        };

        await expect(
          safeFetch('https://example.com/redirect-alternate', {
            dnsResolver: mockDns,
            customTransport: transport,
          })
        ).rejects.toThrow(SsrfBlockedError);
      }
    });

    it('blocks multi-hop redirect chains that end in private IP addresses', async () => {
      mockDns.register('hop1.com', ['93.184.216.34']);
      mockDns.register('hop2.com', ['93.184.216.35']);

      const multiHopTransport = async (url: string) => {
        if (url === 'https://hop1.com/start') {
          return new Response(null, {
            status: 302,
            headers: { Location: 'https://hop2.com/middle' },
          });
        }
        if (url === 'https://hop2.com/middle') {
          return new Response(null, {
            status: 302,
            headers: { Location: 'https://10.0.0.1/secrets' },
          });
        }
        return new Response('forbidden', { status: 200 });
      };

      await expect(
        safeFetch('https://hop1.com/start', {
          dnsResolver: mockDns,
          customTransport: multiHopTransport,
        })
      ).rejects.toThrow(SsrfBlockedError);
    });

    it('blocks redirect loops exceeding maximum hops limit', async () => {
      mockDns.register('loop1.com', ['93.184.216.34']);
      mockDns.register('loop2.com', ['93.184.216.35']);

      const loopTransport = async (url: string) => {
        if (url.includes('loop1.com')) {
          return new Response(null, {
            status: 302,
            headers: { Location: 'https://loop2.com/step' },
          });
        }
        return new Response(null, {
          status: 302,
          headers: { Location: 'https://loop1.com/step' },
        });
      };

      await expect(
        safeFetch('https://loop1.com/step', {
          dnsResolver: mockDns,
          maxRedirects: 3,
          customTransport: loopTransport,
        })
      ).rejects.toThrow(RedirectBlockedError);
    });

    it('strips sensitive headers (Authorization, Cookie) on cross-origin redirects', async () => {
      mockDns.register('source.com', ['93.184.216.34']);
      mockDns.register('destination.com', ['93.184.216.35']);

      let capturedHeaders: Record<string, string> = {};

      const crossOriginTransport = async (url: string, init: RequestInit) => {
        if (url === 'https://source.com/auth-redirect') {
          return new Response(null, {
            status: 302,
            headers: { Location: 'https://destination.com/public' },
          });
        }
        if (url === 'https://destination.com/public') {
          capturedHeaders = (init.headers as Record<string, string>) || {};
          return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
        }
        return new Response('not found', { status: 404 });
      };

      const response = await safeFetch('https://source.com/auth-redirect', {
        dnsResolver: mockDns,
        headers: {
          Authorization: 'Bearer super-secret-token',
          Cookie: 'session=12345',
          'X-Custom-Safe-Header': 'preserve-me',
        },
        customTransport: crossOriginTransport,
      });

      expect(response.status).toBe(200);
      expect(capturedHeaders['Authorization']).toBeUndefined();
      expect(capturedHeaders['Cookie']).toBeUndefined();
      expect(capturedHeaders['X-Custom-Safe-Header']).toBe('preserve-me');
    });

    it('allows clean public-to-public redirects and preserves response payload', async () => {
      mockDns.register('api.example.com', ['93.184.216.34']);
      mockDns.register('cdn.example.com', ['93.184.216.35']);

      const cleanRedirectTransport = async (url: string) => {
        if (url === 'https://api.example.com/data') {
          return new Response(null, {
            status: 302,
            headers: { Location: 'https://cdn.example.com/asset.json' },
          });
        }
        if (url === 'https://cdn.example.com/asset.json') {
          return new Response(JSON.stringify({ version: '1.0.0', secure: true }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response('error', { status: 500 });
      };

      const response = await safeFetch('https://api.example.com/data', {
        dnsResolver: mockDns,
        customTransport: cleanRedirectTransport,
      });

      expect(response.status).toBe(200);
      expect(response.redirectCount).toBe(1);
      const json = await response.json();
      expect(json.secure).toBe(true);
    });
  });

  // =========================================================================
  // 6. URL Scheme Enforcement & Subdomain Suffix Collision Defense
  // =========================================================================
  describe('6. URL Scheme & Domain Suffix Collision Enforcement', () => {
    it('enforces allowed schemes (http, https) and rejects non-whitelisted schemes', () => {
      const blockedSchemes = [
        'file:///var/log/system.log',
        'javascript:void(0)',
        'data:text/plain;base64,SGVsbG8=',
        'gopher://gopher.floodgap.com/',
        'dict://dict.org/',
        'ftp://ftp.debian.org/',
        'ldap://ldap.forumsys.com/',
        'blob:https://example.com/guid',
        'about:blank',
        'vbscript:Execute(1)',
      ];

      for (const rawUrl of blockedSchemes) {
        expect(() => validateUrl(rawUrl)).toThrow(InvalidUrlSchemeError);
      }
    });

    it('enforces HTTPS-only policy when requireHttps is enabled', () => {
      expect(() =>
        validateUrl('http://example.com/api', { requireHttps: true })
      ).toThrow(GoatSecurityError);

      const httpsRes = validateUrl('https://example.com/api', { requireHttps: true });
      expect(httpsRes.scheme).toBe('https:');
    });

    it('supports WebSocket schemes (ws:, wss:) when explicitly whitelisted but blocks SSRF', () => {
      // Valid public WebSocket URL with ws:/wss: allowed
      const wsRes = validateUrl('wss://safe-api.org/ws', { allowedSchemes: ['ws:', 'wss:'] });
      expect(wsRes.scheme).toBe('wss:');

      // Private WebSocket URLs MUST BE BLOCKED
      expect(() =>
        validateUrl('ws://127.0.0.1:8080/ws', { allowedSchemes: ['ws:', 'wss:'] })
      ).toThrow(SsrfBlockedError);

      expect(() =>
        validateUrl('wss://169.254.169.254/ws', { allowedSchemes: ['ws:', 'wss:'] })
      ).toThrow(SsrfBlockedError);
    });

    it('rejects embedded credentials in URLs to prevent credential leakage', () => {
      expect(() => validateUrl('https://user:password@example.com/secure')).toThrow(
        GoatSecurityError
      );
    });

    it('prevents subdomain suffix collisions and spoofing in domain allowlists', () => {
      const allowlist = ['example.com', '*.safe-api.org'];

      // Legitimate allowlisted domains
      expect(isDomainAllowed('example.com', allowlist)).toBe(true);
      expect(isDomainAllowed('EXAMPLE.COM', allowlist)).toBe(true);
      expect(isDomainAllowed('safe-api.org', allowlist)).toBe(true);
      expect(isDomainAllowed('sub.safe-api.org', allowlist)).toBe(true);
      expect(isDomainAllowed('a.b.c.safe-api.org', allowlist)).toBe(true);

      // Suffix collision and spoofing attacks MUST BE REJECTED
      expect(isDomainAllowed('example.com.attacker.com', allowlist)).toBe(false);
      expect(isDomainAllowed('example.com-evil.org', allowlist)).toBe(false);
      expect(isDomainAllowed('not-example.com', allowlist)).toBe(false);
      expect(isDomainAllowed('attacker-example.com', allowlist)).toBe(false);
      expect(isDomainAllowed('sub.safe-api.org.evil.net', allowlist)).toBe(false);
      expect(isDomainAllowed('safe-api.org.cn', allowlist)).toBe(false);

      // End-to-end URL validator check
      expect(() =>
        validateUrl('https://example.com.attacker.com/steal', { domainAllowlist: allowlist })
      ).toThrow(DomainNotAllowedError);

      expect(() =>
        validateUrl('https://example.com-evil.org/phish', { domainAllowlist: allowlist })
      ).toThrow(DomainNotAllowedError);
    });
  });

  // =========================================================================
  // 7. Full Zero-Trust E2E Execution Matrix
  // =========================================================================
  describe('7. Full Zero-Trust E2E Execution Matrix', () => {
    it('executes successful secured API request against allowlisted endpoint', async () => {
      const transport = async (url: string, init: RequestInit, pinnedIp: string) => {
        return new Response(
          JSON.stringify({ success: true, clientIp: pinnedIp, message: 'Verified Zero-Trust' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      };

      const res = await safeFetch('https://safe-api.org/v1/profile', {
        dnsResolver: mockDns,
        domainAllowlist: ['*.safe-api.org', 'safe-api.org'],
        customTransport: transport,
      });

      expect(res.status).toBe(200);
      expect(res.pinnedIp).toBe('104.21.45.67');
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.clientIp).toBe('104.21.45.67');
    });

    it('blocks request when domain is not in manifest domain allowlist', async () => {
      await expect(
        safeFetch('https://untrusted-host.com/api', {
          dnsResolver: mockDns,
          domainAllowlist: ['safe-api.org'],
        })
      ).rejects.toThrow(DomainNotAllowedError);
    });
  });
});
