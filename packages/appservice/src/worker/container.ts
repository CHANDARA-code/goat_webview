import { IpcChannel } from '../ipc/channel.js';
import { GoatBridgeClient } from '../bridge/proxy.js';
import { MiniAppLifecycleFSM } from '../lifecycle/fsm.js';
import { ScriptEvaluator } from './evaluator.js';
import { WorkerErrorBoundary } from './error-boundary.js';
import { VDomEngine } from '../vdom/index.js';
import {
  IpcMessageFrame,
  UiEventPayload,
  BridgeReplyPayload,
  VNode,
  LifecycleState,
} from '../types.js';

export class AppServiceWorkerContainer {
  public readonly appId: string;
  public readonly ipc: IpcChannel;
  public readonly bridge: GoatBridgeClient;
  public readonly lifecycle: MiniAppLifecycleFSM;
  public readonly evaluator: ScriptEvaluator;
  public readonly errorBoundary: WorkerErrorBoundary;

  public currentVTree: VNode | null = null;
  private activePageInstance: Record<string, any> | null = null;
  private unsubscribeIpc?: () => void;

  constructor(appId: string, ipc: IpcChannel) {
    this.appId = appId;
    this.ipc = ipc;
    this.lifecycle = new MiniAppLifecycleFSM(appId, ipc);
    this.bridge = new GoatBridgeClient(appId, ipc);
    this.evaluator = new ScriptEvaluator(
      appId,
      this.bridge,
      this.lifecycle,
      (partialData, renderFn) => this.setData(partialData, renderFn)
    );
    this.errorBoundary = new WorkerErrorBoundary(this.lifecycle, ipc);

    this.registerIpcHandlers();
  }

  public get state(): LifecycleState {
    return this.lifecycle.getState();
  }

  public get data(): Record<string, unknown> {
    return this.evaluator.getWorkerData();
  }

  public set data(value: Record<string, unknown>) {
    this.evaluator.setWorkerData(value);
  }

  public get GoatBridge() {
    return {
      call: async (action: string, payload: Record<string, unknown> = {}, timeoutMs?: number) => {
        if (this.state === 'TERMINATED' || this.state === 'CRASHED') {
          throw new Error(`Cannot invoke GoatBridge.call in ${this.state} state`);
        }
        return this.bridge.call(action, payload, timeoutMs);
      },
      callNative: async (action: string, payload: Record<string, unknown> = {}, timeoutMs?: number) => {
        if (this.state === 'TERMINATED' || this.state === 'CRASHED') {
          throw new Error(`Cannot invoke GoatBridge.callNative in ${this.state} state`);
        }
        return this.bridge.callNative(action, payload, timeoutMs);
      },
    };
  }

  public get pendingCalls() {
    return (this.bridge.rpcTable as any).pendingMap;
  }

  private registerIpcHandlers(): void {
    this.unsubscribeIpc = this.ipc.onMessage((frame: IpcMessageFrame) => {
      switch (frame.type) {
        case 'BRIDGE_REPLY':
          this.bridge.handleReply(frame.payload as BridgeReplyPayload);
          break;
        case 'UI_EVENT':
          this.handleUiEvent(frame.payload as UiEventPayload);
          break;
        case 'LIFECYCLE':
          this.handleLifecycleCommand(frame.payload);
          break;
      }
    });
  }

  public launch(): void {
    if (this.state === 'UNINITIALIZED') {
      this.lifecycle.transition('INIT');
    }
    this.lifecycle.transition('LAUNCH_SUCCESS');
  }

  public suspend(): void {
    this.lifecycle.transition('SUSPEND');
  }

  public resume(): void {
    this.lifecycle.transition('RESUME');
  }

  public terminate(): void {
    this.lifecycle.transition('TERMINATE');
    this.bridge.dispose();
    this.errorBoundary.dispose();
  }

  public evaluateScript(codeString: string): unknown {
    if (this.state === 'TERMINATED' || this.state === 'CRASHED') {
      throw new Error(`Cannot execute script in ${this.state} state`);
    }

    try {
      return this.evaluator.evaluateScript(codeString);
    } catch (err: any) {
      this.errorBoundary.handleError({
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        timestamp: Date.now(),
      });
      throw err;
    }
  }

  public loadBundle(bundleCode: string): void {
    if (this.state === 'UNINITIALIZED') {
      this.lifecycle.transition('INIT');
    }

    try {
      this.evaluator.evaluateBundle(bundleCode);
      const appConfig = this.evaluator.getAppConfig();
      if (appConfig && typeof (appConfig as any).onLaunch === 'function') {
        (appConfig as any).onLaunch();
      }
      this.lifecycle.transition('LAUNCH_SUCCESS');
    } catch (err: any) {
      this.errorBoundary.handleError({
        message: `Bundle execution failed: ${err.message}`,
        stack: err.stack,
        timestamp: Date.now(),
      });
      throw err;
    }
  }

  public setData(
    partialData: Record<string, unknown>,
    renderTreeFn?: (data: Record<string, unknown>) => VNode
  ): void {
    this.evaluator.setWorkerData(partialData);

    if (this.state === 'SUSPENDED') {
      return;
    }

    if (renderTreeFn) {
      const newVTree = renderTreeFn(this.data);
      const patches = VDomEngine.diff(this.currentVTree, newVTree);
      this.currentVTree = newVTree;

      for (const patch of patches) {
        this.ipc.queueUiPatch(patch);
      }
    }
  }

  public handleUiEvent(payload: UiEventPayload): void {
    if (!this.activePageInstance) {
      const pageDef = this.evaluator.getPage();
      if (pageDef) {
        this.activePageInstance = { ...pageDef };
      }
    }

    if (this.activePageInstance) {
      const handlerName = payload.eventType;
      if (typeof this.activePageInstance[handlerName] === 'function') {
        try {
          this.activePageInstance[handlerName](payload);
        } catch (err: any) {
          this.errorBoundary.handleError({
            message: `Error in event handler '${handlerName}': ${err.message}`,
            stack: err.stack,
            timestamp: Date.now(),
          });
        }
      }
    }
  }

  private handleLifecycleCommand(payload: any): void {
    if (payload && payload.action) {
      if (payload.action === 'suspend' && this.lifecycle.canTransition('SUSPEND')) {
        this.suspend();
      } else if (payload.action === 'resume' && this.lifecycle.canTransition('RESUME')) {
        this.resume();
      } else if (payload.action === 'terminate' && this.lifecycle.canTransition('TERMINATE')) {
        this.terminate();
      }
    }
  }

  public destroy(): void {
    if (this.state !== 'TERMINATED') {
      try {
        this.terminate();
      } catch {
        // Ignore termination error on destruction
      }
    }
    if (this.unsubscribeIpc) {
      this.unsubscribeIpc();
    }
  }

  public dispose(): void {
    this.destroy();
  }
}

export const WorkerContainer = AppServiceWorkerContainer;
