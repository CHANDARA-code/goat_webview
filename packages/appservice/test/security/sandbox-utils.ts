/**
 * @goat/appservice - Multi-Tenant Sandbox & Security Test Utilities
 * Implements genuine multi-tenant isolation models, path traversal validators,
 * cookie partitions, and origin verification engines for security fuzzing & testing.
 */

import { IpcMessageFrame, BridgeCallPayload, BridgeReplyPayload } from '../../src/types.js';

export class SecurityViolationError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'SecurityViolationError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface SecureStorageOptions {
  requireBiometric?: boolean;
  biometricToken?: string;
  accessControl?: 'always' | 'when_unlocked' | 'biometric_current_set';
}

export interface CookieRecord {
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly?: boolean;
  secure?: boolean;
  expires?: number;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface VfsStat {
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  lastModified: number;
  path: string;
  target?: string;
}

/**
 * MultiTenantStorageEnclave
 * Simulates hardware-backed storage enclaves, SharedPreferences,
 * LocalStorage, SessionStorage, IndexedDB, and Keychain/KeyStore partitions per appId & accountId.
 */
export class MultiTenantStorageEnclave {
  public static readonly MAX_STORAGE_BYTES = 10 * 1024 * 1024; // 10MB per tenant

  // Map<tenantKey, Map<key, string>>
  private localStoragePartitions = new Map<string, Map<string, string>>();
  private sessionStoragePartitions = new Map<string, Map<string, string>>();
  private secureStoragePartitions = new Map<string, Map<string, { value: string; options?: SecureStorageOptions }>>();
  
  // Map<tenantKey, Map<dbName, Map<storeName, Map<key, unknown>>>>
  private indexedDbPartitions = new Map<string, Map<string, Map<string, Map<string, unknown>>>>();

  private getTenantKey(appId: string, accountId?: string): string {
    if (!appId || typeof appId !== 'string' || appId.trim() === '') {
      throw new SecurityViolationError('ERR_INVALID_APP_ID', 'appId must be a non-empty string');
    }
    const cleanAppId = appId.trim();
    return accountId ? `${cleanAppId}__acc__${accountId.trim()}` : `${cleanAppId}__default`;
  }

  // --- Local Storage ---
  public setLocalStorage(appId: string, key: string, value: unknown, accountId?: string): { saved: boolean; bytesUsed: number } {
    if (!key || typeof key !== 'string') {
      throw new SecurityViolationError('ERR_INVALID_STORAGE_KEY', 'Storage key must be a non-empty string');
    }
    const tenantKey = this.getTenantKey(appId, accountId);
    let partition = this.localStoragePartitions.get(tenantKey);
    if (!partition) {
      partition = new Map<string, string>();
      this.localStoragePartitions.set(tenantKey, partition);
    }

    const strVal = typeof value === 'string' ? value : JSON.stringify(value);
    
    // Check quota
    let currentBytes = 0;
    for (const [k, v] of partition.entries()) {
      if (k !== key) {
        currentBytes += k.length + v.length;
      }
    }
    const newBytes = currentBytes + key.length + strVal.length;
    if (newBytes > MultiTenantStorageEnclave.MAX_STORAGE_BYTES) {
      throw new SecurityViolationError(
        'ERR_STORAGE_QUOTA_EXCEEDED',
        `LocalStorage quota of 10MB exceeded for tenant ${tenantKey}`,
        { tenantKey, currentBytes, requestedBytes: newBytes, maxBytes: MultiTenantStorageEnclave.MAX_STORAGE_BYTES }
      );
    }

    partition.set(key, strVal);
    return { saved: true, bytesUsed: newBytes };
  }

  public getLocalStorage(appId: string, key: string, accountId?: string): string | null {
    if (!key || typeof key !== 'string') {
      throw new SecurityViolationError('ERR_INVALID_STORAGE_KEY', 'Storage key must be a non-empty string');
    }
    const tenantKey = this.getTenantKey(appId, accountId);
    const partition = this.localStoragePartitions.get(tenantKey);
    if (!partition || !partition.has(key)) {
      return null;
    }
    return partition.get(key)!;
  }

