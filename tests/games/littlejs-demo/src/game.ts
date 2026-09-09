import {
  EngineObject,
  ParticleEmitter,
  Vector2,
  vec2,
  Color,
  gravity,
  timeDelta,
  PI,
  rand,
  randInCircle,
  drawCircle,
  drawCircleGradient,
  drawRect,
  drawRectGradient,
  drawTextScreen,
  mainCanvasSize,
  mousePos,
  mouseIsDown,
  mouseWasPressed,
  keyIsDown,
  keyWasPressed,
  engineObjects,
} from 'littlejsengine';

import {
  initAudio,
  playBounceSound,
  playBumperSound,
  playShockwaveSound,
  playScoreSound,
  playSpawnSound,
} from './audio';

import { hud } from './hud';

// Color Palette
const COLOR_CYAN = new Color(0, 0.9, 1, 1);
const COLOR_CYAN_DIM = new Color(0, 0.6, 0.8, 0.6);
const COLOR_MAGENTA = new Color(1, 0.2, 0.8, 1);
const COLOR_GOLD = new Color(1, 0.85, 0.1, 1);
const COLOR_WHITE = new Color(1, 1, 1, 1);
const COLOR_CLEAR = new Color(1, 1, 1, 0);
const COLOR_SLATE = new Color(0.12, 0.16, 0.25, 0.95);
const COLOR_NEON_GREEN = new Color(0.1, 1, 0.4, 1);
const COLOR_ORANGE = new Color(1, 0.5, 0.1, 1);

const BALL_COLORS = [
  new Color(0, 0.95, 1, 1),
  new Color(1, 0.25, 0.8, 1),
  new Color(1, 0.85, 0.15, 1),
  new Color(0.2, 1, 0.45, 1),
  new Color(0.9, 0.4, 1, 1),
  new Color(1, 0.45, 0.1, 1),
];

/**
 * Procedural Particle Emitter Generators
 */
export function spawnSparkBurst(pos: Vector2, colorA: Color, colorB: Color): ParticleEmitter {
  return new ParticleEmitter(
    pos,
    0,
    0.3,                          // emitSize
    0.08,                         // emitTime (short burst)
    120,                          // emitRate
    PI * 2,                       // emitConeAngle (full circle)
    undefined,                    // tileInfo (procedural)
    colorA,
    colorB,
    colorA.copy().setAlpha(0),
    colorB.copy().setAlpha(0),
    0.35,                         // particleTime
    0.22,                         // sizeStart
    0.02,                         // sizeEnd
    0.14,                         // speed
    0.1,                          // angleSpeed
    0.92,                         // damping
    1.0,                          // angleDamping
    0.3,                          // gravityScale
    PI,                           // particleConeAngle
    0.2,                          // fadeRate
    0.4,                          // randomness
    false,                        // collideTiles
    true                          // additive blend
  );
}

export function spawnBumperBurst(pos: Vector2): ParticleEmitter {
  return new ParticleEmitter(
    pos,
    0,
    0.6,
    0.12,
    180,
    PI * 2,
    undefined,
    COLOR_MAGENTA,
    COLOR_GOLD,
    new Color(1, 0, 0.5, 0),
    new Color(1, 0.7, 0, 0),
    0.5,
    0.32,
    0.04,
    0.2,
    0.2,
    0.93,
    1.0,
    0.2,
    PI,
    0.15,
    0.5,
    false,
    true
  );
}

export function spawnShockwaveParticles(pos: Vector2): ParticleEmitter {
  return new ParticleEmitter(
    pos,
    0,
    0.8,
    0.1,
    220,
    PI * 2,
    undefined,
    COLOR_CYAN,
    COLOR_WHITE,
    COLOR_CLEAR,
    COLOR_CLEAR,
    0.4,
    0.3,
    0.03,
    0.26,
    0.1,
    0.9,
    1.0,
    0,
    PI,
    0.2,
    0.3,
    false,
    true
  );
}

export function spawnScoreFountain(pos: Vector2, color: Color): ParticleEmitter {
  return new ParticleEmitter(
    pos,
    PI / 2,                       // angle upwards
    1.2,
    0.2,
    160,
    PI / 3,                       // 60-degree cone upwards
    undefined,
    color,
    COLOR_WHITE,
    color.copy().setAlpha(0),
    COLOR_CLEAR,
    0.7,
    0.28,
    0.04,
    0.28,
    0.15,
    0.94,
    1.0,
    0.8,                          // gravity pulls particles back down like fireworks
    PI / 4,
    0.15,
    0.5,
    false,
    true
  );
}

