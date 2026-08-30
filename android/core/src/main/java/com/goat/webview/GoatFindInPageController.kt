package com.goat.webview

import android.webkit.WebView
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Thin seam over the real `android.webkit.WebView` find-in-page surface (`findAllAsync`,
 * `findNext`, `clearMatches`, `setFindListener`), abstracted so [GoatFindInPageController]'s
 * match-count/active-index state machine is unit-testable without a real WebView engine.
 */
interface GoatFindInPageWebViewAdapter {
    fun findAllAsync(query: String)
    fun findNext(forward: Boolean)
    fun clearMatches()
    fun setFindListener(listener: (activeMatchOrdinal: Int, numberOfMatches: Int, isDoneCounting: Boolean) -> Unit)
}

/** Production adapter wrapping a real [WebView]. */
class RealWebViewFindAdapter(private val webView: WebView) : GoatFindInPageWebViewAdapter {
    override fun findAllAsync(query: String) {
        webView.findAllAsync(query)
    }

    override fun findNext(forward: Boolean) {
        webView.findNext(forward)
    }

    override fun clearMatches() {
        webView.clearMatches()
    }

    override fun setFindListener(listener: (activeMatchOrdinal: Int, numberOfMatches: Int, isDoneCounting: Boolean) -> Unit) {
        webView.setFindListener(WebView.FindListener { activeMatchOrdinal, numberOfMatches, isDoneCounting ->
            listener(activeMatchOrdinal, numberOfMatches, isDoneCounting)
        })
    }
}

/**
 * Native Find-in-Page interaction controller (Task 10184). Wraps `WebView.findAllAsync`/
 * `findNext`/`clearMatches`, tracking match count and 1-indexed active match ordinal, and resets
 * automatically whenever [clear] is invoked (wired to SPA route-change hooks by the host).
 *
 * Highlighting is done entirely by Chromium's native find implementation — this controller never
 * touches the page's DOM structure.
 */
class GoatFindInPageController(private val resultTimeoutMs: Long = 2_000L) {
    data class FindResult(val query: String, val matchCount: Int, val activeMatchIndex: Int)

    private var adapter: GoatFindInPageWebViewAdapter? = null
    private var currentQuery: String = ""
    private var matchCount: Int = 0
    private var activeMatchIndex: Int = 0
    private var pendingResult: CompletableDeferred<FindResult>? = null

    private fun ensureListener(adapter: GoatFindInPageWebViewAdapter) {
        if (this.adapter === adapter) return
        this.adapter = adapter
        adapter.setFindListener { activeMatchOrdinal, numberOfMatches, isDoneCounting ->
            matchCount = numberOfMatches
            activeMatchIndex = if (numberOfMatches > 0) activeMatchOrdinal + 1 else 0
            if (isDoneCounting) {
                pendingResult?.complete(FindResult(currentQuery, matchCount, activeMatchIndex))
                pendingResult = null
            }
        }
    }

    /** Handles `FIND_IN_PAGE`. An empty query is treated as [clear]. */
    suspend fun findInPage(adapter: GoatFindInPageWebViewAdapter, query: String): FindResult {
        ensureListener(adapter)
        currentQuery = query
        if (query.isEmpty()) {
            return clear(adapter)
        }
        val deferred = CompletableDeferred<FindResult>()
        pendingResult = deferred
        adapter.findAllAsync(query)
        return withTimeoutOrNull(resultTimeoutMs) { deferred.await() }
            ?: FindResult(currentQuery, matchCount, activeMatchIndex)
    }

    /** Handles `FIND_NEXT`, cycling forward or backward through the current match set. */
    suspend fun findNext(adapter: GoatFindInPageWebViewAdapter, forward: Boolean): FindResult {
        ensureListener(adapter)
        if (matchCount == 0) {
            return FindResult(currentQuery, 0, 0)
        }
        val deferred = CompletableDeferred<FindResult>()
        pendingResult = deferred
        adapter.findNext(forward)
        return withTimeoutOrNull(resultTimeoutMs) { deferred.await() }
            ?: FindResult(currentQuery, matchCount, activeMatchIndex)
    }

    /** Handles `FIND_CLEAR` and any SPA route-change reset — removes highlights and resets state. */
    fun clear(adapter: GoatFindInPageWebViewAdapter): FindResult {
        adapter.clearMatches()
        currentQuery = ""
        matchCount = 0
        activeMatchIndex = 0
        pendingResult = null
        return FindResult("", 0, 0)
    }

    fun currentState(): FindResult = FindResult(currentQuery, matchCount, activeMatchIndex)
}
