import Foundation

/**
 * Storage Sandboxing Error Types (OWASP MASVS-STORAGE-02).
 */
public enum GoatStorageError: Error, LocalizedError {
    case invalidIdentifier(String)
    case invalidKey(String)
    case securityViolation(String)
    case fileNotFound(String)
    case ioError(String)

    public var errorDescription: String? {
        switch self {
        case .invalidIdentifier(let msg): return "Invalid identifier: \(msg)"
        case .invalidKey(let msg): return "Invalid key: \(msg)"
        case .securityViolation(let msg): return "Security violation: \(msg)"
        case .fileNotFound(let msg): return "File not found: \(msg)"
        case .ioError(let msg): return "I/O error: \(msg)"
        }
    }
}

/**
 * Enterprise Multi-Tenant Storage Sandboxing Manager for iOS (Task 10163 / OWASP MASVS-STORAGE-02).
 *
 * Provides strictly partitioned key-value storage (`UserDefaults` keyspace `goat_storage_{appId}_{key}`)
 * and sandboxed filesystem directories (`Documents/miniapps/{appId}/data/`) scoped per `appId`,
 * guaranteeing zero cross-tenant data leakage on iOS.
 */
public final class GoatStorageManager: @unchecked Sendable {

    public static let defaultAppId = "default"
    public static let prefsPrefix = "goat_storage_"
    public static let miniappsDir = "miniapps"
    public static let dataDir = "data"
    public static let defaultDataDirName = "miniapp_data"

    private let userDefaults: UserDefaults
    private let fileManager: FileManager
    private let baseDocumentsURL: URL
    private let lock = NSLock()

    public init(
        userDefaults: UserDefaults = .standard,
        fileManager: FileManager = .default,
        baseDocumentsURL: URL? = nil
    ) {
        self.userDefaults = userDefaults
        self.fileManager = fileManager
        if let customBase = baseDocumentsURL {
            self.baseDocumentsURL = customBase
        } else {
            let paths = fileManager.urls(for: .documentDirectory, in: .userDomainMask)
            self.baseDocumentsURL = paths.first ?? URL(fileURLWithPath: NSTemporaryDirectory())
        }
    }

    // MARK: - Path Resolution & Identifier Sanitization

