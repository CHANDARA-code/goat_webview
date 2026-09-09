import WebKit
import XCTest
@testable import GoatWebView

/// Task 10154. The two validation rules are that every Goat configuration shares one
/// `WKProcessPool`, and that tenant storage stays partitioned per `appId` regardless.
final class GoatProcessPoolManagerTests: XCTestCase {

    func testEveryGoatSurfaceSharesOneProcessPool() {
        let pool = GoatProcessPoolManager.shared.sharedProcessPool

        // GoatWKWebView used to declare its own pool. It must now resolve to the same instance,
        // otherwise unifying the other paths would have created a second pool rather than removed
        // the split.
        XCTAssertTrue(GoatWKWebView.sharedProcessPool === pool)

        let a = WKWebViewConfiguration()
        let b = WKWebViewConfiguration()
        GoatProcessPoolManager.shared.configure(a, appId: "tenant-a")
        GoatProcessPoolManager.shared.configure(b, appId: "tenant-b")

        XCTAssertTrue(a.processPool === pool)
        XCTAssertTrue(b.processPool === pool)
        XCTAssertTrue(a.processPool === b.processPool, "different tenants still share the pool")
    }

    func testDataStoresStayPartitionedPerAppIdDespiteTheSharedPool() {
        let a = GoatProcessPoolManager.shared.dataStoreForApp(appId: "tenant-a")
        let b = GoatProcessPoolManager.shared.dataStoreForApp(appId: "tenant-b")
        XCTAssertFalse(a === b, "distinct appIds must not share a data store")

        // Same tenant must resolve to the identical store, or cookies would not survive a remount.
        let aAgain = GoatProcessPoolManager.shared.dataStoreForApp(appId: "tenant-a")
        XCTAssertTrue(a === aAgain)
    }

    func testDataStoreDelegatesToCookieManagerRatherThanCachingSeparately() {
        // A second cache would drift from GoatCookieManager and hand the same tenant two stores.
        let viaManager = GoatProcessPoolManager.shared.dataStoreForApp(appId: "tenant-c")
        let viaCookies = GoatCookieManager.shared.dataStore(for: "tenant-c")
        XCTAssertTrue(viaManager === viaCookies)
    }

    func testConfigureDoesNotOverrideAnExplicitlyChosenDataStore() {
        let config = WKWebViewConfiguration()
        let ephemeral = WKWebsiteDataStore.nonPersistent()
        config.websiteDataStore = ephemeral

        GoatProcessPoolManager.shared.configure(config, appId: "tenant-d")

        XCTAssertTrue(config.processPool === GoatProcessPoolManager.shared.sharedProcessPool)
        XCTAssertTrue(config.websiteDataStore === ephemeral, "an explicit store must survive")
    }
}

