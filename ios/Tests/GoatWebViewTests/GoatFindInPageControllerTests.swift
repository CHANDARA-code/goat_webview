#if os(iOS)
import XCTest
@testable import GoatWebView

final class GoatFindInPageControllerTests: XCTestCase {

    /// Simulates WKWebView's find surface without needing a real WebKit engine.
    private actor FakeFindAdapter: GoatFindInPageWebViewAdapter {
        var countMatchesCalls = 0
        var nativeFindCalls = 0
        var clearHighlightsCalls = 0
        var lastQuery: String?
        var lastBackwards: Bool?
        var scriptedMatchCount = 0

        func setScriptedMatchCount(_ count: Int) { scriptedMatchCount = count }

        func countMatches(query: String) async -> Int {
            countMatchesCalls += 1
            lastQuery = query
            return scriptedMatchCount
        }

        func nativeFind(query: String, backwards: Bool) async -> Bool {
            nativeFindCalls += 1
            lastBackwards = backwards
            return scriptedMatchCount > 0
        }

        func clearHighlights() async {
            clearHighlightsCalls += 1
        }
    }

    func testFindInPageReportsAccurateMatchCountAndFirstActiveIndex() async {
        let adapter = FakeFindAdapter()
        await adapter.setScriptedMatchCount(7)
        let controller = GoatFindInPageController()

        let result = await controller.findInPage(adapter: adapter, query: "invoice")

        let calls = await adapter.countMatchesCalls
        XCTAssertEqual(calls, 1)
        XCTAssertEqual(result.matchCount, 7)
        XCTAssertEqual(result.activeMatchIndex, 1)
    }

    func testFindNextCyclesForwardThroughMatches() async {
        let adapter = FakeFindAdapter()
        await adapter.setScriptedMatchCount(3)
        let controller = GoatFindInPageController()
        _ = await controller.findInPage(adapter: adapter, query: "test")

        let second = await controller.findNext(adapter: adapter, forward: true)
        let third = await controller.findNext(adapter: adapter, forward: true)
        let wraps = await controller.findNext(adapter: adapter, forward: true)

        XCTAssertEqual(second.activeMatchIndex, 2)
        XCTAssertEqual(third.activeMatchIndex, 3)
        XCTAssertEqual(wraps.activeMatchIndex, 1) // wraps back to the first match
    }

    func testFindNextBackwardWrapsToTheLastMatch() async {
        let adapter = FakeFindAdapter()
        await adapter.setScriptedMatchCount(3)
        let controller = GoatFindInPageController()
        _ = await controller.findInPage(adapter: adapter, query: "test")

        let result = await controller.findNext(adapter: adapter, forward: false)

        XCTAssertEqual(result.activeMatchIndex, 3)
        let backwardsFlag = await adapter.lastBackwards
        XCTAssertEqual(backwardsFlag, true)
    }

    func testFindNextIsANoOpWithZeroMatches() async {
        let adapter = FakeFindAdapter()
        await adapter.setScriptedMatchCount(0)
        let controller = GoatFindInPageController()
        _ = await controller.findInPage(adapter: adapter, query: "nonexistent")

        let result = await controller.findNext(adapter: adapter, forward: true)

        let calls = await adapter.nativeFindCalls
        XCTAssertEqual(calls, 0)
        XCTAssertEqual(result.matchCount, 0)
    }

    func testEmptyQueryClearsInsteadOfSearching() async {
        let adapter = FakeFindAdapter()
        await adapter.setScriptedMatchCount(5)
        let controller = GoatFindInPageController()
        _ = await controller.findInPage(adapter: adapter, query: "something")

        let result = await controller.findInPage(adapter: adapter, query: "")

        let clearCalls = await adapter.clearHighlightsCalls
        let countCalls = await adapter.countMatchesCalls
        XCTAssertEqual(clearCalls, 1)
        XCTAssertEqual(countCalls, 1, "countMatches must only have fired for the prior non-empty query")
        XCTAssertEqual(result.matchCount, 0)
        XCTAssertEqual(result.query, "")
    }

    func testClearRemovesHighlightsAndResetsState() async {
        let adapter = FakeFindAdapter()
        let controller = GoatFindInPageController()

        let result = await controller.clear(adapter: adapter)

        let clearCalls = await adapter.clearHighlightsCalls
        XCTAssertEqual(clearCalls, 1)
        XCTAssertEqual(result.matchCount, 0)
        XCTAssertEqual(result.activeMatchIndex, 0)
    }

    func testZeroMatchesReportsActiveIndexZero() async {
        let adapter = FakeFindAdapter()
        await adapter.setScriptedMatchCount(0)
        let controller = GoatFindInPageController()

        let result = await controller.findInPage(adapter: adapter, query: "nomatch")

        XCTAssertEqual(result.matchCount, 0)
        XCTAssertEqual(result.activeMatchIndex, 0)
    }
}
#endif // os(iOS)
