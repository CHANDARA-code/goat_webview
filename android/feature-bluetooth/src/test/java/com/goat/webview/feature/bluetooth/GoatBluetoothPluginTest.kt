package com.goat.webview.feature.bluetooth

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

@OptIn(ExperimentalCoroutinesApi::class)
class GoatBluetoothPluginTest {

    private lateinit var fakeContext: FakeTestContext
    private lateinit var plugin: GoatBluetoothPlugin

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
        override fun getSystemService(name: String): Any? = null
    }

    @Before
    fun setUp() {
        fakeContext = FakeTestContext()
        plugin = GoatBluetoothPlugin(
            fakeContext,
            isBluetoothEnabledProvider = { true },
            isNfcEnabledProvider = { true }
        )
    }

    @Test
    fun testPluginIdAndSupportedActions() {
        assertEquals("bluetooth", plugin.pluginId)
        assertTrue(plugin.supportedActions.contains("START_BLE_SCAN"))
        assertTrue(plugin.supportedActions.contains("BLE_START_SCAN"))
        assertTrue(plugin.supportedActions.contains("STOP_BLE_SCAN"))
        assertTrue(plugin.supportedActions.contains("BLE_CONNECT"))
        assertTrue(plugin.supportedActions.contains("DISCONNECT_BLE_DEVICE"))
        assertTrue(plugin.supportedActions.contains("BLE_READ_CHARACTERISTIC"))
        assertTrue(plugin.supportedActions.contains("BLE_WRITE_CHARACTERISTIC"))
        assertTrue(plugin.supportedActions.contains("NFC_READ_TAG"))
        assertTrue(plugin.supportedActions.contains("NFC_WRITE_TAG"))
        assertTrue(plugin.supportedActions.contains("START_NFC_DISCOVERY"))
        assertTrue(plugin.supportedActions.contains("STOP_NFC_DISCOVERY"))
    }

    @Test
    fun testBleScanLifecycle() = runTest {
        val startResult = plugin.execute("START_BLE_SCAN", buildJsonObject {})
        assertTrue(startResult.isSuccess)
        val startData = startResult.getOrNull()
        assertNotNull(startData)
        assertTrue(startData!!.containsKey("devices"))

        val stopResult = plugin.execute("STOP_BLE_SCAN", buildJsonObject {})
        assertTrue(stopResult.isSuccess)
        assertTrue(stopResult.getOrNull()!!.containsKey("stopped"))
    }

    @Test
    fun testBleConnectAndDisconnect() = runTest {
        // Missing deviceId -> fail
        val invalidConnect = plugin.execute("BLE_CONNECT", buildJsonObject {})
        assertTrue(invalidConnect.isFailure)

        // Valid deviceId
        val validConnect = plugin.execute("BLE_CONNECT", buildJsonObject { put("deviceId", "AA:BB:CC:DD:EE:FF") })
        assertTrue(validConnect.isSuccess)
        assertEquals("AA:BB:CC:DD:EE:FF", validConnect.getOrNull()?.get("deviceId")?.jsonPrimitive?.content)

        // Disconnect
        val disconnectResult = plugin.execute("DISCONNECT_BLE_DEVICE", buildJsonObject { put("deviceId", "AA:BB:CC:DD:EE:FF") })
        assertTrue(disconnectResult.isSuccess)
        assertEquals("AA:BB:CC:DD:EE:FF", disconnectResult.getOrNull()?.get("deviceId")?.jsonPrimitive?.content)
    }

    @Test
    fun testBleReadAndWriteCharacteristic() = runTest {
        val payload = buildJsonObject {
            put("deviceId", "AA:BB:CC:DD:EE:FF")
            put("characteristicUuid", "00002a00-0000-1000-8000-00805f9b34fb")
            put("value", "476f6174")
        }

        val writeResult = plugin.execute("BLE_WRITE_CHARACTERISTIC", payload)
        assertTrue(writeResult.isSuccess)

        val readResult = plugin.execute("BLE_READ_CHARACTERISTIC", payload)
        assertTrue(readResult.isSuccess)
    }

    @Test
    fun testNfcReadAndWrite() = runTest {
        val readResult = plugin.execute("NFC_READ_TAG", buildJsonObject {})
        assertTrue(readResult.isSuccess)

        val writePayload = buildJsonObject {
            put("payload", "https://goat.io")
        }
        val writeResult = plugin.execute("NFC_WRITE_TAG", writePayload)
        assertTrue(writeResult.isSuccess)
        assertEquals("https://goat.io", writeResult.getOrNull()?.get("payload")?.jsonPrimitive?.content)
    }

    @Test
    fun testNfcDiscovery() = runTest {
        val startResult = plugin.execute("START_NFC_DISCOVERY", buildJsonObject {})
        assertTrue(startResult.isSuccess)

        val stopResult = plugin.execute("STOP_NFC_DISCOVERY", buildJsonObject {})
        assertTrue(stopResult.isSuccess)
    }

    @Test
    fun testBleScanWhenDisabledFails() = runTest {
        val disabledPlugin = GoatBluetoothPlugin(fakeContext, isBluetoothEnabledProvider = { false })
        val result = disabledPlugin.execute("START_BLE_SCAN", buildJsonObject {})
        assertTrue(result.isFailure)
    }

    @Test
    fun testNfcReadWhenDisabledFails() = runTest {
        val disabledPlugin = GoatBluetoothPlugin(fakeContext, isNfcEnabledProvider = { false })
        val result = disabledPlugin.execute("NFC_READ_TAG", buildJsonObject {})
        assertTrue(result.isFailure)
    }

    @Test
    fun testUnsupportedActionFails() = runTest {
        val result = plugin.execute("UNKNOWN_ACTION", buildJsonObject {})
        assertTrue(result.isFailure)
    }
}
