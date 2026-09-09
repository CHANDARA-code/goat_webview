import * as THREE from 'three';

/**
 * Creates a procedural circular glow texture using an in-memory canvas.
 * Guaranteed zero external network requests.
 */
function createGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(0, 243, 255, 0.9)');
    gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.4)');
    gradient.addColorStop(1, 'rgba(5, 5, 16, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

export class ParticleSystem {
  public points: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private texture: THREE.CanvasTexture;
  private basePositions: Float32Array;
  private phases: Float32Array;
  private radii: Float32Array;
  private count: number;

  constructor(count: number = 8500) {
    this.count = count;
    this.geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    this.basePositions = new Float32Array(count * 3);
    this.phases = new Float32Array(count);
    this.radii = new Float32Array(count);

    const palette = [
      new THREE.Color(0x00f3ff), // Cyan
      new THREE.Color(0x38bdf8), // Sky
      new THREE.Color(0xa855f7), // Purple
      new THREE.Color(0xec4899), // Pink
      new THREE.Color(0x6366f1), // Indigo
    ];

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      // Spherical distribution with layered density
      const r = 4.0 + Math.pow(Math.random(), 0.7) * 22.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2.0 * Math.random() - 1.0);

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;

      this.basePositions[idx] = x;
      this.basePositions[idx + 1] = y;
      this.basePositions[idx + 2] = z;

      this.radii[i] = r;
      this.phases[i] = Math.random() * Math.PI * 2;

      // Color gradation by radius and random palette blending
      const colorA = palette[i % palette.length];
      const colorB = palette[(i + 1) % palette.length];
      const lerped = colorA.clone().lerp(colorB, Math.random());

      colors[idx] = lerped.r;
      colors[idx + 1] = lerped.g;
      colors[idx + 2] = lerped.b;
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.texture = createGlowTexture();

    this.material = new THREE.PointsMaterial({
      size: 0.16,
      map: this.texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  public update(time: number, delta: number): void {
    // Rotate point cloud
    this.points.rotation.y += delta * 0.04;
    this.points.rotation.x = Math.sin(time * 0.15) * 0.08;

    // Harmonic wave modulation on positions
    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const posArray = posAttr.array as Float32Array;

    const t = time * 1.6;
    for (let i = 0; i < this.count; i++) {
      const idx = i * 3;
      const phase = this.phases[i];
      const r = this.radii[i];

      // Wave displacement in Y and radial pulsing
      const wave = Math.sin(phase + t + r * 0.4) * 0.35;
      const pulse = 1.0 + Math.cos(phase * 0.5 + t * 0.8) * 0.04;

      posArray[idx] = this.basePositions[idx] * pulse;
      posArray[idx + 1] = this.basePositions[idx + 1] + wave;
      posArray[idx + 2] = this.basePositions[idx + 2] * pulse;
    }

    posAttr.needsUpdate = true;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
