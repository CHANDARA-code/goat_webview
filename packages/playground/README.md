# @goat/playground

> Interactive Web Playground for Goat Mini-App Developers — Expo Snack-style interactive development sandbox with live native bridge simulation and telemetry.

`@goat/playground` delivers a zero-setup, web-based playground for writing, prototyping, and testing Goat mini-app code directly in the browser.

---

## Features

- **Monaco Code Editor**: Full-featured code editor with JavaScript/TypeScript syntax highlighting, inline execution, and console output.
- **Simulated Device Frame**: Pixel-accurate iOS and Android viewport frames with notch, status bar, and gesture navigation.
- **Interactive Component Showcase**: Click-to-test cards exercising device info, toasts, modals, storage, location, and biometrics.
- **Real-Time Bridge Inspector**: Live stream of all bridge invocations with payload inspection, return values, status badges, and round-trip latency measurements.
- **Hardware Sensor & State Panel**:
  - **Platform Toggle**: Switch between iOS WebKit and Android WebViewCompat bridge behaviors.
  - **Theme Toggle**: Switch between Light and Dark mode system themes.
  - **Biometrics Simulator**: Toggle between `success`, `fail`, and `locked` states.
  - **Network Profiler**: Emulate WiFi, 4G, 3G, and complete offline network conditions.
  - **Battery Emulation**: Dynamic battery percentage slider with charging states.
  - **GPS Spoofer**: Real-time Latitude, Longitude, and Accuracy (meters) overrides.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               @goat/playground                                  │
├───────────────────────┬───────────────────────────────┬─────────────────────────┤
│    Monaco Editor      │      Device Simulator         │    Telemetry & Controls │
│                       │                               │                         │
│  - Live JS execution  │  - iOS / Android Frame        │  - Bridge Inspector     │
│  - Async bridge runner│  - Component Showcase         │    • Trace stream       │
│  - Output console     │  - Real-time DOM renderer     │    • Payload / Response │
│                       │  - Sandboxed execution        │    • Latency meter      │
│                       │                               │  - Mock Control Panel   │
│                       │                               │    • GPS, Battery       │
│                       │                               │    • Biometrics, Net    │
└───────────────────────┴───────────────────────────────┴─────────────────────────┘
```

---

## Getting Started

### Local Development

```bash
# Start Vite development server
npm run dev

# Run Vitest test suites
npm test

# Build production bundle
npm run build

# Preview production build
npm run preview
```

---

## Usage in Web Applications

```tsx
import React from 'react';
import { App as PlaygroundApp } from '@goat/playground';

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <PlaygroundApp />
    </div>
  );
}
```

---

## License

MIT © 2026 Goat Engine Authors & Contributors
