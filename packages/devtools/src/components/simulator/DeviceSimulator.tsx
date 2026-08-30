/**
 * @goat/devtools - Device Simulator Main Component
 * Top-level view integrating ViewportControls, DeviceFrame, DualThreadContainer, and FrameRateMonitor.
 */

import React from 'react';
import { ViewportControls } from './ViewportControls.tsx';
import { DeviceFrame } from './DeviceFrame.tsx';
import { DualThreadContainer } from './DualThreadContainer.tsx';
import { FrameRateMonitor } from './FrameRateMonitor.tsx';
import { useDevToolsStore } from '../../store/index.ts';

export const DeviceSimulator: React.FC = () => {
  const { simulatorTheme = 'dark' } = useDevToolsStore();

  return (
    <div
      className={`w-full h-full flex flex-col overflow-hidden relative select-none ${
        simulatorTheme === 'dark' ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-900'
      }`}
      data-testid="device-simulator-root"
    >
      {/* 1. Top Viewport Controls Bar */}
      <ViewportControls />

      {/* 2. Central Device Viewport Canvas */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 relative bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:16px_16px]">
        <DeviceFrame>
          <DualThreadContainer />
        </DeviceFrame>

        {/* 3. Floating Frame Rate Telemetry Monitor */}
        <div className="absolute bottom-3 right-3 z-30 max-w-xs">
          <FrameRateMonitor />
        </div>
      </div>
    </div>
  );
};
