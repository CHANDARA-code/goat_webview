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
- **Subresource Origin Allowlisting**: `GoatContentBlocker` restricts subresources (scripts, styles, fonts, frames) to authorized CDN and API origins. **Activation differs by platform — verify before relying on it.** On iOS it is registered per mini-app from the manifest (`GoatView.swift:569`, rules recompiled by `GoatRemoteManager`). On Android it is enforced in `GoatWebViewClient.shouldInterceptRequest`; as of `dec49b91` `GoatView` reads the bundle's `manifest.json` and passes `security.allowedDomains` through, so packaged mini-apps that declare an allowlist are filtered on both platforms from the same field. A mini-app that declares none is not filtered — the allowlist stays empty and the blocker inactive, which is the long-standing behaviour. URL-mode mini-apps have no manifest; set `GoatView.hostDomainAllowlist` to filter their subresources. `GoatBridgeActionHandler.validateAndFilterUrl` enforces the same list on `API_REQUEST`, `DOWNLOAD_FILE`, `UPLOAD_FILE` and their redirects as of `6f4d9f18`, with iOS matching in `4e8545bf`. Its other two layers — HTTPS-only and SSRF IP filtering (loopback, RFC-1918, cloud metadata) — were always active on both platforms.
- **Public Key Pinning (HPKP / SPKI)**: SHA-256 pin verification guarantees protection against rogue Certificate Authorities and MitM attacks.

## 3. MASVS-PLATFORM (Platform Interaction)

- **Hardened WebView Settings**: `allowFileAccess=false`, `allowContentAccess=false`, `allowFileAccessFromFileURLs=false`, and `allowUniversalAccessFromFileURLs=false`.
- **Two-Stage Permission Priming**: Host displays transparent user-facing rationale dialogs prior to requesting sensitive OS permissions (camera, location, microphone).
