/**
 * @goat/devtools - Viewport Controls Component
 * Controls for scaling (50%, 75%, 100%, 125%, 150%), device selection,
 * orientation switching (Portrait / Landscape), theme toggle, reload, and pause/resume.
 */

import React from 'react';
import { useDevToolsStore } from '../../store/index.ts';
import type { DeviceSkinType, ViewportScale } from '../../types/index.ts';
import {
  RotateCcw,
  Smartphone,
  Tablet,
  Sun,
  Moon,
  Play,
  Pause,
  RefreshCw,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Layers,
} from 'lucide-react';

const SCALE_PRESETS: ViewportScale[] = [0.5, 0.75, 1.0, 1.25, 1.5];

export const ViewportControls: React.FC = () => {
  const store = useDevToolsStore();
  const {
    activeDeviceSkin = 'iphone16pro',
    setActiveDeviceSkin,
    viewportScale = 1.0,
    setViewportScale,
    orientation = 'portrait',
    toggleOrientation,
    simulatorTheme = 'dark',
    toggleSimulatorTheme,
    isRunning = true,
    setIsRunning,
    restartSimulator,
  } = store;

  const showSafeAreaOverlay = (store as any).showSafeAreaOverlay ?? false;
  const toggleSafeAreaOverlay = (store as any).toggleSafeAreaOverlay || (() => {});

  const handleZoomIn = () => {
    const currentIndex = SCALE_PRESETS.indexOf(viewportScale as ViewportScale);
    if (currentIndex >= 0 && currentIndex < SCALE_PRESETS.length - 1) {
      setViewportScale(SCALE_PRESETS[currentIndex + 1]);
    } else if (viewportScale < 1.5) {
      setViewportScale(Math.min(1.5, Math.round((viewportScale + 0.25) * 100) / 100));
    }
  };

  const handleZoomOut = () => {
    const currentIndex = SCALE_PRESETS.indexOf(viewportScale as ViewportScale);
    if (currentIndex > 0) {
      setViewportScale(SCALE_PRESETS[currentIndex - 1]);
    } else if (viewportScale > 0.5) {
      setViewportScale(Math.max(0.5, Math.round((viewportScale - 0.25) * 100) / 100));
    }
  };

  return (
    <div
      className="w-full bg-neutral-900 border-b border-neutral-800 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-300 select-none shrink-0"
      data-testid="viewport-controls"
    >
      {/* 1. Device Skin Selector Dropdown */}
      <div className="flex items-center gap-1.5">
        <Smartphone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <select
          value={activeDeviceSkin}
          onChange={(e) => setActiveDeviceSkin(e.target.value as DeviceSkinType)}
          className="bg-neutral-800 text-neutral-200 text-xs px-2 py-1 rounded border border-neutral-700 hover:border-neutral-600 focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
          data-testid="device-skin-select"
          title="Select Device Skin"
        >
          <option value="iphone16pro">iPhone 16 Pro (Dynamic Island)</option>
          <option value="pixel9pro">Pixel 9 Pro (Punch-Hole)</option>
          <option value="ipadpro">iPad Pro 11" (Tablet)</option>
          <option value="foldable">Foldable Dual-Screen</option>
        </select>
      </div>

      {/* 2. Viewport Scaling Controls */}
      <div className="flex items-center gap-1 bg-neutral-800/80 px-1.5 py-0.5 rounded border border-neutral-700/60">
        <button
          onClick={handleZoomOut}
          disabled={viewportScale <= 0.5}
          className="p-1 text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 rounded transition"
          title="Zoom Out"
          data-testid="zoom-out-btn"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <select
          value={viewportScale}
          onChange={(e) => setViewportScale(parseFloat(e.target.value) as ViewportScale)}
          className="bg-transparent text-[11px] font-mono font-semibold text-neutral-200 focus:outline-none cursor-pointer py-0.5"
          data-testid="scale-select"
          title="Viewport Scale"
        >
          <option value={0.5} className="bg-neutral-800">50%</option>
          <option value={0.75} className="bg-neutral-800">75%</option>
          <option value={1.0} className="bg-neutral-800">100%</option>
          <option value={1.25} className="bg-neutral-800">125%</option>
          <option value={1.5} className="bg-neutral-800">150%</option>
        </select>

        <button
          onClick={handleZoomIn}
          disabled={viewportScale >= 1.5}
          className="p-1 text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 rounded transition"
          title="Zoom In"
          data-testid="zoom-in-btn"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3. Orientation, Theme & Safe Area Toggles */}
      <div className="flex items-center gap-1">
        {/* Orientation Toggle */}
        <button
          onClick={toggleOrientation}
          className={`flex items-center gap-1 px-2 py-1 rounded border transition ${
            orientation === 'landscape'
              ? 'bg-blue-600/30 text-blue-300 border-blue-500/60 font-semibold'
              : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white hover:bg-neutral-700'
          }`}
          title={`Orientation: ${orientation} (Click to switch)`}
          data-testid="toggle-orientation-btn"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="capitalize text-[11px]">{orientation}</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleSimulatorTheme}
          className={`p-1.5 rounded border transition ${
            simulatorTheme === 'light'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white hover:bg-neutral-700'
          }`}
          title={`Simulator Theme: ${simulatorTheme} mode`}
          data-testid="toggle-theme-btn"
        >
          {simulatorTheme === 'light' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>

        {/* Safe Area Overlay Toggle */}
        <button
          onClick={toggleSafeAreaOverlay}
          className={`p-1.5 rounded border transition ${
            showSafeAreaOverlay
              ? 'bg-red-600/30 text-red-300 border-red-500/60'
              : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white hover:bg-neutral-700'
          }`}
          title="Toggle Safe Area Overlay"
          data-testid="toggle-safe-area-btn"
        >
          <Layers className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 4. Execution Controls (Play/Pause, Reload) */}
      <div className="flex items-center gap-1">
        {/* Pause / Resume */}
        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`p-1.5 rounded border transition ${
            isRunning
              ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/30'
              : 'bg-amber-600/20 text-amber-300 border-amber-500/40 hover:bg-amber-600/30'
          }`}
          title={isRunning ? 'Pause Mini-App Execution' : 'Resume Mini-App Execution'}
          data-testid="pause-resume-btn"
        >
          {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>

        {/* Reload / Restart */}
        <button
          onClick={restartSimulator}
          className="p-1.5 bg-neutral-800 text-neutral-300 border border-neutral-700 hover:text-white hover:bg-neutral-700 rounded transition active:scale-95"
          title="Restart Mini-App Simulator"
          data-testid="reload-simulator-btn"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
