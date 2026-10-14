#if os(iOS)
import XCTest
@testable import GoatWebView
#if canImport(UIKit)
#if canImport(UIKit)
import UIKit
#endif
#endif

/**
 * Comprehensive Unit and Integration Test Suite for Milestone 1 (Bridge APIs & UX).
 *
 * Covers:
 * 1. Task 10192: External Link Warning Interstitial & Session Opt-Outs (iOS)
 * 2. Task 10194: Multi-Tab Bottom Sheet Overlay Stack & FastPool/GoatView lifecycle (iOS)
 * 3. Task 10198: Two-Stage Permission Priming Dialog & Settings Fallback (iOS)
 */
final class GoatMilestone1Tests: XCTestCase {

    private var messageHandler: GoatScriptMessageHandler!

    override func setUp() {
        super.setUp()
        messageHandler = GoatScriptMessageHandler(appId: "test_ios_m1")
        GoatExternalLinkWarningDialog.clearAllSessionOptOuts()
        // Never let tests fall through to the real AVFoundation/CoreLocation/Photos APIs — that
        // can hang or crash in a test host lacking real hardware/usage-description entitlements.
        GoatPermissionPrimingDialog.osPermissionRequester = { _ in true }
    }

    override func tearDown() {
        GoatExternalLinkWarningDialog.clearAllSessionOptOuts()
        // Leave the safe fake in place for any test that runs next in this process — the real
        // AVFoundation/CoreLocation/Photos APIs must never fire during automated tests.
        GoatPermissionPrimingDialog.osPermissionRequester = { _ in true }
        messageHandler = nil
        super.tearDown()
    }

    // =========================================================================
    // Task 10192: External Link Warning Interstitial Tests
    // =========================================================================

    func testResolveDestinationHostNormalizesAuthority() {
        let url1 = URL(string: "https://partner.com/checkout?id=999")!
        XCTAssertEqual(GoatExternalLinkWarningDialog.resolveDestinationHost(url: url1), "partner.com")

        let url2 = URL(string: "https://user:password@evil-site.org:8080/phish#top")!
        XCTAssertEqual(GoatExternalLinkWarningDialog.resolveDestinationHost(url: url2), "evil-site.org")

        let url3 = URL(string: "http://SUB.DOMAIN.EXAMPLE.COM/path")!
        XCTAssertEqual(GoatExternalLinkWarningDialog.resolveDestinationHost(url: url3), "sub.domain.example.com")

        XCTAssertEqual(GoatExternalLinkWarningDialog.resolveDestinationHost(urlString: "invalid-url"), "Unknown Host")
    }

    func testSessionOptOutTenantIsolation() {
        let app1 = "tenant_alpha"
        let app2 = "tenant_beta"
        let host = "trusted-partner.com"

        XCTAssertFalse(GoatExternalLinkWarningDialog.isDomainOptedOut(appId: app1, host: host))
        XCTAssertFalse(GoatExternalLinkWarningDialog.isDomainOptedOut(appId: app2, host: host))

        GoatExternalLinkWarningDialog.optOutDomainForSession(appId: app1, host: host)

        XCTAssertTrue(GoatExternalLinkWarningDialog.isDomainOptedOut(appId: app1, host: host))
        XCTAssertFalse(GoatExternalLinkWarningDialog.isDomainOptedOut(appId: app2, host: host), "Opt-out must not leak across tenants")

        // Case insensitivity
        XCTAssertTrue(GoatExternalLinkWarningDialog.isDomainOptedOut(appId: app1, host: "TRUSTED-PARTNER.COM"))

        GoatExternalLinkWarningDialog.clearSessionOptOuts(appId: app1)
        XCTAssertFalse(GoatExternalLinkWarningDialog.isDomainOptedOut(appId: app1, host: host))
    }

    @MainActor
    func testExternalLinkWarningDialogHeadlessFallback() {
        var warningHost: String?
        var confirmed = false
        var cancelled = false

        let url = URL(string: "https://secure.bank.com/transfer")!
        GoatExternalLinkWarningDialog.show(
            from: nil,
            appId: "app_1",
            url: url,
            onWarningShown: { host in warningHost = host },
            onConfirm: { confirmed = true },
            onCancel: { cancelled = true }
        )

        XCTAssertEqual(warningHost, "secure.bank.com")
        XCTAssertTrue(confirmed, "Headless execution must default to confirmation")
        XCTAssertFalse(cancelled)
    }

