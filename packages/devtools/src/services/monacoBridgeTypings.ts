/**
 * monacoBridgeTypings.ts — Generates comprehensive TypeScript ambient declarations
 * for all 203 GoatBridge actions across 18 functional domains.
 */

import { configureMonaco } from './monaco/setup.ts';
import { ACTION_CATALOG } from './monaco/completionProvider.ts';
import { GOAT_BRIDGE_DTS } from './monaco/typings/goatBridgeRawDts.ts';

export interface BridgeActionDefinition {
  action: string;
  domain: string;
  description: string;
  payloadType?: string;
  responseType?: string;
  permission?: string;
  isAsync?: boolean;
}

export const GOAT_BRIDGE_ACTIONS_CATALOG: BridgeActionDefinition[] = ACTION_CATALOG.map((a) => ({
  action: a.action,
  domain: a.domain,
  description: a.description,
  permission: a.permissions?.[0],
  isAsync: true,
}));

export function generateMonacoBridgeDeclarations(): string {
  let dts = `/**
 * Canonical GoatBridge SDK Declaration
 * 203 High-Performance Native Bridge Actions across 18 Domains.
 */

export interface GoatBridgeInterface {
  call<T = any>(action: string, payload?: any): Promise<T>;
  callNative<T = any>(action: string, payload?: any): Promise<T>;
  onEvent(event: string, handler: (data: any) => void): () => void;
  emitEvent(event: string, data: any): void;
}

declare namespace GoatBridge {
  function call<T = any>(action: string, payload?: any): Promise<T>;
  function callNative<T = any>(action: string, payload?: any): Promise<T>;
  function onEvent(event: string, handler: (data: any) => void): () => void;
  function emitEvent(event: string, data: any): void;
}

declare class MiniAppBridge implements GoatBridgeInterface {
  call<T = any>(action: string, payload?: any): Promise<T>;
  callNative<T = any>(action: string, payload?: any): Promise<T>;
  onEvent(event: string, handler: (data: any) => void): () => void;
  emitEvent(event: string, data: any): void;
}

declare const bridge: MiniAppBridge;
declare const GoatBridge: GoatBridgeInterface;

${GOAT_BRIDGE_DTS}
`;
  return dts;
}

export function setupMonacoTypings(monaco: any): void {
  configureMonaco(monaco);
}
