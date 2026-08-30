/**
 * @goat/bridge-mock - Public API Entrypoint
 * Zero-dependency hermetic browser simulation engine for Goat WebView Mini-Apps.
 */

import { GoatBridgeMock, GoatBridgeMockOptions } from './runtime.js';
import { mockState } from './state/store.js';
import { eventBus } from './transport/event-bus.js';
import { traceClient } from './transport/websocket-client.js';
import {
  biometricModal,
  scannerModal,
  permissionModal,
  externalLinkModal,
} from './ui/index.js';

export * from './types.js';
export * from './errors.js';
export * from './state/types.js';
export * from './state/store.js';
export * from './transport/event-bus.js';
export * from './transport/websocket-client.js';
export * from './transport/worker-transport.js';
export * from './ui/index.js';
export * from './handlers/index.js';
export * from './runtime.js';

export {
  GoatBridgeMock,
  mockState,
  eventBus,
  traceClient,
  biometricModal,
  scannerModal,
  permissionModal,
  externalLinkModal,
};

/**
 * Installs GoatBridgeMock into a browser window context or global scope
 */
export function installGoatBridgeMock(
  targetWindow?: any,
  options: GoatBridgeMockOptions = {}
): GoatBridgeMock {
  const win = targetWindow || (typeof window !== 'undefined' ? window : (globalThis as any));
  const bridgeMock = new GoatBridgeMock(options);

  if (win) {
    // 1. Direct GoatBridge SDK injection
    win.GoatBridge = bridgeMock;

    // 2. iOS WebKit messageHandler parity
    if (!win.webkit) {
      win.webkit = {};
    }
    if (!win.webkit.messageHandlers) {
      win.webkit.messageHandlers = {};
    }
    win.webkit.messageHandlers.goatBridge = {
      postMessage: (body: any) => bridgeMock.postMessage(body),
    };
    win.webkit.messageHandlers.nativeBridge = {
      postMessage: (body: any) => bridgeMock.postMessage(body),
    };

    // 3. Android WebViewCompat listener parity
    win.nativeBridge = {
      postMessage: (body: any) => bridgeMock.postMessage(body),
    };

    // 4. Dispatch readiness event
    try {
      if (typeof CustomEvent !== 'undefined') {
        const readyEvent = new CustomEvent('goatBridgeReady', { detail: { mock: true, version: '1.4.0' } });
        if (win.dispatchEvent) win.dispatchEvent(readyEvent);
        if (typeof document !== 'undefined' && document.dispatchEvent) document.dispatchEvent(readyEvent);
      }
    } catch {}
  }

  return bridgeMock;
}

// Auto-install if running directly in a browser environment without a module bundler
if (typeof window !== 'undefined' && !(window as any).__GOAT_DISABLE_AUTO_MOCK__) {
  installGoatBridgeMock(window);
}
