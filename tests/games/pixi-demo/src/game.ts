import { Application, Graphics, Text, TextStyle, Container, Ticker } from 'pixi.js';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Ball {
  gfx: Graphics;
  vx: number;
  vy: number;
  radius: number;
  color: number;
  trail: { x: number; y: number }[];
}

interface Star {
  gfx: Graphics;
  x: number;
  y: number;
  speed: number;
  size: number;
}

interface RuntimeStats {
  engine: string;
  status: string;
  fps: number;
  frameTime: number;
  ballCount: number;
  particleCount: number;
}

// ─── PixiJS Bouncing Balls Game ──────────────────────────────────────────────

export class PixiGame {
  private app: Application;
  private balls: Ball[] = [];
  private stars: Star[] = [];
  private hudText!: Text;
  private scoreText!: Text;
  private worldContainer!: Container;
  private hudContainer!: Container;
  private score = 0;
  private frameCount = 0;
  private lastFpsTime = 0;
  private currentFps = 0;
  private touchStartX = 0;
  private touchStartY = 0;
  private isDisposed = false;

  constructor(app: Application) {
    this.app = app;
    this.init();
  }

  private init(): void {
    const { width, height } = this.app.screen;

    // World layer (game objects)
    this.worldContainer = new Container();
    this.app.stage.addChild(this.worldContainer);

    // Stars background
    this.createStarfield(width, height);

    // Initial balls
    for (let i = 0; i < 8; i++) {
      this.spawnBall();
    }

    // HUD layer (always on top)
    this.hudContainer = new Container();
    this.app.stage.addChild(this.hudContainer);
    this.createHUD();

    // Input
    this.setupInput();

    // Resize handler
    window.addEventListener('resize', this.onResize);

    // Expose stats for E2E testing
    (window as unknown as Record<string, unknown>)['pixiStats'] = () => this.getStats();
    (window as unknown as Record<string, unknown>)['pixiDispose'] = () => this.dispose();
  }

  // ── Starfield ──────────────────────────────────────────────────────────────

  private createStarfield(w: number, h: number): void {
    for (let i = 0; i < 80; i++) {
      const g = new Graphics();
      const star: Star = {
        gfx: g,
        x: Math.random() * w,
        y: Math.random() * h,
        speed: 0.2 + Math.random() * 0.6,
        size: 0.5 + Math.random() * 1.5,
      };
      g.circle(0, 0, star.size).fill({ color: 0xffffff, alpha: 0.4 + Math.random() * 0.6 });
      g.x = star.x;
      g.y = star.y;
      this.worldContainer.addChild(g);
      this.stars.push(star);
    }
  }

  // ── Balls ─────────────────────────────────────────────────────────────────

  private spawnBall(): void {
    const { width, height } = this.app.screen;
    const radius = 14 + Math.random() * 22;
    const colors = [0xff4466, 0x44aaff, 0x44ff88, 0xffaa22, 0xcc44ff, 0xff8844, 0x22ddff];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const g = new Graphics();
    g.circle(0, 0, radius)
      .fill({ color, alpha: 0.9 })
      .stroke({ color: 0xffffff, alpha: 0.3, width: 1.5 });

    const ball: Ball = {
      gfx: g,
      vx: (2 + Math.random() * 4) * (Math.random() < 0.5 ? 1 : -1),
      vy: (2 + Math.random() * 4) * (Math.random() < 0.5 ? 1 : -1),
      radius,
      color,
      trail: [],
    };
    ball.gfx.x = radius + Math.random() * (width - radius * 2);
    ball.gfx.y = radius + Math.random() * (height - radius * 2);

    this.worldContainer.addChild(g);
    this.balls.push(ball);
  }

  // ── HUD ───────────────────────────────────────────────────────────────────

