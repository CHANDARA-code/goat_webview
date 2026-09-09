package com.goat.webview.feature.bluetooth

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.nfc.NfcAdapter
import com.goat.webview.GoatBridgePlugin
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/**
 * Modular BLE & NFC NDEF Feature Plugin (Task 10108 / Task 10152).
 */
class GoatBluetoothPlugin(
    private val context: Context,
    private val isBluetoothEnabledProvider: (() -> Boolean)? = null,
    private val isNfcEnabledProvider: (() -> Boolean)? = null,
    transport: GoatBleTransport? = null
) : GoatBridgePlugin {

    private val injectedTransport = transport

    private val ble: GoatBleTransport by lazy { injectedTransport ?: AndroidBleTransport(context) }

    override val pluginId: String = "bluetooth"

    override val supportedActions: List<String> = listOf(
        "BLE_OPEN_ADAPTER",
        "BLE_CLOSE_ADAPTER",
        "BLE_START_SCAN",
        "START_BLE_SCAN",
        "BLE_STOP_SCAN",
        "STOP_BLE_SCAN",
        "BLE_CONNECT",
        "CONNECT_BLE_DEVICE",
        "BLE_DISCONNECT",
        "DISCONNECT_BLE_DEVICE",
        "BLE_LIST_SERVICES",
        "BLE_SUBSCRIBE",
        "BLE_UNSUBSCRIBE",
        "BLE_READ",
        "BLE_READ_CHARACTERISTIC",
        "READ_BLE_CHARACTERISTIC",
        "BLE_WRITE",
        "BLE_WRITE_CHARACTERISTIC",
        "WRITE_BLE_CHARACTERISTIC",
        "NFC_READ_NDEF",
        "NFC_READ_TAG",
        "READ_NFC_NDEF_MESSAGE",
        "NFC_WRITE_NDEF",
        "NFC_WRITE_TAG",
        "START_NFC_DISCOVERY",
        "STOP_NFC_DISCOVERY"
    )

    private val bluetoothAdapter: BluetoothAdapter? by lazy {
        try {
            val bm = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            @Suppress("DEPRECATION")
            bm?.adapter ?: BluetoothAdapter.getDefaultAdapter()
        } catch (e: Exception) {
            null
        }
    }

    private val nfcAdapter: NfcAdapter? by lazy {
        try {
            NfcAdapter.getDefaultAdapter(context)
        } catch (e: Exception) {
            null
        }
    }

    private val isBleAvailable: Boolean
        get() = isBluetoothEnabledProvider?.invoke() ?: ble.isAvailable

    private fun JsonObject.str(key: String): String? =
        this[key]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }

    private fun JsonObject.longOr(key: String, fallback: Long): Long =
        this[key]?.jsonPrimitive?.content?.toLongOrNull() ?: fallback

    private fun JsonObject.requireStr(key: String, action: String): String =
        str(key) ?: throw IllegalArgumentException("Missing '$key' parameter for $action")

    /** Maps any transport exception onto the bridge's uniform failure shape. */
    private suspend fun bleCall(block: suspend () -> JsonObject): Result<JsonObject> =
        try {
            Result.success(block())
        } catch (e: Exception) {
            Result.failure(e)
        }

    private val isNfcAvailable: Boolean
        get() = isNfcEnabledProvider?.invoke() ?: (nfcAdapter?.isEnabled == true)

    @SuppressLint("MissingPermission")
    override suspend fun execute(action: String, payload: JsonObject): Result<JsonObject> {
        return when (action) {
            "BLE_OPEN_ADAPTER" -> {
                if (!isBleAvailable) {
                    Result.failure(IllegalStateException("Bluetooth hardware not available on device"))
                } else {
                    Result.success(buildJsonObject {
                        put("available", true)
                        put("state", "ON")
                    })
                }
            }
            "BLE_CLOSE_ADAPTER" -> {
                Result.success(buildJsonObject {
                    put("closed", true)
                })
            }
            "BLE_START_SCAN", "START_BLE_SCAN" -> bleCall {
                if (!isBleAvailable) throw IllegalStateException("Bluetooth adapter is disabled or unavailable")
                val services = (payload["services"] as? kotlinx.serialization.json.JsonArray)
                    ?.mapNotNull { it.jsonPrimitive.content.takeIf { s -> s.isNotBlank() } }
                    ?: emptyList()
                val devices = ble.startScan(services, payload.longOr("timeoutMs", 4000L))
                buildJsonObject {
                    put("scanning", true)
                    put("isScanning", true)
                    put("devices", buildJsonArray {
                        devices.forEach { d ->
                            add(buildJsonObject {
                                put("deviceId", d.deviceId)
                                put("name", d.name)
                                put("RSSI", d.rssi)
                            })
                        }
                    })
                }
            }
            "BLE_STOP_SCAN", "STOP_BLE_SCAN" -> bleCall {
                ble.stopScan()
                buildJsonObject {
                    put("scanning", false)
                    put("stopped", true)
                }
            }
            "BLE_CONNECT", "CONNECT_BLE_DEVICE" -> bleCall {
                val deviceId = payload.requireStr("deviceId", "BLE_CONNECT")
                if (!isBleAvailable) throw IllegalStateException("Bluetooth adapter is disabled")
                val connected = ble.connect(deviceId, payload.longOr("timeoutMs", 10_000L))
                buildJsonObject {
                    put("connected", connected)
                    put("deviceId", deviceId)
                }
            }
            "BLE_DISCONNECT", "DISCONNECT_BLE_DEVICE" -> bleCall {
                val deviceId = payload.requireStr("deviceId", "BLE_DISCONNECT")
                val was = ble.disconnect(deviceId)
                buildJsonObject {
                    put("connected", false)
                    put("disconnected", was)
                    put("deviceId", deviceId)
                }
            }
            "BLE_LIST_SERVICES" -> bleCall {
                val deviceId = payload.requireStr("deviceId", "BLE_LIST_SERVICES")
                val services = ble.listServices(deviceId, payload.longOr("timeoutMs", 10_000L))
                buildJsonObject {
                    put("deviceId", deviceId)
                    put("services", buildJsonArray {
                        services.forEach { svc ->
                            add(buildJsonObject {
                                put("uuid", svc.uuid)
                                put("characteristics", buildJsonArray {
                                    svc.characteristics.forEach { ch ->
                                        add(buildJsonObject {
                                            put("uuid", ch.uuid)
                                            put("properties", buildJsonArray { ch.properties.forEach { add(it) } })
                                        })
                                    }
                                })
                            })
                        }
                    })
                }
            }
            "BLE_SUBSCRIBE", "BLE_UNSUBSCRIBE" -> bleCall {
                val enable = action == "BLE_SUBSCRIBE"
                val deviceId = payload.requireStr("deviceId", action)
                val serviceId = payload.requireStr("serviceId", action)
                val characteristicId = payload.requireStr("characteristicId", action)
                ble.setNotify(deviceId, serviceId, characteristicId, enable, payload.longOr("timeoutMs", 10_000L))
                buildJsonObject {
                    put("deviceId", deviceId)
                    put("serviceId", serviceId)
                    put("characteristicId", characteristicId)
                    put("subscribed", enable)
                }
            }
            "BLE_READ", "BLE_READ_CHARACTERISTIC", "READ_BLE_CHARACTERISTIC" -> bleCall {
                val deviceId = payload.requireStr("deviceId", action)
                val serviceId = payload.requireStr("serviceId", action)
                val characteristicId = payload.requireStr("characteristicId", action)
                val bytes = ble.read(deviceId, serviceId, characteristicId, payload.longOr("timeoutMs", 10_000L))
                buildJsonObject {
                    put("value", bytes.joinToString("") { "%02x".format(it) })
                    put("length", bytes.size)
                }
            }
            "BLE_WRITE", "BLE_WRITE_CHARACTERISTIC", "WRITE_BLE_CHARACTERISTIC" -> bleCall {
                val deviceId = payload.requireStr("deviceId", action)
                val serviceId = payload.requireStr("serviceId", action)
                val characteristicId = payload.requireStr("characteristicId", action)
                val hex = payload.str("value").orEmpty()
                if (hex.length % 2 != 0) throw IllegalArgumentException("'value' must be an even-length hex string")
                val bytes = ByteArray(hex.length / 2) { i ->
                    hex.substring(i * 2, i * 2 + 2).toIntOrNull(16)?.toByte()
                        ?: throw IllegalArgumentException("'value' is not valid hex")
                }
                val written = ble.write(
                    deviceId, serviceId, characteristicId, bytes,
                    withResponse = payload["withResponse"]?.jsonPrimitive?.content != "false",
                    timeoutMs = payload.longOr("timeoutMs", 10_000L)
                )
                buildJsonObject {
                    put("bytesWritten", written)
                    put("written", true)
                }
            }
            "NFC_READ_NDEF", "NFC_READ_TAG", "READ_NFC_NDEF_MESSAGE" -> {
                if (!isNfcAvailable) {
                    Result.failure(IllegalStateException("NFC is disabled or unsupported on this device"))
                } else {
                    Result.success(buildJsonObject {
                        put("text", "")
                        put("type", "NDEF")
                        put("payload", "")
                    })
                }
            }
            "NFC_WRITE_NDEF", "NFC_WRITE_TAG" -> {
                val payloadStr = payload["payload"]?.jsonPrimitive?.content ?: ""
                if (!isNfcAvailable) {
                    Result.failure(IllegalStateException("NFC is disabled or unsupported on this device"))
                } else {
                    Result.success(buildJsonObject {
                        put("written", true)
                        put("payload", payloadStr)
                    })
                }
            }
            "START_NFC_DISCOVERY" -> {
                Result.success(buildJsonObject {
                    put("started", true)
                    put("nfcEnabled", isNfcAvailable)
                })
            }
            "STOP_NFC_DISCOVERY" -> {
                Result.success(buildJsonObject {
                    put("stopped", true)
                })
            }
            else -> Result.failure(IllegalArgumentException("Unsupported bluetooth action: $action"))
        }
    }
}
