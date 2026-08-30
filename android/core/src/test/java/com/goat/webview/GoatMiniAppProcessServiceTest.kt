package com.goat.webview

import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Unit test suite for GoatMiniAppProcessService (Task 10090).
 */
class GoatMiniAppProcessServiceTest {

    private lateinit var service: GoatMiniAppProcessService

    @Before
    fun setUp() {
        service = GoatMiniAppProcessService()
    }

    @Test
    fun `test initial state is uninitialized`() {
        val status = service.getSandboxStatus()
        assertTrue(status.pid > 0)
        assertTrue(status.isAlive)
        assertFalse(status.isInitialized)
        assertEquals("", status.activeAppId)
        assertEquals(":goat_miniapp_process", status.isolatedProcessName)
        assertEquals(0, status.activeSessionsCount)
        assertEquals(0L, status.totalMessagesProcessed)
        assertTrue(status.uptimeMillis >= 0L)
    }

    @Test
    fun `test initializeEngine activates sandboxed process and session`() = runTest {
        val status = service.initializeEngine("app_crypto", "/data/miniapps/app_crypto")
        assertTrue(status.isInitialized)
        assertEquals("app_crypto", status.activeAppId)
        assertEquals(1, status.activeSessionsCount)

        val session = service.getSession("app_crypto")
        assertNotNull(session)
        assertEquals("app_crypto", session!!.appId)
        assertEquals("/data/miniapps/app_crypto", session.assetPath)
        assertEquals(MiniAppSessionState.INITIALIZED, session.state)
        assertEquals(0L, session.messageCount)
        assertTrue(session.initializedAt > 0)
    }

    @Test
    fun `test dispatchIsolatedMessage without initialization fails safely`() = runTest {
        val dispatchFail = service.dispatchIsolatedMessage("""{"action":"PING"}""")
        assertEquals(false, dispatchFail["success"]?.jsonPrimitive?.booleanOrNull)
        assertEquals("Sandbox process not initialized", dispatchFail["error"]?.jsonPrimitive?.content)
    }

    @Test
    fun `test dispatchIsolatedMessage routes to active session and updates counters`() = runTest {
        service.initializeEngine("app_crypto", "/data/miniapps/app_crypto")

        val dispatchRes1 = service.dispatchIsolatedMessage("""{"action":"PING"}""")
        assertTrue(dispatchRes1["success"]?.jsonPrimitive?.booleanOrNull == true)
        assertEquals("ISOLATED_EXECUTED", dispatchRes1["status"]?.jsonPrimitive?.content)
        assertEquals("PING", dispatchRes1["action"]?.jsonPrimitive?.content)
        assertEquals("app_crypto", dispatchRes1["appId"]?.jsonPrimitive?.content)
        assertEquals(1L, dispatchRes1["messageSequence"]?.jsonPrimitive?.longOrNull)

        val dispatchRes2 = service.dispatchIsolatedMessage("""{"action":"EVAL_SCRIPT","code":"console.log(1)"}""")
        assertEquals(2L, dispatchRes2["messageSequence"]?.jsonPrimitive?.longOrNull)
        assertEquals("EVAL_SCRIPT", dispatchRes2["action"]?.jsonPrimitive?.content)

        val session = service.getSession("app_crypto")
        assertNotNull(session)
        assertEquals(2L, session!!.messageCount)
        assertEquals(MiniAppSessionState.ACTIVE, session.state)

        val status = service.getSandboxStatus()
        assertEquals(2L, status.totalMessagesProcessed)
    }

    @Test
    fun `test multi-tenant session isolation and targeted routing`() = runTest {
        service.initializeEngine("app_alpha", "/data/miniapps/app_alpha")
        service.initializeEngine("app_beta", "/data/miniapps/app_beta")

        val sessions = service.getActiveSessions()
        assertEquals(2, sessions.size)
        assertEquals("app_beta", service.getSandboxStatus().activeAppId)

        // Dispatch targeted message explicitly to app_alpha
        val resAlpha = service.dispatchIsolatedMessage("""{"appId":"app_alpha","action":"ALPHA_ACTION"}""")
        assertEquals("app_alpha", resAlpha["appId"]?.jsonPrimitive?.content)

        assertEquals(1L, service.getSession("app_alpha")?.messageCount)
        assertEquals(0L, service.getSession("app_beta")?.messageCount)
    }

    @Test
    fun `test terminateSpecificTenantSession removes session and notifies listener`() = runTest {
        val terminatedEvents = CopyOnWriteArrayList<Pair<String, String>>()
        val listener = SessionTerminationListener { appId, reason ->
            terminatedEvents.add(appId to reason)
        }
        service.registerTerminationListener(listener)

        service.initializeEngine("app_1", "/data/app_1")
        service.initializeEngine("app_2", "/data/app_2")

        val terminated = service.terminateSession("app_1")
        assertTrue(terminated)
        assertNull(service.getSession("app_1"))
        assertNotNull(service.getSession("app_2"))
        assertEquals(1, terminatedEvents.size)
        assertEquals("app_1" to "EXPLICIT_TERMINATION", terminatedEvents[0])

        service.unregisterTerminationListener(listener)
    }

    @Test
    fun `test terminateSession cleans up all active state and resets initialization`() = runTest {
        val terminatedEvents = CopyOnWriteArrayList<Pair<String, String>>()
        service.registerTerminationListener { appId, reason ->
            terminatedEvents.add(appId to reason)
        }

        service.initializeEngine("app_chat", "/data/miniapps/app_chat")
        assertTrue(service.getSandboxStatus().isInitialized)

        val terminated = service.terminateSession(null)
        assertTrue(terminated)
        val afterTerminate = service.getSandboxStatus()
        assertFalse(afterTerminate.isInitialized)
        assertEquals("", afterTerminate.activeAppId)
        assertEquals(0, afterTerminate.activeSessionsCount)
        assertEquals(1, terminatedEvents.size)
        assertEquals("app_chat" to "GLOBAL_RESET", terminatedEvents[0])

        val dispatchFail = service.dispatchIsolatedMessage("""{"action":"TEST"}""")
        assertFalse(dispatchFail["success"]?.jsonPrimitive?.booleanOrNull == true)
    }

    @Test
    fun `test concurrent message dispatching is thread-safe`() = runTest {
        service.initializeEngine("app_perf", "/data/app_perf")
        val concurrency = 50

        val deferreds = (1..concurrency).map { index ->
            async {
                service.dispatchIsolatedMessage("""{"action":"MSG_$index"}""")
            }
        }
        val results = deferreds.awaitAll()

        assertEquals(concurrency, results.size)
        assertTrue(results.all { it["success"]?.jsonPrimitive?.booleanOrNull == true })
        assertEquals(concurrency.toLong(), service.getSandboxStatus().totalMessagesProcessed)
        assertEquals(concurrency.toLong(), service.getSession("app_perf")?.messageCount)
    }
}

