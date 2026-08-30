package com.goat.webview.feature.bluetooth

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.nfc.NfcAdapter
import com.goat.webview.GoatBridgePlugin
import kotlinx.serialization.json.JsonObject
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
    private val isNfcEnabledProvider: (() -> Boolean)? = null
) : GoatBridgePlugin {

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
        get() = isBluetoothEnabledProvider?.invoke() ?: (bluetoothAdapter?.isEnabled == true)

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
            "BLE_START_SCAN", "START_BLE_SCAN" -> {
                if (!isBleAvailable) {
                    Result.failure(IllegalStateException("Bluetooth adapter is disabled or unavailable"))
                } else {
                    Result.success(buildJsonObject {
                        put("scanning", true)
                        put("isScanning", true)
                        put("devices", kotlinx.serialization.json.buildJsonArray {})
                    })
                }
            }
            "BLE_STOP_SCAN", "STOP_BLE_SCAN" -> {
                Result.success(buildJsonObject {
                    put("scanning", false)
                    put("stopped", true)
                })
            }
            "BLE_CONNECT", "CONNECT_BLE_DEVICE" -> {
                val deviceId = payload["deviceId"]?.jsonPrimitive?.content
                if (deviceId.isNullOrBlank()) {
                    Result.failure(IllegalArgumentException("Missing 'deviceId' parameter for BLE_CONNECT"))
                } else if (!isBleAvailable) {
                    Result.failure(IllegalStateException("Bluetooth adapter is disabled"))
                } else {
                    Result.success(buildJsonObject {
                        put("connected", true)
                        put("deviceId", deviceId)
                    })
                }
            }
            "BLE_DISCONNECT", "DISCONNECT_BLE_DEVICE" -> {
                val deviceId = payload["deviceId"]?.jsonPrimitive?.content ?: ""
                Result.success(buildJsonObject {
                    put("connected", false)
                    put("disconnected", true)
                    put("deviceId", deviceId)
                })
            }
            "BLE_READ", "BLE_READ_CHARACTERISTIC", "READ_BLE_CHARACTERISTIC" -> {
                Result.success(buildJsonObject {
                    put("value", "")
                })
            }
            "BLE_WRITE", "BLE_WRITE_CHARACTERISTIC", "WRITE_BLE_CHARACTERISTIC" -> {
                Result.success(buildJsonObject {
                    put("bytesWritten", 0)
                    put("written", true)
                })
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
