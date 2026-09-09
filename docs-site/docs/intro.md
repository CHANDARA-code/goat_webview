---
sidebar_position: 1
slug: /
title: Introduction to Goat WebView
---

# Goat WebView Mini-App Engine

**Goat WebView** is an enterprise-grade, high-performance, multi-tenant Mini-App Engine engineered for native iOS, Android, React Native, Flutter, and Web platforms.

## Core Pillars & Innovations

1. **Sub-15ms Boot Time**: Achieved through intelligent headless pre-warming pools, binary asset caching, and ahead-of-time V8/JavaScriptCore bytecode compilation.
2. **Strict Multi-Tenant Sandboxing**: Hardware-backed credential partitioning, AES-256 GCM encrypted storage at rest, account-scoped isolation (`{appId}/{accountId}`), and strict path-traversal/Zip Slip enforcement.
3. **High-Performance 210-Action IPC Bridge**: Ultra-low latency asynchronous bridge with binary message port support (ArrayBuffer / zero-copy IPC), gesture freshness verification, and event coalescing.
4. **Resilient OTA Differential Updates**: ECDSA P-256 signed release manifests with bsdiff 4.0 binary delta patching, gradual grayscale rollouts, and automatic atomic rollback protection.
5. **OWASP MASVS Hardened Security**: Unconditional SSL error cancellation, Subresource Origin Allowlisting, CSP / COOP / COEP sandbox header injection, and anti-abuse user-interaction freshness gates.
6. **Web3, Passkey & Hardware Vault**: Host-supplied `GoatWalletAdapter` signer SPI (the engine holds no keys), hardware-isolated EVM / Solana / TON transaction decoders, EIP-6963 / Solana / TON-Connect provider discovery, W3C passkeys, and an AndroidKeyStore / iOS-Keychain AES-256-GCM vault that fails closed when secure hardware is unavailable.
7. **Drop-in Migration Adapters**: `goat_webview_compat` (`flutter_inappwebview` API surface) and `react-native-goat-webview-compat` (`react-native-webview` API surface) let existing apps swap engines without rewriting call sites, plus portable WeChat / Alipay / uni-app / Taro DSL shims (`@goat/adapter-dsl`).
