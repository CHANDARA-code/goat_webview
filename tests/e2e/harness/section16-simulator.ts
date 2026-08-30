/**
 * Goat WebView Section 16 Security & Networking Runtime Simulator
 *
 * Implements comprehensive multi-platform models for:
 * - Task 10204: HTTP Basic/Digest Auth Challenge Handling & Encrypted Credential Persistence
 * - Task 10205: Declarative Content-Blocker Allowlist Enforcement (Android shouldInterceptRequest & iOS WKContentRuleList)
 * - Dynamic OTA Content Rule Re-compilation without stale window
 * - Multi-tenant encrypted storage isolation (Android KeyStore / iOS Keychain)
 * - Cross-Platform SDK Bridges (Android, iOS, Flutter, React Native, Web)
 */

import { Buffer } from 'node:buffer';

// ============================================================================
// 1. Types & Data Structures (Task 10204 & Task 10205)
// ============================================================================

export interface HttpCredential {
  appId: string;
  host: string;
  realm: string;
  username: string;
  password: string;
  createdAt: number;
  encryptedData?: string;
}

export interface AuthSavePayload {
  host: string;
  realm?: string;
  username: string;
  password: string;
  appId?: string;
}

export interface AuthClearPayload {
  host?: string;
  realm?: string;
  appId?: string;
}

export interface ContentBlockerRule {
  trigger: {
    'url-filter': string;
    'load-type'?: string[];
    'if-domain'?: string[];
    'unless-domain'?: string[];
  };
  action: {
    type: 'block' | 'ignore-previous-rules' | 'css-display-none';
    selector?: string;
  };
}

export interface InterceptResult {
  intercepted: boolean;
  statusCode: number;
  statusText?: string;
  mimeType?: string;
  reason?: string;
}

// ============================================================================
// 2. HTTP Auth Manager & Encrypted Store Simulator (Task 10204)
// ============================================================================

export class GoatHttpAuthManagerSimulator {
  // Simulated hardware-backed secure storage (Android KeyStore / iOS Keychain)
  private secureStorage = new Map<string, string>(); // key -> AES-256 simulated ciphertext
  private memoryCache = new Map<string, HttpCredential>(); // in-memory decrypted cache

  public normalizeHost(host: string): string {
    if (!host) return '';
    let clean = host.trim().toLowerCase();
    try {
      if (clean.includes('://')) {
        const u = new URL(clean);
        clean = u.host;
      }
    } catch {
      // ignore
    }
    return clean;
  }

  private normalizeRealm(realm?: string): string {
    return (realm ?? '').trim();
  }

  private buildStorageKey(appId: string, host: string, realm: string): string {
    const cleanHost = this.normalizeHost(host);
    const cleanRealm = this.normalizeRealm(realm).toLowerCase();
    return `http_auth_${appId}_${cleanHost}_${cleanRealm}`;
  }

  private buildCacheKey(appId: string, host: string, realm: string): string {
    const cleanHost = this.normalizeHost(host);
    const cleanRealm = this.normalizeRealm(realm).toLowerCase();
    return `${appId}:${cleanHost}:${cleanRealm}`;
  }

  // Simulated AES-256-GCM / Keychain encryption
  private encrypt(plainText: string): string {
    return `ENC_AES256GCM_${Buffer.from(plainText, 'utf-8').toString('base64')}`;
  }

  private decrypt(cipherText: string): string {
    if (!cipherText.startsWith('ENC_AES256GCM_')) {
      throw new Error('CORRUPTED_CIPHERTEXT: Invalid encryption envelope format');
    }
    const b64 = cipherText.replace('ENC_AES256GCM_', '');
    return Buffer.from(b64, 'base64').toString('utf-8');
  }

  async saveCredential(
    appId: string,
    host: string,
    realm: string,
    username: string,
    password: string
  ): Promise<boolean> {
    if (!appId || !appId.trim()) {
      throw new Error('INVALID_ARGUMENT: appId must not be empty');
    }
    const cleanHost = this.normalizeHost(host);
    if (!cleanHost) {
      throw new Error('INVALID_ARGUMENT: host must not be empty');
    }
    if (typeof username !== 'string' || typeof password !== 'string') {
      throw new Error('INVALID_ARGUMENT: username and password must be strings');
    }

    const cleanRealm = this.normalizeRealm(realm);
    const cred: HttpCredential = {
      appId: appId.trim(),
      host: cleanHost,
      realm: cleanRealm,
      username,
      password,
      createdAt: Date.now(),
    };

    const serialized = JSON.stringify(cred);
    const encrypted = this.encrypt(serialized);
    const storageKey = this.buildStorageKey(appId, cleanHost, cleanRealm);
    const cacheKey = this.buildCacheKey(appId, cleanHost, cleanRealm);

    this.secureStorage.set(storageKey, encrypted);
    this.memoryCache.set(cacheKey, cred);
    return true;
  }

