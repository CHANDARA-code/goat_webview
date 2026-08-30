import Foundation
import WebKit

public struct GoatFindResult: Sendable, Equatable {
    public let query: String
    public let matchCount: Int
    public let activeMatchIndex: Int

    public init(query: String, matchCount: Int, activeMatchIndex: Int) {
        self.query = query
        self.matchCount = matchCount
        self.activeMatchIndex = activeMatchIndex
    }
}

/**
 * Thin seam over `WKWebView`'s find surface, abstracted so [GoatFindInPageController]'s
 * match-count/active-index state machine is unit-testable without a real WebView engine.
 *
 * `WKWebView.find(_:configuration:)` (iOS 16+) reports only whether a match was found, not a
 * total count or index — so counting is done via a read-only JS text scan (no DOM mutation),
 * while the actual highlight/scroll-into-view is always driven by WebKit's own native find,
 * never by mutating the page's DOM.
 */
public protocol GoatFindInPageWebViewAdapter: Sendable {
    func countMatches(query: String) async -> Int
    func nativeFind(query: String, backwards: Bool) async -> Bool
    func clearHighlights() async
}

@available(iOS 14.0, *)
public final class RealWKWebViewFindAdapter: GoatFindInPageWebViewAdapter, @unchecked Sendable {
    private weak var webView: WKWebView?

    public init(webView: WKWebView) {
        self.webView = webView
    }

    public func countMatches(query: String) async -> Int {
        guard let webView, !query.isEmpty else { return 0 }
        let escaped = query
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
        let script = """
        (function(q) {
          if (!q) return 0;
          var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          var node, count = 0;
          var needle = q.toLowerCase();
          while (node = walker.nextNode()) {
            var text = node.textContent.toLowerCase();
            var idx = 0;
            while ((idx = text.indexOf(needle, idx)) !== -1) { count++; idx += needle.length; }
          }
          return count;
        })("\(escaped)")
        """
        guard let result = try? await webView.evaluateJavaScript(script) else { return 0 }
        if let intValue = result as? Int { return intValue }
        if let numberValue = result as? NSNumber { return numberValue.intValue }
        return 0
    }

    public func nativeFind(query: String, backwards: Bool) async -> Bool {
        guard let webView, !query.isEmpty else { return false }
        if #available(iOS 16.0, *) {
            let config = WKFindConfiguration()
            config.backwards = backwards
            let result = try? await webView.find(query, configuration: config)
            return result?.matchFound ?? false
        }
        return false
    }

    public func clearHighlights() async {
        guard let webView else { return }
        if #available(iOS 16.0, *) {
            _ = try? await webView.find("", configuration: WKFindConfiguration())
        }
    }
}

/**
 * Native Find-in-Page interaction controller (Task 10184). Tracks match count and a 1-indexed
 * active match ordinal across `findInPage`/`findNext`/`clear` calls, resetting automatically
 * whenever `clear` is invoked (wired to SPA route-change hooks by the host).
 */
public actor GoatFindInPageController {
    private var currentQuery: String = ""
    private var matchCount: Int = 0
    private var activeMatchIndex: Int = 0

    public init() {}

    /// Handles `FIND_IN_PAGE`. An empty query is treated as `clear`.
    public func findInPage(adapter: any GoatFindInPageWebViewAdapter, query: String) async -> GoatFindResult {
        if query.isEmpty {
            return await clear(adapter: adapter)
        }
        currentQuery = query
        let count = await adapter.countMatches(query: query)
        matchCount = count
        if count > 0 {
            _ = await adapter.nativeFind(query: query, backwards: false)
            activeMatchIndex = 1
        } else {
            activeMatchIndex = 0
        }
        return GoatFindResult(query: currentQuery, matchCount: matchCount, activeMatchIndex: activeMatchIndex)
    }

    /// Handles `FIND_NEXT`, cycling forward or backward through the current match set.
    public func findNext(adapter: any GoatFindInPageWebViewAdapter, forward: Bool) async -> GoatFindResult {
        guard matchCount > 0 else {
            return GoatFindResult(query: currentQuery, matchCount: 0, activeMatchIndex: 0)
        }
        _ = await adapter.nativeFind(query: currentQuery, backwards: !forward)
        if forward {
            activeMatchIndex = (activeMatchIndex % matchCount) + 1
        } else {
            activeMatchIndex = ((activeMatchIndex - 2 + matchCount) % matchCount) + 1
        }
        return GoatFindResult(query: currentQuery, matchCount: matchCount, activeMatchIndex: activeMatchIndex)
    }

    /// Handles `FIND_CLEAR` and any SPA route-change reset — removes highlights and resets state.
    @discardableResult
    public func clear(adapter: any GoatFindInPageWebViewAdapter) async -> GoatFindResult {
        await adapter.clearHighlights()
        currentQuery = ""
        matchCount = 0
        activeMatchIndex = 0
        return GoatFindResult(query: "", matchCount: 0, activeMatchIndex: 0)
    }

    public func currentState() -> GoatFindResult {
        GoatFindResult(query: currentQuery, matchCount: matchCount, activeMatchIndex: activeMatchIndex)
    }
}
