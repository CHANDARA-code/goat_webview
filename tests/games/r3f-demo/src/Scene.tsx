import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { TelemetryCollector } from './telemetry';

export interface CubeData {
  id: number;
  initialPos: [number, number, number];
  color: string;
}

interface SceneProps {
  isPaused: boolean;
  cubes: CubeData[];
  controlsRef: React.RefObject<OrbitControlsImpl>;
}

// 1. In-Canvas 60Hz Telemetry Collector
function StatsCollector({ isPaused, entityCount }: { isPaused: boolean; entityCount: number }) {
  const { gl } = useThree();
  const collector = useMemo(() => new TelemetryCollector(), []);

  useFrame(() => {
    collector.recordFrame(gl, entityCount);
  });

  useEffect(() => {
    if (isPaused) {
      collector.reset();
    }
  }, [isPaused, collector]);

  return null;
}

// 2. Rotating Concentric Geometric Rings
function RotatingRings({ isPaused }: { isPaused: boolean }) {
  const ring1Ref = useRef<THREE.Mesh>(null!);
  const ring2Ref = useRef<THREE.Mesh>(null!);
  const ring3Ref = useRef<THREE.Mesh>(null!);
  const coreRef = useRef<THREE.Mesh>(null!);

  useFrame((state, delta) => {
    if (isPaused) return;

    // Outer ring rotation
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x += delta * 0.7;
      ring1Ref.current.rotation.y += delta * 0.4;
    }
    // Middle ring counter-rotation
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y -= delta * 0.5;
      ring2Ref.current.rotation.z += delta * 0.8;
    }
    // Inner ring rotation
    if (ring3Ref.current) {
      ring3Ref.current.rotation.x += delta * 0.5;
      ring3Ref.current.rotation.z -= delta * 0.6;
    }
    // Central jewel pulse
    if (coreRef.current) {
      coreRef.current.rotation.y += delta * 1.2;
      coreRef.current.rotation.x += delta * 0.9;
      const pulse = 1.0 + Math.sin(state.clock.elapsedTime * 3) * 0.08;
      coreRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  return (
    <group position={[0, 2.5, 0]}>
      {/* Ring 1 - Cyan Outer Ring */}
      <mesh ref={ring1Ref} castShadow receiveShadow>
        <torusGeometry args={[2.5, 0.07, 24, 64]} />
        <meshStandardMaterial color="#06b6d4" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Ring 2 - Violet Middle Ring */}
      <mesh ref={ring2Ref} castShadow receiveShadow>
        <torusGeometry args={[1.9, 0.065, 24, 64]} />
        <meshStandardMaterial color="#a855f7" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Ring 3 - Gold Inner Ring */}
      <mesh ref={ring3Ref} castShadow receiveShadow>
        <torusGeometry args={[1.3, 0.06, 24, 64]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.95} roughness={0.12} />
      </mesh>

      {/* Central Floating Polyhedron Core */}
      <mesh ref={coreRef} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.65, 0]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#0284c7"
          emissiveIntensity={0.6}
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>
    </group>
  );
}

// 3. Interactive Bouncy Floating Cube with Physics Spring Behavior
const PALETTE = ['#f43f5e', '#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ec4899'];

function BouncyCube({
  initialPos,
  color: initialColor,
  isPaused,
}: {
  initialPos: [number, number, number];
  color: string;
  isPaused: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);
  const [color, setColor] = useState(initialColor);

  // Dynamic spring/bounce physics state
  const physics = useRef({
    baseY: initialPos[1],
    currentY: initialPos[1],
    velocity: 0,
    angularVelX: 0.8 + Math.random() * 0.4,
    angularVelY: 0.6 + Math.random() * 0.5,
    phase: Math.random() * Math.PI * 2,
    squash: 1.0,
  });

  const handlePointerDown = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    // Launch physics impulse jump
    physics.current.velocity = 7.5 + Math.random() * 2.0;
    physics.current.angularVelX += (Math.random() - 0.5) * 4.0;
    physics.current.angularVelY += 3.0;
    physics.current.squash = 0.7; // Squash on launch

    // Cycle color
    const nextColor = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    setColor(nextColor);
  };

  useFrame((state, delta) => {
    if (isPaused || !meshRef.current) return;

    const p = physics.current;
    const dt = Math.min(delta, 0.05);

    // Gravity & bounce against baseline
    if (p.velocity !== 0 || p.currentY > p.baseY) {
      p.velocity -= 18.0 * dt; // gravity
      p.currentY += p.velocity * dt;

      if (p.currentY <= p.baseY) {
        p.currentY = p.baseY;
        if (Math.abs(p.velocity) > 0.5) {
          p.velocity = -p.velocity * 0.6; // restitution bounce
          p.squash = 0.75;
        } else {
          p.velocity = 0;
        }
      }
    } else {
      // Idle harmonic float
      p.currentY = p.baseY + Math.sin(state.clock.elapsedTime * 2.0 + p.phase) * 0.25;
    }

    // Squash recovery
    p.squash += (1.0 - p.squash) * (dt * 8.0);

    // Hover scale target
    const targetScale = hovered ? 1.25 : 1.0;
    const currentScale = meshRef.current.scale.x;
    const newScale = currentScale + (targetScale - currentScale) * (dt * 10.0);

    meshRef.current.position.y = p.currentY;
    meshRef.current.scale.set(
      newScale / Math.sqrt(p.squash),
      newScale * p.squash,
      newScale / Math.sqrt(p.squash)
    );

    meshRef.current.rotation.x += p.angularVelX * dt;
    meshRef.current.rotation.y += p.angularVelY * dt;

    // Decay spin impulses back to baseline
    p.angularVelX += (0.8 - p.angularVelX) * (dt * 2.0);
    p.angularVelY += (0.6 - p.angularVelY) * (dt * 2.0);
  });

  return (
    <mesh
      ref={meshRef}
      position={[initialPos[0], initialPos[1], initialPos[2]]}
      castShadow
      receiveShadow
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
      }}
      onPointerDown={handlePointerDown}
    >
      <boxGeometry args={[1.0, 1.0, 1.0]} />
      <meshStandardMaterial
        color={color}
        roughness={0.2}
        metalness={0.7}
        emissive={hovered ? color : '#000000'}
        emissiveIntensity={hovered ? 0.4 : 0.0}
      />
    </mesh>
  );
}

