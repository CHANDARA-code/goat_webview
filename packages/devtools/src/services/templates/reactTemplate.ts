/**
 * @goat/devtools - React 19 Mini-App Project Template
 */

import type { ProjectTemplate } from '../../types/workspace.ts';

export const REACT_TEMPLATE: ProjectTemplate = {
  id: 'react-19',
  name: 'React 19 Mini-App',
  description: 'Dual-Thread mini-app template powered by React 19, TypeScript, Tailwind CSS, and GoatBridge hooks.',
  framework: 'react',
  version: '19.0.0',
  icon: 'Atom',
  entryFile: 'src/App.tsx',
  dependencies: {
    react: '^19.0.0',
    'react-dom': '^19.0.0',
    'lucide-react': '^0.475.0',
  },
  files: {
    'manifest.json': JSON.stringify(
      {
        appId: 'com.goat.demo.react',
        appName: 'React 19 Mini-App',
        version: '1.0.0',
        versionCode: 1,
        entryPage: 'src/main.tsx',
        window: {
          title: 'React 19 Goat Demo',
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
        name: 'React 19 Mini-App',
        version: '1.0.0',
        appId: 'com.goat.demo.react',
        entryPage: 'src/main.tsx',
        window: {
          title: 'React 19 Goat Demo',
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
    <title>React 19 Mini-App</title>
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
import { useGoatBridge } from './hooks/useGoatBridge';
import { useSafeArea } from './hooks/useSafeArea';

export default function App() {
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [location, setLocation] = useState<any>(null);
  const [hapticCount, setHapticCount] = useState(0);
  const [bioResult, setBioResult] = useState<string | null>(null);

  const { callBridge, loading } = useGoatBridge();
  const safeArea = useSafeArea();

  useEffect(() => {
    async function loadInfo() {
      const info = await callBridge('GET_DEVICE_INFO');
      setDeviceInfo(info);
    }
    loadInfo();
  }, []);

  const handleHaptic = async () => {
    await callBridge('HAPTIC_FEEDBACK', { type: 'impact', style: 'heavy' });
    setHapticCount((prev) => prev + 1);
  };

  const handleGetLocation = async () => {
    const loc = await callBridge('GET_LOCATION', { isHighAccuracy: true });
    setLocation(loc);
  };

  const handleBiometricAuth = async () => {
    try {
      const res = await callBridge('BIOMETRIC_AUTH', { reason: 'Authorize Goat Superpowers' });
      setBioResult(res.success ? '✅ Authenticated' : '❌ Failed');
    } catch (e: any) {
      setBioResult(\`⚠️ Error: \${e.message}\`);
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-950 text-white flex flex-col p-4"
      style={{
        paddingTop: \`max(16px, \${safeArea.top}px)\`,
        paddingBottom: \`max(16px, \${safeArea.bottom}px)\`,
      }}
    >
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Goat Mini-App
          </h1>
          <p className="text-xs text-slate-400">React 19 Dual-Thread Runtime</p>
        </div>
        <span className="px-2 py-1 text-xs bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-full">
          Live Studio
        </span>
      </header>

      {/* Device Info Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
          📱 Device Telemetry
        </h2>
        {deviceInfo ? (
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
            <div>Model: <span className="text-slate-200 font-mono">{deviceInfo.model || 'Unknown'}</span></div>
            <div>Platform: <span className="text-slate-200 font-mono">{deviceInfo.platform || 'Simulator'}</span></div>
            <div>Battery: <span className="text-emerald-400 font-mono">{deviceInfo.batteryLevel ?? 100}%</span></div>
            <div>Screen: <span className="text-slate-200 font-mono">{deviceInfo.screenWidthDp}x{deviceInfo.screenHeightDp}</span></div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Querying GoatBridge...</p>
        )}
      </div>

      {/* Interactive Actions */}
      <div className="space-y-3 flex-1">
        <button
          onClick={handleHaptic}
          className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-sm font-medium transition shadow flex items-center justify-between"
        >
          <span>Trigger Haptic Feedback</span>
          <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">{hapticCount} hits</span>
        </button>

        <button
          onClick={handleGetLocation}
          className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-between"
        >
          <span>Request High-Accuracy GPS</span>
          <span className="text-xs text-slate-400">🛰️</span>
        </button>

        {location && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 text-xs font-mono text-emerald-400">
            Lat: {location.latitude?.toFixed(5)}, Lng: {location.longitude?.toFixed(5)}
          </div>
        )}

        <button
          onClick={handleBiometricAuth}
          className="w-full py-3 px-4 bg-purple-600/30 hover:bg-purple-600/40 border border-purple-500/40 text-purple-200 rounded-lg text-sm font-medium transition flex items-center justify-between"
        >
          <span>Prompt Biometric Authentication</span>
          <span className="text-xs">🔒</span>
        </button>

        {bioResult && (
          <div className="bg-purple-950/40 border border-purple-800/40 rounded-lg p-3 text-xs text-center text-purple-300">
            {bioResult}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-auto pt-4 text-center text-xs text-slate-600">
        Powered by Goat Engine v1.0 • 203 Native Actions
      </footer>
    </div>
  );
}`,

    'src/hooks/useGoatBridge.ts': `import { useState, useCallback } from 'react';

export function useGoatBridge() {
  const [loading, setLoading] = useState(false);

  const callBridge = useCallback(async (action: string, payload?: any) => {
    setLoading(true);
    try {
      if (typeof window !== 'undefined' && (window as any).GoatBridge) {
        return await (window as any).GoatBridge.call(action, payload);
      }
      console.warn(\`[useGoatBridge] GoatBridge not mounted in global window, simulated action: \${action}\`);
      return { success: true, simulated: true };
    } finally {
      setLoading(false);
    }
  }, []);

  return { callBridge, loading };
}`,

    'src/hooks/useSafeArea.ts': `import { useState, useEffect } from 'react';

export function useSafeArea() {
  const [safeArea, setSafeArea] = useState({ top: 48, bottom: 34, left: 0, right: 0 });

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).GoatBridge) {
      (window as any).GoatBridge.call('GET_SAFE_AREA_INSETS')
        .then((insets: any) => {
          if (insets) setSafeArea(insets);
        })
        .catch(() => {});
    }
  }, []);

  return safeArea;
}`,

    'src/index.css': `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --safe-top: env(safe-area-inset-top, 48px);
  --safe-bottom: env(safe-area-inset-bottom, 34px);
}`,
  },
};
