import type { GoatCapabilityPlugin } from 'react-native-goat-webview';
import { goatCapabilityRegistry, GoatWebViewNativeModule } from 'react-native-goat-webview';

/**
 * React Native biometrics capability companion.
 *
 * Marshals its actions to the native engine via `GoatWebViewNativeModule.executeAction`. It holds
 * no capability logic of its own and never synthesises a result: before 2026-09-06 every action in
 * this package returned hardcoded data (and a `default:` branch returned `{ success: true }` for
 * ANY action), so a host got plausible-looking values while the engine was never called.
 *
 * Every call goes to the native BiometricPrompt path. This module must never synthesise an
 * authentication result: it previously returned `{ authenticated: true }` unconditionally, which
 * is an auth bypass for any host that gated on it, and it defeated the fail-closed behaviour
 * GoatBridgeActionHandlerTest asserts when no biometric plugin is registered.
 */

/** Caller-facing name -> the action string the engine actually dispatches. */
const ENGINE_ACTION: Record<string, string> = {
    'AUTHENTICATE_BIOMETRICS': 'BIOMETRIC_AUTH',
    'CHECK_BIOMETRICS': 'CHECK_BIOMETRIC_SUPPORT',
  };

/** Declared here, but no engine action exists on either platform. Rejected, never faked. */
const UNBACKED: Record<string, string> = {};

/** Resolves to an action only Android dispatches. */
const ANDROID_ONLY = new Set<string>([]);

export const biometricsCapabilityPlugin: GoatCapabilityPlugin = {
  namespace: 'biometrics',
  supportedActions: [
    'CHECK_BIOMETRICS',
    'AUTHENTICATE_BIOMETRICS',
    'CHECK_BIOMETRIC_SUPPORT',
    'BIOMETRIC_AUTH',
    'PASSKEY_CHECK_SUPPORT',
    'PASSKEY_REGISTER',
    'PASSKEY_ASSERT',
    'VAULT_ENCRYPT',
    'VAULT_DECRYPT',
  ],
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

export function registerBiometricsCapability(): void {
  goatCapabilityRegistry.registerPlugin(biometricsCapabilityPlugin);
}

export default biometricsCapabilityPlugin;
