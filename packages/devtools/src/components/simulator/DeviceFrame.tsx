/**
 * @goat/devtools - Device Frame Component
 * Pixel-perfect hardware chassis skins for iPhone 16 Pro, Pixel 9 Pro,
 * iPad Pro, and Foldable dual-screen with Dynamic Island, punch-hole, and safe areas.
 */

import React from 'react';
import { useDevToolsStore } from '../../store/index.ts';
import { DEVICE_SPECS, DeviceDimensionSpec } from '../../store/simulatorSlice.ts';
import type { DeviceSkinType, Orientation } from '../../types/index.ts';
import { Wifi, Battery, BatteryCharging, Signal } from 'lucide-react';

export interface DeviceFrameProps {
  children: React.ReactNode;
}

export const DeviceFrame: React.FC<DeviceFrameProps> = ({ children }) => {
  const {
    activeDeviceSkin = 'iphone16pro',
    orientation = 'portrait',
    scale = 1.0,
    viewportScale = 1.0,
    simulatorTheme = 'dark',
    safeAreaInsets = { top: 59, bottom: 34, left: 0, right: 0 },
    showSafeAreaOverlay = false,
    battery = { level: 100, isCharging: false },
    networkPreset = 'online',
  } = useDevToolsStore();

  const currentScale = viewportScale || scale || 1.0;
  const spec: DeviceDimensionSpec =
    DEVICE_SPECS[activeDeviceSkin as DeviceSkinType] || DEVICE_SPECS.iphone16pro;

  const isLandscape = orientation === 'landscape';
  const width = isLandscape ? spec.height : spec.width;
  const height = isLandscape ? spec.width : spec.height;

  return (
    <div
      className="flex items-center justify-center p-4 transition-transform duration-200"
      style={{
        transform: `scale(${currentScale})`,
        transformOrigin: 'center center',
      }}
      data-testid="device-frame-container"
    >
      {/* Outer Hardware Chassis */}
      <div
        className={`relative shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] border-neutral-800 transition-all duration-300 ${
          simulatorTheme === 'dark' ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-900'
        }`}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          borderRadius: `${spec.cornerRadius}px`,
          borderWidth: `${spec.bezelWidth}px`,
          boxShadow: '0 0 0 2px rgba(255,255,255,0.08), 0 20px 50px rgba(0,0,0,0.6)',
        }}
        data-testid={`device-frame-${spec.id}`}
      >
        {/* Hardware Buttons on Outer Bezel */}
        {spec.id === 'iphone16pro' && (
          <>
            {/* Action Button & Volume Up/Down on Left */}
            <div className="absolute -left-[14px] top-24 w-1 h-7 bg-neutral-700 rounded-l-sm" title="Action Button" />
            <div className="absolute -left-[14px] top-36 w-1 h-12 bg-neutral-700 rounded-l-sm" title="Volume Up" />
            <div className="absolute -left-[14px] top-52 w-1 h-12 bg-neutral-700 rounded-l-sm" title="Volume Down" />
            {/* Power / Siri Button on Right */}
            <div className="absolute -right-[14px] top-36 w-1 h-16 bg-neutral-700 rounded-r-sm" title="Power / Lock" />
          </>
        )}

        {spec.id === 'pixel9pro' && (
          <>
            {/* Power & Volume Rocker on Right */}
            <div className="absolute -right-[12px] top-28 w-1 h-10 bg-neutral-700 rounded-r-sm" title="Power" />
            <div className="absolute -right-[12px] top-44 w-1 h-20 bg-neutral-700 rounded-r-sm" title="Volume Rocker" />
          </>
        )}

        {/* Screen Bezel Inner Border */}
        <div
          className={`w-full h-full relative overflow-hidden flex flex-col ${
            simulatorTheme === 'dark' ? 'bg-black text-white' : 'bg-white text-neutral-900'
          }`}
          style={{
            borderRadius: `${Math.max(4, spec.cornerRadius - spec.bezelWidth)}px`,
          }}
        >
          {/* Dynamic Island (iPhone 16 Pro) */}
          {spec.hasDynamicIsland && !isLandscape && (
            <div
              className="absolute top-2.5 left-1/2 -translate-x-1/2 z-40 flex items-center justify-between px-2.5 bg-black rounded-full shadow-lg border border-neutral-900/60 transition-all duration-200"
              style={{ width: '122px', height: '32px' }}
              data-testid="dynamic-island"
            >
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 animate-pulse" />
                <span className="text-[10px] font-medium text-white/90">Goat</span>
              </div>
              <div className="w-3.5 h-3.5 rounded-full bg-neutral-900 border border-blue-900/40 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500/40" />
              </div>
            </div>
          )}

          {/* Punch-Hole Camera (Pixel 9 Pro) */}
          {spec.hasPunchHole && !isLandscape && (
            <div
              className="absolute top-3 left-1/2 -translate-x-1/2 z-40 w-3.5 h-3.5 rounded-full bg-black border border-neutral-800 shadow-md flex items-center justify-center"
              data-testid="punch-hole-camera"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-950/60" />
            </div>
          )}

          {/* Simulated System Status Bar */}
          <div
            className={`w-full flex items-center justify-between px-6 text-xs font-semibold select-none z-30 shrink-0 ${
              spec.hasDynamicIsland && !isLandscape ? 'h-11 pt-1' : 'h-8 pt-1'
            } ${simulatorTheme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}
            data-testid="device-status-bar"
          >
            {/* Clock */}
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold">
              <span>9:41</span>
            </div>

            {/* Status Icons */}
            <div className="flex items-center gap-2 text-[10px]">
              <Signal className="w-3 h-3" />
              <span className="font-mono text-[9px] uppercase font-bold tracking-tight">
                {networkPreset === 'offline' ? 'No Net' : '5G'}
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

          {/* Foldable Dual-Screen Layout */}
          {spec.isFoldable ? (
            <div className="flex-1 flex relative overflow-hidden" data-testid="foldable-container">
              {/* Left Screen Display */}
              <div className="flex-1 h-full overflow-hidden relative border-r border-neutral-800/80">
                {children}
              </div>

              {/* Central Folding Hinge Spine */}
              <div
                className="w-2.5 h-full bg-gradient-to-r from-neutral-800 via-neutral-950 to-neutral-800 relative z-20 flex flex-col justify-between items-center py-2 shadow-inner"
                data-testid="foldable-hinge"
              >
                <div className="w-1.5 h-3 bg-neutral-700 rounded-full" />
                <div className="w-0.5 h-1/2 bg-neutral-900/60 rounded" />
                <div className="w-1.5 h-3 bg-neutral-700 rounded-full" />
              </div>

              {/* Right Screen Display / Mirror */}
              <div className="flex-1 h-full overflow-hidden relative bg-neutral-900/40 flex flex-col p-3 text-xs">
                <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                  Foldable Secondary Screen
                </div>
                <div className="p-3 bg-black/40 rounded-lg border border-neutral-800/60 space-y-2 flex-1 text-neutral-300">
                  <p className="font-semibold text-blue-400">Dual-Screen Multi-Tasking</p>
                  <p className="text-[10px] text-neutral-400">
                    Mini-App secondary viewport active. Split-screen VDOM rendering enabled.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Standard Screen Viewport Content */
            <div className="flex-1 relative overflow-hidden flex flex-col" data-testid="simulator-screen-content">
              {children}
            </div>
          )}

          {/* Home Indicator Bar (iOS / Android / iPad) */}
          <div className="w-full h-5 flex items-center justify-center shrink-0 z-30 select-none">
            <div
              className={`h-1 rounded-full transition-colors ${
                simulatorTheme === 'dark' ? 'bg-neutral-600' : 'bg-neutral-400'
              } ${spec.isTablet ? 'w-36' : 'w-28'}`}
              data-testid="home-indicator"
            />
          </div>

          {/* Optional Safe Area Overlay Guidelines */}
          {showSafeAreaOverlay && (
            <div
              className="absolute inset-0 pointer-events-none z-50 border-2 border-dashed border-red-500/80 bg-red-500/5 flex flex-col justify-between"
              style={{
                paddingTop: `${safeAreaInsets.top}px`,
                paddingBottom: `${safeAreaInsets.bottom}px`,
                paddingLeft: `${safeAreaInsets.left}px`,
                paddingRight: `${safeAreaInsets.right}px`,
              }}
              data-testid="safe-area-overlay"
            >
              <div className="text-[9px] font-mono text-red-400 bg-red-950/80 px-1 py-0.5 rounded self-start">
                Top Safe Area: {safeAreaInsets.top}px
              </div>
              <div className="text-[9px] font-mono text-red-400 bg-red-950/80 px-1 py-0.5 rounded self-center">
                Safe Area Bounds
              </div>
              <div className="text-[9px] font-mono text-red-400 bg-red-950/80 px-1 py-0.5 rounded self-end">
                Bottom Safe Area: {safeAreaInsets.bottom}px
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
