#if os(iOS)
import XCTest
import Foundation
@testable import GoatWebView

/**
 * Adversarial Empirical Challenge Test Suite for iOS Auth, OAuth Session, and Abuse Guard (Task 10199).
 */
@MainActor
final class GoatAuthAndSecurityEmpiricalChallengeTests: XCTestCase {

    private var abuseGuard: GoatAbuseGuard!

    override func setUp() {
        super.setUp()
        abuseGuard = GoatAbuseGuard(defaultGestureWindow: 10.0, maxDialogRequests: 3, dialogWindow: 3.0)
        GoatAbuseGuard.shared.reset()
    }

    override func tearDown() {
        abuseGuard = nil
        GoatAbuseGuard.shared.reset()
        super.tearDown()
    }

    // =========================================================================
    // SECTION 1: GESTURE FRESHNESS BOUNDARY PRECISION & CLOCK SKEW
    // =========================================================================

    func testGestureFreshnessBoundaryPrecision() {
        let now: TimeInterval = 1_000_000.0

        // 1. Exactly 0ms age (instant touch)
        abuseGuard.recordUserGesture(at: now)
        XCTAssertTrue(abuseGuard.isGestureFresh(window: 10.0, now: now), "0s age gesture must be fresh")

        // 2. Boundary: exactly 10.000s age (inclusive boundary pass)
        abuseGuard.recordUserGesture(at: now - 10.0)
        XCTAssertTrue(abuseGuard.isGestureFresh(window: 10.0, now: now), "Exactly 10.0s age gesture must be fresh")

        // 3. Boundary + 1ms: 10.001s age -> STALE (boundary fail)
        abuseGuard.recordUserGesture(at: now - 10.001)
        XCTAssertFalse(abuseGuard.isGestureFresh(window: 10.0, now: now), "10.001s age gesture must be stale")

        // 4. Stale gesture (> 10s)
        abuseGuard.recordUserGesture(at: now - 20.0)
        XCTAssertFalse(abuseGuard.isGestureFresh(window: 10.0, now: now), "20.0s age gesture must be stale")
    }

    // =========================================================================
    // SECTION 2: ALL 13 PRIVILEGED ACTIONS FAIL CLOSED WITH GESTURE_REQUIRED
    // =========================================================================

    func testAll13PrivilegedActionsFailClosedWhenStale() async throws {
        GoatAbuseGuard.shared.reset() // Stale gesture (timestamp = 0)
        let handler = GoatScriptMessageHandler(appId: "priv_challenge_app")

        let privilegedActions = GoatAbuseGuard.privilegedActions
        // Task 10206 adds CANCEL_PAYMENT; the wallet SPI adds WEB3_SIGN_MESSAGE, which carries the
        // EIP-712 / Permit2 drainer vector and so needs the same gesture gate as WEB3_SIGN_TRANSACTION.
        XCTAssertEqual(privilegedActions.count, 13, "Must contain exactly 13 privileged actions")
        XCTAssertTrue(privilegedActions.contains("WEB3_SIGN_MESSAGE"))

        for action in privilegedActions {
            let dummyPayload: [String: Any] = [
                "phoneNumber": "+1234567890",
                "body": "SMS Body",
                "latitude": 37.7749,
                "longitude": -122.4194,
                "text": "Share text",
                "orderId": "order_123"
            ]

            do {
                _ = try await handler.dispatchDirect(action: action, payload: dummyPayload)
                XCTFail("Privileged action '\(action)' MUST fail when user gesture is stale")
            } catch let error as GoatBridgeError {
                switch error {
                case .securityViolation(let reason):
                    XCTAssertTrue(
                        reason.contains("GESTURE_REQUIRED"),
                        "Error reason for '\(action)' must contain GESTURE_REQUIRED, got: \(reason)"
                    )
                default:
                    XCTFail("Expected securityViolation for '\(action)', got: \(error)")
                }
            } catch {
                XCTFail("Unexpected exception for '\(action)': \(error)")
            }
        }
    }

    // =========================================================================
    // SECTION 3: REPEATED DIALOG SPAM COOLDOWN & QUEUE ISOLATION
    // =========================================================================

