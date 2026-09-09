package com.goat.webview

import android.net.Uri
import com.goat.webview.auth.GoatHttpAuthManager
import com.goat.webview.security.GoatContentBlocker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Empirical Adversarial Challenge Test Suite for Milestone 1: Section 16 Native Core Security Engine (Android).
 *
 * Stress-tests:
 * 1. Declarative Content Blocker & Subresource Allowlist Engine (Task 10205)
 *    - Wildcard subdomains (*.example.com, .example.com, example.com, deep subdomains a.b.c.example.com)
 *    - Disallowed domains & suffix-collision attacks (evil-example.com, notexample.com, phishing-site.net)
 *    - Non-HTTP & unsafe schemes (javascript:, file:, ftp:, ws:)
 *    - Sandboxed and safe schemes (goat://, blob:, data:, about:)
 *    - Domain normalization (mixed case, leading/trailing whitespace, port variations)
 * 2. HTTP Basic/Digest Authentication Challenge & Multi-Tenant Credential Store (Task 10204)
 *    - Multi-tenant credential isolation (Tenant A vs Tenant B on identical host & realm)
 *    - Selective credential clearing (auth keys purged, non-auth secure keys preserved)
 *    - Clearing credentials on non-existent tenants
 *    - Malformed/corrupted payload resilience and boundary values (empty host, whitespace, non-JSON)
 *    - Bridge action dispatching (HTTP_AUTH_SAVE_CREDENTIAL, HTTP_AUTH_CLEAR_CREDENTIALS)
 */
@OptIn(ExperimentalCoroutinesApi::class)
class GoatSection16EmpiricalChallengeTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private lateinit var fakeContext: FakeTestContext
    private lateinit var secureStorage: GoatSecureStorageManager
    private lateinit var httpAuthManager: GoatHttpAuthManager
    private lateinit var bridgeHandler: GoatBridgeActionHandler

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        fakeContext = FakeTestContext()
        secureStorage = GoatSecureStorageManager(fakeContext, testDispatcher)
        httpAuthManager = GoatHttpAuthManager(fakeContext, secureStorage, testDispatcher)
        bridgeHandler = GoatBridgeActionHandler(
            context = fakeContext,
            appId = "challenge_android_sec16",
            secureStorageManager = secureStorage,
            httpAuthManager = httpAuthManager
        )
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // =========================================================================
    // SECTION 1: CONTENT BLOCKER ADVERSARIAL TESTS (Task 10205)
    // =========================================================================

    @Test
    fun `test compiled allowlist matches the per-call path exactly`() {
        // isUriAllowed() runs per subresource request, so the hot caller pre-compiles the
        // allowlist instead of re-normalising it on every call. That is only a safe optimisation
        // if the compiled form decides identically -- including the cases this suite already
        // treats as security-critical: wildcards, leading-dot patterns, exact-only hosts, suffix
        // collisions, mixed case and untrimmed entries.
        val allowed = setOf("*.Example.com ", ".partner.org", "exact.service.io", "PLAIN.io")
        val tenantDomain = "Tenant1.appassets.androidplatform.net"
        val compiled = GoatContentBlocker.compile(allowed, tenantDomain)

        val urls = listOf(
            "https://example.com/api",
            "https://a.b.example.com/deep",
            "https://partner.org/feed",
            "https://cdn.partner.org/x.js",
            "https://exact.service.io/gql",
            "https://sub.exact.service.io/gql",
            "https://service.io/gql",
            "https://plain.io/a",
            "https://sub.plain.io/a",
            "https://notexample.com/evil",
            "https://example.com.evil.com/evil",
            "https://tenant1.appassets.androidplatform.net/assets/app.js",
            "https://appassets.androidplatform.net/assets/main.css",
            "blob:https://tenant1.appassets.androidplatform.net/xyz",
            "data:image/png;base64,iVBORw0KGgo=",
            "javascript:alert(1)",
            "file:///etc/passwd"
        )

        for (url in urls) {
            val uri = Uri.parse(url)
            assertEquals(
                "Compiled allowlist must decide identically to the per-call path for $url",
                GoatContentBlocker.isUriAllowed(uri, allowed, tenantDomain),
                compiled.isUriAllowed(uri)
            )
        }
    }

    @Test
    fun `test wildcard and deep subdomains matching on Android`() {
        val allowed = setOf("*.example.com", ".partner.org", "exact.service.io")
        val tenantDomain = "appassets.androidplatform.net"

        // 1. *.example.com allows apex domain and arbitrary deep subdomains
        assertTrue("Apex domain allowed", GoatContentBlocker.isUriAllowed(Uri.parse("https://example.com/api/v1"), allowed, tenantDomain))
        assertTrue("Single subdomain allowed", GoatContentBlocker.isUriAllowed(Uri.parse("https://api.example.com/data"), allowed, tenantDomain))
        assertTrue("Deep subdomains (a.b.c) allowed", GoatContentBlocker.isUriAllowed(Uri.parse("https://a.b.c.example.com/deep/path"), allowed, tenantDomain))
        assertTrue("Port variations allowed", GoatContentBlocker.isUriAllowed(Uri.parse("http://dev.staging.api.example.com:8080/test"), allowed, tenantDomain))

        // 2. .partner.org (leading dot) allows apex domain and deep subdomains
        assertTrue("Apex domain allowed for .partner.org", GoatContentBlocker.isUriAllowed(Uri.parse("https://partner.org/feed"), allowed, tenantDomain))
        assertTrue("Deep subdomain allowed for .partner.org", GoatContentBlocker.isUriAllowed(Uri.parse("https://cdn.sub.partner.org/asset.js"), allowed, tenantDomain))

        // 3. exact.service.io allows only exact host match
        assertTrue("Exact host allowed", GoatContentBlocker.isUriAllowed(Uri.parse("https://exact.service.io/graphql"), allowed, tenantDomain))
        assertFalse("Subdomains BLOCKED for exact match", GoatContentBlocker.isUriAllowed(Uri.parse("https://sub.exact.service.io/graphql"), allowed, tenantDomain))
        assertFalse("Parent domain BLOCKED for exact match", GoatContentBlocker.isUriAllowed(Uri.parse("https://service.io/graphql"), allowed, tenantDomain))
    }

    @Test
    fun `test disallowed domains and suffix collision attacks blocked on Android`() {
        val allowed = setOf("*.example.com", "service.org")
        val tenantDomain = "appassets.androidplatform.net"

        // Suffix collisions must be hard-blocked
        val collisions = listOf(
            "https://evil-example.com/phish",
            "https://fakeexample.com/login",
            "https://notexample.com/",
            "https://example.com.evil.org/steal",
            "https://attackerexample.com/xss"
        )
        for (url in collisions) {
            assertFalse("Suffix collision URL must be BLOCKED: $url", GoatContentBlocker.isUriAllowed(Uri.parse(url), allowed, tenantDomain))
        }

        // Untrusted external domains must be hard-blocked
        val untrusted = listOf(
            "https://phishing-site.net/form",
            "https://trackers.analytics-ad.com/pixel.gif",
            "https://malicious-cdn.xyz/script.js"
        )
        for (url in untrusted) {
            assertFalse("Untrusted external domain must be BLOCKED: $url", GoatContentBlocker.isUriAllowed(Uri.parse(url), allowed, tenantDomain))
        }
    }

    @Test
    fun `test non-http and unsafe schemes blocked on Android`() {
        val allowed = setOf("*.example.com")
        val tenantDomain = "appassets.androidplatform.net"

        val unsafe = listOf(
            "javascript:alert(document.domain)",
            "javascript:void(0)",
            "file:///etc/passwd",
            "file:///data/data/com.goat.webview/databases/secrets.db",
            "ftp://ftp.example.com/file.txt",
            "ws://evil-websocket.org/socket"
        )
        for (url in unsafe) {
            assertFalse("Unsafe scheme must be BLOCKED: $url", GoatContentBlocker.isUriAllowed(Uri.parse(url), allowed, tenantDomain))
        }
    }

    @Test
    fun `test safe and sandboxed schemes allowed on Android`() {
        val allowed = emptySet<String>()
        val tenantDomain = "appassets.androidplatform.net"

        val safe = listOf(
            "goat://tenant_test/index.html",
            "goat://tenant_test/assets/app.bundle.js",
            "blob:https://example.com/7b7d7f7e-1234-5678-9abc-def012345678",
            "data:text/html;base64,PGgxPkhlbGxvIFdvcmxkPC9oMT4=",
            "data:image/svg+xml;utf8,<svg></svg>",
            "about:blank",
            "about:srcdoc"
        )
        for (url in safe) {
            assertTrue("Safe scheme must be ALLOWED: $url", GoatContentBlocker.isUriAllowed(Uri.parse(url), allowed, tenantDomain))
        }
    }

    // =========================================================================
    // SECTION 2: HTTP AUTH MANAGER ADVERSARIAL TESTS (Task 10204)
    // =========================================================================

    @Test
    fun `test multi-tenant credential isolation on Android`() = runTest {
        val host = "secure.enterprise.com"
        val realm = "finance_gateway"

        val tenantA = "app_finance_a"
        val tenantB = "app_hr_b"

        // 1. Tenant A saves credential
        val savedA = httpAuthManager.saveCredential(
            appId = tenantA,
            host = host,
            realm = realm,
            username = "alice_cfo",
            password = "super_secret_password_a"
        )
        assertTrue(savedA)

        // 2. Tenant B lookup must be null
        val credBBefore = httpAuthManager.getCredential(tenantB, host, realm)
        assertNull("Tenant B must not see Tenant A credentials", credBBefore)

        // 3. Tenant B saves its own credentials
        val savedB = httpAuthManager.saveCredential(
            appId = tenantB,
            host = host,
            realm = realm,
            username = "bob_hr",
            password = "bob_different_password_b"
        )
        assertTrue(savedB)

        // 4. Verify isolation
        val readA = httpAuthManager.getCredential(tenantA, host, realm)
        assertEquals("alice_cfo", readA?.username)
        assertEquals("super_secret_password_a", readA?.password)

        val readB = httpAuthManager.getCredential(tenantB, host, realm)
        assertEquals("bob_hr", readB?.username)
        assertEquals("bob_different_password_b", readB?.password)
    }

    @Test
    fun `test selective credential clearing preserves other keys and tenants on Android`() = runTest {
        val tenantA = "tenant_clear_a"
        val tenantB = "tenant_clear_b"
        val host = "api.shared.com"

        // 1. Save credentials for A and B
        httpAuthManager.saveCredential(tenantA, host, "r1", "user_a", "pwd_a")
        httpAuthManager.saveCredential(tenantB, host, "r1", "user_b", "pwd_b")

        // 2. Save non-auth secure key for tenant A
        val nonAuthKey = "user_session_oauth_refresh_token"
        secureStorage.setSecureValue(tenantA, nonAuthKey, "refresh_tok_99999")

        // 3. Clear credentials on non-existent tenant
        val clearNonExistent = httpAuthManager.clearCredentials("non_existent_tenant_xyz")
        assertTrue("Clearing non-existent tenant must return true", clearNonExistent)

        // 4. Clear credentials on Tenant A
        val clearA = httpAuthManager.clearCredentials(tenantA)
        assertTrue(clearA)

        // 5. Tenant A HTTP auth credentials purged
        assertNull(httpAuthManager.getCredential(tenantA, host, "r1"))

        // 6. Tenant A non-auth secure key remains intact
        val sessionVal = secureStorage.getSecureValue(tenantA, nonAuthKey)
        assertEquals("refresh_tok_99999", sessionVal)

        // 7. Tenant B credentials remain intact
        val credB = httpAuthManager.getCredential(tenantB, host, "r1")
        assertEquals("user_b", credB?.username)
    }

    @Test
    fun `test corrupted and malformed payload resilience on Android`() = runTest {
        val tenant = "tenant_corrupt_test"
        val host = "corrupt.host.com"
        val realm = "r"

        // Direct corrupted string injection
        val key = "http_auth_${tenant}_${host}_$realm"
        secureStorage.setSecureValue(tenant, key, "INVALID_NON_JSON_MALFORMED{{{")

        // getCredential catches exception and returns null gracefully
        val res = httpAuthManager.getCredential(tenant, host, realm)
        assertNull("Corrupted payload must return null gracefully", res)
    }

    @Test
    fun `test bridge http auth actions execution on Android`() = runTest {
        val host = "bridge.auth.corp"
        val realm = "intranet"

        // 1. Save via bridge
        val saveRes = bridgeHandler.executeAction("HTTP_AUTH_SAVE_CREDENTIAL", buildJsonObject {
            put("host", host)
            put("realm", realm)
            put("username", "bridge_user")
            put("password", "bridge_pass")
        })
        assertTrue("Bridge save action must succeed", saveRes.isSuccess)

        // 2. Verify stored
        val cred = httpAuthManager.getCredential("challenge_android_sec16", host, realm)
        assertEquals("bridge_user", cred?.username)
        assertEquals("bridge_pass", cred?.password)

        // 3. Clear via bridge
        val clearRes = bridgeHandler.executeAction("HTTP_AUTH_CLEAR_CREDENTIALS", buildJsonObject {})
        assertTrue("Bridge clear action must succeed", clearRes.isSuccess)

        // 4. Verify cleared
        assertNull(httpAuthManager.getCredential("challenge_android_sec16", host, realm))
    }
}
