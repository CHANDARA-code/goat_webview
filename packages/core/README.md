# @goat/core

Enterprise Zero-Trust Security, SSRF Defenses, Network Policies, and Core Types for the Goat WebView Ecosystem.

## Architecture

`@goat/core` implements a 5-layer Zero-Trust network defense pipeline:

1. **Layer 1: URL Scheme & Protocol Validation**: Enforces allowed schemes (`https`, `http`, `wss`, `ws`), rejects dangerous protocols (`file:`, `javascript:`, `data:`, `gopher:`, `dict:`, `ftp:`, `ldap:`), strips or blocks embedded credentials, and supports strict HTTPS-only enforcement.
2. **Layer 2: Hostname & Subdomain Allowlisting**: Canonical host normalization, cloud metadata hostname blocking (`metadata.google.internal`, `169.254.169.254`, `[fd00:ec2::254]`), and boundary-safe domain allowlisting preventing suffix collision / subdomain spoofing.
3. **Layer 3: IP Normalization & Subnet Filtering**: BSD socket-compliant IP parser handling standard IPv4/IPv6, Dword integers (`2130706433`), Hex (`0x7f000001`), Octal (`0177.0.0.1`), Dotless short notations (`127.1`), IPv4-mapped IPv6 (`::ffff:127.0.0.1`), IPv6 ULA (`fc00::/7`), link-local (`fe80::/10`), and loopback.
4. **Layer 4: DNS Rebinding Mitigation & Socket Pinning**: Layer 3 pre-resolution validating all A/AAAA records (fail-closed if any record is private), binding connections to verified pinned IPs, and detecting TOCTOU DNS rebinding transitions.
5. **Layer 5: 3xx Redirect Chain Re-validation**: Intercepts all 301, 302, 303, 307, 308 HTTP redirects, subjects target URLs to the complete 5-layer security pipeline, strips sensitive auth headers on cross-origin jumps, and enforces max hop limits.

## Installation & Testing

```bash
bun test packages/core/test/security/
```
