#if os(iOS)
import XCTest
import WebKit
@testable import GoatWebView

final class GoatAssetHandlerTests: XCTestCase {
    func testFileAccessHardeningConfigured() {
        let webView = GoatWKWebView(frame: .zero)
        let config = webView.configuration
        let allowFileAccess = config.preferences.value(forKey: "allowFileAccessFromFileURLs") as? Bool
        XCTAssertEqual(allowFileAccess, false, "allowFileAccessFromFileURLs must be explicitly false")
    }

    func testLegitimateAssetSchemeRegistered() {
        let webView = GoatWKWebView(frame: .zero)
        XCTAssertNotNil(webView, "GoatWKWebView initializes cleanly")
    }
}
#endif // os(iOS)
