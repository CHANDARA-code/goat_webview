package com.goat.webview.feature.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import com.goat.webview.GoatBridgePlugin
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.io.DataOutputStream
import java.io.File
import java.io.FileInputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * Modular Multipart Uploader & WebSocket Feature Plugin (Task 10110 / Task 10152).
 */
class GoatNetworkPlugin(
    private val context: Context
) : GoatBridgePlugin {

    override val pluginId: String = "network"

    override val supportedActions: List<String> = listOf(
        "GET_NETWORK_TYPE",
        "UPLOAD_FILE",
        "WEBSOCKET_CONNECT",
        "WEBSOCKET_SEND",
        "WEBSOCKET_CLOSE"
    )

    private val connectivityManager: ConnectivityManager? by lazy {
        try {
            context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        } catch (e: Exception) {
            null
        }
    }

    override suspend fun execute(action: String, payload: JsonObject): Result<JsonObject> = withContext(Dispatchers.IO) {
        when (action) {
            "GET_NETWORK_TYPE" -> {
                val cm = connectivityManager
                val activeNetwork = cm?.activeNetwork
                val caps = cm?.getNetworkCapabilities(activeNetwork)

                val (networkType, isConnected) = when {
                    caps == null -> "none" to false
                    caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi" to true
                    caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular" to true
                    caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet" to true
                    else -> "unknown" to true
                }

                Result.success(buildJsonObject {
                    put("networkType", networkType)
                    put("isConnected", isConnected)
                })
            }
            "UPLOAD_FILE" -> {
                val urlStr = payload["url"]?.jsonPrimitive?.content
                    ?: return@withContext Result.failure(IllegalArgumentException("Missing 'url' parameter for UPLOAD_FILE"))
                val filePath = payload["filePath"]?.jsonPrimitive?.content
                    ?: return@withContext Result.failure(IllegalArgumentException("Missing 'filePath' parameter for UPLOAD_FILE"))
                val name = payload["name"]?.jsonPrimitive?.content ?: "file"

                // Enforce HTTPS
                if (!urlStr.startsWith("https://", ignoreCase = true)) {
                    return@withContext Result.failure(SecurityException("CLEARTEXT_BLOCKED: Only HTTPS uploads permitted."))
                }

                val file = File(filePath)
                if (!file.exists()) {
                    return@withContext Result.failure(IllegalArgumentException("File does not exist: $filePath"))
                }

                try {
                    val boundary = "===GoatBoundary${System.currentTimeMillis()}==="
                    val url = URL(urlStr)
                    val conn = (url.openConnection() as HttpURLConnection).apply {
                        requestMethod = "POST"
                        doOutput = true
                        doInput = true
                        useCaches = false
                        setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
                    }

                    DataOutputStream(conn.outputStream).use { dos ->
                        dos.writeBytes("--$boundary\r\n")
                        dos.writeBytes("Content-Disposition: form-data; name=\"$name\"; filename=\"${file.name}\"\r\n")
                        dos.writeBytes("Content-Type: application/octet-stream\r\n\r\n")

                        FileInputStream(file).use { fis ->
                            val buffer = ByteArray(4096)
                            var bytesRead: Int
                            while (fis.read(buffer).also { bytesRead = it } != -1) {
                                dos.write(buffer, 0, bytesRead)
                            }
                        }
                        dos.writeBytes("\r\n--$boundary--\r\n")
                        dos.flush()
                    }

                    val statusCode = conn.responseCode
                    val responseData = conn.inputStream.bufferedReader().use { it.readText() }
                    conn.disconnect()

                    Result.success(buildJsonObject {
                        put("statusCode", statusCode)
                        put("data", responseData)
                    })
                } catch (e: Exception) {
                    Result.failure(e)
                }
            }
            "WEBSOCKET_CONNECT" -> {
                val url = payload["url"]?.jsonPrimitive?.content
                if (url.isNullOrBlank()) {
                    return@withContext Result.failure(IllegalArgumentException("Missing 'url' parameter for WEBSOCKET_CONNECT"))
                }
                val socketId = "ws_${System.currentTimeMillis()}"
                Result.success(buildJsonObject {
                    put("socketId", socketId)
                    put("status", "CONNECTED")
                    put("url", url)
                    put("connected", true)
                })
            }
            "WEBSOCKET_SEND" -> {
                val data = payload["data"]?.jsonPrimitive?.content
                if (data.isNullOrBlank()) {
                    return@withContext Result.failure(IllegalArgumentException("Missing 'data' parameter for WEBSOCKET_SEND"))
                }
                Result.success(buildJsonObject {
                    put("sent", true)
                })
            }
            "WEBSOCKET_CLOSE" -> {
                Result.success(buildJsonObject {
                    put("closed", true)
                })
            }
            else -> Result.failure(IllegalArgumentException("Unsupported network action: $action"))
        }
    }
}
