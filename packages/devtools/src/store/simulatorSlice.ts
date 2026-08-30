/**
 * @goat/devtools - Simulator Zustand Slice
 * High-performance state management for Dual-Thread Device Simulator.
 */

import type { StateCreator } from 'zustand';
import type {
  SimulatorSlice,
  DevToolsStore,
  DeviceSkinId,
  DeviceSkinType,
  DeviceOrientation,
  Orientation,
  ViewportScale,
  SimulatorRuntimeMode,
  FrameRateMetrics,
  DeviceSafeArea,
  ThemeMode,
} from '../types/index.ts';

export interface DeviceDimensionSpec {
  id: DeviceSkinType;
  name: string;
  width: number;
  height: number;
  cornerRadius: number;
  bezelWidth: number;
  hasDynamicIsland?: boolean;
  hasPunchHole?: boolean;
  isFoldable?: boolean;
  isTablet?: boolean;
  safeArea: {
    portrait: DeviceSafeArea;
    landscape: DeviceSafeArea;
  };
}

export const DEVICE_SPECS: Record<string, DeviceDimensionSpec> = {
  iphone16pro: {
    id: 'iphone16pro',
    name: 'iPhone 16 Pro',
    width: 393,
    height: 852,
    cornerRadius: 50,
    bezelWidth: 10,
    hasDynamicIsland: true,
    safeArea: {
      portrait: { top: 59, bottom: 34, left: 0, right: 0 },
      landscape: { top: 0, bottom: 21, left: 59, right: 59 },
    },
  },
  'iphone-16-pro': {
    id: 'iphone-16-pro' as any,
    name: 'iPhone 16 Pro',
    width: 393,
    height: 852,
    cornerRadius: 50,
    bezelWidth: 10,
    hasDynamicIsland: true,
    safeArea: {
      portrait: { top: 59, bottom: 34, left: 0, right: 0 },
      landscape: { top: 0, bottom: 21, left: 59, right: 59 },
    },
  },
  pixel9pro: {
    id: 'pixel9pro',
    name: 'Pixel 9 Pro',
    width: 412,
    height: 892,
    cornerRadius: 44,
    bezelWidth: 8,
    hasPunchHole: true,
    safeArea: {
      portrait: { top: 48, bottom: 24, left: 0, right: 0 },
      landscape: { top: 0, bottom: 16, left: 48, right: 48 },
    },
  },
  'pixel-9-pro': {
    id: 'pixel-9-pro' as any,
    name: 'Pixel 9 Pro',
    width: 412,
    height: 892,
    cornerRadius: 44,
    bezelWidth: 8,
    hasPunchHole: true,
    safeArea: {
      portrait: { top: 48, bottom: 24, left: 0, right: 0 },
      landscape: { top: 0, bottom: 16, left: 48, right: 48 },
    },
  },
  ipadpro: {
    id: 'ipadpro',
    name: 'iPad Pro 11"',
    width: 768,
    height: 1024,
    cornerRadius: 24,
    bezelWidth: 16,
    isTablet: true,
    safeArea: {
      portrait: { top: 24, bottom: 20, left: 0, right: 0 },
      landscape: { top: 24, bottom: 20, left: 0, right: 0 },
    },
  },
  'ipad-pro': {
    id: 'ipad-pro' as any,
    name: 'iPad Pro 11"',
    width: 768,
    height: 1024,
    cornerRadius: 24,
    bezelWidth: 16,
    isTablet: true,
    safeArea: {
      portrait: { top: 24, bottom: 20, left: 0, right: 0 },
      landscape: { top: 24, bottom: 20, left: 0, right: 0 },
    },
  },
  'ipad-pro-11': {
    id: 'ipad-pro-11' as any,
    name: 'iPad Pro 11"',
    width: 768,
    height: 1024,
    cornerRadius: 24,
    bezelWidth: 16,
    isTablet: true,
    safeArea: {
      portrait: { top: 24, bottom: 20, left: 0, right: 0 },
      landscape: { top: 24, bottom: 20, left: 0, right: 0 },
    },
  },
  foldable: {
    id: 'foldable',
    name: 'Foldable Dual-Screen',
    width: 680,
    height: 600,
    cornerRadius: 28,
    bezelWidth: 12,
    isFoldable: true,
    safeArea: {
      portrait: { top: 32, bottom: 20, left: 0, right: 0 },
      landscape: { top: 24, bottom: 20, left: 32, right: 32 },
    },
  },
  'foldable-dual': {
    id: 'foldable-dual' as any,
    name: 'Foldable Dual-Screen',
    width: 680,
    height: 600,
    cornerRadius: 28,
    bezelWidth: 12,
    isFoldable: true,
    safeArea: {
      portrait: { top: 32, bottom: 20, left: 0, right: 0 },
      landscape: { top: 24, bottom: 20, left: 32, right: 32 },
    },
  },
};

