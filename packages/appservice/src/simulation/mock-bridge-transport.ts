import { BridgeCallPayload, BridgeReplyPayload } from '../types.js';

export class MockBridgeTransport {
  public memoryStorage = new Map<string, unknown>();
  public dispatchedActions: string[] = [];
  public delayMs: number = 0;
  public errorInjectionAction?: string;

  public async dispatch(call: BridgeCallPayload): Promise<BridgeReplyPayload> {
    const startTime = Date.now();
    this.dispatchedActions.push(call.action);

    if (this.delayMs > 0) {
      await new Promise((r) => setTimeout(r, this.delayMs));
    }

    if (this.errorInjectionAction === call.action) {
      return {
        callId: call.callId,
        action: call.action,
        success: false,
        error: { code: 'HOST_ERROR_INJECTED', message: `Simulated host error for ${call.action}` },
        durationMs: Date.now() - startTime,
      };
    }

    const { action, payload, callId } = call;

    // Storage Domain
    if (action === 'storage.set' || action === 'setStorage') {
      this.memoryStorage.set(String(payload.key), payload.value);
      return { callId, action, success: true, data: { success: true }, durationMs: Date.now() - startTime };
    }
    if (action === 'storage.get' || action === 'getStorage') {
      const value = this.memoryStorage.get(String(payload.key));
      return { callId, action, success: true, data: { value }, durationMs: Date.now() - startTime };
    }
    if (action === 'storage.remove' || action === 'removeStorage') {
      this.memoryStorage.delete(String(payload.key));
      return { callId, action, success: true, data: { success: true }, durationMs: Date.now() - startTime };
    }

    // Location Domain
    if (action === 'location.getCurrent' || action === 'getLocation') {
      return {
        callId,
        action,
        success: true,
        data: { latitude: 37.7749, longitude: -122.4194, accuracy: 5.0 },
        durationMs: Date.now() - startTime,
      };
    }

    // Network Domain
    if (action === 'network.request' || action === 'request') {
      return {
        callId,
        action,
        success: true,
        data: { status: 200, data: { message: 'Mock HTTP response', url: payload.url } },
        durationMs: Date.now() - startTime,
      };
    }

    // UI & Navigation Domain
    if (action === 'navigation.navigateTo' || action === 'navigateTo') {
      return {
        callId,
        action,
        success: true,
        data: { navigatedTo: payload.url || payload.path },
        durationMs: Date.now() - startTime,
      };
    }
    if (action === 'ui.showToast' || action === 'showToast') {
      return { callId, action, success: true, data: { shown: true }, durationMs: Date.now() - startTime };
    }

    // Default Fallback
    return {
      callId,
      action,
      success: true,
      data: { mockExecuted: true, action, payload },
      durationMs: Date.now() - startTime,
    };
  }

  public clear(): void {
    this.memoryStorage.clear();
    this.dispatchedActions = [];
    this.delayMs = 0;
    this.errorInjectionAction = undefined;
  }
}
