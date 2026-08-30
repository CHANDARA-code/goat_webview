/**
 * @goat/devtools - React 18 / 19 Mini-App Project Template
 */

import type { ProjectTemplate } from '../types/ide.ts';

export const REACT_TEMPLATE: ProjectTemplate = {
  id: 'react',
  name: 'React 18 Mini-App',
  description: 'Dual-Thread mini-app template powered by React, TypeScript, Tailwind CSS, and GoatBridge hooks.',
  framework: 'react',
  version: '18.3.1',
  icon: 'Atom',
  entryFile: 'src/App.tsx',
  dependencies: {
    react: '^18.3.1',
    'react-dom': '^18.3.1',
    'lucide-react': '^0.475.0',
  },
  files: {
    'manifest.json': JSON.stringify(
      {
        appId: 'com.goat.demo.react',
        appName: 'React Mini-App',
        version: '1.0.0',
        versionCode: 1,
        entryPage: 'src/main.tsx',
        window: {
          title: 'React Goat Demo',
          backgroundColor: '#0f172a',
          navigationBarTextStyle: 'white',
          navigationBarBackgroundColor: '#1e293b',
          orientation: 'portrait',
          enablePullDownRefresh: true,
          transparentBackground: false,
        },
        permissions: ['LOCATION', 'HAPTICS', 'BIOMETRIC', 'STORAGE'],
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
        name: 'React Mini-App',
        version: '1.0.0',
        appId: 'com.goat.demo.react',
        entryPage: 'src/main.tsx',
        framework: 'react',
        window: {
          title: 'React Goat Demo',
          backgroundColor: '#0f172a',
        },
        permissions: ['LOCATION', 'HAPTICS', 'BIOMETRIC', 'STORAGE'],
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
    <title>React Mini-App</title>
  </head>
  <body class="bg-slate-900 text-slate-100 antialiased overflow-x-hidden">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,

    'src/main.tsx': `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}`,

    'src/App.tsx': `import React, { useState, useEffect } from 'react';

export default function App() {
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).GoatBridge) {
      (window as any).GoatBridge.call('GET_DEVICE_INFO', {}).then((info: any) => {
        setDeviceInfo(info);
      });
    }
  }, []);

  const handleHaptic = async () => {
    if (typeof window !== 'undefined' && (window as any).GoatBridge) {
      await (window as any).GoatBridge.call('HAPTIC_FEEDBACK', { type: 'medium' });
    }
    setCount((c) => c + 1);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 flex flex-col">
      <header className="mb-4">
        <h1 className="text-xl font-bold text-blue-400">Goat React Mini-App</h1>
        <p className="text-xs text-slate-400">Dual-thread AppService / AppView architecture</p>
      </header>

      <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 mb-3 text-xs">
        <div className="font-semibold text-slate-300 mb-1">Device Info:</div>
        <div>Model: {deviceInfo?.model || 'Simulator'}</div>
        <div>Platform: {deviceInfo?.platform || 'Web'}</div>
      </div>

      <button
        onClick={handleHaptic}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium text-xs shadow"
      >
        Haptic Click (Count: {count})
      </button>
    </div>
  );
}`,

    'src/index.css': `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}`,
  },
};
