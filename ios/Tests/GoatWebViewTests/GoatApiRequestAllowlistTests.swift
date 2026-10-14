#if os(iOS)
import XCTest
@testable import GoatWebView

final class GoatApiRequestAllowlistTests: XCTestCase {

    private let allowlist: Set<String> = ["api.example.com", "*.cdn.example.com"]

    func testExactHostMatches() {
        XCTAssertTrue(GoatScriptMessageHandler.isHostAllowed("api.example.com", allowlist: allowlist))
    }

    func testUnlistedHostIsRejected() {
        XCTAssertFalse(GoatScriptMessageHandler.isHostAllowed("evil.example.com", allowlist: allowlist))
        XCTAssertFalse(GoatScriptMessageHandler.isHostAllowed("attacker.com", allowlist: allowlist))
    }

    func testWildcardMatchesBaseAndSubdomains() {
        XCTAssertTrue(GoatScriptMessageHandler.isHostAllowed("cdn.example.com", allowlist: allowlist))
        XCTAssertTrue(GoatScriptMessageHandler.isHostAllowed("images.cdn.example.com", allowlist: allowlist))
        XCTAssertTrue(GoatScriptMessageHandler.isHostAllowed("a.b.cdn.example.com", allowlist: allowlist))
    }

    func testWildcardDoesNotMatchASuffixImpostor() {
        XCTAssertFalse(GoatScriptMessageHandler.isHostAllowed("evilcdn.example.com", allowlist: allowlist))
        XCTAssertFalse(GoatScriptMessageHandler.isHostAllowed("cdn.example.com.evil.com", allowlist: allowlist))
    }

    func testExactPatternDoesNotMatchSubdomains() {
        XCTAssertFalse(GoatScriptMessageHandler.isHostAllowed("sub.api.example.com", allowlist: allowlist))
    }

    func testMatchingIsCaseInsensitive() {
        XCTAssertTrue(GoatScriptMessageHandler.isHostAllowed("api.example.com", allowlist: ["API.Example.COM"]))
    }

    func testAnEmptyAllowlistIsHandledByTheCallerNotHere() {
        // isHostAllowed on an empty set matches nothing; validateApiRequestUrl skips the check
        // entirely when the allowlist is empty, which is what keeps undeclared mini-apps working.
        XCTAssertFalse(GoatScriptMessageHandler.isHostAllowed("api.example.com", allowlist: []))
    }
}
#endif // os(iOS)