/**
 * Expanding Shockwave entity for tap/click repulsion
 */
export class ShockwaveEffect extends EngineObject {
  private radius = 0.5;
  private maxRadius = 4.2;
  private life = 0.28;
  private elapsed = 0;

  constructor(pos: Vector2) {
    super(pos, vec2(0.1, 0.1), undefined, 0, COLOR_CYAN, 50);
    this.mass = 0;
    this.isSolid = false;
    this.collideSolidObjects = false;
  }

  override update(): void {
    this.elapsed += timeDelta;
    const t = this.elapsed / this.life;
    this.radius = lerp(0.5, this.maxRadius, t);

    // Push dynamic physics balls outward
    for (let i = 0; i < engineObjects.length; i++) {
      const obj = engineObjects[i];
      if (obj instanceof PhysicsBall && !obj.destroyed) {
        const delta = obj.pos.subtract(this.pos);
        const dist = delta.length();
        if (dist > 0.05 && dist < this.radius + 1.2) {
          const impulseStrength = (1 - dist / (this.maxRadius + 1.2)) * 0.24;
          const force = delta.normalize().scale(impulseStrength);
          obj.velocity = obj.velocity.add(force);
        }
      }
    }

    if (this.elapsed >= this.life) {
      this.destroy();
    }
  }

  override render(): void {
    const alpha = Math.max(0, 1 - this.elapsed / this.life);
    const ringColor = new Color(0, 0.9, 1, alpha * 0.85);
    drawCircle(this.pos, this.radius * 2, undefined, 0.22, ringColor);
  }
}

/**
 * Dynamic Physics Orb / Ball
 */
export class PhysicsBall extends EngineObject {
  private trailTimer = 0;

  constructor(pos: Vector2, velocity: Vector2 = vec2(0, 0)) {
    const colorIndex = Math.floor(rand(0, BALL_COLORS.length));
    const ballColor = BALL_COLORS[colorIndex].copy();

    super(pos, vec2(0.85, 0.85), undefined, 0, ballColor, 10);
    this.mass = 1;
    this.restitution = 0.82;
    this.damping = 0.998;
    this.friction = 0.12;
    this.gravityScale = 1.0;
    this.isSolid = true;
    this.collideSolidObjects = true;
    this.velocity = velocity;

    hud.ballsSpawned++;
  }

  override update(): void {
    super.update();

    // Spawn tiny trail sparkles when moving rapidly
    this.trailTimer += timeDelta;
    if (this.trailTimer > 0.08 && this.velocity.length() > 0.12) {
      this.trailTimer = 0;
      spawnSparkBurst(this.pos, this.color, COLOR_WHITE);
    }

    // Safety boundary cleanup
    if (this.pos.y < -15 || this.pos.y > 18 || Math.abs(this.pos.x) > 13) {
      this.destroy();
    }
  }

  override render(): void {
    // Glowing radial shaded sphere
    const innerColor = COLOR_WHITE;
    const outerColor = this.color;
    drawCircleGradient(this.pos, this.size.x, innerColor, outerColor);
    // Outer crisp rim
    drawCircle(this.pos, this.size.x, undefined, 0.05, COLOR_WHITE);
  }
}

/**
 * Static Bouncy Peg
 */
export class BouncyPeg extends EngineObject {
  private flashTimer = 0;
  private readonly baseColor: Color;

  constructor(pos: Vector2, color: Color = COLOR_GOLD) {
    super(pos, vec2(0.75, 0.75), undefined, 0, color, 5);
    this.mass = 0;
    this.restitution = 0.95;
    this.isSolid = true;
    this.collideSolidObjects = true;
    this.baseColor = color.copy();
  }

  override collideWithObject(other: EngineObject): boolean {
    if (other instanceof PhysicsBall) {
      this.flashTimer = 0.22;
      spawnSparkBurst(this.pos, this.baseColor, COLOR_WHITE);
      playBounceSound(this.pos, 0.9 + rand(0, 0.35));
      hud.score += 10;
    }
    return true;
  }

