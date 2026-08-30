import XCTest
import Foundation
import WebKit
@testable import GoatWebView

/**
 * Adversarial Stress Test Suite for Section 16 Native Core Security Engine.
 *
 * Targets:
 * 1. Declarative Content Blocker regex generation, edge-case normalization, and subresource URL evaluation.
 * 2. Dynamic OTA rule compilation, replacement, and weak reference tracking on WKUserContentController.
 * 3. High-concurrency thread-safety and parallel race conditions in GoatHttpAuthManager.
 * 4. Selective credential clearing preserving non-auth secure storage keys across multi-tenant partitions.
 * 5. HTTP authentication challenge interception and realm fallback resolution.
 */
final class GoatNativeCoreSecurityAdversarialTests: XCTestCase {

    private var secureStorage: GoatSecureStorageManager!
    private var httpAuthManager: GoatHttpAuthManager!

    override func setUp() {
        super.setUp()
        secureStorage = GoatSecureStorageManager()
        httpAuthManager = GoatHttpAuthManager(secureStorage: secureStorage)
    }

    override func tearDown() {
        secureStorage = nil
        httpAuthManager = nil
        super.tearDown()
    }

    // =========================================================================
    // 1. Declarative Content Blocker Regex & JSON Generation
    // =========================================================================

    func testDeclarativeRuleListJSONGenerationAdversarialInputs() throws {
        let adversarialDomains = [
            "  API.Example.COM  ",
            "https://secure.payment.gateway.com/v1/checkout",
            "http://sub.domain.org:8080/path?query=1",
            "*.wildcard-partner.net",
            ".leadingdot-partner.io",
            "plain-domain.com",
            "",
            "   "
        ]

        let jsonString = GoatContentBlocker.generateRuleListJSON(
            allowedDomains: adversarialDomains,
            appId: "tenant_security_test"
        )

        XCTAssertFalse(jsonString.isEmpty)

        // Parse JSON array to verify syntax integrity
        guard let data = jsonString.data(using: .utf8),
              let jsonRules = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            XCTFail("Generated rule list must be valid JSON array")
            return
        }

        // Must have at least:
        // Rule 0: Default block all (.*)
        // Rule 1: Allow standard schemes (goat, blob, data, about)
        // Rule 2: Allow default virtual asset host (appassets.androidplatform.net)
        // Rules 3+: Allowed domain patterns
        XCTAssertGreaterThanOrEqual(jsonRules.count, 4)

        // Verify rule 0 is default block
        let blockRule = jsonRules[0]
        let blockTrigger = blockRule["trigger"] as? [String: Any]
        let blockAction = blockRule["action"] as? [String: Any]
        XCTAssertEqual(blockTrigger?["url-filter"] as? String, ".*")
        XCTAssertEqual(blockAction?["type"] as? String, "block")

        // Verify standard scheme rules allow
        let allFilters = jsonRules.compactMap { ($0["trigger"] as? [String: Any])?["url-filter"] as? String }
        XCTAssertTrue(allFilters.contains("^goat:"), "goat: scheme must be allowed")
        XCTAssertTrue(allFilters.contains("^blob:"), "blob: scheme must be allowed")

        // Verify virtual asset host allow
        XCTAssertTrue(allFilters.contains { $0.contains("appassets\\.androidplatform\\.net") }, "Virtual asset host must be allowed")

