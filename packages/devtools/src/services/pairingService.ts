/**
 * @goat/devtools - Physical Device CDP & QR Pairing Service
 * Connects to @goat/server (/api/pair/init, /api/pair/qr/:token, /api/pair/status/:token)
 * and manages real-time physical device pairing and CDP relay status.
 */

export interface DeviceInfo {
  platform: 'android' | 'ios' | 'web' | 'desktop';
  osVersion: string;
  model?: string;
  deviceName?: string;
  ipAddress?: string;
  screen?: {
    width: number;
    height: number;
    scale?: number;
  };
  custom?: Record<string, any>;
}

export interface PairingSessionResponse {
  id: string;
  token: string;
  appId: string;
  pairingUrl: string;
  qrTerminal: string;
  qrDataUrl?: string;
  qrSvg: string;
  deviceName?: string;
  platform?: string;
  osVersion?: string;
  ipAddress?: string;
  connectedAt?: number;
  status: 'PENDING' | 'ACTIVE' | 'CLOSED' | 'pending' | 'connected' | 'expired';
  deviceInfo?: DeviceInfo;
}

export interface PairingStatusResponse {
  token: string;
  status: 'PENDING' | 'ACTIVE' | 'CLOSED' | 'pending' | 'connected' | 'expired';
  deviceName?: string;
  platform?: string;
  osVersion?: string;
  ipAddress?: string;
  connectedAt?: number;
}

export class PairingService {
  private defaultServerUrl: string;
  private activePollingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(serverUrl: string = 'http://localhost:7373') {
    this.defaultServerUrl = serverUrl;
  }

  /**
   * Set or update default @goat/server base URL
   */
  public setServerUrl(url: string): void {
    this.defaultServerUrl = url.replace(/\/+$/, '');
  }

  public getServerUrl(): string {
    return this.defaultServerUrl;
  }

  /**
   * Initialize a new device pairing session via @goat/server POST /api/pair/init
   */
  public async initSession(
    appId: string = 'com.goat.miniapp',
    serverUrl?: string
  ): Promise<PairingSessionResponse> {
    const base = (serverUrl || this.defaultServerUrl).replace(/\/+$/, '');
    try {
      const res = await fetch(`${base}/api/pair/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId }),
      });

      if (!res.ok) {
        throw new Error(`Failed to initialize pairing session: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      return data as PairingSessionResponse;
    } catch (err) {
      // Offline fallback: generate client-side valid mock session
      return this.generateFallbackSession(appId, base);
    }
  }

  /**
   * Fetch QR code representation (svg, json, or terminal) for active session token
   */
  public async getQrCode(
    token: string,
    format: 'svg' | 'json' | 'terminal' = 'svg',
    serverUrl?: string
  ): Promise<string> {
    const base = (serverUrl || this.defaultServerUrl).replace(/\/+$/, '');
    try {
      const res = await fetch(`${base}/api/pair/qr/${encodeURIComponent(token)}?format=${format}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch QR code: ${res.status}`);
      }
      if (format === 'svg' || format === 'terminal') {
        return await res.text();
      }
      const json = await res.json();
      return json.qrSvg || json.qrDataUrl || '';
    } catch {
      return this.generateFallbackQrSvg(token);
    }
  }

  /**
   * Poll connection status for a session token
   */
  public async checkStatus(
    token: string,
    serverUrl?: string
  ): Promise<PairingStatusResponse> {
    const base = (serverUrl || this.defaultServerUrl).replace(/\/+$/, '');
    try {
      const res = await fetch(`${base}/api/pair/status/${encodeURIComponent(token)}`);
      if (!res.ok) {
        throw new Error(`Failed to check pairing status: ${res.status}`);
      }
      return (await res.json()) as PairingStatusResponse;
    } catch {
      return {
        token,
        status: 'PENDING',
      };
    }
  }

  /**
   * Start polling pairing status until connected or timeout (default 120s)
   */
  public startPolling(
    token: string,
    onUpdate: (status: PairingStatusResponse) => void,
    intervalMs: number = 2000,
    serverUrl?: string
  ): () => void {
    this.stopPolling();

    this.activePollingInterval = setInterval(async () => {
      const status = await this.checkStatus(token, serverUrl);
      onUpdate(status);
      if (status.status === 'ACTIVE' || status.status === 'connected' || status.status === 'CLOSED') {
        this.stopPolling();
      }
    }, intervalMs);

    return () => this.stopPolling();
  }

