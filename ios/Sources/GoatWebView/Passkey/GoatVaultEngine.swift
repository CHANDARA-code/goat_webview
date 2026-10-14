import Foundation
#if canImport(CryptoKit)
import CryptoKit
#endif

/// Source of the device-bound secret that anchors every vault key.
///
/// Split out so derivation is unit-testable without the Keychain/Secure Enclave, and so a host can
/// supply a different hardware root. The production implementation has no software fallback: if the
/// Keychain is unavailable the vault fails closed rather than silently downgrading to a key an
/// attacker could reproduce off-device.
public protocol VaultKeychainSecretSource: Sendable {
    func deviceSecret(appId: String, vaultId: String) throws -> Data
    var isHardwareBacked: Bool { get }
}

/// Evaluates the CTAP2 PRF (`hmac-secret`) for a vault salt, strictly inside native memory.
///
/// Unregistered by default: the platform only exposes PRF through a real passkey ceremony on
/// iOS 18+, and inventing bytes here would produce vaults that look encrypted but are anchored to
/// nothing. With no evaluator the vault is still real AES-256-GCM anchored to a Keychain secret,
/// tagged `hardware_keychain` so the mode is never ambiguous.
public protocol VaultPrfEvaluator: Sendable {
    func evaluate(appId: String, vaultId: String, salt: Data) throws -> Data
}

@available(macOS 10.15, iOS 15, tvOS 13, watchOS 6, *)
public struct KeychainVaultSecretSource: VaultKeychainSecretSource {

    public let isHardwareBacked = true
    private let service: String

    public init(service: String = "com.goat.webview.vault") {
        self.service = service
    }

    public func deviceSecret(appId: String, vaultId: String) throws -> Data {
        let root = try loadOrCreateRootSecret(appId: appId)
        #if canImport(CryptoKit)
        let mac = HMAC<SHA256>.authenticationCode(
            for: Data("goat-vault:\(appId):\(vaultId)".utf8),
            using: SymmetricKey(data: root)
        )
        return Data(mac)
        #else
        throw PasskeyError(.vaultUnavailable, "CryptoKit is unavailable on this platform")
        #endif
    }

    private func loadOrCreateRootSecret(appId: String) throws -> Data {
        let account = "vault-root-\(appId)"
        // kSecUseDataProtectionKeychain selects the iOS-style data-protection keychain rather than
        // the legacy file-based one; Apple recommends it for consistent behaviour across iOS and
        // macOS/Catalyst. It does NOT grant access to an unentitled process — an SPM XCTest bundle
        // still gets errSecMissingEntitlement (-34018), which is why GoatVaultKeychainTests can
        // only prove the fail-closed path here.
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecUseDataProtectionKeychain as String: true,
            kSecReturnData as String: true
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecSuccess, let data = item as? Data, data.count == 32 {
            return data
        }
        guard status == errSecItemNotFound else {
            throw PasskeyError(.vaultUnavailable, "Keychain is unavailable (OSStatus \(status)); refusing to derive a vault key in software")
        }

        var fresh = Data(count: 32)
        let generated = fresh.withUnsafeMutableBytes { buffer -> Int32 in
            guard let base = buffer.baseAddress else { return errSecParam }
            return SecRandomCopyBytes(kSecRandomDefault, 32, base)
        }
        guard generated == errSecSuccess else {
            throw PasskeyError(.vaultUnavailable, "Secure random generation failed")
        }

        query.removeValue(forKey: kSecReturnData as String)
        query[kSecValueData as String] = fresh
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let addStatus = SecItemAdd(query as CFDictionary, nil)
        guard addStatus == errSecSuccess || addStatus == errSecDuplicateItem else {
            throw PasskeyError(.vaultUnavailable, "Could not persist the vault root secret (OSStatus \(addStatus))")
        }
        return fresh
    }
}

/// Hardware-anchored AES-256-GCM vault.
///
/// `VaultKey = HKDF-SHA256(IKM = prfOutput ?? deviceSecret, salt = deviceSecret XOR clientSalt,
/// info = "goat-vault-v1")`. Mixing the Keychain secret into the salt is what makes an off-device
/// PRF evaluation insufficient on its own. Only ciphertext or plaintext crosses the bridge.
@available(macOS 10.15, iOS 15, tvOS 13, watchOS 6, *)
public struct GoatVaultEngine: Sendable {

    public static let envelopeVersion = 1
    private static let hkdfInfo = Data("goat-vault-v1".utf8)
    private static let saltBytes = 32
    private static let keyBytes = 32

    private let secretSource: VaultKeychainSecretSource
    private let prfEvaluator: VaultPrfEvaluator?

    public init(secretSource: VaultKeychainSecretSource, prfEvaluator: VaultPrfEvaluator? = nil) {
        self.secretSource = secretSource
        self.prfEvaluator = prfEvaluator
    }

