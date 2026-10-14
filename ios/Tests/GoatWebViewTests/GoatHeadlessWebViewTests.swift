#if os(iOS)
import XCTest
import WebKit
@testable import GoatWebView

@MainActor
final class GoatHeadlessWebViewTests: XCTestCase {

    func testHeadlessInitializationAndWindowAttachment() {
        let headless = GoatHeadlessWebView(appId: "headless_test_app")
        XCTAssertEqual(headless.appId, "headless_test_app")
        XCTAssertFalse(headless.isDestroyed)
        headless.destroy()
        XCTAssertTrue(headless.isDestroyed)
    }

    func testHeadlessExecuteActionDirect() async throws {
        let headless = GoatHeadlessWebView(appId: "headless_action_app")
        
        let result = try await headless.executeAction(action: "GET_DEVICE_INFO", payload: [:])
        XCTAssertEqual(result["platform"] as? String, "iOS")
        XCTAssertEqual(result["appId"] as? String, "headless_action_app")
        
        headless.destroy()
    }

    func testHeadlessCustomHandlerRegistration() async throws {
        let headless = GoatHeadlessWebView(appId: "headless_custom_app")
        headless.registerHandler(action: "BACKGROUND_SYNC") { action, payload in
            return ["synced": true, "count": 42]
        }

        let result = try await headless.executeAction(action: "BACKGROUND_SYNC", payload: [:])
        XCTAssertEqual(result["synced"] as? Bool, true)
        XCTAssertEqual(result["count"] as? Int, 42)

        headless.destroy()
    }

    func testHeadlessPostDestroyRejection() async throws {
        let headless = GoatHeadlessWebView(appId: "headless_destroy_app")
        headless.destroy()
        XCTAssertTrue(headless.isDestroyed)

        do {
            _ = try await headless.executeAction(action: "GET_DEVICE_INFO", payload: [:])
            XCTFail("Should have thrown viewDisposed error")
        } catch {
            guard case GoatBridgeError.viewDisposed = error else {
                XCTFail("Expected viewDisposed, got \(error)")
                return
            }
        }
    }

    func testHeadlessMultiTenantIsolation() {
        let headlessA = GoatHeadlessWebView(appId: "tenant_alpha")
        let headlessB = GoatHeadlessWebView(appId: "tenant_beta")
        
        XCTAssertEqual(headlessA.appId, "tenant_alpha")
        XCTAssertEqual(headlessB.appId, "tenant_beta")
        XCTAssertNotEqual(headlessA.appId, headlessB.appId)

        headlessA.destroy()
        headlessB.destroy()
    }
}
#endif // os(iOS)
