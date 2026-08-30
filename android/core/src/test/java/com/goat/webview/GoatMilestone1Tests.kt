package com.goat.webview

import android.content.Context
import com.goat.webview.permission.GoatPermissionPrimingDialog
import com.goat.webview.ui.GoatBottomSheetConfig
import com.goat.webview.ui.GoatBottomSheetTabsOverlay
import com.goat.webview.ui.GoatExternalLinkWarningDialog
import com.goat.webview.ui.TabHandle
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Comprehensive Unit and Integration Test Suite for Milestone 1 (Bridge APIs & UX).
 *
 * Covers:
 * 1. Task 10192: External Link Warning Interstitial & Session Opt-Outs
 * 2. Task 10194: Multi-Tab Bottom Sheet WebView Overlay Stack & FastPool Recycling
 * 3. Task 10198: Two-Stage Permission Priming Dialog & Settings Deep-Link Fallback
 */
class GoatMilestone1Tests {

    private lateinit var context: FakeTestContext
    private lateinit var actionHandler: GoatBridgeActionHandler

    @Before
    fun setUp() {
        context = FakeTestContext()
        actionHandler = GoatBridgeActionHandler(
            context = context,
            appId = "test_miniapp_m1",
            // The unit-test android.jar stub's default int return (0) happens to equal
            // PackageManager.PERMISSION_GRANTED, which would make every real OS permission look
            // pre-granted. Force the deterministic "not yet granted" state for these tests.
            isAndroidPermissionAlreadyGranted = { false }
        )
    }

    @After
    fun tearDown() {
        GoatExternalLinkWarningDialog.clearAllSessionOptOuts()
        GoatFastPool.trimMemory()
    }

    // =========================================================================
    // Task 10192: External Link Warning Interstitial Tests
    // =========================================================================

    @Test
    fun `test resolveDestinationHost normalizes and extracts correct host authority`() {
        assertEquals(
            "partner.com",
            GoatExternalLinkWarningDialog.resolveDestinationHost("https://partner.com/checkout?id=123")
        )
        assertEquals(
            "evil.com",
            GoatExternalLinkWarningDialog.resolveDestinationHost("https://user:password@evil.com:8443/phishing#path")
        )
        assertEquals(
            "sub.domain.co.uk",
            GoatExternalLinkWarningDialog.resolveDestinationHost("http://SUB.DOMAIN.CO.UK/test")
        )
        assertEquals(
            "Unknown Host",
            GoatExternalLinkWarningDialog.resolveDestinationHost("not-a-valid-url")
        )
    }

    @Test
    fun `test session opt-out is isolated per tenant and clearable`() {
        val app1 = "mini_app_alpha"
        val app2 = "mini_app_beta"
        val host = "checkout.stripe.com"

        assertFalse(GoatExternalLinkWarningDialog.isDomainOptedOut(app1, host))
        assertFalse(GoatExternalLinkWarningDialog.isDomainOptedOut(app2, host))

        GoatExternalLinkWarningDialog.optOutDomainForSession(app1, host)

        assertTrue(GoatExternalLinkWarningDialog.isDomainOptedOut(app1, host))
        assertFalse("Opt-out for app1 must not leak to app2", GoatExternalLinkWarningDialog.isDomainOptedOut(app2, host))

        // Case insensitivity test
        assertTrue(GoatExternalLinkWarningDialog.isDomainOptedOut(app1, "CHECKOUT.STRIPE.COM"))

        GoatExternalLinkWarningDialog.clearSessionOptOuts(app1)
        assertFalse(GoatExternalLinkWarningDialog.isDomainOptedOut(app1, host))
    }

    @Test
    fun `test external link warning dialog triggers warning callback and confirms in headless context`() {
        var warningShownHost: String? = null
        var confirmed = false
        var cancelled = false

        GoatExternalLinkWarningDialog.show(
            context = context,
            appId = "app_test",
            destinationUrl = "https://external-service.org/login",
            onWarningShown = { warningShownHost = it },
            onConfirm = { confirmed = true },
            onCancel = { cancelled = true }
        )

        assertEquals("external-service.org", warningShownHost)
        assertTrue("Headless context must gracefully fallback to confirmation", confirmed)
        assertFalse(cancelled)
    }

    @Test
    fun `test bridge action OPEN_EXTERNAL_LINK executes and returns destinationHost`() = runTest {
        val payload = buildJsonObject {
            put("url", "https://shop.partner.com/products")
            put("skipWarningIfOptedOut", true)
        }

        val result = actionHandler.executeAction("OPEN_EXTERNAL_LINK", payload)
        assertTrue(result.isSuccess)
        val data = result.getOrNull()
        assertNotNull(data)
        assertEquals("shop.partner.com", data?.get("destinationHost")?.jsonPrimitive?.content)
        assertEquals("true", data?.get("opened")?.jsonPrimitive?.content)
    }

    // =========================================================================
    // Task 10194: Multi-Tab Bottom Sheet Overlay Stack Tests
    // =========================================================================