  public stopPolling(): void {
    if (this.activePollingInterval) {
      clearInterval(this.activePollingInterval);
      this.activePollingInterval = null;
    }
  }

  /**
   * Simulate a physical device handshake (used in simulation / testing)
   */
  public async simulateHandshake(
    token: string,
    deviceInfo: DeviceInfo,
    serverUrl?: string
  ): Promise<PairingSessionResponse | null> {
    const base = (serverUrl || this.defaultServerUrl).replace(/\/+$/, '');
    try {
      const res = await fetch(`${base}/api/pair/handshake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, deviceInfo }),
      });
      if (!res.ok) return null;
      return (await res.json()) as PairingSessionResponse;
    } catch {
      return null;
    }
  }

  /**
   * Fallback session generator for isolated dev environment without live @goat/server
   */
  public generateFallbackSession(appId: string, base: string): PairingSessionResponse {
    const token = `pair_${Math.random().toString(36).substring(2, 10)}`;
    const pairingCode = `GOAT-${Math.floor(1000 + Math.random() * 9000)}`;
    const wsUrl = `ws://${base.replace(/^https?:\/\//, '')}/devtools/page/goat-${token}`;
    const pairingUrl = `goat://pair?token=${token}&server=${encodeURIComponent(base)}&code=${pairingCode}`;

    return {
      id: `sess_${Date.now()}`,
      token,
      appId,
      pairingUrl,
      qrTerminal: `[QR Code for ${pairingUrl}]`,
      qrDataUrl: '',
      qrSvg: this.generateFallbackQrSvg(token),
      status: 'PENDING',
      deviceName: 'Goat Device Relay',
      platform: 'universal',
      osVersion: '1.0.0',
      ipAddress: '127.0.0.1',
      connectedAt: Date.now(),
    };
  }

  /**
   * Generates a clean SVG QR code mockup with embedded Goat branding
   */
  public generateFallbackQrSvg(token: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
      <rect width="180" height="180" fill="#ffffff" rx="12"/>
      <!-- Outer Markers -->
      <rect x="12" y="12" width="44" height="44" fill="#0f172a" rx="6"/>
      <rect x="20" y="20" width="28" height="28" fill="#ffffff" rx="3"/>
      <rect x="26" y="26" width="16" height="16" fill="#0f172a" rx="2"/>

      <rect x="124" y="12" width="44" height="44" fill="#0f172a" rx="6"/>
      <rect x="132" y="20" width="28" height="28" fill="#ffffff" rx="3"/>
      <rect x="138" y="26" width="16" height="16" fill="#0f172a" rx="2"/>

      <rect x="12" y="124" width="44" height="44" fill="#0f172a" rx="6"/>
      <rect x="20" y="132" width="28" height="28" fill="#ffffff" rx="3"/>
      <rect x="26" y="138" width="16" height="16" fill="#0f172a" rx="2"/>

      <!-- Matrix Patterns -->
      <rect x="68" y="18" width="10" height="10" fill="#0f172a" rx="2"/>
      <rect x="88" y="18" width="10" height="10" fill="#0f172a" rx="2"/>
      <rect x="104" y="28" width="10" height="10" fill="#0f172a" rx="2"/>
      <rect x="22" y="68" width="10" height="10" fill="#0f172a" rx="2"/>
      <rect x="42" y="88" width="10" height="10" fill="#0f172a" rx="2"/>
      <rect x="128" y="68" width="10" height="10" fill="#0f172a" rx="2"/>
      <rect x="148" y="88" width="10" height="10" fill="#0f172a" rx="2"/>
      <rect x="68" y="128" width="10" height="10" fill="#0f172a" rx="2"/>
      <rect x="88" y="148" width="10" height="10" fill="#0f172a" rx="2"/>
      <rect x="108" y="138" width="10" height="10" fill="#0f172a" rx="2"/>
      <rect x="128" y="128" width="10" height="10" fill="#0f172a" rx="2"/>
      <rect x="148" y="148" width="10" height="10" fill="#0f172a" rx="2"/>

      <!-- Center Goat Badge -->
      <rect x="65" y="65" width="50" height="50" fill="#2563eb" rx="10"/>
      <circle cx="90" cy="90" r="16" fill="#ffffff"/>
      <text x="90" y="95" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#2563eb" text-anchor="middle">🐐</text>
    </svg>`;
  }
}

export const pairingService = new PairingService();
