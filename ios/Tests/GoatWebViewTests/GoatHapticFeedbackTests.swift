import XCTest
@testable import GoatWebView

final class GoatHapticFeedbackTests: XCTestCase {

    func testImpactStyleFromString() {
        XCTAssertEqual(GoatHapticImpactStyle.fromString("light"), .light)
        XCTAssertEqual(GoatHapticImpactStyle.fromString("MEDIUM"), .medium)
        XCTAssertEqual(GoatHapticImpactStyle.fromString("heavy"), .heavy)
        XCTAssertEqual(GoatHapticImpactStyle.fromString("rigid"), .rigid)
        XCTAssertEqual(GoatHapticImpactStyle.fromString("soft"), .soft)
        XCTAssertEqual(GoatHapticImpactStyle.fromString(nil), .medium)
        XCTAssertEqual(GoatHapticImpactStyle.fromString("unknown"), .medium)
    }

    func testNotificationTypeFromString() {
        XCTAssertEqual(GoatHapticNotificationType.fromString("success"), .success)
        XCTAssertEqual(GoatHapticNotificationType.fromString("WARNING"), .warning)
        XCTAssertEqual(GoatHapticNotificationType.fromString("error"), .error)
        XCTAssertEqual(GoatHapticNotificationType.fromString(nil), .success)
        XCTAssertEqual(GoatHapticNotificationType.fromString("unknown"), .success)
    }

    func testTriggerImpactPayload() {
        let engine = GoatHapticFeedback()
        let payload: [String: Any] = ["type": "impact", "style": "heavy"]
        let res = engine.trigger(payload: payload)

        XCTAssertEqual(res["status"] as? String, "vibrated")
        XCTAssertEqual(res["type"] as? String, "impact")
        XCTAssertEqual(res["style"] as? String, "heavy")
    }

    func testTriggerNotificationPayload() {
        let engine = GoatHapticFeedback()
        let payload: [String: Any] = ["type": "notification", "notificationType": "warning"]
        let res = engine.trigger(payload: payload)

        XCTAssertEqual(res["status"] as? String, "vibrated")
        XCTAssertEqual(res["type"] as? String, "notification")
        XCTAssertEqual(res["notificationType"] as? String, "warning")
    }

    func testTriggerSelectionPayload() {
        let engine = GoatHapticFeedback()
        let payload: [String: Any] = ["type": "selection"]
        let res = engine.trigger(payload: payload)

        XCTAssertEqual(res["status"] as? String, "vibrated")
        XCTAssertEqual(res["type"] as? String, "selection")
    }

    func testTriggerLegacyShortcuts() {
        let engine = GoatHapticFeedback()

        let resLight = engine.trigger(payload: ["type": "light"])
        XCTAssertEqual(resLight["status"] as? String, "vibrated")

        let resError = engine.trigger(payload: ["type": "error"])
        XCTAssertEqual(resError["status"] as? String, "vibrated")
    }

    func testBurstThrottling() {
        let engine = GoatHapticFeedback(minBurstInterval: 0.100)
        let payload: [String: Any] = ["type": "selection"]

        // First call
        let res1 = engine.trigger(payload: payload)
        XCTAssertEqual(res1["status"] as? String, "vibrated")
        XCTAssertEqual(res1["triggered"] as? Bool, true)

        // Rapid subsequent call in burst
        var hadThrottling = false
        for _ in 0..<5 {
            let res2 = engine.trigger(payload: payload)
            if res2["throttled"] as? Bool == true {
                hadThrottling = true
                break
            }
        }
        XCTAssertTrue(hadThrottling, "Immediate burst within 100ms interval must trigger throttling")
    }
}
