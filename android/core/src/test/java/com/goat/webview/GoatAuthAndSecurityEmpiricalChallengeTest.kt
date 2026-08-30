package com.goat.webview

import android.net.Uri
import com.goat.webview.auth.GoatHttpAuthManager
import com.goat.webview.auth.GoatOAuthException
import com.goat.webview.auth.GoatOAuthSessionManager
import com.goat.webview.security.GoatAbuseGuardManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Adversarial Empirical Challenge Test Suite for HTTP Auth, OAuth Session, and Abuse Guard.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class GoatAuthAndSecurityEmpiricalChallengeTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private lateinit var fakeContext: FakeTestContext
    private lateinit var secureStorage: GoatSecureStorageManager
    private lateinit var storageManager: GoatStorageManager
    private lateinit var httpAuthManager: GoatHttpAuthManager
    private lateinit var oAuthManager: GoatOAuthSessionManager
    private lateinit var abuseGuard: GoatAbuseGuardManager

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        fakeContext = FakeTestContext()
        secureStorage = GoatSecureStorageManager(fakeContext, testDispatcher)
        storageManager = GoatStorageManager(fakeContext, testDispatcher)
        httpAuthManager = GoatHttpAuthManager(fakeContext, secureStorage, testDispatcher)
        oAuthManager = GoatOAuthSessionManager(fakeContext, testDispatcher)
        abuseGuard = GoatAbuseGuardManager(defaultGestureWindowMs = 10_000L, maxDialogRequests = 3, dialogWindowMs = 3_000L)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // =========================================================================
    // SECTION 1: GOAT HTTP AUTH MANAGER STRESS TESTS
    // =========================================================================

    @Test
    fun `challenge HTTP auth missing credentials returns null for unknown tenant, host, or realm`() = runTest {
        // 1. Non-existent tenant
        val nonExistentTenant = httpAuthManager.getCredential("unknown_app", "api.example.com", "default_realm")
        assertNull("Non-existent tenant must return null", nonExistentTenant)

        // 2. Save credential for tenant A
        httpAuthManager.saveCredential(
            appId = "tenant_alpha",
            host = "api.alpha.com",
            realm = "alpha_realm",
            username = "alpha_user",
            password = "alpha_password"
        )

        // 3. Unknown host on tenant A
        val unknownHost = httpAuthManager.getCredential("tenant_alpha", "wrong.host.com", "alpha_realm")
        assertNull("Unknown host must return null", unknownHost)

        // 4. Unknown realm on tenant A
        val unknownRealm = httpAuthManager.getCredential("tenant_alpha", "api.alpha.com", "wrong_realm")
        assertNull("Unknown realm must return null", unknownRealm)
    }

    @Test
    fun `challenge HTTP auth multi-tenant separation prevents cross-tenant credential leakage`() = runTest {
        val host = "shared-auth.enterprise.com"
        val realm = "corporate_intranet"

        // Tenant A saves credentials
        val saveA = httpAuthManager.saveCredential(
            appId = "appA",
            host = host,
            realm = realm,
            username = "alice@corp.com",
            password = "alice_super_secret"
        )
        assertTrue("Save for appA must succeed", saveA)

        // Tenant B queries same host and realm -> must return null
        val credB = httpAuthManager.getCredential("appB", host, realm)
        assertNull("appB must not be able to read appA credentials", credB)

        // Tenant B saves its own credentials for the same host and realm
        val saveB = httpAuthManager.saveCredential(
            appId = "appB",
            host = host,
            realm = realm,
            username = "bob@corp.com",
            password = "bob_different_secret"
        )
        assertTrue("Save for appB must succeed", saveB)

        // Verify each tenant retrieves its own credentials without cross-talk
        val readA = httpAuthManager.getCredential("appA", host, realm)
        assertNotNull(readA)
        assertEquals("alice@corp.com", readA?.username)
        assertEquals("alice_super_secret", readA?.password)

        val readB = httpAuthManager.getCredential("appB", host, realm)
        assertNotNull(readB)
        assertEquals("bob@corp.com", readB?.username)
        assertEquals("bob_different_secret", readB?.password)
    }

    @Test
    fun `challenge HTTP auth empty username, empty password, and whitespace boundary values`() = runTest {
        val appId = "edge_case_app"
        val host = "auth.edge.io"
        val realm = "edge_realm"

        // 1. Empty password
        val savedEmptyPass = httpAuthManager.saveCredential(appId, host, "realm_empty_pass", "admin", "")
        assertTrue(savedEmptyPass)
        val readEmptyPass = httpAuthManager.getCredential(appId, host, "realm_empty_pass")
        assertNotNull(readEmptyPass)
        assertEquals("admin", readEmptyPass?.username)
        assertEquals("", readEmptyPass?.password)

        // 2. Empty username
        val savedEmptyUser = httpAuthManager.saveCredential(appId, host, "realm_empty_user", "", "secret123")
        assertTrue(savedEmptyUser)
        val readEmptyUser = httpAuthManager.getCredential(appId, host, "realm_empty_user")
        assertNotNull(readEmptyUser)
        assertEquals("", readEmptyUser?.username)
        assertEquals("secret123", readEmptyUser?.password)

        // 3. Both empty
        val savedBothEmpty = httpAuthManager.saveCredential(appId, host, "realm_both_empty", "", "")
        assertTrue(savedBothEmpty)
        val readBothEmpty = httpAuthManager.getCredential(appId, host, "realm_both_empty")
        assertNotNull(readBothEmpty)
        assertEquals("", readBothEmpty?.username)
        assertEquals("", readBothEmpty?.password)
    }

    @Test
    fun `challenge HTTP auth host and realm normalization handles mixed case and surrounding whitespace`() = runTest {
        val appId = "norm_app"

        // Save with mixed case and leading/trailing whitespace
        httpAuthManager.saveCredential(
            appId = appId,
            host = "   GATEWAY.Internal.COM  ",
            realm = "  SecuredArea   ",
            username = "norm_user",
            password = "norm_password"
        )

        // Read with lowercase and clean formatting
        val readClean = httpAuthManager.getCredential(appId, "gateway.internal.com", "securedarea")
        assertNotNull("Normalized host/realm lookup must find the credential", readClean)
        assertEquals("norm_user", readClean?.username)
        assertEquals("norm_password", readClean?.password)

        // Read with different case/whitespace
        val readMixed = httpAuthManager.getCredential(appId, "Gateway.INTERNAL.com", "  SECUREDAREA  ")
        assertNotNull("Case-insensitive lookup must succeed", readMixed)
        assertEquals("norm_user", readMixed?.username)
    }

    @Test
    fun `challenge HTTP auth clearCredentials purges memory cache and storage only for target tenant`() = runTest {
        val host = "shared.domain.com"
        val realm = "realm1"

        httpAuthManager.saveCredential("app_x", host, realm, "user_x", "pass_x")
        httpAuthManager.saveCredential("app_y", host, realm, "user_y", "pass_y")

        // Clear app_x
        val cleared = httpAuthManager.clearCredentials("app_x")
        assertTrue("clearCredentials must return true", cleared)

        // app_x credential must be null
        assertNull("app_x credential must be removed", httpAuthManager.getCredential("app_x", host, realm))

        // app_y credential must remain intact
        val credY = httpAuthManager.getCredential("app_y", host, realm)
        assertNotNull("app_y credential must not be affected", credY)
        assertEquals("user_y", credY?.username)
    }

    @Test
    fun `challenge HTTP auth corrupted storage payload handled gracefully without crash`() = runTest {
        val appId = "corrupt_test_app"
        val host = "corrupt.host.com"
        val realm = "corrupt_realm"

        // Inject invalid/corrupted JSON directly into secure storage
        val key = "http_auth_${appId}_${host}_$realm"
        secureStorage.setSecureValue(appId, key, "INVALID_NON_JSON_CORRUPTED_DATA{{{")

        // getCredential should catch deserialization exception and return null
        val result = httpAuthManager.getCredential(appId, host, realm)
        assertNull("Corrupted payload must return null gracefully", result)
    }

    // =========================================================================
    // SECTION 2: GOAT OAUTH SESSION MANAGER STRESS TESTS
    // =========================================================================

    @Test
    fun `challenge OAuth startOAuthSession rejects blank authUrl and blank callbackUrlScheme`() = runTest {
        // Blank authUrl
        var caughtAuthUrlEx = false
        try {
            oAuthManager.startOAuthSession(
                sessionId = "sess_1",
                authUrl = "   ",
                callbackUrlScheme = "myapp"
            ) {}
        } catch (e: IllegalArgumentException) {
            caughtAuthUrlEx = true
            assertTrue(e.message?.contains("authUrl cannot be blank") == true)
        }
        assertTrue("Must catch IllegalArgumentException for blank authUrl", caughtAuthUrlEx)

        // Blank callbackUrlScheme
        var caughtSchemeEx = false
        try {
            oAuthManager.startOAuthSession(
                sessionId = "sess_2",
                authUrl = "https://auth.example.com",
                callbackUrlScheme = ""
            ) {}
        } catch (e: IllegalArgumentException) {
            caughtSchemeEx = true
            assertTrue(e.message?.contains("callbackUrlScheme cannot be blank") == true)
        }
        assertTrue("Must catch IllegalArgumentException for blank callbackUrlScheme", caughtSchemeEx)
    }

    @Test
    fun `challenge OAuth superseding session cancels previous active session with AUTH_CANCELLED`() = runTest {
        var firstResult: Result<JsonObject>? = null
        var secondResult: Result<JsonObject>? = null

        // Start first session
        oAuthManager.startOAuthSession(
            sessionId = "session_one",
            authUrl = "https://idp.example.com/oauth/authorize",
            callbackUrlScheme = "appone"
        ) { res -> firstResult = res }

        assertTrue(oAuthManager.hasActiveSession())

        // Start second session (supersedes the first)
        oAuthManager.startOAuthSession(
            sessionId = "session_two",
            authUrl = "https://idp2.example.com/oauth/authorize",
            callbackUrlScheme = "apptwo"
        ) { res -> secondResult = res }

        assertTrue(oAuthManager.hasActiveSession())

        // First session callback must have received failure with AUTH_CANCELLED
        assertNotNull("First session callback must be notified", firstResult)
        assertTrue(firstResult?.isFailure == true)
        val failureEx = firstResult?.exceptionOrNull()
        assertTrue(failureEx is GoatOAuthException)
        assertEquals("AUTH_CANCELLED", (failureEx as GoatOAuthException).code)
        assertTrue(failureEx.message?.contains("superseded") == true)

        // Second session should still be active and complete successfully with matching redirect
        val redirectUri = Uri.parse("apptwo://oauth/callback?token=tok_222")
        val handled = oAuthManager.handleRedirectUri(redirectUri)
        assertTrue("Second session redirect must be handled", handled)
        assertFalse(oAuthManager.hasActiveSession())

        assertNotNull(secondResult)
        assertTrue(secondResult?.isSuccess == true)
        val data = secondResult?.getOrNull()
        assertEquals("session_two", data?.get("sessionId")?.jsonPrimitive?.content)
    }

    @Test
    fun `challenge OAuth callback scheme case insensitivity in redirect matching`() = runTest {
        var callbackResult: Result<JsonObject>? = null

        oAuthManager.startOAuthSession(
            sessionId = "case_session",
            authUrl = "https://login.example.com/auth",
            callbackUrlScheme = "MyCustomScheme"
        ) { res -> callbackResult = res }

        // Redirect URI with uppercase scheme: MYCUSTOMSCHEME://callback
        val uppercaseUri = Uri.parse("MYCUSTOMSCHEME://callback?code=xyz")
        val handled = oAuthManager.handleRedirectUri(uppercaseUri)
        assertTrue("Uppercase redirect scheme must match registered lowercase scheme", handled)
        assertFalse(oAuthManager.hasActiveSession())
        assertTrue(callbackResult?.isSuccess == true)
    }

    @Test
    fun `challenge OAuth mismatched redirect scheme is ignored and preserves active session`() = runTest {
        var callbackResult: Result<JsonObject>? = null

        oAuthManager.startOAuthSession(
            sessionId = "mismatch_session",
            authUrl = "https://login.example.com/auth",
            callbackUrlScheme = "targetscheme"
        ) { res -> callbackResult = res }

        // Send redirect with wrong scheme
        val wrongUri = Uri.parse("differentscheme://callback?code=evil")
        val handled = oAuthManager.handleRedirectUri(wrongUri)
        assertFalse("Mismatched scheme must return false", handled)
        assertTrue("Active session must be preserved", oAuthManager.hasActiveSession())
        assertNull("Callback must not be invoked on mismatched scheme", callbackResult)

        // Clean up
        oAuthManager.cancelOAuthSession()
    }

    @Test
    fun `challenge OAuth cancel session behaviors with specific and omitted sessionIds`() = runTest {
        var result1: Result<JsonObject>? = null

        // 1. Cancel with wrong sessionId does NOT cancel active session
        oAuthManager.startOAuthSession(
            sessionId = "active_session_100",
            authUrl = "https://auth.example.com",
            callbackUrlScheme = "app100"
        ) { res -> result1 = res }

        val wrongCancel = oAuthManager.cancelOAuthSession("wrong_session_id")
        assertFalse("Canceling with wrong sessionId must return false", wrongCancel)
        assertTrue("Session must remain active", oAuthManager.hasActiveSession())
        assertNull("Callback must not be called", result1)

        // 2. Cancel with matching sessionId succeeds
        val matchingCancel = oAuthManager.cancelOAuthSession("active_session_100")
        assertTrue("Canceling with matching sessionId must return true", matchingCancel)
        assertFalse("Session must no longer be active", oAuthManager.hasActiveSession())
        assertTrue(result1?.isFailure == true)

        // 3. Cancel when no active session returns false
        val noActiveCancel = oAuthManager.cancelOAuthSession()
        assertFalse("Canceling when no session active must return false", noActiveCancel)
    }

    @Test
    fun `challenge OAuth handleRedirectUri returns false when no active session exists`() {
        assertFalse(oAuthManager.hasActiveSession())
        val uri = Uri.parse("myapp://callback?code=123")
        val handled = oAuthManager.handleRedirectUri(uri)
        assertFalse("Redirect handling with no active session must return false", handled)
    }

    // =========================================================================
    // SECTION 3: GOAT ABUSE GUARD MANAGER & GESTURE FRESHNESS STRESS TESTS
    // =========================================================================

    @Test
    fun `challenge abuse guard gesture freshness boundary precision`() {
        val now = 1_000_000L

        // 1. Exactly 0ms age (instant touch)
        abuseGuard.recordUserGesture(now)
        assertTrue("0ms touch must be fresh", abuseGuard.isGestureFresh(10_000L, now))
        assertEquals(0L, abuseGuard.getGestureAgeMs(now))

        // 2. Boundary: exactly 10,000ms age
        abuseGuard.recordUserGesture(now - 10_000L)
        assertTrue("Exactly 10000ms must be fresh (inclusive)", abuseGuard.isGestureFresh(10_000L, now))
        assertEquals(10_000L, abuseGuard.getGestureAgeMs(now))

        // 3. Boundary + 1ms: 10,001ms age -> STALE
        abuseGuard.recordUserGesture(now - 10_001L)
        assertFalse("10001ms must be stale", abuseGuard.isGestureFresh(10_000L, now))
        assertEquals(10_001L, abuseGuard.getGestureAgeMs(now))

        // 4. Future timestamp (clock skew / negative age)
        abuseGuard.recordUserGesture(now + 5000L)
        assertFalse("Future gesture timestamp must not be considered fresh", abuseGuard.isGestureFresh(10_000L, now))

        // 5. Reset clears timestamp to 0
        abuseGuard.reset()
        assertFalse("Reset abuse guard must not be fresh", abuseGuard.isGestureFresh(10_000L, now))
        assertEquals(Long.MAX_VALUE, abuseGuard.getGestureAgeMs(now))
    }

    @Test
    fun `challenge ALL 12 PRIVILEGED_ACTIONS fail with GESTURE_REQUIRED on stale gesture`() = runTest {
        val staleGuard = GoatAbuseGuardManager()
        staleGuard.reset() // Sets last touch to 0 -> stale

        val handler = GoatBridgeActionHandler(
            context = fakeContext,
            appId = "privilege_test_app",
            abuseGuardManager = staleGuard,
            storageManager = storageManager,
            secureStorageManager = secureStorage,
            httpAuthManager = httpAuthManager,
            oAuthSessionManager = oAuthManager
        )

        // Verify the exact set of 12 privileged actions (Task 10206 adds CANCEL_PAYMENT)
        val privilegedActions = GoatAbuseGuardManager.PRIVILEGED_ACTIONS
        assertEquals("Must contain exactly 12 privileged actions", 12, privilegedActions.size)

        for (action in privilegedActions) {
            val payload = buildJsonObject {
                put("title", "Test Action")
                put("phoneNumber", "+1234567890")
                put("body", "Test SMS")
                put("latitude", 37.7749)
                put("longitude", -122.4194)
                put("name", "San Francisco")
                put("address", "Market St")
                put("text", "Share text")
                put("url", "https://example.com")
                put("mediaPath", "/tmp/photo.jpg")
                put("orderId", "order_123")
                put("amount", 9.99)
                put("currency", "USD")
            }

            val result = handler.executeAction(action, payload)
            assertFalse("Privileged action '$action' MUST fail when user gesture is stale", result.isSuccess)
            val exception = result.exceptionOrNull()
            assertTrue("Exception must be SecurityException for '$action', got $exception", exception is SecurityException)
            assertTrue(
                "Exception message for '$action' must contain GESTURE_REQUIRED, got: ${exception?.message}",
                exception?.message?.contains(GoatAbuseGuardManager.ERROR_GESTURE_REQUIRED) == true
            )
        }
    }

    @Test
    fun `challenge non-privileged bridge actions succeed even when user gesture is stale`() = runTest {
        val staleGuard = GoatAbuseGuardManager()
        staleGuard.reset() // Gesture is stale

        val handler = GoatBridgeActionHandler(
            context = fakeContext,
            appId = "non_priv_app",
            abuseGuardManager = staleGuard,
            storageManager = storageManager,
            secureStorageManager = secureStorage,
            httpAuthManager = httpAuthManager,
            oAuthSessionManager = oAuthManager
        )

        // 1. STORAGE_SET & STORAGE_GET
        val setRes = handler.executeAction("STORAGE_SET", buildJsonObject {
            put("key", "test_key")
            put("value", "test_val")
        })
        assertTrue("STORAGE_SET must succeed without fresh gesture", setRes.isSuccess)

        val getRes = handler.executeAction("STORAGE_GET", buildJsonObject {
            put("key", "test_key")
        })
        assertTrue("STORAGE_GET must succeed without fresh gesture", getRes.isSuccess)

        // 2. HTTP_AUTH_SAVE_CREDENTIAL
        val authSaveRes = handler.executeAction("HTTP_AUTH_SAVE_CREDENTIAL", buildJsonObject {
            put("host", "api.test.com")
            put("realm", "test_realm")
            put("username", "user1")
            put("password", "pass1")
        })
        assertTrue("HTTP_AUTH_SAVE_CREDENTIAL must succeed without fresh gesture", authSaveRes.isSuccess)

        // 3. GET_DEVICE_INFO
        val infoRes = handler.executeAction("GET_DEVICE_INFO", buildJsonObject {})
        assertTrue("GET_DEVICE_INFO must succeed without fresh gesture", infoRes.isSuccess)
    }

    @Test
    fun `challenge privileged actions pass gate when fresh user gesture is recorded`() = runTest {
        val freshGuard = GoatAbuseGuardManager()
        freshGuard.recordUserGesture() // Fresh touch recorded

        val handler = GoatBridgeActionHandler(
            context = fakeContext,
            appId = "fresh_priv_app",
            abuseGuardManager = freshGuard,
            onMakePhoneCall = { /* handle */ }
        )

        val callRes = handler.executeAction("MAKE_PHONE_CALL", buildJsonObject {
            put("phoneNumber", "+15551234567")
        })

        // MAKE_PHONE_CALL with onMakePhoneCall provided should succeed
        assertTrue("MAKE_PHONE_CALL must succeed with fresh user gesture", callRes.isSuccess)
    }

    @Test
    fun `challenge repeated dialog cooldown throttles after max requests within sliding window and recovers`() {
        val now = 2_000_000L
        val windowMs = 3_000L
        val maxRequests = 3

        // Requests 1, 2, 3 are allowed
        assertFalse(abuseGuard.shouldThrottleDialog("SHOW_MODAL", maxRequests, windowMs, now))
        assertFalse(abuseGuard.shouldThrottleDialog("SHOW_MODAL", maxRequests, windowMs, now + 500))
        assertFalse(abuseGuard.shouldThrottleDialog("SHOW_MODAL", maxRequests, windowMs, now + 1_000))

        // Request 4 at 1500ms (within 3s window) -> THROTTLED
        assertTrue(
            "4th request within sliding window must be throttled",
            abuseGuard.shouldThrottleDialog("SHOW_MODAL", maxRequests, windowMs, now + 1_500)
        )

        // Independent dialog type "SHOW_ACTION_SHEET" is NOT throttled
        assertFalse(
            "Different dialog type must have independent throttling counter",
            abuseGuard.shouldThrottleDialog("SHOW_ACTION_SHEET", maxRequests, windowMs, now + 1_600)
        )

        // After window expires (now + 3001ms relative to 1st request, but oldest remaining requests shift)
        // At now + 4501ms, all 3 original timestamps (0, 500, 1000) are older than 4501 - 3000 = 1501
        assertFalse(
            "Dialog request after window expiration must be allowed",
            abuseGuard.shouldThrottleDialog("SHOW_MODAL", maxRequests, windowMs, now + 4_501)
        )

        // Reset clears all dialog histories
        abuseGuard.reset()
        assertFalse(
            "Reset must clear dialog throttling history",
            abuseGuard.shouldThrottleDialog("SHOW_MODAL", maxRequests, windowMs, now + 4_502)
        )
    }
}
