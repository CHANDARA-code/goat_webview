import type { GoatCapabilityPlugin } from 'react-native-goat-webview';
import { goatCapabilityRegistry, GoatWebViewNativeModule } from 'react-native-goat-webview';

/**
 * React Native media capability companion.
 *
 * Marshals its actions to the native engine via `GoatWebViewNativeModule.executeAction`. It holds
 * no capability logic of its own and never synthesises a result: before 2026-09-06 every action in
 * this package returned hardcoded data (and a `default:` branch returned `{ success: true }` for
 * ANY action), so a host got plausible-looking values while the engine was never called.
 */

/** Caller-facing name -> the action string the engine actually dispatches. */
const ENGINE_ACTION: Record<string, string> = {
    'CHOOSE_IMAGE': 'CHOOSE_MEDIA',
    'CHOOSE_VIDEO': 'CHOOSE_MEDIA',
    'PAUSE_VOICE': 'AUDIO_PAUSE',
    'PLAY_VOICE': 'AUDIO_PLAY',
    'SAVE_IMAGE_TO_PHOTOS_ALBUM': 'SAVE_IMAGE_TO_ALBUM',
    'START_RECORD': 'AUDIO_RECORD_START',
    'STOP_RECORD': 'AUDIO_RECORD_STOP',
    'STOP_VOICE': 'AUDIO_STOP',
  };

/** Declared here, but no engine action exists on either platform. Rejected, never faked. */
const UNBACKED: Record<string, string> = {
    'GET_IMAGE_INFO': 'no engine action',
    'SAVE_VIDEO_TO_PHOTOS_ALBUM': 'no engine action; SAVE_IMAGE_TO_ALBUM covers images only',
  };

/** Resolves to an action only Android dispatches. */
const ANDROID_ONLY = new Set<string>([]);

export const mediaCapabilityPlugin: GoatCapabilityPlugin = {
  namespace: 'media',
  supportedActions: ['CHOOSE_IMAGE', 'PREVIEW_IMAGE', 'GET_IMAGE_INFO', 'SAVE_IMAGE_TO_PHOTOS_ALBUM', 'CHOOSE_VIDEO', 'SAVE_VIDEO_TO_PHOTOS_ALBUM', 'START_RECORD', 'STOP_RECORD', 'PLAY_VOICE', 'PAUSE_VOICE', 'STOP_VOICE'],
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

export function registerMediaCapability(): void {
  goatCapabilityRegistry.registerPlugin(mediaCapabilityPlugin);
}

export default mediaCapabilityPlugin;
