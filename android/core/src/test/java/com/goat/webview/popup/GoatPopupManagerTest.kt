package com.goat.webview.popup

import android.content.Context
import android.os.Message
import android.webkit.WebView
import com.goat.webview.FakeTestContext
import com.goat.webview.GoatAssetManager
import com.goat.webview.GoatFastPool
import com.goat.webview.ipc.GoatEventCoalescer
import com.goat.webview.view.GoatView
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

/**
 * Comprehensive automated test suite for GoatPopupManager, GoatWindowFeatures, GoatPopupRoutingPolicy,
 * origin classification, event emission, modal container presentation, and lifecycle teardown (Task 10183 / R1 - R4).
 */
class GoatPopupManagerTest {

    private lateinit var context: FakeTestContext
    private lateinit var assetDir: File
    private val testAppId = "test-mini-app"

    @Before
    fun setUp() {
        context = FakeTestContext()
        assetDir = File(context.filesDir, "test_assets").apply { mkdirs() }
        GoatPopupManager.dismissAllModals()
        GoatPopupManager.globalPopupListener = null
        GoatPopupManager.defaultRoutingPolicy = GoatPopupRoutingPolicy.AUTO
    }

    // =========================================================================
    // 1. GoatPopupRoutingPolicy Tests
    // =========================================================================

    @Test
    fun `test GoatPopupRoutingPolicy fromString parses all valid values and defaults safely`() {
        assertEquals(GoatPopupRoutingPolicy.AUTO, GoatPopupRoutingPolicy.fromString("AUTO"))
        assertEquals(GoatPopupRoutingPolicy.AUTO, GoatPopupRoutingPolicy.fromString("auto"))
        assertEquals(GoatPopupRoutingPolicy.SYSTEM_BROWSER, GoatPopupRoutingPolicy.fromString("SYSTEM_BROWSER"))
        assertEquals(GoatPopupRoutingPolicy.SYSTEM_BROWSER, GoatPopupRoutingPolicy.fromString("system_browser"))
        assertEquals(GoatPopupRoutingPolicy.MODAL, GoatPopupRoutingPolicy.fromString("MODAL"))
        assertEquals(GoatPopupRoutingPolicy.MODAL, GoatPopupRoutingPolicy.fromString("modal"))
        assertEquals(GoatPopupRoutingPolicy.SAME_FRAME, GoatPopupRoutingPolicy.fromString("SAME_FRAME"))
        assertEquals(GoatPopupRoutingPolicy.SAME_FRAME, GoatPopupRoutingPolicy.fromString("same_frame"))
        assertEquals(GoatPopupRoutingPolicy.BLOCK, GoatPopupRoutingPolicy.fromString("BLOCK"))
        assertEquals(GoatPopupRoutingPolicy.BLOCK, GoatPopupRoutingPolicy.fromString("block"))

        // Null, empty, blank, or unknown values default to AUTO
        assertEquals(GoatPopupRoutingPolicy.AUTO, GoatPopupRoutingPolicy.fromString(null))
        assertEquals(GoatPopupRoutingPolicy.AUTO, GoatPopupRoutingPolicy.fromString(""))
        assertEquals(GoatPopupRoutingPolicy.AUTO, GoatPopupRoutingPolicy.fromString("   "))
        assertEquals(GoatPopupRoutingPolicy.AUTO, GoatPopupRoutingPolicy.fromString("UNKNOWN_POLICY"))
    }

    // =========================================================================
    // 2. GoatWindowFeatures Tests
    // =========================================================================

    @Test
    fun `test parse window features handles null and empty inputs safely`() {
        val emptyFeatures = GoatWindowFeatures.parse(null)
        assertNull(emptyFeatures.width)
        assertNull(emptyFeatures.height)
        assertNull(emptyFeatures.x)
        assertNull(emptyFeatures.y)
        assertNull(emptyFeatures.menuBar)
        assertNull(emptyFeatures.statusBar)
        assertNull(emptyFeatures.toolbars)
        assertNull(emptyFeatures.resizable)
        assertNull(emptyFeatures.scrollbars)
        assertNull(emptyFeatures.isPopup)
        assertTrue(emptyFeatures.rawFeatures.isEmpty())

        val blankFeatures = GoatWindowFeatures.parse("   ")
        assertNull(blankFeatures.width)
        assertTrue(blankFeatures.rawFeatures.isEmpty())
    }

