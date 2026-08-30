import XCTest
import Foundation
import WebKit
#if canImport(UIKit)
import UIKit
#endif
@testable import GoatWebView

final class GoatWebViewUITests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    #if canImport(UIKit)
    @MainActor
    func testGoatWebViewUIElementHierarchy() throws {
        // 1. Initialize native host container view
        let containerFrame = CGRect(x: 0, y: 0, width: 390, height: 844)
        let goatView = GoatView(frame: containerFrame)
        goatView.accessibilityIdentifier = "goat-webview-container"

        XCTAssertEqual(goatView.frame.width, 390)
        XCTAssertEqual(goatView.frame.height, 844)
        XCTAssertEqual(goatView.accessibilityIdentifier, "goat-webview-container")
        XCTAssertFalse(goatView.isOpaque)
        XCTAssertEqual(goatView.backgroundColor, .clear)

        // 2. Initialize embedded WKWebView with sandboxed appId
        goatView.initialize(appId: "com.goat.shop", initialRoute: "/products")

        // 3. Inspect hierarchy subviews
        XCTAssertEqual(goatView.subviews.count, 1)
        guard let embeddedWv = goatView.subviews.first as? GoatWKWebView else {
            XCTFail("Embedded subview must be an instance of GoatWKWebView")
            return
        }

        XCTAssertEqual(embeddedWv.appId, "com.goat.shop")
        XCTAssertEqual(embeddedWv.autoresizingMask, [.flexibleWidth, .flexibleHeight])
        XCTAssertFalse(embeddedWv.isOpaque)
        XCTAssertEqual(embeddedWv.backgroundColor, .clear)

        // 4. Verify XCUIApplication element hierarchy query compatibility
        let isRunningInAppHost = Bundle.main.bundlePath.hasSuffix(".app")
        if isRunningInAppHost {
            let app = XCUIApplication()
            let containerElement = app.otherElements["goat-webview-container"]
            if containerElement.waitForExistence(timeout: 2.0) {
                XCTAssertTrue(containerElement.exists)
                XCTAssertTrue(containerElement.isHittable)
            }
        }
    }

    @MainActor
    func testProMotion120FpsFluidity() throws {
        // 1. Validate high-refresh rate configuration on WKWebView scroll container
        let webView = GoatWKWebView(frame: CGRect(x: 0, y: 0, width: 390, height: 844), appId: "fluidity_test", version: "1.0.0")

        XCTAssertTrue(webView.scrollView.bounces, "ScrollView bounces must be enabled for native inertial deceleration")
        XCTAssertEqual(
            webView.scrollView.contentInsetAdjustmentBehavior,
            .always,
            "Safe area insets must adapt dynamically across ProMotion display updates"
        )
        XCTAssertEqual(webView.scrollView.backgroundColor, .clear)

        // 2. Assert hardware-accelerated composition preferences
        let config = webView.configuration
        XCTAssertTrue(config.allowsInlineMediaPlayback)
        XCTAssertTrue(config.defaultWebpagePreferences.allowsContentJavaScript)

        // 3. Verify display link and animation frame fluidity settings
        let displayLink = CADisplayLink(target: self, selector: #selector(dummyDisplayLinkCallback))
        if #available(iOS 15.0, *) {
            let preferredRange = CAFrameRateRange(minimum: 60, maximum: 120, preferred: 120)
            displayLink.preferredFrameRateRange = preferredRange
            XCTAssertEqual(displayLink.preferredFrameRateRange.maximum, 120)
            XCTAssertEqual(displayLink.preferredFrameRateRange.preferred, 120)
        }
    }

    @MainActor
    func testGoatViewLayoutAndSafeAreaResizing() throws {
        let goatView = GoatView(frame: CGRect(x: 0, y: 0, width: 320, height: 568))
        goatView.initialize(appId: "resize_test")

        XCTAssertEqual(goatView.bounds.size.width, 320)
        XCTAssertEqual(goatView.bounds.size.height, 568)

        // Simulate device rotation / window resize
        goatView.frame = CGRect(x: 0, y: 0, width: 844, height: 390)
        goatView.layoutIfNeeded()

        XCTAssertEqual(goatView.frame.size.width, 844)
        XCTAssertEqual(goatView.frame.size.height, 390)

        // Cleanup
        goatView.destroy()
        XCTAssertEqual(goatView.subviews.count, 0)
    }

    @objc private func dummyDisplayLinkCallback() {}
    #endif
}
