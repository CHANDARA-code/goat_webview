import XCTest
import Foundation
@testable import GoatWebView

final class GoatConfigTests: XCTestCase {

    override func setUp() {
        super.setUp()
        GoatConfig.shared.reset()
    }

    override func tearDown() {
        GoatConfig.shared.reset()
        super.tearDown()
    }

    // MARK: - 1. Default State

    func testGoatConfigDefaultState() {
        XCTAssertNil(GoatConfig.shared.accountProvider)
        XCTAssertNil(GoatConfig.shared.debugUrl)
        XCTAssertNil(GoatConfig.shared.currentAccountId())
        XCTAssertNil(GoatAccountScopedSandbox.shared.getCurrentAccountId())
    }

    // MARK: - 2. Account Provider Configuration & Sync

    func testGoatConfigAccountProvider() {
        var activeId: String? = "user_alpha_99"
        GoatConfig.shared.accountProvider = { activeId }

        XCTAssertNotNil(GoatConfig.shared.accountProvider)
        XCTAssertEqual(GoatConfig.shared.currentAccountId(), "user_alpha_99")
        XCTAssertEqual(GoatAccountScopedSandbox.shared.getCurrentAccountId(), "user_alpha_99")

        // Switch account dynamically
        activeId = "user_beta_88"
        XCTAssertEqual(GoatConfig.shared.currentAccountId(), "user_beta_88")
        XCTAssertEqual(GoatAccountScopedSandbox.shared.getCurrentAccountId(), "user_beta_88")

        // Set to nil dynamically
        activeId = nil
        XCTAssertNil(GoatConfig.shared.currentAccountId())
        XCTAssertNil(GoatAccountScopedSandbox.shared.getCurrentAccountId())
    }

    // MARK: - 3. Debug URL Configuration

    func testGoatConfigDebugUrl() {
        GoatConfig.shared.debugUrl = "http://127.0.0.1:8080/inspector"
        XCTAssertEqual(GoatConfig.shared.debugUrl, "http://127.0.0.1:8080/inspector")

        GoatConfig.shared.debugUrl = nil
        XCTAssertNil(GoatConfig.shared.debugUrl)
    }

    // MARK: - 4. Reset Method

    func testGoatConfigReset() {
        GoatConfig.shared.accountProvider = { "temp_user" }
        GoatConfig.shared.debugUrl = "https://debug.goat.dev"

        XCTAssertEqual(GoatConfig.shared.currentAccountId(), "temp_user")
        XCTAssertEqual(GoatConfig.shared.debugUrl, "https://debug.goat.dev")

        GoatConfig.shared.reset()

        XCTAssertNil(GoatConfig.shared.accountProvider)
        XCTAssertNil(GoatConfig.shared.debugUrl)
        XCTAssertNil(GoatConfig.shared.currentAccountId())
        XCTAssertNil(GoatAccountScopedSandbox.shared.accountProvider)
        XCTAssertNil(GoatAccountScopedSandbox.shared.getCurrentAccountId())
    }

    // MARK: - 5. Whitespace and Blank String Trimming

    func testGoatConfigWhitespaceAndEmptyTrimming() {
        GoatConfig.shared.accountProvider = { "" }
        XCTAssertNil(GoatConfig.shared.currentAccountId())

        GoatConfig.shared.accountProvider = { "    " }
        XCTAssertNil(GoatConfig.shared.currentAccountId())

        GoatConfig.shared.accountProvider = { "\n\t  " }
        XCTAssertNil(GoatConfig.shared.currentAccountId())

        GoatConfig.shared.accountProvider = { "  user_trimmed_id \t\n" }
        XCTAssertEqual(GoatConfig.shared.currentAccountId(), "user_trimmed_id")
    }

    // MARK: - 6. Concurrent Thread Safety

    func testGoatConfigConcurrentAccess() {
        let iterations = 500
        let group = DispatchGroup()

        for i in 0..<iterations {
            group.enter()
            DispatchQueue.global(qos: .userInitiated).async {
                if i % 2 == 0 {
                    GoatConfig.shared.accountProvider = { "user_\(i)" }
                    GoatConfig.shared.debugUrl = "http://dev.goat/\(i)"
                } else {
                    _ = GoatConfig.shared.currentAccountId()
                    _ = GoatConfig.shared.debugUrl
                }
                group.leave()
            }
        }

        let waitResult = group.wait(timeout: .now() + 5.0)
        XCTAssertEqual(waitResult, .success, "Concurrent access completed without deadlock or crash")
    }
}