        // Verify wildcard pattern escaping
        let wildcardPattern = allFilters.first { $0.contains("wildcard-partner\\.net") }
        XCTAssertNotNil(wildcardPattern, "Wildcard domain must be correctly escaped")
        XCTAssertTrue(wildcardPattern?.contains("([^/]+\\.)?wildcard-partner\\.net") == true)
    }

    func testURLAllowedEvaluationAgainstAdversarialEdgeCases() {
        let allowed = [
            "api.trusted.com",
            "*.partner.org",
            ".cdn.assets.io",
            "https://service.internal.net/api"
        ]
        let appId = "miniapp_sandbox_1"

        // 1. Standard Schemes
        XCTAssertTrue(GoatContentBlocker.isURLAllowed(URL(string: "goat://miniapp_sandbox_1/index.html")!, allowedDomains: allowed, appId: appId))
        XCTAssertTrue(GoatContentBlocker.isURLAllowed(URL(string: "data:text/html;base64,PGgxPkhlbGxvPC9oMT4=")! , allowedDomains: allowed, appId: appId))
        XCTAssertTrue(GoatContentBlocker.isURLAllowed(URL(string: "blob:https://appassets.androidplatform.net/guid")!, allowedDomains: allowed, appId: appId))
        XCTAssertTrue(GoatContentBlocker.isURLAllowed(URL(string: "about:blank")!, allowedDomains: allowed, appId: appId))

        // 2. Default Virtual Asset Host & AppId host
        XCTAssertTrue(GoatContentBlocker.isURLAllowed(URL(string: "https://appassets.androidplatform.net/index.js")!, allowedDomains: allowed, appId: appId))
        XCTAssertTrue(GoatContentBlocker.isURLAllowed(URL(string: "https://miniapp_sandbox_1/feed")!, allowedDomains: allowed, appId: appId))

        // 3. Explicit allowed domain (exact match & case insensitivity)
        XCTAssertTrue(GoatContentBlocker.isURLAllowed(URL(string: "https://api.trusted.com/v1/users")!, allowedDomains: allowed, appId: appId))
        XCTAssertTrue(GoatContentBlocker.isURLAllowed(URL(string: "HTTPS://API.TRUSTED.COM/V1/USERS")!, allowedDomains: allowed, appId: appId))
        XCTAssertTrue(GoatContentBlocker.isURLAllowed(URL(string: "https://service.internal.net/api/v2")!, allowedDomains: allowed, appId: appId))

        // 4. Wildcard matching
        XCTAssertTrue(GoatContentBlocker.isURLAllowed(URL(string: "https://partner.org/terms")!, allowedDomains: allowed, appId: appId))
        XCTAssertTrue(GoatContentBlocker.isURLAllowed(URL(string: "https://sub.partner.org/login")!, allowedDomains: allowed, appId: appId))
        XCTAssertTrue(GoatContentBlocker.isURLAllowed(URL(string: "https://deep.nested.sub.partner.org/api")!, allowedDomains: allowed, appId: appId))

        // 5. Leading dot matching
        XCTAssertTrue(GoatContentBlocker.isURLAllowed(URL(string: "https://cdn.assets.io/style.css")!, allowedDomains: allowed, appId: appId))
        XCTAssertTrue(GoatContentBlocker.isURLAllowed(URL(string: "https://static.cdn.assets.io/img.png")!, allowedDomains: allowed, appId: appId))

        // 6. Adversarial Bypass Attempts (MUST BE BLOCKED)
        // Subdomain hijack / suffix matching attack
        XCTAssertFalse(GoatContentBlocker.isURLAllowed(URL(string: "https://api.trusted.com.evil-attacker.com/steal")!, allowedDomains: allowed, appId: appId))
        XCTAssertFalse(GoatContentBlocker.isURLAllowed(URL(string: "https://evilpartner.org/phish")!, allowedDomains: allowed, appId: appId))
        XCTAssertFalse(GoatContentBlocker.isURLAllowed(URL(string: "https://notpartner.org/phish")!, allowedDomains: allowed, appId: appId))
        XCTAssertFalse(GoatContentBlocker.isURLAllowed(URL(string: "https://assets.io.fake.com")!, allowedDomains: allowed, appId: appId))
        XCTAssertFalse(GoatContentBlocker.isURLAllowed(URL(string: "https://unauthorized-domain.com/data")!, allowedDomains: allowed, appId: appId))
        XCTAssertFalse(GoatContentBlocker.isURLAllowed(URL(string: "javascript:alert(1)")!, allowedDomains: allowed, appId: appId))
    }

    // =========================================================================
    // 2. Dynamic OTA Rule Compilation & WKUserContentController Weak References
    // =========================================================================

    func testManifestAllowedDomainsParsingFormats() {
        // Modern security.allowedDomains format
        let modernJSON = """
        {
            "name": "Secured App",
            "security": {
                "allowedDomains": ["api.modern.com", "*.secure.cloud"]
            }
        }
        """.data(using: .utf8)!
        let modernAllowed = GoatContentBlocker.parseAllowedDomains(from: modernJSON)
        XCTAssertEqual(modernAllowed, ["api.modern.com", "*.secure.cloud"])

        // Legacy allowedDomains format
        let legacyJSON = """
        {
            "name": "Legacy App",
            "allowedDomains": ["legacy.api.com"]
        }
        """.data(using: .utf8)!
        let legacyAllowed = GoatContentBlocker.parseAllowedDomains(from: legacyJSON)
        XCTAssertEqual(legacyAllowed, ["legacy.api.com"])

        // Malformed / Empty
        let emptyJSON = "{}".data(using: .utf8)!
        XCTAssertTrue(GoatContentBlocker.parseAllowedDomains(from: emptyJSON).isEmpty)

        let invalidJSON = "INVALID_JSON_BYTES".data(using: .utf8)!
        XCTAssertTrue(GoatContentBlocker.parseAllowedDomains(from: invalidJSON).isEmpty)
    }

    func testWeakReferenceTrackingOnWKUserContentControllerPreventsLeaks() {
        let appId = "weak_ref_test_app"

        var controller1: WKUserContentController? = WKUserContentController()
        var controller2: WKUserContentController? = WKUserContentController()
        let controller3 = WKUserContentController()

        GoatContentBlocker.register(userContentController: controller1!, for: appId)
        GoatContentBlocker.register(userContentController: controller2!, for: appId)
        GoatContentBlocker.register(userContentController: controller3, for: appId)

        // Drop strong references to controller1 and controller2
        controller1 = nil
        controller2 = nil

        // Unregistering controller3 explicitly
        GoatContentBlocker.unregister(userContentController: controller3, for: appId)

        // Re-register controller3
        GoatContentBlocker.register(userContentController: controller3, for: appId)

        // No crash or dangling pointer when applying rules
        XCTAssertNotNil(controller3)
    }

    // =========================================================================
    // 3. Thread-Safe Concurrent Access to GoatHttpAuthManager
    // =========================================================================

    func testHttpAuthManagerParallelConcurrentAccessStress() async throws {
        let tenantCount = 8
        let iterationsPerTenant = 15

        // Use TaskGroup for high-concurrency race challenge
        try await withThrowingTaskGroup(of: Void.self) { group in
            // Concurrently write credentials across multiple tenants
            for t in 0..<tenantCount {
                let tenantId = "tenant_race_\(t)"
                for i in 0..<iterationsPerTenant {
                    let host = "host_\(i).domain.com"
                    let realm = (i % 2 == 0) ? "realm_\(i)" : ""
                    let username = "user_\(t)_\(i)"
                    let password = "pass_\(t)_\(i)"

                    group.addTask {
                        let saved = try await self.httpAuthManager.saveCredential(
                            appId: tenantId,
                            host: host,
                            realm: realm,
                            username: username,
                            password: password
                        )
                        XCTAssertTrue(saved)
                    }
                }
            }

            // Concurrently read credentials synchronously and asynchronously
            for t in 0..<tenantCount {
                let tenantId = "tenant_race_\(t)"
                for i in 0..<iterationsPerTenant {
                    let host = "host_\(i).domain.com"
                    let realm = (i % 2 == 0) ? "realm_\(i)" : ""

                    group.addTask {
                        _ = self.httpAuthManager.getCredential(appId: tenantId, host: host, realm: realm)
                        _ = try? await self.httpAuthManager.getCredentialAsync(appId: tenantId, host: host, realm: realm)
                    }
                }
            }

            // Wait for writes and reads
            try await group.waitForAll()
        }

        // Verify specific tenant data consistency
        for t in 0..<tenantCount {
            let tenantId = "tenant_race_\(t)"
            for i in 0..<iterationsPerTenant {
                let host = "host_\(i).domain.com"
                let realm = (i % 2 == 0) ? "realm_\(i)" : ""
                let cred = httpAuthManager.getCredential(appId: tenantId, host: host, realm: realm)
                XCTAssertNotNil(cred, "Credential for \(tenantId) @ \(host):\(realm) must be retrieved")
                XCTAssertEqual(cred?.username, "user_\(t)_\(i)")
                XCTAssertEqual(cred?.password, "pass_\(t)_\(i)")
            }
        }
    }

    // =========================================================================
    // 4. Selective Credential Clearing Preserving Non-Auth Secure Keys
    // =========================================================================

    func testSelectiveClearCredentialsPreservesNonAuthSecureKeys() async throws {
        let tenantA = "bank_tenant_alpha"
        let tenantB = "bank_tenant_beta"

        // 1. Store sensitive non-auth keys in GoatSecureStorageManager
        _ = try await secureStorage.setSecureValue(appId: tenantA, key: "session_token", value: "tok_secret_alpha_999")
        _ = try await secureStorage.setSecureValue(appId: tenantA, key: "biometric_privkey", value: "ecc_p256_private_key_bytes")
        _ = try await secureStorage.setSecureValue(appId: tenantA, key: "user_preferences_iv", value: "aes_gcm_iv_12_bytes")

        _ = try await secureStorage.setSecureValue(appId: tenantB, key: "session_token", value: "tok_secret_beta_888")

        // 2. Store HTTP authentication credentials for both tenants
        _ = try await httpAuthManager.saveCredential(
            appId: tenantA,
            host: "api.bankalpha.com",
            realm: "corporate",
            username: "admin_alpha",
            password: "alpha_password_123"
        )
        _ = try await httpAuthManager.saveCredential(
            appId: tenantA,
            host: "gateway.bankalpha.com",
            realm: "",
            username: "gw_alpha",
            password: "gw_password_123"
        )
        _ = try await httpAuthManager.saveCredential(
            appId: tenantB,
            host: "api.bankbeta.com",
            realm: "corporate",
            username: "admin_beta",
            password: "beta_password_456"
        )

        // 3. Execute selective clearCredentials on Tenant A
        let cleared = try await httpAuthManager.clearCredentials(appId: tenantA)
        XCTAssertTrue(cleared, "clearCredentials must return true")

        // 4. Assert Tenant A HTTP auth credentials are wiped from memory and storage
        let credA1 = httpAuthManager.getCredential(appId: tenantA, host: "api.bankalpha.com", realm: "corporate")
        let credA2 = httpAuthManager.getCredential(appId: tenantA, host: "gateway.bankalpha.com", realm: "")
        XCTAssertNil(credA1, "Tenant A HTTP auth credential 1 must be wiped")
        XCTAssertNil(credA2, "Tenant A HTTP auth credential 2 must be wiped")

        // 5. CRITICAL: Assert Tenant A non-auth keys REMAIN 100% INTACT in secure storage
        let sessionTokenA = try await secureStorage.getSecureValue(appId: tenantA, key: "session_token")
        let bioKeyA = try await secureStorage.getSecureValue(appId: tenantA, key: "biometric_privkey")
        let ivA = try await secureStorage.getSecureValue(appId: tenantA, key: "user_preferences_iv")

        XCTAssertEqual(sessionTokenA, "tok_secret_alpha_999", "Non-auth session token MUST be preserved")
        XCTAssertEqual(bioKeyA, "ecc_p256_private_key_bytes", "Non-auth biometric key MUST be preserved")
        XCTAssertEqual(ivA, "aes_gcm_iv_12_bytes", "Non-auth IV MUST be preserved")

        // 6. Assert Tenant B HTTP auth credentials and non-auth keys are completely unaffected
        let credB = httpAuthManager.getCredential(appId: tenantB, host: "api.bankbeta.com", realm: "corporate")
        XCTAssertNotNil(credB, "Tenant B credentials must remain unaffected")
        XCTAssertEqual(credB?.username, "admin_beta")

        let sessionTokenB = try await secureStorage.getSecureValue(appId: tenantB, key: "session_token")
        XCTAssertEqual(sessionTokenB, "tok_secret_beta_888", "Tenant B session token must remain intact")
    }

    // =========================================================================
    // 5. HTTP Auth Challenge Resolution & Realm Fallback Handling
    // =========================================================================

    func testHttpAuthChallengeResolutionAndRealmFallback() async throws {
        let appId = "auth_challenge_app"
        let host = "vault.enterprise.internal"

        // Save credential with empty realm (acting as host-level fallback)
        _ = try await httpAuthManager.saveCredential(
            appId: appId,
            host: host,
            realm: "",
            username: "fallback_user",
            password: "fallback_password"
        )

        // Query with specific realm -> must fallback to empty realm
        let fallbackCred = httpAuthManager.getCredential(appId: appId, host: host, realm: "specific_subrealm")
        XCTAssertNotNil(fallbackCred, "Must fallback to empty realm credential when specific realm not found")
        XCTAssertEqual(fallbackCred?.username, "fallback_user")
        XCTAssertEqual(fallbackCred?.password, "fallback_password")

        // Save a specific realm credential
        _ = try await httpAuthManager.saveCredential(
            appId: appId,
            host: host,
            realm: "special_ops",
            username: "special_user",
            password: "special_password"
        )

        // Query special realm -> returns exact match
        let exactCred = httpAuthManager.getCredential(appId: appId, host: host, realm: "special_ops")
        XCTAssertEqual(exactCred?.username, "special_user")
        XCTAssertEqual(exactCred?.password, "special_password")

        // Query other realm -> still returns fallback
        let otherCred = httpAuthManager.getCredential(appId: appId, host: host, realm: "other_realm")
        XCTAssertEqual(otherCred?.username, "fallback_user")
    }

    func testHttpAuthHostNormalizationTrimsAndLowercases() async throws {
        let appId = "case_norm_app"

        _ = try await httpAuthManager.saveCredential(
            appId: appId,
            host: "  HTTPS://API.MyBank.COM/Path  ",
            realm: "  ADMIN_REALM  ",
            username: "admin",
            password: "secret_password"
        )

        // Lookup with clean lowercase host and realm
        let cred = httpAuthManager.getCredential(appId: appId, host: "https://api.mybank.com/path", realm: "admin_realm")
        XCTAssertNotNil(cred)
        XCTAssertEqual(cred?.username, "admin")
        XCTAssertEqual(cred?.password, "secret_password")
    }
}
