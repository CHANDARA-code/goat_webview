#if os(iOS)
import XCTest
@testable import GoatWebView

/// Mirrors the Android GoatThemeManagerTest / GoatDesignBootstrapTest cases so the two platforms
/// cannot drift apart in behaviour without a test noticing.
final class GoatThemeManagerTests: XCTestCase {

    override func setUp() {
        super.setUp()
        GoatThemeManager.shared.resetForTesting()
        GoatDesignManager.shared.resetForTesting()
    }

    override func tearDown() {
        GoatThemeManager.shared.resetForTesting()
        GoatDesignManager.shared.resetForTesting()
        super.tearDown()
    }

    func testDefaultsToLight() {
        XCTAssertEqual(GoatThemeManager.shared.current.colorScheme, GoatThemeTokens.light)
    }

    func testSetColorSchemeSwapsTheWholePalette() {
        GoatThemeManager.shared.setColorScheme(dark: true)
        let t = GoatThemeManager.shared.current
        XCTAssertEqual(t.colorScheme, GoatThemeTokens.dark)
        XCTAssertEqual(t.bgColor, "#1c1c1d")
        XCTAssertEqual(t.textColor, "#ffffff")
    }

    func testUpdateThemeKeepsUnspecifiedFields() {
        GoatThemeManager.shared.updateTheme { var t = $0; t.buttonColor = "#ff0000"; return t }
        let t = GoatThemeManager.shared.current
        XCTAssertEqual(t.buttonColor, "#ff0000")
        // A host that only cares about one colour must not silently lose the rest.
        XCTAssertEqual(t.bgColor, GoatThemeTokens.defaultLight.bgColor)
        XCTAssertEqual(t.linkColor, GoatThemeTokens.defaultLight.linkColor)
    }

    func testListenersFireOnChange() {
        var fired = 0
        GoatThemeManager.shared.addListener { _ in fired += 1 }
        GoatThemeManager.shared.setColorScheme(dark: true)
        XCTAssertEqual(fired, 1)
    }

    func testAnIdenticalThemeDoesNotNotify() {
        var fired = 0
        GoatThemeManager.shared.addListener { _ in fired += 1 }
        GoatThemeManager.shared.setTheme(.defaultLight)
        // Already light. Re-pushing identical tokens would re-run every mini-app's themeChanged
        // handler and repaint for nothing.
        XCTAssertEqual(fired, 0)
    }

    func testRemovedListenersStopFiring() {
        var fired = 0
        let id = GoatThemeManager.shared.addListener { _ in fired += 1 }
        GoatThemeManager.shared.removeListener(id)
        GoatThemeManager.shared.setColorScheme(dark: true)
        XCTAssertEqual(fired, 0)
    }

    func testDesignManagerIsIndependentOfTheme() {
        var designFired = 0
        GoatDesignManager.shared.addListener { _ in designFired += 1 }
        GoatThemeManager.shared.setColorScheme(dark: true)
        XCTAssertEqual(designFired, 0, "a colour change must not invalidate the design scale")

        GoatDesignManager.shared.updateDesign { var d = $0; d.spacingUnit = "4px"; return d }
        XCTAssertEqual(designFired, 1)
        XCTAssertEqual(GoatDesignManager.shared.current.spacingUnit, "4px")
    }

    func testTelegramKeyNamesAreEmitted() {
        let keys = Set(GoatThemeTokens.defaultLight.toPairs().map { $0.0 })
        for k in ["bg_color", "text_color", "hint_color", "link_color",
                  "button_color", "button_text_color", "secondary_bg_color"] {
            XCTAssertTrue(keys.contains(k), "missing Telegram key: \(k)")
        }
    }

    // MARK: - bootstrap

    func testStyleTextCarriesEveryToken() {
        let css = GoatDesignBootstrap.buildStyleText(
            theme: .defaultLight, design: .defaultTokens
        )
        for (k, _) in GoatThemeTokens.defaultLight.toPairs() {
            XCTAssertTrue(css.contains(GoatDesignBootstrap.cssVariableName(k, prefix: "goat-theme")))
        }
        for (k, _) in GoatDesignTokens.defaultTokens.toPairs() {
            XCTAssertTrue(css.contains(GoatDesignBootstrap.cssVariableName(k, prefix: "goat-design")))
        }
    }

    func testTelegramAliasesAreEmitted() {
        let css = GoatDesignBootstrap.buildStyleText(theme: .defaultLight, design: .defaultTokens)
        XCTAssertTrue(css.contains("--tg-theme-bg-color"))
        XCTAssertTrue(css.contains("--tg-theme-button-color"))
    }

    func testColorSchemeIsDeclaredSoNativeControlsMatch() {
        let css = GoatDesignBootstrap.buildStyleText(theme: .defaultDark, design: .defaultTokens)
        // Without this, form controls and scrollbars stay light on a dark host.
        XCTAssertTrue(css.contains("color-scheme:dark"))
    }

    func testAndroidAndIosProduceTheSameCssVariableNames() {
        // The two bootstraps must agree; a mini-app styled on one platform has to render on the other.
        XCTAssertEqual(
            GoatDesignBootstrap.cssVariableName("bg_color", prefix: "goat-theme"),
            "--goat-theme-bg-color"
        )
        XCTAssertEqual(
            GoatDesignBootstrap.cssVariableName("section_header_text_color", prefix: "tg-theme"),
            "--tg-theme-section-header-text-color"
        )
    }

    func testAHostileTokenCannotBreakOutOfTheScript() {
        // Host-supplied values become script content. Asserted by round-trip rather than substring:
        // the payload legitimately contains the hostile text in escaped form.
        var hostile = GoatThemeTokens.defaultLight
        hostile.bgColor = "\"; window.__pwned = true; var x = \""
        hostile.textColor = "</script><script>window.__pwned2=1;</script>"

        let js = GoatDesignBootstrap.buildScript(theme: hostile, design: .defaultTokens)
        guard let line = js.split(separator: "\n").first(where: { $0.contains("app.themeParams = ") }) else {
            return XCTFail("themeParams line not found")
        }
        var payload = String(line).components(separatedBy: "app.themeParams = ")[1]
            .trimmingCharacters(in: .whitespaces)
        if payload.hasSuffix(";") { payload.removeLast() }

        guard let obj = try? JSONSerialization.jsonObject(with: Data(payload.utf8)),
              let parsed = obj as? [String: String] else {
            return XCTFail("themeParams did not parse as JSON — escaping is broken")
        }
        XCTAssertEqual(parsed["bg_color"], hostile.bgColor)
        XCTAssertEqual(parsed["text_color"], hostile.textColor)
    }

    func testUpdateScriptIsGuardedForAPageThatHasNotLoadedYet() {
        let js = GoatDesignBootstrap.buildUpdateScript(theme: .defaultDark, design: .defaultTokens)
        XCTAssertTrue(js.hasPrefix("window.GoatWebApp &&"))
        XCTAssertTrue(js.contains("__applyTokens"))
    }
}
#endif // os(iOS)
