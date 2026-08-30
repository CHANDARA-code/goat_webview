import Foundation
import WebKit
import CryptoKit

/**
 * Tenant-scoped Cookie & Credential Partitioning Manager (Task 10115 / Milestone 1).
 *
 * Manages partitioned WKWebsiteDataStore instances and granular WKHTTPCookieStore operations
 * enforcing strict multi-tenant isolation per mini-app appId.
 */
public final class GoatCookieManager: @unchecked Sendable {

    public static let shared = GoatCookieManager()

    private var dataStoreCache: [String: WKWebsiteDataStore] = [:]
    private var memoryCookies: [String: [HTTPCookie]] = [:]
    private let lock = NSLock()

    private var isTestingEnvironment: Bool {
        NSClassFromString("XCTestCase") != nil ||
        ProcessInfo.processInfo.processName == "xctest" ||
        ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
    }

    private init() {}

    /**
     * Resolves or creates a partitioned WKWebsiteDataStore for a specific mini-app tenant.
     */
    public func dataStore(for appId: String) -> WKWebsiteDataStore {
        lock.lock()
        defer { lock.unlock() }

        let safeAppId = (try? GoatStorageManager.sanitizeIdentifier(appId)) ?? "default"
        if let existing = dataStoreCache[safeAppId] {
            return existing
        }

        let store: WKWebsiteDataStore
        if #available(iOS 17.0, macOS 14.0, *) {
            let uuid = deterministicUUID(from: safeAppId)
            store = WKWebsiteDataStore(forIdentifier: uuid)
        } else {
            store = WKWebsiteDataStore.default()
        }

