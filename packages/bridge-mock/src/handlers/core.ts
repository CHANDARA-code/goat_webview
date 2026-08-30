/**
 * @goat/bridge-mock - Domain 1: Core & System Lifecycle Handlers (12 Actions)
 */

import { mockState } from '../state/store.js';
import {
  DeviceInfo,
  HapticFeedbackResult,
  BrightnessResult,
  KeepScreenOnResult,
  CanIUseResult,
  OAuthSessionResult,
} from '../types.js';
import { GoatBridgeError, BridgeErrorCodes } from '../errors.js';

export class CoreHandlers {
  /**
   * Action 1: GET_DEVICE_INFO
   */
  public static getDeviceInfo(): DeviceInfo {
    return {
      ...mockState.deviceInfo,
      batteryLevel: mockState.battery.level,
      isCharging: mockState.battery.isCharging,
    };
  }

  /**
   * Action 2: HAPTIC_FEEDBACK
   */
  public static triggerHaptic(payload: any = {}): HapticFeedbackResult {
    const type = payload.type || 'impact';
    const style = payload.style || 'medium';
    const notificationType = payload.notificationType;

    // Trigger browser vibration if supported
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        if (type === 'impact' && style === 'heavy') {
          navigator.vibrate(40);
        } else if (type === 'notification' && notificationType === 'error') {
          navigator.vibrate([30, 50, 30]);
        } else {
          navigator.vibrate(20);
        }
      } catch {
        // Ignore vibration error
      }
    }

    return {
      triggered: true,
      type: String(type),
      style: style ? String(style) : undefined,
      notificationType: notificationType ? String(notificationType) : undefined,
    };
  }

  /**
   * Action 3: SET_STATUS_BAR_THEME
   */
  public static setStatusBarTheme(payload: any = {}): { updated: boolean; isDark: boolean } {
    const isDark = !!payload.isDark;
    mockState.statusBarDark = isDark;
    return { updated: true, isDark };
  }

  /**
   * Action 4: SET_SCREEN_BRIGHTNESS
   */
  public static setScreenBrightness(payload: any = {}): BrightnessResult {
    let value = typeof payload.value === 'number' ? payload.value : 1.0;
    value = Math.max(0.0, Math.min(1.0, value));
    mockState.brightness = value;
    return { value, updated: true };
  }

  /**
   * Action 5: GET_SCREEN_BRIGHTNESS
   */
  public static getScreenBrightness(): BrightnessResult {
    return { value: mockState.brightness };
  }

  /**
   * Action 6: SET_KEEP_SCREEN_ON
   */
  public static setKeepScreenOn(payload: any = {}): KeepScreenOnResult {
    const keepOn = typeof payload.keepScreenOn === 'boolean' ? payload.keepScreenOn : true;
    mockState.keepScreenOn = keepOn;
    return { keepScreenOn: keepOn, updated: true };
  }

  /**
   * Action 7: CLIPBOARD_SET
   */
  public static setClipboard(payload: any = {}): { copied: boolean; length: number } {
    const text = typeof payload.text === 'string' ? payload.text : (payload.data ? String(payload.data) : '');
    mockState.clipboard = text;

    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).catch(() => {});
    }

    return { copied: true, length: text.length };
  }

  /**
   * Action 8: CLIPBOARD_GET
   */
  public static getClipboard(): { text: string; hasContent: boolean } {
    if (!mockState.isUserGestureFresh(10000)) {
      throw new GoatBridgeError(
        BridgeErrorCodes.GESTURE_REQUIRED,
        'Clipboard access requires recent user interaction gesture'
      );
    }
    const text = mockState.clipboard || '';
    return { text, hasContent: text.length > 0 };
  }

  /**
   * Action 9: NAVIGATE_BACK
   */
  public static navigateBack(): { handled: boolean; canGoBack: boolean } {
    if (mockState.pageStack.length > 1) {
      mockState.pageStack.pop();
      return { handled: true, canGoBack: mockState.pageStack.length > 1 };
    }
    return { handled: false, canGoBack: false };
  }

  /**
   * Action 10: CAN_I_USE
   */
  public static canIUse(payload: any = {}, supportedActionsCatalog: Set<string>): CanIUseResult {
    const action = String(payload.action || payload.schema || '').toUpperCase();
    const supported = supportedActionsCatalog.has(action);
    return { supported, action };
  }

  /**
   * Action 11: START_OAUTH_SESSION
   */
  public static startOAuthSession(payload: any = {}): Promise<OAuthSessionResult> {
    const authUrl = payload.authUrl;
    if (!authUrl || typeof authUrl !== 'string') {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing required "authUrl" parameter');
    }
    if (!authUrl.startsWith('https://')) {
      throw new GoatBridgeError(BridgeErrorCodes.SECURITY_VIOLATION, 'OAuth session requires secure HTTPS endpoint');
    }

    const redirectScheme = payload.redirectScheme || 'goat://oauth-callback';
    const mockCallback = `${redirectScheme}?code=mock_oauth_auth_code_991823&state=${encodeURIComponent(payload.state || 'active')}`;

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          callbackUrl: mockCallback,
          status: 'SUCCESS',
        });
      }, 100);
    });
  }

  /**
   * Action 12: CANCEL_OAUTH_SESSION
   */
  public static cancelOAuthSession(): { cancelled: boolean } {
    return { cancelled: true };
  }
}
