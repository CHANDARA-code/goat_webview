import Foundation
import WebKit
import Security

/**
 * HTTP Basic/Digest Authentication Challenge & Encrypted Credential Manager (Task 10204 / Pillar 5).
 *
 * Securely stores HTTP authentication credentials encrypted per tenant appId, allowing
 * silent challenge resolution or explicit prompt handling.
 */
public final class GoatHttpAuthManager: @unchecked Sendable {

    public static let shared = GoatHttpAuthManager()
    public static let authKeyPrefix = "http_auth_"

    public struct HttpCredential: Codable, Equatable, Sendable {
        public let username: String
        public let password: String
        public let host: String
        public let realm: String

        public init(username: String, password: String, host: String, realm: String = "") {
            self.username = username
            self.password = password
            self.host = host
            self.realm = realm
        }
    }

    private let secureStorage: GoatSecureStorageManager
    private let lock = NSLock()
    private var memoryCache: [String: HttpCredential] = [:]
    private var knownAuthKeys: [String: Set<String>] = [:]

    public init(secureStorage: GoatSecureStorageManager = GoatSecureStorageManager()) {
        self.secureStorage = secureStorage
    }

    public func buildKey(host: String, realm: String = "") -> String {
        let cleanHost = host.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanRealm = realm.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        return "\(Self.authKeyPrefix)\(cleanHost)_\(cleanRealm)"
    }

    public func cacheKey(appId: String, host: String, realm: String = "") -> String {
        let cleanAppId = appId.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanHost = host.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanRealm = realm.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        return "\(cleanAppId):\(cleanHost):\(cleanRealm)"
    }

    /**
     * Saves HTTP authentication credentials into encrypted storage for a tenant.
     */
    @discardableResult
    public func saveCredential(
        appId: String = "default",
        host: String,
        realm: String = "",
        username: String,
        password: String
    ) async throws -> Bool {
        let cleanHost = host.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanUser = username.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanPass = password.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !cleanHost.isEmpty, !cleanUser.isEmpty, !cleanPass.isEmpty else {
            return false
        }

        let key = buildKey(host: cleanHost, realm: realm)
        let cred = HttpCredential(username: cleanUser, password: cleanPass, host: cleanHost, realm: realm)

        let encoder = JSONEncoder()
        guard let data = try? encoder.encode(cred),
              let jsonString = String(data: data, encoding: .utf8) else {
            return false
        }

        let success = try await secureStorage.setSecureValue(appId: appId, key: key, value: jsonString)
        if success {
            lock.lock()
            let cKey = cacheKey(appId: appId, host: cleanHost, realm: realm)
            memoryCache[cKey] = cred
            knownAuthKeys[appId, default: []].insert(key)
            lock.unlock()
        }
        return success
    }

    /**
     * Retrieves HTTP authentication credentials synchronously from cache or Keychain.
     */
    public func getCredential(appId: String = "default", host: String, realm: String = "") -> HttpCredential? {
        let cleanHost = host.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanRealm = realm.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let cKey = cacheKey(appId: appId, host: cleanHost, realm: cleanRealm)

        lock.lock()
        if let cached = memoryCache[cKey] {
            lock.unlock()
            return cached
        }
        // Fallback check for empty realm in cache if realm was specified
        let emptyRealmCKey = cacheKey(appId: appId, host: cleanHost, realm: "")
        if let cached = memoryCache[emptyRealmCKey] {
            lock.unlock()
            return cached
        }
        lock.unlock()

        // Fallback to synchronous Keychain retrieval
        let key = buildKey(host: cleanHost, realm: cleanRealm)
        if let cred = loadCredentialFromKeychain(appId: appId, key: key) {
            lock.lock()
            memoryCache[cKey] = cred
            knownAuthKeys[appId, default: []].insert(key)
            lock.unlock()
            return cred
        }

        if !cleanRealm.isEmpty {
            let emptyKey = buildKey(host: cleanHost, realm: "")
            if let cred = loadCredentialFromKeychain(appId: appId, key: emptyKey) {
                lock.lock()
                memoryCache[emptyRealmCKey] = cred
                knownAuthKeys[appId, default: []].insert(emptyKey)
                lock.unlock()
                return cred
            }
        }

        return nil
    }

