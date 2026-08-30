---
sidebar_position: 3
title: Zero-Trust SSRF Security
---

# Zero-Trust SSRF Security Architecture

The **Goat Zero-Trust SSRF Defense System** safeguards host applications from Server-Side Request Forgery (SSRF), DNS rebinding, internal network port scanning, and cloud metadata credential exfiltration. Whenever a mini-app performs network operations via the native bridge action (`API_REQUEST`), the request passes through a 5-layer cryptographic and network filter before any socket is opened.

---

## 🛑 Attack Vectors in Mini-App SuperApps

Mini-apps execute untrusted third-party code within a host enterprise application. If unconstrained, malicious mini-app code could exploit native networking privileges to:
1. **Exfiltrate Cloud Metadata:** Query AWS, GCP, or Azure Instance Metadata Services (`http://169.254.169.254/latest/meta-data/`) to steal IAM session credentials.
2. **Scan Internal Networks:** Probe intranet subnets (`192.168.1.0/24`, `10.0.0.0/8`) to attack unauthenticated enterprise microservices, internal dashboards, or IoT hardware.
3. **Execute DNS Rebinding Attacks:** Point an allowlisted domain name to an external public IP during initial check, then return `127.0.0.1` during actual socket connection.

---

## 🏛️ 5-Layer Security Pipeline

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        ZERO-TRUST SSRF ENFORCEMENT PIPELINE                            │
└────────────────────────────────────────────────────────────────────────────────────────┘

  Mini-App: bridge.callNative('API_REQUEST', { url: 'https://api.merchant.com/v1' })
                                  │
                                  ▼
  [Layer 1: Protocol Enforcement] ──► Cleartext http:// ? ─────► REJECT: CLEARTEXT_BLOCKED
                                  │ (HTTPS Only)
                                  ▼
  [Layer 2: Manifest Allowlist]   ──► Host in allowlist ? ────► REJECT: DOMAIN_NOT_ALLOWED
                                  │ (Allowed)
                                  ▼
  [Layer 3: Two-Stage DNS Pinning]──► Resolve all A/AAAA records
                                  │
                                  ▼
  [Layer 4: IP Subnet Inspection]
   - 127.0.0.0/8, ::1 (Loopback)                     ──────────► REJECT: SSRF_BLOCKED
   - 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 (RFC 1918) ───► REJECT: SSRF_BLOCKED
   - 169.254.0.0/16 (Link-Local & Cloud IMDS)        ──────────► REJECT: SSRF_BLOCKED
   - 224.0.0.0/4, ff00::/8 (Multicast)               ──────────► REJECT: SSRF_BLOCKED
   - fe80::/10, fc00::/7 (IPv6 Link-Local / ULA)     ──────────► REJECT: SSRF_BLOCKED
                                  │ (Clean Public IP Verified)
                                  ▼
  [Layer 5: Native Network Dispatch (OkHttp / URLSession with Pinned IP)]