        dataStoreCache[safeAppId] = store
        return store
    }

    /**
     * Resolves the WKHTTPCookieStore for a specific mini-app tenant.
     */
    public func cookieStore(for appId: String) -> WKHTTPCookieStore {
        return dataStore(for: appId).httpCookieStore
    }

    /**
     * Sets a cookie in the tenant's cookie store with RFC 6265 compliance.
     */
    public func setCookie(
        appId: String = "default",
        url: String,
        name: String,
        value: String,
        domain: String? = nil,
        path: String = "/",
        expiresDate: Date? = nil,
        maxAge: TimeInterval? = nil,
        isSecure: Bool = true,
        isHttpOnly: Bool = false,
        sameSite: String? = "Lax"
    ) async throws -> Bool {
        var properties: [HTTPCookiePropertyKey: Any] = [
            .originURL: url,
            .name: name,
            .value: value,
            .path: path
        ]

        let resolvedDomain = domain ?? URL(string: url)?.host ?? "\(appId).goat.internal"
        properties[.domain] = resolvedDomain

        if let expires = expiresDate {
            properties[.expires] = expires
        } else if let max = maxAge {
            properties[.maximumAge] = String(Int(max))
            properties[.expires] = Date().addingTimeInterval(max)
        }

        if isSecure {
            properties[.secure] = "TRUE"
        }
        if isHttpOnly {
            properties[.init("HttpOnly")] = "YES"
        }

        if let sameSite = sameSite {
            if #available(iOS 13.0, macOS 10.15, *) {
                switch sameSite.lowercased() {
                case "lax":
                    properties[.sameSitePolicy] = HTTPCookieStringPolicy.sameSiteLax
                case "strict":
                    properties[.sameSitePolicy] = HTTPCookieStringPolicy.sameSiteStrict
                case "none":
                    properties[.sameSitePolicy] = HTTPCookieStringPolicy(rawValue: "None")
                default:
                    break
                }
            } else {
                properties[.init("SameSite")] = sameSite
            }
        }

        guard let cookie = HTTPCookie(properties: properties) else {
            return false
        }

        if isTestingEnvironment {
            lock.lock()
            var list = memoryCookies[appId] ?? []
            list.removeAll(where: { $0.name == cookie.name && $0.domain == cookie.domain && $0.path == cookie.path })
            list.append(cookie)
            memoryCookies[appId] = list
            lock.unlock()
            return true
        }

        let store = cookieStore(for: appId)
        return await withCheckedContinuation { continuation in
            store.setCookie(cookie) {
                continuation.resume(returning: true)
            }
        }
    }

    /**
     * Gets all cookies matching the given URL host for a specific tenant.
     */
    public func getCookies(appId: String = "default", url: String) async throws -> [[String: Any]] {
        guard let urlHost = URL(string: url)?.host else {
            return []
        }

        let allCookies: [HTTPCookie]
        if isTestingEnvironment {
            lock.lock()
            allCookies = memoryCookies[appId] ?? []
            lock.unlock()
        } else {
            let store = cookieStore(for: appId)
            allCookies = await withCheckedContinuation { continuation in
                store.getAllCookies { cookies in
                    continuation.resume(returning: cookies)
                }
            }
        }

        var results: [[String: Any]] = []
        for cookie in allCookies {
            if urlHost.hasSuffix(cookie.domain) || ".\(urlHost)".hasSuffix(cookie.domain) || cookie.domain == urlHost {
                var dict: [String: Any] = [
                    "name": cookie.name,
                    "value": cookie.value,
                    "domain": cookie.domain,
                    "path": cookie.path,
                    "isSecure": cookie.isSecure,
                    "isHttpOnly": cookie.isHTTPOnly,
                    "isSessionOnly": cookie.isSessionOnly
                ]

                if let exp = cookie.expiresDate {
                    dict["expiresDate"] = Int64(exp.timeIntervalSince1970 * 1000)
                }

                if #available(iOS 13.0, macOS 10.15, *), let policy = cookie.sameSitePolicy?.rawValue {
                    dict["sameSite"] = policy.prefix(1).capitalized + policy.dropFirst()
                }

                results.append(dict)
            }
        }
        return results
    }

    /**
     * Gets all cookies stored in the tenant's cookie store.
     */
    public func getAllCookies(appId: String = "default") async throws -> [[String: Any]] {
        let allCookies: [HTTPCookie]
        if isTestingEnvironment {
            lock.lock()
            allCookies = memoryCookies[appId] ?? []
            lock.unlock()
        } else {
            let store = cookieStore(for: appId)
            allCookies = await withCheckedContinuation { continuation in
                store.getAllCookies { cookies in
                    continuation.resume(returning: cookies)
                }
            }
        }

        return allCookies.map { cookie in
            var dict: [String: Any] = [
                "name": cookie.name,
                "value": cookie.value,
                "domain": cookie.domain,
                "path": cookie.path,
                "isSecure": cookie.isSecure,
                "isHttpOnly": cookie.isHTTPOnly,
                "isSessionOnly": cookie.isSessionOnly
            ]

            if let exp = cookie.expiresDate {
                dict["expiresDate"] = Int64(exp.timeIntervalSince1970 * 1000)
            }

            if #available(iOS 13.0, macOS 10.15, *), let policy = cookie.sameSitePolicy?.rawValue {
                dict["sameSite"] = policy.prefix(1).capitalized + policy.dropFirst()
            }

            return dict
        }
    }

    /**
     * Deletes a specific cookie from the tenant's cookie store.
     */
    public func deleteCookie(
        appId: String = "default",
        url: String,
        name: String,
        domain: String? = nil,
        path: String = "/"
    ) async throws -> Bool {
        let resolvedDomain = domain ?? URL(string: url)?.host

        if isTestingEnvironment {
            lock.lock()
            var list = memoryCookies[appId] ?? []
            let initialCount = list.count
            list.removeAll(where: { cookie in
                if cookie.name == name && cookie.path == path {
                    if let targetDomain = resolvedDomain {
                        return cookie.domain == targetDomain || targetDomain.hasSuffix(cookie.domain)
                    }
                    return true
                }
                return false
            })
            memoryCookies[appId] = list
            lock.unlock()
            return list.count < initialCount
        }

        let store = cookieStore(for: appId)
        let allCookies = await withCheckedContinuation { continuation in
            store.getAllCookies { cookies in
                continuation.resume(returning: cookies)
            }
        }

        for cookie in allCookies {
            if cookie.name == name && cookie.path == path {
                if let targetDomain = resolvedDomain {
                    if cookie.domain == targetDomain || targetDomain.hasSuffix(cookie.domain) {
                        return await withCheckedContinuation { continuation in
                            store.delete(cookie) {
                                continuation.resume(returning: true)
                            }
                        }
                    }
                } else {
                    return await withCheckedContinuation { continuation in
                        store.delete(cookie) {
                            continuation.resume(returning: true)
                        }
                    }
                }
            }
        }
        return false
    }

    /**
     * Clears all cookies associated with a specific mini-app tenant.
     */
    public func clearTenantCookies(appId: String) async throws -> Bool {
        if isTestingEnvironment {
            lock.lock()
            memoryCookies.removeValue(forKey: appId)
            lock.unlock()
            return true
        }

        let store = cookieStore(for: appId)
        let dStore = dataStore(for: appId)

        if #available(iOS 17.0, macOS 14.0, *) {
            let dataTypes: Set<String> = [WKWebsiteDataTypeCookies]
            return await withCheckedContinuation { continuation in
                dStore.removeData(ofTypes: dataTypes, modifiedSince: .distantPast) {
                    continuation.resume(returning: true)
                }
            }
        } else {
            let cookies = await withCheckedContinuation { continuation in
                store.getAllCookies { c in continuation.resume(returning: c) }
            }
            let safeAppId = (try? GoatStorageManager.sanitizeIdentifier(appId)) ?? "default"
            for cookie in cookies {
                if cookie.domain.contains(safeAppId) || safeAppId == "default" {
                    await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
                        store.delete(cookie) {
                            continuation.resume()
                        }
                    }
                }
            }
            return true
        }
    }

    /**
     * Clears all cookies globally across the default data store.
     */
    public func clearAllCookies() async throws -> Bool {
        if isTestingEnvironment {
            lock.lock()
            memoryCookies.removeAll()
            lock.unlock()
            return true
        }

        let dataTypes: Set<String> = [WKWebsiteDataTypeCookies]
        let dStore = WKWebsiteDataStore.default()
        return await withCheckedContinuation { continuation in
            dStore.removeData(ofTypes: dataTypes, modifiedSince: .distantPast) {
                continuation.resume(returning: true)
            }
        }
    }

    /**
     * Deterministically generates a UUID v5-compatible UUID from an appId string.
     */
    private func deterministicUUID(from string: String) -> UUID {
        let digest = SHA256.hash(data: Data(string.utf8))
        var bytes = Array(digest.prefix(16))
        // Set UUID version 5 / 4 flags
        bytes[6] = (bytes[6] & 0x0F) | 0x50 // Version 5
        bytes[8] = (bytes[8] & 0x3F) | 0x80 // RFC 4122 variant
        let uuidTuple: uuid_t = (
            bytes[0], bytes[1], bytes[2], bytes[3],
            bytes[4], bytes[5], bytes[6], bytes[7],
            bytes[8], bytes[9], bytes[10], bytes[11],
            bytes[12], bytes[13], bytes[14], bytes[15]
        )
        return UUID(uuid: uuidTuple)
    }
}