  override update(): void {
    if (this.flashTimer > 0) {
      this.flashTimer -= timeDelta;
    }
  }

  override render(): void {
    const isFlashing = this.flashTimer > 0;
    const inner = isFlashing ? COLOR_WHITE : this.baseColor;
    const outer = isFlashing ? COLOR_CYAN : this.baseColor.copy().scale(0.6, 1);

    drawCircleGradient(this.pos, this.size.x, inner, outer);
    drawCircle(this.pos, this.size.x, undefined, 0.06, isFlashing ? COLOR_WHITE : COLOR_SLATE);
  }
}

/**
 * Kinetic Super-Bumper
 */
export class KineticBumper extends EngineObject {
  private pulseTimer = 0;
  private readonly baseRadius = 1.35;

  constructor(pos: Vector2) {
    super(pos, vec2(2.7, 2.7), undefined, 0, COLOR_MAGENTA, 6);
    this.mass = 0;
    this.restitution = 1.6;
    this.isSolid = true;
    this.collideSolidObjects = true;
  }

  override collideWithObject(other: EngineObject): boolean {
    if (other instanceof PhysicsBall) {
      this.pulseTimer = 0.3;

      // Radial impulse boost away from bumper center
      const delta = other.pos.subtract(this.pos);
      const dir = delta.length() > 0.01 ? delta.normalize() : vec2(0, 1);
      other.velocity = dir.scale(0.28);

      spawnBumperBurst(this.pos);
      playBumperSound(this.pos, 1.15);
      hud.score += 50;
    }
    return true;
  }

  override update(): void {
    if (this.pulseTimer > 0) {
      this.pulseTimer -= timeDelta;
    }
  }

  override render(): void {
    const isPulsing = this.pulseTimer > 0;
    const pulseScale = isPulsing ? 1.12 : 1.0;
    const radius = this.baseRadius * pulseScale;

    // Glowing core & outer bumper ring
    drawCircleGradient(this.pos, radius * 2, isPulsing ? COLOR_WHITE : COLOR_MAGENTA, isPulsing ? COLOR_GOLD : COLOR_MAGENTA.copy().scale(0.4, 1));
    drawCircle(this.pos, radius * 2, undefined, 0.14, isPulsing ? COLOR_GOLD : COLOR_CYAN);
    drawCircle(this.pos, radius * 1.2, undefined, 0.08, COLOR_WHITE);
  }
}

/**
 * Player-controlled Paddle / Flipper
 */
export class Paddle extends EngineObject {
  private targetX = 0;

  constructor(pos: Vector2 = vec2(0, -10.2)) {
    super(pos, vec2(3.6, 0.65), undefined, 0, COLOR_CYAN, 8);
    this.mass = 0;
    this.restitution = 1.35;
    this.isSolid = true;
    this.collideSolidObjects = true;
  }

  override collideWithObject(other: EngineObject): boolean {
    if (other instanceof PhysicsBall) {
      // Direct angle deflection based on hit location along paddle
      const hitOffset = (other.pos.x - this.pos.x) / (this.size.x / 2);
      other.velocity.x += hitOffset * 0.16;
      other.velocity.y = Math.max(other.velocity.y, 0.24);

      spawnSparkBurst(other.pos, COLOR_CYAN, COLOR_WHITE);
      playBounceSound(this.pos, 1.3);
      hud.score += 15;
    }
    return true;
  }

  override update(): void {
    // Keyboard paddle movement
    let moveDelta = 0;
    if (keyIsDown('ArrowLeft') || keyIsDown('KeyA')) moveDelta -= 0.28;
    if (keyIsDown('ArrowRight') || keyIsDown('KeyD')) moveDelta += 0.28;

    if (moveDelta !== 0) {
      this.targetX = clamp(this.pos.x + moveDelta, -6.6, 6.6);
      this.pos.x = this.targetX;
    } else if (mouseIsDown(0) && mousePos.y <= -7.0) {
      // Touch follow at bottom screen area
      this.targetX = clamp(mousePos.x, -6.6, 6.6);
      this.pos.x = lerp(this.pos.x, this.targetX, 0.25);
    }
  }