  private createHUD(): void {
    const hudStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 11,
      fill: 0x00ff88,
      stroke: { color: 0x000000, width: 3 },
      dropShadow: { color: 0x000000, blur: 4, distance: 0 },
    });

    this.hudText = new Text({ text: 'FPS: --', style: hudStyle });
    this.hudText.x = 10;
    this.hudText.y = 10;
    this.hudContainer.addChild(this.hudText);

    const scoreStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 14,
      fontWeight: 'bold',
      fill: 0xffdd44,
      stroke: { color: 0x000000, width: 4 },
    });
    this.scoreText = new Text({ text: 'Score: 0', style: scoreStyle });
    this.scoreText.x = 10;
    this.scoreText.y = 32;
    this.hudContainer.addChild(this.scoreText);

    // Controls hint
    const hintStyle = new TextStyle({ fontFamily: 'monospace', fontSize: 10, fill: 0x88aacc });
    const hint = new Text({ text: 'Tap to spawn • Touch drag to push', style: hintStyle });
    hint.x = 10;
    const { height } = this.app.screen;
    hint.y = height - 24;
    this.hudContainer.addChild(hint);
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  private setupInput(): void {
    this.app.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.app.canvas.addEventListener('pointermove', this.onPointerMove);
    this.app.canvas.addEventListener('pointerup', this.onPointerUp);
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.touchStartX = e.clientX;
    this.touchStartY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (e.buttons === 0) return;
    const dx = e.clientX - this.touchStartX;
    const dy = e.clientY - this.touchStartY;
    // Push nearby balls
    for (const ball of this.balls) {
      const bx = ball.gfx.x;
      const by = ball.gfx.y;
      const dist = Math.sqrt((e.clientX - bx) ** 2 + (e.clientY - by) ** 2);
      if (dist < 80) {
        const force = (80 - dist) / 80;
        ball.vx += (dx * 0.1 * force);
        ball.vy += (dy * 0.1 * force);
        // Clamp speed
        const speed = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
        if (speed > 12) { ball.vx *= 12 / speed; ball.vy *= 12 / speed; }
      }
    }
    this.touchStartX = e.clientX;
    this.touchStartY = e.clientY;
  };

  private onPointerUp = (e: PointerEvent): void => {
    // Tap = spawn a ball at tap position
    const dx = e.clientX - this.touchStartX;
    const dy = e.clientY - this.touchStartY;
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5 && this.balls.length < 40) {
      this.spawnBall();
      this.score += 10;
    }
  };

  // ── Main Update ──────────────────────────────────────────────────────────

  update(ticker: Ticker): void {
    if (this.isDisposed) return;
    const dt = ticker.deltaTime; // normalized (1 = 16.67ms)
    const { width, height } = this.app.screen;

    // Update stars (parallax drift)
    for (const star of this.stars) {
      star.x -= star.speed * dt * 0.3;
      if (star.x < -2) star.x = width + 2;
      star.gfx.x = star.x;
    }

    // Update balls
    for (const ball of this.balls) {
      ball.gfx.x += ball.vx * dt;
      ball.gfx.y += ball.vy * dt;

      // Wall bounce
      if (ball.gfx.x - ball.radius < 0) { ball.gfx.x = ball.radius; ball.vx = Math.abs(ball.vx); this.score++; }
      if (ball.gfx.x + ball.radius > width) { ball.gfx.x = width - ball.radius; ball.vx = -Math.abs(ball.vx); this.score++; }
      if (ball.gfx.y - ball.radius < 0) { ball.gfx.y = ball.radius; ball.vy = Math.abs(ball.vy); this.score++; }
      if (ball.gfx.y + ball.radius > height) { ball.gfx.y = height - ball.radius; ball.vy = -Math.abs(ball.vy); this.score++; }

      // Ball-ball collision
      for (const other of this.balls) {
        if (other === ball) continue;
        const dx = other.gfx.x - ball.gfx.x;
        const dy = other.gfx.y - ball.gfx.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = ball.radius + other.radius;
        if (dist < minDist && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;
          ball.gfx.x -= nx * overlap * 0.5;
          ball.gfx.y -= ny * overlap * 0.5;
          other.gfx.x += nx * overlap * 0.5;
          other.gfx.y += ny * overlap * 0.5;
          // Elastic bounce
          const dvx = ball.vx - other.vx;
          const dvy = ball.vy - other.vy;
          const dot = dvx * nx + dvy * ny;
          if (dot > 0) {
            ball.vx -= dot * nx;
            ball.vy -= dot * ny;
            other.vx += dot * nx;
            other.vy += dot * ny;
          }
          this.score += 5;
        }
      }
    }

    // FPS tracking
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    // Update HUD
    this.hudText.text =
      `FPS: ${this.currentFps}  |  Frame: ${ticker.deltaMS.toFixed(1)}ms\n` +
      `Balls: ${this.balls.length}  |  Engine: PixiJS v8`;
    this.scoreText.text = `Score: ${this.score}`;
  }

  // ── Resize ────────────────────────────────────────────────────────────────

  private onResize = (): void => {
    // App auto-resizes; clamp balls to new bounds
    const { width, height } = this.app.screen;
    for (const ball of this.balls) {
      ball.gfx.x = Math.min(Math.max(ball.gfx.x, ball.radius), width - ball.radius);
      ball.gfx.y = Math.min(Math.max(ball.gfx.y, ball.radius), height - ball.radius);
    }
  };

  // ── Stats & Teardown ──────────────────────────────────────────────────────

  getStats(): RuntimeStats {
    return {
      engine: 'pixijs',
      status: this.isDisposed ? 'destroyed' : 'running',
      fps: this.currentFps,
      frameTime: this.app.ticker.deltaMS,
      ballCount: this.balls.length,
      particleCount: this.balls.length + this.stars.length,
    };
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    window.removeEventListener('resize', this.onResize);
    this.app.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.app.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.app.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.worldContainer.destroy({ children: true });
    this.hudContainer.destroy({ children: true });
  }
}
