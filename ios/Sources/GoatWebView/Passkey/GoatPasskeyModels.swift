import Foundation

public enum PasskeyErrorCode: String, Sendable {
    case passkeyUnsupported = "PASSKEY_UNSUPPORTED"
    case userCancelled = "USER_CANCELLED"
    case noCredentialFound = "NO_CREDENTIAL_FOUND"
    case rpIdNotAllowed = "RP_ID_NOT_ALLOWED"
    case originNotAllowed = "ORIGIN_NOT_ALLOWED"
    case constraintError = "CONSTRAINT_ERROR"
    case invalidState = "INVALID_STATE"
    case invalidParameters = "INVALID_PARAMETERS"
    case vaultDecryptionFailed = "VAULT_DECRYPTION_FAILED"
    case vaultUnavailable = "VAULT_UNAVAILABLE"
    case internalError = "INTERNAL_ERROR"
}

public struct PasskeyError: LocalizedError, Sendable {
    public let code: PasskeyErrorCode
    public let detail: String

    public init(_ code: PasskeyErrorCode, _ detail: String) {
        self.code = code
        self.detail = detail
    }

    public var errorDescription: String? { "\(code.rawValue): \(detail)" }
}

public enum VaultMode {
    public static let webauthnPrf = "webauthn_prf"
    public static let hardwareSeLocal = "hardware_se_local"
    public static let hardwareKeychain = "hardware_keychain"
    public static let none = "none"
}

public struct PasskeySupportReport: Sendable {
    public let supported: Bool
    public let platformAuthenticator: Bool
    public let conditionalMediation: Bool
    public let prfSupported: Bool
    public let biometryType: String
    public let hasEnrolledBiometrics: Bool
    public let vaultMode: String

    public func toDictionary() -> [String: Any] {
        [
            "supported": supported,
            "platformAuthenticator": platformAuthenticator,
            "conditionalMediation": conditionalMediation,
            "prfSupported": prfSupported,
            "biometryType": biometryType,
            "hasEnrolledBiometrics": hasEnrolledBiometrics,
            "vaultMode": vaultMode
        ]
    }
}

/// Minimal manifest view the passkey gate needs, mirroring Android's `MiniAppManifest`.
public struct MiniAppSecurityManifest: Sendable, Equatable {
    public let appId: String
    public let allowedRpIds: [String]

    public init(appId: String, allowedRpIds: [String]) {
        self.appId = appId
        self.allowedRpIds = allowedRpIds
    }
}

/// Process-wide lookup of a loaded mini-app's security manifest, keyed by `appId`.
///
/// The bridge plugin SPI hands a plugin only an action and a payload, and a payload-supplied
/// `appId` is attacker controlled — so the tenant is resolved from the container and its
/// `allowedRpIds` come from here.
public final class GoatMiniAppManifestStore: @unchecked Sendable {

    public static let shared = GoatMiniAppManifestStore()

    private let lock = NSLock()
    private var manifests: [String: MiniAppSecurityManifest] = [:]

    public init() {}

    public func put(_ manifest: MiniAppSecurityManifest) {
        lock.lock(); defer { lock.unlock() }
        manifests[manifest.appId] = manifest
    }

    public func get(_ appId: String) -> MiniAppSecurityManifest? {
        lock.lock(); defer { lock.unlock() }
        return manifests[appId]
    }

    @discardableResult
    public func remove(_ appId: String) -> Bool {
        lock.lock(); defer { lock.unlock() }
        return manifests.removeValue(forKey: appId) != nil
    }

    public func clear() {
        lock.lock(); defer { lock.unlock() }
        manifests.removeAll()
    }

    /// Parses `security.allowedRpIds` out of a bundle `manifest.json`.
    public static func parseAllowedRpIds(from data: Data) -> [String] {
        guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [] }
        if let security = root["security"] as? [String: Any],
           let list = security["allowedRpIds"] as? [String] {
            return list
        }
        if let list = root["allowedRpIds"] as? [String] { return list }
        return []
    }
}

/// Decides whether a mini-app may run a passkey ceremony for a relying-party id.
///
/// Mini-apps share one virtual origin, so the platform's own rpId/origin check cannot separate
/// tenants: without this, any bundle could assert credentials for another tenant's rpId.
public struct RpIdValidator: Sendable {

    private let manifestLookup: @Sendable (String) -> MiniAppSecurityManifest?

    public init(manifestLookup: @escaping @Sendable (String) -> MiniAppSecurityManifest? = {
        GoatMiniAppManifestStore.shared.get($0)
    }) {
        self.manifestLookup = manifestLookup
    }

    public func validate(appId: String, rpId: String?) throws {
        guard let rpId, !rpId.trimmingCharacters(in: .whitespaces).isEmpty else {
            throw PasskeyError(.invalidParameters, "Missing rpId")
        }
        let normalized = Self.normalize(rpId)
        guard !normalized.isEmpty, !normalized.contains("/"), !normalized.contains(":") else {
            throw PasskeyError(.rpIdNotAllowed, "rpId '\(rpId)' is not a bare domain")
        }

        guard let manifest = manifestLookup(appId) else {
            throw PasskeyError(
                .rpIdNotAllowed,
                "No manifest is registered for appId '\(appId)'; passkey ceremonies are refused"
            )
        }

        let allowed = manifest.allowedRpIds.map(Self.normalize).filter { !$0.isEmpty }
        guard !allowed.isEmpty else {
            throw PasskeyError(.rpIdNotAllowed, "appId '\(appId)' declares no security.allowedRpIds")
        }
        guard allowed.contains(where: { $0 == normalized || Self.isRegistrableSuffix(normalized, $0) }) else {
            throw PasskeyError(
                .rpIdNotAllowed,
                "rpId '\(rpId)' is not declared in the manifest for appId '\(appId)'"
            )
        }
    }

    static func normalize(_ value: String) -> String {
        var v = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        while v.hasSuffix(".") { v.removeLast() }
        return v
    }

    /// W3C registrable-suffix rule: `login.shop.com` matches a declared `shop.com`, but
    /// `evilshop.com` does not, and a bare TLD never matches.
    public static func isRegistrableSuffix(_ candidate: String, _ declared: String) -> Bool {
        if candidate == declared { return true }
        guard candidate.hasSuffix("." + declared) else { return false }
        return declared.contains(".")
    }
}
