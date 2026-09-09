import { GameScene } from './scene';
import { GameRuntimeStats } from './types';
import './style.css';

let activeScene: GameScene | null = null;

function initGame(): void {
  const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('[Three.js Demo] Canvas element #webgl-canvas not found');
    return;
  }

  activeScene = new GameScene(canvas);

  // Setup universal interface contracts
  setupWindowContracts();
}

function setupWindowContracts(): void {
  // Callable function returning current telemetry
  const statsFn = (): GameRuntimeStats => {
    if (!activeScene) {
      return {
        engine: 'threejs',
        status: 'destroyed',
        fps: 0,
        frameTime: 0,
        drawCalls: 0,
        triangles: 0,
        geometries: 0,
        textures: 0,
        points: 0,
      };
    }
    return activeScene.getStats();
  };

  // Attach property getters so window.__gameStats.fps and window.__gameStats().fps both work
  Object.defineProperties(statsFn, {
    engine: { get: () => 'threejs' },
    status: { get: () => statsFn().status },
    fps: { get: () => statsFn().fps },
    frameTime: { get: () => statsFn().frameTime },
    drawCalls: { get: () => statsFn().drawCalls },
    triangles: { get: () => statsFn().triangles },
    geometries: { get: () => statsFn().geometries },
    textures: { get: () => statsFn().textures },
    points: { get: () => statsFn().points },
  });

  window.__gameStats = statsFn as any;

  window.__pauseGame = () => {
    activeScene?.pause();
  };

  window.__resumeGame = () => {
    activeScene?.resume();
  };

  window.__teardownGame = () => {
    if (activeScene) {
      activeScene.teardown();
      activeScene = null;
    }
    // Update __gameStats to reflect destroyed state
    const destroyedStats: GameRuntimeStats = {
      engine: 'threejs',
      status: 'destroyed',
      fps: 0,
      frameTime: 0,
      drawCalls: 0,
      triangles: 0,
      geometries: 0,
      textures: 0,
      points: 0,
    };
    const destroyedFn = () => destroyedStats;
    Object.assign(destroyedFn, destroyedStats);
    window.__gameStats = destroyedFn as any;
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}
