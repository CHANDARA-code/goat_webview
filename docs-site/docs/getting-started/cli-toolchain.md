---
sidebar_position: 2
title: Goat CLI Toolchain
---

# Goat CLI Toolchain (`@goat/cli`)

The **Goat CLI** is the unified, developer-first command-line toolchain for building, debugging, testing, and packaging Goat Mini-Apps. It automates project scaffolding across multiple frameworks, injects hermetic mock bridge runtimes, streams live code to physical devices via QR code tunnels, and compiles optimized production bundles with ahead-of-time (AOT) V8 bytecode caching.

---

## Installation & Setup

Install `@goat/cli` globally via npm, yarn, or pnpm:

```bash
# Global installation via npm
npm install -g @goat/cli

# Alternatively, run directly with npx or bunx
npx @goat/cli doctor
# or
bunx @goat/cli doctor
```

### Checking System Readiness (`goat doctor`)

Before scaffolding or deploying to physical devices, run `goat doctor` to verify your local development environment:

```bash
goat doctor
```

Output:
```text
 Goat Doctor — Environment Health Check

  [Supported] Node.js          v20.15.0 (≥ 20 [Supported])
  [Supported] Bun              v1.1.20 [Supported]
  [Supported] Java             openjdk 17.0.10 (≥ 17 [Supported])
  [Supported] ANDROID_HOME     /Users/developer/Library/Android/sdk [Supported]
  [Supported] ADB              Android Debug Bridge version 1.0.41 — 1 device(s) connected [Supported]
  [Supported] Xcode            Xcode 16.0 [Supported]
  [Supported] Simulators       2 simulator(s) booted [Supported]

[Supported] All checks passed! Your environment is ready for Goat development.
```

#### Doctor Options & Flags

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--verbose` | `boolean` | `false` | Displays detailed remediation hints and diagnostic logs for failing checks. |
| `--fix` | `boolean` | `false` | Attempts automated remediation where supported (e.g. symlinks, directory creation). |

---

## CLI Commands Reference

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              GOAT CLI WORKFLOW TOPOLOGY                                │
└────────────────────────────────────────────────────────────────────────────────────────┘

  [Scaffold]             [Develop]             [Device Test]            [Package]
  goat init   ──────►   goat dev   ──────►    goat run      ──────►   goat build
  - React 19            - Vite 6 HMR          - ADB Port Forward       - Rollup Bundle
  - Vue 3.5             - Mock Bridge         - Wireless QR Pair       - V8 Bytecode (.jsc)
  - Svelte 5            - IPC Trace Log       - iOS Simulator          - SHA-256 Digest
```

---

### 1. `goat init` — Project Scaffolding

Scaffolds a clean, production-ready mini-app project configured with TypeScript, Vite 6, native bridge integration, and manifest descriptors.

```bash
goat init <name> [--template=react|vue|svelte] [--typescript] [--out-dir=<path>]
```

#### Command Options

| Argument / Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `<name>` | `string` | *(Required)* | Project directory name and Mini-App identifier. |
| `--template` | `string` | `"react"` | Framework template: `react` (React 19), `vue` (Vue 3.5), or `svelte` (Svelte 5). |
| `--typescript` | `boolean` | `true` | Configures strict TypeScript compilation (`tsconfig.json`). |
| `--out-dir` | `string` | `./<name>` | Custom destination directory for the generated project. |

#### Example Usage

```bash
# Initialize a React 19 mini-app
goat init wallet-app --template=react --typescript

# Initialize a Vue 3.5 mini-app
goat init catalog-app --template=vue

# Initialize a Svelte 5 mini-app
goat init order-tracking --template=svelte
```

---

### 2. `goat dev` — Local Development Server

Spins up a high-performance local development server powered by Vite 6. Supports hot module replacement (HMR), virtual domain origin spoofing, and hermetic mock bridge injection.

```bash
goat dev [--port=3000] [--mock] [--host] [--tunnel] [--server-port=7373]
```

#### Command Options

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--port` | `number` | `3000` | Port for the local Vite dev server. |
| `--mock` | `boolean` | `true` | Injects `@goat/bridge-mock` into `window.GoatBridge` for standalone browser testing of all 185 native bridge actions. |
| `--host` | `boolean` | `false` | Binds server to `0.0.0.0` for LAN access across local Wi-Fi networks. |
| `--tunnel` | `boolean` | `false` | Generates a terminal QR code pairing URL for direct scanning on physical devices. |
| `--server-port` | `number` | `7373` | Port for connecting to the `@goat/server` daemon for live IPC telemetry and CDP inspection. |

#### Example Output

```text
 Starting Goat Dev Server…
   Port        : 3000
   Mock bridge : enabled
   LAN host    : enabled
   QR tunnel   : enabled
   @goat/server: http://localhost:7373

[GoatDev] Vite HMR server listening on http://localhost:3000
[GoatDev] Virtual domain: http://appassets.androidplatform.net:3000
[GoatDev] @goat/bridge-mock injected — all 197 bridge actions mocked
[GoatDev] QR pairing URL: http://192.168.1.100:3000
[GoatDev] Connected to @goat/server on port 7373

