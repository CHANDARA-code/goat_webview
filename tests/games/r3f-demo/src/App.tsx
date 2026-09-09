import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Scene, CubeData } from './Scene';
import { Hud } from './Hud';
import { setGameStatus } from './telemetry';

const INITIAL_COLORS = ['#f43f5e', '#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ec4899'];

function createInitialCubes(): CubeData[] {
  const count = 6;
  const radius = 5.2;
  const cubes: CubeData[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    cubes.push({
      id: i + 1,
      initialPos: [
        Math.cos(angle) * radius,
        1.5 + (i % 2) * 0.5,
        Math.sin(angle) * radius,
      ],
      color: INITIAL_COLORS[i % INITIAL_COLORS.length],
    });
  }
  return cubes;
}

export const App: React.FC = () => {
  const [isPaused, setIsPaused] = useState(false);
  const [cubes, setCubes] = useState<CubeData[]>(() => createInitialCubes());
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      setGameStatus(next ? 'paused' : 'running');
      return next;
    });
  }, []);

  const pauseGame = useCallback(() => {
    setIsPaused(true);
    setGameStatus('paused');
  }, []);

  const resumeGame = useCallback(() => {
    setIsPaused(false);
    setGameStatus('running');
  }, []);

  const resetCamera = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  }, []);

  const addCube = useCallback(() => {
    setCubes((prev) => {
      const nextId = prev.length + 1;
      const angle = Math.random() * Math.PI * 2;
      const radius = 4.5 + Math.random() * 3.5;
      const color = INITIAL_COLORS[Math.floor(Math.random() * INITIAL_COLORS.length)];
      return [
        ...prev,
        {
          id: nextId,
          initialPos: [
            Math.cos(angle) * radius,
            1.5 + Math.random() * 1.5,
            Math.sin(angle) * radius,
          ],
          color,
        },
      ];
    });
  }, []);

  const triggerTeardown = useCallback(() => {
    if (window.__teardownGame) {
      window.__teardownGame();
    }
  }, []);

  // Expose pause/resume to window hooks
  useEffect(() => {
    window.__pauseGame = pauseGame;
    window.__resumeGame = resumeGame;

    return () => {
      window.__pauseGame = undefined;
      window.__resumeGame = undefined;
    };
  }, [pauseGame, resumeGame]);

  // Keyboard accessibility shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        togglePause();
      } else if (e.code === 'KeyR') {
        resetCamera();
      } else if (e.code === 'KeyC') {
        addCube();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePause, resetCamera, addCube]);

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#08081a' }}>
      <Canvas
        dpr={[1, 2]}
        shadows
        camera={{ position: [0, 5, 10], fov: 60 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          alpha: false,
          depth: true,
          stencil: false,
        }}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          touchAction: 'none',
        }}
      >
        <Scene isPaused={isPaused} cubes={cubes} controlsRef={controlsRef} />
      </Canvas>

      <Hud
        isPaused={isPaused}
        onTogglePause={togglePause}
        onResetCamera={resetCamera}
        onAddCube={addCube}
        onTeardown={triggerTeardown}
        cubeCount={cubes.length}
      />
    </div>
  );
};