    /**
     * Asynchronously retrieves credentials, checking memory cache, Keychain, and storage fallback.
     */
    public func getCredentialAsync(appId: String = "default", host: String, realm: String = "") async throws -> HttpCredential? {
        if let cred = getCredential(appId: appId, host: host, realm: realm) {
            return cred
        }

        let cleanHost = host.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanRealm = realm.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let key = buildKey(host: cleanHost, realm: cleanRealm)

        if let decrypted = try await secureStorage.getSecureValue(appId: appId, key: key),
           let data = decrypted.data(using: .utf8),
           let cred = try? JSONDecoder().decode(HttpCredential.self, from: data) {
            lock.lock()
            memoryCache[cacheKey(appId: appId, host: cleanHost, realm: cleanRealm)] = cred
            knownAuthKeys[appId, default: []].insert(key)
            lock.unlock()
            return cred
        }

        if !cleanRealm.isEmpty {
            let emptyKey = buildKey(host: cleanHost, realm: "")
            if let decrypted = try await secureStorage.getSecureValue(appId: appId, key: emptyKey),
               let data = decrypted.data(using: .utf8),
               let cred = try? JSONDecoder().decode(HttpCredential.self, from: data) {
                lock.lock()
                memoryCache[cacheKey(appId: appId, host: cleanHost, realm: "")] = cred
                knownAuthKeys[appId, default: []].insert(emptyKey)
                lock.unlock()
                return cred
            }
        }

        return nil
    }

    private func loadCredentialFromKeychain(appId: String, key: String) -> HttpCredential? {
        let service = (try? GoatAccountScopedSandbox.shared.getScopedServiceName(appId: appId)) ?? "goat_secure_\(appId)"
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecSuccess, let data = item as? Data,
           let cred = try? JSONDecoder().decode(HttpCredential.self, from: data) {
            return cred
        }
        return nil
    }

    /**
     * Clears all saved HTTP authentication credentials for a tenant while preserving non-auth secure keys.
     */
    @discardableResult
    public func clearCredentials(appId: String = "default") async throws -> Bool {
        lock.lock()
        let cleanAppId = appId.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let prefix = "\(cleanAppId):"
        memoryCache = memoryCache.filter { !$0.key.hasPrefix(prefix) }
        let keysToDelete = knownAuthKeys[appId] ?? []
        knownAuthKeys.removeValue(forKey: appId)
        lock.unlock()

        var allSuccess = true

        // Delete known recorded auth keys from secureStorage
        for key in keysToDelete {
            let removed = try await secureStorage.removeSecureValue(appId: appId, key: key)
            if !removed { allSuccess = false }
        }

        // Query Keychain items for this service and remove any matching http_auth_ prefix
        let service = (try? GoatAccountScopedSandbox.shared.getScopedServiceName(appId: appId)) ?? "goat_secure_\(appId)"
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecMatchLimit as String: kSecMatchLimitAll,
            kSecReturnAttributes as String: true
        ]
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecSuccess, let items = result as? [[String: Any]] {
            for item in items {
                if let account = item[kSecAttrAccount as String] as? String, account.hasPrefix(Self.authKeyPrefix) {
                    let removed = try await secureStorage.removeSecureValue(appId: appId, key: account)
                    if !removed { allSuccess = false }
                }
            }
        }

        return allSuccess
    }

    /**
     * Resolves authentication challenges from WKNavigationDelegate.
     * Returns true if the challenge was an HTTP Basic/Digest/NTLM auth challenge, false otherwise.
     */
    public func handleChallenge(
        appId: String = "default",
        challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) -> Bool {
        let authMethod = challenge.protectionSpace.authenticationMethod
        guard authMethod == NSURLAuthenticationMethodHTTPBasic ||
              authMethod == NSURLAuthenticationMethodHTTPDigest ||
              authMethod == NSURLAuthenticationMethodDefault ||
              authMethod == NSURLAuthenticationMethodNTLM ||
              authMethod == NSURLAuthenticationMethodNegotiate else {
            return false
        }

        let host = challenge.protectionSpace.host
        let realm = challenge.protectionSpace.realm ?? ""

        if let cred = getCredential(appId: appId, host: host, realm: realm) {
            let urlCred = URLCredential(user: cred.username, password: cred.password, persistence: .forSession)
            completionHandler(.useCredential, urlCred)
            return true
        }

        completionHandler(.performDefaultHandling, nil)
        return true
    }
}
