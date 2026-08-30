/**
 * @goat/bridge-mock - Domain 8: Biometrics & Permissions Handlers (8 Actions)
 */

import { mockState } from '../state/store.js';
import { biometricModal } from '../ui/biometric-modal.js';
import { permissionModal } from '../ui/permission-modal.js';
import {
  BiometricSupportResult,
  BiometricAuthResult,
  PermissionResult,
  AuthSettingResult,
  SandboxHeadersAuditResult,
} from '../types.js';
import { GoatBridgeError, BridgeErrorCodes } from '../errors.js';

export class BiometricHandlers {
  /**
   * Action 97: CHECK_BIOMETRIC_SUPPORT
   */
  public static checkBiometricSupport(): BiometricSupportResult {
    return {
      supported: mockState.biometrics.supported,
      biometryType: mockState.biometrics.supported ? mockState.biometrics.biometryType : 'none',
    };
  }

  /**
   * Action 98: BIOMETRIC_AUTH
   */
  public static biometricAuth(payload: any = {}): Promise<BiometricAuthResult> {
    if (!mockState.permissions.get('BIOMETRIC')) {
      throw new GoatBridgeError(BridgeErrorCodes.PERMISSION_DENIED, 'Biometric permission not granted');
    }
    if (!mockState.isUserGestureFresh(10000)) {
      throw new GoatBridgeError(
        BridgeErrorCodes.GESTURE_REQUIRED,
        'Biometric authentication requires recent user touch interaction (<10s)'
      );
    }
    return biometricModal.prompt(payload);
  }

  /**
   * Action 99: CHECK_PERMISSION
   */
  public static checkPermission(payload: any = {}): PermissionResult {
    const scope = String(payload.scope || '').toUpperCase();
    if (!scope) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing scope for checkPermission');
    }
    const granted = mockState.permissions.has(scope) ? !!mockState.permissions.get(scope) : true;
    return { scope, granted, isDeclaredInManifest: true };
  }

  /**
   * Action 100: REQUEST_PERMISSION
   */
  public static requestPermission(payload: any = {}): Promise<PermissionResult> {
    const scope = String(payload.scope || '').toUpperCase();
    if (!scope) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing scope for requestPermission');
    }
    return permissionModal.prompt(scope, payload.rationale);
  }

  /**
   * Action 101: GET_SETTING
   */
  public static getSetting(): AuthSettingResult {
    const authSetting: Record<string, boolean> = {};
    for (const [k, v] of mockState.permissions.entries()) {
      authSetting[`scope.${k.toLowerCase()}`] = v;
    }
    return { authSetting };
  }

  /**
   * Action 102: OPEN_SETTING
   */
  public static openSetting(): { opened: boolean; authSetting: Record<string, boolean> } {
    const authSetting: Record<string, boolean> = {};
    for (const [k, v] of mockState.permissions.entries()) {
      authSetting[`scope.${k.toLowerCase()}`] = v;
    }
    return { opened: true, authSetting };
  }

  /**
   * Action 103: AUTHORIZE
   */
  public static authorize(payload: any = {}): PermissionResult {
    const scope = String(payload.scope || '').toUpperCase();
    if (!scope) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing scope for authorize');
    }
    const granted = payload.granted !== undefined ? !!payload.granted : true;
    mockState.permissions.set(scope, granted);
    return { scope, granted, isDeclaredInManifest: true };
  }

  /**
   * Action 104: AUDIT_SANDBOX_HEADERS
   */
  public static auditSandboxHeaders(): SandboxHeadersAuditResult {
    return {
      coopHeaderPresent: true,
      coepHeaderPresent: true,
      isIsolatedContext: true,
      status: 'HERMETIC_ISOLATION_CONFIRMED',
    };
  }
}
