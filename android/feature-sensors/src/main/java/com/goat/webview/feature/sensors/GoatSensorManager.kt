package com.goat.webview.feature.sensors

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
 *
 * Two stream shapes share one listener. The combined *motion* stream (accelerometer + gyroscope)
 * backs `START_DEVICE_MOTION` and its windowed batch; individual per-sensor streams back
 * `START_ACCELEROMETER` / `START_GYROSCOPE` / `START_COMPASS`. Each sensor type is rate-limited
 * against itself, so two concurrently-registered 20 Hz streams each deliver 20 Hz rather than
 * starving one another.
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

        const val TYPE_ACCELEROMETER = "accelerometer"
        const val TYPE_GYROSCOPE = "gyroscope"
        const val TYPE_COMPASS = "compass"

        fun normalizeType(sensorType: String): String = when (sensorType.lowercase()) {
            "gyroscope", "gyro" -> TYPE_GYROSCOPE
            "compass", "magnetic_field", "magnetometer" -> TYPE_COMPASS
            else -> TYPE_ACCELEROMETER
        }

        fun eventKeyFor(sensorType: String): String = when (normalizeType(sensorType)) {
            TYPE_GYROSCOPE -> "ON_GYROSCOPE_CHANGE"
            TYPE_COMPASS -> "ON_COMPASS_CHANGE"
            else -> "ON_ACCELEROMETER_CHANGE"
        }

        private fun androidSensorFor(sensorType: String): Int = when (normalizeType(sensorType)) {
            TYPE_GYROSCOPE -> Sensor.TYPE_GYROSCOPE
            TYPE_COMPASS -> Sensor.TYPE_MAGNETIC_FIELD
            else -> Sensor.TYPE_ACCELEROMETER
        }
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

    private val activeStreams = HashSet<String>()
    private val lastSampleTimestamps = HashMap<String, Long>()
    private val latestSamples = HashMap<String, SensorSample>()

    private val sampleBuffer = ArrayList<SensorSample>()
    private val lock = Any()

    private fun isSensorTypeActive(sensorType: String): Boolean {
        val type = normalizeType(sensorType)
        val individuallyActive = synchronized(lock) { activeStreams.contains(type) }
        if (individuallyActive) return true
        return isStreaming.get() && (type == TYPE_ACCELEROMETER || type == TYPE_GYROSCOPE)
    }

    private fun anyStreamActive(): Boolean =
        isStreaming.get() || synchronized(lock) { activeStreams.isNotEmpty() }

    private fun delayFor(intervalMode: String): Int = when (intervalMode.lowercase()) {
        "game" -> SensorManager.SENSOR_DELAY_GAME
        "ui" -> SensorManager.SENSOR_DELAY_UI
        else -> SensorManager.SENSOR_DELAY_NORMAL
    }

    private fun throttleFor(intervalMode: String): Long = when (intervalMode.lowercase()) {
        "game" -> FAST_THROTTLE_INTERVAL_MS
        "ui" -> 33L
        else -> DEFAULT_THROTTLE_INTERVAL_MS
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null || !anyStreamActive()) return
        val sensorTypeName = when (event.sensor?.type) {
            Sensor.TYPE_ACCELEROMETER -> TYPE_ACCELEROMETER
            Sensor.TYPE_GYROSCOPE -> TYPE_GYROSCOPE
            Sensor.TYPE_MAGNETIC_FIELD -> TYPE_COMPASS
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
     * Configures and starts the combined motion stream (accelerometer + gyroscope) with 20Hz
     * rate limiting.
     *
     * @param intervalMode "normal" (20Hz/50ms), "ui" (30Hz/33ms), or "game" (60Hz/16ms).
     * @return `true` if streaming started successfully.
     */
    suspend fun startMotionStream(intervalMode: String = "normal"): Boolean = withContext(ioDispatcher) {
        throttleIntervalMs = throttleFor(intervalMode)
        synchronized(lock) {
            sampleBuffer.clear()
            lastSampleTimestamps.remove(TYPE_ACCELEROMETER)
            lastSampleTimestamps.remove(TYPE_GYROSCOPE)
        }
        isStreaming.set(true)

        val sm = sensorManager
        if (sm != null) {
            val delayUs = delayFor(intervalMode)
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
    fun ingestSample(x: Float, y: Float, z: Float, sensorType: String = TYPE_ACCELEROMETER): SensorSample? {
        if (!isSensorTypeActive(sensorType)) return null
        val type = normalizeType(sensorType)

        val now = System.currentTimeMillis()
        var sample: SensorSample? = null
        synchronized(lock) {
            val lastForType = lastSampleTimestamps[type] ?: 0L
            if (now - lastForType >= throttleIntervalMs) {
                lastSampleTimestamps[type] = now
                val newSample = SensorSample(now, x, y, z, type)
                if (sampleBuffer.size >= MAX_BATCH_CAPACITY) {
                    sampleBuffer.removeAt(0)
                }
                sampleBuffer.add(newSample)
                latestSamples[type] = newSample
                sample = newSample
            }
        }

        if (sample != null) {
            eventCoalescer?.emit(
                eventKeyFor(type),
                buildJsonObject {
                    put("x", x)
                    put("y", y)
                    put("z", z)
                    put("timestampMs", now)
                    put("sensorType", type)
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
     * Stops motion streaming and flushes active buffers, leaving any individually-started
     * per-sensor stream registered.
     */
    suspend fun stopMotionStream(): Boolean = withContext(ioDispatcher) {
        val wasActive = isStreaming.getAndSet(false)
        val stillIndividuallyActive = synchronized(lock) { HashSet(activeStreams) }
        try {
            val sm = sensorManager
            if (sm != null) {
                if (!stillIndividuallyActive.contains(TYPE_ACCELEROMETER)) {
                    sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)?.let {
                        sm.unregisterListener(this@GoatSensorManager, it)
                    }
                }
                if (!stillIndividuallyActive.contains(TYPE_GYROSCOPE)) {
                    sm.getDefaultSensor(Sensor.TYPE_GYROSCOPE)?.let {
                        sm.unregisterListener(this@GoatSensorManager, it)
                    }
                }
            }
        } catch (e: Exception) {
            // Ignore during unregistration
        }
        if (!stillIndividuallyActive.contains(TYPE_ACCELEROMETER)) {
            eventCoalescer?.cancel("ON_ACCELEROMETER_CHANGE")
        }
        if (!stillIndividuallyActive.contains(TYPE_GYROSCOPE)) {
            eventCoalescer?.cancel("ON_GYROSCOPE_CHANGE")
        }
        synchronized(lock) {
            sampleBuffer.clear()
            lastSampleTimestamps.remove(TYPE_ACCELEROMETER)
            lastSampleTimestamps.remove(TYPE_GYROSCOPE)
        }
        wasActive
    }

    /**
     * Starts one individual hardware sensor stream, rate-limited independently of every other
     * stream. Backs `START_ACCELEROMETER` / `START_GYROSCOPE` / `START_COMPASS`.
     */
    suspend fun startSensorStream(
        sensorType: String,
        intervalMode: String = "normal"
    ): Boolean = withContext(ioDispatcher) {
        val type = normalizeType(sensorType)
        throttleIntervalMs = throttleFor(intervalMode)
        synchronized(lock) {
            activeStreams.add(type)
            lastSampleTimestamps.remove(type)
        }

        val sm = sensorManager
        if (sm != null) {
            sm.getDefaultSensor(androidSensorFor(type))?.let {
                sm.registerListener(this@GoatSensorManager, it, delayFor(intervalMode))
            }
        }
        true
    }

    /**
     * Stops one individual hardware sensor stream. Returns `false` if it was not running.
     * A sensor still needed by the combined motion stream stays registered.
     */
    suspend fun stopSensorStream(sensorType: String): Boolean = withContext(ioDispatcher) {
        val type = normalizeType(sensorType)
        val wasActive = synchronized(lock) { activeStreams.remove(type) }

        val neededByMotionStream =
            isStreaming.get() && (type == TYPE_ACCELEROMETER || type == TYPE_GYROSCOPE)
        if (!neededByMotionStream) {
            try {
                val sm = sensorManager
                sm?.getDefaultSensor(androidSensorFor(type))?.let {
                    sm.unregisterListener(this@GoatSensorManager, it)
                }
            } catch (e: Exception) {
                // Ignore during unregistration
            }
            eventCoalescer?.cancel(eventKeyFor(type))
        }

        synchronized(lock) {
            lastSampleTimestamps.remove(type)
        }
        wasActive
    }

    /**
     * Latest admitted sample for one sensor type, or `null` if none has been delivered.
     */
    fun getLatestSample(sensorType: String): SensorSample? = synchronized(lock) {
        latestSamples[normalizeType(sensorType)]
    }

    fun isSensorStreamActive(sensorType: String): Boolean =
        synchronized(lock) { activeStreams.contains(normalizeType(sensorType)) }

    suspend fun startCompassStream(intervalMode: String = "normal"): Boolean =
        startSensorStream(TYPE_COMPASS, intervalMode)

    suspend fun stopCompassStream(): Boolean = stopSensorStream(TYPE_COMPASS)

    fun isCompassStreamActive(): Boolean = isSensorStreamActive(TYPE_COMPASS)

    /**
     * Checks whether the combined motion stream is active.
     */
    fun isStreamActive(): Boolean = isStreaming.get()

    /**
     * Retrieves current configured throttling rate in milliseconds.
     */
    fun getThrottleIntervalMs(): Long = throttleIntervalMs
}
