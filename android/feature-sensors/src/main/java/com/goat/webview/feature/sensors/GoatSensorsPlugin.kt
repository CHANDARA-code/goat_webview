package com.goat.webview.feature.sensors

import android.content.Context
import com.goat.webview.GoatBridgePlugin
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/**
 * Domain 6 (Hardware Sensors & Motion) as a standalone feature module.
 *
 * Extracted from the core dispatcher so a host app that never touches motion data links none of
 * this. Every action here is backed by [GoatSensorManager] and real `android.hardware` registration
 * — the per-sensor actions were previously stubs in core that returned canned success (and, for
 * `GET_LATEST_*`, hardcoded vectors) without ever registering a listener.
 */
class GoatSensorsPlugin(
    private val context: Context,
    private val sensorManager: GoatSensorManager? = null,
    eventCoalescer: com.goat.webview.ipc.GoatEventCoalescer? = null
) : GoatBridgePlugin {

    private val injectedCoalescer = eventCoalescer

    private val manager: GoatSensorManager by lazy {
        sensorManager ?: GoatSensorManager(context, eventCoalescer = injectedCoalescer)
    }

    override val pluginId: String = "sensors"

    override val supportedActions: List<String> = listOf(
        "START_ACCELEROMETER",
        "STOP_ACCELEROMETER",
        "GET_LATEST_ACCELEROMETER",
        "START_GYROSCOPE",
        "STOP_GYROSCOPE",
        "GET_LATEST_GYROSCOPE",
        "START_COMPASS",
        "STOP_COMPASS",
        "START_DEVICE_MOTION",
        "STOP_DEVICE_MOTION",
        "GET_LATEST_DEVICE_MOTION"
    )

    private fun interval(payload: JsonObject): String =
        payload["interval"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() } ?: "normal"

    private suspend fun start(sensorType: String, payload: JsonObject): Result<JsonObject> {
        val mode = interval(payload)
        val started = manager.startSensorStream(sensorType, mode)
        return Result.success(buildJsonObject {
            put("started", started)
            put("interval", mode)
        })
    }

    private suspend fun stop(sensorType: String): Result<JsonObject> {
        val stopped = manager.stopSensorStream(sensorType)
        return Result.success(buildJsonObject { put("stopped", stopped) })
    }

    private fun latest(sensorType: String): Result<JsonObject> {
        val sample = manager.getLatestSample(sensorType)
        return Result.success(buildJsonObject {
            put("x", sample?.x ?: 0.0f)
            put("y", sample?.y ?: 0.0f)
            put("z", sample?.z ?: 0.0f)
            put("timestampMs", sample?.timestampMs ?: System.currentTimeMillis())
            put("hasSample", sample != null)
        })
    }

    override suspend fun execute(action: String, payload: JsonObject): Result<JsonObject> {
        return when (action) {
            "START_ACCELEROMETER" -> start(GoatSensorManager.TYPE_ACCELEROMETER, payload)
            "STOP_ACCELEROMETER" -> stop(GoatSensorManager.TYPE_ACCELEROMETER)
            "GET_LATEST_ACCELEROMETER" -> latest(GoatSensorManager.TYPE_ACCELEROMETER)

            "START_GYROSCOPE" -> start(GoatSensorManager.TYPE_GYROSCOPE, payload)
            "STOP_GYROSCOPE" -> stop(GoatSensorManager.TYPE_GYROSCOPE)
            "GET_LATEST_GYROSCOPE" -> latest(GoatSensorManager.TYPE_GYROSCOPE)

            "START_COMPASS" -> start(GoatSensorManager.TYPE_COMPASS, payload)
            "STOP_COMPASS" -> stop(GoatSensorManager.TYPE_COMPASS)

            "START_DEVICE_MOTION" -> {
                val mode = interval(payload)
                val started = manager.startMotionStream(mode)
                Result.success(buildJsonObject {
                    put("started", started)
                    put("interval", mode)
                })
            }
            "STOP_DEVICE_MOTION" -> {
                val stopped = manager.stopMotionStream()
                Result.success(buildJsonObject { put("stopped", stopped) })
            }
            "GET_LATEST_DEVICE_MOTION" -> {
                val samples = manager.flushBatch()
                val latestSample = samples.lastOrNull()
                Result.success(buildJsonObject {
                    put("isStreaming", manager.isStreamActive())
                    put("x", latestSample?.x ?: 0.0f)
                    put("y", latestSample?.y ?: 0.0f)
                    put("z", latestSample?.z ?: 0.0f)
                    put("timestampMs", latestSample?.timestampMs ?: System.currentTimeMillis())
                })
            }

            else -> Result.failure(IllegalArgumentException("Unsupported sensors action: $action"))
        }
    }
}
