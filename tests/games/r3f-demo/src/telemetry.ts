import { useEffect, useState } from 'react';
import type * as THREE from 'three';
import { GameRuntimeStats, GameStatsFunction } from './types';

let currentStats: GameRuntimeStats = {
  engine: 'r3f',
  status: 'running',
  fps: 60,
  frameTime: 16.6,
  drawCalls: 0,
  triangles: 0,
  entities: 0,
  memoryMB: 0,
};

const hudListeners = new Set<(stats: GameRuntimeStats) => void>();
let lastHudNotification = 0;
const HUD_THROTTLE_MS = 250; // 4Hz throttled HUD refresh rate

export function getStats(): GameRuntimeStats {
  return { ...currentStats };
}

export function setGameStatus(status: 'running' | 'paused' | 'destroyed'): void {
  currentStats.status = status;
  updateGlobalStats();
  for (const listener of hudListeners) {
    listener(getStats());
  }
}

export function updateGlobalStats(): void {
  const statsCopy = { ...currentStats };
  const fn = function () {
    return { ...currentStats };
  } as unknown as GameStatsFunction;

  // Bind properties directly onto the function
  Object.assign(fn, statsCopy);

  window.__gameStats = fn;
}

export class TelemetryCollector {
  private lastTime = performance.now();
  private frameDeltas: number[] = [];
  private static readonly SAMPLE_SIZE = 30;

  public recordFrame(gl: THREE.WebGLRenderer, entityCount: number = 0): void {
    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;

    if (delta > 0) {
      this.frameDeltas.push(delta);
      if (this.frameDeltas.length > TelemetryCollector.SAMPLE_SIZE) {
        this.frameDeltas.shift();
      }
    }

    const avgDelta = this.frameDeltas.length > 0
      ? this.frameDeltas.reduce((sum, d) => sum + d, 0) / this.frameDeltas.length
      : 16.6;

    const fps = Math.max(1, Math.min(240, Math.round(1000 / (avgDelta || 16.6))));
    const frameTime = parseFloat((avgDelta || 16.6).toFixed(2));

    let memoryMB = 0;
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      memoryMB = parseFloat(((performance as any).memory.usedJSHeapSize / (1024 * 1024)).toFixed(1));
    }

    currentStats = {
      ...currentStats,
      fps,
      frameTime,
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      entities: entityCount,
      memoryMB,
    };

    // 60Hz instant update for window.__gameStats
    updateGlobalStats();

    // 4Hz throttled update for React HUD to prevent re-render churn
    if (now - lastHudNotification >= HUD_THROTTLE_MS) {
      lastHudNotification = now;
      const statsSnapshot = getStats();
      for (const listener of hudListeners) {
        listener(statsSnapshot);
      }
    }
  }

  public reset(): void {
    this.lastTime = performance.now();
    this.frameDeltas = [];
  }
}

export function useTelemetry(): GameRuntimeStats {
  const [stats, setStats] = useState<GameRuntimeStats>(() => getStats());

  useEffect(() => {
    const listener = (newStats: GameRuntimeStats) => {
      setStats(newStats);
    };
    hudListeners.add(listener);
    return () => {
      hudListeners.delete(listener);
    };
  }, []);

  return stats;
}
