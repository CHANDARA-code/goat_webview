import { GoatBridgeClient } from '../bridge/proxy.js';
import { MiniAppLifecycleFSM } from '../lifecycle/fsm.js';
import { h } from '../vdom/h.js';
import { VNode } from '../types.js';
import { SandboxGlobalScope } from './types.js';

export class ScriptEvaluator {
  private readonly appId: string;
  private readonly bridge: GoatBridgeClient;
  private readonly lifecycle: MiniAppLifecycleFSM;
  private readonly pageRegistry = new Map<string, Record<string, unknown>>();
  private appConfig: Record<string, unknown> | null = null;
  private workerData: Record<string, unknown> = {};
  private onSetDataCallback?: (data: Record<string, unknown>, renderFn?: (data: Record<string, unknown>) => VNode) => void;

  constructor(
    appId: string,
    bridge: GoatBridgeClient,
    lifecycle: MiniAppLifecycleFSM,
    onSetDataCallback?: (data: Record<string, unknown>, renderFn?: (data: Record<string, unknown>) => VNode) => void
  ) {
    this.appId = appId;
    this.bridge = bridge;
    this.lifecycle = lifecycle;
    this.onSetDataCallback = onSetDataCallback;
  }

  public setWorkerData(data: Record<string, unknown>): void {
    this.workerData = { ...this.workerData, ...data };
  }

  public getWorkerData(): Record<string, unknown> {
    return { ...this.workerData };
  }

  public createSandboxScope(): SandboxGlobalScope {
    const bridgeProxy = {
      call: <T = unknown>(action: string, payload: Record<string, unknown> = {}, timeoutMs?: number) =>
        this.bridge.call<T>(action, payload, timeoutMs),
      callNative: <T = unknown>(action: string, payload: Record<string, unknown> = {}, timeoutMs?: number) =>
        this.bridge.callNative<T>(action, payload, timeoutMs),
      on: (event: string, handler: (payload: unknown) => void) =>
        this.bridge.on(event, handler),
      emit: (event: string, payload: unknown) =>
        this.bridge.emit(event, payload),
      off: (event: string, handler: (payload: unknown) => void) =>
        this.bridge.off(event, handler),
    };

    return {
      appId: this.appId,
      GoatBridge: bridgeProxy,
      goatBridge: bridgeProxy,
      h,
      lifecycle: this.lifecycle,
      App: (config: Record<string, unknown>) => {
        this.appConfig = config;
      },
      Page: (config: Record<string, unknown>) => {
        const pageId = (config.id as string) || 'default_page';
        this.pageRegistry.set(pageId, config);
      },
      Component: (config: Record<string, unknown>) => {
        const componentId = (config.id as string) || `comp_${Date.now()}`;
        this.pageRegistry.set(componentId, config);
      },
      setData: (partialData: Record<string, unknown>, renderFn?: (data: Record<string, unknown>) => VNode) => {
        this.setWorkerData(partialData);
        if (this.onSetDataCallback) {
          this.onSetDataCallback(partialData, renderFn);
        }
      },
      getData: () => this.getWorkerData(),
      getApp: () => ({ appId: this.appId, state: this.lifecycle.getState() }),
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      setInterval: globalThis.setInterval.bind(globalThis),
      clearInterval: globalThis.clearInterval.bind(globalThis),
      console: globalThis.console,
    };
  }

  public evaluateScript(codeString: string): unknown {
    const scope = this.createSandboxScope();

    // Isolated Function constructor scrubbing globals with strict mode directive prologue at top
    const sandboxFn = new Function(
      'GoatBridge',
      'setData',
      'getData',
      'getApp',
      'h',
      'App',
      'Page',
      'Component',
      'console',
      'setTimeout',
      'clearTimeout',
      `"use strict";
      const window = undefined;
      const document = undefined;
      const HTMLElement = undefined;
      const localStorage = undefined;
      const indexedDB = undefined;
      ${codeString}
      `
    );

    return sandboxFn(
      scope.GoatBridge,
      scope.setData,
      scope.getData,
      scope.getApp,
      scope.h,
      scope.App,
      scope.Page,
      scope.Component,
      scope.console,
      scope.setTimeout,
      scope.clearTimeout
    );
  }

  public evaluateBundle(sourceCode: string): void {
    const scope = this.createSandboxScope();
    const paramNames = Object.keys(scope);
    const paramValues = Object.values(scope);

    const wrappedFn = new Function(
      ...paramNames,
      `"use strict";
      const window = undefined;
      const document = undefined;
      const HTMLElement = undefined;
      const localStorage = undefined;
      const indexedDB = undefined;
      ${sourceCode}
      `
    );

    wrappedFn(...paramValues);
  }

  public getPage(pageId: string = 'default_page'): Record<string, unknown> | undefined {
    return this.pageRegistry.get(pageId);
  }

  public getAppConfig(): Record<string, unknown> | null {
    return this.appConfig;
  }
}
