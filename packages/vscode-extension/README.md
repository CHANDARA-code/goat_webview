# Goat Mini-App Studio (`vscode-goat`)

The official Visual Studio Code extension for developing, previewing, and debugging **Goat WebView** mini-applications.

## Features

- 📱 **Interactive Device Simulator Panel**: Real-time preview with pixel-accurate mobile device frames (iPhone 16 Pro Dynamic Island, Pixel 9 Pro punch-hole camera), live bridge event streaming, and responsive viewport toggles.
- 🛠️ **Mock Hardware & Native Bridge Controls**: Interactive control panel to simulate battery status, network connectivity (WiFi, 4G, offline), geolocation coordinates, biometrics authentication, haptics, and NFC/Bluetooth beacons.
- ⚡ **IntelliSense & Auto-Completion**: Context-aware autocompletion and hover documentation for all 197 Goat Bridge APIs and native capability permissions.
- 🔍 **Live Manifest Diagnostics**: Instant schema validation, semantic error highlighting, reverse-domain identifier verification, and subpackage structure validation for `manifest.json` and `goat.config.json`.
- 🚀 **One-Click Commands**:
  - `Goat: Create New Mini-App Project` (`goat.init`)
  - `Goat: Start Dev Server with HMR` (`goat.dev`)
  - `Goat: Open Phone Simulator Panel` (`goat.openSimulator`)
  - `Goat: Run on Android (Emulator / Device)` (`goat.runAndroid`)
  - `Goat: Run on iOS (Simulator / Device)` (`goat.runIos`)
  - `Goat: Run Environment Doctor` (`goat.doctor`)
  - `Goat: Open Bridge Trace Inspector` (`goat.openTraces`)

## Installation

Install via the VS Code Extensions panel or via CLI:
```bash
code --install-extension vscode-goat-1.0.0.vsix
```

## Requirements

- VS Code 1.90.0 or higher.
- Node.js 20.0.0 or higher.

## License

MIT License.
