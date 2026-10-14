#if os(iOS)
import XCTest
@testable import GoatWebView

/**
 * Bridge wiring tests for Task 10184 (findInPageInteractionController): FIND_IN_PAGE, FIND_NEXT,
 * FIND_CLEAR, and the automatic find-state reset on SPA route navigation.
 */
final class GoatFindInPageBridgeTests: XCTestCase {

    func testFindInPageWithNoHostCallbackReturnsZeroMatchesInsteadOfThrowing() async throws {
        let handler = GoatScriptMessageHandler(appId: "test_find")
        let result = try await handler.dispatchDirect(action: "FIND_IN_PAGE", payload: ["query": "invoice"])
        XCTAssertEqual(result["matchCount"] as? Int, 0)
        XCTAssertEqual(result["activeMatchIndex"] as? Int, 0)
    }

    func testFindInPageDelegatesToHostCallbackWithQueryAndReturnsItsResult() async throws {
        let handler = GoatScriptMessageHandler(appId: "test_find")
        var receivedQuery: String?
        handler.onFindInPage = { query in
            receivedQuery = query
            return ["matchCount": 7, "activeMatchIndex": 1]
        }

        let result = try await handler.dispatchDirect(action: "FIND_IN_PAGE", payload: ["query": "invoice"])

        XCTAssertEqual(receivedQuery, "invoice")
        XCTAssertEqual(result["matchCount"] as? Int, 7)
        XCTAssertEqual(result["activeMatchIndex"] as? Int, 1)
    }

    func testFindInPageWithoutQueryThrowsInvalidPayload() async throws {
        let handler = GoatScriptMessageHandler(appId: "test_find")
        do {
            _ = try await handler.dispatchDirect(action: "FIND_IN_PAGE", payload: [:])
            XCTFail("Expected an error")
        } catch {
            // expected
        }
    }

    func testFindNextForwardsForwardFlagToHostCallback() async throws {
        let handler = GoatScriptMessageHandler(appId: "test_find")
        var receivedForward: Bool?
        handler.onFindNext = { forward in
            receivedForward = forward
            return ["matchCount": 3, "activeMatchIndex": 2]
        }

        _ = try await handler.dispatchDirect(action: "FIND_NEXT", payload: ["forward": false])

        XCTAssertEqual(receivedForward, false)
    }

    func testFindNextDefaultsForwardToTrueWhenOmitted() async throws {
        let handler = GoatScriptMessageHandler(appId: "test_find")
        var receivedForward: Bool?
        handler.onFindNext = { forward in
            receivedForward = forward
            return ["matchCount": 3, "activeMatchIndex": 2]
        }

        _ = try await handler.dispatchDirect(action: "FIND_NEXT", payload: [:])

        XCTAssertEqual(receivedForward, true)
    }

    func testFindClearInvokesHostCallbackAndConfirmsCleared() async throws {
        let handler = GoatScriptMessageHandler(appId: "test_find")
        var cleared = false
        handler.onFindClear = { cleared = true }

        let result = try await handler.dispatchDirect(action: "FIND_CLEAR", payload: [:])

        XCTAssertTrue(cleared)
        XCTAssertEqual(result["cleared"] as? Bool, true)
    }

    func testNavPushAutomaticallyResetsFindStateViaOnFindClear() async throws {
        let handler = GoatScriptMessageHandler(appId: "test_find")
        var clearedCount = 0
        handler.onFindClear = { clearedCount += 1 }

        _ = try await handler.dispatchDirect(action: "NAV_PUSH", payload: ["url": "/next-page"])

        XCTAssertEqual(clearedCount, 1)
    }

    func testAllSpaRouteActionsResetFindState() async throws {
        let handler = GoatScriptMessageHandler(appId: "test_find")
        var clearedCount = 0
        handler.onFindClear = { clearedCount += 1 }

        _ = try await handler.dispatchDirect(action: "NAV_PUSH", payload: ["url": "/a"])
        _ = try await handler.dispatchDirect(action: "NAV_POP", payload: [:])
        _ = try await handler.dispatchDirect(action: "NAV_POP_TO_ROOT", payload: [:])
        _ = try await handler.dispatchDirect(action: "NAV_REPLACE", payload: ["url": "/b"])
        _ = try await handler.dispatchDirect(action: "PUSH_HISTORY_STATE", payload: ["url": "/c"])

        XCTAssertEqual(clearedCount, 5)
    }
}
#endif // os(iOS)
