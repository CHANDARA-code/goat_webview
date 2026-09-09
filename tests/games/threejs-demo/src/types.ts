export interface GameRuntimeStats {
  engine: 'threejs';
  status: 'running' | 'paused' | 'destroyed';
  fps: number;
  frameTime: number; // in milliseconds
  drawCalls: number;
  triangles: number;
  geometries?: number;
  textures?: number;
  points?: number;
  memoryMB?: number;
}

declare global {
  interface Window {
    __gameStats?: (() => GameRuntimeStats) & Partial<GameRuntimeStats>;
    __teardownGame?: () => void;
    __pauseGame?: () => void;
    __resumeGame?: () => void;
  }
}
