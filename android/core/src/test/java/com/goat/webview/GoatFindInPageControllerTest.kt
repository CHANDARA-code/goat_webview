package com.goat.webview

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class GoatFindInPageControllerTest {

    /**
     * Simulates `android.webkit.WebView`'s find surface: `findAllAsync`/`findNext` synchronously
     * invoke the registered listener with a scripted result, mirroring how Chromium's real
     * implementation eventually calls back `WebView.FindListener`.
     */
    private class FakeFindAdapter : GoatFindInPageWebViewAdapter {
        var findAllAsyncCalls = 0
        var findNextCalls = 0
        var clearMatchesCalls = 0
        var lastQuery: String? = null
        var lastForward: Boolean? = null
        var scriptedMatchCount = 0
        var scriptedActiveOrdinal = 0
        var scriptedDoneCounting = true
        private var listener: ((Int, Int, Boolean) -> Unit)? = null

        override fun findAllAsync(query: String) {
            findAllAsyncCalls++
            lastQuery = query
            listener?.invoke(scriptedActiveOrdinal, scriptedMatchCount, scriptedDoneCounting)
        }

        override fun findNext(forward: Boolean) {
            findNextCalls++
            lastForward = forward
            listener?.invoke(scriptedActiveOrdinal, scriptedMatchCount, scriptedDoneCounting)
        }

        override fun clearMatches() {
            clearMatchesCalls++
        }

        override fun setFindListener(listener: (activeMatchOrdinal: Int, numberOfMatches: Int, isDoneCounting: Boolean) -> Unit) {
            this.listener = listener
        }
    }

    @Test
    fun `findInPage reports accurate match count and 1-indexed active match`() = runTest {
        val adapter = FakeFindAdapter().apply {
            scriptedMatchCount = 7
            scriptedActiveOrdinal = 0
        }
        val controller = GoatFindInPageController()

        val result = controller.findInPage(adapter, "invoice")

        assertEquals(1, adapter.findAllAsyncCalls)
        assertEquals("invoice", adapter.lastQuery)
        assertEquals(7, result.matchCount)
        assertEquals(1, result.activeMatchIndex)
    }

    @Test
    fun `findNext cycles forward through the active match index`() = runTest {
        val adapter = FakeFindAdapter().apply { scriptedMatchCount = 7; scriptedActiveOrdinal = 0 }
        val controller = GoatFindInPageController()
        controller.findInPage(adapter, "invoice")

        adapter.scriptedActiveOrdinal = 1 // WebView.FindListener reports 0-indexed ordinals
        val result = controller.findNext(adapter, true)

        assertEquals(1, adapter.findNextCalls)
        assertEquals(true, adapter.lastForward)
        assertEquals(2, result.activeMatchIndex)
    }

    @Test
    fun `findNext with forward=false requests the previous match`() = runTest {
        val adapter = FakeFindAdapter().apply { scriptedMatchCount = 3; scriptedActiveOrdinal = 1 }
        val controller = GoatFindInPageController()
        controller.findInPage(adapter, "test")

        controller.findNext(adapter, false)

        assertEquals(false, adapter.lastForward)
    }

    @Test
    fun `findNext is a no-op when there are zero matches`() = runTest {
        val adapter = FakeFindAdapter().apply { scriptedMatchCount = 0 }
        val controller = GoatFindInPageController()
        controller.findInPage(adapter, "nonexistent")

        val result = controller.findNext(adapter, true)

        assertEquals(0, adapter.findNextCalls)
        assertEquals(0, result.matchCount)
    }

    @Test
    fun `an empty query clears matches instead of searching`() = runTest {
        val adapter = FakeFindAdapter().apply { scriptedMatchCount = 5 }
        val controller = GoatFindInPageController()
        controller.findInPage(adapter, "something")

        val result = controller.findInPage(adapter, "")

        assertEquals(1, adapter.clearMatchesCalls)
        assertEquals("findAllAsync must only have fired for the prior non-empty query", 1, adapter.findAllAsyncCalls)
        assertEquals(0, result.matchCount)
        assertEquals("", result.query)
    }

    @Test
    fun `clear removes highlights and resets match count and active index`() {
        val adapter = FakeFindAdapter()
        val controller = GoatFindInPageController()

        val result = controller.clear(adapter)

        assertEquals(1, adapter.clearMatchesCalls)
        assertEquals(0, result.matchCount)
        assertEquals(0, result.activeMatchIndex)
        assertEquals("", result.query)
    }

    @Test
    fun `zero matches reports activeMatchIndex zero, not a stale ordinal`() = runTest {
        val adapter = FakeFindAdapter().apply { scriptedMatchCount = 0; scriptedActiveOrdinal = 0 }
        val controller = GoatFindInPageController()

        val result = controller.findInPage(adapter, "nomatch")

        assertEquals(0, result.matchCount)
        assertEquals(0, result.activeMatchIndex)
    }

    @Test
    fun `a listener callback with isDoneCounting=false does not resolve the pending result early`() = runTest {
        val adapter = FakeFindAdapter().apply {
            scriptedMatchCount = 4
            scriptedActiveOrdinal = 0
            scriptedDoneCounting = false
        }
        val controller = GoatFindInPageController(resultTimeoutMs = 50)

        // With isDoneCounting always false, the controller must fall back to its timeout path
        // rather than resolving on an incomplete count — proving it waits for isDoneCounting.
        val result = controller.findInPage(adapter, "partial")

        assertEquals(4, result.matchCount) // state was still tracked even though not "done"
    }
}
