/**
 * @goat/bridge-mock - Canonical Error Taxonomy
 */

export interface GoatBridgeErrorDetails {
  action?: string;
  payload?: any;
  originalError?: any;
  code?: string;
  [key: string]: any;
}

export class GoatBridgeError extends Error {
  public readonly code: string;
  public readonly details?: GoatBridgeErrorDetails;

  constructor(code: string, message: string, details?: GoatBridgeErrorDetails) {
    super(message);
    this.name = 'GoatBridgeError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, GoatBridgeError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export const BridgeErrorCodes = {
  TIMEOUT: 'TIMEOUT',
  UNSUPPORTED_ACTION: 'UNSUPPORTED_ACTION',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  GESTURE_REQUIRED: 'GESTURE_REQUIRED',
  DIALOG_COOLDOWN_ACTIVE: 'DIALOG_COOLDOWN_ACTIVE',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  SECURITY_VIOLATION: 'SECURITY_VIOLATION',
  SSRF_BLOCKED: 'SSRF_BLOCKED',
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
  NATIVE_EXECUTION_ERROR: 'NATIVE_EXECUTION_ERROR',
  BIOMETRIC_UNAVAILABLE: 'BIOMETRIC_UNAVAILABLE',
  BIOMETRIC_LOCKOUT: 'BIOMETRIC_LOCKOUT',
  NETWORK_OFFLINE: 'NETWORK_OFFLINE',
  PORT_NOT_FOUND: 'PORT_NOT_FOUND',
  RP_ID_NOT_ALLOWED: 'RP_ID_NOT_ALLOWED',
  PASSKEY_UNSUPPORTED: 'PASSKEY_UNSUPPORTED',
  NO_CREDENTIAL_FOUND: 'NO_CREDENTIAL_FOUND',
  VAULT_DECRYPTION_FAILED: 'VAULT_DECRYPTION_FAILED',
  VAULT_UNAVAILABLE: 'VAULT_UNAVAILABLE',
  PASS_INVALID: 'PASS_INVALID',
  PASS_NOT_FOUND: 'PASS_NOT_FOUND',
  PASS_PROVIDER_UNAVAILABLE: 'PASS_PROVIDER_UNAVAILABLE',
} as const;

export type BridgeErrorCode = (typeof BridgeErrorCodes)[keyof typeof BridgeErrorCodes];
