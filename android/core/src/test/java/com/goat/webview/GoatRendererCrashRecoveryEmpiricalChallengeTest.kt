package com.goat.webview

import android.content.Context
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.goat.webview.view.GoatSessionSnapshot
import com.goat.webview.view.GoatView
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
import org.junit.Assert.assertNotSame
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.util.WeakHashMap

/**
 * Empirical Challenge & Adversarial Stress Test Suite for M3:
 * Android Renderer Crash Isolation, Surface Rehydration, Session Restoration, and Circuit Breaker.
 *
 * Designed and executed by EMPIRICAL CHALLENGER 2 to stress-test assumptions and surface defects.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class GoatRendererCrashRecoveryEmpiricalChallengeTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private lateinit var fakeContext: FakeTestContext
    private lateinit var assetDir: File

    @Before
    fun setUp() = runTest {
        Dispatchers.setMain(testDispatcher)
        fakeContext = FakeTestContext()
        assetDir = File(fakeContext.filesDir, "test_bundle_challenge").apply { mkdirs() }
        GoatFastPool.clearPool()
    }

    @After
    fun tearDown() {
        GoatFastPool.clearPool()
        Dispatchers.resetMain()
    }

    private fun createDetail(didCrashValue: Boolean, exitPriority: Int): RenderProcessGoneDetail {
        return object : RenderProcessGoneDetail() {
            override fun didCrash(): Boolean = didCrashValue
            override fun rendererPriorityAtExit(): Int = exitPriority
        }
    }

    // =========================================================================
    // 1. CRASH ISOLATION MATRIX (didCrash = true/false, priority codes, nulls)
    // =========================================================================

    @Test
    fun `test onRenderProcessGone isolates content crash and memory kill across all exit priorities`() {
        val priorities = listOf(
            0, // RENDERER_PRIORITY_WAIVED
            1, // RENDERER_PRIORITY_BOUND
            2, // RENDERER_PRIORITY_IMPORTANT
            -1 // Unknown priority
        )

        for (priority in priorities) {
            // Case A: didCrash = true (Content crash / SIGSEGV / SIGKILL)
            var crashReported: Boolean? = null
            var rehydrateTriggered = false
            val clientCrash = GoatWebViewClient(
                context = fakeContext,
                extractedDir = assetDir,
                appId = "tenant_prio_crash",
                onRenderCrashed = { crashReported = it },
                onRehydrationHandler = { rehydrateTriggered = true }
            )
            val resultCrash = clientCrash.onRenderProcessGone(null, createDetail(true, priority))
            assertTrue("Must return true for crash with priority $priority", resultCrash)
            assertEquals("onRenderCrashed didCrash must be true", true, crashReported)
            assertTrue("onRehydrationHandler must fire for priority $priority", rehydrateTriggered)

            // Case B: didCrash = false (LMK / Android OS memory kill)
            var lmkReported: Boolean? = null
            var lmkRehydrateTriggered = false
            val clientLmk = GoatWebViewClient(
                context = fakeContext,
                extractedDir = assetDir,
                appId = "tenant_prio_lmk",
                onRenderCrashed = { lmkReported = it },
                onRehydrationHandler = { lmkRehydrateTriggered = true }
            )
            val resultLmk = clientLmk.onRenderProcessGone(null, createDetail(false, priority))
            assertTrue("Must return true for LMK kill with priority $priority", resultLmk)
            assertEquals("onRenderCrashed didCrash must be false for LMK", false, lmkReported)
            assertTrue("onRehydrationHandler must fire for LMK priority $priority", lmkRehydrateTriggered)
        }
    }

    @Test
    fun `test onRenderProcessGone handles null view and null detail without NPE`() {
        var crashNotified = false
        var rehydrateNotified = false
        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = assetDir,
            appId = "tenant_nulls",
            onRenderCrashed = { crashNotified = true },
            onRehydrationHandler = { rehydrateNotified = true }
        )

        val handled = client.onRenderProcessGone(null, null)
        assertTrue("Must return true even with null view and null detail", handled)
        assertTrue("Listeners must be notified safely", crashNotified && rehydrateNotified)
    }

    @Test
    fun `test onRenderProcessGone catches view destroy exception and still isolates crash`() {
        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = assetDir,
            appId = "tenant_throwing_view",
            onRenderCrashed = { },
            onRehydrationHandler = { }
        )

        val faultyView = object : WebView(fakeContext) {
            override fun destroy() {
                throw RuntimeException("Simulated native crash during view.destroy()")
            }
            override fun stopLoading() {
                throw RuntimeException("Simulated error in stopLoading()")
            }
        }

        val handled = client.onRenderProcessGone(faultyView, createDetail(true, 2))
        assertTrue("Must swallow view cleanup exceptions and return true to prevent host crash", handled)
    }

    // =========================================================================
    // 2. SURFACE REHYDRATION & FASTPOOL LIFECYCLE
    // =========================================================================

    @Test
    fun `test surface rehydration reuses same-tenant pooled instance from GoatFastPool`() {
        val appId = "com.goat.tenant.rehydrate"
        val goatView = GoatView(fakeContext)
        goatView.initialize(assetDir = null, appId = appId, entryUrl = "https://example.com/app1")

        val initialWv = goatView.getUnderlyingWebView()
        assertNotNull(initialWv)

        // Pre-warm an instance in GoatFastPool and tag it with matching appId
        val standbyWv = GoatFastPool.createWarmWebView(fakeContext, warmNavigate = false)
        GoatFastPool.tagTenant(standbyWv, appId)
        GoatFastPool.recycle(standbyWv)

        // Trigger crash rehydration
        goatView.rehydrateAfterCrash(didCrash = true)

        val freshWv = goatView.getUnderlyingWebView()
        assertNotNull(freshWv)
        assertNotSame("Must not be the old crashed instance", initialWv, freshWv)
        assertEquals("Should reuse matching pooled instance", standbyWv, freshWv)
        assertEquals("Tenant tag must match", appId, GoatFastPool.getTenant(freshWv!!))
        assertEquals(1, goatView.childCount)
    }

    @Test
    fun `test surface rehydration discards mismatched tenant pooled instance and creates fresh`() {
        val currentAppId = "com.goat.tenant.active"
        val otherAppId = "com.goat.tenant.other"

        val goatView = GoatView(fakeContext)
        goatView.initialize(assetDir = null, appId = currentAppId, entryUrl = "https://example.com/app2")

        val initialWv = goatView.getUnderlyingWebView()

        // Park an instance bound to OTHER tenant in the pool
        val mismatchedWv = GoatFastPool.createWarmWebView(fakeContext, warmNavigate = false)
        GoatFastPool.tagTenant(mismatchedWv, otherAppId)
        GoatFastPool.recycle(mismatchedWv)

        // Trigger rehydration
        goatView.rehydrateAfterCrash(didCrash = true)

        val freshWv = goatView.getUnderlyingWebView()
        assertNotNull(freshWv)
        assertNotSame("Must discard mismatched instance", mismatchedWv, freshWv)
        assertNotSame("Must not be the initial crashed instance", initialWv, freshWv)
        assertEquals("Fresh instance must be tagged with currentAppId", currentAppId, GoatFastPool.getTenant(freshWv!!))
    }

    @Test
    fun `test surface rehydration discards dead renderer when tracked in deadRenderers`() {
        val appId = "com.goat.tenant.deadpool"
        val goatView = GoatView(fakeContext)
        goatView.initialize(assetDir = null, appId = appId, entryUrl = "https://example.com/app3")

        val initialWv = goatView.getUnderlyingWebView()

        // Create a standby instance in pool
        val standbyWv = GoatFastPool.createWarmWebView(fakeContext, warmNavigate = false)
        GoatFastPool.recycle(standbyWv)

        // Mark standby instance in deadRenderers set via reflection
        val deadSetField = GoatFastPool::class.java.getDeclaredField("deadRenderers").apply { isAccessible = true }
        @Suppress("UNCHECKED_CAST")
        val deadSet = deadSetField.get(GoatFastPool) as java.util.Set<WebView>
        synchronized(deadSet) {
            deadSet.add(standbyWv)
        }

        // Trigger crash rehydration on active goatView
        goatView.rehydrateAfterCrash(didCrash = true)

        val freshWv = goatView.getUnderlyingWebView()
        assertNotNull(freshWv)
        assertNotSame("Must discard dead standby instance when registered in deadRenderers", standbyWv, freshWv)
        assertNotSame("Must replace initial instance", initialWv, freshWv)
        assertEquals(1, goatView.childCount)
    }

    @Test
    fun `test view hierarchy integrity under pullToRefresh across multiple rehydrations`() {
        val goatView = GoatView(fakeContext)
        goatView.pullToRefreshEnabled = true
        val testUrl = "https://tenant.appassets.androidplatform.net/assets/index.html#/feed"
        goatView.initialize(assetDir = null, appId = "tenant_srl_test", entryUrl = testUrl)

        assertEquals("Should have exactly 1 direct child in GoatView", 1, goatView.childCount)
        val initialWv = goatView.getUnderlyingWebView()
        assertNotNull(initialWv)

        // Rehydrate 1st time
        goatView.rehydrateAfterCrash(didCrash = true)
        assertEquals("Child count must remain 1 after 1st rehydration", 1, goatView.childCount)
        val wv1 = goatView.getUnderlyingWebView()
        assertNotNull(wv1)
        assertNotSame(initialWv, wv1)

        // Rehydrate 2nd time
        goatView.rehydrateAfterCrash(didCrash = false)
        assertEquals("Child count must remain 1 after 2nd rehydration", 1, goatView.childCount)
        val wv2 = goatView.getUnderlyingWebView()
        assertNotNull(wv2)
        assertNotSame(wv1, wv2)
    }

    @Test
    fun `test bridge routing remains functional on rehydrated webview`() = runTest {
        val goatView = GoatView(fakeContext)
        var actionReceived: String? = null
        var payloadValue: String? = null

        goatView.onBridgeAction = { action, payload ->
            actionReceived = action
            payloadValue = payload["key"]?.toString()?.trim('"')
            Result.success(buildJsonObject { put("status", "ok") })
        }

        goatView.initialize(assetDir = null, appId = "tenant_bridge_test", entryUrl = "https://example.com")
        val initialWv = goatView.getUnderlyingWebView()!!

        // Test route on initial WV
        val initialReq = buildJsonObject { put("key", "initial") }
        val res1 = GoatFastPool.routeBridge(initialWv, "ACTION_1", initialReq)
        assertTrue(res1.isSuccess)
        assertEquals("ACTION_1", actionReceived)
        assertEquals("initial", payloadValue)

        // Crash and rehydrate
        goatView.rehydrateAfterCrash(didCrash = true)

        val freshWv = goatView.getUnderlyingWebView()!!
        assertNotSame(initialWv, freshWv)

        // Test route on fresh rehydrated WV
        val freshReq = buildJsonObject { put("key", "fresh") }
        val res2 = GoatFastPool.routeBridge(freshWv, "ACTION_2", freshReq)
        assertTrue("Fresh WebView must have working bridge route", res2.isSuccess)
        assertEquals("ACTION_2", actionReceived)
        assertEquals("fresh", payloadValue)
    }

    // =========================================================================
    // 3. SESSION STATE RESTORATION MATRIX (URLs, Hashes, Bundles, Settings)
    // =========================================================================

    @Test
    fun `test session snapshot resolveRestoreUrl comprehensive permutations`() {
        // 1. Simple confirmed URL without hash
        val s1 = GoatSessionSnapshot(
            entryUrl = "https://app.local/index.html",
            confirmedUrl = "https://app.local/dashboard.html",
            routeHash = null
        )
        assertEquals("https://app.local/dashboard.html", s1.resolveRestoreUrl())

        // 2. Confirmed URL + routeHash with leading '#'
        val s2 = GoatSessionSnapshot(
            entryUrl = "https://app.local/index.html",
            confirmedUrl = "https://app.local/index.html",
            routeHash = "#/profile/settings"
        )
        assertEquals("https://app.local/index.html#/profile/settings", s2.resolveRestoreUrl())

        // 3. Confirmed URL + routeHash WITHOUT leading '#'
        val s3 = GoatSessionSnapshot(
            entryUrl = "https://app.local/index.html",
            confirmedUrl = "https://app.local/index.html",
            routeHash = "profile/settings"
        )
        assertEquals("https://app.local/index.html#profile/settings", s3.resolveRestoreUrl())

        // 4. Confirmed URL already containing hash - routeHash replaces existing hash
        val s4 = GoatSessionSnapshot(
            entryUrl = "https://app.local/index.html",
            confirmedUrl = "https://app.local/index.html#/existing/hash",
            routeHash = "#/ignored"
        )
        assertEquals("https://app.local/index.html#/ignored", s4.resolveRestoreUrl())

        // 5. Query parameters in base URL + routeHash
        val s5 = GoatSessionSnapshot(
            entryUrl = "https://app.local/index.html?tenant=alpha&debug=1",
            confirmedUrl = "https://app.local/index.html?tenant=alpha&debug=1",
            routeHash = "#/checkout?step=3"
        )
        assertEquals("https://app.local/index.html?tenant=alpha&debug=1#/checkout?step=3", s5.resolveRestoreUrl())

        // 6. Confirmed URL is about:blank -> fall back to entryUrl + routeHash
        val s6 = GoatSessionSnapshot(
            entryUrl = "https://app.local/main.html",
            confirmedUrl = "about:blank",
            routeHash = "#/home"
        )
        assertEquals("https://app.local/main.html#/home", s6.resolveRestoreUrl())

        // 7. Entry URL with old hash replaced by new routeHash
        val s7 = GoatSessionSnapshot(
            entryUrl = "https://app.local/index.html#/oldRoute",
            confirmedUrl = null,
            routeHash = "#/newRoute"
        )
        assertEquals("https://app.local/index.html#/newRoute", s7.resolveRestoreUrl())

        // 8. Both confirmed and entry are null -> returns about:blank
        val s8 = GoatSessionSnapshot(
            entryUrl = null,
            confirmedUrl = null,
            routeHash = "#/lost"
        )
        assertEquals("about:blank", s8.resolveRestoreUrl())
    }

    @Test
    fun `test dynamic in-page route navigation survives crash and rehydrates to active route`() {
        val goatView = GoatView(fakeContext)
        val initialUrl = "https://tenant.appassets.androidplatform.net/assets/index.html"
        goatView.initialize(assetDir = null, appId = "tenant_dyn_nav", entryUrl = initialUrl)

        val client = goatView.getUnderlyingWebView()?.webViewClient as? GoatWebViewClient
        assertNotNull("GoatWebViewClient must be installed", client)

        client?.doUpdateVisitedHistory(
            goatView.getUnderlyingWebView(),
            "https://tenant.appassets.androidplatform.net/assets/index.html#/products",
            false
        )
        assertEquals("#/products", goatView.getSessionSnapshot().routeHash)

        client?.doUpdateVisitedHistory(
            goatView.getUnderlyingWebView(),
            "https://tenant.appassets.androidplatform.net/assets/index.html#/checkout/pay",
            false
        )
        assertEquals("#/checkout/pay", goatView.getSessionSnapshot().routeHash)
        assertEquals(
            "https://tenant.appassets.androidplatform.net/assets/index.html#/checkout/pay",
            goatView.getSessionSnapshot().resolveRestoreUrl()
        )

        // Crash and recover
        goatView.rehydrateAfterCrash(didCrash = true)

        val postCrashSnapshot = goatView.getSessionSnapshot()
        assertEquals("#/checkout/pay", postCrashSnapshot.routeHash)
        assertEquals(
            "https://tenant.appassets.androidplatform.net/assets/index.html#/checkout/pay",
            postCrashSnapshot.resolveRestoreUrl()
        )
    }

    @Test
    fun `test textZoom and bundle settings are preserved on rehydrated instance`() {
        val goatView = GoatView(fakeContext)
        goatView.initialize(assetDir = null, appId = "tenant_zoom", entryUrl = "https://example.com")

        goatView.setTextZoom(145)
        assertEquals("Snapshot textZoom before crash must be 145", 145, goatView.getSessionSnapshot().textZoom)

        // Crash and rehydrate
        goatView.rehydrateAfterCrash(didCrash = true)

        val freshWv = goatView.getUnderlyingWebView()
        assertNotNull(freshWv)
        assertEquals("Snapshot textZoom after crash must be 145", 145, goatView.getSessionSnapshot().textZoom)
    }

    // =========================================================================
    // 4. CIRCUIT BREAKER RESILIENCE & EDGE CASES
    // =========================================================================

    @Test
    fun `test circuit breaker permits up to 3 rapid crashes and halts on 4th crash`() {
        val goatView = GoatView(fakeContext)
        val errorsReceived = mutableListOf<String>()
        goatView.onError = { errorsReceived.add(it) }

        goatView.initialize(assetDir = null, appId = "tenant_breaker_exact", entryUrl = "https://example.com/loop")

        val initialWv = goatView.getUnderlyingWebView()
        assertNotNull(initialWv)

        // Crash 1: Allowed
        goatView.rehydrateAfterCrash(didCrash = true)
        val wvAfter1 = goatView.getUnderlyingWebView()
        assertNotSame(initialWv, wvAfter1)
        assertEquals(1, goatView.childCount)

        // Crash 2: Allowed
        goatView.rehydrateAfterCrash(didCrash = true)
        val wvAfter2 = goatView.getUnderlyingWebView()
        assertNotSame(wvAfter1, wvAfter2)
        assertEquals(1, goatView.childCount)

        // Crash 3: Allowed (Threshold = 3)
        goatView.rehydrateAfterCrash(didCrash = true)
        val wvAfter3 = goatView.getUnderlyingWebView()
        assertNotSame(wvAfter2, wvAfter3)
        assertEquals(1, goatView.childCount)

        // Crash 4: Circuit breaker TRIPS! (Threshold exceeded)
        goatView.rehydrateAfterCrash(didCrash = true)
        val wvAfter4 = goatView.getUnderlyingWebView()
        assertSame("No new surface created when circuit breaker is tripped", wvAfter3, wvAfter4)

        // Verify crash loop error was delivered
        val loopErrors = errorsReceived.filter { it.contains("crash loop", ignoreCase = true) }
        assertEquals("Circuit breaker loop error must fire on 4th crash", 1, loopErrors.size)

        // Crash 5: Remains tripped
        goatView.rehydrateAfterCrash(didCrash = true)
        val loopErrorsAfter5 = errorsReceived.filter { it.contains("crash loop", ignoreCase = true) }
        assertEquals("Circuit breaker loop error must fire again on 5th crash", 2, loopErrorsAfter5.size)
    }

    @Test
    fun `test circuit breaker resets after destroy and permits recovery again`() {
        val goatView = GoatView(fakeContext)
        var loopErrorDetected = false
        goatView.onError = {
            if (it.contains("crash loop", ignoreCase = true)) {
                loopErrorDetected = true
            }
        }

        goatView.initialize(assetDir = null, appId = "tenant_reset", entryUrl = "https://example.com")

        // Trip the circuit breaker (4 crashes)
        goatView.rehydrateAfterCrash(didCrash = true)
        goatView.rehydrateAfterCrash(didCrash = true)
        goatView.rehydrateAfterCrash(didCrash = true)
        goatView.rehydrateAfterCrash(didCrash = true)
        assertTrue(loopErrorDetected)

        // Destroy cleans up circuit breaker state
        goatView.destroy()
        assertNull(goatView.getUnderlyingWebView())

        // Re-initialize view
        loopErrorDetected = false
        goatView.initialize(assetDir = null, appId = "tenant_reset", entryUrl = "https://example.com")
        assertNotNull(goatView.getUnderlyingWebView())

        // Crash 1 on clean slate must succeed
        goatView.rehydrateAfterCrash(didCrash = true)
        assertFalse("Circuit breaker must NOT trip on freshly re-initialized view", loopErrorDetected)
        assertEquals(1, goatView.childCount)
    }

    @Test
    fun `test circuit breaker isolation across multiple independent GoatView instances`() {
        val goatView1 = GoatView(fakeContext)
        val goatView2 = GoatView(fakeContext)

        var breaker1Tripped = false
        var breaker2Tripped = false
        goatView1.onError = { if (it.contains("crash loop", ignoreCase = true)) breaker1Tripped = true }
        goatView2.onError = { if (it.contains("crash loop", ignoreCase = true)) breaker2Tripped = true }

        goatView1.initialize(assetDir = null, appId = "tenant_view_1", entryUrl = "https://app1.local")
        goatView2.initialize(assetDir = null, appId = "tenant_view_2", entryUrl = "https://app2.local")

        // Trip circuit breaker on view 1
        repeat(4) { goatView1.rehydrateAfterCrash(didCrash = true) }
        assertTrue("GoatView 1 breaker must trip", breaker1Tripped)

        // Trigger crash on view 2: must recover normally!
        val wv2Before = goatView2.getUnderlyingWebView()
        goatView2.rehydrateAfterCrash(didCrash = true)
        val wv2After = goatView2.getUnderlyingWebView()

        assertFalse("GoatView 2 breaker must NOT trip due to GoatView 1 crash loop", breaker2Tripped)
        assertNotSame("GoatView 2 must cleanly rehydrate to a new surface", wv2Before, wv2After)
        assertEquals(1, goatView2.childCount)
    }

    @Test
    fun `test circuit breaker resets count when crash occurs outside 15 second window`() {
        val goatView = GoatView(fakeContext)
        var loopErrorDetected = false
        goatView.onError = {
            if (it.contains("crash loop", ignoreCase = true)) {
                loopErrorDetected = true
            }
        }
        goatView.initialize(assetDir = null, appId = "tenant_window", entryUrl = "https://example.com")

        // 2 rapid crashes
        goatView.rehydrateAfterCrash(didCrash = true)
        goatView.rehydrateAfterCrash(didCrash = true)

        // Use reflection to simulate passage of 16 seconds on lastCrashTimestamp
        val field = GoatView::class.java.getDeclaredField("lastCrashTimestamp").apply { isAccessible = true }
        val fakeOldTimestamp = System.currentTimeMillis() - 16_000L // 16 seconds ago
        field.set(goatView, fakeOldTimestamp)

        // Now trigger 2 more crashes: since 16s elapsed, count resets to 1, then 2 (does NOT trip at 4)
        goatView.rehydrateAfterCrash(didCrash = true) // resets to 1
        goatView.rehydrateAfterCrash(didCrash = true) // increments to 2

        assertFalse("Circuit breaker must NOT trip because crashes were spaced apart by >15s", loopErrorDetected)
        assertEquals(1, goatView.childCount)
    }

    // =========================================================================
    // 5. EMPIRICALLY CONFIRMED ARCHITECTURAL DEFECTS & REMEDIATION VERIFICATION
    // =========================================================================

    @Test
    fun `test DEFECT 1 - recycled webview in GoatFastPool retains DeadRendererGuard rather than losing it`() {
        // Step 1: Newly created warm WebView has DeadRendererGuard installed
        val freshWv = GoatFastPool.createWarmWebView(fakeContext, warmNavigate = false)
        val initialClient = freshWv.webViewClient
        assertNotNull(initialClient)
        assertTrue(
            "Newly created warm WebView must have DeadRendererGuard, but was ${initialClient?.javaClass?.name}",
            initialClient?.javaClass?.name?.contains("DeadRendererGuard") == true
        )

        // Step 2: Recycle the WebView into GoatFastPool
        GoatFastPool.recycle(freshWv)

        // Step 3: Inspect webViewClient after recycle()
        val clientAfterRecycle = freshWv.webViewClient
        val isStillDeadRendererGuard = clientAfterRecycle?.javaClass?.name?.contains("DeadRendererGuard") == true

        // REMEDIATION VERIFIED: sanitizeWebView retains DeadRendererGuard so idle low-memory kills are caught
        assertTrue(
            "REMEDIATION VERIFIED: sanitizeWebView retains DeadRendererGuard",
            isStillDeadRendererGuard
        )
    }

    @Test
    fun `test DEFECT 2 - uncaught exception in onRenderCrashed is safely caught and does not crash host process`() {
        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = assetDir,
            appId = "tenant_crash_handler_defect",
            onRenderCrashed = { throw RuntimeException("Simulated host exception in onRenderCrashed") },
            onRehydrationHandler = { }
        )

        var thrownException: Throwable? = null
        try {
            client.onRenderProcessGone(null, createDetail(true, 2))
        } catch (t: Throwable) {
            thrownException = t
        }

        // REMEDIATION VERIFIED: GoatWebViewClient wraps listener callbacks in try-catch,
        // preventing exceptions from escaping onRenderProcessGone and crashing host app.
        assertNull(
            "REMEDIATION VERIFIED: Exception in onRenderCrashed is caught and does not escape onRenderProcessGone",
            thrownException
        )
    }

    @Test
    fun `test DEFECT 3 - uncaught exception in onRehydrationHandler is safely caught and does not crash host process`() {
        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = assetDir,
            appId = "tenant_rehydrate_handler_defect",
            onRenderCrashed = { },
            onRehydrationHandler = { throw RuntimeException("Simulated exception in rehydration handler") }
        )

        var thrownException: Throwable? = null
        try {
            client.onRenderProcessGone(null, createDetail(true, 2))
        } catch (t: Throwable) {
            thrownException = t
        }

        // REMEDIATION VERIFIED: GoatWebViewClient wraps rehydration handler in try-catch,
        // preventing exceptions from escaping onRenderProcessGone.
        assertNull(
            "REMEDIATION VERIFIED: Exception in onRehydrationHandler is caught and does not escape onRenderProcessGone",
            thrownException
        )
    }

    @Test
    fun `test DEFECT 4 - resolveRestoreUrl replaces stale hash if confirmedUrl already contains an old hash fragment`() {
        // If confirmedUrl already has a hash fragment, resolveRestoreUrl() replaces it with routeHash
        val snapshot = GoatSessionSnapshot(
            entryUrl = "https://appassets.androidplatform.net/assets/index.html",
            confirmedUrl = "https://appassets.androidplatform.net/assets/index.html#/oldRoute",
            routeHash = "#/newRoute"
        )

        val restoredUrl = snapshot.resolveRestoreUrl()

        // REMEDIATION VERIFIED: GoatView.kt strips old hash from confirmedUrl and appends new routeHash
        assertEquals(
            "REMEDIATION VERIFIED: resolveRestoreUrl updates old route hash to new routeHash",
            "https://appassets.androidplatform.net/assets/index.html#/newRoute",
            restoredUrl
        )
    }
}
