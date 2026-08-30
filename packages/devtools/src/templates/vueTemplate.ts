/**
 * @goat/devtools - Vue 3 Mini-App Project Template
 */

import type { ProjectTemplate } from '../types/ide.ts';

export const VUE_TEMPLATE: ProjectTemplate = {
  id: 'vue',
  name: 'Vue 3 Mini-App',
  description: 'Composition API mini-app template with <script setup> and reactive GoatBridge state.',
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
        appName: 'Vue 3 Mini-App',
        version: '1.0.0',
        versionCode: 1,
        entryPage: 'src/main.ts',
        window: {
          title: 'Vue 3 Goat Demo',
          backgroundColor: '#121212',
          navigationBarTextStyle: 'white',
          navigationBarBackgroundColor: '#1f1f1f',
          orientation: 'portrait',
          enablePullDownRefresh: true,
          transparentBackground: false,
        },
        permissions: ['LOCATION', 'HAPTICS', 'CAMERA', 'STORAGE'],
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
        name: 'Vue 3 Mini-App',
        version: '1.0.0',
        appId: 'com.goat.demo.vue',
        entryPage: 'src/main.ts',
        framework: 'vue',
        window: {
          title: 'Vue 3 Goat Demo',
          backgroundColor: '#121212',
        },
        permissions: ['LOCATION', 'HAPTICS', 'CAMERA', 'STORAGE'],
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
    <title>Vue 3 Mini-App</title>
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
      <div class="badge">Vue 3 Engine</div>
      <h1>Goat Vue Mini-App</h1>
      <p>Seamless composition bridge integration</p>
    </header>

    <main class="content">
      <div class="card">
        <h3>Sensor Status</h3>
        <p class="status-text">{{ statusText }}</p>
      </div>

      <div class="actions">
        <button class="btn btn-primary" @click="triggerToast">
          Show Native Toast
        </button>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const statusText = ref('Connecting to GoatBridge...');

onMounted(async () => {
  if (typeof window !== 'undefined' && (window as any).GoatBridge) {
    try {
      const info = await (window as any).GoatBridge.call('GET_DEVICE_INFO');
      statusText.value = \`Connected: \${info.model || 'Simulator'}\`;
    } catch (e) {
      statusText.value = 'Simulator Ready';
    }
  }
});

async function triggerToast() {
  if (typeof window !== 'undefined' && (window as any).GoatBridge) {
    await (window as any).GoatBridge.call('SHOW_TOAST', { title: 'Vue 3 Triggered!', icon: 'success' });
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
.btn {
  padding: 10px 16px;
  background: #10b981;
  color: #022c22;
  border-radius: 8px;
  border: none;
  font-weight: bold;
  cursor: pointer;
}
</style>`,

    'src/style.css': `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}`,
  },
};
