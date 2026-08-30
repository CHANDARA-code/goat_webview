/**
 * @goat/devtools - MotionController Component
 * Full 3D interactive phone rotation, Euler angles (alpha, beta, gamma),
 * accelerometer vectors (x, y, z), compass direction (0-360°), and physical motion presets.
 */

import React, { useState } from 'react';
import { useDevToolsStore } from '../../store/index.ts';
import { Compass, RotateCw, Activity, Zap, RefreshCw, Smartphone } from 'lucide-react';
import type { DeviceMotionPreset } from '../../types/index.ts';

export const MotionController: React.FC = () => {
  const {
    accelerometer = { x: 0, y: 0, z: 9.81 },
    gyroscope = { x: 0, y: 0, z: 0, alpha: 0, beta: 0, gamma: 0 },
    compass = { direction: 0, accuracy: 65 },
    deviceMotion = { alpha: 0, beta: 0, gamma: 0 },
    activeMotionPreset = 'flat',
    setAccelerometer,
    setGyroscope,
    setCompass,
    setDeviceMotion,
    setMotionPreset,
  } = useDevToolsStore();

  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  const handlePreset = (preset: DeviceMotionPreset | string) => {
    if (typeof setMotionPreset === 'function') {
      setMotionPreset(preset);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startPos.x;
    const deltaY = e.clientY - startPos.y;

    const newBeta = Math.max(-90, Math.min(90, (deviceMotion.beta || 0) + deltaY * 0.5));
    const newGamma = Math.max(-90, Math.min(90, (deviceMotion.gamma || 0) + deltaX * 0.5));

    const nextBeta = Math.round(newBeta);
    const nextGamma = Math.round(newGamma);

    setDeviceMotion({ alpha: deviceMotion.alpha || 0, beta: nextBeta, gamma: nextGamma });
    if (typeof setGyroscope === 'function') {
      setGyroscope({ beta: nextBeta, gamma: nextGamma });
    }
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="p-4 space-y-4 text-xs select-none" data-testid="motion-controller">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          <h3 className="font-bold text-neutral-200 uppercase tracking-wider text-[11px]">
            Motion & Gyroscope Sensors
          </h3>
        </div>
        <button
          onClick={() => handlePreset('flat')}
          className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors flex items-center gap-1 text-[10px]"
          title="Reset orientation"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* 3D Interactive Phone Orientation Preview */}
      <div
        className="h-44 bg-neutral-950/80 rounded-xl border border-neutral-800 flex items-center justify-center relative overflow-hidden cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        data-testid="3d-motion-viewport"
      >
        <div className="absolute top-2 left-2 text-[10px] text-neutral-500 font-mono">
          Drag to rotate 3D phone chassis
        </div>
        <div className="absolute top-2 right-2 text-[10px] text-blue-400 font-mono">
          α: {deviceMotion.alpha || 0}° β: {deviceMotion.beta || 0}° γ: {deviceMotion.gamma || 0}°
        </div>

        {/* 3D Device Representation */}
        <div
          className="w-20 h-36 bg-gradient-to-tr from-neutral-800 to-neutral-700 rounded-xl border-2 border-neutral-600 shadow-2xl flex flex-col items-center justify-between p-2 text-[9px] font-mono transition-transform duration-75 text-neutral-300 pointer-events-none"
          style={{
            transform: `perspective(600px) rotateX(${deviceMotion.beta || 0}deg) rotateY(${deviceMotion.gamma || 0}deg) rotateZ(${deviceMotion.alpha || 0}deg)`,
          }}
        >
          <div className="w-6 h-1 bg-neutral-900 rounded-full" />
          <div className="text-center font-bold text-blue-400 flex flex-col items-center">
            <Smartphone className="w-4 h-4 text-blue-400 mb-0.5" />
            <span>Goat</span>
          </div>
          <div className="w-4 h-1 bg-neutral-500 rounded-full" />
        </div>
      </div>

      {/* Preset Physical Gestures */}
      <div>
        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
          Motion Presets
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => handlePreset('flat')}
            className={`py-1.5 px-2 rounded font-medium border text-[11px] transition-colors ${
              activeMotionPreset === 'flat'
                ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            Flat
          </button>
          <button
            onClick={() => handlePreset('shake')}
            className={`py-1.5 px-2 rounded font-medium border text-[11px] transition-colors ${
              activeMotionPreset === 'shake'
                ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            ⚡ Shake
          </button>
          <button
            onClick={() => handlePreset('tilt-left')}
            className={`py-1.5 px-2 rounded font-medium border text-[11px] transition-colors ${
              activeMotionPreset === 'tilt-left' || activeMotionPreset === 'tiltLeft'
                ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            Tilt Left (-45°)
          </button>
          <button
            onClick={() => handlePreset('tilt-right')}
            className={`py-1.5 px-2 rounded font-medium border text-[11px] transition-colors ${
              activeMotionPreset === 'tilt-right' || activeMotionPreset === 'tiltRight'
                ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            Tilt Right (+45°)
          </button>
          <button
            onClick={() => handlePreset('freefall')}
            className={`py-1.5 px-2 rounded font-medium border text-[11px] transition-colors ${
              activeMotionPreset === 'freefall'
                ? 'bg-rose-600/30 border-rose-500 text-rose-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            Freefall (0g)
          </button>
          <button
            onClick={() => handlePreset('face-down')}
            className={`py-1.5 px-2 rounded font-medium border text-[11px] transition-colors ${
              activeMotionPreset === 'face-down' || activeMotionPreset === 'faceDown'
                ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            Face Down (-1g)
          </button>
        </div>
      </div>

      {/* Euler Angles Sliders */}
      <div className="space-y-2 bg-neutral-900/60 p-3 rounded-lg border border-neutral-800">
        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
          Orientation (Euler Angles)
        </div>

        <div>
          <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
            <span>Alpha (Z-Axis / Heading):</span>
            <span className="text-blue-400 font-bold">{deviceMotion.alpha || 0}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            value={deviceMotion.alpha || 0}
            onChange={(e) => {
              const val = Number(e.target.value);
              setDeviceMotion({ ...deviceMotion, alpha: val });
              if (typeof setGyroscope === 'function') setGyroscope({ alpha: val });
            }}
            className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div>
          <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
            <span>Beta (X-Axis / Pitch):</span>
            <span className="text-blue-400 font-bold">{deviceMotion.beta || 0}°</span>
          </div>
          <input
            type="range"
            min="-180"
            max="180"
            value={deviceMotion.beta || 0}
            onChange={(e) => {
              const val = Number(e.target.value);
              setDeviceMotion({ ...deviceMotion, beta: val });
              if (typeof setGyroscope === 'function') setGyroscope({ beta: val });
            }}
            className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div>
          <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
            <span>Gamma (Y-Axis / Roll):</span>
            <span className="text-blue-400 font-bold">{deviceMotion.gamma || 0}°</span>
          </div>
          <input
            type="range"
            min="-90"
            max="90"
            value={deviceMotion.gamma || 0}
            onChange={(e) => {
              const val = Number(e.target.value);
              setDeviceMotion({ ...deviceMotion, gamma: val });
              if (typeof setGyroscope === 'function') setGyroscope({ gamma: val });
            }}
            className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
      </div>

      {/* Compass Heading */}
      <div className="space-y-2 bg-neutral-900/60 p-3 rounded-lg border border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>Digital Compass (0-360°)</span>
          </div>
          <span className="text-amber-400 font-bold font-mono text-xs">
            {compass.direction || 0}°
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="360"
          value={compass.direction || 0}
          onChange={(e) => {
            const val = Number(e.target.value);
            if (typeof setCompass === 'function') setCompass({ direction: val, accuracy: compass.accuracy || 65 });
          }}
          className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
        />
      </div>

      {/* Raw Accelerometer Vectors */}
      <div className="space-y-1.5 bg-neutral-900/60 p-3 rounded-lg border border-neutral-800 font-mono text-[10px]">
        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-sans mb-1">
          Accelerometer Vectors (m/s²)
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">X-Axis:</span>
          <span className="text-emerald-400 font-bold">{(accelerometer.x || 0).toFixed(2)} m/s²</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Y-Axis:</span>
          <span className="text-emerald-400 font-bold">{(accelerometer.y || 0).toFixed(2)} m/s²</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Z-Axis:</span>
          <span className="text-emerald-400 font-bold">{(accelerometer.z || 0).toFixed(2)} m/s²</span>
        </div>
      </div>
    </div>
  );
};