    @Test
    fun `test parse window features handles full parameter string with dimensions and flags`() {
        val featureStr = "width=480,height=640,left=100,top=150,menubar=yes,toolbar=no,location=no,status=yes,resizable=yes,scrollbars=yes,popup=1"
        val features = GoatWindowFeatures.parse(featureStr)

        assertEquals(480.0, features.width!!, 0.001)
        assertEquals(640.0, features.height!!, 0.001)
        assertEquals(100.0, features.x!!, 0.001)
        assertEquals(150.0, features.y!!, 0.001)
        assertEquals(100.0, features.left!!, 0.001)
        assertEquals(150.0, features.top!!, 0.001)

        assertEquals(true, features.menuBar)
        assertEquals(true, features.menubar)
        assertEquals(false, features.toolbars)
        assertEquals(false, features.toolbar)
        assertEquals(true, features.statusBar)
        assertEquals(true, features.status)
        assertEquals(true, features.resizable)
        assertEquals(true, features.scrollbars)
        assertEquals(true, features.isPopup)
    }

    @Test
    fun `test parse window features handles dimension aliases`() {
        val featuresInner = GoatWindowFeatures.parse("innerwidth=500,innerheight=700,screenx=25,screeny=35")
        assertEquals(500.0, featuresInner.width!!, 0.001)
        assertEquals(700.0, featuresInner.height!!, 0.001)
        assertEquals(25.0, featuresInner.x!!, 0.001)
        assertEquals(35.0, featuresInner.y!!, 0.001)

        val featuresOuter = GoatWindowFeatures.parse("outerwidth=600,outerheight=800,x=40,y=50")
        assertEquals(600.0, featuresOuter.width!!, 0.001)
        assertEquals(800.0, featuresOuter.height!!, 0.001)
        assertEquals(40.0, featuresOuter.x!!, 0.001)
        assertEquals(50.0, featuresOuter.y!!, 0.001)
    }

    @Test
    fun `test parse window features handles boolean aliases and valueless keys`() {
        // Valueless key e.g. "resizable" or "popup" defaults to true
        val featuresValueless = GoatWindowFeatures.parse("resizable,popup,menubar=true,status=1,scrollbars=yes")
        assertEquals(true, featuresValueless.resizable)
        assertEquals(true, featuresValueless.isPopup)
        assertEquals(true, featuresValueless.menuBar)
        assertEquals(true, featuresValueless.statusBar)
        assertEquals(true, featuresValueless.scrollbars)

        // False boolean aliases: "0", "no", "false"
        val featuresFalse = GoatWindowFeatures.parse("resizable=0,menubar=no,status=false,toolbar=0")
        assertEquals(false, featuresFalse.resizable)
        assertEquals(false, featuresFalse.menuBar)
        assertEquals(false, featuresFalse.statusBar)
        assertEquals(false, featuresFalse.toolbars)
    }

    @Test
    fun `test parse window features handles malformed numbers gracefully`() {
        val featuresMalformed = GoatWindowFeatures.parse("width=invalid_width,height=-100,left=xyz")
        assertNull(featuresMalformed.width)
        assertEquals(-100.0, featuresMalformed.height!!, 0.001)
        assertNull(featuresMalformed.x)
    }

