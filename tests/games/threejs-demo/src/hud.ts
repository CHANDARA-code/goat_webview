import * as THREE from 'three';
import { GameRuntimeStats } from './types';

export interface HUDCallbacks {
  onTogglePause?: () => void;
  onToggleShadows?: () => void;
  onResetCamera?: () => void;
  onTeardown?: () => void;
}

export class DebugHUD {
  private container: HTMLElement;
  private fpsEl: HTMLElement | null = null;
  private msEl: HTMLElement | null = null;
  private callsEl: HTMLElement | null = null;
  private trisEl: HTMLElement | null = null;
  private geosEl: HTMLElement | null = null;
  private texsEl: HTMLElement | null = null;
  private pointsEl: HTMLElement | null = null;
  private btnPause: HTMLButtonElement | null = null;
  private btnShadows: HTMLButtonElement | null = null;

  private fpsSamples: number[] = [];
  private lastTimestamp = performance.now();
  private lastDomUpdate = 0;
  private currentStats: GameRuntimeStats = {
    engine: 'threejs',
    status: 'running',
    fps: 60,
    frameTime: 16.6,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    points: 0,
  };

  private callbacks: HUDCallbacks;

  constructor(callbacks: HUDCallbacks = {}) {
    this.callbacks = callbacks;
    this.container = document.createElement('div');
    this.container.id = 'debug-hud';

    this.container.innerHTML = `
      <div class="hud-panel">
        <div class="hud-header">
          <div class="hud-title">
            <span>⚡ Three.js 3D</span>
            <span class="hud-badge">WebGL2</span>
          </div>
          <span id="hud-status" class="hud-badge" style="color: var(--accent-green)">RUNNING</span>
        </div>

        <div class="hud-grid">
          <div class="hud-row">
            <span class="hud-label">FPS:</span>
            <span id="hud-fps" class="hud-val text-green">60</span>
          </div>
          <div class="hud-row">
            <span class="hud-label">Frame:</span>
            <span id="hud-ms" class="hud-val">16.6 ms</span>
          </div>
          <div class="hud-row">
            <span class="hud-label">Draw Calls:</span>
            <span id="hud-calls" class="hud-val">0</span>
          </div>
          <div class="hud-row">
            <span class="hud-label">Triangles:</span>
            <span id="hud-tris" class="hud-val">0</span>
          </div>
          <div class="hud-row">
            <span class="hud-label">Geometries:</span>
            <span id="hud-geos" class="hud-val">0</span>
          </div>
          <div class="hud-row">
            <span class="hud-label">Textures:</span>
            <span id="hud-texs" class="hud-val">0</span>
          </div>
          <div class="hud-row" style="grid-column: span 2">
            <span class="hud-label">Particle Points:</span>
            <span id="hud-points" class="hud-val" style="color: var(--accent-cyan)">8,500</span>
          </div>
        </div>

        <div class="hud-actions">
          <button id="hud-btn-pause" class="hud-btn">Pause</button>
          <button id="hud-btn-shadows" class="hud-btn">Shadows</button>
          <button id="hud-btn-reset" class="hud-btn">Reset</button>
          <button id="hud-btn-teardown" class="hud-btn hud-danger">Teardown</button>
        </div>

        <div class="hud-help">
          Touch/Drag: Orbit • Pinch: Zoom • Tap: Perturb Mesh • WASD: Fly
        </div>
      </div>
    `;

    document.body.appendChild(this.container);

    this.bindDomElements();
    this.bindEvents();
  }

  private bindDomElements(): void {
    this.fpsEl = document.getElementById('hud-fps');
    this.msEl = document.getElementById('hud-ms');
    this.callsEl = document.getElementById('hud-calls');
    this.trisEl = document.getElementById('hud-tris');
    this.geosEl = document.getElementById('hud-geos');
    this.texsEl = document.getElementById('hud-texs');
    this.pointsEl = document.getElementById('hud-points');
    this.btnPause = document.getElementById('hud-btn-pause') as HTMLButtonElement;
    this.btnShadows = document.getElementById('hud-btn-shadows') as HTMLButtonElement;
  }

