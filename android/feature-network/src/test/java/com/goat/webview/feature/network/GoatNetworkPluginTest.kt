package com.goat.webview.feature.network

import android.content.Context
import android.content.ContextWrapper
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File

@OptIn(ExperimentalCoroutinesApi::class)
class GoatNetworkPluginTest {

    private lateinit var fakeContext: FakeTestContext
    private lateinit var plugin: GoatNetworkPlugin
    private lateinit var tempFile: File

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
        override fun getSystemService(name: String): Any? = null
    }

    @Before
    fun setUp() {
        fakeContext = FakeTestContext()
        plugin = GoatNetworkPlugin(fakeContext)
        tempFile = File.createTempFile("goat_network_test", ".tmp").apply {
            writeText("Hello Goat Network")
        }
    }

    @Test
    fun testPluginIdAndSupportedActions() {
        assertEquals("network", plugin.pluginId)
        assertTrue(plugin.supportedActions.contains("GET_NETWORK_TYPE"))
        assertTrue(plugin.supportedActions.contains("UPLOAD_FILE"))
        assertTrue(plugin.supportedActions.contains("WEBSOCKET_CONNECT"))
        assertTrue(plugin.supportedActions.contains("WEBSOCKET_SEND"))
        assertTrue(plugin.supportedActions.contains("WEBSOCKET_CLOSE"))
    }

    @Test
    fun testGetNetworkTypeReturnsStructure() = runTest {
        val result = plugin.execute("GET_NETWORK_TYPE", buildJsonObject {})
        assertTrue(result.isSuccess)
        val data = result.getOrNull()
        assertNotNull(data)
        assertTrue(data!!.containsKey("networkType"))
        assertTrue(data.containsKey("isConnected"))
    }

    @Test
    fun testWebSocketLifecycle() = runTest {
        // CONNECT
        val connectPayload = buildJsonObject {
            put("url", "wss://echo.websocket.events")
        }
        val connectResult = plugin.execute("WEBSOCKET_CONNECT", connectPayload)
        assertTrue(connectResult.isSuccess)
        assertEquals("true", connectResult.getOrNull()?.get("connected")?.jsonPrimitive?.content)

        // SEND
        val sendPayload = buildJsonObject {
            put("data", "test ping")
        }
        val sendResult = plugin.execute("WEBSOCKET_SEND", sendPayload)
        assertTrue(sendResult.isSuccess)
        assertEquals("true", sendResult.getOrNull()?.get("sent")?.jsonPrimitive?.content)

        // CLOSE
        val closeResult = plugin.execute("WEBSOCKET_CLOSE", buildJsonObject {})
        assertTrue(closeResult.isSuccess)
        assertEquals("true", closeResult.getOrNull()?.get("closed")?.jsonPrimitive?.content)
    }

    @Test
    fun testWebSocketMissingUrlFails() = runTest {
        val result = plugin.execute("WEBSOCKET_CONNECT", buildJsonObject {})
        assertTrue(result.isFailure)
    }

    @Test
    fun testUploadFileMissingParamsFails() = runTest {
        val result = plugin.execute("UPLOAD_FILE", buildJsonObject {})
        assertTrue(result.isFailure)
    }

    @Test
    fun testUnsupportedActionFails() = runTest {
        val result = plugin.execute("UNKNOWN_ACTION", buildJsonObject {})
        assertTrue(result.isFailure)
    }
}
