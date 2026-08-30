import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { TracesService } from '../traces/traces.service';
import { CDPTargetManagerService } from './cdp-target-manager.service';
import { CDPMessage, GoatBridgeMessageSentEvent, GoatBridgeMessageReceivedEvent } from './cdp.types';

export class CDPRelayGateway {
  private wss: WebSocketServer;
  private debuggers: Map<string, Set<WebSocket>> = new Map();
  private targets: Map<string, Set<WebSocket>> = new Map();
  private traceListeners: Set<WebSocket> = new Set();

  constructor(
    private server: Server,
    private tracesService: TracesService,
    private targetManager: CDPTargetManagerService
  ) {
    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on('error', () => {
      // Catch WebSocket server level errors safely
    });
    this.setupUpgradeHandler();
    this.setupTraceSubscription();
  }

  private setupTraceSubscription(): void {
    this.tracesService.on('trace', (trace) => {
      const payload = JSON.stringify({
        type: 'TRACE_INGESTED',
        trace,
      });

      // Broadcast to global trace WS listeners
      for (const client of this.traceListeners) {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(payload);
          } catch {
            // Ignore send failures on closing sockets
          }
        }
      }

      // Also emit as GoatBridge.messageSent / messageReceived to debuggers
      const eventMsg = JSON.stringify({
        method: trace.direction === 'RES' || trace.response || trace.error ? 'GoatBridge.messageReceived' : 'GoatBridge.messageSent',
        params: {
          callId: trace.callId,
          appId: trace.appId,
          action: trace.action,
          payload: trace.payload || trace.params,
          params: trace.params || trace.payload,
          result: trace.response,
          response: trace.response,
          error: trace.error || trace.errorMessage,
          status: trace.status === 'ERROR' ? 'error' : 'success',
          durationMs: trace.durationMs,
          timestamp: trace.timestamp,
          threadLane: trace.threadLane,
          seqId: trace.seqId,
          batchId: trace.batchId,
          workerIpcLatencyMs: trace.workerIpcLatencyMs,
          nativeExecutionLatencyMs: trace.nativeExecutionLatencyMs,
          domRenderLatencyMs: trace.domRenderLatencyMs,
          parentCallId: trace.parentCallId,
        },
      });

      for (const set of this.debuggers.values()) {
        for (const debuggerWs of set) {
          if (debuggerWs.readyState === WebSocket.OPEN) {
            try {
              debuggerWs.send(eventMsg);
            } catch {
              // Ignore send failures on closing sockets
            }
          }
        }
      }
    });
  }

  private setupUpgradeHandler(): void {
    this.server.on('upgrade', (request: IncomingMessage, socket, head) => {
      socket.on('error', () => {
        // Absorb raw socket errors safely during upgrade
      });
      const url = request.url || '';

      if (
        url.startsWith('/devtools/page/') ||
        url.startsWith('/devtools/browser/') ||
        url.startsWith('/devtools/target/') ||
        url.startsWith('/webkit/page/') ||
        url.startsWith('/traces') ||
        url.startsWith('/api/traces/ws')
      ) {
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

  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    // Attach error listener immediately to prevent unhandled 'error' events on malformed frames
    ws.on('error', () => {
      // Safe error absorption for broken/malformed frames or connection resets
    });

    const url = request.url || '';

    // Handle trace stream subscription (/traces or /api/traces/ws)
    if (url.startsWith('/traces') || url.startsWith('/api/traces/ws')) {
      this.traceListeners.add(ws);
      ws.on('close', () => this.traceListeners.delete(ws));
      ws.on('error', () => this.traceListeners.delete(ws));
      try {
        ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Trace stream connected' }));
      } catch {
        // Ignore send errors
      }
      return;
    }

    const isTarget = url.startsWith('/devtools/target/');
    const isSafari = url.startsWith('/webkit/page/');
    const pathParts = url.split('/');
    const targetId = pathParts[pathParts.length - 1] || 'root-relay-instance';

    if (isTarget) {
      this.registerTarget(targetId, ws);
    } else {
      this.registerDebugger(targetId, ws);
    }
  }

  private registerDebugger(targetId: string, ws: WebSocket): void {
    if (!this.debuggers.has(targetId)) {
      this.debuggers.set(targetId, new Set());
    }
    this.debuggers.get(targetId)!.add(ws);

    // If target doesn't exist, register target in manager
    if (!this.targetManager.getTarget(targetId)) {
      this.targetManager.createTarget({ id: targetId });
    }

    ws.on('message', (raw: Buffer | string) => {
      this.handleDebuggerMessage(targetId, ws, raw.toString());
    });

    ws.on('close', () => {
      this.debuggers.get(targetId)?.delete(ws);
    });

    ws.on('error', () => {
      this.debuggers.get(targetId)?.delete(ws);
    });
  }

  private registerTarget(targetId: string, ws: WebSocket): void {
    if (!this.targets.has(targetId)) {
      this.targets.set(targetId, new Set());
    }
    this.targets.get(targetId)!.add(ws);

    const targetInfo = this.targetManager.getTarget(targetId);
    if (targetInfo) {
      targetInfo.connected = true;
    }

    ws.on('message', (raw: Buffer | string) => {
      this.handleTargetMessage(targetId, ws, raw.toString());
    });

    const cleanupTarget = () => {
      this.targets.get(targetId)?.delete(ws);
      const remaining = this.targets.get(targetId)?.size || 0;
      if (remaining === 0 && targetInfo) {
        targetInfo.connected = false;
      }
    };

    ws.on('close', cleanupTarget);
    ws.on('error', cleanupTarget);
  }

  private handleDebuggerMessage(targetId: string, debuggerWs: WebSocket, messageStr: string): void {
    try {
      const msg = JSON.parse(messageStr) as CDPMessage;

      // Handle custom GoatBridge domain methods
      if (msg.method?.startsWith('GoatBridge.')) {
        this.handleGoatBridgeCommand(msg, debuggerWs, targetId);
        return;
      }

      // Check if target client is connected
      const targetSockets = this.targets.get(targetId);
      if (targetSockets && targetSockets.size > 0) {
        for (const targetWs of targetSockets) {
          if (targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(messageStr);
          }
        }
      } else {
        // Synthesize standard responses for common enabling domains
        if (msg.id !== undefined) {
          if (
            msg.method?.endsWith('.enable') ||
            msg.method === 'Page.setLifecycleEventsEnabled' ||
            msg.method === 'Runtime.runIfWaitingForDebugger'
          ) {
            debuggerWs.send(JSON.stringify({ id: msg.id, result: {} }));
          } else {
            debuggerWs.send(
              JSON.stringify({
                id: msg.id,
                result: {},
              })
            );
          }
        }
      }
    } catch (err: any) {
      debuggerWs.send(
        JSON.stringify({
          error: { code: -32700, message: `Parse error: ${err.message}` },
        })
      );
    }
  }

  private handleTargetMessage(targetId: string, targetWs: WebSocket, messageStr: string): void {
    try {
      const msg = JSON.parse(messageStr);

      // Handle GoatBridge events from target
      if (msg.method === 'GoatBridge.messageSent') {
        const params = msg.params || {};
        const action = params.action;
        const callId = params.callId || `call_${Date.now()}`;
        const appId = params.appId || 'com.goat.app';

        // Check if mock rule applies
        const mock = this.tracesService.matchMock(action, appId);
        if (mock) {
          const delay = mock.delayMs || 0;
          setTimeout(() => {
            const isErr = mock.shouldFail;
            const resObj = mock.response || mock.responsePayload || {};
            const errObj = isErr ? { message: mock.errorMessage || 'Mock simulated error' } : null;

            // Ingest trace
            this.tracesService.ingestTrace({
              callId,
              appId,
              action,
              direction: 'RES',
              params: params.payload || params.params,
              response: isErr ? undefined : resObj,
              error: errObj || undefined,
              status: isErr ? 'ERROR' : 'SUCCESS',
              durationMs: delay,
              timestamp: Date.now(),
            });

            // Send back to target
            if (targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(
                JSON.stringify({
                  method: 'GoatBridge.mockReply',
                  params: {
                    callId,
                    action,
                    status: isErr ? 'error' : 'success',
                    result: isErr ? undefined : resObj,
                    error: errObj,
                  },
                })
              );
            }
          }, delay);
        } else {
          // Record ongoing trace
          this.tracesService.ingestTrace({
            callId,
            appId,
            action,
            direction: 'REQ',
            params: params.payload || params.params,
            status: 'PENDING',
            timestamp: params.timestamp || Date.now(),
          });
        }
      } else if (msg.method === 'GoatBridge.messageReceived') {
        const params = msg.params || {};
        this.tracesService.ingestTrace({
          callId: params.callId || `call_${Date.now()}`,
          appId: params.appId || 'com.goat.app',
          action: params.action || 'UNKNOWN',
          direction: 'RES',
          response: params.result || params.response,
          error: params.error ? (typeof params.error === 'string' ? { message: params.error } : params.error) : undefined,
          status: params.status === 'error' || params.error ? 'ERROR' : 'SUCCESS',
          durationMs: params.durationMs || 0,
          timestamp: params.timestamp || Date.now(),
        });
      }

      // Forward target message to connected debuggers
      const debuggers = this.debuggers.get(targetId);
      if (debuggers) {
        for (const debuggerWs of debuggers) {
          if (debuggerWs.readyState === WebSocket.OPEN) {
            debuggerWs.send(messageStr);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  private handleGoatBridgeCommand(msg: CDPMessage, debuggerWs: WebSocket, targetId: string): void {
    const method = msg.method!;
    const params = msg.params || {};
    const id = msg.id;

    if (method === 'GoatBridge.setMockResponse') {
      const rule = this.tracesService.setMock({
        appId: params.appId || '*',
        action: params.action,
        response: params.mockResult || params.response || {},
        responsePayload: params.mockResult || params.response || {},
        delayMs: params.delayMs || 0,
        shouldFail: params.shouldFail || false,
        errorMessage: params.errorMessage,
        enabled: true,
      });

      if (id !== undefined) {
        debuggerWs.send(JSON.stringify({ id, result: { success: true, rule } }));
      }
      return;
    }

    if (method === 'GoatBridge.clearMocks') {
      if (params.action) {
        this.tracesService.deleteMock(params.action, params.appId);
      } else {
        const mocks = this.tracesService.getMocks(params.appId);
        for (const m of mocks) {
          this.tracesService.deleteMock(m.action, m.appId);
        }
      }
      if (id !== undefined) {
        debuggerWs.send(JSON.stringify({ id, result: { success: true } }));
      }
      return;
    }

    if (method === 'GoatBridge.getTraces') {
      const result = this.tracesService.getTraces({
        appId: params.appId,
        action: params.action,
        limit: params.limit,
        offset: params.offset,
      });
      if (id !== undefined) {
        debuggerWs.send(JSON.stringify({ id, result }));
      }
      return;
    }

    if (method === 'GoatBridge.injectEvent') {
      const targetSockets = this.targets.get(targetId);
      if (targetSockets) {
        const eventStr = JSON.stringify({
          method: 'GoatBridge.eventInjected',
          params: {
            event: params.event,
            data: params.data,
          },
        });
        for (const targetWs of targetSockets) {
          if (targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(eventStr);
          }
        }
      }
      if (id !== undefined) {
        debuggerWs.send(JSON.stringify({ id, result: { success: true } }));
      }
      return;
    }

    if (method === 'GoatBridge.getStats') {
      const stats = this.tracesService.getStats({ appId: params.appId });
      if (id !== undefined) {
        debuggerWs.send(JSON.stringify({ id, result: stats }));
      }
      return;
    }

    // Default fallback
    if (id !== undefined) {
      debuggerWs.send(JSON.stringify({ id, result: { success: true } }));
    }
  }

  public getConnectedDebuggerCount(): number {
    let count = 0;
    for (const s of this.debuggers.values()) {
      count += s.size;
    }
    return count;
  }

  public getConnectedTargetCount(): number {
    let count = 0;
    for (const s of this.targets.values()) {
      count += s.size;
    }
    return count;
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
