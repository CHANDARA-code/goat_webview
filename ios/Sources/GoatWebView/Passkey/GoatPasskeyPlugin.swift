import Foundation
#if canImport(LocalAuthentication)
import LocalAuthentication
#endif

/// W3C WebAuthn passkeys and the hardware vault, as a `GoatBridgePlugin`.
///
/// Two invariants this type exists to hold:
///  - the calling mini-app may only touch relying-party ids its signed manifest declares
///    (`RpIdValidator`), because every tenant shares one virtual origin; and
///  - `clientExtensionResults.prf` is stripped from every response, so the vault master key never
///    reaches page JavaScript. The vault is reachable only through VAULT_ENCRYPT / VAULT_DECRYPT,
///    which derive and use the key entirely in native memory.
public final class GoatPasskeyPlugin: GoatBridgePlugin, @unchecked Sendable {

    public static let defaultAppId = "default"

    public let pluginId = "passkey"

    public let supportedActions = [
        "PASSKEY_CHECK_SUPPORT",
        "CHECK_PASSKEY_SUPPORT",
        "PASSKEY_REGISTER",
        "REGISTER_CREDENTIAL",
        "PASSKEY_ASSERT",
        "ASSERT_CREDENTIAL",
        "VAULT_ENCRYPT",
        "VAULT_DECRYPT"
    ]

    private let appIdProvider: @Sendable () -> String
    private let engine: PasskeyCeremonyEngine?
    private let rpIdValidator: RpIdValidator
    private let vaultEngine: GoatVaultEngine

    public init(
        appIdProvider: @escaping @Sendable () -> String = { GoatPasskeyPlugin.defaultAppId },
        engine: PasskeyCeremonyEngine? = GoatPasskeyPlugin.defaultEngine(),
        rpIdValidator: RpIdValidator = RpIdValidator(),
        vaultEngine: GoatVaultEngine = GoatVaultEngine(secretSource: KeychainVaultSecretSource())
    ) {
        self.appIdProvider = appIdProvider
        self.engine = engine
        self.rpIdValidator = rpIdValidator
        self.vaultEngine = vaultEngine
    }

    public static func defaultEngine() -> PasskeyCeremonyEngine? {
        #if canImport(AuthenticationServices) && os(iOS)
        if #available(iOS 16.0, *) { return AuthenticationServicesCeremonyEngine() }
        #endif
        return nil
    }

    public func execute(action: String, payload: [String: Any]) async throws -> [String: Any] {
        switch action {
        case "PASSKEY_CHECK_SUPPORT", "CHECK_PASSKEY_SUPPORT":
            return checkSupport().toDictionary()
        case "PASSKEY_REGISTER", "REGISTER_CREDENTIAL":
            return try await register(payload)
        case "PASSKEY_ASSERT", "ASSERT_CREDENTIAL":
            return try await assertCredential(payload)
        case "VAULT_ENCRYPT":
            return try encryptVault(payload)
        case "VAULT_DECRYPT":
            return try decryptVault(payload)
        default:
            throw PasskeyError(.invalidParameters, "Unsupported passkey action: \(action)")
        }
    }

    public func checkSupport() -> PasskeySupportReport {
        var hasHardware = false
        var hasEnrolled = false
        var biometryType = "none"

        #if canImport(LocalAuthentication)
        let context = LAContext()
        var error: NSError?
        hasEnrolled = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        hasHardware = hasEnrolled || error?.code == LAError.biometryNotEnrolled.rawValue
        if hasHardware {
            switch context.biometryType {
            case .faceID: biometryType = "faceID"
            case .touchID: biometryType = "touchID"
            default:
                if #available(iOS 17.0, *), context.biometryType == .opticID {
                    biometryType = "opticID"
                } else {
                    biometryType = "none"
                }
            }
        }
        #endif

