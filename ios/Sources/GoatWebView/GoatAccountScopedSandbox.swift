import Foundation

/**
 * Account-Scoped Storage Sandbox & Anonymous Identity Provider for iOS (Task 10203 / Pillar 1).
 *
 * Implements:
 * 1. Account-scoped storage sandbox partitioning:
 *    - Key-Value: UserDefaults keys prefixed with `"goat_storage_{appId}_{accountId}_"`
 *    - Filesystem: Directories scoped under `Documents/miniapps/{appId}/{accountId}/data/`
 *    - Keychain: Hardware secure storage partitioned via `kSecAttrService` = `"goat_secure_{appId}_{accountId}"`
 *    - Seamless fallback to `{appId}` when no active account is configured.
 * 2. Install-scoped anonymous GUID (`installGuid`):
 *    - Stable UUID v4 identifier persisted in app-private `UserDefaults(suiteName: "goat_identity_sandbox")`.
 *    - Remains constant across launches, restarts, OTA updates, and account switches.
 *    - Regenerates automatically on fresh installation or app data purge.
 */
public final class GoatAccountScopedSandbox: @unchecked Sendable {

    public static let shared = GoatAccountScopedSandbox()

    public static let identitySuite = "goat_identity_sandbox"
    public static let keyInstallGuid = "install_guid"

    private let userDefaults: UserDefaults
    private let lock = NSLock()
    private var _accountProvider: (() -> String?)?

    public init(userDefaults: UserDefaults? = nil) {
        self.userDefaults = userDefaults ?? UserDefaults(suiteName: Self.identitySuite) ?? .standard
    }

    /**
     * Optional host-app supplied account identifier provider closure.
     */
    public var accountProvider: (() -> String?)? {
        get {
            lock.lock()
            defer { lock.unlock() }
            return _accountProvider
        }
        set {
            lock.lock()
            defer { lock.unlock() }
            _accountProvider = newValue
        }
    }

    /**
     * Resolves the active account ID string, or nil if no account is active or if provider returns blank.
     */
    public func getCurrentAccountId() -> String? {
        lock.lock()
        let provider = _accountProvider
        lock.unlock()

        guard let provider = provider else { return nil }
        guard let accountId = provider()?.trimmingCharacters(in: .whitespacesAndNewlines),
              !accountId.isEmpty else {
            return nil
        }
        return accountId
    }

    /**
     * Resolves the scoped UserDefaults prefix:
     * - With accountId: `"goat_storage_{sanitizedAppId}_{sanitizedAccountId}_"`
     * - Without accountId: `"goat_storage_{sanitizedAppId}_"`
     */
    public func getScopedPreferencesPrefix(appId: String, accountId: String? = nil) throws -> String {
        let sanitizedAppId = try GoatStorageManager.sanitizeIdentifier(appId)
        let resolvedAccount = (accountId ?? getCurrentAccountId())?.trimmingCharacters(in: .whitespacesAndNewlines)

        if let account = resolvedAccount, !account.isEmpty {
            let sanitizedAccount = try GoatStorageManager.sanitizeIdentifier(account)
            return "\(GoatStorageManager.prefsPrefix)\(sanitizedAppId)_\(sanitizedAccount)_"
        } else {
            return "\(GoatStorageManager.prefsPrefix)\(sanitizedAppId)_"
        }
    }

    /**
     * Resolves the sandboxed internal filesystem data directory URL for a tenant:
     * - With accountId: `Documents/miniapps/{appId}/{accountId}/data/`
     * - Without accountId: `Documents/miniapps/{appId}/data/` (or `Documents/miniapp_data/` for default)
     */
    public func getScopedDataDirectory(baseDocumentsURL: URL, appId: String, accountId: String? = nil) throws -> URL {
        let sanitizedAppId = try GoatStorageManager.sanitizeIdentifier(appId)
        let resolvedAccount = (accountId ?? getCurrentAccountId())?.trimmingCharacters(in: .whitespacesAndNewlines)

        let baseDir: URL
        if sanitizedAppId == GoatStorageManager.defaultAppId {
            baseDir = baseDocumentsURL.appendingPathComponent(GoatStorageManager.defaultDataDirName, isDirectory: true)
        } else {
            baseDir = baseDocumentsURL.appendingPathComponent(GoatStorageManager.miniappsDir, isDirectory: true)
                                      .appendingPathComponent(sanitizedAppId, isDirectory: true)
        }

        if let account = resolvedAccount, !account.isEmpty {
            let sanitizedAccount = try GoatStorageManager.sanitizeIdentifier(account)
            return baseDir.appendingPathComponent(sanitizedAccount, isDirectory: true)
                          .appendingPathComponent(GoatStorageManager.dataDir, isDirectory: true)
        } else {
            if sanitizedAppId == GoatStorageManager.defaultAppId {
                return baseDir
            } else {
                return baseDir.appendingPathComponent(GoatStorageManager.dataDir, isDirectory: true)
            }
        }
    }

    /**
     * Resolves the scoped Keychain service name for secure storage:
     * - With accountId: `"goat_secure_{sanitizedAppId}_{sanitizedAccountId}"`
     * - Without accountId: `"goat_secure_{sanitizedAppId}"`
     */
    public func getScopedServiceName(appId: String, accountId: String? = nil) throws -> String {
        let sanitizedAppId = try GoatStorageManager.sanitizeIdentifier(appId)
        let resolvedAccount = (accountId ?? getCurrentAccountId())?.trimmingCharacters(in: .whitespacesAndNewlines)

        if let account = resolvedAccount, !account.isEmpty {
            let sanitizedAccount = try GoatStorageManager.sanitizeIdentifier(account)
            return "\(GoatSecureStorageManager.servicePrefix)\(sanitizedAppId)_\(sanitizedAccount)"
        } else {
            return "\(GoatSecureStorageManager.servicePrefix)\(sanitizedAppId)"
        }
    }

    /**
     * Returns the stable anonymous install GUID for the current device install.
     * Regenerates only upon application reinstall / storage data wipe.
     */
    public func getInstallGuid() -> String {
        lock.lock()
        defer { lock.unlock() }

        if let existing = userDefaults.string(forKey: Self.keyInstallGuid), !existing.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return existing
        }
        let newGuid = UUID().uuidString
        userDefaults.set(newGuid, forKey: Self.keyInstallGuid)
        return newGuid
    }

    /**
     * For testing/audit purposes: forces regeneration of the install GUID.
     */
    @discardableResult
    public func resetInstallGuidForTest() -> String {
        lock.lock()
        defer { lock.unlock() }

        let newGuid = UUID().uuidString
        userDefaults.set(newGuid, forKey: Self.keyInstallGuid)
        return newGuid
    }
}