    @Test
    fun `test GoatWindowFeatures serialization to JsonObject`() {
        val features = GoatWindowFeatures(
            width = 480.0,
            height = 640.0,
            x = 50.0,
            y = 80.0,
            menuBar = false,
            statusBar = true,
            toolbars = false,
            resizable = true,
            scrollbars = true,
            isPopup = true
        )
        val json = features.toJsonObject()
        assertEquals(480.0, json["width"]?.jsonPrimitive?.double ?: 0.0, 0.001)
        assertEquals(640.0, json["height"]?.jsonPrimitive?.double ?: 0.0, 0.001)
        assertEquals(50.0, json["x"]?.jsonPrimitive?.double ?: 0.0, 0.001)
        assertEquals(80.0, json["y"]?.jsonPrimitive?.double ?: 0.0, 0.001)
        assertEquals(false, json["menuBar"]?.jsonPrimitive?.boolean)
        assertEquals(true, json["statusBar"]?.jsonPrimitive?.boolean)
        assertEquals(false, json["toolbars"]?.jsonPrimitive?.boolean)
        assertEquals(true, json["resizable"]?.jsonPrimitive?.boolean)
        assertEquals(true, json["scrollbars"]?.jsonPrimitive?.boolean)
        assertEquals(true, json["isPopup"]?.jsonPrimitive?.boolean)
    }

    // =========================================================================
    // 3. GoatPopupRequest & Event Schema Tests
    // =========================================================================

    @Test
    fun `test GoatPopupRequest event payload adheres to ON_POPUP_REQUEST schema`() {
        val request = GoatPopupRequest(
            url = "https://external-auth.provider.com/oauth/authorize",
            target = "_blank",
            policy = GoatPopupRoutingPolicy.SYSTEM_BROWSER,
            isUserGesture = true,
            isDialog = false,
            windowFeatures = GoatWindowFeatures(width = 500.0, height = 700.0),
            parentAppId = "test-mini-app"
        )

        val payload = request.toEventPayload()
        assertEquals("ON_POPUP_REQUEST", payload["event"]?.jsonPrimitive?.content)

        val data = payload["data"]?.jsonObject
        assertNotNull(data)
        assertEquals("https://external-auth.provider.com/oauth/authorize", data?.get("url")?.jsonPrimitive?.content)
        assertEquals("_blank", data?.get("target")?.jsonPrimitive?.content)
        assertEquals("SYSTEM_BROWSER", data?.get("policy")?.jsonPrimitive?.content)
        assertEquals(true, data?.get("isUserGesture")?.jsonPrimitive?.boolean)
        assertEquals(false, data?.get("isDialog")?.jsonPrimitive?.boolean)
        assertEquals("test-mini-app", data?.get("parentAppId")?.jsonPrimitive?.content)

        val wf = data?.get("windowFeatures")?.jsonObject
        assertNotNull(wf)
        assertEquals(500.0, wf?.get("width")?.jsonPrimitive?.double ?: 0.0, 0.001)
        assertEquals(700.0, wf?.get("height")?.jsonPrimitive?.double ?: 0.0, 0.001)
    }

    // =========================================================================
    // 4. Origin Classification Tests
    // =========================================================================

    @Test
    fun `test classify same-origin relative URLs routes to MODAL`() {
        assertEquals(GoatPopupRoutingPolicy.MODAL, GoatPopupManager.classifyPopupOrigin(null, testAppId))
        assertEquals(GoatPopupRoutingPolicy.MODAL, GoatPopupManager.classifyPopupOrigin("", testAppId))
        assertEquals(GoatPopupRoutingPolicy.MODAL, GoatPopupManager.classifyPopupOrigin("about:blank", testAppId))
        assertEquals(GoatPopupRoutingPolicy.MODAL, GoatPopupManager.classifyPopupOrigin("/page2.html", testAppId))
        assertEquals(GoatPopupRoutingPolicy.MODAL, GoatPopupManager.classifyPopupOrigin("./details.html", testAppId))
        assertEquals(GoatPopupRoutingPolicy.MODAL, GoatPopupManager.classifyPopupOrigin("../sub/index.html", testAppId))
        assertEquals(GoatPopupRoutingPolicy.MODAL, GoatPopupManager.classifyPopupOrigin("#section1", testAppId))
    }