    public func encrypt(appId: String, vaultId: String, plaintext: String) throws -> [String: Any] {
        #if canImport(CryptoKit)
        let clientSalt = try Self.randomBytes(Self.saltBytes)
        let prf = try prfEvaluator?.evaluate(appId: appId, vaultId: vaultId, salt: clientSalt)
        let key = try deriveKey(appId: appId, vaultId: vaultId, clientSalt: clientSalt, prf: prf)

        let sealed = try AES.GCM.seal(Data(plaintext.utf8), using: SymmetricKey(data: key))
        guard let nonce = sealed.nonce.withUnsafeBytes({ Data($0) }) as Data? else {
            throw PasskeyError(.internalError, "Could not read the AES-GCM nonce")
        }

        return [
            "version": Self.envelopeVersion,
            "vaultMode": prf != nil ? VaultMode.webauthnPrf : VaultMode.hardwareKeychain,
            "appId": appId,
            "vaultId": vaultId,
            "salt": Self.base64Url(clientSalt),
            "iv": Self.base64Url(nonce),
            "ciphertext": Self.base64Url(sealed.ciphertext),
            "tag": Self.base64Url(sealed.tag)
        ]
        #else
        throw PasskeyError(.vaultUnavailable, "CryptoKit is unavailable on this platform")
        #endif
    }

    public func decrypt(appId: String, vaultId: String, envelope: [String: Any]) throws -> [String: Any] {
        #if canImport(CryptoKit)
        if let storedAppId = envelope["appId"] as? String, storedAppId != appId {
            throw PasskeyError(.vaultDecryptionFailed, "Envelope belongs to a different mini-app tenant")
        }
        if let storedVaultId = envelope["vaultId"] as? String, storedVaultId != vaultId {
            throw PasskeyError(.vaultDecryptionFailed, "Envelope belongs to a different vault")
        }

        let clientSalt = try Self.decodeField(envelope, "salt")
        let iv = try Self.decodeField(envelope, "iv")
        let ciphertext = try Self.decodeField(envelope, "ciphertext")
        let tag = try Self.decodeField(envelope, "tag")
        let mode = (envelope["vaultMode"] as? String) ?? VaultMode.hardwareKeychain

        var prf: Data?
        if mode == VaultMode.webauthnPrf {
            guard let evaluator = prfEvaluator else {
                throw PasskeyError(
                    .vaultDecryptionFailed,
                    "Envelope was sealed with a WebAuthn PRF key but no PRF evaluator is registered"
                )
            }
            prf = try evaluator.evaluate(appId: appId, vaultId: vaultId, salt: clientSalt)
        }

        let key = try deriveKey(appId: appId, vaultId: vaultId, clientSalt: clientSalt, prf: prf)
        do {
            let box = try AES.GCM.SealedBox(nonce: AES.GCM.Nonce(data: iv), ciphertext: ciphertext, tag: tag)
            let opened = try AES.GCM.open(box, using: SymmetricKey(data: key))
            guard let text = String(data: opened, encoding: .utf8) else {
                throw PasskeyError(.vaultDecryptionFailed, "Decrypted payload is not valid UTF-8")
            }
            return ["plaintext": text]
        } catch let error as PasskeyError {
            throw error
        } catch {
            throw PasskeyError(.vaultDecryptionFailed, "Authentication tag verification failed")
        }
        #else
        throw PasskeyError(.vaultUnavailable, "CryptoKit is unavailable on this platform")
        #endif
    }

    private func deriveKey(appId: String, vaultId: String, clientSalt: Data, prf: Data?) throws -> Data {
        #if canImport(CryptoKit)
        let deviceSecret = try secretSource.deviceSecret(appId: appId, vaultId: vaultId)
        let salt = Self.xor(deviceSecret, clientSalt)
        let ikm = prf ?? deviceSecret
        let derived = HKDF<SHA256>.deriveKey(
            inputKeyMaterial: SymmetricKey(data: ikm),
            salt: salt,
            info: Self.hkdfInfo,
            outputByteCount: Self.keyBytes
        )
        return derived.withUnsafeBytes { Data($0) }
        #else
        throw PasskeyError(.vaultUnavailable, "CryptoKit is unavailable on this platform")
        #endif
    }

    static func xor(_ a: Data, _ b: Data) -> Data {
        let size = max(a.count, b.count)
        var out = Data(count: size)
        for i in 0..<size {
            let left = i < a.count ? a[a.startIndex + i] : 0
            let right = i < b.count ? b[b.startIndex + i] : 0
            out[i] = left ^ right
        }
        return out
    }

    static func randomBytes(_ count: Int) throws -> Data {
        var data = Data(count: count)
        let status = data.withUnsafeMutableBytes { buffer -> Int32 in
            guard let base = buffer.baseAddress else { return errSecParam }
            return SecRandomCopyBytes(kSecRandomDefault, count, base)
        }
        guard status == errSecSuccess else {
            throw PasskeyError(.internalError, "Secure random generation failed")
        }
        return data
    }

    static func base64Url(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    static func decodeBase64Url(_ value: String) -> Data? {
        var s = value.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while s.count % 4 != 0 { s += "=" }
        return Data(base64Encoded: s)
    }

    private static func decodeField(_ envelope: [String: Any], _ key: String) throws -> Data {
        guard let value = envelope[key] as? String, !value.isEmpty else {
            throw PasskeyError(.invalidParameters, "Envelope is missing '\(key)'")
        }
        guard let decoded = decodeBase64Url(value) else {
            throw PasskeyError(.invalidParameters, "Envelope field '\(key)' is not Base64URL")
        }
        return decoded
    }
}
