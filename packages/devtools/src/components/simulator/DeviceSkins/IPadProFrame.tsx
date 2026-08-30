/**
 * @goat/devtools - iPad Pro 11" Frame Skin
 * 4:3 Aspect Ratio tablet chassis with uniform slim bezels, tablet safe areas (24px/20px).
 */

import React from 'react';
import { Wifi, Battery, BatteryCharging, Signal } from 'lucide-react';
import { useDevToolsStore } from '../../../store/index.ts';

export interface IPadProFrameProps {
  children: React.ReactNode;
}

export const IPadProFrame: React.FC<IPadProFrameProps> = ({ children }) => {
  const {
    orientation = 'portrait',
    simulatorTheme = 'dark',
    battery = { level: 100, isCharging: false },
    networkThrottling = { preset: 'online' },
    showSafeAreaOverlay = false,
  } = useDevToolsStore();

  const isLandscape = orientation === 'landscape';
  const width = isLandscape ? 1194 : 834;
  const height = isLandscape ? 834 : 1194;

  return (
    <div
      className="relative transition-all duration-300 select-none shadow-[0_30px_70px_-15px_rgba(0,0,0,0.85)] border-[12px] border-neutral-800 rounded-[36px] overflow-hidden flex flex-col"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        boxShadow: '0 0 0 2px rgba(255,255,255,0.08), 0 30px 70px rgba(0,0,0,0.7)',
      }}
      data-testid="device-frame-ipadpro"
    >
      {/* Screen Container */}
      <div
        className={`w-full h-full relative overflow-hidden flex flex-col rounded-[24px] ${
          simulatorTheme === 'dark' ? 'bg-black text-white' : 'bg-white text-neutral-900'
        }`}
      >
        {/* iPadOS Status Bar */}
        <div
          className={`w-full flex items-center justify-between px-8 text-xs font-semibold select-none z-30 shrink-0 h-7 pt-1 ${
            simulatorTheme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'
          }`}
          data-testid="device-status-bar"
        >
          <div className="font-mono text-[11px] font-bold">9:41 AM Mon Oct 23</div>
          <div className="flex items-center gap-3 text-[10px]">
            <Signal className="w-3.5 h-3.5" />
            <span className="font-mono text-[9px] uppercase font-bold text-neutral-400">
              {networkThrottling.preset === 'offline' ? 'No Service' : 'Wi-Fi'}
            </span>
            <Wifi className="w-3.5 h-3.5" />
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-mono">{battery.level}%</span>
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

        {/* iPad Dock / Home Indicator */}
        <div className="w-full h-5 flex items-center justify-center shrink-0 z-30 select-none">
          <div
            className={`h-1 w-48 rounded-full transition-colors ${
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
              paddingTop: '24px',
              paddingBottom: '20px',
              paddingLeft: '0px',
              paddingRight: '0px',
            }}
            data-testid="safe-area-overlay"
          >
            <div className="text-[9px] font-mono text-red-400 bg-red-950/80 px-1 py-0.5 rounded self-start">
              Top Safe Area: 24px
            </div>
            <div className="text-[9px] font-mono text-red-400 bg-red-950/80 px-1 py-0.5 rounded self-center">
              iPad Pro Tablet Safe Bounds
            </div>
            <div className="text-[9px] font-mono text-red-400 bg-red-950/80 px-1 py-0.5 rounded self-end">
              Bottom Safe Area: 20px
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