  public removeLocalStorage(appId: string, key: string, accountId?: string): boolean {
    const tenantKey = this.getTenantKey(appId, accountId);
    const partition = this.localStoragePartitions.get(tenantKey);
    if (!partition) return false;
    return partition.delete(key);
  }

  public clearLocalStorage(appId: string, accountId?: string): { cleared: boolean; freedKeys: number } {
    const tenantKey = this.getTenantKey(appId, accountId);
    const partition = this.localStoragePartitions.get(tenantKey);
    if (!partition) return { cleared: true, freedKeys: 0 };
    const freedKeys = partition.size;
    partition.clear();
    return { cleared: true, freedKeys };
  }

  public listLocalStorageKeys(appId: string, accountId?: string): string[] {
    const tenantKey = this.getTenantKey(appId, accountId);
    const partition = this.localStoragePartitions.get(tenantKey);
    return partition ? Array.from(partition.keys()) : [];
  }

  // --- Session Storage ---
  public setSessionStorage(appId: string, key: string, value: unknown): boolean {
    const tenantKey = this.getTenantKey(appId);
    let partition = this.sessionStoragePartitions.get(tenantKey);
    if (!partition) {
      partition = new Map<string, string>();
      this.sessionStoragePartitions.set(tenantKey, partition);
    }
    const strVal = typeof value === 'string' ? value : JSON.stringify(value);
    partition.set(key, strVal);
    return true;
  }

  public getSessionStorage(appId: string, key: string): string | null {
    const tenantKey = this.getTenantKey(appId);
    const partition = this.sessionStoragePartitions.get(tenantKey);
    return partition?.get(key) || null;
  }

  public clearSessionStorage(appId: string): boolean {
    const tenantKey = this.getTenantKey(appId);
    const partition = this.sessionStoragePartitions.get(tenantKey);
    if (partition) partition.clear();
    return true;
  }

  // --- Secure Hardware Storage (KeyStore / Keychain) ---
  public setSecureStore(
    appId: string,
    key: string,
    value: string,
    options?: SecureStorageOptions,
    accountId?: string
  ): boolean {
    if (!key || typeof key !== 'string') {
      throw new SecurityViolationError('ERR_INVALID_STORAGE_KEY', 'Secure storage key must be a non-empty string');
    }
    const tenantKey = this.getTenantKey(appId, accountId);
    let partition = this.secureStoragePartitions.get(tenantKey);
    if (!partition) {
      partition = new Map();
      this.secureStoragePartitions.set(tenantKey, partition);
    }
    partition.set(key, { value, options });
    return true;
  }

  public getSecureStore(
    appId: string,
    key: string,
    options?: { biometricToken?: string },
    accountId?: string
  ): string | null {
    if (!key || typeof key !== 'string') {
      throw new SecurityViolationError('ERR_INVALID_STORAGE_KEY', 'Secure storage key must be a non-empty string');
    }
    const tenantKey = this.getTenantKey(appId, accountId);
    const partition = this.secureStoragePartitions.get(tenantKey);
    if (!partition || !partition.has(key)) {
      return null;
    }
    const item = partition.get(key)!;
    if (item.options?.requireBiometric) {
      if (!options?.biometricToken || options.biometricToken !== 'VALID_BIOMETRIC_AUTH_SIG') {
        throw new SecurityViolationError(
          'ERR_BIOMETRIC_AUTH_REQUIRED',
          `Biometric authentication required to unlock key "${key}" for tenant "${tenantKey}"`
        );
      }
    }
    return item.value;
  }

  public removeSecureStore(appId: string, key: string, accountId?: string): boolean {
    const tenantKey = this.getTenantKey(appId, accountId);
    const partition = this.secureStoragePartitions.get(tenantKey);
    if (!partition) return false;
    return partition.delete(key);
  }

