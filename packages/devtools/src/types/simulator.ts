/**
 * @goat/devtools - Simulator Type Definitions
 */

import type { ThemeMode } from './ide.ts';

export type DeviceSkinType = 'iphone16pro' | 'pixel9pro' | 'ipadpro' | 'foldable';

export type DeviceSkinId =
  | 'iphone-16-pro'
  | 'pixel-9-pro'
  | 'ipad-pro-11'
  | 'ipad-pro'
  | 'foldable-dual'
  | 'foldable'
  | 'iphone16pro'
  | 'pixel9pro'
  | 'ipadpro';

export type DeviceOrientation = 'portrait' | 'landscape';
export type Orientation = 'portrait' | 'landscape';

export type ViewportScale = 0.5 | 0.75 | 1.0 | 1.25 | 1.5;

export interface DeviceSafeArea {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface DeviceSkinDefinition {
  id: DeviceSkinId;
  name: string;
  category: 'phone' | 'tablet' | 'foldable';
  width: number;
  height: number;
  pixelRatio: number;
  safeArea: {
    portrait: DeviceSafeArea;
    landscape: DeviceSafeArea;
  };
  hasDynamicIsland?: boolean;
  hasPunchHole?: boolean;
  cornerRadius: number;
  bezelWidth: number;
}

export type SimulatorRuntimeMode = 'in-memory' | 'iframe' | 'web-worker' | 'cdp-remote';

export interface FrameRateMetrics {
  fps: number;
  frameTimeMs: number;
  droppedFrames: number;
  vdomPatchCount: number;
  lastUpdated: number;
}

export interface SimulatorState {
  activeSkinId: DeviceSkinId;
  activeDeviceSkin?: DeviceSkinType;
  orientation: DeviceOrientation;
  scale: ViewportScale;
  runtimeMode: SimulatorRuntimeMode;
  isRunning: boolean;
  isLoading: boolean;
  lastError: string | null;
  metrics: FrameRateMetrics;
}

export interface SimulatorSlice {
  activeSkinId: DeviceSkinId;
  activeDeviceSkin: DeviceSkinType;
  viewportScale: ViewportScale;
  scale: ViewportScale | number;
  orientation: Orientation;
  simulatorTheme: ThemeMode;
  runtimeMode: SimulatorRuntimeMode;
  isRunning: boolean;
  isLoading: boolean;
  lastError: string | null;
  safeAreaInsets: { top: number; bottom: number; left: number; right: number };
  frameBatchingEnabled: boolean;
  fps: number;
  metrics: FrameRateMetrics;

  setActiveDeviceSkin: (skin: DeviceSkinType | string) => void;
  setDeviceSkin: (skin: any) => void;
  setViewportScale: (scale: ViewportScale | number) => void;
  setScale: (scale: any) => void;
  setOrientation: (orientation: Orientation | any) => void;
  toggleOrientation: () => void;
  setSimulatorTheme: (theme: ThemeMode) => void;
  toggleSimulatorTheme: () => void;
  setRuntimeMode: (mode: SimulatorRuntimeMode) => void;
  startSimulator: () => void;
  stopSimulator: () => void;
  setIsRunning: (running: boolean) => void;
  restartSimulator: () => void;
  setSimulatorError: (err: string | null) => void;
  updateMetrics: (metrics: any) => void;
  setSafeAreaInsets: (insets: any) => void;
  setFrameBatchingEnabled: (enabled: boolean) => void;
  setFps: (fps: number) => void;
}