    @Test
    fun `test MultiTabOverlay opens multiple isolated tabs with background lifecycle suspension`() {
        val overlay = GoatBottomSheetTabsOverlay(context)
        overlay.maxConcurrentTabs = 3

        // Open Tab 1
        val tab1 = overlay.openTab(appId = "tenant_1", initialRoute = "/dashboard", title = "Dashboard")
        assertEquals(1, overlay.getTabs().size)
        assertEquals(tab1.tabId, overlay.getActiveTab()?.tabId)
        assertFalse(tab1.isBackgrounded)
        assertFalse(tab1.memoryTrimmed)

        // Open Tab 2
        val tab2 = overlay.openTab(appId = "tenant_2", initialRoute = "/settings", title = "Settings")
        assertEquals(2, overlay.getTabs().size)
        assertEquals(tab2.tabId, overlay.getActiveTab()?.tabId)
        assertFalse(tab2.isBackgrounded)

        // Verify Tab 1 is now backgrounded & RAM trimmed
        assertTrue(tab1.isBackgrounded)
        assertTrue(tab1.memoryTrimmed)

        // Switch back to Tab 1
        overlay.switchToTab(tab1.tabId)
        assertEquals(tab1.tabId, overlay.getActiveTab()?.tabId)
        assertFalse(tab1.isBackgrounded)
        assertFalse(tab1.memoryTrimmed)
        assertTrue(tab2.isBackgrounded)
        assertTrue(tab2.memoryTrimmed)

        // Close Tab 1 -> Tab 2 should become active
        overlay.closeTab(tab1.tabId)
        assertEquals(1, overlay.getTabs().size)
        assertEquals(tab2.tabId, overlay.getActiveTab()?.tabId)
        assertFalse(tab2.isBackgrounded)

        // Close all tabs
        overlay.closeAllTabs()
        assertEquals(0, overlay.getTabs().size)
        assertNull(overlay.getActiveTab())
    }

    @Test
    fun `test MultiTabOverlay enforces maxConcurrentTabs limit by recycling oldest tab`() {
        val overlay = GoatBottomSheetTabsOverlay(context)
        overlay.maxConcurrentTabs = 2

        val tab1 = overlay.openTab(appId = "tenant_1", initialRoute = "/1")
        val tab2 = overlay.openTab(appId = "tenant_2", initialRoute = "/2")
        assertEquals(2, overlay.getTabs().size)

        // Open 3rd tab -> tab1 should be automatically closed & evicted
        val tab3 = overlay.openTab(appId = "tenant_3", initialRoute = "/3")
        assertEquals(2, overlay.getTabs().size)
        assertNull(overlay.getTabs().find { it.tabId == tab1.tabId })
        assertNotNull(overlay.getTabs().find { it.tabId == tab2.tabId })
        assertNotNull(overlay.getTabs().find { it.tabId == tab3.tabId })
        assertEquals(tab3.tabId, overlay.getActiveTab()?.tabId)
    }

    @Test
    fun `test MultiTab bridge actions TAB_OPEN, TAB_SWITCH, TAB_CLOSE, TAB_LIST`() = runTest {
        val openRes = actionHandler.executeAction("TAB_OPEN", buildJsonObject {
            put("appId", "tenant_alpha")
            put("initialRoute", "/home")
            put("title", "Alpha App")
        })
        assertTrue(openRes.isSuccess)
        val tabId = openRes.getOrNull()?.get("tabId")?.jsonPrimitive?.content
        assertNotNull(tabId)
        assertEquals("tenant_alpha", openRes.getOrNull()?.get("appId")?.jsonPrimitive?.content)

        val switchRes = actionHandler.executeAction("TAB_SWITCH", buildJsonObject {
            put("tabId", tabId!!)
        })
        assertTrue(switchRes.isSuccess)
        assertEquals("true", switchRes.getOrNull()?.get("switched")?.jsonPrimitive?.content)

        val listRes = actionHandler.executeAction("TAB_LIST", buildJsonObject {})
        assertTrue(listRes.isSuccess)

        val closeRes = actionHandler.executeAction("TAB_CLOSE", buildJsonObject {
            put("tabId", tabId!!)
        })
        assertTrue(closeRes.isSuccess)
        assertEquals("true", closeRes.getOrNull()?.get("closed")?.jsonPrimitive?.content)

        val closeAllRes = actionHandler.executeAction("TAB_CLOSE_ALL", buildJsonObject {})
        assertTrue(closeAllRes.isSuccess)
        assertEquals("true", closeAllRes.getOrNull()?.get("closedAll")?.jsonPrimitive?.content)
    }

    // =========================================================================
    // Task 10198: Permission Priming Dialog & Settings Deep-Link Tests
    // =========================================================================

    @Test
    fun `test GoatPermissionPrimingDialog shows rationale and executes accept callback`() {
        var accepted = false
        var denied = false

        GoatPermissionPrimingDialog.show(
            context = context,
            appId = "tenant_prime",
            scope = GoatPermissionManager.SCOPE_CAMERA,
            rationale = "Camera access is needed for document scanning.",
            isPermanentlyDenied = false,
            onAccept = { accepted = true },
            onDenied = { denied = true }
        )

        assertTrue("Headless context must default to accept when not permanently denied", accepted)
        assertFalse(denied)
    }

