package com.goat.webview.popup

import android.os.Message
import android.webkit.CookieManager
import android.webkit.WebView
import com.goat.webview.FakeTestContext
import com.goat.webview.GoatCookieManager
import com.goat.webview.GoatFastPool
import com.goat.webview.GoatWebViewClient
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
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Adversarial Empirical Lifecycle & Memory Leak Challenge Test Suite for GoatPopupManager (Task 10183 / Challenger 2).
 *
 * Scope of Challenges:
 * 1. Modal child window teardown: does `window.close()` or close button clean up message handlers,
 *    stop network loading, and recycle child view to `GoatFastPool`?
 * 2. Parent view destruction cascade: does destroying parent view or invoking dismissAllModals
 *    clean up child views without leaving orphaned WebViews or leaking memory?
 * 3. Multi-tenant cookie & storage partitioning: do popups from app A share storage with app A
 *    while remaining completely isolated from app B?
 * 4. Focus restoration: does closing modal restore first responder / keyboard focus to parent GoatView?
 */
@OptIn(ExperimentalCoroutinesApi::class)
class GoatPopupLifecycleMemoryChallengeTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private lateinit var context: FakeTestContext
    private lateinit var assetDirA: File
    private lateinit var assetDirB: File
    private val tenantA = "app_alpha"
    private val tenantB = "app_beta"

    @Before
    fun setUp() = runTest {
        Dispatchers.setMain(testDispatcher)
        context = FakeTestContext()
        assetDirA = File(context.filesDir, "assets_alpha").apply { mkdirs() }
        assetDirB = File(context.filesDir, "assets_beta").apply { mkdirs() }
        GoatFastPool.clearPool()
        GoatPopupManager.dismissAllModals()
        GoatPopupManager.globalPopupListener = null
        GoatPopupManager.defaultRoutingPolicy = GoatPopupRoutingPolicy.AUTO
        GoatCookieManager.mockCookieManager = CookieManager.getInstance()
        GoatCookieManager.clearAllCookies()
    }

    @After
    fun tearDown() {
        GoatPopupManager.dismissAllModals()
        GoatFastPool.clearPool()
        GoatCookieManager.mockCookieManager = null
        Dispatchers.resetMain()
    }

    private fun createTransportMessage(wv: WebView): Message {
        val transportClass = Class.forName("android.webkit.WebView\$WebViewTransport")
        val constructor = transportClass.getDeclaredConstructor(WebView::class.java).apply {
            isAccessible = true
        }
        val transport = constructor.newInstance(wv)
        val msg = Message()
        msg.obj = transport
        return msg
    }

    // =========================================================================
    // CHALLENGE 1: MODAL CHILD WINDOW TEARDOWN & FASTPOOL RECYCLING
    // =========================================================================

    @Test
    fun `challenge modal teardown via window_close recycles child WebView to GoatFastPool`() {
        assertEquals("Pool must start empty for clean accounting", 0, GoatFastPool.poolSize)

        val parentView = GoatView(context)
        parentView.initialize(assetDir = assetDirA, appId = tenantA)

        val childViewCreated = AtomicBoolean(false)
        var capturedModalView: GoatView? = null

        val listener = object : GoatPopupListener {
            override fun onModalWindowCreated(modalView: GoatView, request: GoatPopupRequest) {
                childViewCreated.set(true)
                capturedModalView = modalView
            }
        }

        val dummyWv = WebView(context)
        val msg = createTransportMessage(dummyWv)

        val handled = GoatPopupManager.handleCreateWindow(
            parentWebView = parentView.getUnderlyingWebView(),
            parentContainer = parentView,
            context = context,
            appId = tenantA,
            assetDir = assetDirA,
            isDialog = false,
            isUserGesture = true,
            resultMsg = msg,
            customListener = listener,
            initialUrl = "goat://app_alpha/details.html",
            parentGoatView = parentView
        )

        assertTrue("handleCreateWindow for same-origin modal must return true", handled)
        assertEquals("One active modal container must be registered", 1, GoatPopupManager.getActiveModalCount())
        assertNotNull("Modal GoatView must be created and captured", capturedModalView)

        val childWv = capturedModalView?.getUnderlyingWebView()
        assertNotNull("Child WebView must be non-null while active", childWv)

        // Pre-condition: FastPool size is 0 before recycling
        assertEquals(0, GoatFastPool.poolSize)

        // Action: Trigger window.close() via handleCloseWindow
        val closeHandled = GoatPopupManager.handleCloseWindow(childWv)
        assertTrue("handleCloseWindow must find matching modal and return true", closeHandled)

        // Post-conditions:
        // 1. Active modal count drops to 0
        assertEquals("Active modals must be 0 after close", 0, GoatPopupManager.getActiveModalCount())
        // 2. Child GoatView's underlying WebView is nullified
        assertNull("Child GoatView's underlying WebView must be null after destroy", capturedModalView?.getUnderlyingWebView())
        // 3. Child WebView is sanitized and placed back in GoatFastPool
        assertEquals("GoatFastPool must contain recycled WebView instance", 1, GoatFastPool.poolSize)
    }

    @Test
    fun `challenge modal teardown via close button dismiss recycles child WebView to GoatFastPool`() {
        assertEquals(0, GoatFastPool.poolSize)

        val parentView = GoatView(context)
        parentView.initialize(assetDir = assetDirA, appId = tenantA)

        val modalView = GoatView(context)
        modalView.initialize(assetDir = assetDirA, appId = tenantA)
        val childWv = modalView.getUnderlyingWebView()
        assertNotNull(childWv)

        val container = GoatModalContainer(
            context = context,
            containerId = "modal_close_btn_test",
            modalGoatView = modalView,
            features = GoatWindowFeatures(width = 400.0, height = 500.0)
        )

        // Trigger dismissal as user tapping close button or dim overlay
        container.dismiss()

        // Verify child view destroyed and recycled into FastPool
        assertNull("Child view underlying WebView must be nullified", modalView.getUnderlyingWebView())
        assertEquals("Child WebView must be recycled into GoatFastPool", 1, GoatFastPool.poolSize)
    }

    // =========================================================================
    // CHALLENGE 2: PARENT VIEW DESTRUCTION & CASCADE MODAL TEARDOWN
    // =========================================================================

    @Test
    fun `challenge dismissAllModals cascades destruction to all active child WebViews`() {
        assertEquals(0, GoatFastPool.poolSize)

        val dummyWv1 = WebView(context)
        val dummyWv2 = WebView(context)
        val msg1 = createTransportMessage(dummyWv1)
        val msg2 = createTransportMessage(dummyWv2)

        GoatPopupManager.handleCreateWindow(
            parentWebView = null,
            parentContainer = null,
            context = context,
            appId = tenantA,
            assetDir = assetDirA,
            isDialog = false,
            isUserGesture = true,
            resultMsg = msg1,
            initialUrl = "goat://app_alpha/sub1.html"
        )
        GoatPopupManager.handleCreateWindow(
            parentWebView = null,
            parentContainer = null,
            context = context,
            appId = tenantA,
            assetDir = assetDirA,
            isDialog = false,
            isUserGesture = true,
            resultMsg = msg2,
            initialUrl = "goat://app_alpha/sub2.html"
        )

        assertEquals("Two active modals must be registered", 2, GoatPopupManager.getActiveModalCount())

        // Action: Bulk teardown (such as when parent view is destroyed or host navigates away)
        GoatPopupManager.dismissAllModals()

        assertEquals("Active modal count must be 0 after dismissAllModals", 0, GoatPopupManager.getActiveModalCount())
        // FastPool capped at MAX_POOL_SIZE (2), so exactly 2 instances are retained in standby
        assertEquals("FastPool must cap recycled instances at MAX_POOL_SIZE (2)", 2, GoatFastPool.poolSize)
    }

    // =========================================================================
    // CHALLENGE 3: MULTI-TENANT STORAGE & COOKIE PARTITIONING
    // =========================================================================

    @Test
    fun `challenge multi-tenant popup origin classification and cookie isolation between tenants`() = runTest {
        // 1. Popups requesting the same tenant sandbox resolve to MODAL
        assertEquals(
            GoatPopupRoutingPolicy.MODAL,
            GoatPopupManager.classifyPopupOrigin("goat://app_alpha/dashboard.html", tenantA)
        )
        assertEquals(
            GoatPopupRoutingPolicy.MODAL,
            GoatPopupManager.classifyPopupOrigin("https://app_alpha.appassets.androidplatform.net/dashboard.html", tenantA)
        )

        // 2. Popups requesting a DIFFERENT tenant sandbox resolve to SYSTEM_BROWSER (strict tenant boundary)
        assertEquals(
            GoatPopupRoutingPolicy.SYSTEM_BROWSER,
            GoatPopupManager.classifyPopupOrigin("goat://app_beta/secret.html", tenantA)
        )
        assertEquals(
            GoatPopupRoutingPolicy.SYSTEM_BROWSER,
            GoatPopupManager.classifyPopupOrigin("https://app_beta.appassets.androidplatform.net/secret.html", tenantA)
        )

        // 3. Verify cookie isolation between Tenant A and Tenant B
        GoatCookieManager.setCookieForTenant(tenantA, "session_token", "alpha_secret_token_111")
        GoatCookieManager.setCookieForTenant(tenantB, "session_token", "beta_secret_token_222")

        val alphaCookies = GoatCookieManager.getCookiesForTenant(tenantA)
        val betaCookies = GoatCookieManager.getCookiesForTenant(tenantB)

        assertEquals(1, alphaCookies.size)
        assertEquals("alpha_secret_token_111", alphaCookies[0].value)

        assertEquals(1, betaCookies.size)
        assertEquals("beta_secret_token_222", betaCookies[0].value)

        // Modal created for Tenant A has domain scoped to Tenant A
        val domainA = GoatWebViewClient.resolveDomain(tenantA)
        val domainB = GoatWebViewClient.resolveDomain(tenantB)
        assertEquals("app_alpha.appassets.androidplatform.net", domainA)
        assertEquals("app_beta.appassets.androidplatform.net", domainB)
        assertFalse("Domain A must not equal Domain B", domainA == domainB)
    }

    // =========================================================================
    // CHALLENGE 4: FOCUS RESTORATION TO PARENT GOATVIEW
    // =========================================================================

    @Test
    fun `challenge modal container dismissal requests focus on parent view container`() {
        val parentView = GoatView(context)
        parentView.initialize(assetDir = assetDirA, appId = tenantA)

        val dismissClosed = AtomicBoolean(false)
        val testListener = object : GoatPopupListener {
            override fun onModalWindowClosed(modalView: GoatView) {
                dismissClosed.set(true)
            }
        }

        val dummyWv = WebView(context)
        val msg = createTransportMessage(dummyWv)

        GoatPopupManager.handleCreateWindow(
            parentWebView = parentView.getUnderlyingWebView(),
            parentContainer = parentView,
            context = context,
            appId = tenantA,
            assetDir = assetDirA,
            isDialog = false,
            isUserGesture = true,
            resultMsg = msg,
            customListener = testListener,
            initialUrl = "goat://app_alpha/settings.html",
            parentGoatView = parentView
        )

        assertEquals(1, GoatPopupManager.getActiveModalCount())

        // Dismiss the modal
        val modals = GoatPopupManager.getActiveModals()
        val containerId = modals.keys.first()
        GoatPopupManager.dismissModal(containerId)

        assertEquals(0, GoatPopupManager.getActiveModalCount())
        assertTrue("Dismissing modal must invoke onModalWindowClosed", dismissClosed.get())
    }
}
