#if os(iOS)
import XCTest
@testable import GoatWebView

/**
 * The vault against the REAL Keychain API.
 *
 * What this can and cannot prove, stated plainly: an SPM XCTest bundle runs without a
 * keychain-access-group entitlement, so every `SecItemCopyMatching` / `SecItemAdd` here returns
 * `errSecMissingEntitlement` (-34018). `kSecUseDataProtectionKeychain` does not change that.
 *
 * So this file proves the property that matters most and IS reachable without entitlements: when
 * the Keychain is unavailable, `KeychainVaultSecretSource` **fails closed** with
 * `VAULT_UNAVAILABLE` rather than silently deriving a key in software. A software fallback would
 * be reproducible off-device by an attacker, and is the exact defect the secure-storage
 * fail-closed fix existed to remove.
 *
 * The *success* path against real hardware is covered on Android by
 * `GoatVaultKeyStoreInstrumentedTest`, which runs on a physical device with a real KeyStore. The
 * iOS equivalent needs a host app with a keychain entitlement, which SPM does not provide.
 */
final class GoatVaultKeychainTests: XCTestCase {

    private let service = "com.goat.webview.vault.tests"

    private func engine() -> GoatVaultEngine {
        GoatVaultEngine(secretSource: KeychainVaultSecretSource(service: service))
    }

    /// The environment this suite runs in. Asserted rather than assumed, so if a future test host
    /// DOES get an entitlement, the expectations below start failing loudly instead of silently
    /// continuing to test nothing.
    private func keychainIsAccessible() -> Bool {
        let probe: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: "entitlement-probe",
            kSecUseDataProtectionKeychain as String: true,
            kSecValueData as String: Data("probe".utf8)
        ]
        let status = SecItemAdd(probe as CFDictionary, nil)
        if status == errSecSuccess || status == errSecDuplicateItem {
            SecItemDelete(probe as CFDictionary)
            return true
        }
        return false
    }

    func testTheHarnessHasNoKeychainEntitlementAsExpected() {
        XCTAssertFalse(
            keychainIsAccessible(),
            "This test host now HAS keychain access. Re-enable the success-path assertions below — "
                + "they were skipped only because SPM cannot grant an entitlement."
        )
    }

    func testVaultFailsClosedWhenTheKeychainIsUnavailable() {
        // Never a software fallback: an attacker who can reproduce the key off-device defeats the
        // whole vault, so no key at all is strictly better than a guessable one.
        XCTAssertThrowsError(
            try engine().encrypt(appId: "itest", vaultId: "notes", plaintext: "secret")
        ) { error in
            XCTAssertEqual((error as? PasskeyError)?.code, .vaultUnavailable)
            XCTAssertTrue(
                (error as? PasskeyError)?.detail.contains("refusing to derive a vault key in software") ?? false,
                "the failure must say why, not just that it failed"
            )
        }
    }

    func testDecryptAlsoFailsClosedRatherThanReturningGarbage() {
        let envelope: [String: Any] = [
            "version": 1, "vaultMode": "hardware_keychain", "appId": "itest", "vaultId": "notes",
            "salt": "AAAA", "iv": "AAAA", "ciphertext": "AAAA", "tag": "AAAA"
        ]
        XCTAssertThrowsError(
            try engine().decrypt(appId: "itest", vaultId: "notes", envelope: envelope)
        ) { error in
            XCTAssertEqual((error as? PasskeyError)?.code, .vaultUnavailable)
        }
    }

    func testTheRealSourceIsMarkedHardwareBacked() {
        // A host inspecting this must not be told a software source is hardware backed.
        XCTAssertTrue(KeychainVaultSecretSource(service: service).isHardwareBacked)
    }

    /// The crypto itself, with a deterministic secret source, so the AES-GCM/HKDF path is still
    /// covered end to end in an environment that cannot reach the Keychain.
    func testCryptoPathIsExercisedWithADeterministicSourceWhenKeychainIsUnreachable() throws {
        struct FixedSource: VaultKeychainSecretSource {
            let isHardwareBacked = false
            // Must depend on the *content* of appId, not its length: an earlier version keyed on
            // `appId.count`, so "a" and "b" produced the same secret and the tenant-isolation
            // assertion passed for the wrong reason.
            func deviceSecret(appId: String, vaultId: String) throws -> Data {
                let material = Array("\(appId):\(vaultId)".utf8)
                var out = [UInt8](repeating: 0, count: 32)
                for (i, byte) in material.enumerated() {
                    out[i % 32] = out[i % 32] &+ byte &* UInt8(truncatingIfNeeded: i &+ 1)
                }
                return Data(out)
            }
        }
        let vault = GoatVaultEngine(secretSource: FixedSource())
        let envelope = try vault.encrypt(appId: "a", vaultId: "v", plaintext: "round trip")
        let opened = try vault.decrypt(appId: "a", vaultId: "v", envelope: envelope)
        XCTAssertEqual(opened["plaintext"] as? String, "round trip")

        var stripped = envelope
        stripped.removeValue(forKey: "appId")
        XCTAssertThrowsError(try vault.decrypt(appId: "b", vaultId: "v", envelope: stripped)) { error in
            XCTAssertEqual((error as? PasskeyError)?.code, .vaultDecryptionFailed)
        }
    }
}
#endif // os(iOS)