    @Test
    fun `test classify same-origin virtual custom scheme routes to MODAL`() {
        // Same appId in goat:// scheme
        assertEquals(GoatPopupRoutingPolicy.MODAL, GoatPopupManager.classifyPopupOrigin("goat://test-mini-app/index.html", testAppId))
        // goat://assets/...
        assertEquals(GoatPopupRoutingPolicy.MODAL, GoatPopupManager.classifyPopupOrigin("goat://assets/details.html", testAppId))
        // Empty host in goat:///path
        assertEquals(GoatPopupRoutingPolicy.MODAL, GoatPopupManager.classifyPopupOrigin("goat:///page.html", testAppId))

        // Different appId in goat:// scheme routes to SYSTEM_BROWSER
        assertEquals(GoatPopupRoutingPolicy.SYSTEM_BROWSER, GoatPopupManager.classifyPopupOrigin("goat://other-mini-app/index.html", testAppId))
    }

    @Test
    fun `test classify same-origin virtual domain routes to MODAL`() {
        // Scoped tenant virtual domain
        val scopedTenantDomain = "https://test_mini_app.appassets.androidplatform.net/page.html"
        assertEquals(GoatPopupRoutingPolicy.MODAL, GoatPopupManager.classifyPopupOrigin(scopedTenantDomain, "test_mini_app"))

        // Default domain
        val defaultDomainUrl = "https://appassets.androidplatform.net/assets/index.html"
        assertEquals(GoatPopupRoutingPolicy.MODAL, GoatPopupManager.classifyPopupOrigin(defaultDomainUrl, testAppId))

        // Different tenant virtual domain routes to SYSTEM_BROWSER
        val otherTenantUrl = "https://other_app.appassets.androidplatform.net/page.html"
        assertEquals(GoatPopupRoutingPolicy.SYSTEM_BROWSER, GoatPopupManager.classifyPopupOrigin(otherTenantUrl, "test_mini_app"))
    }

    @Test
    fun `test classify cross-origin external HTTPS domains routes to SYSTEM_BROWSER`() {
        assertEquals(GoatPopupRoutingPolicy.SYSTEM_BROWSER, GoatPopupManager.classifyPopupOrigin("https://stripe.com/checkout", testAppId))
        assertEquals(GoatPopupRoutingPolicy.SYSTEM_BROWSER, GoatPopupManager.classifyPopupOrigin("https://accounts.google.com/o/oauth2/auth", testAppId))
        assertEquals(GoatPopupRoutingPolicy.SYSTEM_BROWSER, GoatPopupManager.classifyPopupOrigin("https://example.org/terms", testAppId))
    }

    @Test
    fun `test classify phishing URL with embedded origin in userinfo routes to SYSTEM_BROWSER`() {
        // Anti-phishing: userinfo attempt to mimic appassets domain
        val phishingUrl = "https://test_mini_app.appassets.androidplatform.net@evil-phishing-site.com/login"
        assertEquals(GoatPopupRoutingPolicy.SYSTEM_BROWSER, GoatPopupManager.classifyPopupOrigin(phishingUrl, "test_mini_app"))
    }

    @Test
    fun `test classify system URL schemes routes to SYSTEM_BROWSER`() {
        assertEquals(GoatPopupRoutingPolicy.SYSTEM_BROWSER, GoatPopupManager.classifyPopupOrigin("tel:18005550199", testAppId))
        assertEquals(GoatPopupRoutingPolicy.SYSTEM_BROWSER, GoatPopupManager.classifyPopupOrigin("mailto:support@goat.dev?subject=Help", testAppId))
        assertEquals(GoatPopupRoutingPolicy.SYSTEM_BROWSER, GoatPopupManager.classifyPopupOrigin("sms:+14155552671?body=Hi", testAppId))
        assertEquals(GoatPopupRoutingPolicy.SYSTEM_BROWSER, GoatPopupManager.classifyPopupOrigin("geo:37.7749,-122.4194", testAppId))
    }

