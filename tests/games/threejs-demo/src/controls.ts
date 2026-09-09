import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface InteractiveMesh extends THREE.Mesh {
  userData: {
    originalScale?: THREE.Vector3;
    originalColor?: THREE.Color;
    targetScale?: number;
    scaleVel?: number;
    interactive?: boolean;
    spinSpeed?: number;
    colorCycleIndex?: number;
  };
}

export class AppControls {
  public orbit: OrbitControls;
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private raycaster: THREE.Raycaster;
  private pointer: THREE.Vector2;
  private interactables: THREE.Object3D[] = [];
  private keysDown: Set<string> = new Set();
  private abortController: AbortController = new AbortController();

  private defaultCamPos = new THREE.Vector3(0, 6, 14);
  private defaultTarget = new THREE.Vector3(0, 1.5, 0);

  public onTogglePause?: () => void;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    interactables: THREE.Object3D[]
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.interactables = interactables;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.orbit = new OrbitControls(this.camera, this.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.06;
    this.orbit.minDistance = 2.5;
    this.orbit.maxDistance = 40;
    this.orbit.maxPolarAngle = Math.PI / 2 - 0.03; // Keep above floor
    this.orbit.target.copy(this.defaultTarget);
    this.orbit.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    this.initEventListeners();
  }

  private initEventListeners(): void {
    const signal = this.abortController.signal;

    // Keyboard controls
    window.addEventListener(
      'keydown',
      (e) => {
        this.keysDown.add(e.code);
        if (e.code === 'Space') {
          e.preventDefault();
          this.onTogglePause?.();
        } else if (e.code === 'KeyR') {
          this.resetCamera();
        }
      },
      { signal }
    );

    window.addEventListener(
      'keyup',
      (e) => {
        this.keysDown.delete(e.code);
      },
      { signal }
    );

    // Tap / Pointer interaction for raycasting
    this.domElement.addEventListener(
      'pointerdown',
      (e) => {
        this.handlePointerDown(e);
      },
      { signal }
    );
  }

  private handlePointerDown(event: PointerEvent): void {
    // Only handle primary button
    if (event.button !== 0) return;

    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactables, true);

    if (intersects.length > 0) {
      // Find top-level interactive mesh
      let hitMesh: InteractiveMesh | null = null;
      for (const hit of intersects) {
        let curr: THREE.Object3D | null = hit.object;
        while (curr) {
          if ((curr as InteractiveMesh).userData?.interactive) {
            hitMesh = curr as InteractiveMesh;
            break;
          }
          curr = curr.parent;
        }
        if (hitMesh) break;
      }

      if (!hitMesh && intersects[0].object instanceof THREE.Mesh) {
        hitMesh = intersects[0].object as InteractiveMesh;
      }

      if (hitMesh) {
        this.perturbMesh(hitMesh);
      }
    }
  }

  private perturbMesh(mesh: InteractiveMesh): void {
    if (!mesh.userData) mesh.userData = {};

    // Trigger scale expansion impulse
    mesh.userData.targetScale = 1.35;
    mesh.userData.scaleVel = 0.2;

    // Recolor mesh with vibrant cyber neon colors
    const neonColors = [
      0x00f3ff, // Cyan
      0xff007f, // Neon Pink
      0xa855f7, // Purple
      0x22c55e, // Emerald
      0xfbbf24, // Amber
      0x6366f1, // Indigo
    ];

    const nextIndex = ((mesh.userData.colorCycleIndex ?? 0) + 1) % neonColors.length;
    mesh.userData.colorCycleIndex = nextIndex;

    const targetColor = new THREE.Color(neonColors[nextIndex]);

    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => {
          if ('color' in m) (m as THREE.MeshStandardMaterial).color.copy(targetColor);
          if ('emissive' in m) (m as THREE.MeshStandardMaterial).emissive.copy(targetColor).multiplyScalar(0.4);
        });
      } else {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if ('color' in mat) mat.color.copy(targetColor);
        if ('emissive' in mat) mat.emissive.copy(targetColor).multiplyScalar(0.4);
      }
    }

    // Boost spin speed temporarily
    mesh.userData.spinSpeed = (mesh.userData.spinSpeed ?? 1) + 2.5;
  }

  public resetCamera(): void {
    this.camera.position.copy(this.defaultCamPos);
    this.orbit.target.copy(this.defaultTarget);
    this.orbit.update();
  }

  public update(delta: number): void {
    // Keyboard camera translation
    const moveSpeed = 8.0 * delta;
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, this.camera.up).normalize();

    let moved = false;
    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) {
      this.camera.position.addScaledVector(forward, moveSpeed);
      this.orbit.target.addScaledVector(forward, moveSpeed);
      moved = true;
    }
    if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) {
      this.camera.position.addScaledVector(forward, -moveSpeed);
      this.orbit.target.addScaledVector(forward, -moveSpeed);
      moved = true;
    }
    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) {
      this.camera.position.addScaledVector(right, -moveSpeed);
      this.orbit.target.addScaledVector(right, -moveSpeed);
      moved = true;
    }
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) {
      this.camera.position.addScaledVector(right, moveSpeed);
      this.orbit.target.addScaledVector(right, moveSpeed);
      moved = true;
    }
    if (this.keysDown.has('KeyE')) {
      this.camera.position.y += moveSpeed;
      this.orbit.target.y += moveSpeed;
      moved = true;
    }
    if (this.keysDown.has('KeyQ')) {
      this.camera.position.y = Math.max(1.0, this.camera.position.y - moveSpeed);
      moved = true;
    }

    if (moved) {
      this.orbit.update();
    } else {
      this.orbit.update();
    }

    // Animate perturbed meshes (spring back to original scale)
    for (const obj of this.interactables) {
      const mesh = obj as InteractiveMesh;
      if (!mesh.userData) continue;

      if (!mesh.userData.originalScale) {
        mesh.userData.originalScale = mesh.scale.clone();
      }

      if (mesh.userData.targetScale && mesh.userData.targetScale > 1.0) {
        // Decay back to 1.0
        mesh.userData.targetScale += ((1.0 - mesh.userData.targetScale) * 8.0) * delta;
        if (Math.abs(mesh.userData.targetScale - 1.0) < 0.005) {
          mesh.userData.targetScale = 1.0;
        }
        const s = mesh.userData.targetScale;
        mesh.scale.set(
          mesh.userData.originalScale.x * s,
          mesh.userData.originalScale.y * s,
          mesh.userData.originalScale.z * s
        );
      }

      // Decay spin speed boost back to normal (1.0)
      if (mesh.userData.spinSpeed && mesh.userData.spinSpeed > 1.0) {
        mesh.userData.spinSpeed += ((1.0 - mesh.userData.spinSpeed) * 3.0) * delta;
      }
    }
  }

  public dispose(): void {
    this.abortController.abort();
    this.orbit.dispose();
    this.keysDown.clear();
  }
}
