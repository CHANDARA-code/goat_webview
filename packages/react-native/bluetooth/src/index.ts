import type { GoatCapabilityPlugin } from 'react-native-goat-webview';
import { goatCapabilityRegistry, GoatWebViewNativeModule } from 'react-native-goat-webview';

/**
 * React Native bluetooth capability companion.
 *
 * Marshals its actions to the native engine via `GoatWebViewNativeModule.executeAction`. It holds
 * no capability logic of its own and never synthesises a result: before 2026-09-06 every action in
 * this package returned hardcoded data (and a `default:` branch returned `{ success: true }` for
 * ANY action), so a host got plausible-looking values while the engine was never called.
 *
 * BLE_OPEN_ADAPTER / BLE_CLOSE_ADAPTER dispatch on Android only; iOS has no branch for them.
 */

/** Caller-facing name -> the action string the engine actually dispatches. */
const ENGINE_ACTION: Record<string, string> = {
    'CLOSE_BLE_CONNECTION': 'BLE_DISCONNECT',
    'CLOSE_BLUETOOTH_ADAPTER': 'BLE_CLOSE_ADAPTER',
    'CREATE_BLE_CONNECTION': 'BLE_CONNECT',
    'OPEN_BLUETOOTH_ADAPTER': 'BLE_OPEN_ADAPTER',
    'START_BLUETOOTH_DEVICES_DISCOVERY': 'BLE_START_SCAN',
    'STOP_BLUETOOTH_DEVICES_DISCOVERY': 'BLE_STOP_SCAN',
  };

/** Declared here, but no engine action exists on either platform. Rejected, never faked. */
const UNBACKED: Record<string, string> = {
    'GET_BLUETOOTH_ADAPTER_STATE': 'no engine action; adapter state is implied by BLE_OPEN_ADAPTER',
    'GET_BLUETOOTH_DEVICES': 'no engine action; BLE_START_SCAN returns the discovered devices',
  };

/** Resolves to an action only Android dispatches. */
const ANDROID_ONLY = new Set<string>(['BLE_CLOSE_ADAPTER', 'BLE_OPEN_ADAPTER']);

export const bluetoothCapabilityPlugin: GoatCapabilityPlugin = {
  namespace: 'bluetooth',
  supportedActions: ['OPEN_BLUETOOTH_ADAPTER', 'CLOSE_BLUETOOTH_ADAPTER', 'GET_BLUETOOTH_ADAPTER_STATE', 'START_BLUETOOTH_DEVICES_DISCOVERY', 'STOP_BLUETOOTH_DEVICES_DISCOVERY', 'GET_BLUETOOTH_DEVICES', 'CREATE_BLE_CONNECTION', 'CLOSE_BLE_CONNECTION'],
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

export function registerBluetoothCapability(): void {
  goatCapabilityRegistry.registerPlugin(bluetoothCapabilityPlugin);
}

export default bluetoothCapabilityPlugin;
