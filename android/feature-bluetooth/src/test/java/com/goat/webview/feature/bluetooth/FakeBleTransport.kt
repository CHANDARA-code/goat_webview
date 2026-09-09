package com.goat.webview.feature.bluetooth

/**
 * Records what the plugin asked the GATT layer to do, so the action wiring can be asserted without
 * hardware. The real behaviour lives in [AndroidBleTransport], which needs a device.
 */
class FakeBleTransport(
    override val isAvailable: Boolean = true,
    private val services: List<BleService> = emptyList(),
    private val readValue: ByteArray = byteArrayOf(0x47, 0x6f, 0x61, 0x74),
    private val devices: List<BleDevice> = listOf(BleDevice("AA:BB:CC:DD:EE:FF", "Goat Sensor", -55)),
    private val failWith: Exception? = null
) : GoatBleTransport {

    var scanCalls = 0
    var stopScanCalls = 0
    var lastScanServices: List<String> = emptyList()
    var connected = mutableListOf<String>()
    var disconnected = mutableListOf<String>()
    var listServicesFor: String? = null
    var lastNotify: Triple<String, String, Boolean>? = null
    var lastWrite: ByteArray? = null
    var lastWriteWithResponse: Boolean? = null

    private fun boom() { failWith?.let { throw it } }

    override suspend fun startScan(serviceUuids: List<String>, timeoutMs: Long): List<BleDevice> {
        boom()
        scanCalls++
        lastScanServices = serviceUuids
        return devices
    }

    override fun stopScan() { stopScanCalls++ }

    override suspend fun connect(deviceId: String, timeoutMs: Long): Boolean {
        boom()
        connected += deviceId
        return true
    }

    override suspend fun disconnect(deviceId: String): Boolean {
        boom()
        disconnected += deviceId
        return true
    }

    override suspend fun listServices(deviceId: String, timeoutMs: Long): List<BleService> {
        boom()
        listServicesFor = deviceId
        return services
    }

    override suspend fun read(
        deviceId: String,
        serviceUuid: String,
        characteristicUuid: String,
        timeoutMs: Long
    ): ByteArray {
        boom()
        return readValue
    }

    override suspend fun write(
        deviceId: String,
        serviceUuid: String,
        characteristicUuid: String,
        value: ByteArray,
        withResponse: Boolean,
        timeoutMs: Long
    ): Int {
        boom()
        lastWrite = value
        lastWriteWithResponse = withResponse
        return value.size
    }

    override suspend fun setNotify(
        deviceId: String,
        serviceUuid: String,
        characteristicUuid: String,
        enable: Boolean,
        timeoutMs: Long
    ): Boolean {
        boom()
        lastNotify = Triple(deviceId, characteristicUuid, enable)
        return true
    }
}
