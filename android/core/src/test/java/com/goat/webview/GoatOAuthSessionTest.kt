package com.goat.webview

import android.net.Uri
import com.goat.webview.auth.GoatOAuthSessionManager
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class GoatOAuthSessionTest {

    private lateinit var fakeContext: FakeTestContext
    private lateinit var oAuthManager: GoatOAuthSessionManager
    private lateinit var handler: GoatBridgeActionHandler

    @Before
    fun setUp() {
        fakeContext = FakeTestContext()
        oAuthManager = GoatOAuthSessionManager(fakeContext)
        handler = GoatBridgeActionHandler(
            context = fakeContext,
            appId = "oauth_test_app",
            oAuthSessionManager = oAuthManager
        )
    }

    @Test
    fun `test START_OAUTH_SESSION launches session and intercept redirect URI`() = runTest {
        var callbackResult: Result<JsonObject>? = null

        val startRes = oAuthManager.startOAuthSession(
            sessionId = "session_oauth_1",
            authUrl = "https://accounts.google.com/o/oauth2/v2/auth?client_id=123",
            callbackUrlScheme = "myapp"
        ) { res ->
            callbackResult = res
        }

        assertEquals("session_oauth_1", startRes["sessionId"]?.jsonPrimitive?.content)
        assertEquals("STARTED", startRes["status"]?.jsonPrimitive?.content)
        assertTrue(oAuthManager.hasActiveSession())

        // 1. Irrelevant redirect URI is not consumed
        val wrongUri = Uri.parse("https://other.com/oauth/callback?code=xyz")
        val consumedWrong = oAuthManager.handleRedirectUri(wrongUri)
        assertFalse(consumedWrong)
        assertTrue(oAuthManager.hasActiveSession())

        // 2. Matching callback scheme is intercepted and resolves session
        val matchingUri = Uri.parse("myapp://oauth/callback?code=auth_code_secret_456&state=state_abc")
        val consumed = oAuthManager.handleRedirectUri(matchingUri)
        assertTrue(consumed)
        assertFalse(oAuthManager.hasActiveSession())

        assertNotNull(callbackResult)
        assertTrue(callbackResult?.isSuccess == true)
        val data = callbackResult?.getOrNull()
        assertEquals("session_oauth_1", data?.get("sessionId")?.jsonPrimitive?.content)
        assertTrue(data?.get("callbackUrl")?.jsonPrimitive?.content?.contains("auth_code_secret_456") == true)
    }

    @Test
    fun `test CANCEL_OAUTH_SESSION fails with AUTH_CANCELLED`() = runTest {
        var callbackResult: Result<JsonObject>? = null

        oAuthManager.startOAuthSession(
            sessionId = "session_oauth_2",
            authUrl = "https://github.com/login/oauth/authorize",
            callbackUrlScheme = "githubapp"
        ) { res ->
            callbackResult = res
        }

        val cancelled = oAuthManager.cancelOAuthSession("session_oauth_2")
        assertTrue(cancelled)
        assertFalse(oAuthManager.hasActiveSession())

        assertNotNull(callbackResult)
        assertTrue(callbackResult?.isFailure == true)
        val ex = callbackResult?.exceptionOrNull()
        assertTrue(ex?.message?.contains("AUTH_CANCELLED") == true)
    }
}
