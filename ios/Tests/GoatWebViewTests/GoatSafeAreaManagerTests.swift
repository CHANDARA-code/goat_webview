import XCTest
@testable import GoatWebView

final class GoatSafeAreaManagerTests: XCTestCase {

    func testDefaultSafeAreaInsets() {
        let manager = GoatSafeAreaManager()
        let insets = manager.getInsets()

        XCTAssertEqual(insets.top, 0)
        XCTAssertEqual(insets.bottom, 0)
        XCTAssertEqual(insets.left, 0)
        XCTAssertEqual(insets.right, 0)
        XCTAssertEqual(insets.keyboardHeight, 0)
        XCTAssertEqual(insets.totalBottom, 0)
    }

    func testUpdateSafeAreaAndKeyboard() {
        let manager = GoatSafeAreaManager()
        let updated = manager.updateSafeArea(top: 48, bottom: 34, left: 0, right: 0)

        XCTAssertEqual(updated.top, 48)
        XCTAssertEqual(updated.bottom, 34)
        XCTAssertEqual(updated.left, 0)
        XCTAssertEqual(updated.right, 0)
        XCTAssertEqual(updated.keyboardHeight, 0)
        XCTAssertEqual(updated.totalBottom, 34)

        // Soft keyboard opens (320px)
        let withKeyboard = manager.updateKeyboardHeight(320)
        XCTAssertEqual(withKeyboard.top, 48)
        XCTAssertEqual(withKeyboard.bottom, 34)
        XCTAssertEqual(withKeyboard.keyboardHeight, 320)
        XCTAssertEqual(withKeyboard.totalBottom, 354)

        // Soft keyboard closes
        let withoutKeyboard = manager.updateKeyboardHeight(0)
        XCTAssertEqual(withoutKeyboard.keyboardHeight, 0)
        XCTAssertEqual(withoutKeyboard.totalBottom, 34)
    }

    func testToJsonObjectFormatting() {
        let manager = GoatSafeAreaManager()
        manager.updateSafeArea(top: 50, bottom: 40, left: 10, right: 10, keyboardHeight: 280)
        let json = manager.toJsonObject()

        XCTAssertEqual(json["top"] as? Int, 50)
        XCTAssertEqual(json["bottom"] as? Int, 40)
        XCTAssertEqual(json["left"] as? Int, 10)
        XCTAssertEqual(json["right"] as? Int, 10)
        XCTAssertEqual(json["keyboardHeight"] as? Int, 280)
        XCTAssertEqual(json["totalBottom"] as? Int, 320)
    }

    func testGenerateCssInjectionScript() {
        let manager = GoatSafeAreaManager()
        let insets = manager.updateSafeArea(top: 48, bottom: 34, left: 0, right: 0, keyboardHeight: 300)
        let script = manager.generateCssInjectionScript(insets: insets)

        XCTAssertTrue(script.contains("--safe-area-inset-top', '48px'"))
        XCTAssertTrue(script.contains("--safe-area-inset-bottom', '34px'"))
        XCTAssertTrue(script.contains("--keyboard-inset-bottom', '300px'"))
        XCTAssertTrue(script.contains("--goat-safe-area-top', '48px'"))
        XCTAssertTrue(script.contains("--goat-safe-area-bottom', '34px'"))
        XCTAssertTrue(script.contains("--goat-keyboard-height', '300px'"))
    }

    func testKeyboardManager() {
        let kbManager = GoatKeyboardManager()
        kbManager.updateState(isVisible: true, heightPx: 336, durationMs: 250)

        let state = kbManager.getCurrentInsets()
        XCTAssertTrue(state.isVisible)
        XCTAssertEqual(state.heightPx, 336)
        XCTAssertEqual(state.durationMs, 250)

        kbManager.reset()
        let resetState = kbManager.getCurrentInsets()
        XCTAssertFalse(resetState.isVisible)
        XCTAssertEqual(resetState.heightPx, 0)
    }
}
