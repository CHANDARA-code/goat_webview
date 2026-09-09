import XCTest
@testable import GoatWebView

/// Task 10146 (iOS side). Mirrors the Android GoatNetworkPrewarmerTest so the two parsers cannot
/// drift apart silently -- the cases below are deliberately the same ones.
final class GoatNetworkPrewarmerTests: XCTestCase {

    func testHostParsingStripsSchemePathAndPort() {
        XCTAssertEqual(GoatNetworkPrewarmer.normalizeHost("https://api.example.com/path"), "api.example.com")
        XCTAssertEqual(GoatNetworkPrewarmer.normalizeHost("http://localhost:3001/api"), "localhost")
        XCTAssertEqual(GoatNetworkPrewarmer.normalizeHost("api.example.com:443"), "api.example.com")
        XCTAssertEqual(GoatNetworkPrewarmer.normalizeHost("  api.example.com  "), "api.example.com")
        XCTAssertEqual(GoatNetworkPrewarmer.normalizeHost("api.example.com"), "api.example.com")
    }

    func testHostParsingYieldsBlankForSchemeOnlyInput() {
        XCTAssertEqual(GoatNetworkPrewarmer.normalizeHost("https://"), "")
        XCTAssertEqual(GoatNetworkPrewarmer.normalizeHost("http://"), "")
        XCTAssertEqual(GoatNetworkPrewarmer.normalizeHost("   "), "")
        XCTAssertEqual(GoatNetworkPrewarmer.normalizeHost(""), "")
    }

    func testPrewarmIsANoOpForEmptyAndBlankHosts() {
        // Must not crash or block; blank entries are skipped before any connection is attempted.
        GoatNetworkPrewarmer.prewarm(hosts: [])
        GoatNetworkPrewarmer.prewarm(hosts: ["", "   ", "https://", "http://"])
    }

    func testRetryScheduleIsBoundedAndBacksOff() {
        let delays = GoatNetworkPrewarmer.retryDelays
        // Bounded by construction: the sweep's constraint is "zero periodic timers/polling/tickers",
        // so this must stay a short fixed array rather than becoming a background poller.
        XCTAssertTrue((1...5).contains(delays.count), "retry schedule must be finite and short")
        XCTAssertGreaterThanOrEqual(delays.first ?? 0, 0.5, "first backoff must be non-trivial")
        for i in 1..<delays.count {
            XCTAssertGreaterThan(delays[i], delays[i - 1], "backoff must increase: \(delays)")
        }
    }

    func testRetryScheduleMatchesAndroid() {
        // The two platforms are meant to behave the same here; drift would be silent otherwise.
        XCTAssertEqual(GoatNetworkPrewarmer.retryDelays, [1.0, 2.0, 4.0])
    }

    func testConfiguredHostWarmRunsOncePerProcess() {
        GoatNetworkPrewarmer.resetOnceGuardForTesting()
        XCTAssertFalse(GoatNetworkPrewarmer.didWarmConfiguredHosts)

        GoatNetworkPrewarmer.prewarmConfiguredHostsOnce()
        XCTAssertTrue(GoatNetworkPrewarmer.didWarmConfiguredHosts)

        // A second call must be inert -- every mini-app mount reaches this, and re-dialling the
        // same hosts on each one is exactly what the guard exists to prevent.
        GoatNetworkPrewarmer.prewarmConfiguredHostsOnce()
        XCTAssertTrue(GoatNetworkPrewarmer.didWarmConfiguredHosts)

        GoatNetworkPrewarmer.resetOnceGuardForTesting()
    }

    func testPreconnectHostsConfigRoundTripsAndResets() {
        let config = GoatConfig()
        XCTAssertEqual(config.preconnectHosts, [])
        config.preconnectHosts = ["https://api.example.com", "cdn.example.com"]
        XCTAssertEqual(config.preconnectHosts, ["https://api.example.com", "cdn.example.com"])
        config.reset()
        XCTAssertEqual(config.preconnectHosts, [])
    }
}
