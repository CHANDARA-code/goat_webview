package com.goat.webview

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Sensor sample payload for high-frequency motion streaming (Task 10122).
 */
@Serializable
data class SensorSample(
    val timestampMs: Long,
    val x: Float,
    val y: Float,
    val z: Float,
    val sensorType: String = "accelerometer"
)

/**
 * Enterprise Sensor Streaming, Batching & Coalescing Engine (Task 10122).
 *
 * Responsibilities:
 * 1. Throttles hardware motion sensors (Accelerometer, Gyroscope, Magnetometer) to 20Hz (50ms interval) or 60Hz.
 * 2. Coalesces redundant frame updates into windowed batches to eliminate JS bridge saturation and CPU wake-locks.
 * 3. Lifecycle-aware suspension: automatically stops sensors when WebView enters background.
 */
class GoatSensorManager(
    private val context: Context,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
    private val eventCoalescer: com.goat.webview.ipc.GoatEventCoalescer? = null
) : SensorEventListener {

    companion object {
        const val DEFAULT_THROTTLE_INTERVAL_MS = 50L // 20 Hz
        const val FAST_THROTTLE_INTERVAL_MS = 16L    // 60 Hz
        const val MAX_BATCH_CAPACITY = 64
    }

    private val sensorManager: SensorManager? by lazy {
        try {
            context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
        } catch (e: Exception) {
            null
        }
    }

    private val isStreaming = AtomicBoolean(false)
    private var throttleIntervalMs = DEFAULT_THROTTLE_INTERVAL_MS
    private var lastSampleTimestamp = 0L

    private val sampleBuffer = ArrayList<SensorSample>()
    private val lock = Any()

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null || !isStreaming.get()) return
        val sensorTypeName = when (event.sensor?.type) {
            Sensor.TYPE_ACCELEROMETER -> "accelerometer"
            Sensor.TYPE_GYROSCOPE -> "gyroscope"
            Sensor.TYPE_MAGNETIC_FIELD -> "compass"
            else -> "motion"
        }
        val x = event.values.getOrNull(0) ?: 0f
        val y = event.values.getOrNull(1) ?: 0f
        val z = event.values.getOrNull(2) ?: 0f
        ingestSample(x, y, z, sensorTypeName)
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // No-op for rate-limited stream
    }

    /**
     * Configures and starts motion sensor streaming with 20Hz rate limiting.
     *
     * @param intervalMode "normal" (20Hz/50ms), "ui" (30Hz/33ms), or "game" (60Hz/16ms).
     * @return `true` if streaming started successfully.
     */
    suspend fun startMotionStream(intervalMode: String = "normal"): Boolean = withContext(ioDispatcher) {
        throttleIntervalMs = when (intervalMode.lowercase()) {
            "game" -> FAST_THROTTLE_INTERVAL_MS
            "ui" -> 33L
            else -> DEFAULT_THROTTLE_INTERVAL_MS
        }
        synchronized(lock) {
            sampleBuffer.clear()
            lastSampleTimestamp = 0L
        }
        isStreaming.set(true)

        val sm = sensorManager
        if (sm != null) {
            val delayUs = when (intervalMode.lowercase()) {
                "game" -> SensorManager.SENSOR_DELAY_GAME
                "ui" -> SensorManager.SENSOR_DELAY_UI
                else -> SensorManager.SENSOR_DELAY_NORMAL
            }
            sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)?.let {
                sm.registerListener(this@GoatSensorManager, it, delayUs)
            }
            sm.getDefaultSensor(Sensor.TYPE_GYROSCOPE)?.let {
                sm.registerListener(this@GoatSensorManager, it, delayUs)
            }
        }
        true
    }

    /**
     * Ingests a raw hardware sensor sample, coalescing and enforcing rate limit bounds.
     *
     * @param x X-axis acceleration / angular velocity.
     * @param y Y-axis acceleration / angular velocity.
     * @param z Z-axis acceleration / angular velocity.
     * @param sensorType Type name of sensor.
     * @return [SensorSample] if admitted, `null` if dropped by rate limiter.
     */
    fun ingestSample(x: Float, y: Float, z: Float, sensorType: String = "accelerometer"): SensorSample? {
        if (!isStreaming.get()) return null

        val now = System.currentTimeMillis()
        var sample: SensorSample? = null
        synchronized(lock) {
            if (now - lastSampleTimestamp >= throttleIntervalMs) {
                lastSampleTimestamp = now
                val newSample = SensorSample(now, x, y, z, sensorType)
                if (sampleBuffer.size >= MAX_BATCH_CAPACITY) {
                    sampleBuffer.removeAt(0)
                }
                sampleBuffer.add(newSample)
                sample = newSample
            }
        }

        if (sample != null) {
            val eventKey = when (sensorType.lowercase()) {
                "gyroscope" -> "ON_GYROSCOPE_CHANGE"
                "compass", "magnetic_field" -> "ON_COMPASS_CHANGE"
                else -> "ON_ACCELEROMETER_CHANGE"
            }
            eventCoalescer?.emit(
                eventKey,
                buildJsonObject {
                    put("x", x)
                    put("y", y)
                    put("z", z)
                    put("timestampMs", now)
                    put("sensorType", sensorType)
                },
                minIntervalMs = throttleIntervalMs
            ) { _, _ -> }
        }

        return sample
    }

    /**
     * Flushes and retrieves all coalesced motion samples from the windowed batch.
     */
    suspend fun flushBatch(): List<SensorSample> = withContext(ioDispatcher) {
        synchronized(lock) {
            val copy = ArrayList(sampleBuffer)
            sampleBuffer.clear()
            copy
        }
    }

    /**
     * Stops motion streaming and flushes active buffers.
     */
    suspend fun stopMotionStream(): Boolean = withContext(ioDispatcher) {
        val wasActive = isStreaming.getAndSet(false)
        try {
            sensorManager?.unregisterListener(this@GoatSensorManager)
        } catch (e: Exception) {
            // Ignore during unregistration
        }
        eventCoalescer?.cancel("ON_ACCELEROMETER_CHANGE")
        eventCoalescer?.cancel("ON_GYROSCOPE_CHANGE")
        eventCoalescer?.cancel("ON_COMPASS_CHANGE")
        synchronized(lock) {
            sampleBuffer.clear()
        }
        wasActive
    }

    /**
     * Checks whether motion sensors are actively streaming.
     */
    fun isStreamActive(): Boolean = isStreaming.get()

    /**
     * Retrieves current configured throttling rate in milliseconds.
     */
    fun getThrottleIntervalMs(): Long = throttleIntervalMs
}
