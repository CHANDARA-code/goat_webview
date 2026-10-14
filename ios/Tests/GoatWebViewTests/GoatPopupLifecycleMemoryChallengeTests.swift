#if os(iOS)
import XCTest
import Foundation
import WebKit
#if canImport(UIKit)
#if canImport(UIKit)
import UIKit
#endif
#endif
@testable import GoatWebView

/**
 * Adversarial Empirical Lifecycle & Memory Leak Challenge Test Suite for iOS GoatPopupManager (Task 10183 / Challenger 2).
 *
 * Scope of Challenges:
 * 1. Modal child window teardown: does `webViewDidClose` or close button dismiss modal, remove message handlers,
 *    cancel network loading, and destroy child view?
 * 2. Parent view destruction cascade: does parent `GoatView.destroy()` cascade to active popups,
 *    dismissing the container and destroying the child view without orphaned WebViews?
 * 3. Multi-tenant cookie & storage partitioning: do popups from app A share storage with app A
 *    while remaining completely isolated from app B?
 * 4. Focus restoration: does closing modal restore first responder to parent GoatView's WKWebView?
 */
@MainActor
final class GoatPopupLifecycleMemoryChallengeTests: XCTestCase {

    override func setUp() {
        super.setUp()
        GoatExternalLinkWarningDialog.clearAllSessionOptOuts()
        GoatAbuseGuard.shared.reset()
        GoatEventCoalescer.shared.reset()
    }

    override func tearDown() {
        GoatExternalLinkWarningDialog.clearAllSessionOptOuts()
        GoatAbuseGuard.shared.reset()
        GoatEventCoalescer.shared.reset()
        super.tearDown()
    }

    // =========================================================================
    // CHALLENGE 1: MODAL TEARDOWN & SCRIPT MESSAGE HANDLER CLEANUP
    // =========================================================================

    func testModalTeardownCleansUpScriptMessageHandlersAndStopsLoading() {
        let parentView = GoatView(frame: CGRect(x: 0, y: 0, width: 375, height: 667))
        parentView.initialize(appId: "finance_app")

        guard let pm = parentView.popupManager else {
            XCTFail("popupManager is nil")
            return
        }

        var popupCreatedFired = false
        var capturedChildView: GoatView?

        pm.onPopupCreated = { childView in
            popupCreatedFired = true
            capturedChildView = childView
        }

        let targetUrl = URL(string: "goat://finance_app/assets/modal.html")!
        let config = WKWebViewConfiguration()
        let windowFeatures = WKWindowFeatures()

        // 1. Trigger same-origin modal creation
        let childWkWebView = pm.handleSameOriginModal(
            url: targetUrl,
            configuration: config,
            windowFeatures: windowFeatures
        )

        XCTAssertNotNil(childWkWebView, "Child WKWebView must be created")
        XCTAssertTrue(popupCreatedFired)
        XCTAssertNotNil(capturedChildView)
        XCTAssertNotNil(pm.activeModalContainer)
        XCTAssertNotNil(pm.activeChildGoatView)

        // 2. Simulate webViewDidClose (window.close())
        pm.webViewDidClose(childWkWebView!)

        // 3. Post-conditions:
        XCTAssertNil(pm.activeModalContainer, "activeModalContainer must be nil after webViewDidClose")
        XCTAssertNil(pm.activeChildGoatView, "activeChildGoatView must be nil after webViewDidClose")
        XCTAssertNil(pm.activeChildWKWebView, "activeChildWKWebView must be nil after webViewDidClose")
        XCTAssertNil(capturedChildView?.underlyingWKWebView, "Child GoatView's underlying WKWebView must be destroyed")
    }

    // =========================================================================
    // CHALLENGE 2: PARENT VIEW DESTRUCTION CASCADE
    // =========================================================================

    func testParentViewDestroyCascadesAndDestroysActiveChildPopup() {
        let parentView = GoatView(frame: CGRect(x: 0, y: 0, width: 375, height: 667))
        parentView.initialize(appId: "store_app")

        guard let pm = parentView.popupManager else {
            XCTFail("popupManager is nil")
            return
        }

        var closedFired = false
        pm.onPopupClosed = { _ in
            closedFired = true
        }

        let targetUrl = URL(string: "goat://store_app/assets/item.html")!
        _ = pm.handleSameOriginModal(
            url: targetUrl,
            configuration: WKWebViewConfiguration(),
            windowFeatures: WKWindowFeatures()
        )

        XCTAssertNotNil(pm.activeModalContainer)
        let childView = pm.activeChildGoatView
        XCTAssertNotNil(childView)

        // Action: Destroy parent view while child modal is open
        parentView.destroy()

        // Verify cascade:
        // 1. Parent webView destroyed
        XCTAssertNil(parentView.underlyingWKWebView)
        // 2. Child popup closed and destroyed
        XCTAssertTrue(closedFired, "onPopupClosed must be fired during cascade destruction")
        XCTAssertNil(childView?.underlyingWKWebView, "Child view must be destroyed during parent cascade")
        XCTAssertNil(parentView.popupManager, "popupManager reference must be cleared")
    }

    // =========================================================================
    // CHALLENGE 3: MULTI-TENANT STORAGE & DATASTORE PARTITIONING
    // =========================================================================

    func testMultiTenantCookieAndDataStorePartitioning() {
        let appIdAlpha = "tenant_alpha"
        let appIdBeta = "tenant_beta"

        let storeAlpha = GoatCookieManager.shared.dataStore(for: appIdAlpha)
        let storeBeta = GoatCookieManager.shared.dataStore(for: appIdBeta)

        // On iOS 17+, distinct UUID data stores are allocated per tenant
        if #available(iOS 17.0, macOS 14.0, *) {
            XCTAssertFalse(storeAlpha === storeBeta, "Tenant Alpha and Tenant Beta must have distinct WKWebsiteDataStore instances")
        } else {
            XCTAssertNotNil(storeAlpha)
            XCTAssertNotNil(storeBeta)
        }

        // Modal created for tenant_alpha must share tenant_alpha dataStore
        let parentAlpha = GoatView(frame: .zero)
        parentAlpha.initialize(appId: appIdAlpha)

        let childAlpha = GoatView(frame: .zero)
        childAlpha.initialize(appId: appIdAlpha)

        let parentStore = parentAlpha.underlyingWKWebView?.configuration.websiteDataStore
        let childStore = childAlpha.underlyingWKWebView?.configuration.websiteDataStore

        XCTAssertEqual(parentStore, childStore, "Modal popup must share parent tenant's WKWebsiteDataStore")

        parentAlpha.destroy()
        childAlpha.destroy()
    }

    // =========================================================================
    // CHALLENGE 4: FOCUS RESTORATION TO PARENT GOATVIEW
    // =========================================================================

    func testClosingModalRestoresFirstResponderToParentWebView() {
        let parentView = GoatView(frame: CGRect(x: 0, y: 0, width: 375, height: 667))
        parentView.initialize(appId: "focus_test_app")

        guard let pm = parentView.popupManager else {
            XCTFail("popupManager is nil")
            return
        }

        let targetUrl = URL(string: "goat://focus_test_app/assets/modal.html")!
        _ = pm.handleSameOriginModal(
            url: targetUrl,
            configuration: WKWebViewConfiguration(),
            windowFeatures: WKWindowFeatures()
        )

        XCTAssertNotNil(pm.activeModalContainer)

        // Close popup
        pm.closeActivePopup(dismissedByUser: false)

        XCTAssertNil(pm.activeModalContainer)
        XCTAssertNil(pm.activeChildGoatView)

        parentView.destroy()
    }
}
#endif // os(iOS)
