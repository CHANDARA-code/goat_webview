/**
 * @goat/devtools - Pixel 9 Pro Frame Skin
 * Material 3 chassis with punch-hole cutout, safe areas 48px/24px.
 */

import React from 'react';
import { Wifi, Battery, BatteryCharging, Signal } from 'lucide-react';
import { useDevToolsStore } from '../../../store/index.ts';

export interface Pixel9ProFrameProps {
  children: React.ReactNode;
}

export const Pixel9ProFrame: React.FC<Pixel9ProFrameProps> = ({ children }) => {
  const {
    orientation = 'portrait',
    simulatorTheme = 'dark',
    battery = { level: 100, isCharging: false },
    networkThrottling = { preset: 'online' },
    showSafeAreaOverlay = false,
  } = useDevToolsStore();

  const isLandscape = orientation === 'landscape';
  const width = isLandscape ? 892 : 412;
  const height = isLandscape ? 412 : 892;

  return (
    <div
      className="relative transition-all duration-300 select-none shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] border-[9px] border-neutral-800 rounded-[44px] overflow-hidden flex flex-col"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        boxShadow: '0 0 0 2px rgba(255,255,255,0.1), 0 25px 60px rgba(0,0,0,0.7)',
      }}
      data-testid="device-frame-pixel9pro"
    >
      {/* Outer Hardware Buttons on Right */}
      <div className="absolute -right-[12px] top-28 w-1 h-10 bg-neutral-700 rounded-r-sm" title="Power" />
      <div className="absolute -right-[12px] top-44 w-1 h-20 bg-neutral-700 rounded-r-sm" title="Volume Rocker" />

      {/* Screen Container */}
      <div
        className={`w-full h-full relative overflow-hidden flex flex-col rounded-[35px] ${
          simulatorTheme === 'dark' ? 'bg-black text-white' : 'bg-white text-neutral-900'
        }`}
      >
        {/* Punch-Hole Camera Cutout */}
        {!isLandscape && (
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 z-40 w-3.5 h-3.5 rounded-full bg-black border border-neutral-800 shadow-md flex items-center justify-center"
            data-testid="punch-hole-camera"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-950/80" />
          </div>
        )}

        {/* Material Status Bar */}
        <div
          className={`w-full flex items-center justify-between px-6 text-xs font-semibold select-none z-30 shrink-0 h-9 pt-1.5 ${
            simulatorTheme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'
          }`}
          data-testid="device-status-bar"
        >
          <div className="font-mono text-[11px] font-bold">10:00</div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="font-mono text-[9px] uppercase font-bold text-neutral-400">
              {networkThrottling.preset === 'offline' ? 'Offline' : 'LTE / 5G'}
            </span>
            <Signal className="w-3 h-3" />
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

        {/* Viewport Content */}
        <div className="flex-1 relative overflow-hidden flex flex-col" data-testid="simulator-screen-content">
          {children}
        </div>

        {/* Android Gesture Navigation Pill */}
        <div className="w-full h-4 flex items-center justify-center shrink-0 z-30 select-none">
          <div
            className={`h-1 w-20 rounded-full transition-colors ${
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
              paddingTop: isLandscape ? '0px' : '48px',
              paddingBottom: isLandscape ? '16px' : '24px',
              paddingLeft: isLandscape ? '48px' : '0px',
              paddingRight: isLandscape ? '48px' : '0px',
            }}
            data-testid="safe-area-overlay"
          >
            <div className="text-[9px] font-mono text-red-400 bg-red-950/80 px-1 py-0.5 rounded self-start">
              Top Safe Area: 48px
            </div>
            <div className="text-[9px] font-mono text-red-400 bg-red-950/80 px-1 py-0.5 rounded self-center">
              Pixel 9 Pro Safe Bounds
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