[Supported] Dev server ready. Press Ctrl+C to stop.
```

---

### 3. `goat run` — Simulator & Device Streaming

Compiles the host harness and launches the mini-app inside Android or iOS environments with live bundle streaming.

```bash
goat run <android|ios> [--emulator|--simulator|--device] [--qr] [--port=3000]
```

#### Command Options

| Argument / Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `<platform>` | `android \| ios` | *(Required)* | Target OS platform. |
| `--emulator` | `boolean` | `true` (Android) | Targets an active Android Virtual Device (AVD). |
| `--simulator` | `boolean` | `true` (iOS) | Targets an active Apple iOS Simulator. |
| `--device` | `boolean` | `false` | Targets a connected physical device over USB or ADB Wi-Fi. |
| `--qr` | `boolean` | `false` | Prints a high-contrast QR code in the terminal for instant camera pairing. |
| `--port` | `number` | `3000` | Local bundle streaming port. |

#### ADB Reverse Port Forwarding

When targeting Android devices, `goat run` automatically executes:
```bash
adb reverse tcp:3000 tcp:3000
```
This routes all requests to `http://localhost:3000` on the Android device back to your local development machine over USB without requiring open Wi-Fi ports.

---

### 4. `goat build` — Production Packaging & Bytecode Caching

Compiles, tree-shakes, minifies, and packages the mini-app for production deployment. Generates cryptographic SHA-256 integrity digests and ahead-of-time V8 bytecode caches.

```bash
goat build [--prod] [--bytecode] [--split-subpackages] [--out-dir=dist]
```

#### Command Options

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--prod` | `boolean` | `true` | Enables production minification, dead code elimination, and console stripping. |
| `--bytecode` | `boolean` | `false` | Generates pre-compiled V8 Code Caches / JSC bytecode artifacts (`.jsc`) for `<15ms` warm execution. |
| `--split-subpackages`| `boolean` | `false` | Splits subpackages defined in `goat.config.json` into isolated downloadable chunks. |
| `--out-dir` | `string` | `"dist"` | Destination directory for distribution artifacts. |

#### Example Output

```text
 Goat Build — Production
   Mode            : production
   V8 Bytecode     : enabled
   Subpackage split: enabled
   Output dir      : dist

[GoatBuild] TypeScript compilation starting...
[GoatBuild] Vite bundling with tree-shaking...
[GoatBuild] Asset minification complete.
[GoatBuild] Subpackage splitting: pages/home -> pages/profile -> pages/settings
[GoatBuild] V8 bytecode pre-compilation: generating .jsc files...
[GoatBuild] Bytecode headers embedded in bundle.
[GoatBuild] SHA-256 integrity: 8f4e2c91a3b570d4e6f81a29c34e7b89d012e3456789abcdef0123456789abcd
[GoatBuild] Writing integrity manifest to dist/integrity.json

[Supported] Build complete -> dist/
   main.js         32.4 KB (gzip: 10.2 KB)
   main.jsc        28.1 KB (V8 bytecode)
   subpackages/    3 chunks × ~8 KB
   integrity.json  checksums for all 4 artifact(s)
```

---

## Mini-App Manifest (`goat.config.json`)

Every Goat Mini-App is governed by a declarative `goat.config.json` manifest at its root:

```json
{
  "$schema": "https://goat-webview.github.io/schemas/goat.config.json",
  "name": "crypto-wallet",
  "version": "1.4.0",
  "appId": "com.goat.miniapps.wallet",
  "entryPage": "src/main.tsx",
  "window": {
    "title": "Goat Wallet",
    "backgroundColor": "#0B0F19",
    "navigationBarTextStyle": "white",
    "enablePullDownRefresh": false
  },
  "permissions": [
    "LOCATION",
    "BIOMETRICS",
    "CAMERA",
    "STORAGE_ENCRYPTED",
    "NFC"
  ],
  "networkTimeout": {
    "request": 10000,
    "uploadFile": 30000,
    "downloadFile": 30000
  },
  "subpackages": [
    {
      "root": "pages/kyc",
      "pages": ["index", "id-scan", "selfie"]
    },
    {
      "root": "pages/analytics",
      "pages": ["dashboard", "reports"]
    }
  ],
  "bridge": {
    "timeout": 5000,
    "mockMode": false
  }
}
```

### Manifest Configuration Schema

| Key | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | Human-readable mini-app display name. |
| `version` | `string` | Semantic version string (`x.y.z`). |
| `appId` | `string` | Globally unique reverse-DNS identifier (determines storage partitioning). |
| `entryPage` | `string` | Path to the entry source file (e.g. `src/main.tsx` or `src/main.ts`). |
| `window` | `object` | Native window container properties (background color, status bar theme). |
| `permissions` | `string[]` | Array of required native capabilities declared upfront for user consent priming. |
| `subpackages` | `array` | Declarative definitions for on-demand lazy loaded sub-bundles. |
| `bridge.timeout` | `number` | Timeout in milliseconds before bridge IPC calls reject. |

---

## Security Best Practices in CLI

1. **Deterministic Checksums:** Always verify `dist/integrity.json` in your CI/CD deployment pipeline before uploading bundles to the mini-app registry.
2. **Permission Minimization:** Only request permissions in `goat.config.json` that are strictly necessary for the core user experience.
3. **Mock Isolation:** Never ship code with `bridge.mockMode: true` to production. The production `goat build` command automatically strips mock harnesses.
