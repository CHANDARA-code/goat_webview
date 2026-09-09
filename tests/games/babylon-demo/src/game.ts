import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  PointLight,
  ShadowGenerator,
  Animation,
  GlowLayer,
  DynamicTexture,
  Mesh,
  ActionManager,
  ExecuteCodeAction,
  ParticleSystem,
  Texture,
} from '@babylonjs/core';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BabylonStats {
  engine: string;
  status: string;
  fps: number;
  frameTime: number;
  drawCalls: number;
  activeMeshes: number;
  totalVertices: number;
}

// ─── Babylon.js Game Scene ────────────────────────────────────────────────────

export class BabylonGame {
  private engine: Engine;
  private scene: Scene;
  private canvas: HTMLCanvasElement;
  private shadowGen: ShadowGenerator | null = null;
  private orbs: Mesh[] = [];
  private hudMesh: Mesh | null = null;
  private hudTexture: DynamicTexture | null = null;
  private particleSystems: ParticleSystem[] = [];
  private score = 0;
  private isDisposed = false;
  private resizeObserver: ResizeObserver;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: false,
      antialias: true,
      adaptToDeviceRatio: true,
    });

    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.02, 0.02, 0.08, 1);

    this.setupScene();
    this.setupHUD();
    this.setupInput();
    this.startRenderLoop();

    this.resizeObserver = new ResizeObserver(() => this.engine.resize());
    this.resizeObserver.observe(canvas);

    // Expose for E2E
    (window as unknown as Record<string, unknown>)['babylonStats'] = () => this.getStats();
    (window as unknown as Record<string, unknown>)['babylonDispose'] = () => this.dispose();

    console.log('[Babylon.js Demo] Initialized — Babylon.js', Engine.Version);
  }

  // ── Scene Setup ────────────────────────────────────────────────────────────

  private setupScene(): void {
    const scene = this.scene;

    // Camera (arc-rotate — touch/mouse drag to orbit)
    const camera = new ArcRotateCamera('cam', -Math.PI / 4, Math.PI / 3.5, 22, Vector3.Zero(), scene);
    camera.lowerRadiusLimit = 8;
    camera.upperRadiusLimit = 40;
    camera.upperBetaLimit = Math.PI / 2.1;
    camera.attachControl(this.canvas, true);
    camera.wheelPrecision = 50;
    camera.pinchPrecision = 200;

    // Ambient light
    const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.3;
    hemi.diffuse = new Color3(0.4, 0.5, 0.9);

    // Main directional light with shadows
    const dirLight = new DirectionalLight('dir', new Vector3(-1, -2, -1), scene);
    dirLight.position = new Vector3(10, 20, 10);
    dirLight.intensity = 1.2;
    dirLight.diffuse = new Color3(1, 0.95, 0.85);

    this.shadowGen = new ShadowGenerator(1024, dirLight);
    this.shadowGen.useBlurExponentialShadowMap = true;
    this.shadowGen.blurKernel = 16;

    // Glow layer
    const glow = new GlowLayer('glow', scene);
    glow.intensity = 0.6;

    // Ground platform
    const ground = MeshBuilder.CreateBox('ground', { width: 20, height: 0.4, depth: 20 }, scene);
    ground.position.y = -2;
    const groundMat = new StandardMaterial('groundMat', scene);
    groundMat.diffuseColor = new Color3(0.08, 0.1, 0.2);
    groundMat.specularColor = new Color3(0.3, 0.3, 0.5);
    ground.material = groundMat;
    ground.receiveShadows = true;

    // Grid lines on ground
    this.addGridLines(ground);

    // Central rotating torus
    const torus = MeshBuilder.CreateTorus('torus', { diameter: 4, thickness: 0.3, tessellation: 64 }, scene);
    torus.position.y = 0;
    const torusMat = new StandardMaterial('torusMat', scene);
    torusMat.diffuseColor = new Color3(0.2, 0.8, 1);
    torusMat.emissiveColor = new Color3(0.1, 0.4, 0.6);
    torusMat.specularColor = new Color3(1, 1, 1);
    torusMat.specularPower = 64;
    torus.material = torusMat;
    this.shadowGen.addShadowCaster(torus);

    // Animate torus rotation
    const torusAnim = new Animation('torusRot', 'rotation.y', 60,
      Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
    torusAnim.setKeys([{ frame: 0, value: 0 }, { frame: 300, value: Math.PI * 2 }]);
    torus.animations = [torusAnim];
    scene.beginAnimation(torus, 0, 300, true);

    const torusAnim2 = new Animation('torusRot2', 'rotation.x', 60,
      Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
    torusAnim2.setKeys([{ frame: 0, value: 0 }, { frame: 180, value: Math.PI * 2 }]);
    torus.animations.push(torusAnim2);
    scene.beginDirectAnimation(torus, [torusAnim2], 0, 180, true);

    // Orbiting light orbs
    const orbColors: Color3[] = [
      new Color3(1, 0.3, 0.3),
      new Color3(0.3, 1, 0.5),
      new Color3(0.3, 0.5, 1),
      new Color3(1, 0.8, 0.2),
      new Color3(0.8, 0.3, 1),
    ];
    for (let i = 0; i < 5; i++) {
      this.createOrb(i, orbColors[i], scene);
    }

    // Floating cubes
    this.createFloatingCubes(scene);
  }

  private addGridLines(ground: Mesh): void {
    // Simple emissive lines via additional thin boxes
    const mat = new StandardMaterial('gridMat', this.scene);
    mat.emissiveColor = new Color3(0.1, 0.2, 0.5);
    mat.alpha = 0.4;
    for (let i = -9; i <= 9; i += 2) {
      const lineH = MeshBuilder.CreateBox(`gh${i}`, { width: 20, height: 0.01, depth: 0.02 }, this.scene);
      lineH.position.set(0, -1.79, i);
      lineH.material = mat;
      const lineV = MeshBuilder.CreateBox(`gv${i}`, { width: 0.02, height: 0.01, depth: 20 }, this.scene);
      lineV.position.set(i, -1.79, 0);
      lineV.material = mat;
    }
    void ground;
  }

  private createOrb(index: number, color: Color3, scene: Scene): void {
    const orb = MeshBuilder.CreateSphere(`orb${index}`, { diameter: 0.7, segments: 16 }, scene);
    const mat = new StandardMaterial(`orbMat${index}`, scene);
    mat.diffuseColor = color;
    mat.emissiveColor = color.scale(0.6);
    mat.specularColor = Color3.White();
    orb.material = mat;
    this.shadowGen?.addShadowCaster(orb);

    // Point light on each orb
    const light = new PointLight(`orbLight${index}`, Vector3.Zero(), scene);
    light.diffuse = color;
    light.intensity = 0.8;
    light.range = 8;
    light.parent = orb;

    this.orbs.push(orb);

    // Particle trail
    const ps = new ParticleSystem(`orbPs${index}`, 50, scene);
    ps.particleTexture = new Texture('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAAXNSR0IArs4c6QAAAB1JREFUKFNjZGBg+M9AAWAiSgEMjKoYakAFBQAA2AABtu3PjgAAAABJRU5ErkJggg==', scene);
    ps.emitter = orb;
    ps.minEmitBox = new Vector3(-0.1, -0.1, -0.1);
    ps.maxEmitBox = new Vector3(0.1, 0.1, 0.1);
    ps.color1 = new Color4(color.r, color.g, color.b, 1);
    ps.color2 = new Color4(color.r * 0.5, color.g * 0.5, color.b * 0.5, 0.3);
    ps.colorDead = new Color4(0, 0, 0, 0);
    ps.minSize = 0.05;
    ps.maxSize = 0.2;
    ps.minLifeTime = 0.3;
    ps.maxLifeTime = 0.6;
    ps.emitRate = 30;
    ps.direction1 = new Vector3(-0.5, 0.5, -0.5);
    ps.direction2 = new Vector3(0.5, 1, 0.5);
    ps.gravity = new Vector3(0, -2, 0);
    ps.minEmitPower = 0.2;
    ps.maxEmitPower = 0.5;
    ps.updateSpeed = 0.01;
    ps.start();
    this.particleSystems.push(ps);

    // Click to explode orb
    orb.actionManager = new ActionManager(scene);
    orb.actionManager.registerAction(new ExecuteCodeAction(
      ActionManager.OnPickTrigger,
      () => {
        this.score += 50;
        orb.scaling.setAll(1.5);
        setTimeout(() => orb.scaling.setAll(1), 200);
      }
    ));
  }

  private createFloatingCubes(scene: Scene): void {
    const shapes = ['box', 'sphere', 'cylinder', 'torus'];
    for (let i = 0; i < 12; i++) {
      const type = shapes[i % shapes.length];
      let mesh: Mesh;
      if (type === 'box') {
        mesh = MeshBuilder.CreateBox(`cube${i}`, { size: 0.5 + Math.random() * 0.5 }, scene);
      } else if (type === 'sphere') {
        mesh = MeshBuilder.CreateSphere(`sph${i}`, { diameter: 0.5 + Math.random() * 0.5, segments: 8 }, scene);
      } else if (type === 'cylinder') {
        mesh = MeshBuilder.CreateCylinder(`cyl${i}`, { height: 0.6, diameter: 0.4 }, scene);
      } else {
        mesh = MeshBuilder.CreateTorus(`tor${i}`, { diameter: 0.6, thickness: 0.15, tessellation: 24 }, scene);
      }

      const angle = (i / 12) * Math.PI * 2;
      const radius = 6 + (i % 3) * 1.5;
      mesh.position.set(
        Math.cos(angle) * radius,
        -0.5 + Math.sin(i * 1.3) * 1.5,
        Math.sin(angle) * radius
      );

      const mat = new StandardMaterial(`floatMat${i}`, scene);
      const h = i / 12;
      mat.diffuseColor = Color3.FromHSV(h * 360, 0.7, 0.9);
      mat.emissiveColor = mat.diffuseColor.scale(0.1);
      mat.specularColor = Color3.White();
      mesh.material = mat;
      mesh.receiveShadows = true;
      this.shadowGen?.addShadowCaster(mesh);

      // Float animation
      const floatAnim = new Animation(`float${i}`, 'position.y', 60,
        Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
      const baseY = mesh.position.y;
      floatAnim.setKeys([
        { frame: 0, value: baseY },
        { frame: 60 + i * 5, value: baseY + 1 },
        { frame: 120 + i * 10, value: baseY },
      ]);
      mesh.animations = [floatAnim];
      scene.beginAnimation(mesh, 0, 120 + i * 10, true);

      // Spin
      const spinAnim = new Animation(`spin${i}`, 'rotation.y', 60,
        Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
      const dir = i % 2 === 0 ? 1 : -1;
      spinAnim.setKeys([{ frame: 0, value: 0 }, { frame: 120, value: dir * Math.PI * 2 }]);
      mesh.animations.push(spinAnim);
      scene.beginDirectAnimation(mesh, [spinAnim], 0, 120, true);

      // Click to score
      mesh.actionManager = new ActionManager(scene);
      mesh.actionManager.registerAction(new ExecuteCodeAction(
        ActionManager.OnPickTrigger,
        () => { this.score += 10; }
      ));
    }
  }

  // ── HUD ───────────────────────────────────────────────────────────────────

  private setupHUD(): void {
    this.hudMesh = MeshBuilder.CreatePlane('hud', { width: 5, height: 2 }, this.scene);
    this.hudMesh.position.set(-7, 3, -5);
    this.hudMesh.billboardMode = Mesh.BILLBOARDMODE_ALL;

    this.hudTexture = new DynamicTexture('hudTex', { width: 512, height: 200 }, this.scene, false);
    this.hudTexture.hasAlpha = true;

    const mat = new StandardMaterial('hudMat', this.scene);
    mat.diffuseTexture = this.hudTexture;
    mat.emissiveColor = Color3.White();
    mat.backFaceCulling = false;
    mat.disableLighting = true;
    this.hudMesh.material = mat;

    this.updateHUDTexture();
  }

  private updateHUDTexture(): void {
    if (!this.hudTexture || this.isDisposed) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = this.hudTexture.getContext() as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 512, 200);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    this.roundRect(ctx, 4, 4, 504, 192, 12);
    ctx.fill();

    ctx.strokeStyle = 'rgba(100,200,255,0.5)';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, 4, 4, 504, 192, 12);
    ctx.stroke();

    const fps = this.engine.getFps();
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = fps >= 55 ? '#00ff88' : fps >= 30 ? '#ffaa22' : '#ff4444';
    ctx.fillText(`FPS: ${fps.toFixed(0)}  |  ${(1000 / fps).toFixed(1)}ms`, 16, 42);

    ctx.font = '18px monospace';
    ctx.fillStyle = '#88ccff';
    const info = `Meshes: ${this.scene.meshes.length}  Particles: ${this.particleSystems.length}`;
    ctx.fillText(info, 16, 80);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const drawCalls = (this.engine as unknown as any)['_drawCalls']?.count ?? 0;
    ctx.fillText(`Draw calls: ${drawCalls}`, 16, 110);

    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#ffdd44';
    ctx.fillText(`Score: ${this.score}`, 16, 155);

    ctx.font = '13px monospace';
    ctx.fillStyle = '#667799';
    ctx.fillText('Drag to orbit • Pinch to zoom • Tap meshes', 16, 185);

    this.hudTexture.update();
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  private setupInput(): void {
    // Keyboard shortcuts
    window.addEventListener('keydown', this.onKeyDown);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === ' ') {
      // Space = toggle camera auto-rotate
      const cam = this.scene.cameras[0] as ArcRotateCamera;
      cam.useAutoRotationBehavior = !cam.useAutoRotationBehavior;
    }
    if (e.key === 'r' || e.key === 'R') {
      // Reset camera
      const cam = this.scene.cameras[0] as ArcRotateCamera;
      cam.alpha = -Math.PI / 4;
      cam.beta = Math.PI / 3.5;
      cam.radius = 22;
    }
  };

  // ── Render Loop ───────────────────────────────────────────────────────────

  private startRenderLoop(): void {
    let frame = 0;
    this.engine.runRenderLoop(() => {
      if (this.isDisposed) return;

      // Animate orbiting orbs
      const t = performance.now() / 1000;
      for (let i = 0; i < this.orbs.length; i++) {
        const angle = (i / this.orbs.length) * Math.PI * 2 + t * (0.5 + i * 0.1);
        const radius = 4 + Math.sin(t * 0.3 + i) * 0.5;
        this.orbs[i].position.x = Math.cos(angle) * radius;
        this.orbs[i].position.z = Math.sin(angle) * radius;
        this.orbs[i].position.y = Math.sin(t * 0.8 + i * 1.2) * 1.5;
      }

      this.scene.render();

      // Update HUD every 10 frames
      if (frame % 10 === 0) {
        this.updateHUDTexture();
      }
      frame++;
    });
  }

  // ── Stats & Teardown ──────────────────────────────────────────────────────

  getStats(): BabylonStats {
    return {
      engine: 'babylonjs',
      status: this.isDisposed ? 'destroyed' : 'running',
      fps: this.engine.getFps(),
      frameTime: 1000 / this.engine.getFps(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      drawCalls: (this.engine as unknown as any)['_drawCalls']?.count ?? 0,
      activeMeshes: this.scene.meshes.length,
      totalVertices: this.scene.getTotalVertices(),
    };
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    this.resizeObserver.disconnect();
    for (const ps of this.particleSystems) ps.dispose();
    this.particleSystems = [];
    this.scene.dispose();
    this.engine.stopRenderLoop();
    this.engine.dispose();
  }
}
