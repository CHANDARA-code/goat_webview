---
sidebar_position: 4
title: Vue 3.5 Template Guide
---

# Vue 3.5 Template Guide

The **Goat Vue 3.5 Template** provides an ultra-fast, reactive framework for developing mini-apps utilizing Vue 3.5's Composition API, `<script setup>`, Pinia global state management, and `@goat/sdk` native bridge bindings.

---

## Quick Scaffolding

Scaffold a new Vue 3.5 mini-app with `@goat/cli`:

```bash
goat init my-vue-miniapp --template=vue --typescript
cd my-vue-miniapp
npm install
goat dev
```

---

## Project Structure

```text
my-vue-miniapp/
├── goat.config.json       # Mini-app manifest and permissions
├── index.html             # HTML entry point
├── package.json           # Vue 3.5, @goat/sdk, Vite 6, Pinia
├── tsconfig.json          # TypeScript strict configuration
├── vite.config.ts         # Vite 6 config with @vitejs/plugin-vue
└── src/
    ├── main.ts            # Vue app creation & Pinia mount
    ├── App.vue            # Root shell with safe area layout
    ├── composables/
    │   ├── useBridge.ts   # Reactive bridge invoker composable
    │   └── useSafeArea.ts # Dynamic safe area & keyboard insets
    ├── stores/
    │   └── userStore.ts   # Pinia store syncing with native SecureStorage
    └── components/
        ├── AppHeader.vue  # Safe area aware navigation header
        └── ScanQR.vue     # Native camera QR barcode scanner
```

---

## Composables & Native Bridge Setup

### 1. Application Entry (`src/main.ts`)

```typescript
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './style.css';

const app = createApp(App);
app.use(createPinia());
app.mount('#root');
```

---

### 2. Composable: `useBridge.ts`

```typescript
import { ref } from 'vue';
import { MiniAppBridge } from '@goat/sdk';

const bridge = new MiniAppBridge();

export function useBridge() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function callNative<T = any>(action: string, payload: Record<string, any> = {}): Promise<T> {
    loading.value = true;
    error.value = null;
    try {
      const res = await bridge.callNative<T>(action, payload);
      return res;
    } catch (err: any) {
      error.value = err.message || 'Native bridge call failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    callNative,
    loading,
    error,
  };
}
```

---

### 3. Composable: `useSafeArea.ts`

```typescript
import { reactive, onMounted, onUnmounted } from 'vue';
import { MiniAppBridge } from '@goat/sdk';

export interface InsetsState {
  top: number;
  bottom: number;
  left: number;
  right: number;
  keyboardHeight: number;
}

export function useSafeArea() {
  const insets = reactive<InsetsState>({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    keyboardHeight: 0,
  });

  let unsubscribe: (() => void) | null = null;

  onMounted(async () => {
    const bridge = new MiniAppBridge();
    const initial = await bridge.callNative<InsetsState>('GET_SAFE_AREA_INSETS', {});
    Object.assign(insets, initial);
    applyCssVariables(insets);

    unsubscribe = bridge.onEvent('ON_INSETS_CHANGE', (data: InsetsState) => {
      Object.assign(insets, data);
      applyCssVariables(insets);
    });
  });

  onUnmounted(() => {
    if (unsubscribe) unsubscribe();
  });

  return { insets };
}

function applyCssVariables(insets: InsetsState) {
  document.documentElement.style.setProperty('--safe-top', `${insets.top}px`);
  document.documentElement.style.setProperty('--safe-bottom', `${insets.bottom}px`);
  document.documentElement.style.setProperty('--keyboard-height', `${insets.keyboardHeight}px`);
}
```

---

### 4. Example Component: Native QR Code Scanner (`src/components/ScanQR.vue`)

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useBridge } from '../composables/useBridge';

const { callNative, loading, error } = useBridge();
const scannedData = ref<string | null>(null);

async function startScan() {
  try {
    const result = await callNative<{ text: string; format: string }>('SCAN_BARCODE', {
      prompt: 'Align QR Code within the frame',
      formats: ['QR_CODE', 'EAN_13'],
    });

    scannedData.value = result.text;
    await callNative('HAPTIC_FEEDBACK', { type: 'NOTIFICATION_SUCCESS' });
  } catch (e) {
    console.error('Scan failed or dismissed', e);
  }
}
</script>

<template>
  <div class="scan-container">
    <h2>Native QR Scanner</h2>
    <button :disabled="loading" class="scan-btn" @click="startScan">
      {{ loading ? 'Opening Camera...' : 'Scan QR Code' }}
    </button>

    <div v-if="scannedData" class="result-box">
      <p>Decoded Payload:</p>
      <code>{{ scannedData }}</code>
    </div>

    <p v-if="error" class="error-text">{{ error }}</p>
  </div>
</template>

<style scoped>
.scan-container {
  padding: 1rem;
  background: var(--bg-card, #1e293b);
  border-radius: 12px;
}
.scan-btn {
  background: #3b82f6;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: none;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
}
.result-box {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #0f172a;
  border-radius: 6px;
}
</style>
```

---

## Vue 3.5 Best Practices in Mini-Apps

1. **Leverage Vue 3.5 Reactive Props Destructure:**
   Vue 3.5 introduces reactive prop destructuring without losing reactivity:
   ```typescript
   const { title, threshold = 100 } = defineProps<{ title: string; threshold?: number }>();
   ```
2. **Keep Stores Sandboxed:**
   When persisting auth tokens in Pinia, use a plugin that synchronizes with `@goat/sdk`'s `STORAGE_ENCRYPTED` domain rather than `localStorage`.
3. **Use CSS Custom Properties for Safe Insets:**
   Avoid calculating padding in JavaScript templates. Set CSS properties `--safe-top` and `--safe-bottom` globally and reference them:
   ```css
   .header {
     padding-top: max(16px, var(--safe-top));
   }
   ```
