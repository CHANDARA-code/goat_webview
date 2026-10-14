package com.goat.webview

import android.webkit.CookieManager
import androidx.webkit.Profile
import com.goat.webview.view.GoatView
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
import org.junit.Assert.assertNotSame
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File

/**
 * Empirical Security & Hardening Test Suite: Android Multi-Profile Tenant Storage Isolation (R2).
 *
 * Validates Firefox-parity multi-tenant storage isolation:
 * 1. Profile name generation and path-traversal sanitization.
 * 2. Multi-profile cookie isolation between Tenant A and Tenant B on shared domain (e.g. https://api.gateway.gov/auth).
 * 3. Tenant B querying the exact same shared external URL returns 0 cookies.
 * 4. Selective cookie clearing purges only targeted tenant cookies and preserves all other tenants.
 * 5. FastPool tenant affinity and cross-tenant discard behavior.
 * 6. Legacy fallback virtual domain isolation when multi-profile is unsupported.
 * 7. GoatView profile binding and lifecycle cleanup.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class GoatMultiProfileTenantIsolationTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private lateinit var context: FakeTestContext

    @Before
    fun setUp() = runTest {
        Dispatchers.setMain(testDispatcher)
        context = FakeTestContext()
        GoatFastPool.clearPool()
        GoatCookieManager.mockCookieManager = CookieManager.getInstance()
        GoatCookieManager.clearAllCookies()
    }

    @After
    fun tearDown() {
        GoatFastPool.clearPool()
        GoatCookieManager.mockCookieManager = null
        Dispatchers.resetMain()
    }

    // =========================================================================
    // 1. PROFILE NAME GENERATION & SANITIZATION
    // =========================================================================

    @Test
    fun `test profile name generation and sanitization`() {
        assertEquals("goat_tenant_com_goat_appA", GoatCookieManager.getProfileName("com.goat.appA"))
        assertEquals("goat_tenant_com_goat_appB", GoatCookieManager.getProfileName("com.goat.appB"))
        assertEquals(Profile.DEFAULT_PROFILE_NAME, GoatCookieManager.getProfileName("default"))
        assertEquals(Profile.DEFAULT_PROFILE_NAME, GoatCookieManager.getProfileName(GoatAssetManager.DEFAULT_APP_ID))
        assertEquals(Profile.DEFAULT_PROFILE_NAME, GoatCookieManager.getProfileName(""))

        // Path traversal attack mitigation
        val sanitizedTraversal = GoatCookieManager.getProfileName("../../malicious/path")
        assertFalse("Profile name must not contain directory traversal slashes", sanitizedTraversal.contains("/"))
        assertFalse("Profile name must not contain backslashes", sanitizedTraversal.contains("\\"))
        assertFalse("Profile name must not contain double dots", sanitizedTraversal.contains(".."))
        assertTrue("Profile name must start with prefix", sanitizedTraversal.startsWith("goat_tenant_"))

        // Special characters sanitization
        val sanitizedSpecial = GoatCookieManager.getProfileName("app@v1.0#beta!")
        assertTrue("Profile name must be alphanumeric and underscore only", sanitizedSpecial.matches(Regex("^[a-zA-Z0-9_]+$")))

        // Length truncation test
        val superLongAppId = "a".repeat(120)
        val sanitizedLong = GoatCookieManager.getProfileName(superLongAppId)
        assertTrue("Profile name must be reasonably bounded in length", sanitizedLong.length <= 64)
    }

    // =========================================================================
    // 2. MULTI-PROFILE COOKIE ISOLATION (CROSS-TENANT LEAK PREVENTION)
    // =========================================================================

    @Test
    fun `test multi-profile cookie isolation between Tenant A and Tenant B on shared domain`() = runTest {
        val tenantA = "com.goat.appA"
        val tenantB = "com.goat.appB"
        val sharedUrl = "https://api.gateway.gov/auth"

        // Tenant A sets an authentication session cookie on a shared external API
        val setA = GoatCookieManager.setCookie(
            url = sharedUrl,
            cookie = GoatCookie(name = "auth", value = "tokenA", domain = "api.gateway.gov"),
            appId = tenantA
        )
        assertTrue("Setting cookie for Tenant A must succeed", setA)

        // Verify Tenant A returns the cookie
        val cookiesA = GoatCookieManager.getCookies(sharedUrl, appId = tenantA)
        assertEquals("Tenant A must see its own cookie", 1, cookiesA.size)
        assertEquals("auth", cookiesA[0].name)
        assertEquals("tokenA", cookiesA[0].value)

        // CRITICAL FIREFOX-PARITY ASSERTION:
        // Tenant B cookie store querying the exact same shared URL must return 0 cookies.
        val cookiesB = GoatCookieManager.getCookies(sharedUrl, appId = tenantB)
        assertEquals("Tenant B must see 0 cookies from Tenant A's shared session", 0, cookiesB.size)
        assertFalse("Tenant B must not contain auth token from Tenant A", cookiesB.any { it.name == "auth" })
        assertNull("Tenant B cookie header must be null or empty", GoatCookieManager.getCookieHeader(sharedUrl, appId = tenantB))

        // Tenant B sets its own distinct cookie on the same domain
        val setB = GoatCookieManager.setCookie(
            url = sharedUrl,
            cookie = GoatCookie(name = "auth", value = "tokenB", domain = "api.gateway.gov"),
            appId = tenantB
        )
        assertTrue("Setting cookie for Tenant B must succeed", setB)

        // Verify each tenant sees only its own cookie
        val cookiesAAfter = GoatCookieManager.getCookies(sharedUrl, appId = tenantA)
        val cookiesBAfter = GoatCookieManager.getCookies(sharedUrl, appId = tenantB)
        assertEquals(1, cookiesAAfter.size)
        assertEquals("tokenA", cookiesAAfter[0].value)
        assertEquals(1, cookiesBAfter.size)
        assertEquals("tokenB", cookiesBAfter[0].value)
    }

    // =========================================================================
    // 3. SELECTIVE TENANT COOKIE LIFECYCLE & PURGING
    // =========================================================================

    @Test
    fun `test tenant cookie clearing does not impact other tenant profiles`() = runTest {
        val tenantA = "com.goat.appA"
        val tenantB = "com.goat.appB"
        val tenantC = "com.goat.appC"

        GoatCookieManager.setCookieForTenant(tenantA, "session_a", "val_a")
        GoatCookieManager.setCookieForTenant(tenantB, "session_b", "val_b")
        GoatCookieManager.setCookieForTenant(tenantC, "session_c", "val_c")

        assertEquals(1, GoatCookieManager.getCookiesForTenant(tenantA).size)
        assertEquals(1, GoatCookieManager.getCookiesForTenant(tenantB).size)
        assertEquals(1, GoatCookieManager.getCookiesForTenant(tenantC).size)

        // Purge Tenant A's cookies
        val clearedA = GoatCookieManager.clearTenantCookies(tenantA)
        assertTrue("Clearing Tenant A cookies must succeed", clearedA)

        // Assert Tenant A has 0 cookies, while Tenant B and C remain completely intact
        assertEquals("Tenant A must have 0 cookies after purge", 0, GoatCookieManager.getCookiesForTenant(tenantA).size)
        val cookiesB = GoatCookieManager.getCookiesForTenant(tenantB)
        assertEquals("Tenant B must retain its cookies", 1, cookiesB.size)
        assertEquals("session_b", cookiesB[0].name)
        val cookiesC = GoatCookieManager.getCookiesForTenant(tenantC)
        assertEquals("Tenant C must retain its cookies", 1, cookiesC.size)
        assertEquals("session_c", cookiesC[0].name)
    }

    @Test
    fun `test deleteCookieForTenant with specific cookie name`() = runTest {
        val tenant = "com.goat.appA"
        GoatCookieManager.setCookieForTenant(tenant, "c1", "v1")
        GoatCookieManager.setCookieForTenant(tenant, "c2", "v2")
        assertEquals(2, GoatCookieManager.getCookiesForTenant(tenant).size)

        val deleted = GoatCookieManager.deleteCookieForTenant(tenant, "c1")
        assertTrue("Deletion of c1 must succeed", deleted)

        val remaining = GoatCookieManager.getCookiesForTenant(tenant)
        assertEquals(1, remaining.size)
        assertEquals("c2", remaining[0].name)
    }

    // =========================================================================
    // 4. FASTPOOL TENANT AFFINITY & CROSS-TENANT DISCARD BEHAVIOR
    // =========================================================================

    @Test
    fun `test GoatFastPool tenant affinity tagging and cross-tenant discard`() {
        assertEquals(0, GoatFastPool.poolSize)

        // Acquire with tenantA
        val wvA = GoatFastPool.acquire(context, "tenant_alpha")
        assertNotNull(wvA)
        assertEquals("tenant_alpha", GoatFastPool.getTenant(wvA))
        assertTrue(GoatFastPool.hasTenantAffinity(wvA))

        // Recycle wvA into pool
        val recycled = GoatFastPool.recycle(wvA)
        assertTrue("Recycling must succeed", recycled)
        assertEquals(1, GoatFastPool.poolSize)

        // Attempt cross-tenant acquire with tenant_beta
        // Pool contains instance bound to tenant_alpha -> MUST discard wvA and return a fresh warm instance
        val wvB = GoatFastPool.acquire(context, "tenant_beta")
        assertNotNull(wvB)
        assertNotSame("Cross-tenant acquire must NOT reuse instance bound to another tenant", wvA, wvB)
        assertEquals("tenant_beta", GoatFastPool.getTenant(wvB))
        assertEquals("Standby pool should now be empty after discard", 0, GoatFastPool.poolSize)

        // Recycle wvB into pool
        GoatFastPool.recycle(wvB)
        assertEquals(1, GoatFastPool.poolSize)

        // Same-tenant acquire with tenant_beta -> instance should be reused safely
        val wvB2 = GoatFastPool.acquire(context, "tenant_beta")
        assertSame("Same-tenant acquire reuses pooled instance with matching tenant affinity", wvB, wvB2)
        assertEquals(0, GoatFastPool.poolSize)
    }

    @Test
    fun `test GoatFastPool parkHot retains tenant affinity`() {
        val wv = GoatFastPool.createWarmWebView(context, warmNavigate = false)
        val hotKey = "tenant_hot|https://tenant_hot.com/index.html"

        val parked = GoatFastPool.parkHot(wv, hotKey)
        assertTrue("parkHot must succeed", parked)
        assertEquals("tenant_hot", GoatFastPool.getTenant(wv))
        assertTrue(GoatFastPool.hasTenantAffinity(wv))

        val acquiredHot = GoatFastPool.acquireHot(hotKey, context)
        assertNotNull(acquiredHot)
        assertSame("Acquired hot instance must match parked instance", wv, acquiredHot?.webView)
    }

    // =========================================================================
    // 5. LEGACY FALLBACK VIRTUAL DOMAIN ISOLATION
    // =========================================================================

    @Test
    fun `test legacy fallback virtual domain isolation when multi-profile is unsupported`() = runTest {
        val tenantA = "app_alpha"
        val tenantB = "app_beta"

        // Virtual domain separation ensures SOP storage boundary
        val domainA = GoatCookieManager.getTenantDomain(tenantA)
        val domainB = GoatCookieManager.getTenantDomain(tenantB)
        assertEquals("app_alpha.appassets.androidplatform.net", domainA)
        assertEquals("app_beta.appassets.androidplatform.net", domainB)
        assertFalse("Tenant domains must be distinct", domainA == domainB)

        val originA = GoatCookieManager.getTenantOrigin(tenantA)
        val originB = GoatCookieManager.getTenantOrigin(tenantB)
        assertEquals("https://app_alpha.appassets.androidplatform.net/", originA)
        assertEquals("https://app_beta.appassets.androidplatform.net/", originB)
        assertFalse("Tenant origins must be distinct", originA == originB)
    }

    // =========================================================================
    // 6. GOATVIEW PROFILE BINDING AND LIFECYCLE CLEANUP
    // =========================================================================

    @Test
    fun `test GoatView initialize and destroy lifecycle cleans up tenant references`() {
        val view = GoatView(context)
        view.initialize(assetDir = null, appId = "com.goat.appLifecycle", entryUrl = "https://example.com")

        val underlying = view.getUnderlyingWebView()
        assertNotNull("Underlying WebView must be instantiated", underlying)
        assertEquals("com.goat.appLifecycle", GoatFastPool.getTenant(underlying!!))

        // Trigger destroy
        view.destroy()
        assertNull("Underlying WebView should be nullified after destroy", view.getUnderlyingWebView())
        assertNull("tenantProfile should be null after destroy", view.tenantProfile)
        assertNull("tenantCookieManager should be null after destroy", view.tenantCookieManager)
        assertNull("tenantWebStorage should be null after destroy", view.tenantWebStorage)
    }
}