    /**
     * Sanitizes an appId to prevent path traversal characters.
     * Throws SecurityException if directory traversal patterns like `..` or path separators are detected.
     */
    public static func sanitizeIdentifier(_ identifier: String) throws -> String {
        let trimmed = identifier.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw GoatStorageError.invalidIdentifier("appId cannot be blank")
        }
        if trimmed.contains("..") || trimmed.contains("/") || trimmed.contains("\\") {
            throw GoatStorageError.securityViolation("Path traversal sequence detected in appId: \(identifier)")
        }
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "._-"))
        let sanitized = trimmed.unicodeScalars.map { allowed.contains($0) ? Character($0) : "_" }
        return String(sanitized)
    }

    /**
     * Resolves the scoped key prefix for a tenant in UserDefaults.
     */
    public static func getPreferencesPrefix(appId: String = defaultAppId, accountId: String? = nil) throws -> String {
        return try GoatAccountScopedSandbox.shared.getScopedPreferencesPrefix(appId: appId, accountId: accountId)
    }

    /**
     * Resolves the sandboxed internal filesystem data directory URL for a tenant.
     */
    public static func getTenantDataDirectory(
        baseDocumentsURL: URL? = nil,
        appId: String = defaultAppId,
        accountId: String? = nil
    ) throws -> URL {
        let base = baseDocumentsURL ?? (FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first ?? URL(fileURLWithPath: NSTemporaryDirectory()))
        return try GoatAccountScopedSandbox.shared.getScopedDataDirectory(baseDocumentsURL: base, appId: appId, accountId: accountId)
    }

    /**
     * Resolves and creates (if missing) the sandboxed data directory for the specified tenant.
     */
    public func ensureTenantDataDirectory(appId: String = defaultAppId) throws -> URL {
        lock.lock()
        defer { lock.unlock() }

        let dataDirURL = try Self.getTenantDataDirectory(baseDocumentsURL: baseDocumentsURL, appId: appId)
        if !fileManager.fileExists(atPath: dataDirURL.path) {
            try fileManager.createDirectory(at: dataDirURL, withIntermediateDirectories: true, attributes: nil)
        }
        return dataDirURL
    }

    /**
     * Resolves a relative path within the tenant's data sandbox with strict Zip Slip / Path Traversal guards.
     */
    public func resolveTenantPath(appId: String = defaultAppId, relativePath: String) throws -> URL {
        let tenantDataDir = try ensureTenantDataDirectory(appId: appId)
        let trimmed = relativePath.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("/") {
            throw GoatStorageError.securityViolation("Absolute path breach detected outside tenant sandbox: \(relativePath) (appId=\(appId))")
        }

        let targetURL = tenantDataDir.appendingPathComponent(trimmed).standardizedFileURL
        let targetCanonical = targetURL.path
        let baseCanonical = tenantDataDir.standardizedFileURL.path

        if !targetCanonical.hasPrefix(baseCanonical + "/") && targetCanonical != baseCanonical {
            throw GoatStorageError.securityViolation("Path traversal breach detected outside tenant sandbox: \(relativePath) (appId=\(appId))")
        }
        return targetURL
    }

    // MARK: - Key-Value Storage Operations

    public func setValue(appId: String = defaultAppId, key: String, value: String) async throws -> Bool {
        guard !key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw GoatStorageError.invalidKey("Storage key cannot be blank")
        }
        let prefix = try Self.getPreferencesPrefix(appId: appId)
        userDefaults.set(value, forKey: "\(prefix)\(key)")
        return true
    }

    public func getValue(appId: String = defaultAppId, key: String) async throws -> String? {
        guard !key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw GoatStorageError.invalidKey("Storage key cannot be blank")
        }
        let prefix = try Self.getPreferencesPrefix(appId: appId)
        return userDefaults.string(forKey: "\(prefix)\(key)")
    }

    public func removeValue(appId: String = defaultAppId, key: String) async throws -> Bool {
        guard !key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw GoatStorageError.invalidKey("Storage key cannot be blank")
        }
        let prefix = try Self.getPreferencesPrefix(appId: appId)
        userDefaults.removeObject(forKey: "\(prefix)\(key)")
        return true
    }

    public func clear(appId: String = defaultAppId) async throws -> Bool {
        return try await clearValues(appId: appId)
    }

    public func clearValues(appId: String = defaultAppId) async throws -> Bool {
        let prefix = try Self.getPreferencesPrefix(appId: appId)
        let keys = userDefaults.dictionaryRepresentation().keys.filter { $0.hasPrefix(prefix) }
        for k in keys {
            userDefaults.removeObject(forKey: k)
        }
        return true
    }

    public func getAllKeys(appId: String = defaultAppId) async throws -> [String] {
        let prefix = try Self.getPreferencesPrefix(appId: appId)
        return userDefaults.dictionaryRepresentation().keys
            .filter { $0.hasPrefix(prefix) }
            .map { String($0.dropFirst(prefix.count)) }
    }

    // MARK: - Sandboxed File System Operations

    public func writeFile(
        appId: String = defaultAppId,
        relativePath: String,
        data: Data,
        append: Bool = false
    ) async throws -> Bool {
        let targetURL = try resolveTenantPath(appId: appId, relativePath: relativePath)
        let parentDir = targetURL.deletingLastPathComponent()
        if !fileManager.fileExists(atPath: parentDir.path) {
            try fileManager.createDirectory(at: parentDir, withIntermediateDirectories: true, attributes: nil)
        }

        if append && fileManager.fileExists(atPath: targetURL.path) {
            let fileHandle = try FileHandle(forWritingTo: targetURL)
            defer { try? fileHandle.close() }
            fileHandle.seekToEndOfFile()
            fileHandle.write(data)
        } else {
            try data.write(to: targetURL, options: .atomic)
        }
        return true
    }

    public func readFile(appId: String = defaultAppId, relativePath: String) async throws -> Data {
        let targetURL = try resolveTenantPath(appId: appId, relativePath: relativePath)
        guard fileManager.fileExists(atPath: targetURL.path) else {
            throw GoatStorageError.fileNotFound("File not found in tenant sandbox: \(relativePath) (appId=\(appId))")
        }
        return try Data(contentsOf: targetURL)
    }

    public func makeDirectory(
        appId: String = defaultAppId,
        relativePath: String,
        recursive: Bool = true
    ) async throws -> Bool {
        let targetURL = try resolveTenantPath(appId: appId, relativePath: relativePath)
        if fileManager.fileExists(atPath: targetURL.path) {
            var isDir: ObjCBool = false
            fileManager.fileExists(atPath: targetURL.path, isDirectory: &isDir)
            return isDir.boolValue
        }
        try fileManager.createDirectory(at: targetURL, withIntermediateDirectories: recursive, attributes: nil)
        return true
    }

    public func removeDirectory(
        appId: String = defaultAppId,
        relativePath: String,
        recursive: Bool = true
    ) async throws -> Bool {
        let targetURL = try resolveTenantPath(appId: appId, relativePath: relativePath)
        guard fileManager.fileExists(atPath: targetURL.path) else {
            return false
        }
        try fileManager.removeItem(at: targetURL)
        return true
    }

    public func deleteFile(appId: String = defaultAppId, relativePath: String) async throws -> Bool {
        let targetURL = try resolveTenantPath(appId: appId, relativePath: relativePath)
        guard fileManager.fileExists(atPath: targetURL.path) else {
            return false
        }
        var isDir: ObjCBool = false
        fileManager.fileExists(atPath: targetURL.path, isDirectory: &isDir)
        guard !isDir.boolValue else { return false }
        try fileManager.removeItem(at: targetURL)
        return true
    }

    public func listDirectory(appId: String = defaultAppId, relativePath: String = "") async throws -> [String] {
        let targetURL = try resolveTenantPath(appId: appId, relativePath: relativePath)
        guard fileManager.fileExists(atPath: targetURL.path) else {
            return []
        }
        return try fileManager.contentsOfDirectory(atPath: targetURL.path)
    }

    public func getFileStat(appId: String = defaultAppId, relativePath: String) async throws -> [String: Any] {
        let targetURL = try resolveTenantPath(appId: appId, relativePath: relativePath)
        guard fileManager.fileExists(atPath: targetURL.path) else {
            throw GoatStorageError.fileNotFound("Target path does not exist in sandbox: \(relativePath) (appId=\(appId))")
        }
        let attributes = try fileManager.attributesOfItem(atPath: targetURL.path)
        var isDir: ObjCBool = false
        fileManager.fileExists(atPath: targetURL.path, isDirectory: &isDir)

        return [
            "size": attributes[.size] as? UInt64 ?? 0,
            "isDirectory": isDir.boolValue,
            "isFile": !isDir.boolValue,
            "lastModified": (attributes[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0,
            "name": targetURL.lastPathComponent
        ]
    }

    public func copyFile(
        appId: String = defaultAppId,
        srcRelativePath: String,
        destRelativePath: String
    ) async throws -> Bool {
        let srcURL = try resolveTenantPath(appId: appId, relativePath: srcRelativePath)
        let destURL = try resolveTenantPath(appId: appId, relativePath: destRelativePath)

        guard fileManager.fileExists(atPath: srcURL.path) else {
            throw GoatStorageError.fileNotFound("Source file does not exist: \(srcRelativePath) (appId=\(appId))")
        }
        let destParent = destURL.deletingLastPathComponent()
        if !fileManager.fileExists(atPath: destParent.path) {
            try fileManager.createDirectory(at: destParent, withIntermediateDirectories: true, attributes: nil)
        }
        if fileManager.fileExists(atPath: destURL.path) {
            try fileManager.removeItem(at: destURL)
        }
        try fileManager.copyItem(at: srcURL, to: destURL)
        return fileManager.fileExists(atPath: destURL.path)
    }

    public func fileExists(appId: String = defaultAppId, relativePath: String) async throws -> Bool {
        let targetURL = try resolveTenantPath(appId: appId, relativePath: relativePath)
        return fileManager.fileExists(atPath: targetURL.path)
    }

    public func purgeTenantData(appId: String = defaultAppId) async throws -> Bool {
        let prefsCleared = try await clearValues(appId: appId)
        let dataDirURL = try Self.getTenantDataDirectory(baseDocumentsURL: baseDocumentsURL, appId: appId)
        var dirDeleted = true
        if fileManager.fileExists(atPath: dataDirURL.path) {
            do {
                try fileManager.removeItem(at: dataDirURL)
            } catch {
                dirDeleted = false
            }
        }
        return prefsCleared && dirDeleted
    }
}
