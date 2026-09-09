---
sidebar_position: 5
title: Multi-Tenant Sandboxing
---

# Multi-Tenant Sandboxing & Process Isolation

In a super-app ecosystem, multiple independent mini-apps developed by third-party organizations run alongside core host features. The **Goat Multi-Tenant Sandboxing Architecture** provides defense-in-depth security, strict file and memory partitioning, and cryptographic key isolation to ensure that no mini-app can access another tenant's data or compromise the host OS.

---

## Multi-Tenant Sandboxing Topology

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        MULTI-TENANT SANDBOX ISOLATION HIERARCHY                        │
└────────────────────────────────────────────────────────────────────────────────────────┘

                     Host Application Process (Main Thread)
                                        │
             ┌──────────────────────────┴──────────────────────────┐
             ▼                                                     ▼
  Tenant A: `com.merchant.shop`                         Tenant B: `com.bank.wallet`
  ┌─────────────────────────────────┐                   ┌─────────────────────────────────┐
  │ Storage: files/miniapps/shop/   │                   │ Storage: files/miniapps/wallet/ │
  │ KeyStore: `goat_sec_shop`       │  Strict Boundary  │ KeyStore: `goat_sec_wallet`     │
  │ SQLite: `db_shop.sqlite`        │◄─────────────────►│ SQLite: `db_wallet.sqlite`      │
  │ Cookies: Isolated Cookie Jar    │   No Leakage      │ Cookies: Isolated Cookie Jar    │
  │ Origin: `goat://shop/`          │                   │ Origin: `goat://wallet/`        │
  └─────────────────────────────────┘                   └─────────────────────────────────┘
```

---

## 1. Storage & Filesystem Partitioning

Every persistent operation is strictly scoped by the tenant's cryptographic `appId` and the active user `accountId`:

1. **Sandboxed Data Root:**
   ```text
   /data/user/0/com.host.app/files/miniapps/{appId}/{accountId}/data/
   ```
2. **Key-Value Store Partitioning:**
   SharedPreferences (Android) and UserDefaults (iOS) use tenant-prefixed storage keys (`goat_store_{appId}_{accountId}`).
3. **Hardware-Backed Encryption:**
   Keys are protected via AndroidKeyStore (AES-256 GCM) and Apple Keychain with access group constraints scoped to `goat_secure_{appId}_{accountId}`.
4. **Canonical Path Traversal Guards:**
   File operations resolve canonical paths (`getCanonicalPath()`) and ensure the path is a strict descendant of the tenant root directory, preventing Zip Slip and `../` directory escape attacks.

---

## 2. Web Engine & Process Sandboxing

- **Cookie Partitioning:** Cookies are stored in isolated per-tenant cookie jars, preventing session hijacking across mini-apps.
- **IndexedDB & Web Storage:** Isolated origins (`goat://{appId}/` or `https://appassets.androidplatform.net/assets/{appId}/`) prevent cross-origin DOM storage leaks.
- **Process Termination Recovery:** If an out-of-process renderer crashes due to memory pressure, the host container restores the tenant session without affecting neighboring mini-apps or the host UI.