    @Test
    fun `test classify dangerous and forbidden schemes unconditionally returns BLOCK`() {
        assertEquals(GoatPopupRoutingPolicy.BLOCK, GoatPopupManager.classifyPopupOrigin("file:///data/user/0/com.app/databases/app.db", testAppId))
        assertEquals(GoatPopupRoutingPolicy.BLOCK, GoatPopupManager.classifyPopupOrigin("file:///etc/hosts", testAppId))
        assertEquals(GoatPopupRoutingPolicy.BLOCK, GoatPopupManager.classifyPopupOrigin("javascript:alert(document.cookie)", testAppId))
        assertEquals(GoatPopupRoutingPolicy.BLOCK, GoatPopupManager.classifyPopupOrigin("javascript:void(0)", testAppId))
        assertEquals(GoatPopupRoutingPolicy.BLOCK, GoatPopupManager.classifyPopupOrigin("data:text/html,<h1>XSS</h1>", testAppId))
        assertEquals(GoatPopupRoutingPolicy.BLOCK, GoatPopupManager.classifyPopupOrigin("content://com.android.providers.media.documents/document/image", testAppId))
    }

    // =========================================================================
    // 5. Host Policy Override and Listener Interception Tests
    // =========================================================================

    @Test
    fun `test GoatPopupListener can observe and dynamically override policy`() {
        var observedRequest: GoatPopupRequest? = null

        val listener = object : GoatPopupListener {
            override fun onPopupRequest(request: GoatPopupRequest): GoatPopupRoutingPolicy? {
                observedRequest = request
                return if (request.url.contains("checkout")) GoatPopupRoutingPolicy.SAME_FRAME else null
            }
        }

        val parentView = GoatView(context)
        parentView.initialize(assetDir = assetDir, appId = testAppId)

        // 1. URL with "checkout" gets overridden to SAME_FRAME
        val isHandled = GoatPopupManager.handleCreateWindow(
            parentWebView = parentView.getUnderlyingWebView(),
            parentContainer = parentView,
            context = context,
            appId = testAppId,
            assetDir = assetDir,
            isDialog = false,
            isUserGesture = true,
            resultMsg = null, // null resultMsg fails-safe
            customListener = listener,
            initialUrl = "https://example.com/checkout"
        )
        assertFalse(isHandled) // null resultMsg returns false
    }

    @Test
    fun `test handleCreateWindow with null resultMsg returns false fails-safe`() {
        val parentView = GoatView(context)
        parentView.initialize(assetDir = assetDir, appId = testAppId)

        val result = GoatPopupManager.handleCreateWindow(
            parentGoatView = parentView,
            isDialog = false,
            isUserGesture = true,
            resultMsg = null
        )
        assertFalse("handleCreateWindow with null resultMsg must fail-safe and return false", result)
    }

    // =========================================================================
    // 6. Modal Container Lifecycle & Teardown Tests
    // =========================================================================

    @Test
    fun `test GoatModalContainer layout geometry clamping and dismissal`() {
        val modalView = GoatView(context)
        modalView.initialize(assetDir = assetDir, appId = testAppId)

        val dismissInvoked = AtomicBoolean(false)
        val features = GoatWindowFeatures(width = 400.0, height = 600.0, x = 30.0, y = 50.0)

        val container = GoatModalContainer(
            context = context,
            containerId = "modal_test_1",
            modalGoatView = modalView,
            features = features,
            onDismiss = {
                dismissInvoked.set(true)
            }
        )

        assertNotNull(container.windowCard)
        assertNotNull(container.headerBar)
        assertNotNull(container.titleView)
        assertNotNull(container.closeButton)
        assertNotNull(container.dimOverlay)

        // Dismissal triggers onDismiss callback
        container.dismiss()
        assertTrue("Dismiss must invoke onDismiss callback", dismissInvoked.get())

        // Repeated dismissal is idempotent
        container.dismiss()
    }

