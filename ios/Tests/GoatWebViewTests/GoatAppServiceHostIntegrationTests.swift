import XCTest
@testable import GoatWebView
#if canImport(UIKit)
import UIKit
#endif

/**
 * Unit and Integration Test Suite for Milestone 3 iOS Host Integration (Task F8).
 *
 * Verifies:
 * 1. AppService Worker bridge frame dispatch through [GoatScriptMessageHandler]
 * 2. Host lifecycle signal dispatch (onAppServiceReady, onAppServiceCrash, onAppServiceTerminate)
 * 3. Thread-safe handler registration and concurrent queue protection
 * 4. GoatView lifecycle callback integration
 */
final class GoatAppServiceHostIntegrationTests: XCTestCase {

    private var messageHandler: GoatScriptMessageHandler!

    override func setUp() {
        super.setUp()
        messageHandler = GoatScriptMessageHandler(appId: "ios_dual_thread_test")
    }

    override func tearDown() {
        messageHandler = nil
        super.tearDown()
    }

    func testGoatScriptMessageHandlerReceivesAppServiceReady() async throws {
        var readyFired = false
        var readyAppId: String?
        var readyDetails: [String: Any]?

        messageHandler.onAppServiceReady = { appId, details in
            readyFired = true
            readyAppId = appId
            readyDetails = details
        }

        XCTAssertTrue(messageHandler.getSupportedActions().contains("ON_APP_SERVICE_READY"))
        XCTAssertTrue(messageHandler.getSupportedActions().contains("APP_SERVICE_READY"))

        let payload: [String: Any] = [
            "appId": "ios_dual_thread_test",
            "details": ["engine": "jsc_worker", "version": "2.0.0"]
        ]

        let result = try await messageHandler.dispatchDirect(action: "ON_APP_SERVICE_READY", payload: payload)
        XCTAssertEqual(result["handled"] as? Bool, true)
        XCTAssertEqual(result["event"] as? String, "onAppServiceReady")
        XCTAssertEqual(result["appId"] as? String, "ios_dual_thread_test")

        XCTAssertTrue(readyFired)
        XCTAssertEqual(readyAppId, "ios_dual_thread_test")
        XCTAssertEqual(readyDetails?["engine"] as? String, "jsc_worker")

        // Also verify APP_SERVICE_READY alias
        let aliasResult = try await messageHandler.dispatchDirect(action: "APP_SERVICE_READY", payload: payload)
        XCTAssertEqual(aliasResult["handled"] as? Bool, true)
    }

    func testGoatScriptMessageHandlerReceivesAppServiceCrash() async throws {
        var crashFired = false
        var crashAppId: String?
        var crashError: String?

        messageHandler.onAppServiceCrash = { appId, error, _ in
            crashFired = true
            crashAppId = appId
            crashError = error
        }

        let payload: [String: Any] = [
            "appId": "ios_dual_thread_test",
            "error": "Worker memory allocation exhausted (OOM)",
            "details": ["fatal": true]
        ]

        let result = try await messageHandler.dispatchDirect(action: "ON_APP_SERVICE_CRASH", payload: payload)
        XCTAssertEqual(result["handled"] as? Bool, true)
        XCTAssertEqual(result["event"] as? String, "onAppServiceCrash")
        XCTAssertEqual(result["error"] as? String, "Worker memory allocation exhausted (OOM)")

        XCTAssertTrue(crashFired)
        XCTAssertEqual(crashAppId, "ios_dual_thread_test")
        XCTAssertEqual(crashError, "Worker memory allocation exhausted (OOM)")
    }

    func testGoatScriptMessageHandlerReceivesAppServiceTerminate() async throws {
        var terminateFired = false
        var terminateAppId: String?

        messageHandler.onAppServiceTerminate = { appId, _ in
            terminateFired = true
            terminateAppId = appId
        }

        let payload: [String: Any] = [
            "appId": "ios_dual_thread_test"
        ]

        let result = try await messageHandler.dispatchDirect(action: "ON_APP_SERVICE_TERMINATE", payload: payload)
        XCTAssertEqual(result["handled"] as? Bool, true)
        XCTAssertEqual(result["event"] as? String, "onAppServiceTerminate")
        XCTAssertTrue(terminateFired)
        XCTAssertEqual(terminateAppId, "ios_dual_thread_test")
    }

    #if canImport(UIKit)
    @MainActor
    func testGoatViewLifecycleCallbacks() {
        let goatView = GoatView(frame: CGRect(x: 0, y: 0, width: 375, height: 667))
        var readyFired = false
        var crashFired = false
        var terminateFired = false

        goatView.onAppServiceReady = { appId in
            if appId == "view_test_app" { readyFired = true }
        }
        goatView.onAppServiceCrash = { appId, error in
            if appId == "view_test_app" && error.contains("crash") { crashFired = true }
        }
        goatView.onAppServiceTerminate = { appId in
            if appId == "view_test_app" { terminateFired = true }
        }

        goatView.onAppServiceReady?("view_test_app")
        goatView.onAppServiceCrash?("view_test_app", "simulated crash")
        goatView.onAppServiceTerminate?("view_test_app")

        XCTAssertTrue(readyFired)
        XCTAssertTrue(crashFired)
        XCTAssertTrue(terminateFired)
    }
    #endif

    func testConcurrentHandlerRegistrationSafety() async throws {
        let iterations = 100
        await withTaskGroup(of: Void.self) { group in
            for i in 0..<iterations {
                group.addTask {
                    self.messageHandler.registerHandler(action: "CONCURRENT_ACTION_\(i)") { _, _ in
                        return ["index": i]
                    }
                }
            }
        }

        let supported = messageHandler.getSupportedActions()
        XCTAssertTrue(supported.contains("CONCURRENT_ACTION_0"))
        XCTAssertTrue(supported.contains("CONCURRENT_ACTION_99"))
    }
}
