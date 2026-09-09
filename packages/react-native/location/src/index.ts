import type { GoatCapabilityPlugin } from 'react-native-goat-webview';
import { goatCapabilityRegistry, GoatWebViewNativeModule } from 'react-native-goat-webview';

/**
 * React Native location capability companion.
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
    'START_LOCATION_UPDATE': 'no engine action; only GET_LOCATION/CHOOSE_LOCATION/OPEN_LOCATION and the geofence actions exist',
    'STOP_LOCATION_UPDATE': 'no engine action; see START_LOCATION_UPDATE',
  };

/** Resolves to an action only Android dispatches. */
const ANDROID_ONLY = new Set<string>([]);

export const locationCapabilityPlugin: GoatCapabilityPlugin = {
  namespace: 'location',
  supportedActions: ['GET_LOCATION', 'CHOOSE_LOCATION', 'OPEN_LOCATION', 'START_LOCATION_UPDATE', 'STOP_LOCATION_UPDATE'],
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

export function registerLocationCapability(): void {
  goatCapabilityRegistry.registerPlugin(locationCapabilityPlugin);
}

export default locationCapabilityPlugin;
