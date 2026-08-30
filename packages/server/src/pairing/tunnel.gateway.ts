import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { PairingSessionManagerService } from './pairing-session-manager.service';

export interface TunnelMessage {
  type: 'HMR_UPDATE' | 'BUNDLE_STREAM' | 'RELOAD' | 'DEV_MENU' | 'PING' | 'PONG' | 'LOG' | 'JOIN' | 'ACK';
  token?: string;
  role?: 'publisher' | 'subscriber';
  data?: any;
  chunk?: string | number[];
  chunkIndex?: number;
  totalChunks?: number;
  timestamp?: number;
}

export class TunnelGateway {
  private wss: WebSocketServer;
  private sessions: Map<string, Set<WebSocket>> = new Map();
  private publishers: Map<string, WebSocket> = new Map();

  constructor(
    private server: Server,
    private pairingManager: PairingSessionManagerService
  ) {
    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on('error', () => {
      // Catch WebSocket server level errors safely
    });
    this.setupUpgradeHandler();
  }

  private setupUpgradeHandler(): void {
    this.server.on('upgrade', (request: IncomingMessage, socket, head) => {
      socket.on('error', () => {
        // Absorb raw socket errors safely during upgrade
      });
      const url = request.url || '';

      if (url.startsWith('/tunnel/') || url.startsWith('/api/tunnel/')) {
        const token = this.extractToken(url);
        const session = this.pairingManager.getSession(token);
        if (!session) {
          this.rejectUpgrade(socket, 401);
          return;
        }
        if (session.status !== 'ACTIVE') {
          this.rejectUpgrade(socket, 403);
          return;
        }
        try {
          this.wss.handleUpgrade(request, socket, head, (ws) => {
            this.handleConnection(ws, request);
          });
        } catch {
          socket.destroy();
        }
      }
    });
  }

  private extractToken(url: string): string {
    const queryIndex = url.indexOf('?');
    const pathOnly = queryIndex === -1 ? url : url.substring(0, queryIndex);
    const query = queryIndex === -1 ? '' : url.substring(queryIndex + 1);
    const queryMatch = /(?:^|&)token=([^&]+)/.exec(query);
    if (queryMatch) {
      try {
        return decodeURIComponent(queryMatch[1]);
      } catch {
        return queryMatch[1];
      }
    }
    const parts = pathOnly.split('/');
    return parts[parts.length - 1] || 'default';
  }

  private rejectUpgrade(socket: import('stream').Duplex, statusCode: number): void {
    const reason = statusCode === 401 ? 'Unauthorized' : 'Forbidden';
    try {
      socket.write(
        `HTTP/1.1 ${statusCode} ${reason}\r\n` +
          'Connection: close\r\n' +
          'Content-Length: 0\r\n\r\n'
      );
    } catch {
      // Ignore write errors on already closing sockets
    }
    socket.destroy();
  }

  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    // Attach error listener immediately to prevent unhandled 'error' crashes
    const url = request.url || '';
    const token = this.extractToken(url);

    const cleanup = () => {
      this.sessions.get(token)?.delete(ws);
      if (this.publishers.get(token) === ws) {
        this.publishers.delete(token);
      }
    };

    ws.on('error', cleanup);
    ws.on('close', cleanup);

    if (!this.sessions.has(token)) {
      this.sessions.set(token, new Set());
    }
    this.sessions.get(token)!.add(ws);

    ws.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString()) as TunnelMessage;
        this.handleMessage(token, ws, msg);
      } catch {
        // Broadcast raw message to peers in same token tunnel
        this.broadcastToSession(token, ws, raw.toString());
      }
    });

    // Send connection ack
    try {
      ws.send(
        JSON.stringify({
          type: 'ACK',
          token,
          status: 'CONNECTED',
          timestamp: Date.now(),
        })
      );
    } catch {
      // Ignore send errors
    }
  }

  private handleMessage(token: string, senderWs: WebSocket, msg: TunnelMessage): void {
    if (msg.type === 'JOIN') {
      if (msg.role === 'publisher') {
        this.publishers.set(token, senderWs);
      }
      try {
        senderWs.send(JSON.stringify({ type: 'ACK', status: 'JOINED', role: msg.role || 'subscriber' }));
      } catch {
        // Ignore send errors
      }
      return;
    }

    if (msg.type === 'PING') {
      try {
        senderWs.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      } catch {
        // Ignore send errors
      }
      return;
    }

    // Forward message to all other connected sockets in this session
    this.broadcastToSession(token, senderWs, JSON.stringify(msg));
  }

  private broadcastToSession(token: string, senderWs: WebSocket, messageStr: string): void {
    const set = this.sessions.get(token);
    if (!set) return;

    for (const client of set) {
      if (client !== senderWs && client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
        } catch {
          // Ignore send errors on closing socket
        }
      }
    }
  }

  public broadcastToToken(token: string, message: TunnelMessage): void {
    const set = this.sessions.get(token);
    if (!set) return;

    const str = JSON.stringify(message);
    for (const client of set) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(str);
        } catch {
          // Ignore send errors on closing socket
        }
      }
    }
  }

  public getConnectedClientCount(token?: string): number {
    if (token) {
      return this.sessions.get(token)?.size || 0;
    }
    let total = 0;
    for (const s of this.sessions.values()) {
      total += s.size;
    }
    return total;
  }

  public close(): void {
    for (const client of this.wss.clients) {
      try {
        client.terminate();
      } catch {
        // ignore
      }
    }
    this.wss.close();
  }
}
