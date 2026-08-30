/**
 * @goat/devtools - Vue 3.5 Mini-App Project Template
 */

import type { ProjectTemplate } from '../../types/workspace.ts';

export const VUE_TEMPLATE: ProjectTemplate = {
  id: 'vue-3.5',
  name: 'Vue 3.5 Mini-App',
  description: 'Composition API mini-app template with <script setup lang="ts"> and reactive GoatBridge state.',
  framework: 'vue',
  version: '3.5.0',
  icon: 'Layers',
  entryFile: 'src/App.vue',
  dependencies: {
    vue: '^3.5.0',
  },
  files: {
    'manifest.json': JSON.stringify(
      {
        appId: 'com.goat.demo.vue',
        appName: 'Vue 3.5 Mini-App',
        version: '1.0.0',
        versionCode: 1,
        entryPage: 'src/main.ts',
        window: {
          title: 'Vue 3.5 Goat Demo',
          backgroundColor: '#121212',
          navigationBarTextStyle: 'white',
          navigationBarBackgroundColor: '#1f1f1f',
          orientation: 'portrait',
          enablePullDownRefresh: true,
          transparentBackground: false,
        },
        permissions: ['LOCATION', 'HAPTICS', 'CAMERA'],
        bridge: {
          timeout: 5000,
          mockMode: true,
        },
      },
      null,
      2
    ),

    'goat.config.json': JSON.stringify(
      {
        name: 'Vue 3.5 Mini-App',
        version: '1.0.0',
        appId: 'com.goat.demo.vue',
        entryPage: 'src/main.ts',
        window: {
          title: 'Vue 3.5 Goat Demo',
          backgroundColor: '#121212',
        },
        permissions: ['LOCATION', 'HAPTICS', 'CAMERA'],
        bridge: {
          timeout: 5000,
          mockMode: true,
        },
      },
      null,
      2
    ),

    'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <title>Vue 3.5 Mini-App</title>
  </head>
  <body class="bg-zinc-950 text-zinc-100 antialiased overflow-x-hidden">
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>`,

    'src/main.ts': `import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

createApp(App).mount('#app');`,

    'src/App.vue': `<template>
  <div class="min-app-container">
    <header class="app-header">
      <div class="badge">Vue 3.5 Engine</div>
      <h1>Goat Vue Mini-App</h1>
      <p>Seamless composition bridge integration</p>
    </header>

    <main class="content">
      <div class="card">
        <h3>📊 Sensor Status</h3>
        <p class="status-text">{{ statusText }}</p>
      </div>

      <div class="actions">
        <button class="btn btn-primary" @click="triggerToast">
          Show Native Toast
        </button>

        <button class="btn btn-secondary" @click="scanQrCode">
          Scan QR Code
        </button>

        <div v-if="scanResult" class="result-box">
          Scanned: <code>{{ scanResult }}</code>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useBridge } from './composables/useBridge';

const statusText = ref('Connecting to GoatBridge...');
const scanResult = ref('');
const { call } = useBridge();

onMounted(async () => {
  try {
    const info = await call('GET_DEVICE_INFO');
    statusText.value = \`Connected: \${info.model || 'Simulator'} (\${info.platform || 'Web'})\`;
  } catch (e) {
    statusText.value = 'Simulator Ready';
  }
});

async function triggerToast() {
  await call('SHOW_TOAST', { title: 'Vue 3.5 Triggered!', icon: 'success' });
}

async function scanQrCode() {
  try {
    const res = await call('SCAN_CODE');
    scanResult.value = res.result || 'Mock QR: https://goat-engine.dev';
  } catch (e: any) {
    scanResult.value = 'Scan cancelled';
  }
}
</script>

<style scoped>
.min-app-container {
  padding: 20px;
  min-height: 100vh;
  background: #09090b;
  color: #f4f4f5;
  font-family: system-ui, sans-serif;
}
.app-header {
  margin-bottom: 24px;
}
.badge {
  display: inline-block;
  font-size: 11px;
  background: #059669;
  color: #fff;
  padding: 2px 8px;
  border-radius: 9999px;
  margin-bottom: 8px;
}
.card {
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.btn {
  padding: 12px 16px;
  border-radius: 8px;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}
.btn-primary {
  background: #10b981;
  color: #022c22;
}
.btn-secondary {
  background: #27272a;
  color: #f4f4f5;
}
.result-box {
  background: #14532d;
  color: #86efac;
  padding: 12px;
  border-radius: 8px;
  font-size: 12px;
}
</style>`,

    'src/composables/useBridge.ts': `export function useBridge() {
  const call = async (action: string, payload?: any) => {
    if (typeof window !== 'undefined' && (window as any).GoatBridge) {
      return await (window as any).GoatBridge.call(action, payload);
    }
    return { success: true, simulated: true };
  };

  return { call };
}`,

    'src/style.css': `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}`,
  },
};
