/**
 * @goat/devtools - iPhone 16 Pro Frame Skin
 * Dynamic Island animation, 59px top / 34px bottom safe areas, 120Hz ProMotion chassis.
 */

import React from 'react';
import { Signal, Wifi, Battery, BatteryCharging } from 'lucide-react';
import { useDevToolsStore } from '../../../store/index.ts';

export interface IPhone16ProFrameProps {
  children: React.ReactNode;
}

export const IPhone16ProFrame: React.FC<IPhone16ProFrameProps> = ({ children }) => {
  const {
    orientation = 'portrait',
    simulatorTheme = 'dark',
    battery = { level: 100, isCharging: false },
    networkThrottling = { preset: 'online' },
    showSafeAreaOverlay = false,
  } = useDevToolsStore();

  const isLandscape = orientation === 'landscape';
  const width = isLandscape ? 852 : 393;
  const height = isLandscape ? 393 : 852;

  return (
    <div
      className="relative transition-all duration-300 select-none shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] border-[10px] border-neutral-800 rounded-[55px] overflow-hidden flex flex-col"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        boxShadow: '0 0 0 2px rgba(255,255,255,0.12), 0 25px 60px rgba(0,0,0,0.7)',
      }}
      data-testid="device-frame-iphone16pro"
    >
      {/* Outer Hardware Buttons */}
      <div className="absolute -left-[14px] top-24 w-1 h-7 bg-neutral-700 rounded-l-sm" title="Action Button" />
      <div className="absolute -left-[14px] top-36 w-1 h-12 bg-neutral-700 rounded-l-sm" title="Volume Up" />
      <div className="absolute -left-[14px] top-52 w-1 h-12 bg-neutral-700 rounded-l-sm" title="Volume Down" />
      <div className="absolute -right-[14px] top-36 w-1 h-16 bg-neutral-700 rounded-r-sm" title="Power / Lock" />

      {/* Screen Container */}
      <div
        className={`w-full h-full relative overflow-hidden flex flex-col rounded-[45px] ${
          simulatorTheme === 'dark' ? 'bg-black text-white' : 'bg-white text-neutral-900'
        }`}
      >
        {/* Dynamic Island */}
        {!isLandscape && (
          <div
            className="absolute top-2.5 left-1/2 -translate-x-1/2 z-40 flex items-center justify-between px-3 bg-black rounded-full shadow-lg border border-neutral-800/80 transition-all duration-300 hover:scale-105"
            style={{ width: '124px', height: '34px' }}
            data-testid="dynamic-island"
          >
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-semibold text-white/90">Goat</span>
            </div>
            <div className="w-3.5 h-3.5 rounded-full bg-neutral-900 border border-blue-900/50 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
            </div>
          </div>
        )}

        {/* Status Bar */}
        <div
          className={`w-full flex items-center justify-between px-7 text-xs font-semibold select-none z-30 shrink-0 ${
            isLandscape ? 'h-7 pt-1' : 'h-11 pt-2'
          } ${simulatorTheme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}
          data-testid="device-status-bar"
        >
          <div className="font-mono text-[11px] font-bold">9:41</div>
          <div className="flex items-center gap-2 text-[10px]">
            <Signal className="w-3 h-3" />
            <span className="font-mono text-[9px] uppercase font-bold">
              {networkThrottling.preset === 'offline' ? 'No Net' : '5G'}
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

        {/* Viewport Content */}
        <div className="flex-1 relative overflow-hidden flex flex-col" data-testid="simulator-screen-content">
          {children}
        </div>

        {/* Home Indicator */}
        <div className="w-full h-5 flex items-center justify-center shrink-0 z-30 select-none">
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
              paddingTop: isLandscape ? '0px' : '59px',
              paddingBottom: isLandscape ? '21px' : '34px',
              paddingLeft: isLandscape ? '59px' : '0px',
              paddingRight: isLandscape ? '59px' : '0px',
            }}
            data-testid="safe-area-overlay"
          >
            <div className="text-[9px] font-mono text-red-400 bg-red-950/80 px-1 py-0.5 rounded self-start">
              Top Safe Area: 59px
            </div>
            <div className="text-[9px] font-mono text-red-400 bg-red-950/80 px-1 py-0.5 rounded self-center">
              iPhone 16 Pro Safe Bounds
            </div>
            <div className="text-[9px] font-mono text-red-400 bg-red-950/80 px-1 py-0.5 rounded self-end">
              Bottom Safe Area: 34px
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
