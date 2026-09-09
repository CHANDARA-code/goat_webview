import Phaser from 'phaser';

export interface HudStats {
  fps: number;
  frameDelta: number;
  physicsBodies: number;
  score: number;
  gemsRemaining: number;
  status: string;
}

export class DebugHUD {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private bgGraphic!: Phaser.GameObjects.Graphics;
  private headerText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;
  private width: number = 240;
  private height: number = 72;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.create();
  }

  private create(): void {
    this.container = this.scene.add.container(12, 12);
    this.container.setScrollFactor(0);
    this.container.setDepth(9999);

    // Semi-transparent background card with rounded corners and neon border
    this.bgGraphic = this.scene.add.graphics();
    this.drawBackground();
    this.container.add(this.bgGraphic);

    // Title label
    this.headerText = this.scene.add.text(10, 8, 'PHASER 3 ARCADE // HUD', {
      fontFamily: 'monospace, "Courier New", Courier',
      fontSize: '11px',
      color: '#00f0ff',
      fontStyle: 'bold',
    });
    this.container.add(this.headerText);

    // Live telemetry text
    this.statsText = this.scene.add.text(10, 26, 'INITIALIZING...', {
      fontFamily: 'monospace, "Courier New", Courier',
      fontSize: '11px',
      color: '#00ff66',
      lineSpacing: 4,
    });
    this.container.add(this.statsText);
  }

  private drawBackground(): void {
    this.bgGraphic.clear();
    // Dark translucent background
    this.bgGraphic.fillStyle(0x0f172a, 0.85);
    this.bgGraphic.fillRoundedRect(0, 0, this.width, this.height, 6);

    // Subtle neon border
    this.bgGraphic.lineStyle(1, 0x00f0ff, 0.4);
    this.bgGraphic.strokeRoundedRect(0, 0, this.width, this.height, 6);
  }

  public update(stats: HudStats): void {
    const fpsColor = stats.fps >= 55 ? '#00ff66' : stats.fps >= 30 ? '#ffea00' : '#ff3366';
    this.statsText.setText([
      `FPS: ${Math.round(stats.fps)} | DELTA: ${stats.frameDelta.toFixed(1)}ms`,
      `BODIES: ${stats.physicsBodies} | GEMS: ${stats.score}`,
    ]);
    this.statsText.setColor(fpsColor);
  }

  public resize(x: number = 12, y: number = 12): void {
    if (this.container) {
      this.container.setPosition(x, y);
    }
  }

  public destroy(): void {
    if (this.container) {
      this.container.destroy();
    }
  }
}
