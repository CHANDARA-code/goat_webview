export interface GameRuntimeStats {
  engine: 'r3f';
  status: 'running' | 'paused' | 'destroyed';
  fps: number;
  frameTime: number; // in milliseconds
  drawCalls: number;
  triangles: number;
  entities?: number;
  memoryMB?: number;
}

export type GameStatsFunction = (() => GameRuntimeStats) & {
  engine: 'r3f';
  status: 'running' | 'paused' | 'destroyed';
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  entities?: number;
  memoryMB?: number;
};

declare global {
  interface Window {
    __gameStats?: GameStatsFunction;
    __teardownGame?: () => void;
    __pauseGame?: () => void;
    __resumeGame?: () => void;
  }
}
