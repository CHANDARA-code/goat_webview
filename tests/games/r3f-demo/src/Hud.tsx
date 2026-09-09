import React from 'react';
import { useTelemetry } from './telemetry';

interface HudProps {
  isPaused: boolean;
  onTogglePause: () => void;
  onResetCamera: () => void;
  onAddCube: () => void;
  onTeardown: () => void;
  cubeCount: number;
}

export const Hud: React.FC<HudProps> = ({
  isPaused,
  onTogglePause,
  onResetCamera,
  onAddCube,
  onTeardown,
  cubeCount,
}) => {
  const stats = useTelemetry();

  const fpsColor = stats.fps >= 55 ? '#22c55e' : stats.fps >= 30 ? '#eab308' : '#ef4444';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        padding: 'max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        zIndex: 10,
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Top Header & Telemetry Panel */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            pointerEvents: 'auto',
            background: 'rgba(10, 15, 30, 0.82)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '14px',
            padding: '12px 16px',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)',
            minWidth: '240px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', color: '#38bdf8' }}>
              ⚡ R3F 3D ENGINE
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '999px',
                backgroundColor: isPaused ? 'rgba(234, 179, 8, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                color: isPaused ? '#facc15' : '#4ade80',
                border: `1px solid ${isPaused ? '#ca8a04' : '#16a34a'}`,
              }}
            >
              {isPaused ? 'PAUSED' : 'RUNNING'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 16px', fontSize: '12px' }}>
            <div>
              <span style={{ color: '#94a3b8' }}>FPS: </span>
              <strong style={{ color: fpsColor, fontSize: '15px' }}>{stats.fps}</strong>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>Frame: </span>
              <strong style={{ color: '#f1f5f9' }}>{stats.frameTime} ms</strong>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>Draw Calls: </span>
              <strong style={{ color: '#f1f5f9' }}>{stats.drawCalls}</strong>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>Triangles: </span>
              <strong style={{ color: '#f1f5f9' }}>{stats.triangles.toLocaleString()}</strong>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>Cubes: </span>
              <strong style={{ color: '#c084fc' }}>{cubeCount}</strong>
            </div>
            {stats.memoryMB ? (
              <div>
                <span style={{ color: '#94a3b8' }}>Heap: </span>
                <strong style={{ color: '#f1f5f9' }}>{stats.memoryMB} MB</strong>
              </div>
            ) : null}
          </div>
        </div>

        {/* Action Controls */}
        <div
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={onTogglePause}
            style={{
              cursor: 'pointer',
              background: 'rgba(30, 41, 59, 0.85)',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '8px 14px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 600,
              backdropFilter: 'blur(8px)',
              touchAction: 'manipulation',
            }}
          >
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button
            onClick={onResetCamera}
            style={{
              cursor: 'pointer',
              background: 'rgba(30, 41, 59, 0.85)',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '8px 14px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 600,
              backdropFilter: 'blur(8px)',
              touchAction: 'manipulation',
            }}
          >
            ↺ Reset Cam
          </button>
          <button
            onClick={onAddCube}
            style={{
              cursor: 'pointer',
              background: 'rgba(14, 116, 144, 0.85)',
              color: '#f8fafc',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              padding: '8px 14px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 600,
              backdropFilter: 'blur(8px)',
              touchAction: 'manipulation',
            }}
          >
            + Cube
          </button>
          <button
            onClick={onTeardown}
            style={{
              cursor: 'pointer',
              background: 'rgba(159, 18, 57, 0.85)',
              color: '#ffe4e6',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              padding: '8px 14px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 600,
              backdropFilter: 'blur(8px)',
              touchAction: 'manipulation',
            }}
          >
            ✕ Teardown
          </button>
        </div>
      </div>

      {/* Bottom Gesture Hint */}
      <div
        style={{
          alignSelf: 'center',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px',
          padding: '6px 16px',
          fontSize: '11px',
          color: '#cbd5e1',
          letterSpacing: '0.02em',
          pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        }}
      >
        👆 Touch/Drag to Orbit • Pinch to Zoom • Tap Cubes to Bounce
      </div>
    </div>
  );
};
