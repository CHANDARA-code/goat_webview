import type { GoatCapabilityPlugin } from 'react-native-goat-webview';
import { goatCapabilityRegistry, GoatWebViewNativeModule } from 'react-native-goat-webview';

/**
 * React Native Web3 & wallet-signing capability companion.
 *
 * Pairs with Android's `:feature-web3` (`GoatWeb3Plugin`) and iOS's `GoatWeb3Plugin`. Marshals
 * every action to the native engine via `GoatWebViewNativeModule.executeAction` and holds no
 * wallet logic of its own — in particular it never synthesises a signature or an account. The
 * Flutter side has had a `goat_webview_web3` companion; this closes the gap on
 * the React Native side.
 */

/** Caller-facing name -> the action string the engine actually dispatches. */
const ENGINE_ACTION: Record<string, string> = {
  'CONNECT_WALLET': 'WEB3_CONNECT_WALLET',
  'SIGN_TRANSACTION': 'WEB3_SIGN_TRANSACTION',
  'SIGN_MESSAGE': 'WEB3_SIGN_MESSAGE',
  'SWITCH_CHAIN': 'WEB3_SWITCH_CHAIN',
  'DISCONNECT_WALLET': 'WEB3_DISCONNECT',
  'GET_ACCOUNT': 'WEB3_GET_ACCOUNT',
};

/** Declared here, but no engine action exists on either platform. Rejected, never faked. */
const UNBACKED: Record<string, string> = {};

/** Resolves to an action only Android dispatches. */
const ANDROID_ONLY = new Set<string>([]);

export const web3CapabilityPlugin: GoatCapabilityPlugin = {
  namespace: 'web3',
  supportedActions: [
    'WEB3_CONNECT_WALLET',
    'WEB3_SIGN_TRANSACTION',
    'WEB3_SIGN_MESSAGE',
    'WEB3_SWITCH_CHAIN',
    'WEB3_DISCONNECT',
    'WEB3_GET_ACCOUNT',
    'CONNECT_WALLET',
    'SIGN_TRANSACTION',
    'SIGN_MESSAGE',
    'SWITCH_CHAIN',
    'DISCONNECT_WALLET',
    'GET_ACCOUNT',
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

export function registerWeb3Capability(): void {
  goatCapabilityRegistry.registerPlugin(web3CapabilityPlugin);
}

export default web3CapabilityPlugin;
