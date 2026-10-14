#if os(iOS)
import XCTest
@testable import GoatWebView

private let prfMasterKey = "TUFTVEVSS0VZX0RPX05PVF9MRUFL"

private let registrationJSON = """
{"id":"cred-1","rawId":"cred-1","type":"public-key",
 "response":{"clientDataJSON":"Y2Q","attestationObject":"YW8","publicKey":"cGs"},
 "clientExtensionResults":{"credProps":{"rk":true},"prf":{"enabled":true,"results":{"first":"\(prfMasterKey)"}}}}
"""

private let assertionJSON = """
{"id":"cred-1","rawId":"cred-1","type":"public-key",
 "response":{"clientDataJSON":"Y2Q","authenticatorData":"YWQ","signature":"c2ln"},
 "clientExtensionResults":{"prf":{"results":{"first":"\(prfMasterKey)"}}}}
"""

private final class FakeCeremonyEngine: PasskeyCeremonyEngine, @unchecked Sendable {
    var registerJSON: String
    var assertJSON: String
    var failWith: PasskeyError?

    init(registerJSON: String = registrationJSON, assertJSON: String = assertionJSON, failWith: PasskeyError? = nil) {
        self.registerJSON = registerJSON
        self.assertJSON = assertJSON
        self.failWith = failWith
    }

    func register(optionsJson: String) async throws -> String {
        if let failWith { throw failWith }
        return registerJSON
    }

    func assert(optionsJson: String) async throws -> String {
        if let failWith { throw failWith }
        return assertJSON
    }
}

/// Deterministic stand-in for the Keychain-held root secret, which needs a real device.
private struct FakeSecretSource: VaultKeychainSecretSource {
    let isHardwareBacked = false
    let seed: String

    init(seed: String = "device") { self.seed = seed }

    func deviceSecret(appId: String, vaultId: String) throws -> Data {
        var hash = Data()
        let material = Array("\(seed):\(appId):\(vaultId)".utf8)
        for i in 0..<32 {
            var byte: UInt8 = UInt8(truncatingIfNeeded: i &* 31)
            for b in material { byte = byte &+ b &* UInt8(truncatingIfNeeded: i &+ 7) }
            hash.append(byte)
        }
        return hash
    }
}

private struct FailingSecretSource: VaultKeychainSecretSource {
    let isHardwareBacked = true
    func deviceSecret(appId: String, vaultId: String) throws -> Data {
        throw PasskeyError(.vaultUnavailable, "Keychain unavailable")
    }
}

final class GoatPasskeyTests: XCTestCase {

    private func manifest(_ rpIds: [String] = ["shop.superapp.com"]) -> MiniAppSecurityManifest {
        MiniAppSecurityManifest(appId: "com.merchant.shop", allowedRpIds: rpIds)
    }

    private func plugin(
        engine: PasskeyCeremonyEngine = FakeCeremonyEngine(),
        manifest: MiniAppSecurityManifest? = nil,
        appId: String = "com.merchant.shop",
        secretSource: VaultKeychainSecretSource = FakeSecretSource()
    ) -> GoatPasskeyPlugin {
        let resolved = manifest ?? self.manifest()
        return GoatPasskeyPlugin(
            appIdProvider: { appId },
            engine: engine,
            rpIdValidator: RpIdValidator { candidate in candidate == resolved.appId ? resolved : nil },
            vaultEngine: GoatVaultEngine(secretSource: secretSource)
        )
    }

    private func code(_ error: Error) -> PasskeyErrorCode? { (error as? PasskeyError)?.code }

    // MARK: - Surface

    func testPluginIdentityAndActionSurface() {
        let p = plugin()
        XCTAssertEqual(p.pluginId, "passkey")
        for action in ["PASSKEY_CHECK_SUPPORT", "CHECK_PASSKEY_SUPPORT", "PASSKEY_REGISTER",
                       "REGISTER_CREDENTIAL", "PASSKEY_ASSERT", "ASSERT_CREDENTIAL",
                       "VAULT_ENCRYPT", "VAULT_DECRYPT"] {
            XCTAssertTrue(p.canHandle(action: action), "\(action) not handled")
        }
        XCTAssertFalse(p.canHandle(action: "BIOMETRIC_AUTH"))
    }