  public clearSecureStore(appId: string, accountId?: string): boolean {
    const tenantKey = this.getTenantKey(appId, accountId);
    const partition = this.secureStoragePartitions.get(tenantKey);
    if (partition) partition.clear();
    return true;
  }

  // --- IndexedDB Store Partitions ---
  public setIndexedDb(appId: string, dbName: string, storeName: string, key: string, record: unknown): boolean {
    const tenantKey = this.getTenantKey(appId);
    let dbMap = this.indexedDbPartitions.get(tenantKey);
    if (!dbMap) {
      dbMap = new Map();
      this.indexedDbPartitions.set(tenantKey, dbMap);
    }
    let storeMap = dbMap.get(dbName);
    if (!storeMap) {
      storeMap = new Map();
      dbMap.set(dbName, storeMap);
    }
    let records = storeMap.get(storeName);
    if (!records) {
      records = new Map();
      storeMap.set(storeName, records);
    }
    records.set(key, record);
    return true;
  }

  public getIndexedDb(appId: string, dbName: string, storeName: string, key: string): unknown | null {
    const tenantKey = this.getTenantKey(appId);
    const dbMap = this.indexedDbPartitions.get(tenantKey);
    const record = dbMap?.get(dbName)?.get(storeName)?.get(key);
    return record !== undefined ? record : null;
  }

  public clearIndexedDb(appId: string, dbName?: string): boolean {
    const tenantKey = this.getTenantKey(appId);
    const dbMap = this.indexedDbPartitions.get(tenantKey);
    if (!dbMap) return true;
    if (dbName) {
      dbMap.delete(dbName);
    } else {
      dbMap.clear();
    }
    return true;
  }

  // --- Quota Calculation ---
  public getQuotaUsage(appId: string, accountId?: string): { usedBytes: number; quotaBytes: number; remainingBytes: number } {
    const tenantKey = this.getTenantKey(appId, accountId);
    const partition = this.localStoragePartitions.get(tenantKey);
    let usedBytes = 0;
    if (partition) {
      for (const [k, v] of partition.entries()) {
        usedBytes += k.length + v.length;
      }
    }
    const quotaBytes = MultiTenantStorageEnclave.MAX_STORAGE_BYTES;
    const remainingBytes = Math.max(0, quotaBytes - usedBytes);
    return { usedBytes, quotaBytes, remainingBytes };
  }

  public resetAll(): void {
    this.localStoragePartitions.clear();
    this.sessionStoragePartitions.clear();
    this.secureStoragePartitions.clear();
    this.indexedDbPartitions.clear();
  }
}

/**
 * SandboxedVirtualFileSystem
 * Implements strict canonical path validation, prevents path traversal attacks,
 * URL-encoded breakouts, null byte injections, and symlink breakout exploits.
 */
export class SandboxedVirtualFileSystem {
  public static readonly MAX_FS_BYTES = 50 * 1024 * 1024; // 50MB per tenant

  private static readonly SYSTEM_ROOT_PREFIXES = [
    '/etc',
    '/data',
    '/system',
    '/var',
    '/private',
    '/proc',
    '/sys',
    '/dev',
    '/root',
    '/home',
    '/usr',
    '/bin',
    '/opt',
    '/Applications',
    '/Library',
    '/System',
    '/Users',
    '/Volumes',
    '/Windows',
    '/Program Files',
  ];

  // Map<appId, Map<canonicalPath, { data: string; isDir: boolean; isSymlink?: boolean; symlinkTarget?: string; lastModified: number }>>
  private tenantFs = new Map<string, Map<string, { data: string; isDir: boolean; isSymlink?: boolean; symlinkTarget?: string; lastModified: number }>>();

