import React from 'react';
import {
  Play,
  RotateCcw,
  Sun,
  Moon,
  PanelLeft,
  PanelBottom,
  PanelRight,
  FolderGit2,
  QrCode,
  Zap,
  Save,
  Smartphone,
  Layers,
  Code2,
} from 'lucide-react';
import { useDevToolsStore } from '../../store/useDevToolsStore.ts';
import { DeviceSkinType, ViewportScale } from '../../types/index.ts';

export const HeaderToolbar: React.FC = () => {
  const {
    theme,
    toggleTheme,
    isLeftSidebarOpen,
    isBottomDebuggerOpen,
    isRightSimulatorOpen,
    toggleLeftSidebar,
    toggleBottomDebugger,
    toggleRightSimulator,
    activeTemplate,
    activeTemplateId,
    setTemplateModalOpen,
    activeDeviceSkin,
    setActiveDeviceSkin,
    viewportScale,
    setViewportScale,
    orientation,
    toggleOrientation,
    restartSimulator,
    v8BytecodeStats,
    setV8BytecodeStats,
    openTabs,
    markTabDirty,
  } = useDevToolsStore();

  const handleSaveAll = () => {
    if (openTabs) {
      openTabs.forEach((tab: any) => {
        markTabDirty?.(tab.id, false);
      });
    }
  };

  const isBytecodeEnabled = v8BytecodeStats?.enabled ?? false;

  return (
    <header className="h-12 border-b border-ide-border-dark dark:border-ide-border-dark border-ide-border-light bg-ide-panel-dark dark:bg-ide-panel-dark bg-ide-panel-light flex items-center justify-between px-3 text-xs select-none shadow-sm z-20">
      {/* Left: Brand & Template */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 font-bold text-sm tracking-tight text-white dark:text-white text-gray-900">
          <span className="text-xl">🐐</span>
          <span className="bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
            Goat Studio
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50 font-mono">
            IDE v1.0
          </span>
        </div>

        <div className="h-4 w-px bg-gray-600/40" />

        {/* Template Switcher Button */}
        <button
          onClick={() => setTemplateModalOpen(true)}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-gray-800/80 dark:bg-gray-800/80 bg-gray-200 hover:bg-gray-700 dark:hover:bg-gray-700 hover:bg-gray-300 text-gray-200 dark:text-gray-200 text-gray-800 transition-colors border border-gray-700/50"
          title="Switch Project Template"
        >
          <FolderGit2 className="w-3.5 h-3.5 text-blue-400" />
          <span className="capitalize font-medium">{activeTemplate || activeTemplateId || 'vanilla'} Template</span>
        </button>

        {/* Save All */}
        <button
          onClick={handleSaveAll}
          className="p-1.5 rounded hover:bg-gray-700/60 text-gray-400 hover:text-gray-200 transition-colors"
          title="Save All (Cmd+S / Ctrl+S)"
        >
          <Save className="w-4 h-4" />
        </button>
      </div>

      {/* Center: Simulator Controls */}
      <div className="flex items-center space-x-2">
        {/* Run / Restart Mini-App */}
        <button
          onClick={restartSimulator}
          className="flex items-center space-x-1.5 px-3 py-1 rounded bg-green-600 hover:bg-green-500 text-white font-medium shadow-sm transition-all active:scale-95"
          title="Restart Mini-App Simulator"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Hot Reload</span>
        </button>

        {/* Device Skin Quick Select */}
        <div className="flex items-center space-x-1 bg-gray-800/80 dark:bg-gray-800/80 bg-gray-200 px-2 py-1 rounded border border-gray-700/50">
          <Smartphone className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={activeDeviceSkin || 'iphone16pro'}
            onChange={(e) => setActiveDeviceSkin && setActiveDeviceSkin(e.target.value as DeviceSkinType)}
            className="bg-transparent text-gray-200 dark:text-gray-200 text-gray-800 focus:outline-none cursor-pointer"
          >
            <option value="iphone16pro" className="bg-gray-800 text-white">iPhone 16 Pro</option>
            <option value="pixel9pro" className="bg-gray-800 text-white">Pixel 9 Pro</option>
            <option value="ipadpro" className="bg-gray-800 text-white">iPad Pro 11"</option>
            <option value="foldable" className="bg-gray-800 text-white">Foldable Dual-Screen</option>
          </select>
        </div>

        {/* Viewport Scale */}
        <div className="flex items-center space-x-1 bg-gray-800/80 dark:bg-gray-800/80 bg-gray-200 px-2 py-1 rounded border border-gray-700/50">
          <select
            value={viewportScale || 1.0}
            onChange={(e) => setViewportScale && setViewportScale(parseFloat(e.target.value) as ViewportScale)}
            className="bg-transparent text-gray-200 dark:text-gray-200 text-gray-800 focus:outline-none cursor-pointer font-mono"
          >
            <option value={0.5} className="bg-gray-800 text-white">50%</option>
            <option value={0.75} className="bg-gray-800 text-white">75%</option>
            <option value={1.0} className="bg-gray-800 text-white">100%</option>
            <option value={1.25} className="bg-gray-800 text-white">125%</option>
            <option value={1.5} className="bg-gray-800 text-white">150%</option>
          </select>
        </div>

        {/* Orientation Toggle */}
        <button
          onClick={toggleOrientation}
          className={`px-2 py-1 rounded border transition-colors ${
            orientation === 'landscape'
              ? 'bg-blue-600 text-white border-blue-500'
              : 'bg-gray-800/80 text-gray-300 border-gray-700/50 hover:bg-gray-700'
          }`}
          title="Toggle Orientation (Portrait / Landscape)"
        >
          {orientation === 'portrait' ? '📱 Portrait' : '🔄 Landscape'}
        </button>

        {/* V8 Bytecode Toggle */}
        <button
          onClick={() => setV8BytecodeStats && setV8BytecodeStats({ enabled: !isBytecodeEnabled })}
          className={`flex items-center space-x-1 px-2 py-1 rounded border transition-colors ${
            isBytecodeEnabled
              ? 'bg-purple-900/60 text-purple-300 border-purple-600/60'
              : 'bg-gray-800/80 text-gray-400 border-gray-700/50 hover:bg-gray-700'
          }`}
          title="Precompile V8 Bytecode (.jsc)"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Bytecode {isBytecodeEnabled ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* Right: Panel Toggles & Theme */}
      <div className="flex items-center space-x-2">
        {/* Toggle Left Sidebar */}
        <button
          onClick={toggleLeftSidebar}
          className={`p-1.5 rounded transition-colors ${
            isLeftSidebarOpen ? 'bg-blue-600/30 text-blue-400' : 'text-gray-400 hover:text-gray-200'
          }`}
          title="Toggle Explorer Sidebar (Cmd+B)"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        {/* Toggle Bottom Debugger */}
        <button
          onClick={toggleBottomDebugger}
          className={`p-1.5 rounded transition-colors ${
            isBottomDebuggerOpen ? 'bg-blue-600/30 text-blue-400' : 'text-gray-400 hover:text-gray-200'
          }`}
          title="Toggle Multi-Lane Debugger"
        >
          <PanelBottom className="w-4 h-4" />
        </button>

        {/* Toggle Right Simulator */}
        <button
          onClick={toggleRightSimulator}
          className={`p-1.5 rounded transition-colors ${
            isRightSimulatorOpen ? 'bg-blue-600/30 text-blue-400' : 'text-gray-400 hover:text-gray-200'
          }`}
          title="Toggle Device Simulator"
        >
          <PanelRight className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-gray-600/40" />

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded hover:bg-gray-700/60 text-gray-400 hover:text-yellow-400 transition-colors"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
