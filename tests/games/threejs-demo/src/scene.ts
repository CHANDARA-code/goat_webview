import * as THREE from 'three';
import { ParticleSystem } from './particles';
import { AppControls, InteractiveMesh } from './controls';
import { DebugHUD } from './hud';
import { GameRuntimeStats } from './types';

export interface SatelliteOrbit {
  mesh: InteractiveMesh;
  radius: number;
  speed: number;
  inclination: number;
  phase: number;
  rotSpeed: THREE.Vector3;
}

export class GameScene {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public controls: AppControls;
  public hud: DebugHUD;
  public particles: ParticleSystem;

  private canvas: HTMLCanvasElement;
  private animFrameId: number = 0;
  private isPaused: boolean = false;
  private isDestroyed: boolean = false;
  private lastTime: number = performance.now();
  private clock: THREE.Clock = new THREE.Clock();

  // Scene objects
  private centerpiece!: InteractiveMesh;
  private satellites: SatelliteOrbit[] = [];
  private pointLight1!: THREE.PointLight;
  private pointLight2!: THREE.PointLight;
  private directionalLight!: THREE.DirectionalLight;
  private interactables: THREE.Object3D[] = [];
  private abortController: AbortController = new AbortController();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // 1. WebGLRenderer with high-performance specs
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      depth: true,
    });

    const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Scene Graph & Atmosphere
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050510);
    this.scene.fog = new THREE.FogExp2(0x050510, 0.022);

    // 3. Camera
    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 6, 14);

    // 4. Setup Lighting
    this.setupLighting();

    // 5. Setup Geometries
    this.setupGeometries();

    // 6. Setup High-Density Particles (8,500 points in 1 draw call)
    this.particles = new ParticleSystem(8500);
    this.scene.add(this.particles.points);

    // 7. Setup Camera Controls & Raycaster
    this.controls = new AppControls(this.camera, this.renderer.domElement, this.interactables);
    this.controls.onTogglePause = () => this.togglePause();

    // 8. Setup HUD
    this.hud = new DebugHUD({
      onTogglePause: () => this.togglePause(),
      onToggleShadows: () => this.toggleShadows(),
      onResetCamera: () => this.controls.resetCamera(),
      onTeardown: () => this.teardown(),
    });

    // 9. Window Listeners
    this.initWindowEvents();

    // 10. Start Render Loop
    this.lastTime = performance.now();
    this.animFrameId = requestAnimationFrame(this.renderLoop.bind(this));
  }

  private setupLighting(): void {
    // Ambient Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    // Key Directional Light with Soft Shadows
    this.directionalLight = new THREE.DirectionalLight(0xfff7ed, 1.4);
    this.directionalLight.position.set(12, 18, 10);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.width = 1024;
    this.directionalLight.shadow.mapSize.height = 1024;
    this.directionalLight.shadow.camera.near = 0.5;
    this.directionalLight.shadow.camera.far = 45;
    this.directionalLight.shadow.camera.left = -14;
    this.directionalLight.shadow.camera.right = 14;
    this.directionalLight.shadow.camera.top = 14;
    this.directionalLight.shadow.camera.bottom = -14;
    this.directionalLight.shadow.bias = -0.0005;
    this.scene.add(this.directionalLight);

    // Accent Point Light 1: Electric Cyan
    this.pointLight1 = new THREE.PointLight(0x00f3ff, 2.5, 30);
    this.pointLight1.position.set(-6, 4, -4);
    this.scene.add(this.pointLight1);

    // Accent Point Light 2: Neon Magenta
    this.pointLight2 = new THREE.PointLight(0xec4899, 2.0, 25);
    this.pointLight2.position.set(6, 3, 5);
    this.scene.add(this.pointLight2);
  }

  private setupGeometries(): void {
    // Centerpiece: TorusKnot
    const knotGeom = new THREE.TorusKnotGeometry(1.65, 0.45, 128, 32);
    const knotMat = new THREE.MeshStandardMaterial({
      color: 0x6366f1,
      roughness: 0.22,
      metalness: 0.85,
    });
    this.centerpiece = new THREE.Mesh(knotGeom, knotMat) as InteractiveMesh;
    this.centerpiece.position.set(0, 1.6, 0);
    this.centerpiece.castShadow = true;
    this.centerpiece.receiveShadow = true;
    this.centerpiece.userData = {
      interactive: true,
      originalScale: new THREE.Vector3(1, 1, 1),
      originalColor: knotMat.color.clone(),
      spinSpeed: 1.0,
      targetScale: 1.0,
    };
    this.scene.add(this.centerpiece);
    this.interactables.push(this.centerpiece);

    // Orbiting Procedural Satellites
    const satConfigs = [
      {
        geom: new THREE.IcosahedronGeometry(0.8, 0),
        color: 0x00f3ff,
        radius: 4.5,
        speed: 0.8,
        inclination: 0.25,
        phase: 0,
        rot: new THREE.Vector3(0.5, 1.0, 0.2),
      },
      {
        geom: new THREE.OctahedronGeometry(0.85, 0),
        color: 0xa855f7,
        radius: 6.0,
        speed: -0.65,
        inclination: -0.4,
        phase: Math.PI * 0.5,
        rot: new THREE.Vector3(0.8, 0.4, 1.0),
      },
      {
        geom: new THREE.DodecahedronGeometry(0.75, 0),
        color: 0xf59e0b,
        radius: 7.2,
        speed: 0.5,
        inclination: 0.55,
        phase: Math.PI,
        rot: new THREE.Vector3(0.3, 0.9, 0.6),
      },
      {
        geom: new THREE.TorusGeometry(0.65, 0.22, 16, 32),
        color: 0x10b981,
        radius: 8.5,
        speed: -0.4,
        inclination: -0.2,
        phase: Math.PI * 1.5,
        rot: new THREE.Vector3(1.2, 0.3, 0.7),
      },
    ];

    for (const cfg of satConfigs) {
      const mat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        roughness: 0.28,
        metalness: 0.8,
        flatShading: true,
      });
      const mesh = new THREE.Mesh(cfg.geom, mat) as InteractiveMesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = {
        interactive: true,
        originalScale: new THREE.Vector3(1, 1, 1),
        originalColor: mat.color.clone(),
        spinSpeed: 1.0,
        targetScale: 1.0,
      };
      this.scene.add(mesh);
      this.interactables.push(mesh);
      this.satellites.push({
        mesh,
        radius: cfg.radius,
        speed: cfg.speed,
        inclination: cfg.inclination,
        phase: cfg.phase,
        rotSpeed: cfg.rot,
      });
    }

    // Reflective Ground Floor
    const floorGeom = new THREE.PlaneGeometry(80, 80, 1, 1);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.6,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.5;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Decorative Grid Accent
    const grid = new THREE.GridHelper(60, 30, 0x1e293b, 0x0f172a);
    grid.position.y = -2.48;
    this.scene.add(grid);
  }

  private initWindowEvents(): void {
    const signal = this.abortController.signal;

    const onResize = () => {
      if (this.isDestroyed) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0));
    };

    window.addEventListener('resize', onResize, { signal });
    window.addEventListener('orientationchange', onResize, { signal });

    // Battery / Background Tab Optimization
    document.addEventListener(
      'visibilitychange',
      () => {
        if (this.isDestroyed) return;
        if (document.hidden) {
          this.pause();
        } else {
          this.resume();
        }
      },
      { signal }
    );
  }

  private renderLoop(time: number): void {
    if (this.isDestroyed) return;

    this.animFrameId = requestAnimationFrame(this.renderLoop.bind(this));

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsed = this.clock.getElapsedTime();

    if (!this.isPaused) {
      // 1. Animate Centerpiece
      const spinMult = this.centerpiece.userData.spinSpeed ?? 1.0;
      this.centerpiece.rotation.x += delta * 0.45 * spinMult;
      this.centerpiece.rotation.y += delta * 0.7 * spinMult;
      this.centerpiece.position.y = Math.sin(elapsed * 1.4) * 0.3 + 1.6;

      // 2. Animate Orbiting Satellites
      for (const sat of this.satellites) {
        const angle = sat.phase + elapsed * sat.speed;
        const x = Math.cos(angle) * sat.radius;
        const z = Math.sin(angle) * sat.radius;
        const y = Math.sin(angle * 2.0 + sat.phase) * (sat.radius * sat.inclination) + 1.2;

        sat.mesh.position.set(x, y, z);
        const satSpin = sat.mesh.userData.spinSpeed ?? 1.0;
        sat.mesh.rotation.x += delta * sat.rotSpeed.x * satSpin;
        sat.mesh.rotation.y += delta * sat.rotSpeed.y * satSpin;
        sat.mesh.rotation.z += delta * sat.rotSpeed.z * satSpin;
      }

      // 3. Dynamic Moving Point Lights
      this.pointLight1.position.x = Math.sin(elapsed * 0.9) * 8.0;
      this.pointLight1.position.z = Math.cos(elapsed * 0.9) * 8.0;
      this.pointLight1.position.y = Math.sin(elapsed * 1.5) * 2.0 + 3.5;

      this.pointLight2.position.x = Math.cos(elapsed * 0.7 + 1.0) * 7.5;
      this.pointLight2.position.z = Math.sin(elapsed * 0.7 + 1.0) * 7.5;
      this.pointLight2.position.y = Math.cos(elapsed * 1.3) * 1.8 + 3.0;

      // 4. Update Particles Wave Animation
      this.particles.update(elapsed, delta);
    }

    // 5. Update Camera Controls & Raycast animation
    this.controls.update(delta);

    // 6. Render Scene
    this.renderer.render(this.scene, this.camera);

    // 7. Update HUD Telemetry
    this.hud.update(this.renderer, this.isPaused);
  }

  public pause(): void {
    if (this.isDestroyed || this.isPaused) return;
    this.isPaused = true;
    this.hud.setPausedState(true);
  }

  public resume(): void {
    if (this.isDestroyed || !this.isPaused) return;
    this.isPaused = false;
    this.clock.getDelta(); // Reset delta so time doesn't jump
    this.hud.setPausedState(false);
  }

  public togglePause(): void {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  public toggleShadows(): void {
    if (this.isDestroyed) return;
    this.renderer.shadowMap.enabled = !this.renderer.shadowMap.enabled;
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => {
            m.needsUpdate = true;
          });
        }
      }
    });
    this.hud.setShadowsState(this.renderer.shadowMap.enabled);
  }

  public getStats(): GameRuntimeStats {
    if (this.isDestroyed) {
      return {
        engine: 'threejs',
        status: 'destroyed',
        fps: 0,
        frameTime: 0,
        drawCalls: 0,
        triangles: 0,
        geometries: 0,
        textures: 0,
        points: 0,
      };
    }
    return this.hud.getStats();
  }

  public teardown(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    // 1. Cancel RAF
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }

    // 2. Abort all window/DOM listeners
    this.abortController.abort();

    // 3. Dispose controls
    this.controls.dispose();

    // 4. Dispose particle system
    this.particles.dispose();

    // 5. Recursive scene traversal disposal
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh || (obj as THREE.Points).isPoints) {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) {
            for (const key of Object.keys(mat)) {
              const val = (mat as any)[key];
              if (val && typeof val === 'object' && 'minFilter' in val && typeof val.dispose === 'function') {
                (val as THREE.Texture).dispose();
              }
            }
            mat.dispose();
          }
        }
      }
      if ((obj as THREE.Light).isLight) {
        const light = obj as THREE.DirectionalLight;
        if (light.shadow && light.shadow.map) {
          light.shadow.map.dispose();
        }
      }
    });

    // 6. WebGL Renderer Disposal & Force Context Loss
    this.renderer.dispose();
    this.renderer.forceContextLoss();

    // 7. Remove canvas from DOM
    this.canvas.remove();

    // 8. Dispose HUD overlay
    this.hud.dispose();
  }
}