  /**
   * Resolves and verifies that rawPath resolves strictly within the tenant's root sandbox: /miniapps/{appId}/
   * Fails closed with SecurityViolationError on any traversal or escape attempt.
   */
  public resolveCanonicalPath(appId: string, rawPath: string): string {
    if (!appId || typeof appId !== 'string' || appId.trim() === '') {
      throw new SecurityViolationError('ERR_INVALID_APP_ID', 'Invalid appId for VFS resolution');
    }
    if (!rawPath || typeof rawPath !== 'string') {
      throw new SecurityViolationError('ERR_INVALID_PATH', 'File path must be a non-empty string');
    }

    // 1. Check for Null Byte Injection
    if (rawPath.includes('\0') || rawPath.indexOf('\u0000') !== -1 || rawPath.includes('%00')) {
      throw new SecurityViolationError(
        'ERR_NULL_BYTE_INJECTION',
        `Null byte injection detected in path: ${JSON.stringify(rawPath)}`,
        { rawPath }
      );
    }

    // 2. Check for Drive letter breakouts (C:\...) or UNC paths (\\server\... or //server/...) BEFORE decoding/normalizing
    if (
      /^[A-Za-z]:/i.test(rawPath) ||
      rawPath.startsWith('\\\\') ||
      rawPath.startsWith('//')
    ) {
      throw new SecurityViolationError(
        'ERR_ABSOLUTE_SYSTEM_PATH',
        `System drive or UNC network path breakout rejected: ${rawPath}`
      );
    }

    // 3. Decode URL encodings iteratively to prevent double/nested encoding bypasses (%252e%252e%252f -> %2e%2e%2f -> ../)
    let decoded = rawPath;
    try {
      let prev = '';
      let decodeIterations = 0;
      while (decoded !== prev && decodeIterations < 5) {
        prev = decoded;
        decoded = decodeURIComponent(decoded);
        decodeIterations++;
      }
    } catch {
      throw new SecurityViolationError('ERR_MALFORMED_URI_ENCODING', `Malformed URL encoding in path: ${rawPath}`);
    }

    // Check again for null bytes or drive letters after decoding
    if (decoded.includes('\0') || decoded.indexOf('\u0000') !== -1) {
      throw new SecurityViolationError(
        'ERR_NULL_BYTE_INJECTION',
        `Null byte injection detected in decoded path: ${JSON.stringify(decoded)}`
      );
    }

    if (/^[A-Za-z]:/i.test(decoded) || decoded.startsWith('\\\\') || decoded.startsWith('//')) {
      throw new SecurityViolationError(
        'ERR_ABSOLUTE_SYSTEM_PATH',
        `System drive or UNC network path breakout rejected: ${decoded}`
      );
    }

    // 4. Normalize Windows backslashes to forward slashes
    let normalized = decoded.replace(/\\/g, '/');

    // 5. Check for direct traversal tokens
    if (
      normalized.includes('../') ||
      normalized.includes('/..') ||
      normalized === '..' ||
      normalized.includes('/../') ||
      normalized.includes('/.../') ||
      normalized.includes('/..../')
    ) {
      throw new SecurityViolationError(
        'ERR_PATH_TRAVERSAL',
        `Path traversal sequence detected in: ${rawPath}`,
        { rawPath, normalized }
      );
    }

    // 6. Check for absolute system root breakouts (/etc/passwd, /data/data/..., /var/...)
    for (const sysPrefix of SandboxedVirtualFileSystem.SYSTEM_ROOT_PREFIXES) {
      if (
        normalized.toLowerCase() === sysPrefix.toLowerCase() ||
        normalized.toLowerCase().startsWith(sysPrefix.toLowerCase() + '/')
      ) {
        throw new SecurityViolationError(
          'ERR_SANDBOX_BREAKOUT',
          `Absolute system directory access rejected: ${rawPath}`,
          { rawPath, sysPrefix }
        );
      }
    }

    // 7. Build absolute canonical path inside tenant root
    const tenantRoot = `/miniapps/${appId}`;
    let relative = normalized.startsWith('/') ? normalized : `/${normalized}`;
    
    // Collapse duplicate slashes and './'
    const segments: string[] = [];
    for (const part of relative.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') {
        throw new SecurityViolationError('ERR_PATH_TRAVERSAL', `Directory traversal attempted via .. segment: ${rawPath}`);
      }
      segments.push(part);
    }

    const canonicalPath = `${tenantRoot}/${segments.join('/')}`;

