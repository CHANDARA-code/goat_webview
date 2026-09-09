package com.goat.webview.feature.bluetooth

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Build
import android.os.ParcelUuid
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeoutOrNull
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * The real Android GATT client behind [GoatBleTransport].
 *
 * Replaces what was an availability-gated simulation: the previous plugin reported
 * `scanning: true` with an always-empty device list and `connected: true` without ever calling
 * `connectGatt`, so nothing in the BLE surface touched hardware. Every operation here maps onto a
 * genuine `BluetoothGatt` call and completes from [BluetoothGattCallback].
 */
@SuppressLint("MissingPermission")
class AndroidBleTransport(private val context: Context) : GoatBleTransport {

    private companion object {
        /** Client Characteristic Configuration Descriptor — the standard notification switch. */
        val CCCD_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
    }

    private val adapter: BluetoothAdapter? by lazy {
        try {
            val bm = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            @Suppress("DEPRECATION")
            bm?.adapter ?: BluetoothAdapter.getDefaultAdapter()
        } catch (e: Exception) {
            null
        }
    }

    override val isAvailable: Boolean
        get() = adapter?.isEnabled == true

    private val scanned = ConcurrentHashMap<String, BleDevice>()
    private var scanCallback: ScanCallback? = null

    @Volatile
    private var scanFailure: Int? = null

    private fun scanFailureMessage(code: Int): String = when (code) {
        1 -> "SCAN_FAILED_ALREADY_STARTED"
        2 -> "SCAN_FAILED_APPLICATION_REGISTRATION_FAILED"
        3 -> "SCAN_FAILED_INTERNAL_ERROR"
        4 -> "SCAN_FAILED_FEATURE_UNSUPPORTED"
        5 -> "SCAN_FAILED_OUT_OF_HARDWARE_RESOURCES"
        6 -> "SCAN_FAILED_SCANNING_TOO_FREQUENTLY"
        else -> "SCAN_FAILED_UNKNOWN($code)"
    }

    private class Connection(val gatt: BluetoothGatt) {
        var onConnected: CompletableDeferred<Boolean>? = null
        var onServices: CompletableDeferred<Boolean>? = null
        var onRead: CompletableDeferred<ByteArray>? = null
        var onWrite: CompletableDeferred<Boolean>? = null
        var onDescriptorWrite: CompletableDeferred<Boolean>? = null
    }

    private val connections = ConcurrentHashMap<String, Connection>()

    private fun requireAdapter(): BluetoothAdapter =
        adapter?.takeIf { it.isEnabled }
            ?: throw IllegalStateException("Bluetooth adapter is disabled or unavailable")

    private fun requireConnection(deviceId: String): Connection =
        connections[deviceId]
            ?: throw IllegalStateException("Not connected to $deviceId; call BLE_CONNECT first")

    private fun characteristic(
        conn: Connection,
        serviceUuid: String,
        characteristicUuid: String
    ): BluetoothGattCharacteristic {
        val service = conn.gatt.getService(UUID.fromString(serviceUuid))
            ?: throw IllegalArgumentException("Service $serviceUuid not found; run BLE_LIST_SERVICES first")
        return service.getCharacteristic(UUID.fromString(characteristicUuid))
            ?: throw IllegalArgumentException("Characteristic $characteristicUuid not found in service $serviceUuid")
    }

    override suspend fun startScan(serviceUuids: List<String>, timeoutMs: Long): List<BleDevice> {
        val scanner = requireAdapter().bluetoothLeScanner
            ?: throw IllegalStateException("BLE scanner unavailable")
        stopScan()
        scanned.clear()
        scanFailure = null

        val filters = serviceUuids.mapNotNull { raw ->
            runCatching { ScanFilter.Builder().setServiceUuid(ParcelUuid(UUID.fromString(raw))).build() }
                .getOrNull()
        }
        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()

        val cb = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult?) {
                val device = result?.device ?: return
                scanned[device.address] = BleDevice(
                    deviceId = device.address,
                    name = device.name ?: "",
                    rssi = result.rssi
                )
            }

            override fun onBatchScanResults(results: MutableList<ScanResult>?) {
                results?.forEach { onScanResult(ScanSettings.CALLBACK_TYPE_ALL_MATCHES, it) }
            }

