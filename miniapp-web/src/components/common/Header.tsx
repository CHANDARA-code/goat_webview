import React from 'react';
import { Sparkles, Cpu, Navigation2, Lock, Terminal, Moon, Sun, ArrowLeft } from 'lucide-react';
import { bridge } from '../../miniapp-bridge';

interface HeaderProps {
  activeTab: string;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onNavigateBack?: () => void;
  fps?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  isDarkMode,
  onToggleTheme,
  onNavigateBack,
  fps = 60
}) => {
  const getTabMeta = () => {
    switch (activeTab) {
      case 'ecommerce':
        return {
          title: 'E-Commerce & Store',
          appId: 'com.goat.ecommerce',
          badge: 'Apple / Google Pay & Multi-Rail',
          icon: <Sparkles className="w-4 h-4 text-emerald-400" />,
          accent: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-300'
        };
      case 'iot':
        return {
          title: 'IoT & Hardware Hub',
          appId: 'com.goat.iot',
          badge: 'BLE GATT & 3D Motion',
          icon: <Cpu className="w-4 h-4 text-cyan-400" />,
          accent: 'from-cyan-500/20 to-blue-500/10 border-cyan-500/30 text-cyan-300'
        };
      case 'fieldservice':
        return {
          title: 'Field Service Dispatch',
          appId: 'com.goat.fieldservice',
          badge: 'GPS Geofencing & Audio',
          icon: <Navigation2 className="w-4 h-4 text-amber-400" />,
          accent: 'from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-300'
        };
      case 'vault':
        return {
          title: 'Biometric Vault',
          appId: 'com.goat.vault',
          badge: 'FaceID / TouchID & AES-256',
          icon: <Lock className="w-4 h-4 text-purple-400" />,
          accent: 'from-purple-500/20 to-pink-500/10 border-purple-500/30 text-purple-300'
        };
      case 'diagnostics':
      default:
        return {
          title: 'Bridge Diagnostics',
          appId: 'com.goat.diagnostics',
          badge: '18 Domains • 197 Actions',
          icon: <Terminal className="w-4 h-4 text-sky-400" />,
          accent: 'from-sky-500/20 to-indigo-500/10 border-sky-500/30 text-sky-300'
        };
    }
  };

  const meta = getTabMeta();

  const handleBack = async () => {
    try {
      await bridge.triggerImpact('light');
      if (onNavigateBack) {
        onNavigateBack();
      } else {
        await bridge.navigateBack();
      }
    } catch {
      // ignore
    }
  };

  return (
    <header className="sticky top-0 z-30 px-4 py-3 backdrop-blur-xl border-b border-white/10 bg-slate-950/80 transition-colors">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleBack}
            className="p-2 rounded-xl bg-slate-900/80 border border-white/10 text-slate-300 hover:text-white active:scale-95 transition-all"
            title="Navigate Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-base tracking-tight flex items-center gap-1.5">
                {meta.icon}
                {meta.title}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium border bg-gradient-to-r ${meta.accent}`}>
                {meta.appId}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans tracking-wide">
              {meta.badge}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* FPS & Health badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-white/10 text-[11px] font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            {fps} FPS
          </div>

          {/* Theme toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-xl bg-slate-900/80 border border-white/10 text-slate-300 hover:text-white active:scale-95 transition-all"
            title="Toggle Dark/Light Mode"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-sky-300" />}
          </button>
        </div>
      </div>
    </header>
  );
};
