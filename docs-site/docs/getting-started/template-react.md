---
sidebar_position: 3
title: React 19 Template Guide
---

# React 19 Template Guide

The **Goat React 19 Template** provides a robust, high-performance foundation for authoring mini-apps with modern React 19, strict TypeScript, Vite 6, and full `@goat/sdk` native bridge integration.

---

## Quick Scaffolding

Scaffold a React 19 project using `@goat/cli`:

```bash
goat init my-react-miniapp --template=react --typescript
cd my-react-miniapp
npm install
goat dev
```

---

## Project Structure

```text
my-react-miniapp/
├── goat.config.json       # Mini-app manifest and bridge configuration
├── index.html             # HTML entry point with viewport meta tags
├── package.json           # React 19, @goat/sdk, Vite 6 dependencies
├── tsconfig.json          # Strict TypeScript configuration (react-jsx)
├── vite.config.ts         # Vite 6 ESM build configuration with React plugin
├── public/                # Static assets (icons, images)
└── src/
    ├── main.tsx           # React 19 createRoot entry
    ├── App.tsx            # Root component with bridge providers
    ├── hooks/
    │   ├── useGoatBridge.ts   # Typed IPC bridge action hook
    │   ├── useSafeArea.ts     # Dynamic notch & keyboard insets hook
    │   └── useStorage.ts      # Sandboxed hardware storage hook
    └── components/
        ├── Header.tsx         # Mini-app top app bar with safe area padding
        └── BiometricAuth.tsx  # FaceID / TouchID biometric prompt component
```

---

## Core Architecture & Setup

### 1. Application Entry Point (`src/main.tsx`)

React 19 uses `createRoot` for concurrent rendering:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root container not found');

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

### 2. Custom Hooks for Native Bridge

#### `useGoatBridge` — Typed IPC Dispatcher

```typescript
import { useState, useCallback } from 'react';
import { MiniAppBridge } from '@goat/sdk';

const bridge = new MiniAppBridge();

export function useGoatBridge() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(async <T = any>(action: string, payload: Record<string, any> = {}): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      const result = await bridge.callNative<T>(action, payload);
      return result;
    } catch (err: any) {
      const msg = err.message || 'Bridge execution failed';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { call, loading, error };
}
```

#### `useSafeArea` — Hardware Insets & Dynamic Keyboard Tracking

```typescript
import { useState, useEffect } from 'react';
import { MiniAppBridge } from '@goat/sdk';

export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
  keyboardHeight: number;
}

export function useSafeArea(): Insets {
  const [insets, setInsets] = useState<Insets>({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    keyboardHeight: 0,
  });

  useEffect(() => {
    const bridge = new MiniAppBridge();

    // Query initial insets
    bridge.callNative<Insets>('GET_SAFE_AREA_INSETS', {}).then((initial) => {
      setInsets(initial);
      updateCssVariables(initial);
    });

    // Listen for hardware orientation or software keyboard changes
    const unsubscribe = bridge.onEvent('ON_INSETS_CHANGE', (event: Insets) => {
      setInsets(event);
      updateCssVariables(event);
    });

    return () => unsubscribe();
  }, []);

  return insets;
}

function updateCssVariables(insets: Insets) {
  document.documentElement.style.setProperty('--safe-top', `${insets.top}px`);
  document.documentElement.style.setProperty('--safe-bottom', `${insets.bottom}px`);
  document.documentElement.style.setProperty('--keyboard-height', `${insets.keyboardHeight}px`);
}
```

---

### 3. Example Component: Biometric Checkout (`src/components/BiometricAuth.tsx`)

```tsx
import React, { useState } from 'react';
import { useGoatBridge } from '../hooks/useGoatBridge';

export function BiometricAuth() {
  const { call, loading } = useGoatBridge();
  const [authStatus, setAuthStatus] = useState<'idle' | 'success' | 'failed'>('idle');

  const handleAuthenticate = async () => {
    try {
      const response = await call<{ authenticated: boolean }>('BIOMETRIC_AUTHENTICATE', {
        reason: 'Authorize payment of $49.99',
        fallbackTitle: 'Enter Passcode',
      });

      if (response.authenticated) {
        setAuthStatus('success');
        // Trigger subtle success haptics
        await call('HAPTIC_FEEDBACK', { type: 'NOTIFICATION_SUCCESS' });
      } else {
        setAuthStatus('failed');
      }
    } catch {
      setAuthStatus('failed');
      await call('HAPTIC_FEEDBACK', { type: 'NOTIFICATION_ERROR' });
    }
  };

  return (
    <div className="card">
      <h3>Secure Biometric Checkout</h3>
      <p>Status: <strong>{authStatus.toUpperCase()}</strong></p>
      <button onClick={handleAuthenticate} disabled={loading} className="btn-primary">
        {loading ? 'Verifying...' : 'Authenticate with FaceID / TouchID'}
      </button>
    </div>
  );
}
```

---

## React 19 Performance Best Practices for 120 FPS

1. **Avoid Layout Thrashing on Scroll:**
   Do not read `window.scrollY` in React state. Use CSS `position: sticky` and hardware-composited transforms (`transform: translate3d(0, 0, 0)`).
2. **Fast Tap Responsiveness:**
   Ensure CSS contains `touch-action: manipulation;` on interactive buttons to prevent mobile browser 300ms double-tap zoom delays.
3. **React Transitions:**
   Wrap non-urgent UI updates in React 19's `startTransition` to keep the native touch response thread at 120Hz:
   ```tsx
   import { startTransition } from 'react';
   
   function handleSearch(query: string) {
     startTransition(() => {
       setFilteredProducts(filterItems(query));
     });
   }
   ```
4. **Sandboxed Local Storage:**
   Always use `@goat/sdk` hardware storage (`STORAGE_SET` / `STORAGE_GET`) rather than standard DOM `localStorage` when storing sensitive authentication tokens, as it is encrypted using hardware security keys (Android KeyStore / Apple Keychain).
