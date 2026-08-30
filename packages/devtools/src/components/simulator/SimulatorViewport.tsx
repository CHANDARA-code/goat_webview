/**
 * @goat/devtools - Simulator Viewport Master Component
 * Viewport scaling (50%-150%), orientation rotation, theme switcher,
 * device skin selector, safe area toggles, and dual-thread container host.
 */

import React from 'react';
import { useDevToolsStore } from '../../store/index.ts';
import { ViewportControls } from './ViewportControls.tsx';
import { DeviceFrame } from './DeviceFrame.tsx';
import { DualThreadContainer } from './DualThreadContainer.tsx';
import { FrameRateMonitor } from './FrameRateMonitor.tsx';

export interface SimulatorViewportProps {
  onUiEvent?: (event: { eventType: string; targetNodeId: string; data?: any }) => void;
}

export const SimulatorViewport: React.FC<SimulatorViewportProps> = ({ onUiEvent }) => {
  return (
    <div className="flex-1 h-full flex flex-col bg-neutral-950/90 overflow-hidden relative select-none">
      {/* 1. Top Viewport Control Bar */}
      <ViewportControls />

      {/* 2. Main Simulator Display Area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-6 relative">
        <DeviceFrame>
          <DualThreadContainer onUiEvent={onUiEvent} />
        </DeviceFrame>
      </div>

      {/* 3. Floating 60fps Frame Rate Telemetry Monitor */}
      <div className="absolute bottom-4 right-4 z-40">
        <FrameRateMonitor />
      </div>
    </div>
  );
};
