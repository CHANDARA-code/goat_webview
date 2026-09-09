import Phaser from 'phaser';
import { SynthAudio } from '../audio';
import { DebugHUD } from '../hud';

export class MainScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private movingPlatforms!: Phaser.Physics.Arcade.Group;
  private gems!: Phaser.Physics.Arcade.Group;
  private hazards!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
  };

  // Virtual touch controls state
  private touchLeft: boolean = false;
  private touchRight: boolean = false;
  private touchJump: boolean = false;

  // Virtual controls display objects
  private controlsContainer!: Phaser.GameObjects.Container;
  private btnLeftBg!: Phaser.GameObjects.Arc;
  private btnRightBg!: Phaser.GameObjects.Arc;
  private btnJumpBg!: Phaser.GameObjects.Arc;

  // Particle emitters
  private gemEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private jumpEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private hitEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

  // Audio & HUD
  private audio!: SynthAudio;
  private hud!: DebugHUD;

  // Game state
  public score: number = 0;
  private isInvulnerable: boolean = false;
  private respawnX: number = 100;
  private respawnY: number = 700;
  private canDoubleJump: boolean = false;
  private jumpKeyReleased: boolean = true;

  constructor() {
    super({ key: 'MainScene' });
  }

  public init(): void {
    this.score = 0;
    this.isInvulnerable = false;
  }

  public preload(): void {
    // Generate all textures procedurally at runtime
    this.createProceduralTextures();
  }

  public create(): void {
    const worldWidth = 2400;
    const worldHeight = 900;

    // Configure physics world bounds
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    // Initialize procedural audio
    this.audio = new SynthAudio();
    if (this.sound && 'context' in this.sound) {
      const webAudioMgr = this.sound as Phaser.Sound.WebAudioSoundManager;
      this.audio.setContext(webAudioMgr.context);
    }

    // Audio unlock listener on first user interaction
    const unlockAudio = () => {
      this.audio.resume();
      this.input.off('pointerdown', unlockAudio);
    };
    this.input.on('pointerdown', unlockAudio);

    // Build world environment
    this.buildBackdrop(worldWidth, worldHeight);
    this.buildPlatforms(worldWidth, worldHeight);
    this.buildHazards();
    this.buildGems();

    // Particle emitters
    this.createParticleEmitters();

    // Player character
    this.createPlayer();

    // Colliders and triggers
    this.setupColliders();

    // Camera setup
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setBackgroundColor('#101528');

    // Controls setup
    this.setupKeyboardInput();
    this.setupVirtualTouchControls();

    // Debug HUD
    this.hud = new DebugHUD(this);

    // Responsive resize listener
    this.scale.on('resize', this.handleResize, this);
    this.handleResize(this.scale.gameSize);
  }

  /**
   * Procedural texture generator (100% offline, zero external images).
   */
  private createProceduralTextures(): void {
    // 1. Player Sprite (32x40)
    const gp = this.make.graphics({}, false);
    // Cyber runner body
    gp.fillStyle(0x0284c7, 1);
    gp.fillRoundedRect(4, 8, 24, 28, 5);
    // Helmet / Visor
    gp.fillStyle(0x0f172a, 1);
    gp.fillRoundedRect(6, 2, 20, 14, 4);
    // Glowing cyan visor strip
    gp.fillStyle(0x00f0ff, 1);
    gp.fillRect(8, 6, 16, 4);
    // Reactor core highlight
    gp.fillStyle(0x38bdf8, 1);
    gp.fillCircle(16, 22, 4);
    // Runner boots
    gp.fillStyle(0x1e293b, 1);
    gp.fillRect(6, 34, 8, 6);
    gp.fillRect(18, 34, 8, 6);
    gp.generateTexture('player_tex', 32, 40);
    gp.destroy();

    // 2. Platform Tile (64x24)
    const gplat = this.make.graphics({}, false);
    gplat.fillStyle(0x1e293b, 1);
    gplat.fillRoundedRect(0, 0, 64, 24, 4);
    // Neon top edge
    gplat.fillStyle(0x06b6d4, 1);
    gplat.fillRect(0, 0, 64, 4);
    // Metallic tech accents
    gplat.fillStyle(0x334155, 1);
    gplat.fillRect(8, 8, 6, 8);
    gplat.fillRect(28, 8, 8, 8);
    gplat.fillRect(48, 8, 6, 8);
    gplat.generateTexture('platform_tex', 64, 24);
    gplat.destroy();

    // 3. Moving Platform Tile (80x20)
    const gmove = this.make.graphics({}, false);
    gmove.fillStyle(0x312e81, 1);
    gmove.fillRoundedRect(0, 0, 80, 20, 4);
    gmove.fillStyle(0x818cf8, 1);
    gmove.fillRect(0, 0, 80, 3);
    gmove.generateTexture('moving_platform_tex', 80, 20);
    gmove.destroy();

    // 4. Collectible Gem (26x26)
    const gg = this.make.graphics({}, false);
    // Golden diamond shape
    gg.fillStyle(0xf59e0b, 1);
    gg.beginPath();
    gg.moveTo(13, 1);
    gg.lineTo(25, 13);
    gg.lineTo(13, 25);
    gg.lineTo(1, 13);
    gg.closePath();
    gg.fillPath();
    // Inner luminous highlight
    gg.fillStyle(0xfef08a, 1);
    gg.beginPath();
    gg.moveTo(13, 5);
    gg.lineTo(21, 13);
    gg.lineTo(13, 21);
    gg.lineTo(5, 13);
    gg.closePath();
    gg.fillPath();
    gg.generateTexture('gem_tex', 26, 26);
    gg.destroy();

    // 5. Hazard Spikes (32x22)
    const gh = this.make.graphics({}, false);
    gh.fillStyle(0xef4444, 1);
    // 3 triangular sharp spikes
    gh.beginPath();
    // Spike 1
    gh.moveTo(0, 22);
    gh.lineTo(5, 2);
    gh.lineTo(10, 22);
    // Spike 2
    gh.moveTo(11, 22);
    gh.lineTo(16, 0);
    gh.lineTo(21, 22);
    // Spike 3
    gh.moveTo(22, 22);
    gh.lineTo(27, 2);
    gh.lineTo(32, 22);
    gh.closePath();
    gh.fillPath();
    // Spike tips highlight
    gh.fillStyle(0xfca5a5, 1);
    gh.fillCircle(5, 4, 1.5);
    gh.fillCircle(16, 2, 1.5);
    gh.fillCircle(27, 4, 1.5);
    gh.generateTexture('hazard_tex', 32, 22);
    gh.destroy();

    // 6. Generic Spark Particle (10x10)
    const gpatt = this.make.graphics({}, false);
    gpatt.fillStyle(0xffffff, 1);
    gpatt.fillCircle(5, 5, 4);
    gpatt.generateTexture('spark_tex', 10, 10);
    gpatt.destroy();

    // 7. Dust Particle (8x8)
    const gdust = this.make.graphics({}, false);
    gdust.fillStyle(0x94a3b8, 0.8);
    gdust.fillCircle(4, 4, 3);
    gdust.generateTexture('dust_tex', 8, 8);
    gdust.destroy();
  }

  private buildBackdrop(width: number, height: number): void {
    // Parallax background grid lines & glowing cyber stars
    const bg = this.add.graphics();
    bg.setScrollFactor(0.2);

    // Tech grid lines
    bg.lineStyle(1, 0x1e293b, 0.5);
    for (let x = 0; x < width; x += 100) {
      bg.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y < height; y += 100) {
      bg.lineBetween(0, y, width, y);
    }

    // Distant cyber stars/nodes
    const rand = new Phaser.Math.RandomDataGenerator(['phaser-arcade-seed']);
    bg.fillStyle(0x38bdf8, 0.4);
    for (let i = 0; i < 80; i++) {
      const sx = rand.between(0, width);
      const sy = rand.between(0, height - 100);
      const r = rand.realInRange(1, 3);
      bg.fillCircle(sx, sy, r);
    }
  }

  private buildPlatforms(worldWidth: number, worldHeight: number): void {
    this.platforms = this.physics.add.staticGroup();

    // Continuous ground with pit gaps
    const groundY = worldHeight - 30;
    for (let x = 0; x < worldWidth; x += 64) {
      // Create hazard pit gaps around x=800..900 and x=1700..1800
      if ((x >= 832 && x <= 928) || (x >= 1664 && x <= 1760)) {
        continue;
      }
      this.platforms.create(x + 32, groundY, 'platform_tex');
    }

    // Elevated platform ledges across multiple vertical tiers
    const platformCoords = [
      // Tier 1 (Lower)
      { x: 220, y: 740 },
      { x: 380, y: 680 },
      { x: 540, y: 620 },
      { x: 740, y: 560 },
      // Pit bridge
      { x: 880, y: 650 },
      // Tier 2 (Mid)
      { x: 1040, y: 580 },
      { x: 1200, y: 500 },
      { x: 1360, y: 440 },
      { x: 1540, y: 520 },
      // Pit bridge 2
      { x: 1710, y: 640 },
      // Tier 3 (High altitude & secrets)
      { x: 1880, y: 560 },
      { x: 2040, y: 480 },
      { x: 2200, y: 400 },
      // Upper branch challenge
      { x: 1400, y: 280 },
      { x: 1200, y: 240 },
      { x: 1000, y: 200 },
      { x: 800, y: 240 },
      { x: 600, y: 280 },
      { x: 400, y: 340 },
    ];

    for (const pos of platformCoords) {
      this.platforms.create(pos.x, pos.y, 'platform_tex');
      // Place additional width for wider ledges
      this.platforms.create(pos.x + 64, pos.y, 'platform_tex');
    }

    // Moving platforms
    this.movingPlatforms = this.physics.add.group({
      allowGravity: false,
      immovable: true,
    });

    const mp1 = this.movingPlatforms.create(1050, 720, 'moving_platform_tex') as Phaser.Physics.Arcade.Sprite;
    mp1.setVelocityX(70);
    mp1.setBounce(1, 0);
    mp1.setCollideWorldBounds(true);

    const mp2 = this.movingPlatforms.create(1850, 420, 'moving_platform_tex') as Phaser.Physics.Arcade.Sprite;
    mp2.setVelocityY(60);
    mp2.setBounce(0, 1);
    mp2.setCollideWorldBounds(true);
  }

  private buildHazards(): void {
    this.hazards = this.physics.add.staticGroup();

    // Spikes in pits and platform obstacles
    const spikePositions = [
      { x: 860, y: 885 },
      { x: 892, y: 885 },
      { x: 1690, y: 885 },
      { x: 1722, y: 885 },
      { x: 600, y: 608 },
      { x: 1420, y: 428 },
      { x: 2100, y: 468 },
    ];

    for (const pos of spikePositions) {
      this.hazards.create(pos.x, pos.y, 'hazard_tex');
    }
  }

  private buildGems(): void {
    this.gems = this.physics.add.group({
      allowGravity: false,
      immovable: true,
    });

    const gemPositions = [
      { x: 220, y: 700 },
      { x: 380, y: 640 },
      { x: 540, y: 580 },
      { x: 740, y: 520 },
      { x: 880, y: 610 },
      { x: 1040, y: 540 },
      { x: 1200, y: 460 },
      { x: 1360, y: 400 },
      { x: 1540, y: 480 },
      { x: 1710, y: 600 },
      { x: 1880, y: 520 },
      { x: 2040, y: 440 },
      { x: 2200, y: 360 },
      // High branch
      { x: 1400, y: 240 },
      { x: 1200, y: 200 },
      { x: 1000, y: 160 },
      { x: 800, y: 200 },
      { x: 600, y: 240 },
      { x: 400, y: 300 },
    ];

    for (const pos of gemPositions) {
      const gem = this.gems.create(pos.x, pos.y, 'gem_tex') as Phaser.Physics.Arcade.Sprite;
      // Gentle floating animation
      this.tweens.add({
        targets: gem,
        y: pos.y - 8,
        duration: 1200 + Math.random() * 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private createParticleEmitters(): void {
    // Gem pickup sparkle burst
    this.gemEmitter = this.add.particles(0, 0, 'spark_tex', {
      lifespan: { min: 300, max: 600 },
      speed: { min: 80, max: 240 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xf59e0b, 0xfef08a, 0x00f0ff],
      blendMode: 'ADD',
      emitting: false,
    });
    this.gemEmitter.setDepth(1500);

    // Player jump dust puff
    this.jumpEmitter = this.add.particles(0, 0, 'dust_tex', {
      lifespan: { min: 200, max: 400 },
      speed: { min: 20, max: 80 },
      angle: { min: 200, max: 340 },
      scale: { start: 1.0, end: 0.1 },
      alpha: { start: 0.8, end: 0 },
      blendMode: 'NORMAL',
      emitting: false,
    });
    this.jumpEmitter.setDepth(1500);

    // Hazard hit sparks
    this.hitEmitter = this.add.particles(0, 0, 'spark_tex', {
      lifespan: { min: 200, max: 500 },
      speed: { min: 100, max: 300 },
      scale: { start: 1.4, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xef4444, 0xfca5a5, 0xffffff],
      blendMode: 'ADD',
      emitting: false,
    });
    this.hitEmitter.setDepth(1500);
  }

  private createPlayer(): void {
    this.player = this.physics.add.sprite(this.respawnX, this.respawnY, 'player_tex');
    this.player.setCollideWorldBounds(true);
    this.player.setBounce(0.05);
    this.player.setSize(20, 36);
    this.player.setOffset(6, 4);
    this.player.setDragX(700);
    this.player.setMaxVelocity(320, 750);
    this.player.setDepth(1000);
  }

  private setupColliders(): void {
    // Collisions with static platforms
    this.physics.add.collider(this.player, this.platforms, () => {
      if (this.player.body?.blocked.down) {
        this.canDoubleJump = true;
      }
    });

    // Collisions with moving platforms
    this.physics.add.collider(this.player, this.movingPlatforms, () => {
      if (this.player.body?.blocked.down) {
        this.canDoubleJump = true;
      }
    });

    // Overlap with collectible gems
    this.physics.add.overlap(this.player, this.gems, (playerObj, gemObj) => {
      this.handleGemCollect(gemObj as Phaser.Physics.Arcade.Sprite);
    });

    // Overlap with hazard spikes
    this.physics.add.overlap(this.player, this.hazards, () => {
      this.handleHazardHit();
    });
  }

  private handleGemCollect(gem: Phaser.Physics.Arcade.Sprite): void {
    if (!gem.active) return;

    // Trigger dynamic particle burst
    this.gemEmitter.explode(18, gem.x, gem.y);

    // Play procedural pickup chime
    this.audio.pickup();

    // Increment score
    this.score += 100;

    // Temporarily disable and respawn gem after 4 seconds
    gem.setActive(false);
    gem.setVisible(false);
    if (gem.body) {
      gem.body.enable = false;
    }

    this.time.delayedCall(4000, () => {
      gem.setActive(true);
      gem.setVisible(true);
      if (gem.body) {
        gem.body.enable = true;
      }
      this.gemEmitter.explode(8, gem.x, gem.y);
    });
  }

  private handleHazardHit(): void {
    if (this.isInvulnerable) return;

    this.isInvulnerable = true;

    // Audio and particles
    this.audio.bump();
    this.hitEmitter.explode(20, this.player.x, this.player.y);

    // Screen shake
    this.cameras.main.shake(150, 0.015);

    // Knockback rebound
    this.player.setVelocity(-180, -380);

    // Score penalty
    this.score = Math.max(0, this.score - 50);

    // Visual damage flash tint
    this.player.setTint(0xff3344);

    this.time.delayedCall(300, () => {
      this.player.clearTint();
    });

    this.time.delayedCall(800, () => {
      this.isInvulnerable = false;
    });
  }

  private setupKeyboardInput(): void {
    if (!this.input.keyboard) return;

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasdKeys = this.input.keyboard.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
    }) as {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
      SPACE: Phaser.Input.Keyboard.Key;
    };
  }

  private setupVirtualTouchControls(): void {
    this.controlsContainer = this.add.container(0, 0);
    this.controlsContainer.setScrollFactor(0);
    this.controlsContainer.setDepth(8000);

    const btnRadius = 34;

    // LEFT BUTTON
    this.btnLeftBg = this.add.circle(0, 0, btnRadius, 0x1e293b, 0.65);
    this.btnLeftBg.setStrokeStyle(2, 0x00f0ff, 0.5);
    this.btnLeftBg.setInteractive({ useHandCursor: true });
    const leftArrow = this.add.text(-8, -12, '◀', {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#00f0ff',
    });
    const leftContainer = this.add.container(0, 0, [this.btnLeftBg, leftArrow]);

    this.btnLeftBg.on('pointerdown', () => {
      this.touchLeft = true;
      this.btnLeftBg.setFillStyle(0x00f0ff, 0.5);
    });
    this.btnLeftBg.on('pointerup', () => {
      this.touchLeft = false;
      this.btnLeftBg.setFillStyle(0x1e293b, 0.65);
    });
    this.btnLeftBg.on('pointerout', () => {
      this.touchLeft = false;
      this.btnLeftBg.setFillStyle(0x1e293b, 0.65);
    });

    // RIGHT BUTTON
    this.btnRightBg = this.add.circle(0, 0, btnRadius, 0x1e293b, 0.65);
    this.btnRightBg.setStrokeStyle(2, 0x00f0ff, 0.5);
    this.btnRightBg.setInteractive({ useHandCursor: true });
    const rightArrow = this.add.text(-6, -12, '▶', {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#00f0ff',
    });
    const rightContainer = this.add.container(0, 0, [this.btnRightBg, rightArrow]);

    this.btnRightBg.on('pointerdown', () => {
      this.touchRight = true;
      this.btnRightBg.setFillStyle(0x00f0ff, 0.5);
    });
    this.btnRightBg.on('pointerup', () => {
      this.touchRight = false;
      this.btnRightBg.setFillStyle(0x1e293b, 0.65);
    });
    this.btnRightBg.on('pointerout', () => {
      this.touchRight = false;
      this.btnRightBg.setFillStyle(0x1e293b, 0.65);
    });

    // JUMP BUTTON (Bottom Right)
    this.btnJumpBg = this.add.circle(0, 0, btnRadius + 6, 0x1e293b, 0.7);
    this.btnJumpBg.setStrokeStyle(2, 0x00ff66, 0.6);
    this.btnJumpBg.setInteractive({ useHandCursor: true });
    const jumpArrow = this.add.text(-7, -14, '▲', {
      fontFamily: 'sans-serif',
      fontSize: '26px',
      color: '#00ff66',
    });
    const jumpContainer = this.add.container(0, 0, [this.btnJumpBg, jumpArrow]);

    this.btnJumpBg.on('pointerdown', () => {
      this.touchJump = true;
      this.btnJumpBg.setFillStyle(0x00ff66, 0.5);
    });
    this.btnJumpBg.on('pointerup', () => {
      this.touchJump = false;
      this.btnJumpBg.setFillStyle(0x1e293b, 0.7);
    });
    this.btnJumpBg.on('pointerout', () => {
      this.touchJump = false;
      this.btnJumpBg.setFillStyle(0x1e293b, 0.7);
    });

    // Global pointer up fallback so touches lifted outside don't get stuck
    this.input.on('pointerup', () => {
      if (!this.input.pointer1.isDown && !this.input.pointer2.isDown && !this.input.activePointer.isDown) {
        this.touchLeft = false;
        this.touchRight = false;
        this.touchJump = false;
        this.btnLeftBg.setFillStyle(0x1e293b, 0.65);
        this.btnRightBg.setFillStyle(0x1e293b, 0.65);
        this.btnJumpBg.setFillStyle(0x1e293b, 0.7);
      }
    });

    this.controlsContainer.add([leftContainer, rightContainer, jumpContainer]);
  }

  private layoutTouchControls(width: number, height: number): void {
    if (!this.controlsContainer) return;

    const leftContainer = this.controlsContainer.getAt(0) as Phaser.GameObjects.Container;
    const rightContainer = this.controlsContainer.getAt(1) as Phaser.GameObjects.Container;
    const jumpContainer = this.controlsContainer.getAt(2) as Phaser.GameObjects.Container;

    const bottomMargin = 60;
    const btnY = height - bottomMargin;

    if (leftContainer) {
      leftContainer.setPosition(60, btnY);
    }
    if (rightContainer) {
      rightContainer.setPosition(150, btnY);
    }
    if (jumpContainer) {
      jumpContainer.setPosition(width - 65, btnY);
    }
  }

  public handleResize(gameSize: Phaser.Structs.Size): void {
    const w = gameSize.width;
    const h = gameSize.height;

    // Reposition HUD
    if (this.hud) {
      this.hud.resize(12, 12);
    }

    // Reposition touch buttons
    this.layoutTouchControls(w, h);
  }

  public override update(_time: number, _delta: number): void {
    if (!this.player || !this.player.body) return;

    const onGround = this.player.body.blocked.down || this.player.body.touching.down;

    // Evaluate input states
    const isLeft =
      this.touchLeft ||
      this.cursors?.left.isDown ||
      this.wasdKeys?.A.isDown;

    const isRight =
      this.touchRight ||
      this.cursors?.right.isDown ||
      this.wasdKeys?.D.isDown;

    const isJumpPressed =
      this.touchJump ||
      this.cursors?.up.isDown ||
      this.wasdKeys?.W.isDown ||
      this.wasdKeys?.SPACE.isDown;

    // Horizontal movement acceleration
    const speed = 260;
    if (isLeft) {
      this.player.setVelocityX(-speed);
      this.player.setFlipX(true);
    } else if (isRight) {
      this.player.setVelocityX(speed);
      this.player.setFlipX(false);
    }

    // Jump handling with double jump capability
    if (isJumpPressed) {
      if (this.jumpKeyReleased) {
        if (onGround) {
          this.executeJump();
          this.canDoubleJump = true;
          this.jumpKeyReleased = false;
        } else if (this.canDoubleJump) {
          this.executeJump(true);
          this.canDoubleJump = false;
          this.jumpKeyReleased = false;
        }
      }
    } else {
      this.jumpKeyReleased = true;
    }

    // Level bounds pit recovery
    if (this.player.y > this.physics.world.bounds.height - 20) {
      this.handlePitFall();
    }

    // Update moving platforms boundary turnarounds
    this.updateMovingPlatforms();

    // Update HUD telemetry
    if (this.hud) {
      this.hud.update({
        fps: this.game.loop.actualFps,
        frameDelta: this.game.loop.delta,
        physicsBodies: this.physics.world.bodies.size,
        score: this.score,
        gemsRemaining: this.gems.countActive(true),
        status: 'RUNNING',
      });
    }
  }

  private executeJump(isDouble: boolean = false): void {
    const jumpPower = isDouble ? -440 : -500;
    this.player.setVelocityY(jumpPower);

    // Audio & particles
    this.audio.jump();
    this.jumpEmitter.explode(isDouble ? 12 : 8, this.player.x, this.player.y + 18);
  }

  private handlePitFall(): void {
    this.audio.bump();
    this.cameras.main.shake(180, 0.02);
    this.score = Math.max(0, this.score - 100);

    // Reset player position
    this.player.setPosition(this.respawnX, this.respawnY);
    this.player.setVelocity(0, 0);
  }

  private updateMovingPlatforms(): void {
    if (!this.movingPlatforms) return;

    this.movingPlatforms.children.iterate((platform) => {
      const p = platform as Phaser.Physics.Arcade.Sprite;
      if (!p || !p.body) return true;

      // Platform 1 bounces between x=900 and x=1350
      if (p.x <= 950 && p.body.velocity.x < 0) {
        p.setVelocityX(70);
      } else if (p.x >= 1350 && p.body.velocity.x > 0) {
        p.setVelocityX(-70);
      }

      // Platform 2 bounces between y=350 and y=550
      if (p.y <= 380 && p.body.velocity.y < 0) {
        p.setVelocityY(60);
      } else if (p.y >= 540 && p.body.velocity.y > 0) {
        p.setVelocityY(-60);
      }

      return true;
    });
  }

  public getActivePhysicsBodiesCount(): number {
    return this.physics.world ? this.physics.world.bodies.size : 0;
  }

  public destroy(): void {
    if (this.scale) {
      this.scale.off('resize', this.handleResize, this);
    }
    if (this.audio) {
      this.audio.destroy();
    }
    if (this.hud) {
      this.hud.destroy();
    }
  }
}