    func testBridgeOpenExternalLinkAction() async throws {
        let payload: [String: Any] = [
            "url": "https://store.external.com/items",
            "skipWarningIfOptedOut": true
        ]

        let result = try await messageHandler.dispatchDirect(action: "OPEN_EXTERNAL_LINK", payload: payload)
        XCTAssertEqual(result["opened"] as? Bool, true)
        XCTAssertEqual(result["destinationHost"] as? String, "store.external.com")

        // Test alias OPEN_URL and OPEN_LINK
        let resUrl = try await messageHandler.dispatchDirect(action: "OPEN_URL", payload: payload)
        XCTAssertEqual(resUrl["opened"] as? Bool, true)

        let resLink = try await messageHandler.dispatchDirect(action: "OPEN_LINK", payload: payload)
        XCTAssertEqual(resLink["opened"] as? Bool, true)
    }

    // =========================================================================
    // Task 10194: Multi-Tab Bottom Sheet Overlay Tests
    // =========================================================================

    #if canImport(UIKit) && !os(watchOS)
    @MainActor
    func testMultiTabOverlayLifecycleAndSwitching() {
        let overlay = GoatBottomSheetTabsOverlayController()
        overlay.maxConcurrentTabs = 3
        _ = overlay.view // Trigger viewDidLoad

        // Open Tab 1
        let tab1 = overlay.openTab(appId: "tenant_1", initialRoute: "/feed", title: "Feed")
        XCTAssertEqual(overlay.tabs.count, 1)
        XCTAssertEqual(overlay.activeTabId, tab1.id)
        XCTAssertFalse(tab1.isBackgrounded)

        // Open Tab 2
        let tab2 = overlay.openTab(appId: "tenant_2", initialRoute: "/chat", title: "Chat")
        XCTAssertEqual(overlay.tabs.count, 2)
        XCTAssertEqual(overlay.activeTabId, tab2.id)
        XCTAssertFalse(tab2.isBackgrounded)

        // Verify Tab 1 is backgrounded
        let updatedTab1 = overlay.tabs.first { $0.id == tab1.id }!
        XCTAssertTrue(updatedTab1.isBackgrounded)
        XCTAssertTrue(updatedTab1.memoryTrimmed)

        // Switch to Tab 1
        overlay.switchToTab(tabId: tab1.id)
        XCTAssertEqual(overlay.activeTabId, tab1.id)
        let activeTab = overlay.getActiveTab()!
        XCTAssertEqual(activeTab.id, tab1.id)
        XCTAssertFalse(activeTab.isBackgrounded)

        // Verify Tab 2 is now backgrounded
        let updatedTab2 = overlay.tabs.first { $0.id == tab2.id }!
        XCTAssertTrue(updatedTab2.isBackgrounded)

        // Close Tab 1 -> Tab 2 becomes active
        overlay.closeTab(tabId: tab1.id)
        XCTAssertEqual(overlay.tabs.count, 1)
        XCTAssertEqual(overlay.activeTabId, tab2.id)

        // Close all tabs
        overlay.closeAllTabs()
        XCTAssertEqual(overlay.tabs.count, 0)
        XCTAssertNil(overlay.activeTabId)
    }

    @MainActor
    func testMultiTabOverlayCapacityEviction() {
        let overlay = GoatBottomSheetTabsOverlayController()
        overlay.maxConcurrentTabs = 2
        _ = overlay.view

        let t1 = overlay.openTab(appId: "t1", initialRoute: "/1")
        let t2 = overlay.openTab(appId: "t2", initialRoute: "/2")
        XCTAssertEqual(overlay.tabs.count, 2)

        // Open 3rd tab -> t1 evicted
        let t3 = overlay.openTab(appId: "t3", initialRoute: "/3")
        XCTAssertEqual(overlay.tabs.count, 2)
        XCTAssertNil(overlay.tabs.first { $0.id == t1.id })
        XCTAssertNotNil(overlay.tabs.first { $0.id == t2.id })
        XCTAssertNotNil(overlay.tabs.first { $0.id == t3.id })
        XCTAssertEqual(overlay.activeTabId, t3.id)
    }
    #endif

