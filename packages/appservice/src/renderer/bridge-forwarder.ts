import { IpcChannel } from '../ipc/channel.js';
import { BridgeCallPayload, BridgeReplyPayload } from '../types.js';

export class AppViewBridgeForwarder {
  private readonly ipc: IpcChannel;
  private readonly hostDispatcher?: any;
  private unsubscribeIpc?: () => void;
  private windowResponseHandler?: (event: any) => void;

  constructor(ipc: IpcChannel, hostDispatcher?: any) {
    this.ipc = ipc;
    this.hostDispatcher = hostDispatcher;
    this.initListeners();
  }

  private initListeners(): void {
    // Listen for BRIDGE_CALL frames from AppService Worker
    this.unsubscribeIpc = this.ipc.on('BRIDGE_CALL', async (frame) => {
      const call = frame.payload as BridgeCallPayload;
      await this.forwardCall(call);
    });

    // Listen for native responses if in browser environment
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      this.windowResponseHandler = (event: any) => {
        const detail = event.detail;
        if (detail && detail.id) {
          this.sendReply({
            callId: detail.id,
            action: detail.action || 'unknown',
            success: detail.success ?? true,
            data: detail.data,
            error: detail.error ? { code: 'NATIVE_ERROR', message: String(detail.error) } : undefined,
            durationMs: 0,
          });
        }
      };
      window.addEventListener('goatBridgeResponse', this.windowResponseHandler);
    }
  }

  public async forwardCall(call: BridgeCallPayload): Promise<void> {
    const startTime = Date.now();

    // 1. Direct host dispatcher (hermetic simulator or test harness)
    if (this.hostDispatcher && typeof this.hostDispatcher.dispatch === 'function') {
      try {
        const reply = await this.hostDispatcher.dispatch(call);
        this.sendReply(reply);
      } catch (err: any) {
        this.sendReply({
          callId: call.callId,
          action: call.action,
          success: false,
          error: { code: 'HOST_DISPATCH_ERROR', message: err.message },
          durationMs: Date.now() - startTime,
        });
      }
      return;
    }

    // 2. Android / Standard addWebMessageListener interface
    if (typeof window !== 'undefined' && (window as any).nativeBridge) {
      try {
        const messageStr = JSON.stringify({
          id: call.callId,
          action: call.action,
          payload: call.payload,
        });
        (window as any).nativeBridge.postMessage(messageStr);
      } catch (err: any) {
        this.sendReply({
          callId: call.callId,
          action: call.action,
          success: false,
          error: { code: 'FORWARD_ERROR', message: err.message },
          durationMs: Date.now() - startTime,
        });
      }
      return;
    }

    // 3. iOS WebKit messageHandlers interface
    if (
      typeof window !== 'undefined' &&
      (window as any).webkit?.messageHandlers?.goatBridge
    ) {
      try {
        (window as any).webkit.messageHandlers.goatBridge.postMessage({
          id: call.callId,
          action: call.action,
          payload: call.payload,
        });
      } catch (err: any) {
        this.sendReply({
          callId: call.callId,
          action: call.action,
          success: false,
          error: { code: 'IOS_FORWARD_ERROR', message: err.message },
          durationMs: Date.now() - startTime,
        });
      }
      return;
    }

    // 4. Default fallback: mock success for common actions or error
    this.sendReply({
      callId: call.callId,
      action: call.action,
      success: true,
      data: { mockForwarded: true, action: call.action, payload: call.payload },
      durationMs: Date.now() - startTime,
    });
  }

  private sendReply(reply: BridgeReplyPayload): void {
    this.ipc.sendImmediate('BRIDGE_REPLY', reply);
  }

  public dispose(): void {
    if (this.unsubscribeIpc) {
      this.unsubscribeIpc();
    }
    if (
      this.windowResponseHandler &&
      typeof window !== 'undefined' &&
      typeof window.removeEventListener === 'function'
    ) {
      window.removeEventListener('goatBridgeResponse', this.windowResponseHandler);
    }
  }
}
