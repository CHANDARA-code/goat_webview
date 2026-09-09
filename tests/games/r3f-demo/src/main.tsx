import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { setGameStatus, updateGlobalStats } from './telemetry';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element #root not found in document');
}

// Initialize global stats so window.__gameStats is callable immediately
updateGlobalStats();

const root = ReactDOM.createRoot(container);
let isTornDown = false;

// Handle visibility changes (e.g. backgrounding on mobile WebViews)
const handleVisibilityChange = () => {
  if (isTornDown) return;
  if (document.hidden) {
    window.__pauseGame?.();
  } else {
    window.__resumeGame?.();
  }
};

document.addEventListener('visibilitychange', handleVisibilityChange);

// Universal Teardown Hook
window.__teardownGame = () => {
  if (isTornDown) return;
  isTornDown = true;

  // 1. Mark status as destroyed
  setGameStatus('destroyed');

  // 2. Unbind window listeners
  document.removeEventListener('visibilitychange', handleVisibilityChange);

  // 3. Unmount React tree (triggers R3F automatic geometry/material disposal)
  try {
    root.unmount();
  } catch (err) {
    console.warn('Error during root.unmount:', err);
  }

  // 4. Force WebGL context loss to purge GPU VRAM
  try {
    const canvases = document.querySelectorAll('canvas');
    canvases.forEach((canvas) => {
      const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | null;
      if (gl) {
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) {
          ext.loseContext();
        }
      }
      canvas.remove();
    });
  } catch (err) {
    console.warn('Error during WebGL context loss:', err);
  }

  // 5. Clean up DOM
  container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#64748b;font-family:sans-serif;font-size:14px;">React Three Fiber Scene Disposed</div>';

  // 6. Clear global control hooks
  window.__pauseGame = undefined;
  window.__resumeGame = undefined;

  // Final stats update with status 'destroyed'
  updateGlobalStats();
};

// Render root
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