    @Test
    fun `test GoatPermissionPrimingDialog permanently denied executes onDenied and triggers settings`() {
        var accepted = false
        var denied = false

        GoatPermissionPrimingDialog.show(
            context = context,
            appId = "tenant_prime",
            scope = GoatPermissionManager.SCOPE_CAMERA,
            rationale = "Camera access is required. Please enable it in Settings.",
            isPermanentlyDenied = true,
            onAccept = { accepted = true },
            onDenied = { denied = true }
        )

        assertFalse(accepted)
        assertTrue("Permanently denied dialog must route to onDenied", denied)
    }

    @Test
    fun `test bridge REQUEST_PERMISSION with rationale metadata`() = runTest {
        val payload = buildJsonObject {
            put("appId", actionHandler.appId)
            put("scope", "scope.userLocation")
            put("rationale", "Location is required to show nearby stores.")
        }

        val result = actionHandler.executeAction("REQUEST_PERMISSION", payload)
        assertTrue(result.isSuccess)
        val data = result.getOrNull()
        assertNotNull(data)
        assertEquals("scope.userLocation", data?.get("scope")?.jsonPrimitive?.content)
        // Task 10198 fix: with no host onRequestOsPermissions wired and no real OS grant present,
        // the gate must NOT lie with a blind auto-grant — it resolves to denied.
        assertEquals("false", data?.get("granted")?.jsonPrimitive?.content)
    }

    @Test
    fun `test bridge REQUEST_PERMISSION invokes the real host OS permission requester on accept`() = runTest {
        var requestedPermissions: Array<String>? = null
        val handlerWithOsRequester = GoatBridgeActionHandler(
            context = context,
            appId = "test_miniapp_os_perm",
            isAndroidPermissionAlreadyGranted = { false },
            onRequestOsPermissions = { perms ->
                requestedPermissions = perms
                mapOf(android.Manifest.permission.CAMERA to true)
            }
        )

        val result = handlerWithOsRequester.executeAction("REQUEST_PERMISSION", buildJsonObject {
            put("appId", handlerWithOsRequester.appId)
            put("scope", GoatPermissionManager.SCOPE_CAMERA)
        })

        assertTrue(result.isSuccess)
        assertEquals("true", result.getOrNull()?.get("granted")?.jsonPrimitive?.content)
        assertNotNull("Host OS permission requester must be invoked with the mapped Android permission", requestedPermissions)
        assertEquals(android.Manifest.permission.CAMERA, requestedPermissions?.firstOrNull())
    }

    @Test
    fun `test bridge REQUEST_PERMISSION honors a real OS denial from the host requester`() = runTest {
        val handlerWithOsRequester = GoatBridgeActionHandler(
            context = context,
            appId = "test_miniapp_os_perm_denied",
            isAndroidPermissionAlreadyGranted = { false },
            onRequestOsPermissions = { mapOf(android.Manifest.permission.RECORD_AUDIO to false) }
        )

        val result = handlerWithOsRequester.executeAction("REQUEST_PERMISSION", buildJsonObject {
            put("appId", handlerWithOsRequester.appId)
            put("scope", GoatPermissionManager.SCOPE_RECORD)
        })

        assertTrue(result.isSuccess)
        assertEquals("false", result.getOrNull()?.get("granted")?.jsonPrimitive?.content)
    }

    @Test
    fun `test bridge REQUEST_PERMISSION short-circuits to granted when the OS already grants it, without a host requester`() = runTest {
        val handlerAlreadyGranted = GoatBridgeActionHandler(
            context = context,
            appId = "test_miniapp_already_granted",
            isAndroidPermissionAlreadyGranted = { true }
        )

        val result = handlerAlreadyGranted.executeAction("REQUEST_PERMISSION", buildJsonObject {
            put("appId", handlerAlreadyGranted.appId)
            put("scope", GoatPermissionManager.SCOPE_CAMERA)
        })

        assertTrue(result.isSuccess)
        assertEquals("true", result.getOrNull()?.get("granted")?.jsonPrimitive?.content)
    }

    @Test
    fun `test bridge REQUEST_PERMISSION for a scope with no underlying OS permission grants at the app level`() = runTest {
        val result = actionHandler.executeAction("REQUEST_PERMISSION", buildJsonObject {
            put("appId", actionHandler.appId)
            put("scope", GoatPermissionManager.SCOPE_USER_INFO)
        })

        assertTrue(result.isSuccess)
        assertEquals("true", result.getOrNull()?.get("granted")?.jsonPrimitive?.content)
    }

    @Test
    fun `test bridge OPEN_SETTING opens application settings`() = runTest {
        val result = actionHandler.executeAction("OPEN_SETTING", buildJsonObject {
            put("appId", actionHandler.appId)
        })
        assertTrue(result.isSuccess)
        val data = result.getOrNull()
        assertNotNull(data)
        assertEquals("true", data?.get("opened")?.jsonPrimitive?.content)
        assertNotNull(data?.get("authSetting"))
    }
}
