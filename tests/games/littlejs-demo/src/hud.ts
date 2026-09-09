import {
  engineObjects,
  mainCanvasSize,
  mainContext,
  drawCount,
  gravity,
  ParticleEmitter,
} from 'littlejsengine';

export interface GameRuntimeStats {
  engine: 'littlejs';
  status: 'running' | 'paused' | 'destroyed';
  fps: number;
  frameTime: number;
  drawCalls?: number;
  entities?: number;
  particles?: number;
  score?: number;
}

export class DebugHud {
  private lastTime = performance.now();
  private frameTimes: number[] = [];
  private currentFps = 60;
  private currentFrameTime = 16.6;
  private maxHistory = 30;

  public score = 0;
  public ballsSpawned = 0;
  public ballsScored = 0;
  public status: 'running' | 'paused' | 'destroyed' = 'running';

  /**
   * Called once per frame during update to record frame timing.
   */
  public update(): void {
    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;

    if (delta > 0 && delta < 1000) {
      this.currentFrameTime = delta;
      this.frameTimes.push(delta);
      if (this.frameTimes.length > this.maxHistory) {
        this.frameTimes.shift();
      }
      const sum = this.frameTimes.reduce((a, b) => a + b, 0);
      const avgDelta = sum / this.frameTimes.length;
      this.currentFps = Math.round(1000 / avgDelta);
    }
  }

  /**
   * Count total active particles across all active ParticleEmitter objects.
   */
  public getActiveParticleCount(): number {
    let count = 0;
    for (let i = 0; i < engineObjects.length; i++) {
      const obj = engineObjects[i];
      if (obj instanceof ParticleEmitter && Array.isArray((obj as any).particles)) {
        count += (obj as any).particles.length;
      }
    }
    return count;
  }

  /**
   * Return standardized game runtime stats for window.__gameStats().
   */
  public getStats(): GameRuntimeStats {
    return {
      engine: 'littlejs',
      status: this.status,
      fps: this.currentFps,
      frameTime: Number(this.currentFrameTime.toFixed(2)),
      drawCalls: drawCount || 0,
      entities: engineObjects.length,
      particles: this.getActiveParticleCount(),
      score: this.score,
    };
  }

  /**
   * Render real-time debug HUD overlay in screen coordinates onto mainContext.
   */
  public render(): void {
    if (!mainContext || !mainCanvasSize) return;

    const ctx = mainContext;
    ctx.save();

    const particles = this.getActiveParticleCount();
    const entities = engineObjects.length;
    const fps = this.currentFps;
    const frameMs = this.currentFrameTime.toFixed(1);
    const dpr = (Math.min(window.devicePixelRatio || 1, 2.0)).toFixed(1);
    const grav = `(${gravity.x.toFixed(1)}, ${gravity.y.toFixed(1)})`;

    // Position in safe area (top-left with padding)
    const startX = 14;
    const startY = 16;
    const boxWidth = Math.min(340, mainCanvasSize.x - 28);
    const boxHeight = 74;

    // HUD Glassmorphism Backdrop
    ctx.fillStyle = 'rgba(11, 15, 25, 0.82)';
    ctx.strokeStyle = 'rgba(0, 230, 255, 0.45)';
    ctx.lineWidth = 1.5;

    // Draw rounded rectangle
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(startX, startY, boxWidth, boxHeight, 8);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(startX, startY, boxWidth, boxHeight);
      ctx.strokeRect(startX, startY, boxWidth, boxHeight);
    }

    // Line 1: Header / Status & FPS
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = fps >= 50 ? '#00ff88' : fps >= 30 ? '#ffaa00' : '#ff3344';
    ctx.fillText(`LITTLEJS 2D  •  FPS: ${fps} (${frameMs}ms)`, startX + 10, startY + 20);

    // DPR & Draw Calls on top right
    ctx.font = '11px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`DPR: ${dpr}x | DC: ${drawCount}`, startX + boxWidth - 110, startY + 20);

    // Line 2: Entity & Particle counters
    ctx.font = '11px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`OBJS: ${entities}  |  PARTICLES: ${particles}  |  GRAV: ${grav}`, startX + 10, startY + 40);

    // Line 3: Score and Controls hint
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#facc15';
    ctx.fillText(`SCORE: ${this.score}  |  BALLS: ${this.ballsSpawned}`, startX + 10, startY + 60);

    // Interactive Hint on bottom screen center
    const hintText = 'TAP/CLICK: Impulse Shockwave  |  ARROWS/WASD: Tilt Gravity  |  BOTTOM: Move Paddle';
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'center';
    ctx.fillText(hintText, mainCanvasSize.x / 2, mainCanvasSize.y - 14);

    ctx.restore();
  }
}

export const hud = new DebugHud();
