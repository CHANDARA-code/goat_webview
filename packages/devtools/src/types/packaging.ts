/**
 * @goat/devtools - Packaging & Build Type Definitions
 */

export interface SubpackageConfig {
  root: string;
  name?: string;
  pages: string[];
  independent?: boolean;
  sizeBytes?: number;
}

export interface SubpackageChunk {
  name: string;
  root: string;
  sizeBytes: number;
  uncompressedSizeBytes: number;
  files: Array<{ path: string; sizeBytes: number }>;
  preloadRule?: { network: 'all' | 'wifi' };
}

export interface BundleStats {
  mainPackageSize: number;
  mainSizeBytes?: number;
  subpackages: SubpackageChunk[] | any[];
  totalSizeBytes: number;
  maxRecommendedSizeBytes: number;
  isWithinQuota: boolean;
  warnings: string[];
}

export interface BundleSizeStats {
  mainPackageBytes: number;
  subpackagesBytes: Record<string, number>;
  totalBytes: number;
  isWithinQuota: boolean;
}

export interface BytecodeEstimate {
  rawJsSizeBytes: number;
  bytecodeSizeBytes: number;
  compressionRatio: number;
  estimatedColdBootMs: number;
  cachedBootMs: number;
  integrityHash: string;
}

export interface V8BytecodeStats {
  enabled?: boolean;
  rawJsSizeBytes?: number;
  bytecodeSizeBytes?: number;
  originalSizeBytes?: number;
  compilationTimeMs?: number;
  compressionRatio?: number;
  estimatedColdBootMs?: number;
  cachedBootMs?: number;
  cacheHit?: boolean;
  status?: string;
  integrityHash?: string;
}

export interface QrPairingSession {
  token: string;
  url: string;
  qrSvg: string;
  status: 'pending' | 'connected' | 'expired';
  deviceInfo?: {
    platform: string;
    model: string;
    ipAddress: string;
  };
}

export interface QrPairingState {
  pairingCode: string | null;
  wsUrl: string | null;
  isConnected: boolean;
  clientDevice?: {
    name: string;
    platform: string;
    version: string;
  } | null;
}

export interface PackagingSlice {
  subpackages: SubpackageConfig[] | SubpackageChunk[] | any[];
  bundleStats: BundleStats | any | null;
  bundleSizeStats?: BundleSizeStats | any;
  bytecodeEstimate: BytecodeEstimate | any | null;
  v8BytecodeStats: V8BytecodeStats | any;
  qrSession: QrPairingSession | any | null;
  qrPairing: QrPairingState | any;
  isBuilding: boolean;

  setSubpackages: (subs: any[]) => void;
  addSubpackage: (sub: any) => void;
  removeSubpackage: (root: string) => void;
  setBundleStats: (stats: BundleStats | any | null) => void;
  setBundleSizeStats: (stats: BundleStats | any | null) => void;
  updateBundleStats: (stats: Partial<BundleStats> | any) => void;
  setBytecodeEstimate: (estimate: BytecodeEstimate | any | null) => void;
  setV8BytecodeStats: (stats: Partial<V8BytecodeStats> | any) => void;
  setQrSession: (session: QrPairingSession | any | null) => void;
  setQrPairing: (qr: Partial<QrPairingState> | any) => void;
  setIsBuilding: (building: boolean) => void;
}