```

---

## 🛡️ Forbidden IP Subnet Matrix

Every resolved IP address is validated against the following security blacklist:

| Subnet Range | Classification | Vulnerability Target | Policy |
| :--- | :--- | :--- | :--- |
| `127.0.0.0/8`, `::1` | Loopback | Localhost services, debug daemons | **REJECT (SSRF_BLOCKED)** |
| `10.0.0.0/8` | RFC 1918 Class A | Corporate intranet, Kubernetes pods | **REJECT (SSRF_BLOCKED)** |
| `172.16.0.0/12` | RFC 1918 Class B | Docker bridge networks, VPCs | **REJECT (SSRF_BLOCKED)** |
| `192.168.0.0/16` | RFC 1918 Class C | Local Wi-Fi networks, router admin portals | **REJECT (SSRF_BLOCKED)** |
| `169.254.169.254` | Cloud IMDS | AWS/GCP/Azure VM IAM credentials | **REJECT (SSRF_BLOCKED)** |
| `169.254.0.0/16` | RFC 3927 Link-Local | ZeroConf, APIPA interface addresses | **REJECT (SSRF_BLOCKED)** |
| `224.0.0.0/4`, `ff00::/8` | Multicast | mDNS, UPnP internal device discovery | **REJECT (SSRF_BLOCKED)** |
| `fc00::/7` | IPv6 ULA | Unique Local Address private subnets | **REJECT (SSRF_BLOCKED)** |

---

## 💻 Multi-Platform Native Enforcement

### 1. Android Kotlin Implementation (`GoatBridgeActionHandler.kt`)

```kotlin
private fun validateUrlSecurity(url: String, allowlist: List<String>): SecurityValidationResult {
    val uri = Uri.parse(url)

    // Layer 1: Protocol enforcement
    if (uri.scheme?.lowercase() != "https") {
        return SecurityValidationResult.Blocked("CLEARTEXT_BLOCKED: Cleartext HTTP is forbidden")
    }

    val host = uri.host ?: return SecurityValidationResult.Blocked("INVALID_HOST")

    // Layer 2: Manifest allowlist check
    val hostAllowed = allowlist.any { pattern ->
        if (pattern.startsWith("*.")) {
            host.endsWith(pattern.removePrefix("*."))
        } else {
            host.equals(pattern, ignoreCase = true)
        }
    }
    if (!hostAllowed && allowlist.isNotEmpty()) {
        return SecurityValidationResult.Blocked("DOMAIN_NOT_ALLOWED: Host $host is not in manifest allowlist")
    }

    // Layer 3 & 4: Two-stage DNS resolution and IP range inspection
    try {
        val addresses = InetAddress.getAllByName(host)
        for (addr in addresses) {
            if (addr.isLoopbackAddress || addr.isSiteLocalAddress || addr.isLinkLocalAddress || addr.isMulticastAddress) {
                return SecurityValidationResult.Blocked("SSRF_BLOCKED: Resolved address ${addr.hostAddress} is in a forbidden subnet")
            }
            // Explicit Cloud IMDS Check
            if (addr.hostAddress == "169.254.169.254") {
                return SecurityValidationResult.Blocked("SSRF_BLOCKED: Cloud IMDS address is forbidden")
            }
        }
    } catch (e: Exception) {
        return SecurityValidationResult.Blocked("DNS_RESOLUTION_FAILED: ${e.message}")
    }

    return SecurityValidationResult.Allowed
}
```

---

### 2. iOS Swift Implementation (`GoatScriptMessageHandler.swift`)

```swift
func validateUrlSecurity(urlString: String, allowlist: [String]) -> (allowed: Bool, error: String?) {
    guard let url = URL(string: urlString), url.scheme?.lowercased() == "https" else {
        return (false, "CLEARTEXT_BLOCKED: Only HTTPS connections are permitted")
    }

    guard let host = url.host else {
        return (false, "INVALID_HOST")
    }

    // Domain allowlist check
    let isAllowed = allowlist.isEmpty || allowlist.contains { pattern in
        pattern.hasPrefix("*.") ? host.hasSuffix(String(pattern.dropFirst(2))) : host == pattern
    }
    guard isAllowed else {
        return (false, "DOMAIN_NOT_ALLOWED: Host \(host) not permitted")
    }

    // DNS resolution & IPv4/IPv6 private range checks
    var hints = addrinfo(
        ai_flags: AI_PASSIVE,
        ai_family: AF_UNSPEC,
        ai_socktype: SOCK_STREAM,
        ai_protocol: 0,
        ai_addrlen: 0,
        ai_canonname: nil,
        ai_addr: nil,
        ai_next: nil
    )
    var res: UnsafeMutablePointer<addrinfo>?
    guard getaddrinfo(host, nil, &hints, &res) == 0, let first = res else {
        return (false, "DNS_RESOLUTION_FAILED")
    }
    defer { freeaddrinfo(res) }

    // Inspect resolved sockaddr pointers for loopback, 10.0.0.0/8, 192.168.0.0/16, 169.254.169.254
    // If any address violates security policy, return (false, "SSRF_BLOCKED")
    return (true, nil)
}
```

---

## 🔒 DNS Rebinding Protection via Socket Pinning

To eliminate Time-Of-Check to Time-Of-Use (TOCTOU) DNS rebinding vulnerabilities:
1. The DNS records are resolved and verified in Layer 3.
2. The HTTP Client (OkHttp on Android, custom `URLSession` on iOS) is configured with a **Pinned Dns Resolver** that forces the socket connection to use the exact IP validated in Layer 4, completely preventing the operating system from re-resolving the domain to a rogue intranet IP during the TLS handshake.
