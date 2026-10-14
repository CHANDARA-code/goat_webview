---
sidebar_position: 5
title: Svelte 5 Template Guide
---

# Svelte 5 Template Guide

The **Goat Svelte 5 Template** is the ultra-lightweight, zero-overhead option for mini-apps. Powered by **Svelte 5 Runes** (`$state`, `$derived`, `$effect`), it compiles away framework runtime abstractions to deliver the smallest bundle sizes and instantaneous 120 FPS paint cycles inside Goat WebView.

---

## Quick Scaffolding

Scaffold a Svelte 5 mini-app with `@goat/cli`:

```bash
goat init my-svelte-miniapp --template=svelte --typescript
cd my-svelte-miniapp
npm install
goat dev
```

---

## Project Structure

```text
my-svelte-miniapp/
├── goat.config.json       # Mini-app manifest & capability claims
├── index.html             # HTML entry point
├── package.json           # Svelte 5, Vite 6, TypeScript
├── tsconfig.json          # Strict TypeScript configuration
├── vite.config.ts         # Vite 6 ESM build with @sveltejs/vite-plugin-svelte
└── src/
    ├── main.ts            # Svelte 5 mount entry
    ├── App.svelte         # Root application component
    ├── lib/
    │   ├── bridge.svelte.ts # Svelte 5 reactive Runes bridge store
    │   └── insets.svelte.ts # Hardware safe area insets state
    └── components/
        ├── GeoLocation.svelte # Live GPS tracker using native bridge
        └── HapticsPad.svelte  # Interactive haptic feedback demo
```

---

## Svelte 5 Runes & Native Bridge Integration

### 1. Application Entry (`src/main.ts`)

```typescript
import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

const app = mount(App, {
  target: root,
});

export default app;
```

---

### 2. Reactive Bridge Module using Runes (`src/lib/bridge.svelte.ts`)

```typescript
// mini-apps invoke native actions via the injected window.goatBridge
const bridge = typeof window !== 'undefined' ? (window as any).goatBridge : null;

export class BridgeState {
  loading = $state(false);
  error = $state<string | null>(null);

  async call<T = any>(action: string, payload: Record<string, any> = {}): Promise<T> {
    this.loading = true;
    this.error = null;
    try {
      if (!bridge) throw new Error('Native bridge not available');
      const response = await bridge.callNative(action, payload);
      return response as T;
    } catch (err: any) {
      this.error = err.message || 'IPC call failed';
      throw err;
    } finally {
      this.loading = false;
    }
  }
}

export const nativeBridge = new BridgeState();
```

---

### 3. Dynamic Safe Area Insets (`src/lib/insets.svelte.ts`)

```typescript
export class InsetsTracker {
  top = $state(0);
  bottom = $state(0);
  keyboardHeight = $state(0);

  // Derived rune for total bottom padding
  totalBottomPadding = $derived(Math.max(this.bottom, this.keyboardHeight));

  constructor() {
    const bridge = new MiniAppBridge();

    bridge.callNative<{ top: number; bottom: number; keyboardHeight: number }>(
      'GET_SAFE_AREA_INSETS',
      {}
    ).then((insets) => {
      this.top = insets.top;
      this.bottom = insets.bottom;
      this.keyboardHeight = insets.keyboardHeight;
      this.updateCss();
    });

    bridge.onEvent('ON_INSETS_CHANGE', (insets: any) => {
      this.top = insets.top;
      this.bottom = insets.bottom;
      this.keyboardHeight = insets.keyboardHeight;
      this.updateCss();
    });
  }

  private updateCss() {
    document.documentElement.style.setProperty('--safe-top', `${this.top}px`);
    document.documentElement.style.setProperty('--safe-bottom', `${this.bottom}px`);
  }
}

export const safeArea = new InsetsTracker();
```

---

### 4. Example Component: Real-time GPS Tracker (`src/components/GeoLocation.svelte`)

```svelte
<script lang="ts">
  import { nativeBridge } from '../lib/bridge.svelte';

  interface LocationResult {
    latitude: number;
    longitude: number;
    accuracy: number;
  }

  let location = $state<LocationResult | null>(null);
  let statusText = $derived(
    location 
      ? `Lat: ${location.latitude.toFixed(4)}, Lon: ${location.longitude.toFixed(4)} (±${location.accuracy}m)`
      : 'Location unavailable'
  );

  async function requestLocation() {
    try {
      const coords = await nativeBridge.call<LocationResult>('GET_LOCATION', {
        highAccuracy: true,
        timeoutMs: 10000,
      });
      location = coords;
      await nativeBridge.call('HAPTIC_FEEDBACK', { type: 'NOTIFICATION_SUCCESS' });
    } catch (e) {
      console.error('Failed to get location', e);
    }
  }
</script>

<div class="card">
  <h3> Hardware Geolocation</h3>
  <p class="coords-display">{statusText}</p>

  <button 
    class="btn-fetch" 
    disabled={nativeBridge.loading} 
    onclick={requestLocation}
  >
    {nativeBridge.loading ? 'Acquiring Satellites...' : 'Get Exact Location'}
  </button>
</div>

<style>
  .card {
    background: #1e293b;
    border-radius: 12px;
    padding: 1.25rem;
    color: #f8fafc;
  }
  .coords-display {
    font-family: monospace;
    background: #0f172a;
    padding: 0.5rem;
    border-radius: 6px;
  }
  .btn-fetch {
    background: #10b981;
    color: white;
    padding: 0.6rem 1.2rem;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-weight: 600;
    touch-action: manipulation;
  }
</style>
```

---

## Svelte 5 Advantages in Goat Mini-Apps

1. **Sub-10 KB Baseline JS Bundle:**
   Because Svelte compiles templates directly to imperative DOM operations without a virtual DOM runtime, initial script evaluation takes `<5ms`.
2. **Fine-Grained Runes Reactivity:**
   When a bridge event updates state (e.g. sensor readings or insets), only the exact text node or attribute changes in the DOM—avoiding full component tree re-renders.
3. **Seamless WebAssembly Interop:**
   Svelte 5's minimal memory footprint makes it ideal for pairing with high-throughput WebAssembly modules (e.g., local machine learning models or cryptography engines).