        let platformAuthenticator: Bool
        var prfSupported = false
        #if os(iOS)
        if #available(iOS 16.0, *) {
            platformAuthenticator = hasHardware && engine != nil
        } else {
            platformAuthenticator = false
        }
        // The CTAP2 PRF extension only exists from iOS 18; below that the vault falls back to a
        // device-local Keychain-anchored key, which does not sync via iCloud Keychain.
        if #available(iOS 18.0, *) { prfSupported = platformAuthenticator }
        #else
        platformAuthenticator = false
        #endif

        return PasskeySupportReport(
            supported: platformAuthenticator && hasEnrolled,
            platformAuthenticator: platformAuthenticator,
            conditionalMediation: false,
            prfSupported: prfSupported,
            biometryType: biometryType,
            hasEnrolledBiometrics: hasEnrolled,
            vaultMode: hasHardware ? VaultMode.hardwareKeychain : VaultMode.none
        )
    }

    private func register(_ payload: [String: Any]) async throws -> [String: Any] {
        let appId = appIdProvider()
        guard let optionsJson = payload["optionsJson"] as? String, !optionsJson.isEmpty else {
            throw PasskeyError(.invalidParameters, "Missing optionsJson")
        }
        let rpId = (payload["rpId"] as? String) ?? Self.rpId(fromOptions: optionsJson, key: "rp")
        try rpIdValidator.validate(appId: appId, rpId: rpId)

        guard let engine else {
            throw PasskeyError(.passkeyUnsupported, "No platform authenticator is available on this device")
        }
        return Self.sanitize(try Self.parse(await engine.register(optionsJson: optionsJson)))
    }

    private func assertCredential(_ payload: [String: Any]) async throws -> [String: Any] {
        let appId = appIdProvider()
        guard let optionsJson = payload["optionsJson"] as? String, !optionsJson.isEmpty else {
            throw PasskeyError(.invalidParameters, "Missing optionsJson")
        }
        let rpId = (payload["rpId"] as? String) ?? Self.rpId(fromOptions: optionsJson, key: "rpId")
        try rpIdValidator.validate(appId: appId, rpId: rpId)

        guard let engine else {
            throw PasskeyError(.passkeyUnsupported, "No platform authenticator is available on this device")
        }
        return Self.sanitize(try Self.parse(await engine.assert(optionsJson: optionsJson)))
    }

    private func encryptVault(_ payload: [String: Any]) throws -> [String: Any] {
        guard let vaultId = payload["vaultId"] as? String, !vaultId.isEmpty else {
            throw PasskeyError(.invalidParameters, "Missing vaultId")
        }
        guard let plaintext = payload["plaintext"] as? String else {
            throw PasskeyError(.invalidParameters, "Missing plaintext")
        }
        return try vaultEngine.encrypt(appId: appIdProvider(), vaultId: vaultId, plaintext: plaintext)
    }

    private func decryptVault(_ payload: [String: Any]) throws -> [String: Any] {
        guard let vaultId = payload["vaultId"] as? String, !vaultId.isEmpty else {
            throw PasskeyError(.invalidParameters, "Missing vaultId")
        }
        guard let envelope = payload["envelope"] as? [String: Any] else {
            throw PasskeyError(.invalidParameters, "Missing envelope")
        }
        return try vaultEngine.decrypt(appId: appIdProvider(), vaultId: vaultId, envelope: envelope)
    }

    /// Strips the CTAP2 PRF evaluation output before the response leaves native memory. Returning
    /// it would hand any script in the WebView the vault master key.
    static func sanitize(_ response: [String: Any]) -> [String: Any] {
        var out = response
        if var ext = out["clientExtensionResults"] as? [String: Any] {
            ext.removeValue(forKey: "prf")
            ext.removeValue(forKey: "hmacGetSecret")
            ext.removeValue(forKey: "hmac-secret")
            out["clientExtensionResults"] = ext
        }
        return out
    }

    static func parse(_ raw: String) throws -> [String: Any] {
        guard let data = raw.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw PasskeyError(.internalError, "Authenticator returned malformed JSON")
        }
        return object
    }

    static func rpId(fromOptions optionsJson: String, key: String) -> String? {
        guard let data = optionsJson.data(using: .utf8),
              let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        if key == "rp" { return (root["rp"] as? [String: Any])?["id"] as? String }
        return root[key] as? String
    }
}