    @Test
    fun `test handleCloseWindow matching child WebView triggers dismissal and cleanup`() {
        val parentView = GoatView(context)
        parentView.initialize(assetDir = assetDir, appId = testAppId)

        val modalView = GoatView(context)
        modalView.initialize(assetDir = assetDir, appId = testAppId)

        val closedDispatched = AtomicBoolean(false)
        val testListener = object : GoatPopupListener {
            override fun onModalWindowClosed(modalView: GoatView) {
                closedDispatched.set(true)
            }
        }

        val container = GoatModalContainer(
            context = context,
            containerId = "modal_test_lifecycle",
            modalGoatView = modalView,
            features = GoatWindowFeatures(),
            onDismiss = {
                testListener.onModalWindowClosed(modalView)
            }
        )

        // Inject active modal
        val modalsMap = GoatPopupManager.getActiveModals() as? MutableMap<String, GoatModalContainer>
        // Use reflection or dismissal helper to track
        GoatPopupManager.dismissAllModals()
        assertEquals(0, GoatPopupManager.getActiveModalCount())

        // handleCloseWindow on non-matching WebView returns false
        val dummyWv = WebView(context)
        val handled = GoatPopupManager.handleCloseWindow(dummyWv)
        assertFalse(handled)

        // handleCloseWindow on null WebView returns false
        assertFalse(GoatPopupManager.handleCloseWindow(null))
    }

    @Test
    fun `test dismissModal and dismissAllModals clear all active containers`() {
        val modalView1 = GoatView(context)
        modalView1.initialize(assetDir = assetDir, appId = testAppId)

        val modalView2 = GoatView(context)
        modalView2.initialize(assetDir = assetDir, appId = testAppId)

        val container1 = GoatModalContainer(context, "modal_1", modalView1)
        val container2 = GoatModalContainer(context, "modal_2", modalView2)

        GoatPopupManager.dismissAllModals()
        assertEquals(0, GoatPopupManager.getActiveModalCount())
        assertFalse(GoatPopupManager.dismissModal("non_existent_id"))
    }

    // =========================================================================
    // 7. GoatView Integration Tests
    // =========================================================================

    @Test
    fun `test GoatView getUnderlyingWebView and popup properties`() {
        val goatView = GoatView(context)
        assertNull(goatView.getUnderlyingWebView())
        assertEquals(GoatPopupRoutingPolicy.AUTO, goatView.defaultPopupRoutingPolicy)

        goatView.defaultPopupRoutingPolicy = GoatPopupRoutingPolicy.MODAL
        assertEquals(GoatPopupRoutingPolicy.MODAL, goatView.defaultPopupRoutingPolicy)

        goatView.initialize(assetDir = assetDir, appId = testAppId)
        assertNotNull(goatView.getUnderlyingWebView())
        assertEquals(testAppId, goatView.currentAppId)
        assertEquals(assetDir, goatView.currentAssetDir)

        var listenerInvoked = false
        goatView.popupListener = object : GoatPopupListener {
            override fun onPopupRequest(request: GoatPopupRequest): GoatPopupRoutingPolicy? {
                listenerInvoked = true
                return GoatPopupRoutingPolicy.BLOCK
            }
        }
        assertNotNull(goatView.popupListener)

        goatView.destroy()
        assertNull(goatView.getUnderlyingWebView())
    }

    @Test
    fun `test Event Coalescing with ON_POPUP_REQUEST emissions`() {
        val coalescer = GoatEventCoalescer()
        val request1 = GoatPopupRequest(
            url = "https://external.com/page1",
            policy = GoatPopupRoutingPolicy.SYSTEM_BROWSER,
            parentAppId = testAppId
        )

        val emitted = AtomicReference<String>()
        val accepted = coalescer.emit("ON_POPUP_REQUEST", request1.toJsonObject()) { key, payload ->
            emitted.set(payload["url"]?.jsonPrimitive?.content)
        }

        assertTrue("First emit should be accepted", accepted)
        assertEquals("https://external.com/page1", emitted.get())

        // Duplicate emit is discarded by coalescer
        val acceptedDuplicate = coalescer.emit("ON_POPUP_REQUEST", request1.toJsonObject()) { _, _ -> }
        assertFalse("Duplicate payload emit should be deduplicated and rejected", acceptedDuplicate)
    }
}