    // 8. Verify Prefix Containment (Must strictly start with tenantRoot + '/' or match tenantRoot)
    if (!canonicalPath.startsWith(`${tenantRoot}/`) && canonicalPath !== tenantRoot) {
      throw new SecurityViolationError(
        'ERR_SANDBOX_BREAKOUT',
        `Path escapes tenant sandbox enclave: ${canonicalPath} (Expected prefix: ${tenantRoot})`
      );
    }

    return canonicalPath;
  }

  public writeFile(appId: string, rawPath: string, data: string, options?: { append?: boolean }): { saved: boolean; bytesWritten: number; path: string } {
    const canonicalPath = this.resolveCanonicalPath(appId, rawPath);
    let fs = this.tenantFs.get(appId);
    if (!fs) {
      fs = new Map();
      this.tenantFs.set(appId, fs);
    }

    // Auto-create parent directory paths in map
    const tenantRoot = `/miniapps/${appId}`;
    const relative = canonicalPath.substring(tenantRoot.length + 1);
    const parts = relative.split('/');
    let currentDir = tenantRoot;
    for (let i = 0; i < parts.length - 1; i++) {
      currentDir += `/${parts[i]}`;
      if (!fs.has(currentDir)) {
        fs.set(currentDir, {
          data: '',
          isDir: true,
          lastModified: Date.now(),
        });
      }
    }

    let finalData = data;
    if (options?.append && fs.has(canonicalPath)) {
      const existing = fs.get(canonicalPath)!;
      if (!existing.isDir && !existing.isSymlink) {
        finalData = existing.data + data;
      }
    }

    // Calculate total VFS quota
    let totalBytes = 0;
    for (const [p, item] of fs.entries()) {
      if (p !== canonicalPath && !item.isDir) {
        totalBytes += item.data.length;
      }
    }
    const bytesWritten = finalData.length;
    if (totalBytes + bytesWritten > SandboxedVirtualFileSystem.MAX_FS_BYTES) {
      throw new SecurityViolationError(
        'ERR_FS_QUOTA_EXCEEDED',
        `VFS sandbox quota of 50MB exceeded for appId "${appId}"`,
        { appId, totalBytes, bytesWritten, maxBytes: SandboxedVirtualFileSystem.MAX_FS_BYTES }
      );
    }

    fs.set(canonicalPath, {
      data: finalData,
      isDir: false,
      lastModified: Date.now(),
    });

    return { saved: true, bytesWritten, path: canonicalPath };
  }

  public readFile(appId: string, rawPath: string): { data: string; path: string } {
    const canonicalPath = this.resolveCanonicalPath(appId, rawPath);
    const fs = this.tenantFs.get(appId);
    if (!fs || !fs.has(canonicalPath)) {
      throw new SecurityViolationError('ERR_FILE_NOT_FOUND', `File not found: ${rawPath}`);
    }

    const item = fs.get(canonicalPath)!;
    if (item.isSymlink && item.symlinkTarget) {
      if (!fs.has(item.symlinkTarget)) {
        throw new SecurityViolationError('ERR_DANGLING_SYMLINK', `Symlink points to non-existent target: ${item.symlinkTarget}`);
      }
      return { data: fs.get(item.symlinkTarget)!.data, path: item.symlinkTarget };
    }

    if (item.isDir) {
      throw new SecurityViolationError('ERR_IS_DIRECTORY', `Cannot read directory as file: ${rawPath}`);
    }

    return { data: item.data, path: canonicalPath };
  }

  public createSymlink(appId: string, targetPath: string, linkPath: string): { created: boolean; link: string; target: string } {
    // Validate that linkPath and targetPath stay strictly within sandbox
    const canonicalLink = this.resolveCanonicalPath(appId, linkPath);
    const canonicalTarget = this.resolveCanonicalPath(appId, targetPath);

    let fs = this.tenantFs.get(appId);
    if (!fs) {
      fs = new Map();
      this.tenantFs.set(appId, fs);
    }

    fs.set(canonicalLink, {
      data: '',
      isDir: false,
      isSymlink: true,
      symlinkTarget: canonicalTarget,
      lastModified: Date.now(),
    });

    return { created: true, link: canonicalLink, target: canonicalTarget };
  }

