/**
 * @goat/devtools - Vanilla JS Mini-App Project Template
 */

import type { ProjectTemplate } from '../../types/workspace.ts';

export const VANILLA_TEMPLATE: ProjectTemplate = {
  id: 'vanilla-js',
  name: 'Vanilla JS Mini-App',
  description: 'Zero-dependency pure ES2024 mini-app template with instant <5ms boot and direct GoatBridge calls.',
  framework: 'vanilla',
  version: '1.0.0',
  icon: 'Code2',
  entryFile: 'src/main.js',
  files: {
    'manifest.json': JSON.stringify(
      {
        appId: 'com.goat.demo.vanilla',
        appName: 'Vanilla JS Mini-App',
        version: '1.0.0',
        versionCode: 1,
        entryPage: 'src/main.js',
        window: {
          title: 'Vanilla JS Demo',
          backgroundColor: '#000000',
          navigationBarTextStyle: 'white',
          navigationBarBackgroundColor: '#111111',
          orientation: 'portrait',
          enablePullDownRefresh: false,
          transparentBackground: false,
        },
        permissions: ['HAPTICS', 'STORAGE'],
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
        name: 'Vanilla JS Mini-App',
        version: '1.0.0',
        appId: 'com.goat.demo.vanilla',
        entryPage: 'src/main.js',
        window: {
          title: 'Vanilla JS Demo',
          backgroundColor: '#000000',
        },
        permissions: ['HAPTICS', 'STORAGE'],
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
    <title>Vanilla JS Mini-App</title>
    <link rel="stylesheet" href="/src/style.css" />
  </head>
  <body>
    <div class="shell">
      <header>
        <span class="badge">Zero Dependency</span>
        <h1>Vanilla Mini-App</h1>
        <p>Direct low-latency bridge invocation</p>
      </header>

      <section class="card">
        <h3>Storage Demo</h3>
        <div class="input-row">
          <input type="text" id="storageInput" placeholder="Enter key value..." />
          <button id="saveBtn">Save</button>
        </div>
        <p id="storageStatus" class="muted">Ready</p>
      </section>

      <section class="card">
        <button id="hapticBtn" class="primary-btn">Trigger Haptic</button>
      </section>

      <div id="logArea" class="log-terminal"></div>
    </div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>`,

    'src/main.js': `// Vanilla JS Entry Point
const logArea = document.getElementById('logArea');
const storageInput = document.getElementById('storageInput');
const saveBtn = document.getElementById('saveBtn');
const hapticBtn = document.getElementById('hapticBtn');
const storageStatus = document.getElementById('storageStatus');

function log(msg) {
  const line = document.createElement('div');
  line.textContent = \`[\${new Date().toLocaleTimeString()}] \${msg}\`;
  logArea.prepend(line);
}

log('Vanilla Mini-App Booted in <5ms');

if (window.GoatBridge) {
  window.GoatBridge.call('GET_DEVICE_INFO').then((info) => {
    log(\`Device: \${info.model || 'Simulator'} (\${info.platform || 'Web'})\`);
  });
}

saveBtn.addEventListener('click', async () => {
  const val = storageInput.value;
  if (!val) return;

  if (window.GoatBridge) {
    await window.GoatBridge.call('STORAGE_SET', { key: 'demo_key', value: val });
    storageStatus.textContent = \`Stored: "\${val}"\`;
    log(\`STORAGE_SET -> \${val}\`);
  }
});

hapticBtn.addEventListener('click', async () => {
  if (window.GoatBridge) {
    await window.GoatBridge.call('HAPTIC_FEEDBACK', { type: 'selection' });
    log('Haptic feedback triggered');
  }
});
`,

    'src/style.css': `body {
  margin: 0;
  padding: 16px;
  background-color: #09090b;
  color: #fafafa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  user-select: none;
}
.shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.badge {
  display: inline-block;
  background: #27272a;
  color: #a1a1aa;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 9999px;
  margin-bottom: 8px;
}
.card {
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.input-row {
  display: flex;
  gap: 8px;
}
input {
  flex: 1;
  background: #09090b;
  border: 1px solid #3f3f46;
  color: #fff;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
}
button {
  background: #27272a;
  color: #fff;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
}
.primary-btn {
  background: #2563eb;
  padding: 12px;
  border-radius: 8px;
}
.log-terminal {
  background: #000;
  border: 1px solid #27272a;
  border-radius: 8px;
  padding: 10px;
  font-family: monospace;
  font-size: 11px;
  color: #22c55e;
  height: 120px;
  overflow-y: auto;
}
.muted {
  font-size: 12px;
  color: #71717a;
}`,
  },
};