  getCredential(appId: string, host: string, realm = ''): HttpCredential | null {
    if (!appId || !host) return null;
    const cleanHost = this.normalizeHost(host);
    const cleanRealm = this.normalizeRealm(realm);
    const cacheKey = this.buildCacheKey(appId, cleanHost, cleanRealm);

    // 1. Check memory cache first (thread-safe fast path)
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey)!;
    }

    // 2. Check encrypted secure store
    const storageKey = this.buildStorageKey(appId, cleanHost, cleanRealm);
    const encrypted = this.secureStorage.get(storageKey);
    if (!encrypted) return null;

    try {
      const decrypted = this.decrypt(encrypted);
      const cred = JSON.parse(decrypted) as HttpCredential;
      this.memoryCache.set(cacheKey, cred);
      return cred;
    } catch {
      return null;
    }
  }

  hasCredential(appId: string, host: string, realm = ''): boolean {
    return this.getCredential(appId, host, realm) !== null;
  }

  async clearCredentials(appId: string, host?: string, realm?: string): Promise<boolean> {
    if (!appId) return false;
    const tenantPrefix = `http_auth_${appId}_`;
    const cachePrefix = `${appId}:`;

    if (host) {
      const cleanHost = this.normalizeHost(host);
      const cleanRealm = this.normalizeRealm(realm).toLowerCase();
      const storageKey = this.buildStorageKey(appId, cleanHost, cleanRealm);
      const cacheKey = this.buildCacheKey(appId, cleanHost, cleanRealm);

      this.secureStorage.delete(storageKey);
      this.memoryCache.delete(cacheKey);
      return true;
    }

    // Clear all for tenant
    const keysToDelete: string[] = [];
    for (const k of this.secureStorage.keys()) {
      if (k.startsWith(tenantPrefix)) {
        keysToDelete.push(k);
      }
    }
    for (const k of keysToDelete) {
      this.secureStorage.delete(k);
    }

    const cacheKeysToDelete: string[] = [];
    for (const k of this.memoryCache.keys()) {
      if (k.startsWith(cachePrefix)) {
        cacheKeysToDelete.push(k);
      }
    }
    for (const k of cacheKeysToDelete) {
      this.memoryCache.delete(k);
    }

    return true;
  }

  getTenantCredentialsCount(appId: string): number {
    const tenantPrefix = `http_auth_${appId}_`;
    let count = 0;
    for (const k of this.secureStorage.keys()) {
      if (k.startsWith(tenantPrefix)) count++;
    }
    return count;
  }

  // Diagnostic helper to inspect raw encrypted bytes in simulated KeyStore/Keychain
  getRawEncryptedValue(appId: string, host: string, realm = ''): string | null {
    const storageKey = this.buildStorageKey(appId, host, realm);
    return this.secureStorage.get(storageKey) ?? null;
  }
}

// ============================================================================
// 3. HTTP Auth Challenge Resolution Simulator (Android & iOS Delegates)
// ============================================================================

export class GoatHttpAuthChallengeResolverSimulator {
  private authManager: GoatHttpAuthManagerSimulator;

  constructor(authManager: GoatHttpAuthManagerSimulator) {
    this.authManager = authManager;
  }

  /**
   * Simulates Android WebViewClient.onReceivedHttpAuthRequest(view, handler, host, realm)
   */
  resolveAndroidAuthRequest(
    appId: string,
    host: string,
    realm: string
  ): {
    action: 'PROCEED' | 'CANCEL';
    username?: string;
    password?: string;
    silent: boolean;
    challenged: boolean;
  } {
    const cred = this.authManager.getCredential(appId, host, realm);
    if (cred) {
      return {
        action: 'PROCEED',
        username: cred.username,
        password: cred.password,
        silent: true,
        challenged: false,
      };
    }
    return {
      action: 'CANCEL',
      silent: false,
      challenged: true,
    };
  }

