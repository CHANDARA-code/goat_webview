---
sidebar_position: 1
title: OWASP MASVS Compliance
---

# OWASP MASVS Compliance

Goat WebView complies with the OWASP Mobile Application Security Verification Standard (MASVS) across all mobile runtime layers:

## 1. MASVS-STORAGE (Data Storage and Privacy)

- **Hardware-Backed Cryptography**: All sensitive secrets use Android KeyStore AES-256 GCM (with authenticated tags) or Apple Keychain.
- **Tenant Isolation**: Keys and files are partitioned by `{appId}/{accountId}` with zero leakage across tenants.
- **Anti-Traversal Protections**: Strict path validation prevents Zip Slip and Directory Traversal attacks.

## 2. MASVS-NETWORK (Network Communication)

- **Unconditional SSL Error Rejection**: All untrusted certificates, hostname mismatches, and expired SSL handshakes unconditionally terminate with `handler.cancel()`.
- **Subresource Origin Allowlisting**: Subresources (scripts, styles, fonts, frames) are restricted to authorized CDN and API origins via `GoatContentBlocker`.
- **Public Key Pinning (HPKP / SPKI)**: SHA-256 pin verification guarantees protection against rogue Certificate Authorities and MitM attacks.

## 3. MASVS-PLATFORM (Platform Interaction)

- **Hardened WebView Settings**: `allowFileAccess=false`, `allowContentAccess=false`, `allowFileAccessFromFileURLs=false`, and `allowUniversalAccessFromFileURLs=false`.
- **Two-Stage Permission Priming**: Host displays transparent user-facing rationale dialogs prior to requesting sensitive OS permissions (camera, location, microphone).
