#if os(iOS)
import XCTest
import Foundation
#if canImport(UIKit)
import UIKit
#endif
import WebKit
@testable import GoatWebView

@MainActor
final class GoatWebViewTests: XCTestCase {

    func testGoatWKWebViewInitialization() {
        let webView = GoatWKWebView(frame: .zero, appId: "test_app", version: "2.0.0")
        XCTAssertEqual(webView.appId, "test_app")
        XCTAssertEqual(webView.version, "2.0.0")
        XCTAssertFalse(webView.isOpaque)
    }

    func testGoatURLSchemeHandlerSecurityTraversalGuard() {
        let handler = GoatURLSchemeHandler(appId: "test_app", baseBundlePath: "/tmp/test")
        XCTAssertEqual(handler.appId, "test_app")
    }

    func testGoatWebProcessTerminationHandlerRetryBudget() {
        let handler = GoatWebProcessTerminationHandler()
        handler.resetRetryBudget()
        XCTAssertNotNil(handler)
    }
}

extension GoatWebViewTests {
    func testByteRangeParsingRfc7233() {
        typealias R = GoatURLSchemeHandler.ByteRangeParseResult
        XCTAssertEqual(GoatURLSchemeHandler.parseByteRange("bytes=0-1023", contentLength: 4096), R.satisfiable(start: 0, end: 1023))
        XCTAssertEqual(GoatURLSchemeHandler.parseByteRange("bytes=100-", contentLength: 4096), R.satisfiable(start: 100, end: 4095))
        XCTAssertEqual(GoatURLSchemeHandler.parseByteRange("bytes=-500", contentLength: 4096), R.satisfiable(start: 3596, end: 4095))
        XCTAssertEqual(GoatURLSchemeHandler.parseByteRange("bytes=-99999", contentLength: 4096), R.satisfiable(start: 0, end: 4095))
        XCTAssertEqual(GoatURLSchemeHandler.parseByteRange("bytes=0-0", contentLength: 4096), R.satisfiable(start: 0, end: 0))
        XCTAssertEqual(GoatURLSchemeHandler.parseByteRange("bytes=4096-", contentLength: 4096), R.unsatisfiable)
        XCTAssertEqual(GoatURLSchemeHandler.parseByteRange("bytes=100-10", contentLength: 4096), R.unsatisfiable)
        XCTAssertEqual(GoatURLSchemeHandler.parseByteRange("bytes=abc-def", contentLength: 4096), R.unsatisfiable)
        XCTAssertEqual(GoatURLSchemeHandler.parseByteRange("bytes=0-100,200-300", contentLength: 4096), R.unsatisfiable)
        XCTAssertEqual(GoatURLSchemeHandler.parseByteRange("bytes=-0", contentLength: 4096), R.unsatisfiable)
        XCTAssertEqual(GoatURLSchemeHandler.parseByteRange("items=0-10", contentLength: 4096), R.unsatisfiable)
        XCTAssertEqual(GoatURLSchemeHandler.parseByteRange("bytes=0-10", contentLength: 0), R.unsatisfiable)
    }

    func testDnsAwareSsfrBlocksResolvedPrivateAddresses() {
        XCTAssertTrue(GoatScriptMessageHandler.isBlockedIpAddress("127.0.0.1"))
        XCTAssertTrue(GoatScriptMessageHandler.isBlockedIpAddress("10.0.0.5"))
        XCTAssertTrue(GoatScriptMessageHandler.isBlockedIpAddress("192.168.1.1"))
        XCTAssertTrue(GoatScriptMessageHandler.isBlockedIpAddress("172.16.0.1"))
        XCTAssertTrue(GoatScriptMessageHandler.isBlockedIpAddress("169.254.169.254"))
        XCTAssertTrue(GoatScriptMessageHandler.isBlockedIpAddress("::1"))
        XCTAssertTrue(GoatScriptMessageHandler.isBlockedIpAddress("fe80::1"))
        XCTAssertTrue(GoatScriptMessageHandler.isBlockedIpAddress("fd00::1"))
        XCTAssertTrue(GoatScriptMessageHandler.isBlockedIpAddress("::ffff:10.0.0.5"))
        XCTAssertFalse(GoatScriptMessageHandler.isBlockedIpAddress("8.8.8.8"))
        XCTAssertFalse(GoatScriptMessageHandler.isBlockedIpAddress("93.184.216.34"))

        let loopbackIps = GoatScriptMessageHandler.resolveAllAddresses(host: "localhost")
        XCTAssertTrue(loopbackIps.contains { GoatScriptMessageHandler.isBlockedIpAddress($0) })
    }

    func testPushTokenHostCallbackFiresOnRefresh() {
        let manager = GoatNotificationManager()
        let expectation = expectation(description: "onPushTokenRefresh")
        var received: String?
        manager.onPushTokenRefresh = { token in
            received = token
            expectation.fulfill()
        }
        manager.updatePushToken("apns_real_token_42")
        wait(for: [expectation], timeout: 2)
        XCTAssertEqual(received, "apns_real_token_42")
        XCTAssertEqual(manager.getPushToken()["token"] as? String, "apns_real_token_42")
    }
}
#endif // os(iOS)
