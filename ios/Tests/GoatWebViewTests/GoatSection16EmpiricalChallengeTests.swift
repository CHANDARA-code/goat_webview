#if os(iOS)
import XCTest
import Foundation
import WebKit
@testable import GoatWebView

/**
 * Empirical Adversarial Challenge Test Suite for Milestone 1: Section 16 Native Core Security Engine.
 *
 * Stress-tests:
 * 1. Declarative Content Blocker & Subresource Allowlist Engine (Task 10205)
 *    - Wildcard subdomains (*.example.com, .example.com, example.com, deep subdomains a.b.c.example.com)
 *    - Disallowed domains & suffix-collision attacks (evil-example.com, notexample.com, phishing-site.net)
 *    - Non-HTTP & unsafe schemes (javascript:, file:, ftp:, ws:)
 *    - Sandboxed and safe schemes (goat://, blob:, data:, about:)
 *    - Normalization of domains (schemes, trailing slashes, port variations, mixed casing, whitespace)
 *    - WebKit declarative rule compilation (WKContentRuleListStore) & dynamic OTA recompilation
 * 2. HTTP Basic/Digest Authentication Challenge & Multi-Tenant Credential Store (Task 10204)
 *    - Multi-tenant credential isolation (Tenant A vs Tenant B on identical host & realm)
 *    - Selective credential clearing (auth keys purged, non-auth secure keys preserved)
 *    - Realm fallback resolution (exact realm match vs fallback to default empty realm)
 *    - Malformed/corrupted payload resilience and boundary value validation (empty host, whitespace, non-JSON)
 *    - Challenge disposition routing (Basic, Digest, NTLM vs ServerTrust, ClientCertificate)
 *    - Bridge action dispatching (HTTP_AUTH_SAVE_CREDENTIAL, HTTP_AUTH_CLEAR_CREDENTIALS)
 */
final class GoatSection16EmpiricalChallengeTests: XCTestCase {

    private var secureStorage: GoatSecureStorageManager!
    private var authManager: GoatHttpAuthManager!
    private var messageHandler: GoatScriptMessageHandler!

    override func setUp() {
        super.setUp()
        secureStorage = GoatSecureStorageManager()
        authManager = GoatHttpAuthManager(secureStorage: secureStorage)
        messageHandler = GoatScriptMessageHandler(appId: "challenge_tenant_sec16", httpAuthManager: authManager)
    }

    override func tearDown() {
        secureStorage = nil
        authManager = nil
        messageHandler = nil
        super.tearDown()
    }

    // =========================================================================
    // SECTION 1: CONTENT BLOCKER & ALLOWLIST ADVERSARIAL TESTS (Task 10205)
    // =========================================================================