    func testCheckSupportReportsTheFullCapabilityShape() async throws {
        let res = try await plugin().execute(action: "PASSKEY_CHECK_SUPPORT", payload: [:])
        for key in ["supported", "platformAuthenticator", "prfSupported", "biometryType",
                    "hasEnrolledBiometrics", "vaultMode"] {
            XCTAssertNotNil(res[key], "\(key) missing from support report")
        }
        XCTAssertEqual(res["conditionalMediation"] as? Bool, false)
    }

    // MARK: - Vector 5: the PRF master key must never leave native memory

    func testRegisterScrubsPrfFromClientExtensionResults() async throws {
        let res = try await plugin().execute(action: "PASSKEY_REGISTER", payload: [
            "optionsJson": #"{"rp":{"id":"shop.superapp.com"}}"#,
            "rpId": "shop.superapp.com"
        ])
        let serialized = String(describing: res)
        XCTAssertFalse(serialized.contains(prfMasterKey), "PRF master key leaked to the WebView")

        let ext = res["clientExtensionResults"] as? [String: Any]
        XCTAssertNil(ext?["prf"], "prf survived sanitization")
        XCTAssertNotNil(ext?["credProps"], "unrelated extensions must survive")
    }

    func testAssertScrubsPrfFromClientExtensionResults() async throws {
        let res = try await plugin().execute(action: "PASSKEY_ASSERT", payload: [
            "optionsJson": #"{"rpId":"shop.superapp.com"}"#,
            "rpId": "shop.superapp.com"
        ])
        XCTAssertFalse(String(describing: res).contains(prfMasterKey))
        XCTAssertNil((res["clientExtensionResults"] as? [String: Any])?["prf"])
    }

    func testSanitizeStripsEveryPrfAliasButKeepsOtherFields() {
        let out = GoatPasskeyPlugin.sanitize([
            "id": "x",
            "clientExtensionResults": [
                "prf": ["a": 1], "hmacGetSecret": ["b": 2], "credProps": ["rk": true], "appid": true
            ]
        ])
        let ext = out["clientExtensionResults"] as? [String: Any]
        XCTAssertNil(ext?["prf"])
        XCTAssertNil(ext?["hmacGetSecret"])
        XCTAssertNotNil(ext?["credProps"])
        XCTAssertNotNil(ext?["appid"])
        XCTAssertEqual(out["id"] as? String, "x")
    }

    // MARK: - RP ID gate

    func testRejectsRpIdNotDeclaredInManifest() async {
        do {
            _ = try await plugin().execute(action: "PASSKEY_ASSERT", payload: [
                "optionsJson": #"{"rpId":"evil.com"}"#, "rpId": "evil.com"
            ])
            XCTFail("Expected RP_ID_NOT_ALLOWED")
        } catch {
            XCTAssertEqual(code(error), .rpIdNotAllowed)
        }
    }

    func testRejectsWhenManifestIsUnknown() async {
        let p = GoatPasskeyPlugin(
            appIdProvider: { "com.unknown.app" },
            engine: FakeCeremonyEngine(),
            rpIdValidator: RpIdValidator { _ in nil },
            vaultEngine: GoatVaultEngine(secretSource: FakeSecretSource())
        )
        do {
            _ = try await p.execute(action: "PASSKEY_REGISTER", payload: [
                "optionsJson": #"{"rp":{"id":"shop.superapp.com"}}"#, "rpId": "shop.superapp.com"
            ])
            XCTFail("Expected RP_ID_NOT_ALLOWED")
        } catch {
            XCTAssertEqual(code(error), .rpIdNotAllowed)
        }
    }

    func testRejectsWhenManifestDeclaresNoRpIds() async {
        do {
            _ = try await plugin(manifest: manifest([])).execute(action: "PASSKEY_REGISTER", payload: [
                "optionsJson": #"{"rp":{"id":"shop.superapp.com"}}"#, "rpId": "shop.superapp.com"
            ])
            XCTFail("Expected RP_ID_NOT_ALLOWED")
        } catch {
            XCTAssertEqual(code(error), .rpIdNotAllowed)
        }
    }