  /**
   * Simulates iOS WKNavigationDelegate webView(_:didReceive:completionHandler:)
   */
  resolveIOSAuthChallenge(
    appId: string,
    host: string,
    realm: string,
    authMethod: 'HTTP_BASIC' | 'HTTP_DIGEST' | 'SERVER_TRUST' | 'CLIENT_CERTIFICATE'
  ): {
    disposition: 'USE_CREDENTIAL' | 'CANCEL' | 'PERFORM_DEFAULT_HANDLING';
    credential?: { user: string; password: string; persistence: 'NONE' | 'FOR_SESSION' };
    challenged: boolean;
  } {
    if (authMethod === 'HTTP_BASIC' || authMethod === 'HTTP_DIGEST') {
      const cred = this.authManager.getCredential(appId, host, realm);
      if (cred) {
        return {
          disposition: 'USE_CREDENTIAL',
          credential: {
            user: cred.username,
            password: cred.password,
            persistence: 'NONE', // Non-persistent in ephemeral URLCredential
          },
          challenged: false,
        };
      }
      return {
        disposition: 'PERFORM_DEFAULT_HANDLING',
        challenged: true,
      };
    }

    if (authMethod === 'SERVER_TRUST') {
      // Hardened SSL handling (never accept untrusted)
      return {
        disposition: 'PERFORM_DEFAULT_HANDLING',
        challenged: true,
      };
    }

    return {
      disposition: 'CANCEL',
      challenged: false,
    };
  }
}

// ============================================================================
// 4. Native Bridge HTTP Auth Handler (Bridge Actions Protocol)
// ============================================================================

export class GoatBridgeHttpAuthActionHandler {
  private authManager: GoatHttpAuthManagerSimulator;
  private defaultAppId: string;

  constructor(authManager: GoatHttpAuthManagerSimulator, defaultAppId = 'com.goat.default') {
    this.authManager = authManager;
    this.defaultAppId = defaultAppId;
  }

  async handleAction(action: string, payload: Record<string, any> = {}): Promise<Record<string, any>> {
    switch (action) {
      case 'HTTP_AUTH_SAVE_CREDENTIAL': {
        const appId = payload.appId || this.defaultAppId;
        const host = payload.host;
        const realm = payload.realm || '';
        const username = payload.username;
        const password = payload.password;

        if (!host || typeof host !== 'string' || host.trim() === '') {
          throw new Error('INVALID_PAYLOAD: host is required and must be non-empty');
        }
        if (typeof username !== 'string' || username === '') {
          throw new Error('INVALID_PAYLOAD: username is required and must be a string');
        }
        if (typeof password !== 'string') {
          throw new Error('INVALID_PAYLOAD: password is required and must be a string');
        }

        const saved = await this.authManager.saveCredential(appId, host, realm, username, password);
        return {
          success: saved,
          saved,
          host: this.authManager.normalizeHost(host),
          realm: realm.trim(),
        };
      }

      case 'HTTP_AUTH_CLEAR_CREDENTIALS': {
        const appId = payload.appId || this.defaultAppId;
        const host = payload.host;
        const realm = payload.realm;

        const cleared = await this.authManager.clearCredentials(appId, host, realm);
        return {
          success: cleared,
          cleared,
        };
      }

      default:
        throw new Error(`UNSUPPORTED_ACTION: Unknown HTTP auth bridge action '${action}'`);
    }
  }
}

// ============================================================================
// 5. Declarative Content Blocker Simulator (Task 10205)
// ============================================================================

export class GoatContentBlockerSimulator {
  private allowedDomainsByTenant = new Map<string, string[]>();
  private compiledRuleLists = new Map<string, ContentBlockerRule[]>();

  private sandboxedSchemes = ['goat://', 'goat-bundle://', 'about:blank', 'data:'];

  /**
   * Sets allowed domains for a mini-app tenant (from manifest.json security.allowedDomains).
   */
  setAllowedDomains(appId: string, domains: string[]): void {
    const cleanDomains = domains
      .filter((d) => typeof d === 'string' && d.trim().length > 0)
      .map((d) => d.trim().toLowerCase());

    this.allowedDomainsByTenant.set(appId, cleanDomains);
    this.compileIOSRuleList(appId, cleanDomains);
  }

  getAllowedDomains(appId: string): string[] {
    return this.allowedDomainsByTenant.get(appId) ?? [];
  }