            // Without this, a rejected scan is indistinguishable from "nothing nearby": the
            // callback never fires and startScan returns an empty list as though it had worked.
            override fun onScanFailed(errorCode: Int) {
                scanFailure = errorCode
            }
        }
        scanCallback = cb
        scanner.startScan(filters, settings, cb)
        delay(timeoutMs)
        stopScan()
        scanFailure?.let { throw IllegalStateException("BLE scan rejected: ${scanFailureMessage(it)}") }
        return scanned.values.sortedByDescending { it.rssi }
    }

    override fun stopScan() {
        val cb = scanCallback ?: return
        scanCallback = null
        runCatching { adapter?.bluetoothLeScanner?.stopScan(cb) }
    }

    override suspend fun connect(deviceId: String, timeoutMs: Long): Boolean {
        connections[deviceId]?.let { return true }
        val device = runCatching { requireAdapter().getRemoteDevice(deviceId) }.getOrNull()
            ?: throw IllegalArgumentException("Invalid BLE device address: $deviceId")

        val connected = CompletableDeferred<Boolean>()
        lateinit var conn: Connection

        val callback = object : BluetoothGattCallback() {
            override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
                if (newState == BluetoothProfile.STATE_CONNECTED) {
                    conn.onConnected?.complete(true)
                } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                    conn.onConnected?.complete(false)
                    connections.remove(deviceId)
                    runCatching { gatt.close() }
                }
            }

            override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
                conn.onServices?.complete(status == BluetoothGatt.GATT_SUCCESS)
            }

            @Deprecated("Deprecated in Java")
            @Suppress("DEPRECATION")
            override fun onCharacteristicRead(
                gatt: BluetoothGatt,
                characteristic: BluetoothGattCharacteristic,
                status: Int
            ) {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
                    conn.onRead?.complete(characteristic.value ?: ByteArray(0))
                }
            }

            override fun onCharacteristicRead(
                gatt: BluetoothGatt,
                characteristic: BluetoothGattCharacteristic,
                value: ByteArray,
                status: Int
            ) {
                conn.onRead?.complete(value)
            }

            override fun onCharacteristicWrite(
                gatt: BluetoothGatt,
                characteristic: BluetoothGattCharacteristic,
                status: Int
            ) {
                conn.onWrite?.complete(status == BluetoothGatt.GATT_SUCCESS)
            }

            override fun onDescriptorWrite(
                gatt: BluetoothGatt,
                descriptor: BluetoothGattDescriptor,
                status: Int
            ) {
                conn.onDescriptorWrite?.complete(status == BluetoothGatt.GATT_SUCCESS)
            }
        }

        val gatt = device.connectGatt(context, false, callback, BluetoothDevice_TRANSPORT_LE)
            ?: throw IllegalStateException("connectGatt returned null for $deviceId")
        conn = Connection(gatt)
        conn.onConnected = connected
        connections[deviceId] = conn

        val ok = withTimeoutOrNull(timeoutMs) { connected.await() } ?: false
        conn.onConnected = null
        if (!ok) {
            connections.remove(deviceId)
            runCatching { gatt.close() }
            throw IllegalStateException("Connection to $deviceId timed out or was refused")
        }
        return true
    }

    override suspend fun disconnect(deviceId: String): Boolean {
        val conn = connections.remove(deviceId) ?: return false
        runCatching { conn.gatt.disconnect() }
        runCatching { conn.gatt.close() }
        return true
    }

    override suspend fun listServices(deviceId: String, timeoutMs: Long): List<BleService> {
        val conn = requireConnection(deviceId)
        val done = CompletableDeferred<Boolean>()
        conn.onServices = done
        if (!conn.gatt.discoverServices()) {
            conn.onServices = null
            throw IllegalStateException("discoverServices() was refused for $deviceId")
        }
        val ok = withTimeoutOrNull(timeoutMs) { done.await() } ?: false
        conn.onServices = null
        if (!ok) throw IllegalStateException("Service discovery failed or timed out for $deviceId")

        return conn.gatt.services.orEmpty().map { service ->
            BleService(
                uuid = service.uuid.toString(),
                characteristics = service.characteristics.orEmpty().map { ch ->
                    BleCharacteristic(uuid = ch.uuid.toString(), properties = propertyNames(ch.properties))
                }
            )
        }
    }

    private fun propertyNames(mask: Int): List<String> = buildList {
        if (mask and BluetoothGattCharacteristic.PROPERTY_READ != 0) add("read")
        if (mask and BluetoothGattCharacteristic.PROPERTY_WRITE != 0) add("write")
        if (mask and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE != 0) add("writeNoResponse")
        if (mask and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0) add("notify")
        if (mask and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0) add("indicate")
    }

    override suspend fun read(
        deviceId: String,
        serviceUuid: String,
        characteristicUuid: String,
        timeoutMs: Long
    ): ByteArray {
        val conn = requireConnection(deviceId)
        val ch = characteristic(conn, serviceUuid, characteristicUuid)
        val done = CompletableDeferred<ByteArray>()
        conn.onRead = done
        if (!conn.gatt.readCharacteristic(ch)) {
            conn.onRead = null
            throw IllegalStateException("readCharacteristic() was refused for $characteristicUuid")
        }
        val value = withTimeoutOrNull(timeoutMs) { done.await() }
        conn.onRead = null
        return value ?: throw IllegalStateException("Read of $characteristicUuid timed out")
    }

    @Suppress("DEPRECATION")
    override suspend fun write(
        deviceId: String,
        serviceUuid: String,
        characteristicUuid: String,
        value: ByteArray,
        withResponse: Boolean,
        timeoutMs: Long
    ): Int {
        val conn = requireConnection(deviceId)
        val ch = characteristic(conn, serviceUuid, characteristicUuid)
        val writeType = if (withResponse) {
            BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
        } else {
            BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
        }

        val done = CompletableDeferred<Boolean>()
        conn.onWrite = done
        val accepted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            conn.gatt.writeCharacteristic(ch, value, writeType) == BluetoothGatt.GATT_SUCCESS
        } else {
            ch.writeType = writeType
            ch.value = value
            conn.gatt.writeCharacteristic(ch)
        }
        if (!accepted) {
            conn.onWrite = null
            throw IllegalStateException("writeCharacteristic() was refused for $characteristicUuid")
        }
        val ok = withTimeoutOrNull(timeoutMs) { done.await() } ?: false
        conn.onWrite = null
        if (!ok) throw IllegalStateException("Write to $characteristicUuid failed or timed out")
        return value.size
    }

    @Suppress("DEPRECATION")
    override suspend fun setNotify(
        deviceId: String,
        serviceUuid: String,
        characteristicUuid: String,
        enable: Boolean,
        timeoutMs: Long
    ): Boolean {
        val conn = requireConnection(deviceId)
        val ch = characteristic(conn, serviceUuid, characteristicUuid)

        if (!conn.gatt.setCharacteristicNotification(ch, enable)) {
            throw IllegalStateException("setCharacteristicNotification() was refused for $characteristicUuid")
        }

        // Local notification routing is only half of it — the peripheral does not send anything
        // until the CCCD is written, which is the step most "subscribe" implementations forget.
        val cccd = ch.getDescriptor(CCCD_UUID)
            ?: throw IllegalStateException("Characteristic $characteristicUuid has no CCCD; it does not support notify")

        val payload = when {
            !enable -> BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE
            ch.properties and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0 ->
                BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
            else -> BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
        }

        val done = CompletableDeferred<Boolean>()
        conn.onDescriptorWrite = done
        val accepted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            conn.gatt.writeDescriptor(cccd, payload) == BluetoothGatt.GATT_SUCCESS
        } else {
            cccd.value = payload
            conn.gatt.writeDescriptor(cccd)
        }
        if (!accepted) {
            conn.onDescriptorWrite = null
            throw IllegalStateException("CCCD write was refused for $characteristicUuid")
        }
        val ok = withTimeoutOrNull(timeoutMs) { done.await() } ?: false
        conn.onDescriptorWrite = null
        if (!ok) throw IllegalStateException("CCCD write failed or timed out for $characteristicUuid")
        return true
    }
}

/** `BluetoothDevice.TRANSPORT_LE`, inlined so the file does not import the class just for a constant. */
private const val BluetoothDevice_TRANSPORT_LE = 2
