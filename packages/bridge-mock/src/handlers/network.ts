/**
 * @goat/bridge-mock - Domain 4: Networking, HTTP & WebSockets Handlers (10 Actions)
 */

import { mockState } from '../state/store.js';
import {
  ApiResponseData,
  DownloadResult,
  UploadFileResult,
  GetNetworkTypeResult,
  SslPinAuditResult,
} from '../types.js';
import { GoatBridgeError, BridgeErrorCodes } from '../errors.js';

export function isPrivateOrBlockedHost(rawHost: string): boolean {
  if (!rawHost || typeof rawHost !== 'string') return true;
  let host = rawHost.toLowerCase().trim();
  // Strip enclosing brackets for IPv6
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1);
  }

  // Localhost & loopback & unspecified checks
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '::1' ||
    host === '::' ||
    host === '0.0.0.0'
  ) {
    return true;
  }

  // IPv6 mapped IPv4 e.g. ::ffff:127.0.0.1 or ::ffff:10.0.0.1
  if (host.startsWith('::ffff:')) {
    return isPrivateOrBlockedHost(host.slice(7));
  }

  // Expanded IPv6 loopback / unspecified / link-local / unique local (ULA)
  if (
    host === '0000:0000:0000:0000:0000:0000:0000:0001' ||
    host === '0000:0000:0000:0000:0000:0000:0000:0000' ||
    host.startsWith('fe80:') ||
    host.startsWith('fc00:') ||
    host.startsWith('fd00:') ||
    /^fe[89ab][0-9a-f]:/i.test(host) ||
    /^f[cd][0-9a-f]{2}:/i.test(host)
  ) {
    return true;
  }

  // IPv4 range matching
  const parts = host.split('.');
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const [a, b, c, d] = parts.map(Number);
    if (a >= 0 && a <= 255 && b >= 0 && b <= 255 && c >= 0 && c <= 255 && d >= 0 && d <= 255) {
      if (a === 0) return true; // 0.0.0.0/8
      if (a === 127) return true; // 127.0.0.0/8 (Loopback)
      if (a === 10) return true; // 10.0.0.0/8 (RFC1918)
      if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (RFC1918)
      if (a === 192 && b === 168) return true; // 192.168.0.0/16 (RFC1918)
      if (a === 169 && b === 254) return true; // 169.254.0.0/16 (Link-local & Cloud Metadata)
      if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (Carrier-grade NAT)
      if (a >= 224) return true; // 224.0.0.0/4 Multicast & 240.0.0.0/4 Reserved
    }
  }

  return false;
}

export class NetworkHandlers {
  private static activeSockets: Map<string, any> = new Map();
  private static downloadCounter: number = 1000;

  /**
   * Action 40: API_REQUEST
   */
  public static async apiRequest(payload: any = {}): Promise<ApiResponseData> {
    const rawUrl = payload.url;
    if (!rawUrl || typeof rawUrl !== 'string') {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing required "url" parameter for API request');
    }

    if (!mockState.network.isConnected) {
      throw new GoatBridgeError(BridgeErrorCodes.NETWORK_OFFLINE, 'Network is currently offline');
    }

    // SSRF Guardrail Simulation
    try {
      const parsed = new URL(rawUrl);
      const host = parsed.hostname;
      if (isPrivateOrBlockedHost(host)) {
        throw new GoatBridgeError(
          BridgeErrorCodes.SSRF_BLOCKED,
          `SSRF protection: Request to private host "${host}" blocked by security policy`
        );
      }
    } catch (e: any) {
      if (e instanceof GoatBridgeError) throw e;
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, `Malformed URL: ${rawUrl}`);
    }

    const method = (payload.method || 'GET').toUpperCase();
    const headers = payload.headers || {};
    const startTime = Date.now();

    // If fetch is available in environment and URL is reachable, attempt realistic mock response
    let responseData: any = { message: 'Mock API response', status: 'ok', echoPayload: payload.body ? payload.body : undefined };
    let status = 200;
    let statusText = 'OK';

    // Simulate network roundtrip latency
    await new Promise((r) => setTimeout(r, 20));

    return {
      status,
      statusText,
      headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
      data: responseData,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Action 41: DOWNLOAD_FILE
   */
  public static downloadFile(payload: any = {}): DownloadResult {
    const url = payload.url;
    if (!url) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing required "url" for downloadFile');
    }
    const fileName = payload.fileName || `download_${Date.now()}.bin`;
    const downloadId = ++this.downloadCounter;

    return {
      downloadId,
      status: 'COMPLETED',
      fileName,
    };
  }

  /**
   * Action 42: UPLOAD_FILE
   */
  public static uploadFile(payload: any = {}): UploadFileResult {
    const url = payload.url;
    const filePath = payload.filePath;
    if (!url || !filePath) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing url or filePath for uploadFile');
    }

    return {
      statusCode: 200,
      data: JSON.stringify({ success: true, uploadedPath: filePath, remoteUrl: url }),
    };
  }

  /**
   * Action 43: GET_NETWORK_TYPE
   */
  public static getNetworkType(): GetNetworkTypeResult {
    return { ...mockState.network };
  }

  /**
   * Action 44: IS_CONNECTED
   */
  public static isConnected(): { isConnected: boolean; networkType: string } {
    return {
      isConnected: mockState.network.isConnected,
      networkType: mockState.network.networkType,
    };
  }

  /**
   * Action 45: WEBSOCKET_CONNECT
   */
  public static connectSocket(payload: any = {}): { connected: boolean; url: string } {
    const url = payload.url;
    if (!url) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing "url" for WebSocket connect');
    }
    if (!mockState.network.isConnected) {
      throw new GoatBridgeError(BridgeErrorCodes.NETWORK_OFFLINE, 'Cannot connect WebSocket: network offline');
    }

    this.activeSockets.set(url, { connectedAt: Date.now() });
    return { connected: true, url };
  }

  /**
   * Action 46: WEBSOCKET_SEND
   */
  public static sendSocketMessage(payload: any = {}): { sent: boolean } {
    if (this.activeSockets.size === 0) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'No active WebSocket connection');
    }
    return { sent: true };
  }

  /**
   * Action 47: WEBSOCKET_CLOSE
   */
  public static closeSocket(): { closed: boolean } {
    this.activeSockets.clear();
    return { closed: true };
  }

  /**
   * Action 48: VERIFY_SSL_PIN
   */
  public static verifySslPin(payload: any = {}): SslPinAuditResult {
    const hostname = payload.hostname || 'goat.dev';
    const pinSha256 = payload.pinSha256 || 'pin-sha256="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="';

    return {
      hostname,
      isPinned: true,
      isCertificateValid: true,
      matchedPin: pinSha256,
      auditStatus: 'VERIFIED_OK',
    };
  }

  /**
   * Action 49: AUDIT_NETWORK_CERTIFICATE
   */
  public static auditNetworkCertificate(payload: any = {}): SslPinAuditResult {
    const url = payload.url || 'https://goat.dev';
    let hostname = 'goat.dev';
    try {
      hostname = new URL(url).hostname;
    } catch {
      hostname = url;
    }

    return {
      hostname,
      isPinned: true,
      isCertificateValid: true,
      auditStatus: 'CERTIFICATE_VALID',
    };
  }
}
