/**
 * networkThrottler.ts — Simulates bandwidth, latency, and packet loss profiles for network requests.
 */

import type { NetworkPreset, NetworkProfileId } from '../types/index.ts';

export interface NetworkProfile {
  preset: NetworkPreset;
  downloadKbps: number;
  uploadKbps: number;
  latencyMs: number;
  packetLossRate: number; // 0.0 to 1.0
  isOffline: boolean;
}

export const NETWORK_PROFILES: Record<string, NetworkProfile> = {
  online: {
    preset: 'online',
    downloadKbps: 100000,
    uploadKbps: 50000,
    latencyMs: 0,
    packetLossRate: 0,
    isOffline: false,
  },
  offline: {
    preset: 'offline',
    downloadKbps: 0,
    uploadKbps: 0,
    latencyMs: 0,
    packetLossRate: 1.0,
    isOffline: true,
  },
  '5g': {
    preset: '5g',
    downloadKbps: 100000,
    uploadKbps: 50000,
    latencyMs: 10,
    packetLossRate: 0,
    isOffline: false,
  },
  '4g': {
    preset: '4g',
    downloadKbps: 20000,
    uploadKbps: 10000,
    latencyMs: 40,
    packetLossRate: 0,
    isOffline: false,
  },
  '3g': {
    preset: '3g',
    downloadKbps: 750,
    uploadKbps: 250,
    latencyMs: 150,
    packetLossRate: 0,
    isOffline: false,
  },
  '2g': {
    preset: '2g',
    downloadKbps: 250,
    uploadKbps: 50,
    latencyMs: 400,
    packetLossRate: 0,
    isOffline: false,
  },
  high_latency: {
    preset: 'high_latency',
    downloadKbps: 1000,
    uploadKbps: 500,
    latencyMs: 800,
    packetLossRate: 0.05,
    isOffline: false,
  },
  'high-latency': {
    preset: 'high-latency',
    downloadKbps: 1000,
    uploadKbps: 500,
    latencyMs: 800,
    packetLossRate: 0.05,
    isOffline: false,
  },
  packet_loss: {
    preset: 'packet_loss',
    downloadKbps: 5000,
    uploadKbps: 2000,
    latencyMs: 80,
    packetLossRate: 0.25,
    isOffline: false,
  },
  'packet-loss': {
    preset: 'packet-loss',
    downloadKbps: 5000,
    uploadKbps: 2000,
    latencyMs: 80,
    packetLossRate: 0.25,
    isOffline: false,
  },
  custom: {
    preset: 'custom',
    downloadKbps: 10000,
    uploadKbps: 5000,
    latencyMs: 50,
    packetLossRate: 0,
    isOffline: false,
  },
};

export class NetworkThrottler {
  private activeProfile: NetworkProfile = { ...NETWORK_PROFILES.online };

  setPreset(preset: NetworkPreset | string): void {
    const normalized = String(preset).toLowerCase();
    if (NETWORK_PROFILES[normalized]) {
      this.activeProfile = { ...NETWORK_PROFILES[normalized] };
    } else if (NETWORK_PROFILES[normalized.replace('_', '-')]) {
      this.activeProfile = { ...NETWORK_PROFILES[normalized.replace('_', '-')] };
    } else {
      this.activeProfile = { ...NETWORK_PROFILES.online };
    }
  }

  setCustom(config: Partial<NetworkProfile>): void {
    this.activeProfile = {
      ...this.activeProfile,
      ...config,
      preset: 'custom',
    };
  }

  getProfile(): NetworkProfile {
    return { ...this.activeProfile };
  }

  /**
   * Applies throttling delay and packet loss check to an async request execution.
   */
  async simulateRequest<T>(requestFn: () => Promise<T>, payloadSizeBytes: number = 1024): Promise<T> {
    if (this.activeProfile.isOffline) {
      throw new Error('Network offline (ERR_INTERNET_DISCONNECTED)');
    }

    if (this.activeProfile.packetLossRate > 0 && Math.random() < this.activeProfile.packetLossRate) {
      throw new Error('Network request dropped due to packet loss (ERR_NETWORK_CHANGED)');
    }

    // Calculate bandwidth transfer time (in ms)
    const downloadBps = (this.activeProfile.downloadKbps * 1024) / 8;
    const transferDelayMs = downloadBps > 0 ? (payloadSizeBytes / downloadBps) * 1000 : 0;
    const totalDelayMs = Math.round(this.activeProfile.latencyMs + transferDelayMs);

    if (totalDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, totalDelayMs));
    }

    return await requestFn();
  }
}