// 4. Procedural High-Density Particle Cloud
function ParticleCloud({ count = 6000, isPaused }: { count?: number; isPaused: boolean }) {
  const pointsRef = useRef<THREE.Points>(null!);

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const colorA = new THREE.Color('#38bdf8');
    const colorB = new THREE.Color('#c084fc');

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const radius = 6 + Math.random() * 16;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      pos[idx] = radius * Math.sin(phi) * Math.cos(theta);
      pos[idx + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[idx + 2] = radius * Math.cos(phi);

      const lerped = colorA.clone().lerp(colorB, Math.random());
      col[idx] = lerped.r;
      col[idx + 1] = lerped.g;
      col[idx + 2] = lerped.b;
    }
    return [pos, col];
  }, [count]);

  useFrame((_, delta) => {
    if (isPaused || !pointsRef.current) return;
    pointsRef.current.rotation.y += delta * 0.04;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        vertexColors
        transparent
        opacity={0.75}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// 5. Dynamic Lighting Setup with Shadows
function DynamicLighting({ isPaused }: { isPaused: boolean }) {
  const light1Ref = useRef<THREE.PointLight>(null!);
  const light2Ref = useRef<THREE.PointLight>(null!);

  useFrame((state) => {
    if (isPaused) return;
    const t = state.clock.elapsedTime * 0.6;
    if (light1Ref.current) {
      light1Ref.current.position.x = Math.sin(t) * 7;
      light1Ref.current.position.z = Math.cos(t) * 7;
    }
    if (light2Ref.current) {
      light2Ref.current.position.x = -Math.sin(t * 1.2) * 6;
      light2Ref.current.position.z = -Math.cos(t * 1.2) * 6;
    }
  });

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[8, 14, 6]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0005}
        shadow-camera-near={0.5}
        shadow-camera-far={35}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      {/* Cyan Orbiting Accent Light */}
      <pointLight ref={light1Ref} position={[-5, 3.5, -4]} intensity={2.2} distance={20} color="#00f2fe" />
      {/* Magenta Orbiting Accent Light */}
      <pointLight ref={light2Ref} position={[5, 2.5, 4]} intensity={2.2} distance={20} color="#ff007f" />
    </>
  );
}

// 6. Floor Grid and Ground Plane
function Ground() {
  return (
    <group position={[0, -0.01, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#080816" roughness={0.8} metalness={0.2} />
      </mesh>
      <gridHelper args={[60, 60, '#1e293b', '#0f172a']} position={[0, 0.01, 0]} />
    </group>
  );
}

export const Scene: React.FC<SceneProps> = ({ isPaused, cubes, controlsRef }) => {
  return (
    <>
      <color attach="background" args={['#08081a']} />
      <fog attach="fog" args={['#08081a', 15, 45]} />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={3}
        maxDistance={32}
        maxPolarAngle={Math.PI / 2 - 0.04}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
      />

      <DynamicLighting isPaused={isPaused} />
      <RotatingRings isPaused={isPaused} />

      {cubes.map((cube) => (
        <BouncyCube
          key={cube.id}
          initialPos={cube.initialPos}
          color={cube.color}
          isPaused={isPaused}
        />
      ))}

      <ParticleCloud count={6000} isPaused={isPaused} />
      <Ground />

      <StatsCollector isPaused={isPaused} entityCount={cubes.length + 4} />
    </>
  );
};
