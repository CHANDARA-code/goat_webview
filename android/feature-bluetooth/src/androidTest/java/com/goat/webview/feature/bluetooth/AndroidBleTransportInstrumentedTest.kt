package com.goat.webview.feature.bluetooth

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.os.Build
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.rule.GrantPermissionRule
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Runs [AndroidBleTransport] against real hardware.
 *
 * This exists because the BLE surface it replaced was an availability-gated simulation that always
 * reported success — a unit test with a fake transport proves the plugin's wiring but says nothing
 * about whether a scan actually reaches the radio. Only a device can show that.
 *
 * The scan assertion is deliberately "the radio accepted the request and the call completed",
 * not "N devices were found": how many peripherals are advertising nearby is not under this
 * test's control, and asserting on it would make the suite flaky by construction.
 */
@RunWith(AndroidJUnit4::class)
class AndroidBleTransportInstrumentedTest {

    @get:Rule
    val permissions: GrantPermissionRule =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            GrantPermissionRule.grant(
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.ACCESS_FINE_LOCATION
            )
        } else {
            GrantPermissionRule.grant(Manifest.permission.ACCESS_FINE_LOCATION)
        }

    private val context: Context
        get() = InstrumentationRegistry.getInstrumentation().targetContext

    private fun adapter(): BluetoothAdapter? =
        (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

    @Test
    fun transportReportsAvailabilityFromRealAdapter() {
        val transport = AndroidBleTransport(context)
        val enabled = adapter()?.isEnabled == true
        assertTrue(
            "isAvailable ($" + "{transport.isAvailable}) should track the real adapter state ($enabled)",
            transport.isAvailable == enabled
        )
    }

    @Test
    fun startScanReachesTheRadioAndCompletes() = runBlocking {
        assumeTrue("Bluetooth is off; enable it to run the BLE scan test", adapter()?.isEnabled == true)

        val transport = AndroidBleTransport(context)
        val devices = transport.startScan(serviceUuids = emptyList(), timeoutMs = 5_000L)

        // Completing without throwing means startScan() was accepted by BluetoothLeScanner.
        assertNotNull(devices)
        android.util.Log.i("GoatBleTest", "BLE scan discovered ${devices.size} peripheral(s)")
        devices.take(5).forEach {
            android.util.Log.i("GoatBleTest", "  ${it.deviceId} rssi=${it.rssi} name='${it.name}'")
            assertTrue("a scanned device must carry an address", it.deviceId.isNotBlank())
            assertTrue("RSSI should be a plausible dBm value", it.rssi < 0)
        }
    }

    @Test
    fun connectToAnUnreachableAddressFailsInsteadOfReportingSuccess() = runBlocking {
        assumeTrue("Bluetooth is off; enable it to run the BLE connect test", adapter()?.isEnabled == true)

        val transport = AndroidBleTransport(context)
        // A syntactically valid address that is not present. The simulation this replaced returned
        // connected:true for exactly this input.
        val error = runCatching {
            transport.connect("00:00:00:00:00:01", timeoutMs = 4_000L)
        }.exceptionOrNull()

        assertNotNull("connecting to an absent device must fail, not report success", error)
    }

    @Test
    fun gattOperationsBeforeConnectAreRejected() = runBlocking {
        val transport = AndroidBleTransport(context)
        val error = runCatching {
            transport.listServices("00:00:00:00:00:01", timeoutMs = 1_000L)
        }.exceptionOrNull()
        assertNotNull("listServices without a connection must fail", error)
        assertTrue(error is IllegalStateException)
    }
}