  override render(): void {
    // Sleek rounded paddle with neon cyan border
    drawRect(this.pos, this.size, COLOR_CYAN_DIM);
    drawRect(this.pos, vec2(this.size.x - 0.2, this.size.y - 0.2), COLOR_CYAN);
    drawRect(this.pos, vec2(this.size.x - 0.6, 0.12), COLOR_WHITE);
  }
}

/**
 * Static Level Wall Border
 */
export class BoundaryWall extends EngineObject {
  constructor(pos: Vector2, size: Vector2, angle = 0) {
    super(pos, size, undefined, angle, COLOR_SLATE, 1);
    this.mass = 0;
    this.restitution = 0.65;
    this.isSolid = true;
    this.collideSolidObjects = true;
  }

  override render(): void {
    drawRect(this.pos, this.size, COLOR_SLATE, this.angle);
    drawRect(this.pos, vec2(this.size.x * 0.95, this.size.y * 0.95), new Color(0.18, 0.24, 0.38, 0.8), this.angle);
  }
}

/**
 * Bottom Scoring Catchers
 */
export class ScoringZone extends EngineObject {
  public readonly points: number;
  public readonly zoneColor: Color;

  constructor(pos: Vector2, size: Vector2, points: number, color: Color) {
    super(pos, size, undefined, 0, color, 2);
    this.mass = 0;
    this.isSolid = false; // Balls fall inside!
    this.collideSolidObjects = false;
    this.points = points;
    this.zoneColor = color;
  }

  override update(): void {
    for (let i = 0; i < engineObjects.length; i++) {
      const obj = engineObjects[i];
      if (obj instanceof PhysicsBall && !obj.destroyed) {
        // Check overlap with scoring bucket
        const dx = Math.abs(obj.pos.x - this.pos.x);
        const dy = Math.abs(obj.pos.y - this.pos.y);
        if (dx < this.size.x / 2 && dy < this.size.y / 2) {
          // Scored!
          hud.score += this.points;
          hud.ballsScored++;
          spawnScoreFountain(this.pos, this.zoneColor);
          playScoreSound(this.pos);
          obj.destroy();
        }
      }
    }
  }

  override render(): void {
    // Cup receptacle
    drawRect(this.pos, this.size, this.zoneColor.copy().setAlpha(0.2));
    drawRect(this.pos, vec2(this.size.x, 0.12), this.zoneColor);
  }
}

/**
 * Helper function: lerp
 */
function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * Math.min(Math.max(t, 0), 1);
}

/**
 * Helper function: clamp
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Core Game Controller & Arena Manager
 */
export class GameController {
  private autoSpawnTimer = 0;
  private paddle: Paddle | null = null;
  private defaultGravity = vec2(0, -0.9);

  public init(): void {
    initAudio();
    this.buildArena();
    this.spawnInitialBalls(4);
  }

  private buildArena(): void {
    // Outer Walls: Width 18, Height 26
    new BoundaryWall(vec2(-8.8, 0), vec2(0.6, 26));       // Left Wall
    new BoundaryWall(vec2(8.8, 0), vec2(0.6, 26));        // Right Wall
    new BoundaryWall(vec2(0, 13.0), vec2(18.2, 0.6));     // Top Wall

    // Angled Funnel Guides at Top
    new BoundaryWall(vec2(-6.0, 10.5), vec2(4.5, 0.5), -0.45);
    new BoundaryWall(vec2(6.0, 10.5), vec2(4.5, 0.5), 0.45);

    // Bouncy Peg Field (Hexagonal / Staggered Grid)
    const rowConfigs = [
      { y: 8.0, count: 5, spacing: 2.6 },
      { y: 6.2, count: 6, spacing: 2.4 },
      { y: 4.4, count: 5, spacing: 2.6 },
      { y: 2.6, count: 6, spacing: 2.4 },
      { y: 0.8, count: 5, spacing: 2.6 },
      { y: -1.0, count: 6, spacing: 2.4 },
      { y: -2.8, count: 5, spacing: 2.6 },
      { y: -4.6, count: 6, spacing: 2.4 },
    ];

    rowConfigs.forEach((cfg, rIndex) => {
      const startX = -((cfg.count - 1) * cfg.spacing) / 2;
      const rowColor = rIndex % 2 === 0 ? COLOR_GOLD : COLOR_CYAN;
      for (let i = 0; i < cfg.count; i++) {
        const x = startX + i * cfg.spacing;
        new BouncyPeg(vec2(x, cfg.y), rowColor);
      }
    });

    // Kinetic Super-Bumpers
    new KineticBumper(vec2(-4.2, 1.8));
    new KineticBumper(vec2(4.2, 1.8));
    new KineticBumper(vec2(0, 5.2));

    // Player Paddle
    this.paddle = new Paddle(vec2(0, -10.2));

    // Bottom Scoring Catchers: 5 Buckets
    const buckets = [
      { x: -6.4, pts: 100, color: COLOR_CYAN },
      { x: -3.2, pts: 250, color: COLOR_MAGENTA },
      { x: 0.0,  pts: 500, color: COLOR_GOLD },
      { x: 3.2,  pts: 250, color: COLOR_MAGENTA },
      { x: 6.4,  pts: 100, color: COLOR_CYAN },
    ];

    // Bucket Dividers
    for (let x = -8.0; x <= 8.0; x += 3.2) {
      new BoundaryWall(vec2(x, -11.8), vec2(0.2, 2.2));
    }
    // Bottom Floor
    new BoundaryWall(vec2(0, -13.0), vec2(18.2, 0.6));

    buckets.forEach((b) => {
      new ScoringZone(vec2(b.x, -12.0), vec2(3.0, 1.6), b.pts, b.color);
    });
  }