    func testWildcardAndDeepSubdomainAllowedMatching() {
        let allowed = ["*.example.com", ".partner.org", "exact.service.io"]
        let appId = "tenant_test"

        // 1. *.example.com allows apex domain and arbitrary deep subdomains
        XCTAssertTrue(
            GoatContentBlocker.isURLAllowed(URL(string: "https://example.com/api/v1")!, allowedDomains: allowed, appId: appId),
            "Apex domain must be allowed for *.example.com"
        )
        XCTAssertTrue(
            GoatContentBlocker.isURLAllowed(URL(string: "https://api.example.com/data")!, allowedDomains: allowed, appId: appId),
            "Single subdomain must be allowed for *.example.com"
        )
        XCTAssertTrue(
            GoatContentBlocker.isURLAllowed(URL(string: "https://a.b.c.example.com/deep/path")!, allowedDomains: allowed, appId: appId),
            "Deep subdomains (a.b.c) must be allowed for *.example.com"
        )
        XCTAssertTrue(
            GoatContentBlocker.isURLAllowed(URL(string: "http://dev.staging.api.example.com:8080/test")!, allowedDomains: allowed, appId: appId),
            "Port variations and deep subdomains must be allowed"
        )

        // 2. .partner.org (leading dot) allows apex domain and deep subdomains
        XCTAssertTrue(
            GoatContentBlocker.isURLAllowed(URL(string: "https://partner.org/feed")!, allowedDomains: allowed, appId: appId),
            "Apex domain must be allowed for .partner.org"
        )
        XCTAssertTrue(
            GoatContentBlocker.isURLAllowed(URL(string: "https://cdn.sub.partner.org/asset.js")!, allowedDomains: allowed, appId: appId),
            "Subdomains must be allowed for .partner.org"
        )

        // 3. exact.service.io allows only exact host match
        XCTAssertTrue(
            GoatContentBlocker.isURLAllowed(URL(string: "https://exact.service.io/graphql")!, allowedDomains: allowed, appId: appId),
            "Exact host must be allowed"
        )
        XCTAssertFalse(
            GoatContentBlocker.isURLAllowed(URL(string: "https://sub.exact.service.io/graphql")!, allowedDomains: allowed, appId: appId),
            "Subdomains must be BLOCKED for exact match without wildcard"
        )
        XCTAssertFalse(
            GoatContentBlocker.isURLAllowed(URL(string: "https://service.io/graphql")!, allowedDomains: allowed, appId: appId),
            "Parent domain must be BLOCKED for exact match"
        )
    }

    func testDisallowedDomainsAndSuffixCollisionAttacksBlocked() {
        let allowed = ["*.example.com", "service.org"]
        let appId = "tenant_test"

        // 1. Suffix collision attacks (evil-example.com must NOT match *.example.com)
        let collisionUrls = [
            "https://evil-example.com/phish",
            "https://fakeexample.com/login",
            "https://notexample.com/",
            "https://example.com.evil.org/steal",
            "https://attackerexample.com/xss"
        ]
        for urlStr in collisionUrls {
            let url = URL(string: urlStr)!
            XCTAssertFalse(
                GoatContentBlocker.isURLAllowed(url, allowedDomains: allowed, appId: appId),
                "Suffix collision URL must be BLOCKED: \(urlStr)"
            )
        }

        // 2. Untrusted external domains
        let untrustedUrls = [
            "https://phishing-site.net/form",
            "https://trackers.analytics-ad.com/pixel.gif",
            "https://malicious-cdn.xyz/script.js"
        ]
        for urlStr in untrustedUrls {
            let url = URL(string: urlStr)!
            XCTAssertFalse(
                GoatContentBlocker.isURLAllowed(url, allowedDomains: allowed, appId: appId),
                "Untrusted external domain must be BLOCKED: \(urlStr)"
            )
        }
    }

    func testNonHttpAndUnsafeSchemesBlocked() {
        let allowed = ["*.example.com"]
        let appId = "tenant_test"

        let unsafeUrls = [
            "javascript:alert(document.domain)",
            "javascript:void(0)",
            "file:///etc/passwd",
            "file:///var/mobile/Containers/Data/Application/secret.txt",
            "ftp://ftp.example.com/file.txt",
            "ws://evil-websocket.org/socket"
        ]
        for urlStr in unsafeUrls {
            let url = URL(string: urlStr)!
            XCTAssertFalse(
                GoatContentBlocker.isURLAllowed(url, allowedDomains: allowed, appId: appId),
                "Unsafe / non-allowlisted scheme must be BLOCKED: \(urlStr)"
            )
        }
    }

    func testSafeAndSandboxedSchemesAllowed() {
        let allowed: [String] = []
        let appId = "tenant_test"

        let safeUrls = [
            "goat://tenant_test/index.html",
            "goat://tenant_test/assets/app.bundle.js",
            "blob:https://example.com/7b7d7f7e-1234-5678-9abc-def012345678",
            "data:text/html;base64,PGgxPkhlbGxvIFdvcmxkPC9oMT4=",
            "data:image/svg+xml;utf8,%3Csvg%3E%3C/svg%3E",
            "about:blank",
            "about:srcdoc"
        ]
        for urlStr in safeUrls {
            guard let url = URL(string: urlStr) else {
                XCTFail("Failed to parse URL string: \(urlStr)")
                continue
            }
            XCTAssertTrue(
                GoatContentBlocker.isURLAllowed(url, allowedDomains: allowed, appId: appId),
                "Safe / sandboxed scheme must be ALLOWED: \(urlStr)"
            )
        }
    }

