/**
 * @goat/devtools - Packaging & Build Zustand Slice
 */

import type { StateCreator } from 'zustand';
import type {
  BundleStats,
  BytecodeEstimate,
  QrPairingSession,
} from '../types/packaging.ts';

export interface PackagingSlice {
  bundleStats: BundleStats | any | null;
  bundleSizeStats: any;
  bytecodeEstimate: BytecodeEstimate | any | null;
  v8BytecodeStats: any;
  qrSession: QrPairingSession | any | null;
  qrPairing: any;
  subpackages: any[];
  isBuilding: boolean;

  setBundleStats: (stats: BundleStats | any | null) => void;
  setBundleSizeStats: (stats: BundleStats | any | null) => void;
  updateBundleStats: (stats: any) => void;
  setBytecodeEstimate: (estimate: BytecodeEstimate | any | null) => void;
  setV8BytecodeStats: (stats: any) => void;
  setQrSession: (session: QrPairingSession | any | null) => void;
  setQrPairing: (qr: any) => void;
  setSubpackages: (subs: any[]) => void;
  addSubpackage: (sub: any) => void;
  removeSubpackage: (root: string) => void;
  setIsBuilding: (building: boolean) => void;
}

export const createPackagingSlice: StateCreator<PackagingSlice, [], [], PackagingSlice> = (set) => {
  const initialBundle = {
    mainPackageSize: 142300,
    mainSizeBytes: 142300,
    subpackages: [
      {
        name: 'checkout',
        root: 'subpackages/checkout',
        sizeBytes: 86400,
        uncompressedSizeBytes: 215000,
        files: [{ path: 'pages/payment.js', sizeBytes: 86400 }],
        preloadRule: { network: 'wifi' },
      },
    ],
    totalSizeBytes: 228700,
    maxRecommendedSizeBytes: 2097152, // 2MB
    isWithinQuota: true,
    warnings: [],
  };

  const initialBytecode = {
    enabled: false,
    rawJsSizeBytes: 142300,
    bytecodeSizeBytes: 68500,
    compressionRatio: 0.48,
    estimatedColdBootMs: 8.4,
    cachedBootMs: 2.1,
    integrityHash: 'sha256-a1b2c3d4e5f6',
  };

  return {
    subpackages: [
      {
        name: 'checkout',
        root: 'subpackages/checkout',
        sizeBytes: 86400,
        uncompressedSizeBytes: 215000,
        files: [{ path: 'pages/payment.js', sizeBytes: 86400 }],
        preloadRule: { network: 'wifi' },
      },
    ],
    bundleStats: initialBundle,
    bundleSizeStats: initialBundle,
    bytecodeEstimate: initialBytecode,
    v8BytecodeStats: initialBytecode,
    qrSession: null,
    qrPairing: {
      pairingCode: null,
      wsUrl: null,
      isConnected: false,
      clientDevice: null,
    },
    isBuilding: false,

    setBundleStats: (stats) => {
      set({ bundleStats: stats, bundleSizeStats: stats });
    },

    setBundleSizeStats: (stats) => {
      set({ bundleStats: stats, bundleSizeStats: stats });
    },

    updateBundleStats: (stats) => {
      set((state) => {
        const merged = { ...state.bundleStats, ...stats };
        return { bundleStats: merged, bundleSizeStats: merged };
      });
    },

    setBytecodeEstimate: (estimate) => {
      set({ bytecodeEstimate: estimate, v8BytecodeStats: estimate });
    },

    setV8BytecodeStats: (stats) => {
      set((state) => {
        const merged = { ...state.v8BytecodeStats, ...stats };
        return { v8BytecodeStats: merged, bytecodeEstimate: merged };
      });
    },

    setQrSession: (session) => {
      set({ qrSession: session, qrPairing: session });
    },

    setQrPairing: (qr) => {
      set((state) => {
        const merged = { ...state.qrPairing, ...qr };
        return { qrPairing: merged, qrSession: merged };
      });
    },

    setSubpackages: (subs) => {
      set({ subpackages: subs });
    },

    addSubpackage: (sub) => {
      set((state) => ({ subpackages: [...state.subpackages, sub] }));
    },

    removeSubpackage: (root) => {
      set((state) => ({
        subpackages: state.subpackages.filter((s: any) => s.root !== root && s.name !== root),
      }));
    },

    setIsBuilding: (building) => {
      set({ isBuilding: building });
    },
  };
};
