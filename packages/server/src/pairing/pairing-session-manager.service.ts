import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as qrcode from 'qrcode';
import { DatabaseService } from '../database/database.service';
import { DeviceInfo, PairingSession } from './pairing.types';

export class PairingRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PairingRateLimitError';
  }
}

export class PairingSessionManagerService extends EventEmitter {
  private static readonly SESSION_TTL_MS = 15 * 60 * 1000;
  private static readonly MAX_VERIFY_ATTEMPTS = 5;

  private inMemoryCache: Map<string, PairingSession> = new Map();
  private verificationAttempts: Map<string, number> = new Map();
  private host: string;
  private serverPort: number;

  constructor(
    private dbService: DatabaseService,
    host: string = '127.0.0.1',
    serverPort: number = 3001
  ) {
    super();
    this.host = host;
    this.serverPort = serverPort;
  }

  public setHostAndPort(host: string, serverPort: number): void {
    this.host = host;
    this.serverPort = serverPort;
  }

  public async createSession(appId: string = 'com.goat.app', customPort?: number): Promise<PairingSession> {
    const port = customPort || this.serverPort;
    const token = `pair_tok_${crypto.randomBytes(16).toString('hex')}`;
    const id = `sess_${crypto.randomUUID()}`;
    const pairingUrl = `goat://pair?server=http://${this.host}:${port}&token=${token}`;

    let qrTerminal = '';
    let qrDataUrl = '';
    let qrSvg = '';

    try {
      qrTerminal = await qrcode.toString(pairingUrl, { type: 'terminal', small: true });
    } catch {
      qrTerminal = `[QR: ${pairingUrl}]`;
    }

    try {
      qrDataUrl = await qrcode.toDataURL(pairingUrl);
    } catch {
      qrDataUrl = '';
    }

    try {
      qrSvg = await qrcode.toString(pairingUrl, { type: 'svg' });
    } catch {
      qrSvg = '';
    }

    const now = Date.now();
    const session: PairingSession = {
      id,
      token,
      appId,
      pairingUrl,
      qrTerminal,
      qrDataUrl,
      qrSvg,
      deviceName: 'Pending Device',
      platform: 'unknown',
      osVersion: 'unknown',
      ipAddress: '0.0.0.0',
      connectedAt: now,
      status: 'PENDING',
    };

    this.inMemoryCache.set(token, session);

    // Save to SQLite
    const sqlite = this.dbService.getRawSqlite();
    sqlite.prepare(`
      INSERT INTO sessions (id, token, app_id, device_name, platform, os_version, ip_address, connected_at, status, device_info)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      token,
      appId,
      session.deviceName,
      session.platform,
      session.osVersion,
      session.ipAddress,
      now,
      session.status,
      JSON.stringify(session.deviceInfo || {})
    );

    this.emit('sessionCreated', session);
    return session;
  }

  public handshake(token: string, deviceInfo: DeviceInfo, clientIp: string = '127.0.0.1'): PairingSession | null {
    this.enforceVerificationRateLimit(token);
    let session = this.inMemoryCache.get(token);
    const sqlite = this.dbService.getRawSqlite();

    if (!session) {
      const row = sqlite.prepare(`SELECT * FROM sessions WHERE token = ? LIMIT 1`).get(token) as any;
      if (!row) {
        this.recordFailedVerification(token);
        return null;
      }

      session = {
        id: row.id,
        token: row.token,
        appId: row.app_id,
        pairingUrl: `goat://pair?server=http://${this.host}:${this.serverPort}&token=${token}`,
        qrTerminal: '',
        qrDataUrl: '',
        qrSvg: '',
        deviceName: row.device_name,
        platform: row.platform,
        osVersion: row.os_version,
        ipAddress: row.ip_address,
        connectedAt: row.connected_at,
        disconnectedAt: row.disconnected_at || undefined,
        status: row.status as any,
        deviceInfo: row.device_info ? JSON.parse(row.device_info) : undefined,
      };
      this.inMemoryCache.set(token, session);
    }

    // Guard: reject CLOSED sessions
    if (session.status === 'CLOSED') {
      this.recordFailedVerification(token);
      return null;
    }

    // Guard: reject expired sessions (TTL 15min)
    if (session.connectedAt && Date.now() - session.connectedAt > PairingSessionManagerService.SESSION_TTL_MS) {
      session.status = 'CLOSED';
      session.disconnectedAt = Date.now();
      sqlite.prepare(`UPDATE sessions SET status = 'CLOSED', disconnected_at = ? WHERE token = ?`).run(session.disconnectedAt, token);
      this.recordFailedVerification(token);
      return null;
    }

    const deviceName = deviceInfo.deviceName || deviceInfo.model || `${deviceInfo.platform} Device`;
    session.deviceName = deviceName;
    session.platform = deviceInfo.platform;
    session.osVersion = deviceInfo.osVersion;
    session.ipAddress = clientIp;
    session.status = 'ACTIVE';
    session.deviceInfo = deviceInfo;

