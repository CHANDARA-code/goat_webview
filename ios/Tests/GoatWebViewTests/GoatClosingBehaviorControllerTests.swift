import XCTest
@testable import GoatWebView

/// Task 10173, iOS side. Mirrors the Android cases so the two platforms cannot drift apart.
final class GoatClosingBehaviorControllerTests: XCTestCase {

    override func setUp() {
        super.setUp()
        GoatClosingBehaviorController.shared.resetForTesting()
    }

    override func tearDown() {
        GoatClosingBehaviorController.shared.resetForTesting()
        super.tearDown()
    }

    func testBothFlagsDefaultToFalse() {
        XCTAssertFalse(GoatClosingBehaviorController.shared.needConfirmation)
        XCTAssertFalse(GoatClosingBehaviorController.shared.allowVerticalSwipe)
        XCTAssertFalse(GoatClosingBehaviorController.shared.shouldConfirmClose())
    }

    func testArmingConfirmationGatesEveryDismissalPath() {
        GoatClosingBehaviorController.shared.setNeedConfirmation(true)
        // Back gesture, edge swipe and the native close button all consult shouldConfirmClose,
        // so one true here is what routes all of them through the dialog.
        XCTAssertTrue(GoatClosingBehaviorController.shared.shouldConfirmClose())
    }

    func testSwipeFlagIsIndependentOfConfirmation() {
        GoatClosingBehaviorController.shared.setNeedConfirmation(true)
        XCTAssertFalse(
            GoatClosingBehaviorController.shared.allowVerticalSwipe,
            "arming confirmation must not silently re-enable the dismiss gesture"
        )

        GoatClosingBehaviorController.shared.setAllowVerticalSwipe(true)
        XCTAssertTrue(GoatClosingBehaviorController.shared.allowVerticalSwipe)
        XCTAssertTrue(
            GoatClosingBehaviorController.shared.needConfirmation,
            "enabling the swipe gesture must not disarm confirmation"
        )
    }

    func testANewRouteResetsBothFlagsToDefaults() {
        GoatClosingBehaviorController.shared.setNeedConfirmation(true)
        GoatClosingBehaviorController.shared.setAllowVerticalSwipe(true)

        GoatClosingBehaviorController.shared.resetForNewRoute()

        // Acceptance criterion 3.
        XCTAssertFalse(GoatClosingBehaviorController.shared.needConfirmation)
        XCTAssertFalse(GoatClosingBehaviorController.shared.allowVerticalSwipe)
    }
}
