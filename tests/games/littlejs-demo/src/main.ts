import {
  engineInit,
  setCanvasPixelRatio,
  cameraFit,
  vec2,
  mainCanvas,
  glCanvas,
  audioContext,
  inputClear,
  engineManualStep,
  setEngineManualStep,
  engineObjectsDestroy,
  setPaused,
  getPaused,
} from 'littlejsengine';

import { gameController } from './game';
import { hud, GameRuntimeStats } from './hud';
import { resetAudio } from './audio';

declare global {
  interface Window {
    __gameStats?: () => GameRuntimeStats;
    __teardownGame?: () => void;
    __pauseGame?: () => void;
    __resumeGame?: () => void;
  }
}

const abortController = new AbortController();
const { signal } = abortController;
let isDestroyed = false;

// 1. Engine Lifecycle Callbacks
function gameInit(): void {
  // Center and fit camera to 19x27 world playfield arena
  cameraFit(vec2(0, 0), vec2(19, 27));
  gameController.init();
}

function gameUpdate(): void {
  if (isDestroyed) return;
  // Dynamic camera refit for orientation flips
  cameraFit(vec2(0, 0), vec2(19, 27));
  gameController.update();
}

function gameUpdatePost(): void {
  // Post-update logic (called even when paused)
  hud.status = isDestroyed ? 'destroyed' : getPaused() ? 'paused' : 'running';
}

function gameRender(): void {
  if (isDestroyed) return;
  gameController.render();
}

function gameRenderPost(): void {
  if (isDestroyed) return;
  gameController.renderPost();
}

// 2. Setup DPR Clamping (<= 2.0)
const clampedDpr = Math.min(window.devicePixelRatio || 1, 2.0);
setCanvasPixelRatio(clampedDpr);

// 3. Prevent default touch gestures (rubberbanding, pull-to-refresh)
window.addEventListener(
  'touchmove',
  (e) => {
    if (e.target === mainCanvas || e.target === glCanvas) {
      e.preventDefault();
    }
  },
  { passive: false, signal }
);

window.addEventListener(
  'contextmenu',
  (e) => {
    e.preventDefault();
  },
  { signal }
);

// 4. Expose Universal Window Interface Contract
window.__gameStats = (): GameRuntimeStats => {
  return hud.getStats();
};

window.__pauseGame = (): void => {
  if (isDestroyed) return;
  setPaused(true);
  hud.status = 'paused';
};

window.__resumeGame = (): void => {
  if (isDestroyed) return;
  setPaused(false);
  hud.status = 'running';
};

window.__teardownGame = (): void => {
  if (isDestroyed) return;
  isDestroyed = true;
  hud.status = 'destroyed';

  console.log('[LittleJS] Executing complete teardown...');

  // Halt requestAnimationFrame loop
  setEngineManualStep(true);

  // Destroy all active physics objects and emitters
  engineObjectsDestroy(true);

  // Clear input listeners and state
  inputClear();

  // Reset procedural audio and close Web Audio context
  resetAudio();
  try {
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch(() => {});
    }
  } catch (err) {
    console.warn('[LittleJS] AudioContext close warning:', err);
  }

  // Remove window event listeners
  abortController.abort();

  // Remove engine canvas elements from DOM
  try {
    mainCanvas?.remove();
    glCanvas?.remove();
  } catch (err) {
    console.warn('[LittleJS] Canvas removal warning:', err);
  }

  const container = document.getElementById('game-container');
  if (container) {
    container.innerHTML = '';
  }

  console.log('[LittleJS] Teardown complete. All resources disposed.');
};

// 5. Bootstrap Engine
async function startApp(): Promise<void> {
  const container = document.getElementById('game-container') || document.body;

  try {
    await engineInit(
      gameInit,
      gameUpdate,
      gameUpdatePost,
      gameRender,
      gameRenderPost,
      [], // imageSources: empty array -> zero external images!
      container
    );
    console.log('[LittleJS] Engine initialized successfully.');
  } catch (err) {
    console.error('[LittleJS] Failed to start engine:', err);
  }
}

// Ensure startup after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void startApp(), { once: true });
} else {
  void startApp();
}
