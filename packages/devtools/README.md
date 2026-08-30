# @goat/devtools

> Goat Mini-App DevTools Studio IDE — High-performance desktop and browser IDE for mini-app development, dual-thread simulation, hardware emulation, and multi-lane debugging.

`@goat/devtools` delivers a comprehensive, browser-based integrated development environment tailored specifically for the Goat WebView multi-platform runtime. It provides visual DOM inspection, real-time bridge tracing, dual-thread execution isolation, sensor emulation, and package analytics.

---

## Features & Subsystems

### 1. Dual-Thread Simulator (`src/components/simulator/`)
- **AppService Worker Container**: Runs mini-app business logic in an isolated Web Worker thread with zero DOM access.
- **AppView DOM Renderer**: Renders Virtual DOM patches to real DOM elements using frame-aligned batching (`requestAnimationFrame`).
- **Device Skins**: Pixel-perfect device skins for iPhone 16 Pro, iPad Pro, Google Pixel 9, Samsung Galaxy S24, and custom responsive viewports.
- **Frame Rate & Performance Monitor**: Real-time FPS graph and memory consumption overlay.

### 2. Multi-Lane Debugger (`src/components/debugger/`)
- **Elements Inspector**: Live DOM tree exploration, computed CSS styles, and interactive element highlighting.
- **Bridge Waterfall**: Interactive timeline visualization of native bridge calls with latency metrics, payload diffs, and return values.
- **Storage Explorer**: CRUD viewer for mini-app local storage, secure encrypted storage, and sandboxed cookie jars.
- **SQLite Database Viewer**: Query and inspect client-side relational tables with live SQL execution.
- **FileSystem Browser**: Sandboxed directory hierarchy visualizer with file preview and download capabilities.
- **Unified Console**: Filterable multi-level logger capturing console outputs from both AppService Worker and AppView render threads.

### 3. Sensor & Hardware Emulation Suite (`src/components/sensors/`)
- **Geolocation Picker**: Interactive map for setting GPS latitude, longitude, altitude, and simulated speed/heading.
- **Motion Controller**: 3D interactive device orientation controller emulating 3-axis accelerometer and gyroscope sensors.
- **Network Throttle Panel**: Network emulation presets (WiFi, 4G, Fast 3G, Slow 3G, Offline) with configurable latency and packet drop rates.
- **Battery & Brightness Controls**: Real-time battery percentage slider, charging state toggle, and screen brightness emulation.
- **Biometrics Simulator**: Mock FaceID, TouchID, and Android BiometricPrompt authentication responses.
- **BLE & NFC Simulator**: Emulate Bluetooth LE peripheral advertisements, GATT characteristic read/writes, and NFC NDEF tag reads.

### 4. Packaging & Release Tools (`src/components/packaging/`)
- **Subpackage Visualizer**: Interactive bundle composition map showing main package and subpackage chunk sizes.
- **V8 Bytecode Preview**: Inspect generated V8 bytecode offsets, headers, and pre-compilation efficiency.
- **CDP Pairing Modal**: Scan QR codes for live-reloading on physical devices connected via `@goat/server`.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Goat DevTools Studio IDE                                 │
├────────────────────────────┬─────────────────────────────┬───────────────────────────────┤
│    Monaco Editor & Files   │    Dual-Thread Simulator    │      Debugger & Telemetry     │
│                            │                             │                               │
│  - Project tree browser    │  ┌───────────────────────┐  │  - Elements Inspector         │
│  - Multi-tab editor        │  │  AppService (Worker)  │  │  - Bridge Waterfall           │
│  - Hot reload trigger      │  └──────────┬────────────┘  │  - Storage & SQLite Explorer  │
│  - Syntax validation       │             │ IPC Channel   │  - Sandboxed FS Browser       │
│                            │  ┌──────────▼────────────┐  │  - Unified Console            │
│                            │  │  AppView (DOM / rAF)  │  │  - Sensor Control Suite       │
│                            │  └───────────────────────┘  │  - Packaging Analytics        │
└────────────────────────────┴─────────────────────────────┴───────────────────────────────┘
```

---

## Getting Started

### Local Development

```bash
# Start Vite development server
npm run dev

# Run Vitest unit tests
npm test

# Run multi-tier E2E test suites
npm run test:e2e

# Build production bundle into dist/
npm run build

# Preview production build
npm run preview
```

---

## License

MIT © 2026 Goat Engine Authors & Contributors