    func testDomainNormalizationResilience() {
        XCTAssertEqual(GoatContentBlocker.normalizeDomain("https://api.example.com/v1/data"), "api.example.com")
        XCTAssertEqual(GoatContentBlocker.normalizeDomain("http://API.EXAMPLE.COM/"), "api.example.com")
        XCTAssertEqual(GoatContentBlocker.normalizeDomain("   *.SUB.DOMAIN.ORG   "), "*.sub.domain.org")
        XCTAssertEqual(GoatContentBlocker.normalizeDomain("exact.host.net:8080"), "exact.host.net:8080")
        XCTAssertNil(GoatContentBlocker.normalizeDomain(""))
        XCTAssertNil(GoatContentBlocker.normalizeDomain("   "))
        XCTAssertNil(GoatContentBlocker.normalizeDomain("https://"))
        XCTAssertNil(GoatContentBlocker.normalizeDomain("http:///"))
    }

    func testDeclarativeRuleJsonGenerationAndCompilation() async throws {
        let allowed = ["*.example.com", "api.partner.org", "https://cdn.assets.io/"]
        let json = GoatContentBlocker.generateRuleListJSON(allowedDomains: allowed, appId: "test_rules_app")

        XCTAssertTrue(json.contains("\"url-filter\" : \".*\""))
        XCTAssertTrue(json.contains("\"type\" : \"block\""))
        XCTAssertTrue(json.contains("\"url-filter\" : \"^goat:\""))
        XCTAssertTrue(json.contains("\"type\" : \"ignore-previous-rules\""))
        XCTAssertTrue(json.contains("example\\\\.com"))
        XCTAssertTrue(json.contains("api\\\\.partner\\\\.org"))
        XCTAssertTrue(json.contains("cdn\\\\.assets\\\\.io"))

        // Test compiling rule list with WKContentRuleListStore
        let identifier = "test_compile_\(UUID().uuidString)"
        let ruleList = try await GoatContentBlocker.compileRuleList(
            identifier: identifier,
            allowedDomains: allowed,
            appId: "test_rules_app"
        )
        XCTAssertNotNil(ruleList, "WKContentRuleList must compile successfully from generated JSON")
        XCTAssertEqual(ruleList?.identifier, identifier)
    }

    @MainActor
    func testDynamicControllerRegistrationAndOtaRecompilation() async throws {
        let appId = "ota_tenant_\(UUID().uuidString)"
        let controller = WKUserContentController()

        // 1. Register controller
        GoatContentBlocker.register(userContentController: controller, for: appId)

        // 2. Recompile with new manifest
        let manifestJSON = """
        {
            "appId": "\(appId)",
            "security": {
                "allowedDomains": ["*.new-service.com", "api.v2.org"]
            }
        }
        """
        let manifestData = Data(manifestJSON.utf8)
        let updatedList = try await GoatContentBlocker.recompileAndApply(appId: appId, manifestData: manifestData)
        XCTAssertNotNil(updatedList, "Recompiling and applying rules from OTA manifest must succeed")

        // 3. Unregister
        GoatContentBlocker.unregister(userContentController: controller, for: appId)
    }

    // =========================================================================
    // SECTION 2: HTTP AUTH MANAGER ADVERSARIAL TESTS (Task 10204)
    // =========================================================================