    sqlite.prepare(`
      UPDATE sessions
      SET device_name = ?, platform = ?, os_version = ?, ip_address = ?, status = 'ACTIVE', device_info = ?
      WHERE token = ?
    `).run(deviceName, deviceInfo.platform, deviceInfo.osVersion, clientIp, JSON.stringify(deviceInfo), token);

    this.verificationAttempts.delete(token);
    this.emit('sessionActive', session);
    return session;
  }

  private enforceVerificationRateLimit(token: string): void {
    const attempts = this.verificationAttempts.get(token) || 0;
    if (attempts >= PairingSessionManagerService.MAX_VERIFY_ATTEMPTS) {
      throw new PairingRateLimitError(
        `Pairing verification rate limit exceeded after ${PairingSessionManagerService.MAX_VERIFY_ATTEMPTS} failed attempts for token`
      );
    }
  }

  private recordFailedVerification(token: string): void {
    this.verificationAttempts.set(token, (this.verificationAttempts.get(token) || 0) + 1);
  }

  public getSession(tokenOrId: string): PairingSession | null {
    if (this.inMemoryCache.has(tokenOrId)) {
      const session = this.inMemoryCache.get(tokenOrId)!;
      if (session.status !== 'CLOSED' && session.connectedAt && Date.now() - session.connectedAt > PairingSessionManagerService.SESSION_TTL_MS) {
        session.status = 'CLOSED';
        session.disconnectedAt = Date.now();
        const sqlite = this.dbService.getRawSqlite();
        sqlite.prepare(`UPDATE sessions SET status = 'CLOSED', disconnected_at = ? WHERE token = ? OR id = ?`).run(session.disconnectedAt, tokenOrId, tokenOrId);
      }
      return session;
    }

    const sqlite = this.dbService.getRawSqlite();
    const row = sqlite.prepare(`SELECT * FROM sessions WHERE token = ? OR id = ? LIMIT 1`).get(tokenOrId, tokenOrId) as any;
    if (!row) return null;

    const session: PairingSession = {
      id: row.id,
      token: row.token,
      appId: row.app_id,
      pairingUrl: `goat://pair?server=http://${this.host}:${this.serverPort}&token=${row.token}`,
      qrTerminal: '',
      qrDataUrl: '',
      qrSvg: '',
      deviceName: row.device_name,
      platform: row.platform,
      osVersion: row.os_version,
      ipAddress: row.ip_address,
      connectedAt: row.connected_at,
      disconnectedAt: row.disconnected_at || undefined,
      status: row.status as any,
      deviceInfo: row.device_info ? JSON.parse(row.device_info) : undefined,
    };

    const SESSION_TTL_MS = PairingSessionManagerService.SESSION_TTL_MS;
    if (session.status !== 'CLOSED' && session.connectedAt && Date.now() - session.connectedAt > SESSION_TTL_MS) {
      session.status = 'CLOSED';
      session.disconnectedAt = Date.now();
      sqlite.prepare(`UPDATE sessions SET status = 'CLOSED', disconnected_at = ? WHERE token = ? OR id = ?`).run(session.disconnectedAt, tokenOrId, tokenOrId);
    }

    this.inMemoryCache.set(row.token, session);
    return session;
  }

  public listSessions(statusFilter?: 'PENDING' | 'ACTIVE' | 'CLOSED'): PairingSession[] {
    const sqlite = this.dbService.getRawSqlite();
    let rows: any[];
    if (statusFilter) {
      rows = sqlite.prepare(`SELECT * FROM sessions WHERE status = ? ORDER BY connected_at DESC`).all(statusFilter);
    } else {
      rows = sqlite.prepare(`SELECT * FROM sessions ORDER BY connected_at DESC`).all();
    }

    return rows.map((row) => ({
      id: row.id,
      token: row.token,
      appId: row.app_id,
      pairingUrl: `goat://pair?server=http://${this.host}:${this.serverPort}&token=${row.token}`,
      qrTerminal: '',
      qrDataUrl: '',
      qrSvg: '',
      deviceName: row.device_name,
      platform: row.platform,
      osVersion: row.os_version,
      ipAddress: row.ip_address,
      connectedAt: row.connected_at,
      disconnectedAt: row.disconnected_at || undefined,
      status: row.status as any,
      deviceInfo: row.device_info ? JSON.parse(row.device_info) : undefined,
    }));
  }

  public closeSession(tokenOrId: string): boolean {
    const session = this.getSession(tokenOrId);
    if (!session) return false;

    session.status = 'CLOSED';
    session.disconnectedAt = Date.now();

    const sqlite = this.dbService.getRawSqlite();
    sqlite.prepare(`
      UPDATE sessions
      SET status = 'CLOSED', disconnected_at = ?
      WHERE token = ? OR id = ?
    `).run(session.disconnectedAt, tokenOrId, tokenOrId);

    this.emit('sessionClosed', session);
    return true;
  }
}
