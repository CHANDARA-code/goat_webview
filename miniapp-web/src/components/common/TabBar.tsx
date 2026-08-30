import React from 'react';
import { ShoppingBag, Cpu, Navigation2, ShieldCheck, TerminalSquare } from 'lucide-react';
import { bridge } from '../../miniapp-bridge';

export interface TabBarProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  cartCount?: number;
}

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onSelectTab, cartCount = 0 }) => {
  const tabs = [
    {
      id: 'ecommerce',
      label: 'Store',
      appId: 'com.goat.ecommerce',
      icon: ShoppingBag,
      badge: cartCount > 0 ? cartCount : undefined,
      activeColor: 'text-emerald-400',
      activeBg: 'bg-emerald-500/10 border-emerald-500/30'
    },
    {
      id: 'iot',
      label: 'IoT Hub',
      appId: 'com.goat.iot',
      icon: Cpu,
      activeColor: 'text-cyan-400',
      activeBg: 'bg-cyan-500/10 border-cyan-500/30'
    },
    {
      id: 'fieldservice',
      label: 'Field GPS',
      appId: 'com.goat.fieldservice',
      icon: Navigation2,
      activeColor: 'text-amber-400',
      activeBg: 'bg-amber-500/10 border-amber-500/30'
    },
    {
      id: 'vault',
      label: 'Vault',
      appId: 'com.goat.vault',
      icon: ShieldCheck,
      activeColor: 'text-purple-400',
      activeBg: 'bg-purple-500/10 border-purple-500/30'
    },
    {
      id: 'diagnostics',
      label: 'Debug',
      appId: 'com.goat.diagnostics',
      icon: TerminalSquare,
      activeColor: 'text-sky-400',
      activeBg: 'bg-sky-500/10 border-sky-500/30'
    }
  ];

  const handleTabClick = async (tabId: string) => {
    try {
      await bridge.triggerSelection();
    } catch {
      // ignore
    }
    onSelectTab(tabId);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/90 backdrop-blur-2xl border-t border-white/10 px-2 py-1.5 transition-all">
      <div className="max-w-md mx-auto grid grid-cols-5 gap-1 items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all touch-press ${
                isActive
                  ? `${tab.activeBg} border ${tab.activeColor} shadow-lg shadow-black/40`
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {tab.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2.5 bg-emerald-500 text-slate-950 text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center animate-bounce">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] font-medium tracking-tight mt-0.5 ${isActive ? 'font-bold' : ''}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