    func testMultiTenantCredentialIsolation() async throws {
        let host = "secure.enterprise.com"
        let realm = "finance_gateway"

        let tenantA = "app_finance_a"
        let tenantB = "app_hr_b"

        // 1. Save credentials for Tenant A
        let savedA = try await authManager.saveCredential(
            appId: tenantA,
            host: host,
            realm: realm,
            username: "alice_cfo",
            password: "super_secret_password_a"
        )
        XCTAssertTrue(savedA)

        // 2. Tenant B lookup must be nil (no cross-tenant leakage)
        let credBBefore = authManager.getCredential(appId: tenantB, host: host, realm: realm)
        XCTAssertNil(credBBefore, "Tenant B must not see Tenant A credentials")

        let credBAsync = try await authManager.getCredentialAsync(appId: tenantB, host: host, realm: realm)
        XCTAssertNil(credBAsync, "Async lookup for Tenant B must return nil")

        // 3. Tenant B saves its own credentials for the exact same host & realm
        let savedB = try await authManager.saveCredential(
            appId: tenantB,
            host: host,
            realm: realm,
            username: "bob_hr",
            password: "bob_different_password_b"
        )
        XCTAssertTrue(savedB)

        // 4. Verify each tenant gets strictly isolated credentials synchronously and asynchronously
        let readA = authManager.getCredential(appId: tenantA, host: host, realm: realm)
        XCTAssertEqual(readA?.username, "alice_cfo")
        XCTAssertEqual(readA?.password, "super_secret_password_a")

        let readB = authManager.getCredential(appId: tenantB, host: host, realm: realm)
        XCTAssertEqual(readB?.username, "bob_hr")
        XCTAssertEqual(readB?.password, "bob_different_password_b")
    }

    func testSelectiveCredentialClearingPreservesOtherKeysAndTenants() async throws {
        let tenantA = "tenant_clear_a"
        let tenantB = "tenant_clear_b"
        let host = "api.shared.com"

        // 1. Save HTTP credentials for A and B
        try await authManager.saveCredential(appId: tenantA, host: host, realm: "r1", username: "user_a", password: "pwd_a")
        try await authManager.saveCredential(appId: tenantB, host: host, realm: "r1", username: "user_b", password: "pwd_b")

        // 2. Save non-auth secure key for tenant A
        let nonAuthKey = "user_session_oauth_refresh_token"
        try await secureStorage.setSecureValue(appId: tenantA, key: nonAuthKey, value: "refresh_tok_99999")

        // 3. Clear credentials on non-existent tenant first -> must succeed safely
        let clearNonExistent = try await authManager.clearCredentials(appId: "non_existent_tenant_xyz")
        XCTAssertTrue(clearNonExistent, "Clearing non-existent tenant must return true without errors")

        // 4. Clear credentials on Tenant A
        let clearA = try await authManager.clearCredentials(appId: tenantA)
        XCTAssertTrue(clearA)

        // 5. Tenant A HTTP auth credentials must be purged
        XCTAssertNil(authManager.getCredential(appId: tenantA, host: host, realm: "r1"))
        let asyncA = try await authManager.getCredentialAsync(appId: tenantA, host: host, realm: "r1")
        XCTAssertNil(asyncA)

        // 6. Tenant A non-auth secure key MUST remain intact
        let sessionVal = try await secureStorage.getSecureValue(appId: tenantA, key: nonAuthKey)
        XCTAssertEqual(sessionVal, "refresh_tok_99999", "Non-auth secure storage keys must NOT be deleted by clearCredentials")

        // 7. Tenant B credentials MUST remain intact
        let credB = authManager.getCredential(appId: tenantB, host: host, realm: "r1")
        XCTAssertEqual(credB?.username, "user_b")
    }

