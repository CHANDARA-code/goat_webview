import React from 'react';
import {
  Play,
  RotateCcw,
  Layers,
  QrCode,
  Smartphone,
  Sliders,
  Terminal,
  Package,
} from 'lucide-react';
import { useDevToolsStore } from '../../store/index.ts';
import { ThemeToggle } from './ThemeToggle.tsx';

export const HeaderBar: React.FC = () => {
  const {
    activeTemplateId,
    setTemplateModalOpen,
    restartSimulator,
    isRunning,
    startSimulator,
    stopSimulator,
    setActiveSidebarView,
    activeSidebarView,
  } = useDevToolsStore();

  return (
    <header className="h-12 bg-[#1e1e1e] dark:bg-[#1e1e1e] light:bg-[#f3f3f3] border-b border-[#3c3c3c] dark:border-[#3c3c3c] light:border-[#e5e5e5] flex items-center justify-between px-4 select-none z-20">
      {/* Brand & Project Info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white text-base shadow-sm">
            🐐
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-white dark:text-white light:text-gray-900 flex items-center gap-1.5">
              Goat Studio <span className="text-[10px] font-mono px-1.5 py-0.2 bg-blue-500/20 text-blue-400 rounded">v1.0</span>
            </span>
          </div>
        </div>

        <div className="h-4 w-px bg-gray-700/50 mx-1" />

        {/* Template Selector Button */}
        <button
          onClick={() => setTemplateModalOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-[#2d2d2d] dark:bg-[#2d2d2d] light:bg-white border border-[#3c3c3c] dark:border-[#3c3c3c] light:border-gray-300 rounded-md hover:border-blue-500 text-gray-200 dark:text-gray-200 light:text-gray-800 transition shadow-sm"
          title="Switch Mini-App Template"
        >
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-medium">{activeTemplateId || 'react-19'}</span>
        </button>
      </div>

      {/* Center Action Controls */}
      <div className="flex items-center gap-1.5 bg-[#252526] dark:bg-[#252526] light:bg-gray-200 p-1 rounded-lg border border-[#3c3c3c] dark:border-[#3c3c3c] light:border-gray-300 shadow-inner">
        <button
          onClick={() => (isRunning ? stopSimulator() : startSimulator())}
          className={`flex items-center gap-1 px-3 py-1 text-xs rounded-md font-medium transition ${
            isRunning
              ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
          title={isRunning ? 'Simulator Running' : 'Start Simulator'}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isRunning ? 'Running' : 'Start'}</span>
        </button>

        <button
          onClick={restartSimulator}
          className="p-1 text-gray-400 hover:text-white light:hover:text-gray-900 hover:bg-white/10 rounded-md transition"
          title="Reload Mini-App Bundle"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Navigation Quick Switches */}
        <div className="flex items-center gap-1 bg-[#252526] dark:bg-[#252526] light:bg-gray-200 p-1 rounded-md">
          <button
            onClick={() => setActiveSidebarView('simulator')}
            className={`p-1.5 rounded transition ${
              activeSidebarView === 'simulator'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white light:hover:text-gray-900'
            }`}
            title="Simulator Controls"
          >
            <Smartphone className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveSidebarView('sensors')}
            className={`p-1.5 rounded transition ${
              activeSidebarView === 'sensors'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white light:hover:text-gray-900'
            }`}
            title="Hardware & Sensor Suite"
          >
            <Sliders className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveSidebarView('debugger')}
            className={`p-1.5 rounded transition ${
              activeSidebarView === 'debugger'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white light:hover:text-gray-900'
            }`}
            title="Debugger & Waterfall"
          >
            <Terminal className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveSidebarView('packaging')}
            className={`p-1.5 rounded transition ${
              activeSidebarView === 'packaging'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white light:hover:text-gray-900'
            }`}
            title="Packaging & Bytecode"
          >
            <Package className="w-4 h-4" />
          </button>
        </div>

        {/* QR Pairing Trigger */}
        <button
          onClick={() => setActiveSidebarView('packaging')}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-md font-medium transition shadow-sm"
          title="Pair Physical Device"
        >
          <QrCode className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Pair Device</span>
        </button>

        {/* Dark/Light Theme Toggle */}
        <ThemeToggle />
      </div>
    </header>
  );
};
