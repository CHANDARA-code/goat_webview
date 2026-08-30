export interface DeviceInfo {
  platform: 'android' | 'ios' | 'web' | 'desktop';
  osVersion: string;
  model?: string;
  deviceName?: string;
  screen?: {
    width: number;
    height: number;
    scale?: number;
  };
  custom?: Record<string, any>;
}

export interface PairingSession {
  id: string;
  token: string;
  appId: string;
  pairingUrl: string;
  qrTerminal: string;
  qrDataUrl: string;
  qrSvg: string;
  deviceName: string;
  platform: string;
  osVersion: string;
  ipAddress: string;
  connectedAt: number;
  disconnectedAt?: number;
  status: 'PENDING' | 'ACTIVE' | 'CLOSED';
  deviceInfo?: DeviceInfo;
}

export interface HandshakeRequest {
  token: string;
  deviceInfo: DeviceInfo;
}