    func testRepeatedDialogSpamCooldownAndQueueIsolation() {
        let now: TimeInterval = 2_000_000.0
        let window: TimeInterval = 3.0
        let maxRequests = 3

        // Requests 1, 2, 3 are allowed
        XCTAssertFalse(abuseGuard.shouldThrottleDialog(dialogType: "SHOW_MODAL", maxRequests: maxRequests, window: window, now: now))
        XCTAssertFalse(abuseGuard.shouldThrottleDialog(dialogType: "SHOW_MODAL", maxRequests: maxRequests, window: window, now: now + 0.5))
        XCTAssertFalse(abuseGuard.shouldThrottleDialog(dialogType: "SHOW_MODAL", maxRequests: maxRequests, window: window, now: now + 1.0))

        // Request 4 at 1.5s (within 3s window) -> THROTTLED with cooldown active
        XCTAssertTrue(
            abuseGuard.shouldThrottleDialog(dialogType: "SHOW_MODAL", maxRequests: maxRequests, window: window, now: now + 1.5),
            "4th request within sliding window must be throttled"
        )

        // Independent dialog type "SHOW_ACTION_SHEET" is NOT throttled
        XCTAssertFalse(
            abuseGuard.shouldThrottleDialog(dialogType: "SHOW_ACTION_SHEET", maxRequests: maxRequests, window: window, now: now + 1.6),
            "SHOW_ACTION_SHEET must have independent queue from SHOW_MODAL"
        )

        // Independent dialog type "SHOW_TOAST" is NOT throttled
        XCTAssertFalse(
            abuseGuard.shouldThrottleDialog(dialogType: "SHOW_TOAST", maxRequests: maxRequests, window: window, now: now + 1.7),
            "SHOW_TOAST must have independent queue from SHOW_MODAL"
        )

        // After window expires (at now + 4.5s relative to request 1, oldest remaining are outside 3s)
        XCTAssertFalse(
            abuseGuard.shouldThrottleDialog(dialogType: "SHOW_MODAL", maxRequests: maxRequests, window: window, now: now + 4.5),
            "Dialog request after window expiration must be allowed"
        )

        // Reset clears dialog history
        abuseGuard.reset()
        XCTAssertFalse(
            abuseGuard.shouldThrottleDialog(dialogType: "SHOW_MODAL", maxRequests: maxRequests, window: window, now: now + 4.6),
            "Reset must clear dialog throttling history"
        )
    }

    func testDialogSpamBridgeErrorThrowsDialogCooldownActive() async throws {
        GoatAbuseGuard.shared.recordUserGesture() // Ensure gesture is fresh
        let handler = GoatScriptMessageHandler(appId: "dialog_spam_app")

        let now = Date().timeIntervalSince1970
        // Trigger 3 dialogs
        _ = GoatAbuseGuard.shared.shouldThrottleDialog(dialogType: "SHOW_MODAL", maxRequests: 3, window: 3.0, now: now)
        _ = GoatAbuseGuard.shared.shouldThrottleDialog(dialogType: "SHOW_MODAL", maxRequests: 3, window: 3.0, now: now + 0.1)
        _ = GoatAbuseGuard.shared.shouldThrottleDialog(dialogType: "SHOW_MODAL", maxRequests: 3, window: 3.0, now: now + 0.2)

        // 4th dialog request must throw securityViolation with DIALOG_COOLDOWN_ACTIVE
        do {
            _ = try await handler.dispatchDirect(action: "SHOW_MODAL", payload: ["title": "Spam Modal"])
            XCTFail("Expected securityViolation DIALOG_COOLDOWN_ACTIVE")
        } catch let error as GoatBridgeError {
            switch error {
            case .securityViolation(let reason):
                XCTAssertTrue(reason.contains("DIALOG_COOLDOWN_ACTIVE"), "Must contain DIALOG_COOLDOWN_ACTIVE, got: \(reason)")
            default:
                XCTFail("Expected securityViolation, got: \(error)")
            }
        }
    }
}
#endif // os(iOS)