  public mkdir(appId: string, rawPath: string): { created: boolean; path: string } {
    const canonicalPath = this.resolveCanonicalPath(appId, rawPath);
    let fs = this.tenantFs.get(appId);
    if (!fs) {
      fs = new Map();
      this.tenantFs.set(appId, fs);
    }

    const tenantRoot = `/miniapps/${appId}`;
    const relative = canonicalPath.substring(tenantRoot.length + 1);
    const parts = relative.split('/');
    let currentDir = tenantRoot;
    for (let i = 0; i < parts.length; i++) {
      currentDir += `/${parts[i]}`;
      if (!fs.has(currentDir)) {
        fs.set(currentDir, {
          data: '',
          isDir: true,
          lastModified: Date.now(),
        });
      }
    }

    return { created: true, path: canonicalPath };
  }

  public rmdir(appId: string, rawPath: string): boolean {
    const canonicalPath = this.resolveCanonicalPath(appId, rawPath);
    const fs = this.tenantFs.get(appId);
    if (!fs) {
      throw new SecurityViolationError('ERR_DIR_NOT_FOUND', `Directory not found: ${rawPath}`);
    }

    const prefix = canonicalPath.endsWith('/') ? canonicalPath : `${canonicalPath}/`;
    let foundAny = fs.has(canonicalPath);
    for (const k of Array.from(fs.keys())) {
      if (k.startsWith(prefix)) {
        foundAny = true;
        fs.delete(k);
      }
    }

    if (!foundAny) {
      throw new SecurityViolationError('ERR_DIR_NOT_FOUND', `Directory not found: ${rawPath}`);
    }

    fs.delete(canonicalPath);
    return true;
  }

  public unlink(appId: string, rawPath: string): boolean {
    const canonicalPath = this.resolveCanonicalPath(appId, rawPath);
    const fs = this.tenantFs.get(appId);
    if (!fs || !fs.has(canonicalPath)) {
      throw new SecurityViolationError('ERR_FILE_NOT_FOUND', `File not found for deletion: ${rawPath}`);
    }
    return fs.delete(canonicalPath);
  }

  public listDir(appId: string, rawPath: string): string[] {
    const canonicalPath = this.resolveCanonicalPath(appId, rawPath);
    const fs = this.tenantFs.get(appId);
    if (!fs) return [];

    const files: string[] = [];
    const prefix = canonicalPath.endsWith('/') ? canonicalPath : `${canonicalPath}/`;
    for (const [p, item] of fs.entries()) {
      if (p !== canonicalPath && p.startsWith(prefix)) {
        const sub = p.substring(prefix.length);
        if (!sub.includes('/')) {
          files.push(item.isDir ? `${sub}/` : sub);
        }
      }
    }
    return files;
  }

  public exists(appId: string, rawPath: string): boolean {
    try {
      const canonicalPath = this.resolveCanonicalPath(appId, rawPath);
      const fs = this.tenantFs.get(appId);
      return fs ? fs.has(canonicalPath) : false;
    } catch {
      return false;
    }
  }

  public stat(appId: string, rawPath: string): VfsStat {
    const canonicalPath = this.resolveCanonicalPath(appId, rawPath);
    const fs = this.tenantFs.get(appId);
    if (!fs || !fs.has(canonicalPath)) {
      throw new SecurityViolationError('ERR_FILE_NOT_FOUND', `File not found: ${rawPath}`);
    }
    const item = fs.get(canonicalPath)!;
    return {
      isFile: !item.isDir && !item.isSymlink,
      isDirectory: item.isDir,
      isSymlink: !!item.isSymlink,
      size: item.data.length,
      lastModified: item.lastModified,
      path: canonicalPath,
      target: item.symlinkTarget,
    };
  }

