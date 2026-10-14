import { dslBootstrapScript } from '../bootstrap';
import { DSL_ACTION_MAP } from '../actionMap';

/**
 * WeChat entry point. Re-exports the shared bootstrap and action table under this DSL's global.
 *
 * Separate entry points exist so a host linking only one DSL does not ship the others' aliases;
 * the shared parts are identical by design, since the surfaces overlap almost entirely.
 */
export const GLOBAL_NAME = 'wx' as const;
export { dslBootstrapScript, DSL_ACTION_MAP };
export { CapabilityRegistry, CAPABILITY_NOT_INSTALLED } from '../capabilities';

function createDslBridge(): Record<string, any> {
  const bridge: Record<string, any> = {};
  for (const [method, action] of Object.entries(DSL_ACTION_MAP)) {
    bridge[method] = (options?: any) => {
      const opts = options || {};
      const payload: Record<string, any> = {};
      for (const k in opts) {
        if (k !== 'success' && k !== 'fail' && k !== 'complete') payload[k] = opts[k];
      }
      const win = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? (globalThis as any) : undefined);
      if (win && win.nativeBridge && typeof win.nativeBridge.postMessage === 'function') {
        return new Promise((resolve, reject) => {
          const id = 'dsl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
          win.__goatDslPending = win.__goatDslPending || {};
          win.__goatDslPending[id] = { resolve, reject };
          win.nativeBridge.postMessage(JSON.stringify({ id, action, payload }));
        });
      }
      return Promise.reject(new Error(`CAPABILITY_NOT_INSTALLED: native bridge unavailable for ${action}`));
    };
  }
  bridge.canIUse = (schema: string) => {
    const key = String(schema || '').split('.')[0] ?? '';
    return Object.prototype.hasOwnProperty.call(DSL_ACTION_MAP, key);
  };
  return bridge;
}

export const wx: any = (typeof globalThis !== 'undefined' && (globalThis as any).wx)
  ? (globalThis as any).wx
  : createDslBridge();

if (typeof globalThis !== 'undefined') {
  (globalThis as any).wx = (globalThis as any).wx || wx;
}

export default wx;
