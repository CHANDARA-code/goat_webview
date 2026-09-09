import type { GoatCapabilityPlugin } from 'react-native-goat-webview';
import { goatCapabilityRegistry, GoatWebViewNativeModule } from 'react-native-goat-webview';

/**
 * React Native scanner capability companion.
 *
 * Marshals its actions to the native engine via `GoatWebViewNativeModule.executeAction`. It holds
 * no capability logic of its own and never synthesises a result: before 2026-09-06 every action in
 * this package returned hardcoded data (and a `default:` branch returned `{ success: true }` for
 * ANY action), so a host got plausible-looking values while the engine was never called.
 */

/** Caller-facing name -> the action string the engine actually dispatches. */
const ENGINE_ACTION: Record<string, string> = {};

/** Declared here, but no engine action exists on either platform. Rejected, never faked. */
const UNBACKED: Record<string, string> = {
    'GENERATE_BARCODE': 'no engine action; SCAN_CODE reads codes, it does not generate them',
    'SCAN_DOCUMENTS': 'no engine action',
  };

/** Resolves to an action only Android dispatches. */
const ANDROID_ONLY = new Set<string>([]);

export const scannerCapabilityPlugin: GoatCapabilityPlugin = {
  namespace: 'scanner',
  supportedActions: ['SCAN_CODE', 'GENERATE_BARCODE', 'SCAN_DOCUMENTS'],
  handleAction: async (action: string, payload: any) => {
    const reason = UNBACKED[action];
    if (reason) {
      throw new Error(`${action} is not supported by the Goat engine: ${reason}`);
    }
    const engineAction = ENGINE_ACTION[action] ?? action;
    if (typeof GoatWebViewNativeModule?.executeAction !== 'function') {
      throw new Error(
        `Cannot execute ${action}: react-native-goat-webview's native module is unavailable. ` +
          'Rebuild the app after installing the package (Expo Go is not supported).'
      );
    }
    try {
      return await GoatWebViewNativeModule.executeAction(engineAction, payload ?? {}, payload?.appId);
    } catch (e: any) {
      const hint = ANDROID_ONLY.has(engineAction)
        ? ` (${engineAction} dispatches on Android only; iOS has no branch for it)`
        : '';
      throw new Error(`${e?.message ?? `Native ${action} execution failed`}${hint}`);
    }
  },
};

export function registerScannerCapability(): void {
  goatCapabilityRegistry.registerPlugin(scannerCapabilityPlugin);
}

export default scannerCapabilityPlugin;