  public clear(appId?: string): void {
    if (appId) {
      this.tenantFs.delete(appId);
    } else {
      this.tenantFs.clear();
    }
  }
}

/**
 * MultiTenantCookieJar
 * Simulates WKWebsiteDataStore UUIDv5 cookie partitions and Android CookieManager
 * tenant isolation, preventing cross-tenant cookie reads and credential leaks.
 */
export class MultiTenantCookieJar {
  // Map<appId, Map<cookieKey, CookieRecord>>
  private cookieJars = new Map<string, Map<string, CookieRecord>>();
  
  // Map<appId, Map<host, { username: string; password: string }>>
  private authCreds = new Map<string, Map<string, { username: string; password: string }>>();

  public setCookie(appId: string, cookie: { name: string; value: string; domain: string; path?: string; httpOnly?: boolean; secure?: boolean }): boolean {
    if (!appId) throw new SecurityViolationError('ERR_INVALID_APP_ID', 'appId required for cookie storage');
    if (!cookie.name || !cookie.domain) {
      throw new SecurityViolationError('ERR_INVALID_COOKIE', 'Cookie name and domain are required');
    }

    let jar = this.cookieJars.get(appId);
    if (!jar) {
      jar = new Map();
      this.cookieJars.set(appId, jar);
    }

    const key = `${cookie.domain}:${cookie.path || '/'}:${cookie.name}`;
    jar.set(key, {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path || '/',
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
    });
    return true;
  }

  public getCookies(appId: string, domain: string, path: string = '/'): CookieRecord[] {
    if (!appId) return [];
    const jar = this.cookieJars.get(appId);
    if (!jar) return [];

    const matched: CookieRecord[] = [];
    for (const cookie of jar.values()) {
      if (this.domainMatches(domain, cookie.domain) && path.startsWith(cookie.path)) {
        matched.push({ ...cookie });
      }
    }
    return matched;
  }

  public removeCookie(appId: string, name: string, domain: string, path: string = '/'): boolean {
    const jar = this.cookieJars.get(appId);
    if (!jar) return false;
    const key = `${domain}:${path}:${name}`;
    return jar.delete(key);
  }

  public clearCookies(appId: string): boolean {
    const jar = this.cookieJars.get(appId);
    if (jar) jar.clear();
    return true;
  }

  public saveHttpAuthCredential(appId: string, host: string, creds: { username: string; password: string }): boolean {
    if (!appId || !host) throw new SecurityViolationError('ERR_INVALID_AUTH', 'appId and host required');
    let tenantCreds = this.authCreds.get(appId);
    if (!tenantCreds) {
      tenantCreds = new Map();
      this.authCreds.set(appId, tenantCreds);
    }
    tenantCreds.set(host, { ...creds });
    return true;
  }

  public getHttpAuthCredential(appId: string, host: string): { username: string; password: string } | null {
    if (!appId || !host) return null;
    const tenantCreds = this.authCreds.get(appId);
    return tenantCreds?.get(host) || null;
  }

  public clearHttpAuthCredentials(appId: string, host?: string): boolean {
    const tenantCreds = this.authCreds.get(appId);
    if (!tenantCreds) return true;
    if (host) {
      tenantCreds.delete(host);
    } else {
      tenantCreds.clear();
    }
    return true;
  }

  private domainMatches(requestDomain: string, cookieDomain: string): boolean {
    const req = requestDomain.toLowerCase();
    const cDom = cookieDomain.toLowerCase().replace(/^\./, '');
    return req === cDom || req.endsWith(`.${cDom}`);
  }

  public clearAll(): void {
    this.cookieJars.clear();
    this.authCreds.clear();
  }
}

/**
 * OriginSecurityDispatcher
 * Enforces origin validation for postMessage, WebMessageListener,
 * and custom bridge events, blocking off-origin and spoofed cross-tenant requests.
 */
