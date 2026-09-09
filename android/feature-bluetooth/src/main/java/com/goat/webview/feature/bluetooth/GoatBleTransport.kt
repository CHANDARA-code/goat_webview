package com.goat.webview.feature.bluetooth

/** A BLE peripheral seen during a scan. */
data class BleDevice(
    val deviceId: String,
    val name: String,
    val rssi: Int
)

/** One GATT characteristic and the operations it advertises. */
data class BleCharacteristic(
    val uuid: String,
    val properties: List<String>
)

/** One GATT service and its characteristics. */
data class BleService(
    val uuid: String,
    val characteristics: List<BleCharacteristic>
)

/**
 * The GATT operations the bluetooth plugin needs, behind an interface so the plugin can be unit
 * tested without hardware. [AndroidBleTransport] is the real implementation; tests inject a fake.
 *
 * Every method reports failure by throwing, so the plugin can map exceptions onto the bridge's
 * `Result.failure` uniformly rather than each call site inventing a sentinel.
 */
interface GoatBleTransport {

    val isAvailable: Boolean

    suspend fun startScan(serviceUuids: List<String>, timeoutMs: Long): List<BleDevice>

    fun stopScan()

    suspend fun connect(deviceId: String, timeoutMs: Long): Boolean

    suspend fun disconnect(deviceId: String): Boolean

    suspend fun listServices(deviceId: String, timeoutMs: Long): List<BleService>

    suspend fun read(deviceId: String, serviceUuid: String, characteristicUuid: String, timeoutMs: Long): ByteArray

    suspend fun write(
        deviceId: String,
        serviceUuid: String,
        characteristicUuid: String,
        value: ByteArray,
        withResponse: Boolean,
        timeoutMs: Long
    ): Int

    suspend fun setNotify(
        deviceId: String,
        serviceUuid: String,
        characteristicUuid: String,
        enable: Boolean,
        timeoutMs: Long
    ): Boolean
}
