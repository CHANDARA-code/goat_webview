import { DEFAULT_PLAYGROUND_CODE } from '../../context/SimulatorContext';

export interface PlaygroundTemplate {
  id: string;
  label: string;
  description: string;
  code: string;
}

export const PLAYGROUND_TEMPLATES: PlaygroundTemplate[] = [
  {
    id: 'hello-bridge',
    label: 'Hello Bridge (Core APIs)',
    description: 'Get device information, GPS location, tenant storage, and tactile haptic feedback.',
    code: DEFAULT_PLAYGROUND_CODE,
  },
  {
    id: 'bottom-sheet-cart',
    label: 'Native Bottom Sheet & Cart',
    description: 'Control native container sheets with snap points and interactive tabs.',
    code: `<!DOCTYPE html>
<html>
  <head>
    <style>
      body { font-family: -apple-system, sans-serif; padding: 16px; color: #F4F3EE; }
      button { padding: 10px 14px; margin-right: 8px; margin-bottom: 8px; border-radius: 8px; border: none; background: #C15F3C; color: #fff; font-weight: 600; cursor: pointer; }
      .card { background: #26241F; padding: 12px; border-radius: 8px; margin-bottom: 12px; }
    </style>
  </head>
  <body>
    <h3>Shopping Cart Demo</h3>
    <div class="card">
      <p>Drive the <strong>native platform bottom sheet</strong> rendered around this iframe container.</p>
      <button id="open">Open Bottom Sheet</button>
      <button id="close">Close Sheet</button>
    </div>
    <script>
      document.getElementById('open').addEventListener('click', async () => {
        await goatBridge.callNative('EXPAND_BOTTOM_SHEET', { height: 380, snapIndex: 1 });
        await goatBridge.callNative('HAPTIC_FEEDBACK', { type: 'medium' });
      });
      document.getElementById('close').addEventListener('click', async () => {
        await goatBridge.callNative('COLLAPSE_BOTTOM_SHEET', {});
      });
    </script>
  </body>
</html>
`,
  },
  {
    id: 'biometric-checkout',
    label: 'Biometric Payment Authorization',
    description: 'Hardware FaceID / TouchID biometric verification with hostile lockout simulation.',
    code: `<!DOCTYPE html>
<html>
  <head>
    <style>
      body { font-family: -apple-system, sans-serif; padding: 16px; color: #F4F3EE; }
      button { padding: 10px 14px; border-radius: 8px; border: none; background: #C15F3C; color: #fff; font-weight: 600; cursor: pointer; }
      #out { margin-top: 12px; font-weight: 700; padding: 10px; background: #26241F; border-radius: 6px; }
    </style>
  </head>
  <body>
    <h3>Payment Authorization</h3>
    <p>Total Invoice: <strong>$49.99 USD</strong></p>
    <button id="pay">Authorize with Biometrics</button>
    <div id="out">Status: Waiting for user action…</div>
    <script>
      document.getElementById('pay').addEventListener('click', async () => {
        const out = document.getElementById('out');
        out.textContent = 'Authenticating with hardware enclave…';
        try {
          const result = await goatBridge.callNative('BIOMETRIC_AUTH', {
            reason: 'Authorize $49.99 transaction for Goat Pro',
          });
          out.textContent = result.authenticated
            ? 'Success: Authorized via ' + result.biometryType + ' (Token: ' + (result.token || 'verified').slice(0, 16) + '…)'
            : 'Rejected: ' + (result.reason || 'User cancelled');
        } catch (err) {
          console.error('Biometric failure:', err);
          out.textContent = 'Error [' + (err.code || 'AUTH_FAIL') + ']: ' + err.message;
        }
      });
    </script>
  </body>
</html>
`,
  },
  {
    id: 'tenant-storage',
    label: 'Multi-Tenant & Secure Storage',
    description: 'Isolated key-value storage and hardware Keystore/Keychain secrets.',
    code: `<!DOCTYPE html>
<html>
  <head>
    <style>
      body { font-family: -apple-system, sans-serif; padding: 16px; color: #F4F3EE; }
      button { padding: 8px 12px; border-radius: 6px; border: none; background: #C15F3C; color: #fff; font-weight: 600; cursor: pointer; margin-right: 6px; margin-bottom: 6px; }
      pre { background: #1A1917; padding: 10px; border-radius: 8px; font-size: 11px; max-height: 220px; overflow-y: auto; }
    </style>
  </head>
  <body>
    <h3>Storage Isolation Demo</h3>
    <div>
      <button id="set-std">Set Standard Key</button>
      <button id="set-sec">Set Secure Key</button>
      <button id="read-all">Read All</button>
    </div>
    <pre id="out">Click a button to write to tenant sandbox…</pre>
    <script>
      const out = document.getElementById('out');
      document.getElementById('set-std').addEventListener('click', async () => {
        await goatBridge.callNative('STORAGE_SET', { key: 'user.prefs', value: { theme: 'dark', v: 2 } });
        console.log('Saved standard storage key: user.prefs');
        out.textContent = 'Saved user.prefs to standard sandbox.';
      });
      document.getElementById('set-sec').addEventListener('click', async () => {
        await goatBridge.callNative('SECURE_STORAGE_SET', { key: 'jwt.token', value: 'sec_vault_' + Date.now() });
        console.log('Saved encrypted secret to Keystore/Keychain.');
        out.textContent = 'Saved jwt.token to encrypted Keystore partition.';
      });
      document.getElementById('read-all').addEventListener('click', async () => {
        const std = await goatBridge.callNative('STORAGE_GET', { key: 'user.prefs' });
        const sec = await goatBridge.callNative('SECURE_STORAGE_GET', { key: 'jwt.token' });
        out.textContent = 'Standard: ' + JSON.stringify(std) + '\\nSecure: ' + JSON.stringify(sec);
      });
    </script>
  </body>
</html>
`,
  },
  {
    id: 'hostile-conditions',
    label: 'Hostile Conditions & Chaos Resilience',
    description: 'Test resilience against offline network, permissions denial, and synthetic intermittent chaos.',
    code: `<!DOCTYPE html>
<html>
  <head>
    <style>
      body { font-family: -apple-system, sans-serif; padding: 16px; color: #F4F3EE; }
      button { padding: 10px 14px; border-radius: 8px; border: none; background: #B3492F; color: #fff; font-weight: 600; cursor: pointer; margin-right: 8px; margin-bottom: 8px; }
      pre { background: #1A1917; padding: 10px; border-radius: 8px; font-size: 11px; max-height: 240px; overflow-y: auto; }
    </style>
  </head>
  <body>
    <h3>Hostile Conditions Resilience</h3>
    <p>Toggle Offline mode or Chaos Injection in the <strong>Hardware Rail</strong>, then test:</p>
    <button id="test-req">API Request (Network)</button>
    <button id="test-loc">Location (Permission)</button>
    <pre id="out">Ready to test fault tolerance…</pre>
    <script>
      const out = document.getElementById('out');
      document.getElementById('test-req').addEventListener('click', async () => {
        try {
          out.textContent = 'Executing API_REQUEST…';
          const res = await goatBridge.callNative('API_REQUEST', { url: 'https://api.goat.dev/catalog', method: 'GET' });
          console.log('API Request Success', res);
          out.textContent = 'Success: ' + JSON.stringify(res, null, 2);
        } catch (err) {
          console.error('API Request Failed:', err.code, err.message);
          out.textContent = 'Caught Exception:\\nCode: ' + err.code + '\\nMessage: ' + err.message;
        }
      });

      document.getElementById('test-loc').addEventListener('click', async () => {
        try {
          out.textContent = 'Requesting GPS…';
          const loc = await goatBridge.callNative('GET_LOCATION', {});
          console.log('Location success:', loc);
          out.textContent = 'Location: ' + JSON.stringify(loc, null, 2);
        } catch (err) {
          console.error('Location Failed:', err.code, err.message);
          out.textContent = 'Caught Permission Error:\\nCode: ' + err.code + '\\nMessage: ' + err.message;
        }
      });
    </script>
  </body>
</html>
`,
  },
  {
    id: 'react-mini-app',
    label: 'React 19 Mini-App',
    description: 'JSX compiled in the browser, with hooks calling the native bridge. No build step.',
    code: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <script src="https://unpkg.com/@babel/standalone@7.26.4/babel.min.js"></script>
    <script type="importmap">
      {
        "imports": {
          "react": "https://esm.sh/react@19.0.0",
          "react-dom/client": "https://esm.sh/react-dom@19.0.0/client"
        }
      }
    </script>
    <style>
      body { font-family: -apple-system, sans-serif; padding: 16px; margin: 0; color: #F4F3EE; background: #1A1917; }
      button { padding: 10px 14px; border-radius: 8px; border: none; background: #C15F3C; color: #fff; font-weight: 600; cursor: pointer; margin-right: 8px; margin-bottom: 8px; }
      pre { background: #26241F; padding: 10px; border-radius: 8px; font-size: 11px; white-space: pre-wrap; overflow-x: auto; }
      h3 { margin: 0 0 12px 0; font-size: 16px; }
    </style>
  </head>
  <body>
    <div id="root">Loading React…</div>

    <script type="text/babel" data-type="module">
      import React, { useState } from 'react';
      import { createRoot } from 'react-dom/client';

      function App() {
        const [output, setOutput] = useState('Tap a button to call the native bridge…');

        const call = async (action, payload = {}) => {
          setOutput('Calling ' + action + '…');
          try {
            const result = await window.goatBridge.callNative(action, payload);
            setOutput(action + ':\\n' + JSON.stringify(result, null, 2));
          } catch (err) {
            setOutput(action + ' failed:\\n' + err.code + ' — ' + err.message);
          }
        };

        return (
          <div>
            <h3>React {React.version} Mini-App</h3>
            <button onClick={() => call('GET_DEVICE_INFO')}>Device Info</button>
            <button onClick={() => call('GET_LOCATION')}>Location</button>
            <button onClick={() => call('HAPTIC_FEEDBACK', { style: 'medium' })}>Haptic</button>
            <pre>{output}</pre>
          </div>
        );
      }

      createRoot(document.getElementById('root')).render(<App />);
    </script>
  </body>
</html>
`,
  },
  {
    id: 'vue-mini-app',
    label: 'Vue 3 Mini-App',
    description: 'Vue 3 composition API with reactive bridge state, loaded straight from a CDN.',
    code: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <script src="https://unpkg.com/vue@3.5.13/dist/vue.global.prod.js"></script>
    <style>
      body { font-family: -apple-system, sans-serif; padding: 16px; margin: 0; color: #F4F3EE; background: #1A1917; }
      button { padding: 10px 14px; border-radius: 8px; border: none; background: #C15F3C; color: #fff; font-weight: 600; cursor: pointer; margin-right: 8px; margin-bottom: 8px; }
      pre { background: #26241F; padding: 10px; border-radius: 8px; font-size: 11px; white-space: pre-wrap; overflow-x: auto; }
      h3 { margin: 0 0 12px 0; font-size: 16px; }
    </style>
  </head>
  <body>
    <div id="app">
      <h3>Vue {{ version }} Mini-App</h3>
      <button @click="call('GET_DEVICE_INFO')">Device Info</button>
      <button @click="call('STORAGE_SET', { key: 'cart', value: '2 items' })">Save Storage</button>
      <button @click="call('STORAGE_GET', { key: 'cart' })">Read Storage</button>
      <pre>{{ output }}</pre>
    </div>

    <script>
      const { createApp, ref } = Vue;

      createApp({
        setup() {
          const output = ref('Tap a button to call the native bridge…');
          const version = Vue.version;

          const call = async (action, payload = {}) => {
            output.value = 'Calling ' + action + '…';
            try {
              const result = await window.goatBridge.callNative(action, payload);
              output.value = action + ':\\n' + JSON.stringify(result, null, 2);
            } catch (err) {
              output.value = action + ' failed:\\n' + err.code + ' — ' + err.message;
            }
          };

          return { output, version, call };
        },
      }).mount('#app');
    </script>
  </body>
</html>
`,
  },
];