function resolveInsets(skin: DeviceSkinType | string, orientation: Orientation): DeviceSafeArea {
  const spec = DEVICE_SPECS[skin] || DEVICE_SPECS.iphone16pro;
  return spec.safeArea[orientation] || spec.safeArea.portrait;
}

export const createSimulatorSlice: StateCreator<DevToolsStore, [], [], any> = (set, get) => ({
  activeSkinId: 'iphone-16-pro',
  activeDeviceSkin: 'iphone16pro',
  orientation: 'portrait',
  scale: 1.0,
  viewportScale: 1.0,
  simulatorTheme: 'dark',
  runtimeMode: 'in-memory',
  isRunning: true,
  isLoading: false,
  lastError: null,
  safeAreaInsets: { top: 59, bottom: 34, left: 0, right: 0 },
  frameBatchingEnabled: true,
  fps: 60,
  showSafeAreaOverlay: false,
  metrics: {
    fps: 60,
    frameTimeMs: 16.6,
    droppedFrames: 0,
    vdomPatchCount: 0,
    lastUpdated: Date.now(),
  },

  setActiveDeviceSkin: (skin: string) => {
    const normalized = skin.toLowerCase().replace(/[^a-z0-9]/g, '');

    let skinId: DeviceSkinId = 'iphone-16-pro';
    let deviceSkin: DeviceSkinType = 'iphone16pro';

    if (normalized.includes('pixel')) {
      skinId = 'pixel-9-pro';
      deviceSkin = 'pixel9pro';
    } else if (normalized.includes('ipad')) {
      skinId = 'ipad-pro';
      deviceSkin = 'ipadpro';
    } else if (normalized.includes('foldable')) {
      skinId = 'foldable';
      deviceSkin = 'foldable';
    } else {
      skinId = 'iphone-16-pro';
      deviceSkin = 'iphone16pro';
    }

    const orientation = get().orientation || 'portrait';
    const insets = resolveInsets(deviceSkin, orientation);

    set({
      activeSkinId: skinId,
      activeDeviceSkin: deviceSkin,
      safeAreaInsets: insets,
    } as any);
  },

  setDeviceSkin: (skin: any) => {
    get().setActiveDeviceSkin(skin);
  },

  setOrientation: (orientation: DeviceOrientation) => {
    const currentSkin = get().activeDeviceSkin || 'iphone16pro';
    const insets = resolveInsets(currentSkin, orientation);
    set({ orientation, safeAreaInsets: insets } as any);
  },

  setScale: (scale: ViewportScale | number) => {
    set({ scale: scale as any, viewportScale: scale as any } as any);
  },

  setViewportScale: (scale: ViewportScale | number) => {
    set({ scale: scale as any, viewportScale: scale as any } as any);
  },

  toggleOrientation: () => {
    const next: Orientation = get().orientation === 'portrait' ? 'landscape' : 'portrait';
    const currentSkin = get().activeDeviceSkin || 'iphone16pro';
    const insets = resolveInsets(currentSkin, next);
    set({ orientation: next, safeAreaInsets: insets } as any);
  },

  setSimulatorTheme: (theme: ThemeMode) => set({ simulatorTheme: theme } as any),

  toggleSimulatorTheme: () => {
    const next = get().simulatorTheme === 'dark' ? 'light' : 'dark';
    set({ simulatorTheme: next } as any);
  },

  setRuntimeMode: (runtimeMode: SimulatorRuntimeMode) => set({ runtimeMode } as any),

  startSimulator: () => set({ isRunning: true } as any),

  stopSimulator: () => set({ isRunning: false } as any),

  setIsRunning: (isRunning: boolean) => set({ isRunning } as any),

  restartSimulator: () => {
    set({ isRunning: true, isLoading: false, lastError: null } as any);
    const addLog = (get() as any).addConsoleLog;
    if (typeof addLog === 'function') {
      addLog({
        thread: 'AppService',
        level: 'info',
        message: 'Mini-App dual-thread runtime restarted',
        timestamp: Date.now(),
      });
    }
  },

  setSimulatorError: (lastError: string | null) => set({ lastError } as any),

  setShowSafeAreaOverlay: (show: boolean) => set({ showSafeAreaOverlay: show } as any),

  toggleSafeAreaOverlay: () => set((state: any) => ({ showSafeAreaOverlay: !state.showSafeAreaOverlay }) as any),

  updateMetrics: (metrics: Partial<FrameRateMetrics>) =>
    set((state: any) => ({
      metrics: { ...state.metrics, ...metrics, lastUpdated: Date.now() },
      fps: metrics.fps !== undefined ? metrics.fps : state.fps,
    }) as any),

  setSafeAreaInsets: (safeAreaInsets: DeviceSafeArea) => set({ safeAreaInsets } as any),

  setFrameBatchingEnabled: (frameBatchingEnabled: boolean) => set({ frameBatchingEnabled } as any),

  setFps: (fps: number) =>
    set((state: any) => ({
      fps,
      metrics: { ...state.metrics, fps, lastUpdated: Date.now() },
    }) as any),
});
