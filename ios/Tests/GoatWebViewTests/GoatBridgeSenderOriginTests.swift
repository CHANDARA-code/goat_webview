import XCTest
@testable import GoatWebView

final class GoatBridgeSenderOriginTests: XCTestCase {

    private let packaged: Set<String> = [
        "goat://tenant1",
        "https://appassets.androidplatform.net"
    ]

    private func permitted(_ origin: String?, mainFrame: Bool, allowed: Set<String>? = nil, subframes: Bool = false) -> Bool {
        GoatScriptMessageHandler.isSenderPermitted(
            origin: origin.flatMap { GoatScriptMessageHandler.normalizeOrigin($0) },
            isMainFrame: mainFrame,
            allowedOrigins: allowed ?? packaged,
            allowSubframes: subframes
        )
    }

    func testAllowedOriginInMainFrameIsPermitted() {
        XCTAssertTrue(permitted("goat://tenant1", mainFrame: true))
    }

    func testForeignOriginIsRejectedEvenInMainFrame() {
        XCTAssertFalse(permitted("https://evil.example.com", mainFrame: true))
    }

    func testCrossOriginSubframeIsRejected() {
        XCTAssertFalse(permitted("https://evil.example.com", mainFrame: false))
    }

    func testAllowedOriginIsStillRejectedFromASubframeByDefault() {
        XCTAssertFalse(permitted("goat://tenant1", mainFrame: false))
    }

    func testSubframesPassOnlyWhenExplicitlyOptedIn() {
        XCTAssertTrue(permitted("goat://tenant1", mainFrame: false, subframes: true))
        XCTAssertFalse(permitted("https://evil.example.com", mainFrame: false, subframes: true))
    }

    func testEmptyPolicyIsMainFrameOnlyNotAllowAll() {
        XCTAssertTrue(permitted("https://anything.example.com", mainFrame: true, allowed: []))
        XCTAssertFalse(permitted("https://anything.example.com", mainFrame: false, allowed: []))
    }

    func testOriginComparisonIsCaseInsensitiveAndPortSensitive() {
        let allowed: Set<String> = ["HTTPS://Tenant1.Example.COM"]
        XCTAssertTrue(permitted("https://tenant1.example.com", mainFrame: true, allowed: allowed))
        XCTAssertFalse(permitted("https://tenant1.example.com:8443", mainFrame: true, allowed: allowed))
    }

    func testPathAndQueryDoNotWidenTheMatch() {
        XCTAssertTrue(permitted("goat://tenant1/page?x=1", mainFrame: true))
        XCTAssertFalse(permitted("https://evil.com/goat://tenant1", mainFrame: true))
    }

    func testMalformedOriginsAreRejected() {
        for bad in ["", "   ", "notaurl", "://nohost", "https://", "https://user@host.com"] {
            XCTAssertFalse(permitted(bad, mainFrame: true), "expected \(bad) to be rejected")
        }
    }

    func testNilOriginIsRejectedWhenAPolicyIsSet() {
        XCTAssertFalse(permitted(nil, mainFrame: true))
    }
}
