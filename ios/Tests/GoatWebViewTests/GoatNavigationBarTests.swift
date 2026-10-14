#if os(iOS)
import XCTest
@testable import GoatWebView

final class GoatNavigationBarTests: XCTestCase {

    func testDefaultNavBarState() {
        let state = GoatNavBarState()
        XCTAssertEqual(state.title, "")
        XCTAssertNil(state.subtitle)
        XCTAssertEqual(state.backgroundColorHex, "#0F172A")
        XCTAssertEqual(state.textColorHex, "#F8FAFC")
        XCTAssertFalse(state.isDark)
        XCTAssertEqual(state.leftButton, .back)
        XCTAssertEqual(state.rightButtons, [.more, .close])
        XCTAssertFalse(state.isProgressVisible)
        XCTAssertNil(state.progress)
    }

    func testNavButtonTypeFromString() {
        XCTAssertEqual(GoatNavBarButtonType.fromString("BACK"), .back)
        XCTAssertEqual(GoatNavBarButtonType.fromString("back"), .back)
        XCTAssertEqual(GoatNavBarButtonType.fromString("CLOSE"), .close)
        XCTAssertEqual(GoatNavBarButtonType.fromString("MORE"), .more)
        XCTAssertEqual(GoatNavBarButtonType.fromString("CUSTOM"), .custom)
        XCTAssertEqual(GoatNavBarButtonType.fromString("UNKNOWN"), .custom)
        XCTAssertEqual(GoatNavBarButtonType.fromString(nil), .custom)
    }

    func testHexColorParsingValidFormats() throws {
        // 6-digit hex (#FFFFFF)
        let white = try GoatColorParser.parseHex("#FFFFFF")
        XCTAssertEqual(white.r, 1.0, accuracy: 0.001)
        XCTAssertEqual(white.g, 1.0, accuracy: 0.001)
        XCTAssertEqual(white.b, 1.0, accuracy: 0.001)
        XCTAssertEqual(white.a, 1.0, accuracy: 0.001)

        // 6-digit without leading # (000000)
        let black = try GoatColorParser.parseHex("000000")
        XCTAssertEqual(black.r, 0.0, accuracy: 0.001)
        XCTAssertEqual(black.g, 0.0, accuracy: 0.001)
        XCTAssertEqual(black.b, 0.0, accuracy: 0.001)

        // 3-digit hex (#RGB -> #RRGGBB)
        let red = try GoatColorParser.parseHex("#F00")
        XCTAssertEqual(red.r, 1.0, accuracy: 0.001)
        XCTAssertEqual(red.g, 0.0, accuracy: 0.001)
        XCTAssertEqual(red.b, 0.0, accuracy: 0.001)

        // 4-digit hex (#ARGB -> #AARRGGBB)
        let semiBlue = try GoatColorParser.parseHex("#F00F")
        XCTAssertEqual(semiBlue.a, 1.0, accuracy: 0.001)
        XCTAssertEqual(semiBlue.r, 0.0, accuracy: 0.001)
        XCTAssertEqual(semiBlue.g, 0.0, accuracy: 0.001)
        XCTAssertEqual(semiBlue.b, 1.0, accuracy: 0.001)

        // 8-digit hex (#AARRGGBB)
        let alphaRed = try GoatColorParser.parseHex("#80FF0000")
        XCTAssertEqual(alphaRed.a, 128.0 / 255.0, accuracy: 0.01)
        XCTAssertEqual(alphaRed.r, 1.0, accuracy: 0.001)
        XCTAssertEqual(alphaRed.g, 0.0, accuracy: 0.001)
        XCTAssertEqual(alphaRed.b, 0.0, accuracy: 0.001)
    }

    func testHexColorParsingInvalidFormats() {
        let invalidColors = ["", "invalid", "#XYZ", "#12", "#12345", "#1234567", "#GG0000"]
        for inv in invalidColors {
            XCTAssertThrowsError(try GoatColorParser.parseHex(inv), "Expected error for invalid color: \(inv)")
        }
    }

    func testNavBarStateMutations() {
        let state = GoatNavBarState(title: "Initial")
        XCTAssertEqual(state.title, "Initial")

        state.title = "Settings"
        state.subtitle = "Configuring"
        state.backgroundColorHex = "#1E293B"
        state.textColorHex = "#FFFFFF"
        state.isDark = true
        state.leftButton = .close
        state.rightButtons = [.custom]
        state.isProgressVisible = true
        state.progress = 0.75

        XCTAssertEqual(state.title, "Settings")
        XCTAssertEqual(state.subtitle, "Configuring")
        XCTAssertEqual(state.backgroundColorHex, "#1E293B")
        XCTAssertEqual(state.textColorHex, "#FFFFFF")
        XCTAssertTrue(state.isDark)
        XCTAssertEqual(state.leftButton, .close)
        XCTAssertEqual(state.rightButtons, [.custom])
        XCTAssertTrue(state.isProgressVisible)
        XCTAssertEqual(state.progress, 0.75)

        var clicked: GoatNavBarButtonType?
        state.onButtonClicked = { clicked = $0 }
        state.onButtonClicked?(.close)
        XCTAssertEqual(clicked, .close)
    }
}
#endif // os(iOS)