  private spawnInitialBalls(count = 4): void {
    for (let i = 0; i < count; i++) {
      const x = rand(-4.0, 4.0);
      const y = 11.0 + i * 0.6;
      new PhysicsBall(vec2(x, y), vec2(rand(-0.06, 0.06), rand(-0.05, 0)));
    }
  }

  public update(): void {
    hud.update();

    // Auto-replenish balls if fewer than 3 are active
    let activeBallCount = 0;
    for (let i = 0; i < engineObjects.length; i++) {
      if (engineObjects[i] instanceof PhysicsBall && !engineObjects[i].destroyed) {
        activeBallCount++;
      }
    }

    this.autoSpawnTimer += timeDelta;
    if (activeBallCount < 3 && this.autoSpawnTimer > 1.8) {
      this.autoSpawnTimer = 0;
      new PhysicsBall(vec2(rand(-3.5, 3.5), 12.0), vec2(rand(-0.05, 0.05), -0.05));
      playSpawnSound();
    }

    // Input Handling: Touch Taps / Clicks
    if (mouseWasPressed(0)) {
      if (mousePos.y > -7.0) {
        // Spawn repulsive shockwave
        new ShockwaveEffect(mousePos);
        spawnShockwaveParticles(mousePos);
        playShockwaveSound(mousePos);
      }
    }

    // Manual Ball Drop: Spacebar
    if (keyWasPressed('Space')) {
      new PhysicsBall(vec2(rand(-3.0, 3.0), 12.0), vec2(rand(-0.04, 0.04), -0.05));
      playSpawnSound();
    }

    // Reset Balls: Key R
    if (keyWasPressed('KeyR')) {
      for (let i = 0; i < engineObjects.length; i++) {
        if (engineObjects[i] instanceof PhysicsBall) {
          engineObjects[i].destroy();
        }
      }
      this.spawnInitialBalls(4);
    }

    // Keyboard Gravity Tilting (Physical Machine Tilt Simulation)
    let tiltX = 0;
    if (keyIsDown('ArrowLeft') || keyIsDown('KeyA')) tiltX -= 0.35;
    if (keyIsDown('ArrowRight') || keyIsDown('KeyD')) tiltX += 0.35;

    let tiltY = this.defaultGravity.y;
    if (keyIsDown('ArrowUp') || keyIsDown('KeyW')) tiltY = -0.45;
    if (keyIsDown('ArrowDown') || keyIsDown('KeyS')) tiltY = -1.35;

    gravity.x = lerp(gravity.x, tiltX, 0.1);
    gravity.y = lerp(gravity.y, tiltY, 0.1);
  }

  public render(): void {
    // Background playfield decorative grid/vignette
    drawRectGradient(
      vec2(0, 0),
      vec2(17.4, 25.4),
      new Color(0.06, 0.09, 0.16, 0.95),
      new Color(0.03, 0.04, 0.08, 0.98)
    );
  }

  public renderPost(): void {
    // Render Debug HUD
    hud.render();
  }
}

export const gameController = new GameController();
