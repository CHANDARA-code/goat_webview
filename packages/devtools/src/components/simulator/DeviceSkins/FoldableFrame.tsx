/**
 * @goat/devtools - Foldable Dual-Screen Frame Skin
 * Dual-display foldable chassis with 16px central folding hinge seam, safe areas 32px/24px.
 */

import React from 'react';
import { Wifi, Battery, BatteryCharging, Signal, Columns } from 'lucide-react';
import { useDevToolsStore } from '../../../store/index.ts';

export interface FoldableFrameProps {
  children: React.ReactNode;
}

export const FoldableFrame: React.FC<FoldableFrameProps> = ({ children }) => {
  const {
    orientation = 'portrait',
    simulatorTheme = 'dark',
    battery = { level: 100, isCharging: false },
    networkThrottling = { preset: 'online' },
    showSafeAreaOverlay = false,
  } = useDevToolsStore();

  const isLandscape = orientation === 'landscape';
  const width = isLandscape ? 890 : 670;
  const height = isLandscape ? 670 : 890;

  return (
    <div
      className="relative transition-all duration-300 select-none shadow-[0_30px_75px_-15px_rgba(0,0,0,0.85)] border-[10px] border-neutral-800 rounded-[32px] overflow-hidden flex flex-col"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        boxShadow: '0 0 0 2px rgba(255,255,255,0.08), 0 30px 75px rgba(0,0,0,0.7)',
      }}
      data-testid="device-frame-foldable"
    >
      {/* Screen Container */}
      <div
        className={`w-full h-full relative overflow-hidden flex flex-col rounded-[22px] ${
          simulatorTheme === 'dark' ? 'bg-black text-white' : 'bg-white text-neutral-900'
        }`}
      >
        {/* Status Bar */}
        <div
          className={`w-full flex items-center justify-between px-6 text-xs font-semibold select-none z-30 shrink-0 h-8 pt-1 ${
            simulatorTheme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'
          }`}
          data-testid="device-status-bar"
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold">12:00</span>
            <div className="flex items-center gap-1 px-1.5 py-0.2 bg-blue-950/60 border border-blue-800/60 rounded text-[9px] text-blue-300 font-mono">
              <Columns className="w-2.5 h-2.5" />
              <span>Foldable Dual-Screen</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px]">
            <Signal className="w-3 h-3" />
            <span className="font-mono text-[9px] uppercase font-bold text-neutral-400">
              {networkThrottling.preset === 'offline' ? 'No Service' : '5G'}
            </span>
            <Wifi className="w-3 h-3" />
            <div className="flex items-center gap-0.5">
              <span className="text-[10px] font-mono">{battery.level}%</span>
              {battery.isCharging ? (
                <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Battery className="w-3.5 h-3.5" />
              )}
            </div>
          </div>
        </div>

        {/* Dual Screen Display Container with Central Hinge Seam */}
        <div className="flex-1 flex relative overflow-hidden" data-testid="foldable-container">
          {/* Left Primary Display */}
          <div className="flex-1 h-full overflow-hidden relative border-r border-neutral-800/90" data-testid="simulator-screen-content">
            {children}
          </div>

          {/* 16px Central Folding Hinge Spine */}
          <div
            className="w-4 h-full bg-gradient-to-r from-neutral-800 via-neutral-950 to-neutral-800 relative z-20 flex flex-col justify-between items-center py-2 shadow-inner border-x border-black"
            data-testid="foldable-hinge"
          >
            <div className="w-2 h-4 bg-neutral-700 rounded-full" />
            <div className="w-0.5 h-3/5 bg-neutral-900/80 rounded" />
            <div className="w-2 h-4 bg-neutral-700 rounded-full" />
          </div>

          {/* Right Secondary Display */}
          <div className="flex-1 h-full overflow-hidden relative bg-neutral-900/40 flex flex-col p-4 text-xs">
            <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Secondary Display</span>
              <span className="text-[9px] px-1.5 py-0.2 bg-emerald-950/60 border border-emerald-800/60 rounded text-emerald-300 font-mono">
                Active
              </span>
            </div>
            <div className="p-3 bg-black/50 rounded-xl border border-neutral-800 space-y-2 flex-1 text-neutral-300 flex flex-col justify-between">
              <div>
                <p className="font-semibold text-blue-400 text-sm">Foldable Multi-Tasking</p>
                <p className="text-[11px] text-neutral-400 mt-1">
                  16px central physical hinge active. Secondary mini-app canvas or companion layout rendered here.
                </p>
              </div>
              <div className="p-2 bg-neutral-900 rounded border border-neutral-800 text-[10px] font-mono text-neutral-400 space-y-1">
                <div>Posture: Half-Opened (Book mode)</div>
                <div>Hinge Angle: 120°</div>
                <div>Safe Insets: Top 32px / Bottom 24px</div>
              </div>
            </div>
          </div>
        </div>

        {/* Home Indicator */}
        <div className="w-full h-4 flex items-center justify-center shrink-0 z-30 select-none">
          <div
            className={`h-1 w-32 rounded-full transition-colors ${
              simulatorTheme === 'dark' ? 'bg-neutral-600' : 'bg-neutral-400'
            }`}
            data-testid="home-indicator"
          />
        </div>

        {/* Safe Area Overlay */}
        {showSafeAreaOverlay && (
          <div
            className="absolute inset-0 pointer-events-none z-50 border-2 border-dashed border-red-500/80 bg-red-500/5 flex flex-col justify-between"
            style={{
              paddingTop: '32px',
              paddingBottom: '24px',
              paddingLeft: '0px',
              paddingRight: '0px',
            }}
            data-testid="safe-area-overlay"
          >
            <div className="text-[9px] font-mono text-red-400 bg-red-950/80 px-1 py-0.5 rounded self-start">
              Top Safe Area: 32px
            </div>
            <div className="text-[9px] font-mono text-red-400 bg-red-950/80 px-1 py-0.5 rounded self-center">
              Foldable Dual-Screen Safe Bounds
            </div>
            <div className="text-[9px] font-mono text-red-400 bg-red-950/80 px-1 py-0.5 rounded self-end">
              Bottom Safe Area: 24px
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