    func testPayloadAppIdCannotOverrideTheContainerTenant() async {
        let p = plugin(appId: "com.attacker.app", secretSource: FakeSecretSource())
        do {
            _ = try await p.execute(action: "PASSKEY_ASSERT", payload: [
                "appId": "com.merchant.shop",
                "optionsJson": #"{"rpId":"shop.superapp.com"}"#,
                "rpId": "shop.superapp.com"
            ])
            XCTFail("Expected RP_ID_NOT_ALLOWED")
        } catch {
            XCTAssertEqual(code(error), .rpIdNotAllowed)
        }
    }

    func testAcceptsRegistrableSubdomainSuffix() async throws {
        let res = try await plugin(manifest: manifest(["superapp.com"]))
            .execute(action: "PASSKEY_ASSERT", payload: [
                "optionsJson": #"{"rpId":"login.superapp.com"}"#, "rpId": "login.superapp.com"
            ])
        XCTAssertEqual(res["id"] as? String, "cred-1")
    }

    func testRejectsLookalikeDomainThatMerelySharesASuffixString() {
        XCTAssertFalse(RpIdValidator.isRegistrableSuffix("evilshop.com", "shop.com"))
        XCTAssertTrue(RpIdValidator.isRegistrableSuffix("login.shop.com", "shop.com"))
        XCTAssertFalse(RpIdValidator.isRegistrableSuffix("evil.com", "com"), "a bare TLD is never a registrable suffix")
    }

    func testManifestParsingReadsSecurityAllowedRpIds() {
        let json = #"{"appId":"a","security":{"allowedRpIds":["shop.superapp.com","superapp.com"]}}"#
        let parsed = GoatMiniAppManifestStore.parseAllowedRpIds(from: Data(json.utf8))
        XCTAssertEqual(parsed, ["shop.superapp.com", "superapp.com"])
        XCTAssertEqual(GoatMiniAppManifestStore.parseAllowedRpIds(from: Data("{}".utf8)), [])
    }

    // MARK: - Errors

    func testUserCancellationMapsToUserCancelled() async {
        let engine = FakeCeremonyEngine(failWith: PasskeyError(.userCancelled, "dismissed"))
        do {
            _ = try await plugin(engine: engine).execute(action: "PASSKEY_ASSERT", payload: [
                "optionsJson": #"{"rpId":"shop.superapp.com"}"#, "rpId": "shop.superapp.com"
            ])
            XCTFail("Expected USER_CANCELLED")
        } catch {
            XCTAssertEqual(code(error), .userCancelled)
        }
    }

    func testMissingOptionsJsonIsRejected() async {
        do {
            _ = try await plugin().execute(action: "PASSKEY_REGISTER", payload: ["rpId": "shop.superapp.com"])
            XCTFail("Expected INVALID_PARAMETERS")
        } catch {
            XCTAssertEqual(code(error), .invalidParameters)
        }
    }

    func testMalformedAuthenticatorJsonIsRejected() async {
        let engine = FakeCeremonyEngine(assertJSON: "not json")
        do {
            _ = try await plugin(engine: engine).execute(action: "PASSKEY_ASSERT", payload: [
                "optionsJson": #"{"rpId":"shop.superapp.com"}"#, "rpId": "shop.superapp.com"
            ])
            XCTFail("Expected INTERNAL_ERROR")
        } catch {
            XCTAssertEqual(code(error), .internalError)
        }
    }

    func testUnsupportedActionIsRejected() async {
        do {
            _ = try await plugin().execute(action: "NOT_A_PASSKEY_ACTION", payload: [:])
            XCTFail("Expected INVALID_PARAMETERS")
        } catch {
            XCTAssertEqual(code(error), .invalidParameters)
        }
    }

    // MARK: - Vault: real AES-256-GCM

    func testVaultRoundTripsThroughRealAesGcm() async throws {
        let p = plugin()
        let envelope = try await p.execute(action: "VAULT_ENCRYPT", payload: [
            "vaultId": "notes", "plaintext": "the launch codes"
        ])
        XCTAssertEqual(envelope["version"] as? Int, 1)
        XCTAssertEqual(envelope["vaultMode"] as? String, "hardware_keychain")
        XCTAssertFalse(String(describing: envelope).contains("the launch codes"))

        let opened = try await p.execute(action: "VAULT_DECRYPT", payload: [
            "vaultId": "notes", "envelope": envelope
        ])
        XCTAssertEqual(opened["plaintext"] as? String, "the launch codes")
    }

