import XCTest
@testable import GoatWebView

final class GoatBottomSheetTests: XCTestCase {

    func testSnapPointsSanitization() {
        let rawPoints = [1.5, 0.9, 0.05, 0.5, 0.25, 0.5]
        let sanitized = GoatBottomSheetConfig.sanitizeSnapPoints(rawPoints)

        XCTAssertEqual(sanitized, [0.1, 0.25, 0.5, 0.9, 1.0])

        let emptySanitized = GoatBottomSheetConfig.sanitizeSnapPoints([])
        XCTAssertEqual(emptySanitized, [0.25, 0.5, 0.9])
    }

    func testExpandAndCollapseStateTransitions() {
        var state = GoatBottomSheetState(
            snapPoints: [0.25, 0.5, 0.9],
            currentSnap: 0.5,
            isDismissible: true
        )

        // Expand from 0.5 -> 0.9
        let nextSnap = state.expand()
        XCTAssertEqual(nextSnap, 0.9, accuracy: 0.001)
        XCTAssertEqual(state.sheetValue, .expanded)

        // Expand again at max stays at 0.9
        let maxSnap = state.expand()
        XCTAssertEqual(maxSnap, 0.9, accuracy: 0.001)

        // Collapse from 0.9 -> 0.5
        let (collapsed1, dismissed1) = state.collapse()
        XCTAssertEqual(collapsed1, 0.5, accuracy: 0.001)
        XCTAssertFalse(dismissed1)
        XCTAssertEqual(state.sheetValue, .half)

        // Collapse from 0.5 -> 0.25
        let (collapsed2, dismissed2) = state.collapse()
        XCTAssertEqual(collapsed2, 0.25, accuracy: 0.001)
        XCTAssertFalse(dismissed2)
        XCTAssertEqual(state.sheetValue, .collapsed)

        // Collapse from minimum snap (0.25) with isDismissible = true -> dismissed
        let (dismissedSnap, isDismissed) = state.collapse()
        XCTAssertEqual(dismissedSnap, 0.0, accuracy: 0.001)
        XCTAssertTrue(isDismissed)
        XCTAssertEqual(state.sheetValue, .hidden)
    }

    func testNonDismissibleCollapseStaysAtMinimum() {
        var state = GoatBottomSheetState(
            snapPoints: [0.25, 0.5, 0.9],
            currentSnap: 0.25,
            isDismissible: false
        )

        let (heldSnap, isDismissed) = state.collapse()
        XCTAssertEqual(heldSnap, 0.25, accuracy: 0.001)
        XCTAssertFalse(isDismissed)
        XCTAssertEqual(state.sheetValue, .collapsed)
    }

    func testSheetValueFromSnapFraction() {
        let snapPoints = [0.25, 0.5, 0.9]

        XCTAssertEqual(GoatSheetValue.fromSnapFraction(0.0, snapPoints: snapPoints), .hidden)
        XCTAssertEqual(GoatSheetValue.fromSnapFraction(0.25, snapPoints: snapPoints), .collapsed)
        XCTAssertEqual(GoatSheetValue.fromSnapFraction(0.5, snapPoints: snapPoints), .half)
        XCTAssertEqual(GoatSheetValue.fromSnapFraction(0.9, snapPoints: snapPoints), .expanded)
    }

    func testDefaultConfig() {
        let config = GoatBottomSheetConfig()
        XCTAssertEqual(config.snapPoints, [0.25, 0.5, 0.9])
        XCTAssertEqual(config.initialSnap, 0.5)
        XCTAssertTrue(config.isDismissible)
        XCTAssertTrue(config.showDragHandle)
        XCTAssertEqual(config.cornerRadius, 16.0)
    }
}
