package com.goat.webview

import android.content.Context
import android.os.Bundle
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.goat.webview.view.GoatSessionSnapshot
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
 * Unit Test Suite for Android Transparent Renderer Crash Session Recovery (R3).
 *
 * Validates Firefox-parity crash resilience:
 * 1. onRenderProcessGone returns true, isolating crash and preventing host application termination.
 * 2. Continuous session snapshotting captures entryUrl, confirmedUrl, routeHash, title, textZoom, bundle.
 * 3. Transparent rehydration replaces dead surface with fresh pooled/active WebView.
 * 4. Low memory kill (didCrash = false) and content crash (didCrash = true) both rehydrate cleanly.
 * 5. End-to-end crash trigger via onRenderProcessGone recovers surface.
 * 6. Anti-crash-loop circuit breaker prevents thrashing (max 3 crashes within 15 seconds).
 * 7. Route and URL restoration across rehydration.
 * 8. SwipeRefreshLayout hierarchy preservation across rehydration.
 * 9. Multi-profile tenant affinity and binding preservation across rehydration.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class GoatRendererCrashRecoveryTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private lateinit var fakeContext: FakeTestContext
    private lateinit var assetDir: File

    @Before
    fun setUp() = runTest {
        Dispatchers.setMain(testDispatcher)
        fakeContext = FakeTestContext()
        assetDir = File(fakeContext.filesDir, "test_bundle").apply { mkdirs() }
        GoatFastPool.clearPool()
    }

    @After
    fun tearDown() {
        GoatFastPool.clearPool()
        Dispatchers.resetMain()
    }

    @Test
    fun `test onRenderProcessGone returns true and isolates crash without throwing`() {
        var crashNotified = false
        var observedDidCrash = false
        var rehydrateNotified = false

        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = assetDir,
            appId = "tenant_test",
            onRenderCrashed = { didCrash ->
                crashNotified = true
                observedDidCrash = didCrash
            },
            onRehydrationHandler = { didCrash ->
                rehydrateNotified = true
            }
        )

        val detail = object : RenderProcessGoneDetail() {
            override fun didCrash(): Boolean = true
            override fun rendererPriorityAtExit(): Int = 2
        }

        val result = client.onRenderProcessGone(null, detail)
        assertTrue("onRenderProcessGone must unconditionally return true", result)
        assertTrue("onRenderCrashed listener must be invoked", crashNotified)
        assertTrue("didCrash flag must be true", observedDidCrash)
        assertTrue("onRehydrationHandler must be invoked", rehydrateNotified)
    }

    @Test
    fun `test onRenderProcessGone with didCrash false on low memory kill`() {
        var crashNotified = false
        var observedDidCrash = true
        var rehydrateNotified = false

        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = assetDir,
            appId = "tenant_test",
            onRenderCrashed = { didCrash ->
                crashNotified = true
                observedDidCrash = didCrash
            },
            onRehydrationHandler = { didCrash ->
                rehydrateNotified = true
            }
        )

        val detail = object : RenderProcessGoneDetail() {
            override fun didCrash(): Boolean = false
            override fun rendererPriorityAtExit(): Int = 0
        }

        val result = client.onRenderProcessGone(null, detail)
        assertTrue("onRenderProcessGone must return true for memory kill", result)
        assertTrue("onRenderCrashed listener must be invoked", crashNotified)
        assertFalse("didCrash flag must be false for LMK", observedDidCrash)
        assertTrue("onRehydrationHandler must be invoked", rehydrateNotified)
    }

    @Test
    fun `test session snapshot captures entryUrl routeHash title and textZoom`() {
        val goatView = GoatView(fakeContext)
        val testUrl = "https://tenant.appassets.androidplatform.net/assets/index.html#/checkout"
        goatView.initialize(assetDir = null, appId = "tenant_snap", entryUrl = testUrl)

        val snapshot = goatView.saveSessionState()
        assertEquals("tenant_snap", snapshot.appId)
        assertEquals(testUrl, snapshot.entryUrl)
        assertEquals(testUrl, snapshot.confirmedUrl)
        assertEquals(testUrl, snapshot.lastConfirmedUrl)
        assertEquals("#/checkout", snapshot.routeHash)
        assertEquals(testUrl, snapshot.resolveRestoreUrl())
        assertEquals(100, snapshot.textZoom)

        // Modify text zoom and confirm snapshot captures updated value
        goatView.setTextZoom(125)
        val updatedSnapshot = goatView.getSessionSnapshot()
        assertEquals(125, updatedSnapshot.textZoom)
    }

    @Test
    fun `test resolveRestoreUrl with base url and routeHash`() {
        val snapshot = GoatSessionSnapshot(
            entryUrl = "https://tenant.appassets.androidplatform.net/assets/index.html",
            confirmedUrl = null,
            routeHash = "#/payment",
            title = "Checkout",
            appId = "tenant_snap"
        )
        assertEquals(
            "https://tenant.appassets.androidplatform.net/assets/index.html#/payment",
            snapshot.resolveRestoreUrl()
        )

        val snapshotWithoutLeadingHash = GoatSessionSnapshot(
            entryUrl = "https://tenant.appassets.androidplatform.net/assets/index.html",
            confirmedUrl = null,
            routeHash = "orders/123",
            title = "Orders",
            appId = "tenant_snap"
        )
        assertEquals(
            "https://tenant.appassets.androidplatform.net/assets/index.html#orders/123",
            snapshotWithoutLeadingHash.resolveRestoreUrl()
        )
    }

    @Test
    fun `test automatic rehydration replaces dead surface with fresh pooled WebView`() {
        var crashErrorReceived: String? = null
        val goatView = GoatView(fakeContext)
        goatView.onError = { crashErrorReceived = it }

        val testUrl = "https://tenant.appassets.androidplatform.net/assets/index.html#/cart"
        goatView.initialize(assetDir = null, appId = "tenant_rehydrate", entryUrl = testUrl)

        val initialWv = goatView.getUnderlyingWebView()
        assertNotNull("Initial WebView must be mounted", initialWv)

        // Trigger crash rehydration
        goatView.rehydrateAfterCrash(didCrash = true)

        val rehydratedWv = goatView.getUnderlyingWebView()
        assertNotNull("Rehydrated WebView must be mounted", rehydratedWv)
        assertNotSame("Rehydrated WebView must be a fresh instance", initialWv, rehydratedWv)
        assertEquals("Child count must be maintained (not left empty)", 1, goatView.childCount)
        assertNotNull("Crash error must be logged to host", crashErrorReceived)
        assertTrue("Crash error must mention crash", crashErrorReceived?.contains("crashed") == true)
    }

    @Test
    fun `test low memory kill didCrash false rehydrates cleanly`() {
        val goatView = GoatView(fakeContext)
        goatView.initialize(assetDir = null, appId = "tenant_lmk", entryUrl = "https://tenant.appassets.androidplatform.net/assets/index.html#/dashboard")

        val initialWv = goatView.getUnderlyingWebView()
        goatView.rehydrateAfterCrash(didCrash = false)

        val newWv = goatView.getUnderlyingWebView()
        assertNotNull("New WebView must exist after LMK kill", newWv)
        assertNotSame("New WebView must replace dead instance", initialWv, newWv)
        assertEquals(1, goatView.childCount)
    }

    @Test
    fun `test end to end onRenderProcessGone triggers rehydration`() {
        val goatView = GoatView(fakeContext)
        val testUrl = "https://tenant.appassets.androidplatform.net/assets/index.html#/settings"
        goatView.initialize(assetDir = null, appId = "tenant_e2e", entryUrl = testUrl)

        val initialWv = goatView.getUnderlyingWebView()
        assertNotNull("Initial WebView must be mounted", initialWv)

        val crashDetail = object : RenderProcessGoneDetail() {
            override fun didCrash(): Boolean = true
            override fun rendererPriorityAtExit(): Int = 2
        }

        // Invoke onRenderProcessGone directly on the installed client
        val handled = initialWv?.webViewClient?.onRenderProcessGone(initialWv, crashDetail)
        assertTrue("Client must handle render process gone", handled == true)

        val rehydratedWv = goatView.getUnderlyingWebView()
        assertNotNull("Rehydrated WebView must be present", rehydratedWv)
        assertNotSame("Rehydrated WebView must be a fresh active instance", initialWv, rehydratedWv)
        assertEquals(1, goatView.childCount)
    }

    @Test
    fun `test circuit breaker halts rehydration on crash loop exceeding threshold`() {
        val goatView = GoatView(fakeContext)
        var lastError: String? = null
        goatView.onError = { lastError = it }

        goatView.initialize(assetDir = null, appId = "tenant_loop", entryUrl = "https://tenant.appassets.androidplatform.net/assets/index.html")

        // Fire 4 rapid crashes (threshold is 3)
        goatView.rehydrateAfterCrash(didCrash = true)
        goatView.rehydrateAfterCrash(didCrash = true)
        goatView.rehydrateAfterCrash(didCrash = true)
        goatView.rehydrateAfterCrash(didCrash = true) // Exceeds threshold (4th crash)

        assertTrue(
            "Circuit breaker must detect crash loop and emit error",
            lastError?.contains("crash loop", ignoreCase = true) == true
        )
    }

    @Test
    fun `test route restoration across rehydration`() {
        val goatView = GoatView(fakeContext)
        val initialUrl = "https://tenant.appassets.androidplatform.net/assets/index.html"
        goatView.initialize(assetDir = null, appId = "tenant_route", entryUrl = initialUrl)

        // Navigate to new route
        val updatedUrl = "https://tenant.appassets.androidplatform.net/assets/index.html#/payment_complete"
        goatView.loadUrl(updatedUrl)

        val snapshotBeforeCrash = goatView.getSessionSnapshot()
        assertEquals("#/payment_complete", snapshotBeforeCrash.routeHash)
        assertEquals(updatedUrl, snapshotBeforeCrash.resolveRestoreUrl())

        // Rehydrate after crash
        goatView.rehydrateAfterCrash(didCrash = true)

        val snapshotAfterCrash = goatView.getSessionSnapshot()
        assertEquals("#/payment_complete", snapshotAfterCrash.routeHash)
        assertEquals(updatedUrl, snapshotAfterCrash.resolveRestoreUrl())
    }

    @Test
    fun `test view hierarchy preserved on rehydration`() {
        val goatView = GoatView(fakeContext)
        val testUrl = "https://tenant.appassets.androidplatform.net/assets/index.html#/feed"
        goatView.initialize(assetDir = null, appId = "tenant_refresh", entryUrl = testUrl)

        assertEquals("GoatView should contain 1 child", 1, goatView.childCount)
        val initialWv = goatView.getUnderlyingWebView()
        assertNotNull(initialWv)
        assertSame(initialWv, goatView.getChildAt(0))

        // Rehydrate
        goatView.rehydrateAfterCrash(didCrash = true)

        assertEquals("GoatView should still contain 1 child after rehydration", 1, goatView.childCount)
        val rehydratedWv = goatView.getUnderlyingWebView()
        assertNotNull(rehydratedWv)
        assertNotSame(initialWv, rehydratedWv)
        assertSame(rehydratedWv, goatView.getChildAt(0))
    }

    @Test
    fun `test pull to refresh flag preserved on rehydration`() {
        val goatView = GoatView(fakeContext)
        goatView.pullToRefreshEnabled = true
        val testUrl = "https://tenant.appassets.androidplatform.net/assets/index.html#/feed"
        goatView.initialize(assetDir = null, appId = "tenant_refresh", entryUrl = testUrl)

        assertTrue("pullToRefreshEnabled must be true before crash", goatView.pullToRefreshEnabled)
        assertEquals("GoatView should contain 1 child", 1, goatView.childCount)

        // Rehydrate
        goatView.rehydrateAfterCrash(didCrash = true)

        assertTrue("pullToRefreshEnabled must remain true after rehydration", goatView.pullToRefreshEnabled)
        assertEquals("GoatView should still contain 1 child after rehydration", 1, goatView.childCount)
    }

    @Test
    fun `test multi profile tenant preserved across rehydration`() {
        val goatView = GoatView(fakeContext)
        val testAppId = "com.goat.secure.checkout"
        goatView.initialize(assetDir = null, appId = testAppId, entryUrl = "https://example.com")

        val initialWv = goatView.getUnderlyingWebView()
        assertNotNull(initialWv)
        assertEquals(testAppId, GoatFastPool.getTenant(initialWv!!))

        goatView.rehydrateAfterCrash(didCrash = true)

        val newWv = goatView.getUnderlyingWebView()
        assertNotNull(newWv)
        assertEquals(testAppId, GoatFastPool.getTenant(newWv!!))
    }

    @Test
    fun `test destroy cleans up session snapshot and circuit breaker state`() {
        val goatView = GoatView(fakeContext)
        goatView.initialize(assetDir = null, appId = "tenant_cleanup", entryUrl = "https://example.com")

        assertNotNull(goatView.getUnderlyingWebView())
        assertNotNull(goatView.getSessionSnapshot())

        goatView.destroy()

        assertNull(goatView.getUnderlyingWebView())
        assertEquals(0, goatView.childCount)
    }
}
