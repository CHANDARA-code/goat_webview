# @goat/server

> Tooling Backend Service, Chrome DevTools Protocol (CDP) Relay, Drizzle SQLite Trace Store, OTA Gateway & QR Pairing Daemon for Goat WebView.

`@goat/server` serves as the central control plane and debugging hub for the entire Goat Mini-App ecosystem. It bridges native mobile runtimes, browser devtools, web playgrounds, and CLI workflows into a unified telemetry pipeline.

---

## Features

- **CDP Relay Gateway**: Implements standard Chrome DevTools Protocol endpoints (`/json/version`, `/json/list`, `/json/new`) and bi-directional WebSocket proxies (`/devtools/page/:id`).
- **Safari WebKit Inspector Proxy**: Intercepts iOS Safari WebKit protocol packets and normalizes them into CDP format.
- **Trace Persistence Store**: High-throughput bridge invocation logging backed by Drizzle ORM and SQLite (with `:memory:` or persistent file storage).
- **OTA Server & Governance Dashboard**: Mini-app bundle hosting, semantic version resolution, rollback policies, and web-based release management.
- **Wireless QR Code Pairing**: Zero-configuration LAN pairing tunnel enabling real iOS and Android devices to stream logs and receive live bundles.
- **Standalone Binary Compilation**: Self-contained single-binary compilation via Bun (`bun build --compile`) for lightweight zero-dependency deployment on macOS and Linux.

---

## Architecture

```
┌───────────────────────────────┐     ┌───────────────────────────────┐
│     Native Mobile Devices     │     │      DevTools Studio IDE      │
│   (Android, iOS, Simulator)   │     │      & Browser Clients        │
└───────────────┬───────────────┘     └───────────────┬───────────────┘
                │                                     │
                │  CDP / Tunnel WS (Port 9222 / 3001) │
                ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            @goat/server                             │
│                                                                     │
│  ┌────────────────────────┐  ┌───────────────────────────────────┐  │
│  │   CDP Target Manager   │  │   Pairing & Reverse Tunnel Hub    │  │
│  │   & Multi-Page Relay   │  │   (QR Code & LAN Discovery)       │  │
│  └───────────┬────────────┘  └─────────────────┬─────────────────┘  │
│              │                                 │                    │
│              ▼                                 ▼                    │
│  ┌────────────────────────┐  ┌───────────────────────────────────┐  │
│  │ Drizzle SQLite Store   │  │   OTA Engine & Manifest Server    │  │
│  │ (Traces, APM, Metrics) │  │   (Integrity Checksums, Rollback) │  │
│  └────────────────────────┘  └───────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## CLI Usage

Run `@goat/server` directly from source or via the standalone native binary:

```bash
# Direct execution via npx / node
goat-server [options]

# Or standalone native binary
./dist/goat-server [options]
```

### CLI Options

| Flag | Default | Description |
|---|---|---|
| `-p, --port <number>` | `3001` | REST API, OTA server, and tunnel port |
| `-c, --cdp-port <number>` | `9222` | Chrome DevTools Protocol (CDP) discovery port |
| `-s, --safari-port <number>` | `9223` | Safari WebKit inspector proxy port |
| `-H, --host <host>` | `0.0.0.0` | Server bind host address |
| `-d, --db-path <path>` | `./data/goat_telemetry.db` | SQLite database file location |
| `--in-memory` | `false` | Use in-memory SQLite storage (ideal for testing) |
| `--mock` / `--no-mock` | `true` | Enable or disable mock bridge injection |

---

## API Endpoints

### 1. CDP Discovery & Debugging
- `GET /json/version`: DevTools protocol version and browser metadata.
- `GET /json/list`: Enumerates all active webview targets and worker instances.
- `GET /json/protocol`: JSON schema of supported CDP methods and events.
- `WS /devtools/page/:targetId`: Bi-directional JSON-RPC 2.0 debugging socket.

### 2. Trace Telemetry & APM
- `GET /api/traces`: Query historical bridge calls with filtering by action, status, and appId.
- `POST /api/traces`: Ingest telemetry samples from client bridge runtimes.
- `DELETE /api/traces`: Clear stored traces.

### 3. Pairing & Tunnel
- `POST /api/pair/init`: Initialize a new device pairing session and receive QR pairing data.
- `GET /api/pair/:sessionId/status`: Polling endpoint for pairing completion.
- `WS /tunnel/:sessionId`: WebSocket tunnel for streaming bundles to paired devices.

### 4. Over-The-Air (OTA) & Release Management
- `GET /api/v1/ota/check`: Check for available mini-app bundle updates by `appId` and `version`.
- `POST /api/v1/ota/publish`: Upload and publish a signed mini-app bundle release.
- `GET /admin/ota`: Interactive web dashboard for OTA rollouts and rollback controls.

### 5. Health & Diagnostics
- `GET /api/health`: Comprehensive system health report including active targets, pairing status, and memory metrics.

---

## Bun Native Compilation

Compile `@goat/server` into a self-contained executable binary:

```bash
# Compile standalone executable
npm run build:binary

# Execute compiled binary
./dist/goat-server --port 3001 --in-memory
```

---

## Development & Testing

```bash
# Compile TypeScript to dist/
npm run build

# Run unit and integration tests (Vitest)
npm test

# Run tests in watch mode
npm run test:watch
```

---

## License

MIT © 2026 Goat Engine Authors & Contributors
