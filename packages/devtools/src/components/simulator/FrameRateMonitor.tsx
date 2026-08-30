/**
 * @goat/devtools - Frame Rate Monitor Component
 * Real-time 60fps telemetry graph, drop-frame tracker, and VDOM batching monitor.
 */

import React, { useState, useEffect } from 'react';
import { useDevToolsStore } from '../../store/index.ts';
import { Activity, Gauge, Zap, AlertTriangle } from 'lucide-react';

export const FrameRateMonitor: React.FC = () => {
  const { metrics = { fps: 60, frameTimeMs: 16.6, droppedFrames: 0, vdomPatchCount: 0, lastUpdated: Date.now() }, frameBatchingEnabled = true } =
    useDevToolsStore();

  const [history, setHistory] = useState<number[]>([16.6, 16.6, 16.5, 16.7, 16.6, 16.4, 16.6, 16.6]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setHistory((prev) => {
      const next = [...prev, metrics.frameTimeMs || 16.6];
      if (next.length > 25) next.shift();
      return next;
    });
  }, [metrics.lastUpdated, metrics.frameTimeMs]);

  const fps = Math.min(60, Math.max(0, metrics.fps || 60));
  const frameTime = metrics.frameTimeMs || 16.6;
  const dropped = metrics.droppedFrames || 0;
  const patchCount = metrics.vdomPatchCount || 0;

  // Determine health color
  const fpsColor =
    fps >= 55 ? 'text-emerald-400' : fps >= 40 ? 'text-amber-400' : 'text-rose-400';
  const badgeBg =
    fps >= 55 ? 'bg-emerald-950/60 border-emerald-800/60' : fps >= 40 ? 'bg-amber-950/60 border-amber-800/60' : 'bg-rose-950/60 border-rose-800/60';

  // SVG Sparkline calculation
  const svgWidth = 120;
  const svgHeight = 28;
  const maxVal = 33.3; // 30fps threshold for graph ceiling
  const points = history
    .map((val, idx) => {
      const x = (idx / Math.max(1, history.length - 1)) * svgWidth;
      const normalized = Math.min(maxVal, Math.max(0, val));
      const y = svgHeight - (normalized / maxVal) * (svgHeight - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div
      className="bg-neutral-900/95 backdrop-blur border border-neutral-800 rounded-lg p-2 text-neutral-200 select-none shadow-xl transition-all cursor-pointer"
      data-testid="frame-rate-monitor"
      onClick={() => setIsExpanded(!isExpanded)}
      title="Click to toggle detailed frame metrics"
    >
      {/* Header / Compact Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className={`w-3.5 h-3.5 ${fpsColor}`} />
          <div className="flex items-baseline gap-1">
            <span className={`font-mono text-xs font-bold ${fpsColor}`} data-testid="fps-value">
              {fps.toFixed(1)}
            </span>
            <span className="text-[10px] text-neutral-400 font-sans">FPS</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-neutral-400">{frameTime.toFixed(1)}ms</span>
          <div className={`px-1.5 py-0.2 rounded border text-[9px] font-mono font-medium ${badgeBg}`}>
            {frameBatchingEnabled ? '16.6ms Batch' : 'Unbatched'}
          </div>
        </div>
      </div>

      {/* Expanded Telemetry Details & Sparkline Graph */}
      {isExpanded && (
        <div className="mt-2 pt-2 border-t border-neutral-800 space-y-2 text-xs" data-testid="frame-rate-details">
          {/* Sparkline Graph */}
          <div className="bg-black/60 p-1.5 rounded border border-neutral-800 flex flex-col gap-1">
            <div className="flex justify-between text-[9px] text-neutral-500 font-mono">
              <span>Frame Render Time (30 frames)</span>
              <span>Target: 16.6ms</span>
            </div>
            <svg width={svgWidth} height={svgHeight} className="w-full overflow-visible">
              {/* Target 16.6ms guide line */}
              <line
                x1="0"
                y1={svgHeight - (16.6 / maxVal) * (svgHeight - 4) - 2}
                x2={svgWidth}
                y2={svgHeight - (16.6 / maxVal) * (svgHeight - 4) - 2}
                stroke="#3b82f6"
                strokeDasharray="2,2"
                strokeWidth="1"
                opacity="0.6"
              />
              <polyline fill="none" stroke="#10b981" strokeWidth="1.5" points={points} />
            </svg>
          </div>

          {/* Grid Stats */}
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <div className="p-1.5 bg-neutral-800/60 rounded border border-neutral-700/40 flex justify-between items-center">
              <span className="text-neutral-400">Dropped Frames:</span>
              <span className={`font-mono font-bold ${dropped > 0 ? 'text-amber-400' : 'text-emerald-400'}`} data-testid="dropped-frames-count">
                {dropped}
              </span>
            </div>
            <div className="p-1.5 bg-neutral-800/60 rounded border border-neutral-700/40 flex justify-between items-center">
              <span className="text-neutral-400">VDOM Patches:</span>
              <span className="font-mono font-bold text-blue-400" data-testid="vdom-patches-count">
                {patchCount}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
