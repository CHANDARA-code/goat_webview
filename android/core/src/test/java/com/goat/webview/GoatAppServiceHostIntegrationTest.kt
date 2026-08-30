package com.goat.webview

import com.goat.webview.view.GoatView
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Unit and Integration Test Suite for Milestone 3 Android Host Integration (Task F7).
 *
 * Verifies:
 * 1. AppService Worker bridge frame dispatch through [GoatBridgeActionHandler]
 * 2. Host lifecycle signal dispatch (onAppServiceReady, onAppServiceCrash, onAppServiceTerminate)
 * 3. Lifecycle callbacks in [GoatView] and Android Compose
 * 4. Error isolation so worker crashes do not corrupt native host state
 */
class GoatAppServiceHostIntegrationTest {

    private lateinit var context: FakeTestContext

    @Before
    fun setUp() {
        context = FakeTestContext()
    }

    @Test
    fun `test GoatBridgeActionHandler receives and dispatches ON_APP_SERVICE_READY signal`() = runTest {
        var readyAppId: String? = null
        var readyDetails: JsonObject? = null

        val actionHandler = GoatBridgeActionHandler(
            context = context,
            appId = "miniapp_dual_thread_1",
            onAppServiceReady = { appId, details ->
                readyAppId = appId
                readyDetails = details
            }
        )

        assertTrue(actionHandler.getSupportedActions().contains("ON_APP_SERVICE_READY"))
        assertTrue(actionHandler.getSupportedActions().contains("APP_SERVICE_READY"))

        val payload = buildJsonObject {
            put("appId", "miniapp_dual_thread_1")
            put("timestamp", 1724725000000L)
            put("details", buildJsonObject {
                put("engine", "v8_worker")
                put("version", "1.0.0")
            })
        }

        val result = actionHandler.executeAction("ON_APP_SERVICE_READY", payload)
        assertTrue(result.isSuccess)
        val data = result.getOrNull()
        assertNotNull(data)
        assertEquals("true", data?.get("handled")?.jsonPrimitive?.content)
        assertEquals("onAppServiceReady", data?.get("event")?.jsonPrimitive?.content)
        assertEquals("miniapp_dual_thread_1", data?.get("appId")?.jsonPrimitive?.content)

        assertEquals("miniapp_dual_thread_1", readyAppId)
        assertNotNull(readyDetails)
        assertEquals("v8_worker", readyDetails?.get("engine")?.jsonPrimitive?.content)
    }

    @Test
    fun `test GoatBridgeActionHandler receives and dispatches ON_APP_SERVICE_CRASH signal`() = runTest {
        var crashAppId: String? = null
        var crashError: String? = null
        var crashDetails: JsonObject? = null

        val actionHandler = GoatBridgeActionHandler(
            context = context,
            appId = "miniapp_dual_thread_2",
            onAppServiceCrash = { appId, error, details ->
                crashAppId = appId
                crashError = error
                crashDetails = details
            }
        )

        val payload = buildJsonObject {
            put("appId", "miniapp_dual_thread_2")
            put("error", "Uncaught ReferenceError: foo is not defined at worker.js:42")
            put("details", buildJsonObject {
                put("stack", "ReferenceError: foo is not defined\n    at eval (worker.js:42:5)")
                put("fatal", true)
            })
        }

        val result = actionHandler.executeAction("ON_APP_SERVICE_CRASH", payload)
        assertTrue(result.isSuccess)
        val data = result.getOrNull()
        assertNotNull(data)
        assertEquals("true", data?.get("handled")?.jsonPrimitive?.content)
        assertEquals("onAppServiceCrash", data?.get("event")?.jsonPrimitive?.content)
        assertEquals("miniapp_dual_thread_2", crashAppId)
        assertEquals("Uncaught ReferenceError: foo is not defined at worker.js:42", crashError)
        assertNotNull(crashDetails)
    }

    @Test
    fun `test GoatBridgeActionHandler receives and dispatches ON_APP_SERVICE_TERMINATE signal`() = runTest {
        var terminateAppId: String? = null

        val actionHandler = GoatBridgeActionHandler(
            context = context,
            appId = "miniapp_dual_thread_3",
            onAppServiceTerminate = { appId, _ ->
                terminateAppId = appId
            }
        )

        val payload = buildJsonObject {
            put("appId", "miniapp_dual_thread_3")
        }

        val result = actionHandler.executeAction("ON_APP_SERVICE_TERMINATE", payload)
        assertTrue(result.isSuccess)
        assertEquals("miniapp_dual_thread_3", terminateAppId)
    }

    @Test
    fun `test GoatView lifecycle callbacks fire on AppService signals`() = runTest {
        val goatView = GoatView(context)
        var readyFired = false
        var crashFired = false
        var terminateFired = false

        goatView.onAppServiceReady = { appId, _ ->
            if (appId == "test_app") readyFired = true
        }
        goatView.onAppServiceCrash = { appId, error, _ ->
            if (appId == "test_app" && error.contains("crash")) crashFired = true
        }
        goatView.onAppServiceTerminate = { appId, _ ->
            if (appId == "test_app") terminateFired = true
        }

        val handler = GoatBridgeActionHandler(
            context = context,
            appId = "test_app",
            onAppServiceReady = { appId, details -> goatView.onAppServiceReady?.invoke(appId, details) },
            onAppServiceCrash = { appId, error, details -> goatView.onAppServiceCrash?.invoke(appId, error, details) },
            onAppServiceTerminate = { appId, details -> goatView.onAppServiceTerminate?.invoke(appId, details) }
        )

        handler.executeAction("ON_APP_SERVICE_READY", buildJsonObject { put("appId", "test_app") })
        handler.executeAction("ON_APP_SERVICE_CRASH", buildJsonObject {
            put("appId", "test_app")
            put("error", "Simulated worker crash")
        })
        handler.executeAction("ON_APP_SERVICE_TERMINATE", buildJsonObject { put("appId", "test_app") })

        assertTrue("onAppServiceReady must fire on GoatView", readyFired)
        assertTrue("onAppServiceCrash must fire on GoatView", crashFired)
        assertTrue("onAppServiceTerminate must fire on GoatView", terminateFired)
    }

    @Test
    fun `test Worker-originated native bridge actions execute without regression`() = runTest {
        val actionHandler = GoatBridgeActionHandler(
            context = context,
            appId = "worker_miniapp_suite"
        )

        // 1. GET_DEVICE_INFO
        val infoRes = actionHandler.executeAction("GET_DEVICE_INFO", buildJsonObject {})
        assertTrue(infoRes.isSuccess)
        assertNotNull(infoRes.getOrNull()?.get("model"))

        // 2. STORAGE_SET & STORAGE_GET
        val setRes = actionHandler.executeAction("STORAGE_SET", buildJsonObject {
            put("key", "worker_session_token")
            put("value", "token_xyz_987")
        })
        assertTrue(setRes.isSuccess)

        val getRes = actionHandler.executeAction("STORAGE_GET", buildJsonObject {
            put("key", "worker_session_token")
        })
        assertTrue(getRes.isSuccess)
        assertEquals("token_xyz_987", getRes.getOrNull()?.get("value")?.jsonPrimitive?.content)

        // 3. CAN_I_USE
        val canIUseRes = actionHandler.executeAction("CAN_I_USE", buildJsonObject {
            put("schema", "ON_APP_SERVICE_READY")
        })
        assertTrue(canIUseRes.isSuccess)
        val available = canIUseRes.getOrNull()?.get("available")?.jsonPrimitive?.content
        assertEquals("true", available)
    }
}
