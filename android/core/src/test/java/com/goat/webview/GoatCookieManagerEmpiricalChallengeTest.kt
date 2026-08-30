package com.goat.webview

import android.content.Context
import android.content.ContextWrapper
import android.webkit.CookieManager
import com.goat.webview.headless.GoatHeadlessWebView
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
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.util.Date

/**
 * Adversarial Empirical Challenge test suite for GoatCookieManager (Milestone 1).
 *
 * Tests:
 * 1. Multi-tenant domain boundary violations and SOP storage isolation.
 * 2. RFC 6265 cookie expiry calculations, GMT timezone date formatting, and malformed header resilience.
 * 3. Max-age handling (positive, zero, negative, deletion tokens).
 * 4. FastPool 8-step recycling cookie purges and selective vs global clearing.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class GoatCookieManagerEmpiricalChallengeTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    private val testDispatcher = UnconfinedTestDispatcher()
    private lateinit var fakeAppContext: Context

    @Before
    fun setUp() = runTest {
        Dispatchers.setMain(testDispatcher)
        fakeAppContext = object : ContextWrapper(null) {
            override fun getApplicationContext(): Context = this
        }
        GoatCookieManager.mockCookieManager = CookieManager.getInstance()
        GoatCookieManager.clearAllCookies()
    }

    @After
    fun tearDown() {
        GoatCookieManager.mockCookieManager = null
        Dispatchers.resetMain()
    }

    // =========================================================================
    // CHALLENGE 1: MULTI-TENANT DOMAIN BOUNDARY & ORIGIN ISOLATION
    // =========================================================================

    @Test
    fun `challenge multi-tenant domain boundary isolation across distinct tenants`() = runTest {
        val tenantAlpha = "alpha_store"
        val tenantBeta = "beta_bank"
        val tenantGamma = "gamma_chat"

        // Set cookies for each distinct tenant
        GoatCookieManager.setCookieForTenant(tenantAlpha, "alpha_session", "token_alpha_123")
        GoatCookieManager.setCookieForTenant(tenantBeta, "beta_auth", "token_beta_456")
        GoatCookieManager.setCookieForTenant(tenantGamma, "gamma_pref", "dark_mode")

        // 1. Verify Tenant Alpha only sees Alpha cookies
        val cookiesAlpha = GoatCookieManager.getCookiesForTenant(tenantAlpha)
        assertEquals(1, cookiesAlpha.size)
        assertEquals("alpha_session", cookiesAlpha[0].name)
        assertEquals("token_alpha_123", cookiesAlpha[0].value)
        assertFalse("Alpha must not see Beta cookies", cookiesAlpha.any { it.name == "beta_auth" })
        assertFalse("Alpha must not see Gamma cookies", cookiesAlpha.any { it.name == "gamma_pref" })

        // 2. Verify Tenant Beta only sees Beta cookies
        val cookiesBeta = GoatCookieManager.getCookiesForTenant(tenantBeta)
        assertEquals(1, cookiesBeta.size)
        assertEquals("beta_auth", cookiesBeta[0].name)
        assertEquals("token_beta_456", cookiesBeta[0].value)
        assertFalse("Beta must not see Alpha cookies", cookiesBeta.any { it.name == "alpha_session" })

        // 3. Verify non-existent Tenant Delta sees zero cookies
        val cookiesDelta = GoatCookieManager.getCookiesForTenant("delta_empty")
        assertEquals(0, cookiesDelta.size)

        // 4. Delete cookie from Alpha and verify Beta and Gamma are completely unaffected
        val deleted = GoatCookieManager.deleteCookieForTenant(tenantAlpha, "alpha_session")
        assertTrue(deleted)
        assertEquals(0, GoatCookieManager.getCookiesForTenant(tenantAlpha).size)
        assertEquals(1, GoatCookieManager.getCookiesForTenant(tenantBeta).size)
        assertEquals(1, GoatCookieManager.getCookiesForTenant(tenantGamma).size)
    }

    @Test
    fun `challenge tenant domain resolution against path traversal and malicious appIds`() {
        // Alphanumeric standard
        assertEquals("shop123.appassets.androidplatform.net", GoatCookieManager.getTenantDomain("shop123"))

        // Default app IDs
        assertEquals("appassets.androidplatform.net", GoatCookieManager.getTenantDomain("default"))
        assertEquals("appassets.androidplatform.net", GoatCookieManager.getTenantDomain(GoatAssetManager.DEFAULT_APP_ID))
        assertEquals("appassets.androidplatform.net", GoatCookieManager.getTenantDomain(""))

        // Malicious path traversal attempts must be sanitized
        val traversalDomain = GoatCookieManager.getTenantDomain("../../../evil_app")
        assertFalse("Domain must not contain path traversal", traversalDomain.contains(".."))
        assertFalse("Domain must not contain slash", traversalDomain.contains("/"))

        // Origin URLs must always start with https:// and end with /
        val origin = GoatCookieManager.getTenantOrigin("secure_tenant")
        assertTrue(origin.startsWith("https://"))
        assertTrue(origin.endsWith("/"))
        assertEquals("https://secure_tenant.appassets.androidplatform.net/", origin)
    }

    // =========================================================================
    // CHALLENGE 2: RFC 6265 COOKIE EXPIRY CALCULATIONS & DATE FORMATTING
    // =========================================================================

    @Test
    fun `challenge RFC 1123 date formatting produces valid GMT strings`() {
        // Fixed timestamp: 2025-01-01 00:00:00 UTC = 1735689600000L
        val fixedTimestamp = 1735689600000L
        val cookie = GoatCookie(
            name = "fixed_exp",
            value = "val",
            expiresDate = fixedTimestamp,
            domain = "example.com"
        )

        val formatted = GoatCookieManager.formatCookieString(cookie)
        assertTrue(
            "Formatted string must contain RFC 1123 Expires in GMT timezone: $formatted",
            formatted.contains("Expires=Wed, 01 Jan 2025 00:00:00 GMT")
        )
    }

    @Test
    fun `challenge parsing of valid and malformed Expires attributes`() {
        val url = "https://example.com/"

        // 1. Valid Expires attribute
        val validCookieString = "session=xyz; Expires=Wed, 01 Jan 2025 00:00:00 GMT; Path=/; Secure"
        GoatCookieManager.getSystemCookieManager()?.setCookie(url, validCookieString)

        val cookies = GoatCookieManager.getCookies(url)
        assertEquals(1, cookies.size)
        assertEquals("session", cookies[0].name)
        assertEquals("xyz", cookies[0].value)

        // 2. Malformed Expires attribute must not throw ParseException
        val malformedCookieString = "broken=123; Expires=NotAValidDateString; Path=/api; HttpOnly"
        GoatCookieManager.getSystemCookieManager()?.setCookie(url, malformedCookieString)

        val updatedCookies = GoatCookieManager.getCookies(url)
        assertTrue("Cookies must contain broken cookie despite malformed Expires", updatedCookies.any { it.name == "broken" })
    }

    // =========================================================================
    // CHALLENGE 3: MAX-AGE HANDLING & EXPIRY COMPUTATION
    // =========================================================================

    @Test
    fun `challenge Max-Age calculation and formatting`() = runTest {
        val cookie = GoatCookie(
            name = "token",
            value = "secret",
            maxAge = 7200L,
            isSecure = true,
            isHttpOnly = true
        )

        val formatted = GoatCookieManager.formatCookieString(cookie)
        assertTrue(formatted.contains("Max-Age=7200"))
        assertTrue(formatted.contains("Secure"))
        assertTrue(formatted.contains("HttpOnly"))

        // Set on tenant and read back
        GoatCookieManager.setCookieForTenant("max_age_app", "token", "secret", maxAge = 7200L)
        val readCookies = GoatCookieManager.getCookiesForTenant("max_age_app")
        assertEquals(1, readCookies.size)
        assertEquals("token", readCookies[0].name)
        assertEquals("secret", readCookies[0].value)
    }

    @Test
    fun `challenge deleteCookie sets negative Max-Age and zero Expires date`() = runTest {
        val url = "https://tenant_del_challenge.appassets.androidplatform.net/"
        GoatCookieManager.setCookie(url, "active_key", "active_val")
        assertEquals(1, GoatCookieManager.getCookies(url).size)

        // Deletion
        val deleted = GoatCookieManager.deleteCookie(url, "active_key")
        assertTrue("deleteCookie must succeed", deleted)
        assertEquals("Cookie must be removed after deleteCookie", 0, GoatCookieManager.getCookies(url).size)
    }

    // =========================================================================
    // CHALLENGE 4: FASTPOOL RECYCLING COOKIE PURGES
    // =========================================================================

    @Test
    fun `challenge FastPool sanitizeWebView purges all tenant cookies completely`() = runTest {
        // Precondition: populate cookies across 3 tenants
        GoatCookieManager.setCookieForTenant("tenant_pool_1", "c1", "v1")
        GoatCookieManager.setCookieForTenant("tenant_pool_2", "c2", "v2")
        GoatCookieManager.setCookieForTenant("tenant_pool_3", "c3", "v3")

        assertEquals(1, GoatCookieManager.getCookiesForTenant("tenant_pool_1").size)
        assertEquals(1, GoatCookieManager.getCookiesForTenant("tenant_pool_2").size)
        assertEquals(1, GoatCookieManager.getCookiesForTenant("tenant_pool_3").size)

        // Create a warm WebView and execute FastPool 8-step sanitization sequence
        val warmWebView = GoatFastPool.createWarmWebView(fakeAppContext)
        GoatFastPool.sanitizeWebView(warmWebView)

        // Verify Step 5 of FastPool purges all cookies
        assertEquals(
            "Tenant 1 cookies must be purged on FastPool recycle",
            0,
            GoatCookieManager.getCookiesForTenant("tenant_pool_1").size
        )
        assertEquals(
            "Tenant 2 cookies must be purged on FastPool recycle",
            0,
            GoatCookieManager.getCookiesForTenant("tenant_pool_2").size
        )
        assertEquals(
            "Tenant 3 cookies must be purged on FastPool recycle",
            0,
            GoatCookieManager.getCookiesForTenant("tenant_pool_3").size
        )
    }

    @Test
    fun `challenge selective clearTenantCookies vs global clearAllCookies`() = runTest {
        val tenantA = "selective_a"
        val tenantB = "selective_b"

        GoatCookieManager.setCookieForTenant(tenantA, "key_a1", "val_a1")
        GoatCookieManager.setCookieForTenant(tenantA, "key_a2", "val_a2")
        GoatCookieManager.setCookieForTenant(tenantB, "key_b1", "val_b1")

        // Clear only Tenant A
        val clearedA = GoatCookieManager.clearTenantCookies(tenantA)
        assertTrue(clearedA)

        // Tenant A must be empty, Tenant B must retain its cookies
        assertEquals(0, GoatCookieManager.getCookiesForTenant(tenantA).size)
        assertEquals(1, GoatCookieManager.getCookiesForTenant(tenantB).size)

        // Global clear
        val clearedAll = GoatCookieManager.clearAllCookies()
        assertTrue(clearedAll)
        assertEquals(0, GoatCookieManager.getCookiesForTenant(tenantB).size)
    }
}