    func testBridgeMultiTabActions() async throws {
        let openPayload: [String: Any] = [
            "appId": "tenant_x",
            "initialRoute": "/profile",
            "title": "Profile Tab"
        ]
        let openRes = try await messageHandler.dispatchDirect(action: "TAB_OPEN", payload: openPayload)
        guard let tabId = openRes["tabId"] as? String else {
            XCTFail("Missing tabId in TAB_OPEN response")
            return
        }
        XCTAssertEqual(openRes["appId"] as? String, "tenant_x")

        let switchRes = try await messageHandler.dispatchDirect(action: "TAB_SWITCH", payload: ["tabId": tabId])
        XCTAssertEqual(switchRes["switched"] as? Bool, true)

        let listRes = try await messageHandler.dispatchDirect(action: "TAB_LIST", payload: [:])
        XCTAssertNotNil(listRes["tabs"])

        let closeRes = try await messageHandler.dispatchDirect(action: "TAB_CLOSE", payload: ["tabId": tabId])
        XCTAssertEqual(closeRes["closed"] as? Bool, true)

        let closeAllRes = try await messageHandler.dispatchDirect(action: "TAB_CLOSE_ALL", payload: [:])
        XCTAssertEqual(closeAllRes["closedAll"] as? Bool, true)
    }

    // =========================================================================
    // Task 10198: Permission Priming Dialog Tests
    // =========================================================================

    func testPermissionPrimingStatusAndMemoryCache() {
        let appId = "tenant_permissions"
        let scope = "scope.camera"

        XCTAssertFalse(GoatPermissionPrimingDialog.isPermissionGranted(appId: appId, scope: scope))

        GoatPermissionPrimingDialog.setPermission(appId: appId, scope: scope, granted: true)
        XCTAssertTrue(GoatPermissionPrimingDialog.isPermissionGranted(appId: appId, scope: scope))

        GoatPermissionPrimingDialog.clearPermissions(appId: appId)
        XCTAssertFalse(GoatPermissionPrimingDialog.isPermissionGranted(appId: appId, scope: scope))
    }

    func testBridgePermissionActions() async throws {
        let appId = "tenant_bridge_test"
        let checkRes = try await messageHandler.dispatchDirect(action: "CHECK_PERMISSION", payload: [
            "appId": appId,
            "scope": "scope.camera"
        ])
        XCTAssertEqual(checkRes["scope"] as? String, "scope.camera")

        let reqRes = try await messageHandler.dispatchDirect(action: "REQUEST_PERMISSION", payload: [
            "appId": appId,
            "scope": "scope.camera",
            "rationale": "Needed for QR scanning"
        ])
        XCTAssertEqual(reqRes["scope"] as? String, "scope.camera")

        let getSettingRes = try await messageHandler.dispatchDirect(action: "GET_SETTING", payload: ["appId": appId])
        XCTAssertNotNil(getSettingRes["authSetting"])

        let openSettingRes = try await messageHandler.dispatchDirect(action: "OPEN_SETTING", payload: ["appId": appId])
        XCTAssertEqual(openSettingRes["opened"] as? Bool, true)

        let authRes = try await messageHandler.dispatchDirect(action: "AUTHORIZE", payload: [
            "appId": appId,
            "scope": "scope.camera",
            "granted": true
        ])
        XCTAssertEqual(authRes["authorized"] as? Bool, true)
    }

    // =========================================================================
    // Task 10198 fix: resolveGrant must reflect the REAL OS permission requester result,
    // not a blind auto-grant (previously `onAccept` always meant granted:true regardless of
    // what the OS actually decided).
    // =========================================================================

    func testResolveGrantReflectsARealOsGrantAndPersistsIt() async {
        let appId = "tenant_os_grant"
        let scope = "scope.camera"
        GoatPermissionPrimingDialog.clearPermissions(appId: appId)
        GoatPermissionPrimingDialog.osPermissionRequester = { _ in true }

        let granted = await GoatPermissionPrimingDialog.resolveGrant(appId: appId, scope: scope)

        XCTAssertTrue(granted)
        XCTAssertTrue(GoatPermissionPrimingDialog.isPermissionGranted(appId: appId, scope: scope))
    }

    func testResolveGrantReflectsARealOsDenialAndPersistsIt() async {
        let appId = "tenant_os_denial"
        let scope = "scope.record"
        GoatPermissionPrimingDialog.clearPermissions(appId: appId)
        GoatPermissionPrimingDialog.osPermissionRequester = { _ in false }

        let granted = await GoatPermissionPrimingDialog.resolveGrant(appId: appId, scope: scope)

        XCTAssertFalse(granted)
        XCTAssertFalse(GoatPermissionPrimingDialog.isPermissionGranted(appId: appId, scope: scope))
    }

    func testResolveGrantPassesTheCorrectScopeToTheOsRequester() async {
        var requestedScope: String?
        GoatPermissionPrimingDialog.osPermissionRequester = { scope in
            requestedScope = scope
            return true
        }

        _ = await GoatPermissionPrimingDialog.resolveGrant(appId: "tenant_scope_check", scope: "scope.userLocation")

        XCTAssertEqual(requestedScope, "scope.userLocation")
    }

}
#endif // os(iOS)