  /**
   * Evaluates whether a target URI is allowed for subresource loading.
   * Matches exact domains, wildcard subdomains (*.example.com), and root domains.
   */
  isUriAllowed(uri: string, allowedDomains: string[]): boolean {
    if (!uri) return false;

    // 1. Check sandboxed local schemes
    for (const scheme of this.sandboxedSchemes) {
      if (uri.startsWith(scheme)) return true;
    }

    try {
      const parsed = new URL(uri);
      const host = parsed.hostname.toLowerCase();

      // Disallow file:// and content://
      if (parsed.protocol === 'file:' || parsed.protocol === 'content:') {
        return false;
      }

      for (const pattern of allowedDomains) {
        const p = pattern.toLowerCase().trim();

        // Exact match
        if (host === p) return true;

        // Wildcard prefix: *.domain.com
        if (p.startsWith('*.')) {
          const suffix = p.slice(2);
          if (host.endsWith('.' + suffix) || host === suffix) {
            return true;
          }
        }

        // Domain with subdomains allowed (e.g. domain.com allows sub.domain.com)
        if (host.endsWith('.' + p)) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Android subresource interception simulator (GoatWebViewClient.shouldInterceptRequest)
   */
  shouldInterceptRequest(appId: string, url: string): InterceptResult {
    const allowed = this.getAllowedDomains(appId);
    const isAllowed = this.isUriAllowed(url, allowed);

    if (isAllowed) {
      return {
        intercepted: false,
        statusCode: 200,
      };
    }

    // Hard-block with HTTP 403 Forbidden
    return {
      intercepted: true,
      statusCode: 403,
      statusText: 'Forbidden',
      mimeType: 'text/plain',
      reason: 'DECLARATIVE_CONTENT_BLOCKER_OFF_ORIGIN_DENIED',
    };
  }

  /**
   * Compiles declarative WKContentRuleList JSON for iOS WKWebViewConfiguration.
   */
  generateWKContentRuleListJSON(allowedDomains: string[]): string {
    const rules: ContentBlockerRule[] = [];

    // Rule 1: Block all subresources by default
    rules.push({
      trigger: {
        'url-filter': '.*',
      },
      action: {
        type: 'block',
      },
    });

    // Rule 2: Unblock sandboxed bundle scheme
    rules.push({
      trigger: {
        'url-filter': '^goat://.*',
      },
      action: {
        type: 'ignore-previous-rules',
      },
    });

    // Rule 3: Allow each permitted domain and its subdomains
    for (const domain of allowedDomains) {
      const clean = domain.replace(/^\*\./, '');
      const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const filter = `^https?://([^/]+\\.)?${escaped}(:[0-9]+)?(/.*)?$`;

      rules.push({
        trigger: {
          'url-filter': filter,
          'load-type': ['first-party', 'third-party'],
        },
        action: {
          type: 'ignore-previous-rules',
        },
      });
    }

    return JSON.stringify(rules, null, 2);
  }

  private compileIOSRuleList(appId: string, allowedDomains: string[]): void {
    const json = this.generateWKContentRuleListJSON(allowedDomains);
    const parsed = JSON.parse(json) as ContentBlockerRule[];
    this.compiledRuleLists.set(appId, parsed);
  }

  getCompiledIOSRules(appId: string): ContentBlockerRule[] {
    return this.compiledRuleLists.get(appId) ?? [];
  }

  /**
   * Evaluates an iOS WKContentRuleList against a URL.
   */
  evaluateIOSRuleList(appId: string, url: string): { blocked: boolean; matchedRuleType: string } {
    const rules = this.getCompiledIOSRules(appId);
    if (rules.length === 0) {
      // Default: if no rules compiled, evaluate directly against allowedDomains
      const allowed = this.getAllowedDomains(appId);
      const isAllowed = this.isUriAllowed(url, allowed);
      return {
        blocked: !isAllowed,
        matchedRuleType: isAllowed ? 'ignore-previous-rules' : 'block',
      };
    }

    let isBlocked = false;
    let lastAction = 'none';

    for (const rule of rules) {
      const pattern = new RegExp(rule.trigger['url-filter']);
      if (pattern.test(url)) {
        if (rule.action.type === 'block') {
          isBlocked = true;
          lastAction = 'block';
        } else if (rule.action.type === 'ignore-previous-rules') {
          isBlocked = false;
          lastAction = 'ignore-previous-rules';
        }
      }
    }

    return {
      blocked: isBlocked,
      matchedRuleType: lastAction,
    };
  }
}

// ============================================================================
// 6. Dynamic OTA Content Rule Re-Compiler (Task 10205 / OTA Updates)
// ============================================================================

export class GoatOtaContentRuleManagerSimulator {
  private contentBlocker: GoatContentBlockerSimulator;
  private otaRecompileLog: { appId: string; timestamp: number; oldDomains: string[]; newDomains: string[] }[] = [];

  constructor(contentBlocker: GoatContentBlockerSimulator) {
    this.contentBlocker = contentBlocker;
  }

  /**
   * Dynamically updates allowed domains on bundle update without stale window or restart.
   */
  applyOtaBundleUpdate(appId: string, manifestSecurity: { allowedDomains?: string[] }): {
    success: boolean;
    compiledRulesCount: number;
    domainsApplied: string[];
    recompileDurationMs: number;
  } {
    const startTime = Date.now();
    const oldDomains = this.contentBlocker.getAllowedDomains(appId);
    const newDomains = manifestSecurity.allowedDomains ?? [];

    // Atomically recompile and apply rules
    this.contentBlocker.setAllowedDomains(appId, newDomains);
    const rules = this.contentBlocker.getCompiledIOSRules(appId);

    const duration = Date.now() - startTime;
    this.otaRecompileLog.push({
      appId,
      timestamp: Date.now(),
      oldDomains,
      newDomains,
    });

    return {
      success: true,
      compiledRulesCount: rules.length,
      domainsApplied: newDomains,
      recompileDurationMs: duration,
    };
  }

  getOtaLog(): typeof this.otaRecompileLog {
    return [...this.otaRecompileLog];
  }
}

// ============================================================================
// 7. Cross-Platform SDK Simulators (Flutter, React Native, Web Bridge)
// ============================================================================

export class FlutterGoatAuthBridgeSimulator {
  private bridgeHandler: GoatBridgeHttpAuthActionHandler;

  constructor(bridgeHandler: GoatBridgeHttpAuthActionHandler) {
    this.bridgeHandler = bridgeHandler;
  }

  async saveHttpAuthCredential(
    host: string,
    realm: string,
    username: string,
    password: string,
    appId?: string
  ): Promise<boolean> {
    const res = await this.bridgeHandler.handleAction('HTTP_AUTH_SAVE_CREDENTIAL', {
      host,
      realm,
      username,
      password,
      appId,
    });
    return res.saved === true;
  }

  async clearHttpAuthCredentials(host?: string, realm?: string, appId?: string): Promise<boolean> {
    const res = await this.bridgeHandler.handleAction('HTTP_AUTH_CLEAR_CREDENTIALS', {
      host,
      realm,
      appId,
    });
    return res.cleared === true;
  }
}

export class ReactNativeGoatAuthBridgeSimulator {
  private bridgeHandler: GoatBridgeHttpAuthActionHandler;

  constructor(bridgeHandler: GoatBridgeHttpAuthActionHandler) {
    this.bridgeHandler = bridgeHandler;
  }

  async saveHttpAuthCredential(params: {
    host: string;
    realm?: string;
    username: string;
    password: string;
    appId?: string;
  }): Promise<{ success: boolean; saved: boolean; host: string }> {
    const res = await this.bridgeHandler.handleAction('HTTP_AUTH_SAVE_CREDENTIAL', params);
    return { success: res.success, saved: res.saved, host: res.host };
  }

  async clearHttpAuthCredentials(params: {
    host?: string;
    realm?: string;
    appId?: string;
  } = {}): Promise<{ success: boolean; cleared: boolean }> {
    const res = await this.bridgeHandler.handleAction('HTTP_AUTH_CLEAR_CREDENTIALS', params);
    return { success: res.success, cleared: res.cleared };
  }
}

export class WebGoatAuthBridgeSimulator {
  private bridgeHandler: GoatBridgeHttpAuthActionHandler;

  constructor(bridgeHandler: GoatBridgeHttpAuthActionHandler) {
    this.bridgeHandler = bridgeHandler;
  }

  async saveHttpAuthCredential(
    host: string,
    realm: string,
    username: string,
    password: string
  ): Promise<{ success: boolean; saved: boolean }> {
    const res = await this.bridgeHandler.handleAction('HTTP_AUTH_SAVE_CREDENTIAL', {
      host,
      realm,
      username,
      password,
    });
    return { success: res.success, saved: res.saved };
  }

  async clearHttpAuthCredentials(host?: string, realm?: string): Promise<{ success: boolean; cleared: boolean }> {
    const res = await this.bridgeHandler.handleAction('HTTP_AUTH_CLEAR_CREDENTIALS', {
      host,
      realm,
    });
    return { success: res.success, cleared: res.cleared };
  }
}