export class OriginSecurityDispatcher {
  /**
   * Verifies if an incoming message origin matches the allowed virtual origin for the given appId
   */
  public static isValidOriginForApp(appId: string, origin: string): boolean {
    if (!appId || !origin || typeof origin !== 'string') return false;

    const trimmedOrigin = origin.trim().toLowerCase();
    const cleanAppId = appId.trim().toLowerCase();

    // 1. Android Virtual Origin: https://{appId}.appassets.androidplatform.net
    const expectedAndroidOrigin = `https://${cleanAppId}.appassets.androidplatform.net`;
    if (trimmedOrigin === expectedAndroidOrigin) return true;

    // 2. iOS Virtual Scheme Origin: goat://{appId}
    const expectedIosOrigin = `goat://${cleanAppId}`;
    if (trimmedOrigin === expectedIosOrigin) return true;

    // 3. Web Localhost Dev Origin: https://{appId}.goat.local
    const expectedWebOrigin = `https://${cleanAppId}.goat.local`;
    if (trimmedOrigin === expectedWebOrigin) return true;

    return false;
  }

  /**
   * Dispatches an incoming WebMessage / postMessage payload if and only if origin verification succeeds
   */
  public static dispatchPostMessage(
    appId: string,
    origin: string,
    message: unknown,
    handler: (data: unknown) => void
  ): { accepted: boolean; error?: string } {
    if (!this.isValidOriginForApp(appId, origin)) {
      return {
        accepted: false,
        error: `ERR_ORIGIN_VERIFICATION_FAILED: Origin "${origin}" is not authorized for appId "${appId}"`,
      };
    }

    try {
      handler(message);
      return { accepted: true };
    } catch (e: any) {
      return { accepted: false, error: e?.message || 'Dispatch handler error' };
    }
  }

  /**
   * Checks if an event is authentic or attempts cross-lane spoofing
   */
  public static validateLaneEvent(frame: IpcMessageFrame): { valid: boolean; reason?: string } {
    if (!frame || !frame.type || !frame.id) {
      return { valid: false, reason: 'Malformed frame structure' };
    }

    // UI events must originate from 'appview'
    if (frame.type === 'UI_EVENT' && frame.source && frame.source !== 'appview' && frame.source !== 'AppView') {
      return { valid: false, reason: `UI_EVENT sent from unauthorized source lane: ${frame.source}` };
    }

    // UI patches must originate from 'appservice'
    if (frame.type === 'UI_PATCH' && frame.source && frame.source !== 'appservice' && frame.source !== 'AppService') {
      return { valid: false, reason: `UI_PATCH sent from unauthorized source lane: ${frame.source}` };
    }

    return { valid: true };
  }
}

/**
 * Deep Prototype Pollution Sanitizer & Guard
 */
export class PrototypePollutionGuard {
  public static containsPollution(obj: unknown): boolean {
    if (!obj || typeof obj !== 'object') return false;

    const seen = new Set();
    const check = (target: any): boolean => {
      if (!target || typeof target !== 'object' || seen.has(target)) return false;
      seen.add(target);

      if (Object.prototype.hasOwnProperty.call(target, '__proto__')) return true;
      if (Object.prototype.hasOwnProperty.call(target, 'constructor')) {
        if (target.constructor && target.constructor.prototype && Object.prototype.hasOwnProperty.call(target.constructor.prototype, 'isAdmin')) {
          return true;
        }
      }
      if (Object.prototype.hasOwnProperty.call(target, 'prototype')) return true;

      for (const key of Object.keys(target)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          return true;
        }
        if (typeof target[key] === 'object' && target[key] !== null) {
          if (check(target[key])) return true;
        }
      }
      return false;
    };

    return check(obj);
  }

  public static sanitize<T>(obj: T): T {
    if (!obj || typeof obj !== 'object') return obj;

    const clean = (input: any): any => {
      if (!input || typeof input !== 'object') return input;
      if (Array.isArray(input)) {
        return input.map(clean);
      }
      const result: Record<string, any> = Object.create(null);
      for (const [key, val] of Object.entries(input)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue;
        }
        result[key] = clean(val);
      }
      return result;
    };

    return clean(obj);
  }
}