  private bindEvents(): void {
    if (this.btnPause) {
      this.btnPause.addEventListener('click', (e) => {
        e.stopPropagation();
        this.callbacks.onTogglePause?.();
      });
    }

    if (this.btnShadows) {
      this.btnShadows.addEventListener('click', (e) => {
        e.stopPropagation();
        this.callbacks.onToggleShadows?.();
      });
    }

    const btnReset = document.getElementById('hud-btn-reset');
    if (btnReset) {
      btnReset.addEventListener('click', (e) => {
        e.stopPropagation();
        this.callbacks.onResetCamera?.();
      });
    }

    const btnTeardown = document.getElementById('hud-btn-teardown');
    if (btnTeardown) {
      btnTeardown.addEventListener('click', (e) => {
        e.stopPropagation();
        this.callbacks.onTeardown?.();
      });
    }
  }

  public setPausedState(paused: boolean): void {
    const statusEl = document.getElementById('hud-status');
    if (statusEl) {
      statusEl.textContent = paused ? 'PAUSED' : 'RUNNING';
      statusEl.style.color = paused ? 'var(--accent-yellow)' : 'var(--accent-green)';
    }
    if (this.btnPause) {
      this.btnPause.textContent = paused ? 'Resume' : 'Pause';
      if (paused) {
        this.btnPause.classList.add('active');
      } else {
        this.btnPause.classList.remove('active');
      }
    }
  }

  public setShadowsState(enabled: boolean): void {
    if (this.btnShadows) {
      if (enabled) {
        this.btnShadows.classList.add('active');
      } else {
        this.btnShadows.classList.remove('active');
      }
    }
  }

  public update(renderer: THREE.WebGLRenderer, isPaused: boolean = false): GameRuntimeStats {
    const now = performance.now();
    const deltaMs = now - this.lastTimestamp;
    this.lastTimestamp = now;

    if (!isPaused && deltaMs > 0) {
      const instantFps = 1000 / deltaMs;
      this.fpsSamples.push(instantFps);
      if (this.fpsSamples.length > 30) {
        this.fpsSamples.shift();
      }
    }

    const avgFps = this.fpsSamples.length > 0
      ? Math.round(this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length)
      : 60;

    this.currentStats = {
      engine: 'threejs',
      status: isPaused ? 'paused' : 'running',
      fps: avgFps,
      frameTime: parseFloat(deltaMs.toFixed(2)),
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      points: renderer.info.render.points,
    };

    // Throttle DOM updates to ~15 Hz to avoid layout thrashing
    if (now - this.lastDomUpdate > 65) {
      this.lastDomUpdate = now;
      if (this.fpsEl) {
        this.fpsEl.textContent = `${this.currentStats.fps}`;
        this.fpsEl.className =
          this.currentStats.fps >= 55
            ? 'hud-val text-green'
            : this.currentStats.fps >= 30
            ? 'hud-val text-yellow'
            : 'hud-val text-red';
      }
      if (this.msEl) this.msEl.textContent = `${this.currentStats.frameTime} ms`;
      if (this.callsEl) this.callsEl.textContent = `${this.currentStats.drawCalls}`;
      if (this.trisEl) this.trisEl.textContent = this.currentStats.triangles.toLocaleString();
      if (this.geosEl) this.geosEl.textContent = `${this.currentStats.geometries ?? 0}`;
      if (this.texsEl) this.texsEl.textContent = `${this.currentStats.textures ?? 0}`;
      if (this.pointsEl) this.pointsEl.textContent = (this.currentStats.points ?? 8500).toLocaleString();
    }

    return this.currentStats;
  }

  public getStats(): GameRuntimeStats {
    return { ...this.currentStats };
  }

  public dispose(): void {
    this.container.remove();
  }
}