    func testVaultProducesAFreshIvAndSaltEveryTime() async throws {
        let p = plugin()
        let a = try await p.execute(action: "VAULT_ENCRYPT", payload: ["vaultId": "v", "plaintext": "same"])
        let b = try await p.execute(action: "VAULT_ENCRYPT", payload: ["vaultId": "v", "plaintext": "same"])
        XCTAssertNotEqual(a["iv"] as? String, b["iv"] as? String, "IV reuse under AES-GCM is catastrophic")
        XCTAssertNotEqual(a["salt"] as? String, b["salt"] as? String)
        XCTAssertNotEqual(a["ciphertext"] as? String, b["ciphertext"] as? String)
    }

    func testVaultRejectsATamperedCiphertext() async throws {
        let p = plugin()
        var envelope = try await p.execute(action: "VAULT_ENCRYPT", payload: [
            "vaultId": "notes", "plaintext": "secret"
        ])
        let original = envelope["ciphertext"] as! String
        envelope["ciphertext"] = "AAAA" + original.dropFirst(4)

        do {
            _ = try await p.execute(action: "VAULT_DECRYPT", payload: ["vaultId": "notes", "envelope": envelope])
            XCTFail("Expected VAULT_DECRYPTION_FAILED")
        } catch {
            XCTAssertEqual(code(error), .vaultDecryptionFailed)
        }
    }

    func testVaultOfOneTenantCannotBeOpenedByAnother() async throws {
        let victim = plugin(appId: "com.merchant.shop")
        let envelope = try await victim.execute(action: "VAULT_ENCRYPT", payload: [
            "vaultId": "notes", "plaintext": "tenant secret"
        ])
        let attacker = plugin(appId: "com.attacker.app")
        do {
            _ = try await attacker.execute(action: "VAULT_DECRYPT", payload: [
                "vaultId": "notes", "envelope": envelope
            ])
            XCTFail("another tenant must not decrypt this envelope")
        } catch {
            XCTAssertEqual(code(error), .vaultDecryptionFailed)
        }
    }

    func testVaultFailsClosedWhenTheKeychainIsUnavailable() async {
        do {
            _ = try await plugin(secretSource: FailingSecretSource())
                .execute(action: "VAULT_ENCRYPT", payload: ["vaultId": "notes", "plaintext": "secret"])
            XCTFail("a Keychain failure must not downgrade to a software key")
        } catch {
            XCTAssertEqual(code(error), .vaultUnavailable)
        }
    }

    func testVaultRejectsAnEnvelopeSealedUnderPrfWhenNoEvaluatorIsRegistered() async throws {
        let p = plugin()
        var envelope = try await p.execute(action: "VAULT_ENCRYPT", payload: [
            "vaultId": "notes", "plaintext": "x"
        ])
        envelope["vaultMode"] = "webauthn_prf"
        do {
            _ = try await p.execute(action: "VAULT_DECRYPT", payload: ["vaultId": "notes", "envelope": envelope])
            XCTFail("Expected VAULT_DECRYPTION_FAILED")
        } catch {
            XCTAssertEqual(code(error), .vaultDecryptionFailed)
        }
    }

    func testVaultRejectsMissingArguments() async {
        let p = plugin()
        do {
            _ = try await p.execute(action: "VAULT_ENCRYPT", payload: ["vaultId": "v"])
            XCTFail("Expected INVALID_PARAMETERS")
        } catch {
            XCTAssertEqual(code(error), .invalidParameters)
        }
        do {
            _ = try await p.execute(action: "VAULT_DECRYPT", payload: ["vaultId": "v"])
            XCTFail("Expected INVALID_PARAMETERS")
        } catch {
            XCTAssertEqual(code(error), .invalidParameters)
        }
    }

    // MARK: - Cross-platform parity with Android

    func testVaultEnvelopeShapeMatchesAndroid() async throws {
        let envelope = try await plugin().execute(action: "VAULT_ENCRYPT", payload: [
            "vaultId": "notes", "plaintext": "x"
        ])
        for key in ["version", "vaultMode", "appId", "vaultId", "salt", "iv", "ciphertext", "tag"] {
            XCTAssertNotNil(envelope[key], "VAULT_ENCRYPT must return '\(key)' on both platforms")
        }
    }
}
#endif // os(iOS)
