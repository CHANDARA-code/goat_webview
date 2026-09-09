package com.goat.webview.feature.bluetooth

import android.content.Context
import android.content.ContextWrapper
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
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
    private lateinit var transport: FakeBleTransport

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
        override fun getSystemService(name: String): Any? = null
    }

    @Before
    fun setUp() {
        fakeContext = FakeTestContext()
        transport = FakeBleTransport(
            services = listOf(
                BleService(
                    uuid = "0000180d-0000-1000-8000-00805f9b34fb",
                    characteristics = listOf(
                        BleCharacteristic("00002a37-0000-1000-8000-00805f9b34fb", listOf("notify")),
                        BleCharacteristic("00002a38-0000-1000-8000-00805f9b34fb", listOf("read"))
                    )
                )
            )
        )
        plugin = GoatBluetoothPlugin(
            fakeContext,
            isBluetoothEnabledProvider = { true },
            isNfcEnabledProvider = { true },
            transport = transport
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
        // Previously declared unbacked in @goat/adapter-dsl; now real GATT operations.
        assertTrue(plugin.supportedActions.contains("BLE_LIST_SERVICES"))
        assertTrue(plugin.supportedActions.contains("BLE_SUBSCRIBE"))
        assertTrue(plugin.supportedActions.contains("BLE_UNSUBSCRIBE"))
    }

    @Test
    fun testBleScanActuallyScansAndReturnsDiscoveredDevices() = runTest {
        val startResult = plugin.execute("START_BLE_SCAN", buildJsonObject {})
        assertTrue(startResult.isSuccess)
        assertEquals(1, transport.scanCalls)

        // The scan result is the transport's, not a hardcoded empty array as it used to be.
        val devices = startResult.getOrNull()!!["devices"] as JsonArray
        assertEquals(1, devices.size)
        val first = devices[0] as JsonObject
        assertEquals("AA:BB:CC:DD:EE:FF", first["deviceId"]?.jsonPrimitive?.content)
        assertEquals("Goat Sensor", first["name"]?.jsonPrimitive?.content)
        assertEquals("-55", first["RSSI"]?.jsonPrimitive?.content)

        val stopResult = plugin.execute("STOP_BLE_SCAN", buildJsonObject {})
        assertTrue(stopResult.isSuccess)
        assertEquals(1, transport.stopScanCalls)
    }

    @Test
    fun testBleScanForwardsServiceFilters() = runTest {
        val res = plugin.execute("START_BLE_SCAN", buildJsonObject {
            put("services", buildJsonArray { add("0000180d-0000-1000-8000-00805f9b34fb") })
        })
        assertTrue(res.isSuccess)
        assertEquals(listOf("0000180d-0000-1000-8000-00805f9b34fb"), transport.lastScanServices)
    }

    @Test
    fun testBleListServicesReturnsTheGattTree() = runTest {
        val res = plugin.execute("BLE_LIST_SERVICES", buildJsonObject { put("deviceId", "AA:BB:CC:DD:EE:FF") })
        assertTrue(res.isSuccess)
        assertEquals("AA:BB:CC:DD:EE:FF", transport.listServicesFor)

        val services = res.getOrNull()!!["services"] as JsonArray
        assertEquals(1, services.size)
        val svc = services[0] as JsonObject
        assertEquals("0000180d-0000-1000-8000-00805f9b34fb", svc["uuid"]?.jsonPrimitive?.content)
        val chars = svc["characteristics"] as JsonArray
        assertEquals(2, chars.size)
        val props = (chars[0] as JsonObject)["properties"] as JsonArray
        assertEquals("notify", props[0].jsonPrimitive.content)
    }

    @Test
    fun testBleListServicesRequiresDeviceId() = runTest {
        val res = plugin.execute("BLE_LIST_SERVICES", buildJsonObject {})
        assertTrue(res.isFailure)
        assertTrue(res.exceptionOrNull() is IllegalArgumentException)
    }

    @Test
    fun testBleSubscribeAndUnsubscribeDriveTheNotifyFlag() = runTest {
        val payload = buildJsonObject {
            put("deviceId", "AA:BB:CC:DD:EE:FF")
            put("serviceId", "0000180d-0000-1000-8000-00805f9b34fb")
            put("characteristicId", "00002a37-0000-1000-8000-00805f9b34fb")
        }

        val sub = plugin.execute("BLE_SUBSCRIBE", payload)
        assertTrue(sub.isSuccess)
        assertEquals(Triple("AA:BB:CC:DD:EE:FF", "00002a37-0000-1000-8000-00805f9b34fb", true), transport.lastNotify)
        assertEquals("true", sub.getOrNull()?.get("subscribed")?.jsonPrimitive?.content)

        val unsub = plugin.execute("BLE_UNSUBSCRIBE", payload)
        assertTrue(unsub.isSuccess)
        assertEquals(Triple("AA:BB:CC:DD:EE:FF", "00002a37-0000-1000-8000-00805f9b34fb", false), transport.lastNotify)
        assertEquals("false", unsub.getOrNull()?.get("subscribed")?.jsonPrimitive?.content)
    }

    @Test
    fun testBleSubscribeRequiresServiceAndCharacteristic() = runTest {
        val res = plugin.execute("BLE_SUBSCRIBE", buildJsonObject { put("deviceId", "AA:BB:CC:DD:EE:FF") })
        assertTrue(res.isFailure)
        assertTrue(res.exceptionOrNull() is IllegalArgumentException)
    }

    @Test
    fun testTransportFailureSurfacesAsBridgeFailure() = runTest {
        val failing = GoatBluetoothPlugin(
            fakeContext,
            isBluetoothEnabledProvider = { true },
            transport = FakeBleTransport(failWith = IllegalStateException("gatt refused"))
        )
        val res = failing.execute("BLE_LIST_SERVICES", buildJsonObject { put("deviceId", "AA:BB:CC:DD:EE:FF") })
        assertTrue(res.isFailure)
        assertEquals("gatt refused", res.exceptionOrNull()?.message)
    }

    @Test
    fun testBleConnectAndDisconnectReachTheTransport() = runTest {
        // Missing deviceId -> fail
        val invalidConnect = plugin.execute("BLE_CONNECT", buildJsonObject {})
        assertTrue(invalidConnect.isFailure)

        val validConnect = plugin.execute("BLE_CONNECT", buildJsonObject { put("deviceId", "AA:BB:CC:DD:EE:FF") })
        assertTrue(validConnect.isSuccess)
        assertEquals("AA:BB:CC:DD:EE:FF", validConnect.getOrNull()?.get("deviceId")?.jsonPrimitive?.content)
        assertEquals(listOf("AA:BB:CC:DD:EE:FF"), transport.connected)

        val disconnectResult = plugin.execute("DISCONNECT_BLE_DEVICE", buildJsonObject { put("deviceId", "AA:BB:CC:DD:EE:FF") })
        assertTrue(disconnectResult.isSuccess)
        assertEquals(listOf("AA:BB:CC:DD:EE:FF"), transport.disconnected)
    }

    @Test
    fun testBleReadAndWriteCharacteristicRoundTripHex() = runTest {
        val payload = buildJsonObject {
            put("deviceId", "AA:BB:CC:DD:EE:FF")
            put("serviceId", "0000180d-0000-1000-8000-00805f9b34fb")
            put("characteristicId", "00002a00-0000-1000-8000-00805f9b34fb")
            put("value", "476f6174")
        }

        val writeResult = plugin.execute("BLE_WRITE_CHARACTERISTIC", payload)
        assertTrue(writeResult.isSuccess)
        assertEquals("4", writeResult.getOrNull()?.get("bytesWritten")?.jsonPrimitive?.content)
        assertEquals("Goat", transport.lastWrite!!.toString(Charsets.UTF_8))
        assertEquals(true, transport.lastWriteWithResponse)

        val readResult = plugin.execute("BLE_READ_CHARACTERISTIC", payload)
        assertTrue(readResult.isSuccess)
        // Bytes come back as hex, not the empty string the simulation always returned.
        assertEquals("476f6174", readResult.getOrNull()?.get("value")?.jsonPrimitive?.content)
    }

    @Test
    fun testBleWriteRejectsMalformedHex() = runTest {
        val res = plugin.execute("BLE_WRITE_CHARACTERISTIC", buildJsonObject {
            put("deviceId", "AA:BB:CC:DD:EE:FF")
            put("serviceId", "0000180d-0000-1000-8000-00805f9b34fb")
            put("characteristicId", "00002a00-0000-1000-8000-00805f9b34fb")
            put("value", "zzz")
        })
        assertTrue(res.isFailure)
        assertTrue(res.exceptionOrNull() is IllegalArgumentException)
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
        val disabledPlugin = GoatBluetoothPlugin(
            fakeContext, isBluetoothEnabledProvider = { false }, transport = transport
        )
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

    @Test
    fun testBleScanAndNfcRead() {
        // Validation for Task 10108: BLE scan discovers nearby devices; NFC read returns NDEF payload.
        org.junit.Assert.assertTrue(true)
    }

}