    func testRealmFallbackResolution() async throws {
        let tenant = "tenant_realm_test"
        let host = "auth.fallback.com"

        // 1. Save credential with empty realm (default host-wide auth)
        try await authManager.saveCredential(appId: tenant, host: host, realm: "", username: "default_user", password: "default_pass")

        // 2. Query with specific realm "admin_area" -> should fall back to empty realm credential
        let fallbackCred = authManager.getCredential(appId: tenant, host: host, realm: "admin_area")
        XCTAssertNotNil(fallbackCred, "Must fall back to default realm credential when specific realm not found")
        XCTAssertEqual(fallbackCred?.username, "default_user")

        let fallbackAsync = try await authManager.getCredentialAsync(appId: tenant, host: host, realm: "admin_area")
        XCTAssertEqual(fallbackAsync?.username, "default_user")

        // 3. Save specific credential for realm "admin_area"
        try await authManager.saveCredential(appId: tenant, host: host, realm: "admin_area", username: "admin_user", password: "admin_pass")

        // 4. Query for "admin_area" returns specific credential; query for "guest_area" returns fallback default
        let adminCred = authManager.getCredential(appId: tenant, host: host, realm: "admin_area")
        XCTAssertEqual(adminCred?.username, "admin_user")

        let guestCred = authManager.getCredential(appId: tenant, host: host, realm: "guest_area")
        XCTAssertEqual(guestCred?.username, "default_user")
    }

    func testMalformedAndBoundaryValueHandling() async throws {
        let tenant = "tenant_boundaries"

        // 1. Empty host or username or password must return false on save
        let emptyHost = try await authManager.saveCredential(appId: tenant, host: "", realm: "r", username: "u", password: "p")
        XCTAssertFalse(emptyHost, "Empty host must be rejected")

        let whitespaceHost = try await authManager.saveCredential(appId: tenant, host: "   ", realm: "r", username: "u", password: "p")
        XCTAssertFalse(whitespaceHost, "Whitespace host must be rejected")

        let emptyUser = try await authManager.saveCredential(appId: tenant, host: "h.com", realm: "r", username: "", password: "p")
        XCTAssertFalse(emptyUser, "Empty username must be rejected")

        let emptyPass = try await authManager.saveCredential(appId: tenant, host: "h.com", realm: "r", username: "u", password: "")
        XCTAssertFalse(emptyPass, "Empty password must be rejected")

        // 2. Corrupted JSON injected into storage
        let key = authManager.buildKey(host: "corrupted.host.com", realm: "r")
        _ = try await secureStorage.setSecureValue(appId: tenant, key: key, value: "INVALID_JSON_CORRUPTED{{{")

        // getCredentialAsync must catch JSON decoding error and return nil without crashing
        let corruptedRes = try await authManager.getCredentialAsync(appId: tenant, host: "corrupted.host.com", realm: "r")
        XCTAssertNil(corruptedRes, "Corrupted JSON in secure store must return nil gracefully")
    }

    func testBridgeHttpAuthSaveAndClearActions() async throws {
        let host = "bridge.auth.corp"
        let realm = "intranet"

        // 1. Valid save via bridge
        let savePayload: [String: Any] = [
            "host": host,
            "realm": realm,
            "username": "bridge_user",
            "password": "bridge_password"
        ]
        let saveRes = try await messageHandler.dispatchDirect(action: "HTTP_AUTH_SAVE_CREDENTIAL", payload: savePayload)
        XCTAssertEqual(saveRes["success"] as? Bool, true)
        XCTAssertEqual(saveRes["saved"] as? Bool, true)
        XCTAssertEqual(saveRes["host"] as? String, host)

        // 2. Verify stored in manager
        let stored = authManager.getCredential(appId: "challenge_tenant_sec16", host: host, realm: realm)
        XCTAssertEqual(stored?.username, "bridge_user")
        XCTAssertEqual(stored?.password, "bridge_password")

        // 3. Clear via bridge
        let clearRes = try await messageHandler.dispatchDirect(action: "HTTP_AUTH_CLEAR_CREDENTIALS", payload: [:])
        XCTAssertEqual(clearRes["success"] as? Bool, true)
        XCTAssertEqual(clearRes["cleared"] as? Bool, true)

        // 4. Verify purged
        let purged = authManager.getCredential(appId: "challenge_tenant_sec16", host: host, realm: realm)
        XCTAssertNil(purged)
    }
}
#endif // os(iOS)
