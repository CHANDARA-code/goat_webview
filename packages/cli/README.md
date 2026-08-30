# @goat/cli

> The official Command Line Interface for Goat Mini-App development, bundling, device execution, and debugging.

`@goat/cli` provides end-to-end developer workflows for building high-performance mini-apps running on the Goat WebView ecosystem across Android, iOS, Flutter, React Native, and Web environments.

---

## Installation

```bash
# Global installation
npm install -g @goat/cli

# Or run on-demand with npx
npx @goat/cli <command> [options]
```

---

## Commands Overview

| Command | Description |
|---|---|
| `goat init <name>` | Scaffold a new mini-app project (React, Vue, Svelte) |
| `goat dev` | Start local Vite HMR development server with mock bridge injection |
| `goat studio` | Launch browser-based DevTools Studio IDE with dual-thread simulator |
| `goat run <android\|ios>` | Build & stream to emulator, simulator, or real device with QR pairing |
| `goat build` | Production bundle with V8 bytecode compilation & SHA-256 checksums |
| `goat doctor` | Automated health check for Node, Bun, JDK, Android SDK & Xcode |

---

## Command Reference

### 1. `goat init <name>`

Scaffold a new mini-app workspace with pre-configured project templates, TypeScript types, and `@goat/sdk` integration.

```bash
goat init my-app [options]
```

**Options:**
- `--template=<react|vue|svelte>` (default: `react`): Target frontend framework.
- `--typescript` (default: `true`): Enable TypeScript configuration (`tsconfig.json`).
- `--out-dir=<path>`: Custom destination directory (defaults to `./<name>`).

**Generated Structure:**
```
my-app/
├── goat.config.json    # Mini-app manifest (appId, window config, permissions)
├── index.html          # HTML entry point
├── src/
│   ├── main.tsx        # Application root mount
│   └── App.tsx         # Root component with MiniAppBridge integration
├── vite.config.ts      # Vite dev server and Rollup packaging config
├── tsconfig.json       # TypeScript compiler settings
└── package.json        # Dependencies including @goat/sdk
```

---

### 2. `goat dev`

Start the local development server with Hot Module Replacement (HMR), virtual domain mapping, and bridge mock emulation.

```bash
goat dev [options]
```

**Options:**
- `--port=<port>` (default: `3000`): Local HTTP development server port.
- `--mock` (default: `true`): Inject `@goat/bridge-mock` into the webview runtime (mocks all 185+ bridge APIs).
- `--host` (default: `false`): Expose server on local network (`0.0.0.0`).
- `--tunnel` (default: `false`): Generate a LAN QR pairing URL for wireless device testing.
- `--server-port=<port>` (default: `7373`): `@goat/server` CDP relay port.

---

### 3. `goat studio`

Launch the browser-based DevTools Studio IDE featuring dual-thread AppService/AppView simulation, Monaco code editor, sensor control panel, and CDP telemetry.

```bash
goat studio [options]
```

**Options:**
- `--port=<port>` (default: `5173`): Port to host the Studio IDE interface.
- `--server-port=<port>` (default: `7373`): Port of the `@goat/server` CDP relay service.
- `--project=<path>`, `-p <path>` (default: `.`): Path to the mini-app project root.
- `--open` / `--no-open` (default: `true`): Automatically open default web browser.
- `--host` (default: `false`): Listen on `0.0.0.0` for remote team debugging.

---

### 4. `goat run <android|ios>`

Compile native application shell and stream live mini-app bundles to emulators, simulators, or physical devices.

```bash
goat run <android|ios> [options]
```

**Options:**
- `--emulator` (default: `true` for Android): Target booted Android Virtual Device (AVD).
- `--simulator` (default: `true` for iOS): Target booted iOS Simulator (e.g., iPhone 16 Pro).
- `--device`: Target connected physical USB/TCP device.
- `--qr`: Display ASCII QR code in terminal for wireless pairing.
- `--port=<port>` (default: `3000`): Asset streaming port.

---

### 5. `goat build`

Package the mini-app into a verified production release with tree-shaking, asset minification, optional V8 bytecode pre-compilation, and subpackage chunking.

```bash
goat build [options]
```

**Options:**
- `--prod` (default: `true`): Enable production optimizations and minification.
- `--bytecode` (default: `false`): Pre-compile JavaScript into V8 bytecode (`.jsc`) for instant startup.
- `--split-subpackages` (default: `false`): Split pages into independent subpackage chunks.
- `--out-dir=<path>` (default: `dist`): Output destination folder.

**Output Artifacts:**
- `dist/main.js`: Minified bundle.
- `dist/main.jsc`: (Optional) Pre-compiled V8 bytecode binary.
- `dist/subpackages/`: (Optional) Dynamic subpackage modules.
- `dist/integrity.json`: Cryptographic SHA-256 manifest for OTA verification.

---

### 6. `goat doctor`

Run comprehensive diagnostic checks on host dependencies, SDK paths, and mobile toolchains.

```bash
goat doctor [options]
```

**Options:**
- `--verbose`: Show detailed fix hints and remediation instructions.
- `--fix`: Attempt automated resolution of common configuration issues.

**Diagnostic Checks:**
- Node.js (≥ 20.0.0)
- Bun runtime (optional fast compiler)
- Java Development Kit (JDK ≥ 17)
- Android SDK (`ANDROID_HOME` & `adb`)
- Xcode Command Line Tools (`xcodebuild` & `xcrun simctl` on macOS)

---

## Configuration (`goat.config.json`)

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "appId": "com.example.myapp",
  "entryPage": "src/main.tsx",
  "window": {
    "title": "My Mini App",
    "backgroundColor": "#FFFFFF"
  },
  "permissions": [
    "scope.userLocation",
    "scope.camera"
  ],
  "bridge": {
    "timeout": 5000,
    "mockMode": false
  }
}
```

---

## License

MIT © 2026 Goat Engine Authors & Contributors
