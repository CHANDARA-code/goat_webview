import XCTest
@testable import GoatWebView

@MainActor
final class GoatOAuthSessionTests: XCTestCase {

    func testCancelSessionWhenNoActiveSessionReturnsFalse() {
        let manager = GoatOAuthSessionManager()
        let cancelled = manager.cancelSession(sessionId: "non_existent_session")
        XCTAssertFalse(cancelled)
    }

    func testStartSessionWithInvalidUrlFailsValidation() async {
        let manager = GoatOAuthSessionManager()
        let expectation = expectation(description: "Invalid URL completion")

        manager.startSession(
            sessionId: "test_invalid_url",
            authUrlString: "",
            callbackScheme: "goatapp"
        ) { result in
            switch result {
            case .success:
                XCTFail("Expected failure for empty authUrlString")
            case .failure(let error):
                if let bridgeError = error as? GoatBridgeError {
                    switch bridgeError {
                    case .invalidPayload(let msg):
                        XCTAssertTrue(msg.contains("Invalid authUrl"))
                    default:
                        XCTFail("Unexpected bridge error: \(bridgeError)")
                    }
                }
            }
            expectation.fulfill()
        }

        await fulfillment(of: [expectation], timeout: 2.0)
    }

    func testOAuthBridgeActionHandling() async throws {
        let handler = GoatScriptMessageHandler(appId: "oauth_test_tenant")

        // 1. Missing authUrl throws invalidPayload
        do {
            _ = try await handler.dispatchDirect(
                action: "START_OAUTH_SESSION",
                payload: ["callbackUrlScheme": "goatapp"]
            )
            XCTFail("Expected invalidPayload for missing authUrl")
        } catch let error as GoatBridgeError {
            switch error {
            case .invalidPayload(let msg):
                XCTAssertTrue(msg.contains("authUrl"))
            default:
                XCTFail("Unexpected error: \(error)")
            }
        }

        // 2. Missing callbackUrlScheme throws invalidPayload
        do {
            _ = try await handler.dispatchDirect(
                action: "START_OAUTH_SESSION",
                payload: ["authUrl": "https://accounts.google.com/o/oauth2/v2/auth"]
            )
            XCTFail("Expected invalidPayload for missing callbackUrlScheme")
        } catch let error as GoatBridgeError {
            switch error {
            case .invalidPayload(let msg):
                XCTAssertTrue(msg.contains("callbackUrlScheme"))
            default:
                XCTFail("Unexpected error: \(error)")
            }
        }

        // 3. CANCEL_OAUTH_SESSION with no active session returns success: false
        let cancelResult = try await handler.dispatchDirect(
            action: "CANCEL_OAUTH_SESSION",
            payload: ["sessionId": "unknown_session_id"]
        )
        XCTAssertEqual(cancelResult["success"] as? Bool, false)
    }
}
