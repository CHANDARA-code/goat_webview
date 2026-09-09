const fs = require('fs');
const path = require('path');

const ktPath = path.join(__dirname, '../../../android/core/src/main/java/com/goat/webview/GoatBridgeActionHandler.kt');
const kt = fs.readFileSync(ktPath, 'utf8');
const match = kt.match(/val SUPPORTED_ACTIONS = setOf\(([\s\S]*?)\n        \)/);

const lines = match[1].split('\n').map((l) => l.trim()).filter(Boolean);
const domainList = [];
let currentDomain = null;

for (const line of lines) {
  if (line.startsWith('//')) {
    const domainName = line.replace(/^\/\/\s*(\d+\.\s*)?/, '').trim();
    currentDomain = { name: domainName, actions: [] };
    domainList.push(currentDomain);
  } else if (line.startsWith('"')) {
    const action = line.replace(/[",]/g, '').trim();
    if (currentDomain) {
      currentDomain.actions.push(action);
    }
  }
}

// 1. Build src/types/bridge.ts
let bridgeTs = '/**\n * @goat/devtools - Canonical GoatBridge TypeScript Definitions\n * Complete index of 203 canonical actions across 18 functional domains.\n */\n\n';
bridgeTs += 'export type GoatBridgeAction =\n';

domainList.forEach((d, idx) => {
  bridgeTs += '  // Domain ' + (idx + 1) + ': ' + d.name + ' (' + d.actions.length + ')\n';
  d.actions.forEach((a) => {
    bridgeTs += "  | '" + a + "'\n";
  });
  if (idx < domainList.length - 1) bridgeTs += '\n';
});
bridgeTs += ';\n\n';

bridgeTs += `export interface GoatBridgeActionMetadata {
  action: GoatBridgeAction;
  domain: string;
  description: string;
  payloadType?: string;
  returnType?: string;
  permissions?: string[];
  snippet?: string;
  signature?: string;
  deprecated?: boolean;
}

export type ActionPayloadMap = Record<string, any>;
export type ActionReturnMap = Record<string, any>;
`;

fs.writeFileSync(path.join(__dirname, '../src/types/bridge.ts'), bridgeTs, 'utf8');
console.log('Wrote src/types/bridge.ts');

// 2. Build ACTION_CATALOG for completionProvider.ts
let compTs = `/**
 * @goat/devtools - Monaco Editor GoatBridge Completion Provider
 * Autocompletions, parameter signatures, and documentation for 203 actions across 18 domains.
 */

import type { GoatBridgeActionMetadata } from '../../types/bridge.ts';

export const ACTION_CATALOG: GoatBridgeActionMetadata[] = [
`;

domainList.forEach((d, idx) => {
  compTs += '  // =========================================================================\n';
  compTs += '  // Domain ' + (idx + 1) + ': ' + d.name + ' (' + d.actions.length + ' Actions)\n';
  compTs += '  // =========================================================================\n';
  d.actions.forEach((a) => {
    let desc = 'Invokes native ' + a + ' capability';
    let perms = '[]';
    let sig = "invoke('" + a + "', payload?: any): Promise<any>";
    let snip = "GoatBridge.invoke('" + a + "', {\\n  $1\\n})";

    if (a === 'GET_DEVICE_INFO') {
      desc = 'Retrieves device model, OS, battery, screen density, SDK info';
      sig = "invoke('GET_DEVICE_INFO', payload?: {}): Promise<DeviceInfo>";
      snip = "GoatBridge.invoke('GET_DEVICE_INFO')";
    } else if (a === 'GET_LOCATION') {
      desc = 'Returns current GPS coordinates and elevation';
      perms = "['LOCATION']";
      sig = "invoke('GET_LOCATION', payload?: LocationOptions): Promise<LocationResult>";
      snip = "GoatBridge.invoke('GET_LOCATION', { highAccuracy: true })";
    } else if (a === 'HAPTIC_FEEDBACK') {
      desc = 'Triggers tactile vibration (light, medium, heavy, success, error)';
      perms = "['HAPTICS']";
      sig = "invoke('HAPTIC_FEEDBACK', payload: { type: 'light' | 'medium' | 'heavy' }): Promise<{ triggered: boolean }>";
      snip = "GoatBridge.invoke('HAPTIC_FEEDBACK', { type: 'medium' })";
    } else if (a === 'BIOMETRIC_AUTH') {
      desc = 'Prompts native Face ID / Fingerprint challenge';
      perms = "['BIOMETRIC']";
      sig = "invoke('BIOMETRIC_AUTH', payload?: { title: string }): Promise<BiometricAuthResult>";
      snip = "GoatBridge.invoke('BIOMETRIC_AUTH', { title: 'Authorize Transaction' })";
    } else if (a === 'SCAN_CODE') {
      desc = 'Opens camera scanner for QR Code / Barcode';
      perms = "['CAMERA']";
      sig = "invoke('SCAN_CODE', payload?: { scanType?: string[] }): Promise<ScanResult>";
      snip = "GoatBridge.invoke('SCAN_CODE')";
    }

    compTs += "  {\n    action: '" + a + "',\n    domain: '" + d.name + "',\n    description: '" + desc + "',\n    permissions: " + perms + ",\n    signature: '" + sig.replace(/'/g, "\\'") + "',\n    snippet: '" + snip.replace(/'/g, "\\'") + "',\n  },\n";
  });
});

compTs += `];

export function createMonacoCompletionItems(monaco: any): any[] {
  const kind = monaco?.languages?.CompletionItemKind?.Method ?? 0;
  const insertAsSnippet = monaco?.languages?.CompletionItemInsertTextRule?.InsertAsSnippet ?? 4;

  return ACTION_CATALOG.map((item) => ({
    label: item.action,
    kind,
    detail: 'GoatBridge [' + item.domain + ']',
    documentation: {
      value:
        '### ' + item.action + '\\n**Domain**: ' + item.domain + '\\n\\n' + item.description + '\\n\\n' +
        '\\\`\\\`\\\`typescript\\n' + item.signature + '\\n\\\`\\\`\\\`\\n' +
        (item.permissions?.length ? '\\n**Required Permissions**: ' + item.permissions.join(', ') : ''),
    },
    insertText: item.snippet || "GoatBridge.invoke('" + item.action + "', {})",
    insertTextRules: insertAsSnippet,
  }));
}

export function registerGoatBridgeCompletionProvider(monaco: any): void {
  if (!monaco || !monaco.languages) return;

  const provider = {
    triggerCharacters: ['.', '"', "'"],
    provideCompletionItems: (model: any, position: any) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions = createMonacoCompletionItems(monaco).map((s) => ({
        ...s,
        range,
      }));

      return { suggestions };
    },
  };

  monaco.languages.registerCompletionItemProvider('typescript', provider);
  monaco.languages.registerCompletionItemProvider('javascript', provider);
}
`;

fs.writeFileSync(path.join(__dirname, '../src/services/monaco/completionProvider.ts'), compTs, 'utf8');
console.log('Wrote src/services/monaco/completionProvider.ts');

// 3. Build src/services/monaco/typings/goat-bridge.d.ts.raw.ts
let dtsRaw = `/**
 * @goat/devtools - Raw Ambient TypeScript Declaration for GoatBridge
 * Injected directly into Monaco Editor TypeScript Language Service.
 */

export const GOAT_BRIDGE_DTS = \`
/**
 * Canonical GoatBridge SDK Declaration
 * 203 High-Performance Native Bridge Actions across 18 Domains.
 */
declare namespace GoatBridge {
`;

domainList.forEach((d, idx) => {
  dtsRaw += '  // Domain ' + (idx + 1) + ': ' + d.name + ' (' + d.actions.length + ' Actions)\n';
  d.actions.forEach((a) => {
    dtsRaw += "  export function invoke(action: '" + a + "', payload?: any): Promise<any>;\n";
  });
});

dtsRaw += `
  export function invoke(action: string, payload?: any): Promise<any>;
  export function emit(event: string, data?: any): void;
  export function on(event: string, listener: (data: any) => void): () => void;
  export function off(event: string, listener?: (data: any) => void): void;
  export function canIUse(action: string): boolean;
}

declare class MiniAppBridge {
  static invoke(action: string, payload?: any): Promise<any>;
  static emit(event: string, data?: any): void;
  static on(event: string, listener: (data: any) => void): () => void;
  static off(event: string, listener?: (data: any) => void): void;
}

declare const bridge: typeof GoatBridge;
\`;
`;

fs.writeFileSync(path.join(__dirname, '../src/services/monaco/typings/goat-bridge.d.ts.raw.ts'), dtsRaw, 'utf8');
console.log('Wrote src/services/monaco/typings/goat-bridge.d.ts.raw.ts');

// 4. Build src/services/monacoBridgeTypings.ts
let mbTypings = `/**
 * monacoBridgeTypings.ts — Generates comprehensive TypeScript ambient declarations
 * for all 203 GoatBridge actions across 18 functional domains.
 */

import { configureMonaco } from './monaco/setup.ts';
import { ACTION_CATALOG } from './monaco/completionProvider.ts';

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

export function setupMonacoTypings(monaco: any): void {
  configureMonaco(monaco);
}
`;

fs.writeFileSync(path.join(__dirname, '../src/services/monacoBridgeTypings.ts'), mbTypings, 'utf8');
console.log('Wrote src/services/monacoBridgeTypings.ts');
