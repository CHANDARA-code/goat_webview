import { useState, useEffect } from 'react';
import { bridge } from './miniapp-bridge';
import { Header } from './components/common/Header';
import { TabBar } from './components/common/TabBar';
import { EcommerceApp } from './components/ecommerce/EcommerceApp';
import { IotApp } from './components/iot/IotApp';
import { FieldServiceApp } from './components/fieldservice/FieldServiceApp';
import { VaultApp } from './components/vault/VaultApp';
import { DiagnosticsApp } from './components/diagnostics/DiagnosticsApp';
import { AntdShowcase } from './components/antd/AntdShowcase';
import { AntdProvider } from './providers/AntdProvider';
import { BridgeLogEntry } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('ecommerce');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [logs, setLogs] = useState<BridgeLogEntry[]>([]);
  const [fps, setFps] = useState<number>(60);
  const [cartCount] = useState<number>(3);

  // Hash-based routing initialization & listener
  useEffect(() => {
    const parseHashRoute = () => {
      const hash = window.location.hash.toLowerCase().replace(/^#\/?/, '');
      if (hash.startsWith('iot') || hash.startsWith('hardware')) {
        setActiveTab('iot');
      } else if (hash.startsWith('fieldservice') || hash.startsWith('gps') || hash.startsWith('field')) {
        setActiveTab('fieldservice');
      } else if (hash.startsWith('vault') || hash.startsWith('security')) {
        setActiveTab('vault');
      } else if (hash.startsWith('diagnostics') || hash.startsWith('debug') || hash.startsWith('hud')) {
        setActiveTab('diagnostics');
      } else if (hash.startsWith('ui') || hash.startsWith('antd') || hash.startsWith('kit')) {
        setActiveTab('ui');
      } else if (hash.startsWith('ecommerce') || hash.startsWith('store') || hash.startsWith('shop') || hash === '') {
        setActiveTab('ecommerce');
      }
    };

    parseHashRoute();
    window.addEventListener('hashchange', parseHashRoute);

    // Subscribe to bridge debug logs
    const unsubscribeLogs = bridge.onLog((entry) => {
      setLogs((prev) => [...prev.slice(-49), entry]);
    });

    // FPS loop
    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;

    const calculateFps = (now: number) => {
      frameCount++;
      if (now - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(calculateFps);
    };

    animId = requestAnimationFrame(calculateFps);

    // Sync theme background and status bar on startup
    bridge.syncThemeBackground(true).catch(() => {});

    return () => {
      window.removeEventListener('hashchange', parseHashRoute);
      unsubscribeLogs();
      cancelAnimationFrame(animId);
    };
  }, []);

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    window.location.hash = `#/${tabId}`;
  };

  const handleToggleTheme = async () => {
    const nextTheme = !isDarkMode;
    setIsDarkMode(nextTheme);
    try {
      await bridge.setStatusBarTheme(nextTheme);
      await bridge.syncThemeBackground(nextTheme);
    } catch {
      // ignore
    }
  };

  const handleNavigateBack = async () => {
    try {
      const history = await bridge.canGoBack();
      if (history.canGoBack) {
        await bridge.handleBackPress();
      } else {
        await bridge.navigateBack();
      }
    } catch {
      // fallback
    }
  };

  const renderActiveMiniApp = () => {
    switch (activeTab) {
      case 'ecommerce':
        return <EcommerceApp />;
      case 'iot':
        return <IotApp />;
      case 'fieldservice':
        return <FieldServiceApp />;
      case 'vault':
        return <VaultApp />;
      case 'ui':
        return <AntdShowcase />;
      case 'diagnostics':
      default:
        return <DiagnosticsApp logs={logs} fps={fps} />;
    }
  };

  return (
    <AntdProvider isDarkMode={isDarkMode}>
      <div className={`min-h-screen ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} flex flex-col selection:bg-emerald-500 selection:text-slate-950`}>
        {/* Universal Mini-App Header */}
        <Header
          activeTab={activeTab}
          isDarkMode={isDarkMode}
          onToggleTheme={handleToggleTheme}
          onNavigateBack={handleNavigateBack}
          fps={fps}
        />

        {/* Main Mini-App Viewport */}
        <main className="flex-1 w-full max-w-4xl mx-auto">
          {renderActiveMiniApp()}
        </main>

        {/* Unified Mini-App Switcher Tab Bar */}
        <TabBar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          cartCount={activeTab === 'ecommerce' ? cartCount : undefined}
        />
      </div>
    </AntdProvider>
  );
}
