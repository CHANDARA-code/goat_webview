/**
 * @goat/core - Zero-Trust Security Errors
 */

export enum SecurityErrorCode {
  SSRF_BLOCKED = 'ERR_SSRF_BLOCKED',
  DNS_REBINDING_DETECTED = 'ERR_DNS_REBINDING_DETECTED',
  INVALID_SCHEME = 'ERR_INVALID_SCHEME',
  REDIRECT_BLOCKED = 'ERR_REDIRECT_BLOCKED',
  DOMAIN_NOT_ALLOWED = 'ERR_DOMAIN_NOT_ALLOWED',
  METADATA_BLOCKED = 'ERR_METADATA_BLOCKED',
  INVALID_URL = 'ERR_INVALID_URL',
  CLEARTEXT_HTTP_BLOCKED = 'ERR_CLEARTEXT_HTTP_BLOCKED',
}

export class GoatSecurityError extends Error {
  public readonly code: SecurityErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(code: SecurityErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'GoatSecurityError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SsrfBlockedError extends GoatSecurityError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(SecurityErrorCode.SSRF_BLOCKED, message, details);
    this.name = 'SsrfBlockedError';
  }
}

export class DnsRebindingError extends GoatSecurityError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(SecurityErrorCode.DNS_REBINDING_DETECTED, message, details);
    this.name = 'DnsRebindingError';
  }
}

export class InvalidUrlSchemeError extends GoatSecurityError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(SecurityErrorCode.INVALID_SCHEME, message, details);
    this.name = 'InvalidUrlSchemeError';
  }
}

export class RedirectBlockedError extends GoatSecurityError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(SecurityErrorCode.REDIRECT_BLOCKED, message, details);
    this.name = 'RedirectBlockedError';
  }
}

export class DomainNotAllowedError extends GoatSecurityError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(SecurityErrorCode.DOMAIN_NOT_ALLOWED, message, details);
    this.name = 'DomainNotAllowedError';
  }
}

/**
 * Cloud Metadata access is a specialized SSRF attack vector
 */
export class CloudMetadataBlockedError extends SsrfBlockedError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
    this.name = 'CloudMetadataBlockedError';
  }
}
