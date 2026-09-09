import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';

export interface GameRuntimeStats {
  engine: 'littlejs' | 'phaser' | 'threejs' | 'r3f';
  status: 'running' | 'paused' | 'destroyed';
  fps: number;
  frameTime: number; // in milliseconds
  drawCalls?: number;
  entities?: number;
  triangles?: number;
  memoryMB?: number;
  score?: number;
}

declare global {
  interface Window {
    __gameStats?: () => GameRuntimeStats;
    __teardownGame?: () => void;
    __pauseGame?: () => void;
    __resumeGame?: () => void;
    __phaserGame?: Phaser.Game | null;
  }
}

let game: Phaser.Game | null = null;
let currentStatus: 'running' | 'paused' | 'destroyed' = 'running';

/**
 * Configure and launch Phaser 3 Game instance.
 */
export function initGame(): Phaser.Game {
  const container = document.getElementById('game-container');
  if (!container) {
    throw new Error('Container #game-container not found in DOM.');
  }

  // DPR Clamping to eliminate GPU fill-rate thermal throttling on mobile WebViews
  const dpr = Math.min(window.devicePixelRatio || 1, 2.0);

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: container,
    backgroundColor: '#101528',
    scale: {
      mode: Phaser.Scale.RESIZE,
      parent: container,
      width: '100%',
      height: '100%',
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 900 },
        debug: false,
      },
    },
    input: {
      touch: true,
      activePointers: 3, // Multi-touch support for virtual buttons
      keyboard: true,
    },
    render: {
      antialias: true,
      pixelArt: false,
      powerPreference: 'high-performance',
    },
    scene: [MainScene],
  };

  game = new Phaser.Game(config);
  window.__phaserGame = game;
  currentStatus = 'running';

  // Universal lifecycle methods exposed on window
  setupUniversalLifecycleHooks();

  return game;
}

/**
 * Register universal lifecycle and telemetry hooks on window.
 */
function setupUniversalLifecycleHooks(): void {
  // Telemetry stats hook
  window.__gameStats = (): GameRuntimeStats => {
    if (!game || currentStatus === 'destroyed') {
      return {
        engine: 'phaser',
        status: 'destroyed',
        fps: 0,
        frameTime: 0,
        entities: 0,
        score: 0,
      };
    }

    const fps = game.loop ? Math.round(game.loop.actualFps) : 0;
    const frameTime = game.loop ? parseFloat(game.loop.delta.toFixed(2)) : 0;

    let entities = 0;
    let score = 0;

    const mainScene = game.scene.getScene('MainScene') as MainScene | undefined;
    if (mainScene && mainScene.physics && mainScene.physics.world) {
      entities = mainScene.physics.world.bodies.size;
      score = mainScene.score;
    }

    return {
      engine: 'phaser',
      status: currentStatus,
      fps: isNaN(fps) ? 60 : fps,
      frameTime: isNaN(frameTime) ? 16.6 : frameTime,
      entities,
      score,
    };
  };

  // Teardown hook
  window.__teardownGame = (): void => {
    if (!game || currentStatus === 'destroyed') return;

    currentStatus = 'destroyed';

    try {
      // 1. Teardown active scene
      const mainScene = game.scene.getScene('MainScene') as MainScene | undefined;
      if (mainScene) {
        mainScene.destroy();
      }

      // 2. Destroy Phaser Game instance:
      // removeCanvas = true (cleans up canvas from DOM)
      // noReturn = false (destroys scene manager, animation loop, audio, input plugins)
      game.destroy(true, false);
      game = null;
      window.__phaserGame = null;
    } catch {
      // Fallback cleanup
      if (game) {
        game.destroy(true);
        game = null;
        window.__phaserGame = null;
      }
    }

    // Clean up container
    const container = document.getElementById('game-container');
    if (container) {
      container.innerHTML = '';
    }
  };

  // Pause hook
  window.__pauseGame = (): void => {
    if (!game || currentStatus !== 'running') return;

    currentStatus = 'paused';
    try {
      if (game.scene.isActive('MainScene')) {
        game.scene.pause('MainScene');
      }
      if (game.loop) {
        game.loop.sleep();
      }
    } catch {
      // Ignore pause failure
    }
  };

  // Resume hook
  window.__resumeGame = (): void => {
    if (!game || currentStatus !== 'paused') return;

    currentStatus = 'running';
    try {
      if (game.loop) {
        game.loop.wake();
      }
      if (game.scene.isPaused('MainScene')) {
        game.scene.resume('MainScene');
      }
    } catch {
      // Ignore resume failure
    }
  };

  // Auto-pause on document visibility loss in WebView
  const handleVisibilityChange = () => {
    if (document.hidden) {
      if (currentStatus === 'running') {
        window.__pauseGame?.();
        currentStatus = 'paused';
      }
    } else {
      if (currentStatus === 'paused') {
        window.__resumeGame?.();
      }
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Clean teardown on window unload / unmount
  window.addEventListener(
    'pagehide',
    () => {
      window.__teardownGame?.();
    },
    { once: true }
  );
}

// Automatically initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initGame());
} else {
  initGame();
}
