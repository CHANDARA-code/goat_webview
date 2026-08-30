package com.goat.webview

import android.content.Context
import android.content.ContextWrapper
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

class GoatBleNfcManagerTest {

    private lateinit var fakeContext: FakeTestContext

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
    }

    @Before
    fun setUp() {
        fakeContext = FakeTestContext()
    }

    @Test
    fun testHardwareUnavailableExplicitErrorRejection() = runTest {
        // Manager in environment without Bluetooth / NFC hardware
        val manager = GoatBleNfcManager(fakeContext, bluetoothEnabledOverride = false, nfcEnabledOverride = false)

        assertFalse(manager.isBluetoothEnabled())
        assertFalse(manager.isNfcEnabled())

        // BLE Scan must fail with UNSUPPORTED_ON_DEVICE
        try {
            manager.startBleScan()
            fail("Expected GoatBridgeException for disabled BLE")
        } catch (e: GoatBridgeException) {
            assertEquals("UNSUPPORTED_ON_DEVICE", e.code)
        }

        // BLE Connect must fail with UNSUPPORTED_ON_DEVICE
        try {
            manager.connectBle("00:11:22:33:44:55")
            fail("Expected GoatBridgeException for disabled BLE")
        } catch (e: GoatBridgeException) {
            assertEquals("UNSUPPORTED_ON_DEVICE", e.code)
        }

        // NFC Read must fail with UNSUPPORTED_ON_DEVICE
        try {
            manager.readNfcTag()
            fail("Expected GoatBridgeException for disabled NFC")
        } catch (e: GoatBridgeException) {
            assertEquals("UNSUPPORTED_ON_DEVICE", e.code)
        }

        // NFC Write must fail with UNSUPPORTED_ON_DEVICE
        try {
            manager.writeNfcTag("https://goat.io")
            fail("Expected GoatBridgeException for disabled NFC")
        } catch (e: GoatBridgeException) {
            assertEquals("UNSUPPORTED_ON_DEVICE", e.code)
        }
    }

    @Test
    fun testBleLifecycleWithEnabledHardware() = runTest {
        val manager = GoatBleNfcManager(fakeContext, bluetoothEnabledOverride = true, nfcEnabledOverride = true)

        assertTrue(manager.isBluetoothEnabled())

        val scanResult = manager.startBleScan(timeoutMs = 1000)
        assertTrue(scanResult.isEmpty()) // No fake hardcoded beacons returned
        assertTrue(manager.isScanning())

        val stopped = manager.stopBleScan()
        assertTrue(stopped)
        assertFalse(manager.isScanning())

        // Connect with valid MAC address
        val deviceId = "00:11:22:33:44:55"
        val connected = manager.connectBle(deviceId)
        assertTrue(connected)
        assertTrue(manager.isConnected(deviceId))

        // Write and read real GATT characteristic
        val charUuid = "00002a19-0000-1000-8000-00805f9b34fb"
        val writeSuccess = manager.writeCharacteristic(deviceId, charUuid, "88%")
        assertTrue(writeSuccess)

        val readValue = manager.readCharacteristic(deviceId, charUuid)
        assertEquals("88%", readValue)

        // Reading non-existent characteristic returns null
        val unknownValue = manager.readCharacteristic(deviceId, "00002a00-0000-1000-8000-00805f9b34fb")
        assertNull(unknownValue)

        // Disconnect device
        val disconnected = manager.disconnectBle(deviceId)
        assertTrue(disconnected)
        assertFalse(manager.isConnected(deviceId))
    }

    @Test
    fun testBleAddressAndUuidValidation() = runTest {
        val manager = GoatBleNfcManager(fakeContext, bluetoothEnabledOverride = true)

        try {
            manager.connectBle("invalid_mac_address")
            fail("Expected IllegalArgumentException for malformed MAC address")
        } catch (e: IllegalArgumentException) {
            assertTrue(e.message?.contains("MAC address format") == true)
        }

        manager.connectBle("AA:BB:CC:DD:EE:FF")
        try {
            manager.writeCharacteristic("AA:BB:CC:DD:EE:FF", "not-a-valid-uuid", "data")
            fail("Expected IllegalArgumentException for malformed UUID")
        } catch (e: IllegalArgumentException) {
            assertTrue(e.message?.contains("UUID format") == true)
        }
    }

    @Test
    fun testNfcReadAndWriteLifecycle() = runTest {
        val manager = GoatBleNfcManager(fakeContext, nfcEnabledOverride = true)

        // Read when no tag presented throws NO_TAG_PRESENT
        try {
            manager.readNfcTag()
            fail("Expected GoatBridgeException for NO_TAG_PRESENT")
        } catch (e: GoatBridgeException) {
            assertEquals("NO_TAG_PRESENT", e.code)
        }

        // Write NFC Tag
        val testUrl = "https://goat.io/pay/checkout?id=992"
        val written = manager.writeNfcTag(testUrl)
        assertTrue(written)

        val tag = manager.readNfcTag()
        assertEquals("text/plain", tag.type)
        assertEquals(testUrl, tag.payload)
        assertEquals(testUrl, tag.uri)

        // Discovered NFC tag
        val customRecord = NfcTagRecord(type = "application/json", payload = "{\"orderId\":\"123\"}", uri = null)
        manager.setDiscoveredNfcTag(customRecord)
        val readCustom = manager.readNfcTag()
        assertEquals("application/json", readCustom.type)
        assertEquals("{\"orderId\":\"123\"}", readCustom.payload)
        assertNull(readCustom.uri)
    }
}
