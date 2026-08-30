import { GoatBridgeClient } from '../bridge/proxy.js';
import { MiniAppLifecycleFSM } from '../lifecycle/fsm.js';
import { h } from '../vdom/h.js';
import { VNode } from '../types.js';

export interface SandboxGoatBridgeProxy {
  call: <T = unknown>(action: string, payload?: Record<string, unknown>, timeoutMs?: number) => Promise<T>;
  callNative: <T = unknown>(action: string, payload?: Record<string, unknown>, timeoutMs?: number) => Promise<T>;
  on: (event: string, handler: (payload: unknown) => void) => () => void;
  emit: (event: string, payload: unknown) => void;
  off: (event: string, handler: (payload: unknown) => void) => void;
}

export interface SandboxGlobalScope {
  appId: string;
  GoatBridge: SandboxGoatBridgeProxy;
  goatBridge: SandboxGoatBridgeProxy;
  h: typeof h;
  lifecycle: MiniAppLifecycleFSM;
  Page: (config: Record<string, unknown>) => void;
  Component: (config: Record<string, unknown>) => void;
  App: (config: Record<string, unknown>) => void;
  setData: (data: Record<string, unknown>, renderFn?: (data: Record<string, unknown>) => VNode) => void;
  getData: () => Record<string, unknown>;
  getApp: () => { appId: string; state: string };
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
  setInterval: typeof setInterval;
  clearInterval: typeof clearInterval;
  console: typeof console;
}

export interface UnhandledErrorDetails {
  message: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  timestamp: number;
}
