package com.goat.webview

import android.webkit.CookieManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Unit test suite for GoatCookieManager RFC 6265 cookie partitioning and lifecycle operations (Milestone 1).
 */
@OptIn(ExperimentalCoroutinesApi::class)
class GoatCookieManagerTest {

    private val testDispatcher = UnconfinedTestDispatcher()

    @Before
    fun setUp() = runTest {
        Dispatchers.setMain(testDispatcher)
        GoatCookieManager.mockCookieManager = CookieManager.getInstance()
        GoatCookieManager.clearAllCookies()
    }

    @After
    fun tearDown() {
        GoatCookieManager.mockCookieManager = null
        Dispatchers.resetMain()
    }

    @Test
    fun `test tenant origin and domain resolution`() {
        val defaultOrigin = GoatCookieManager.getTenantOrigin("default")
        val defaultDomain = GoatCookieManager.getTenantDomain("default")
        assertEquals("https://appassets.androidplatform.net/", defaultOrigin)
        assertEquals("appassets.androidplatform.net", defaultDomain)

        val tenantOrigin = GoatCookieManager.getTenantOrigin("tenant_alpha")
        val tenantDomain = GoatCookieManager.getTenantDomain("tenant_alpha")
        assertEquals("https://tenant_alpha.appassets.androidplatform.net/", tenantOrigin)
        assertEquals("tenant_alpha.appassets.androidplatform.net", tenantDomain)
    }

    @Test
    fun `test formatCookieString produces valid RFC 6265 cookie string`() {
        val cookie = GoatCookie(
            name = "session_id",
            value = "abc123xyz",
            domain = "appassets.androidplatform.net",
            path = "/auth",
            maxAge = 3600L,
            isSecure = true,
            isHttpOnly = true,
            sameSite = "Strict"
        )

        val formatted = GoatCookieManager.formatCookieString(cookie)
        assertTrue(formatted.contains("session_id=abc123xyz;"))
        assertTrue(formatted.contains("Path=/auth"))
        assertTrue(formatted.contains("Domain=appassets.androidplatform.net"))
        assertTrue(formatted.contains("Max-Age=3600"))
        assertTrue(formatted.contains("Secure"))
        assertTrue(formatted.contains("HttpOnly"))
        assertTrue(formatted.contains("SameSite=Strict"))
    }

    @Test
    fun `test setCookie and getCookies on explicit URL`() = runTest {
        val url = "https://example.com/api"
        val cookie = GoatCookie(
            name = "auth_token",
            value = "tok_98765",
            domain = "example.com",
            path = "/"
        )

        val setSuccess = GoatCookieManager.setCookie(url, cookie)
        assertTrue(setSuccess)

        val cookies = GoatCookieManager.getCookies(url)
        assertEquals(1, cookies.size)
        assertEquals("auth_token", cookies[0].name)
        assertEquals("tok_98765", cookies[0].value)

        val rawHeader = GoatCookieManager.getCookieHeader(url)
        assertNotNull(rawHeader)
        assertTrue(rawHeader?.contains("auth_token=tok_98765") == true)
    }

    @Test
    fun `test setCookieForTenant and getCookiesForTenant`() = runTest {
        val appId = "mini_store"
        val success = GoatCookieManager.setCookieForTenant(
            appId = appId,
            name = "cart_id",
            value = "cart_42",
            maxAge = 7200L
        )
        assertTrue(success)

        val cookies = GoatCookieManager.getCookiesForTenant(appId)
        assertEquals(1, cookies.size)
        assertEquals("cart_id", cookies[0].name)
        assertEquals("cart_42", cookies[0].value)
    }

    @Test
    fun `test multi-tenant cookie isolation`() = runTest {
        val tenantA = "tenant_a"
        val tenantB = "tenant_b"

        GoatCookieManager.setCookieForTenant(tenantA, "secret_a", "val_a")
        GoatCookieManager.setCookieForTenant(tenantB, "secret_b", "val_b")

        val cookiesA = GoatCookieManager.getCookiesForTenant(tenantA)
        val cookiesB = GoatCookieManager.getCookiesForTenant(tenantB)

        assertEquals(1, cookiesA.size)
        assertEquals("secret_a", cookiesA[0].name)

        assertEquals(1, cookiesB.size)
        assertEquals("secret_b", cookiesB[0].name)

        // Verify Tenant A does not contain Tenant B's cookies
        assertFalse(cookiesA.any { it.name == "secret_b" })
        assertFalse(cookiesB.any { it.name == "secret_a" })
    }

    @Test
    fun `test deleteCookie removes specified cookie`() = runTest {
        val url = "https://example.com/"
        GoatCookieManager.setCookie(url, "temp_cookie", "123")
        assertEquals(1, GoatCookieManager.getCookies(url).size)

        val deleted = GoatCookieManager.deleteCookie(url, "temp_cookie")
        assertTrue(deleted)
        assertEquals(0, GoatCookieManager.getCookies(url).size)
    }

    @Test
    fun `test deleteCookieForTenant`() = runTest {
        val appId = "tenant_del"
        GoatCookieManager.setCookieForTenant(appId, "token", "abc")
        assertEquals(1, GoatCookieManager.getCookiesForTenant(appId).size)

        val deleted = GoatCookieManager.deleteCookieForTenant(appId, "token")
        assertTrue(deleted)
        assertEquals(0, GoatCookieManager.getCookiesForTenant(appId).size)
    }

    @Test
    fun `test clearTenantCookies removes all tenant cookies`() = runTest {
        val appId = "tenant_clear"
        GoatCookieManager.setCookieForTenant(appId, "c1", "v1")
        GoatCookieManager.setCookieForTenant(appId, "c2", "v2")
        assertEquals(2, GoatCookieManager.getCookiesForTenant(appId).size)

        val cleared = GoatCookieManager.clearTenantCookies(appId)
        assertTrue(cleared)
        assertEquals(0, GoatCookieManager.getCookiesForTenant(appId).size)
    }

    @Test
    fun `test clearAllCookies purges entire cookie manager`() = runTest {
        GoatCookieManager.setCookieForTenant("tenant_1", "c1", "v1")
        GoatCookieManager.setCookieForTenant("tenant_2", "c2", "v2")

        val cleared = GoatCookieManager.clearAllCookies()
        assertTrue(cleared)
        assertEquals(0, GoatCookieManager.getCookiesForTenant("tenant_1").size)
        assertEquals(0, GoatCookieManager.getCookiesForTenant("tenant_2").size)
    }
}
