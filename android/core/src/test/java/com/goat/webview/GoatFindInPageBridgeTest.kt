package com.goat.webview

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Bridge wiring tests for Task 10184 (findInPageInteractionController): FIND_IN_PAGE, FIND_NEXT,
 * FIND_CLEAR, and the automatic find-state reset on SPA route navigation.
 */
class GoatFindInPageBridgeTest {

    private val context = FakeTestContext()

    @Test
    fun `FIND_IN_PAGE with no host callback wired returns zero matches instead of throwing`() = runTest {
        val handler = GoatBridgeActionHandler(context = context, appId = "test_find")
        val result = handler.executeAction("FIND_IN_PAGE", buildJsonObject { put("query", "invoice") })
        assertTrue(result.isSuccess)
        assertEquals(0, result.getOrNull()?.get("matchCount")?.jsonPrimitive?.intOrNull)
        assertEquals(0, result.getOrNull()?.get("activeMatchIndex")?.jsonPrimitive?.intOrNull)
    }

    @Test
    fun `FIND_IN_PAGE delegates to the host callback with the query and returns its result`() = runTest {
        var receivedQuery: String? = null
        val handler = GoatBridgeActionHandler(
            context = context,
            appId = "test_find",
            onFindInPage = { query ->
                receivedQuery = query
                buildJsonObject { put("matchCount", 7); put("activeMatchIndex", 1) }
            }
        )

        val result = handler.executeAction("FIND_IN_PAGE", buildJsonObject { put("query", "invoice") })

        assertTrue(result.isSuccess)
        assertEquals("invoice", receivedQuery)
        assertEquals(7, result.getOrNull()?.get("matchCount")?.jsonPrimitive?.intOrNull)
        assertEquals(1, result.getOrNull()?.get("activeMatchIndex")?.jsonPrimitive?.intOrNull)
    }

    @Test
    fun `FIND_IN_PAGE without a query throws IllegalArgumentException`() = runTest {
        val handler = GoatBridgeActionHandler(context = context, appId = "test_find")
        val result = handler.executeAction("FIND_IN_PAGE", buildJsonObject {})
        assertTrue(result.isFailure)
    }

    @Test
    fun `FIND_NEXT forwards the forward flag to the host callback`() = runTest {
        var receivedForward: Boolean? = null
        val handler = GoatBridgeActionHandler(
            context = context,
            appId = "test_find",
            onFindNext = { forward ->
                receivedForward = forward
                buildJsonObject { put("matchCount", 3); put("activeMatchIndex", 2) }
            }
        )

        handler.executeAction("FIND_NEXT", buildJsonObject { put("forward", false) })

        assertEquals(false, receivedForward)
    }

    @Test
    fun `FIND_NEXT defaults forward to true when omitted`() = runTest {
        var receivedForward: Boolean? = null
        val handler = GoatBridgeActionHandler(
            context = context,
            appId = "test_find",
            onFindNext = { forward ->
                receivedForward = forward
                buildJsonObject { put("matchCount", 3); put("activeMatchIndex", 2) }
            }
        )

        handler.executeAction("FIND_NEXT", buildJsonObject {})

        assertEquals(true, receivedForward)
    }

    @Test
    fun `FIND_CLEAR invokes the host callback and confirms cleared`() = runTest {
        var cleared = false
        val handler = GoatBridgeActionHandler(
            context = context,
            appId = "test_find",
            onFindClear = { cleared = true }
        )

        val result = handler.executeAction("FIND_CLEAR", buildJsonObject {})

        assertTrue(result.isSuccess)
        assertTrue(cleared)
        assertEquals(true, result.getOrNull()?.get("cleared")?.jsonPrimitive?.booleanOrNull)
    }

    @Test
    fun `NAV_PUSH automatically resets find state via onFindClear`() = runTest {
        var clearedCount = 0
        val handler = GoatBridgeActionHandler(
            context = context,
            appId = "test_find",
            onFindClear = { clearedCount++ }
        )

        handler.executeAction("NAV_PUSH", buildJsonObject { put("route", "/next-page") })

        assertEquals(1, clearedCount)
    }

    @Test
    fun `NAV_POP, NAV_POP_TO_ROOT, NAV_REPLACE, and PUSH_HISTORY_STATE all reset find state`() = runTest {
        var clearedCount = 0
        val handler = GoatBridgeActionHandler(
            context = context,
            appId = "test_find",
            onFindClear = { clearedCount++ }
        )

        handler.executeAction("NAV_PUSH", buildJsonObject { put("route", "/a") })
        handler.executeAction("NAV_POP", buildJsonObject {})
        handler.executeAction("NAV_POP_TO_ROOT", buildJsonObject {})
        handler.executeAction("NAV_REPLACE", buildJsonObject { put("route", "/b") })
        handler.executeAction("PUSH_HISTORY_STATE", buildJsonObject { put("route", "/c") })

        assertEquals(5, clearedCount)
    }
}
