package com.goat.webview.feature.sensors

import android.content.Context
import android.content.ContextWrapper
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GoatSensorManagerTest {

    private lateinit var fakeContext: FakeTestContext
    private lateinit var sensorManager: GoatSensorManager

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
    }

    @Before
    fun setUp() {
        fakeContext = FakeTestContext()
        sensorManager = GoatSensorManager(fakeContext)
    }

    @Test
    fun testStartAndStopMotionStream() = runTest {
        assertFalse(sensorManager.isStreamActive())

        val started = sensorManager.startMotionStream("normal")
        assertTrue(started)
        assertTrue(sensorManager.isStreamActive())
        assertEquals(50L, sensorManager.getThrottleIntervalMs())

        val stopped = sensorManager.stopMotionStream()
        assertTrue(stopped)
        assertFalse(sensorManager.isStreamActive())
    }

    @Test
    fun testDifferentIntervalModes() = runTest {
        sensorManager.startMotionStream("game")
        assertEquals(16L, sensorManager.getThrottleIntervalMs())

        sensorManager.startMotionStream("ui")
        assertEquals(33L, sensorManager.getThrottleIntervalMs())

        sensorManager.startMotionStream("normal")
        assertEquals(50L, sensorManager.getThrottleIntervalMs())
    }

    @Test
    fun testSampleIngestionAndThrottling() = runTest {
        sensorManager.startMotionStream("normal")

        // First sample should be admitted
        val sample1 = sensorManager.ingestSample(0.1f, 9.8f, 0.2f)
        assertNotNull(sample1)
        assertEquals(0.1f, sample1!!.x)

        // Rapid second sample within 50ms should be dropped
        val sample2 = sensorManager.ingestSample(0.2f, 9.7f, 0.3f)
        assertNull(sample2)

        // Batch flushing
        val batch = sensorManager.flushBatch()
        assertEquals(1, batch.size)

        // After flushing, buffer is empty
        val emptyBatch = sensorManager.flushBatch()
        assertTrue(emptyBatch.isEmpty())
    }

    @Test
    fun testStartAndStopCompassStream() = runTest {
        assertFalse(sensorManager.isCompassStreamActive())

        assertTrue(sensorManager.startCompassStream("normal"))
        assertTrue(sensorManager.isCompassStreamActive())

        assertTrue(sensorManager.stopCompassStream())
        assertFalse(sensorManager.isCompassStreamActive())

        // Stopping an already-stopped stream reports that it was not active.
        assertFalse(sensorManager.stopCompassStream())
    }

    @Test
    fun testCompassSamplesAreRejectedUntilTheCompassStreamStarts() = runTest {
        assertNull(sensorManager.ingestSample(1f, 2f, 3f, "compass"))

        sensorManager.startCompassStream("normal")
        assertNotNull(sensorManager.ingestSample(1f, 2f, 3f, "compass"))

        sensorManager.stopCompassStream()
        assertNull(sensorManager.ingestSample(4f, 5f, 6f, "compass"))
    }

    @Test
    fun testCompassAndMotionStreamsThrottleIndependently() = runTest {
        sensorManager.startMotionStream("normal")
        sensorManager.startCompassStream("normal")

        // A compass sample must not consume the accelerometer's rate-limit window.
        assertNotNull(sensorManager.ingestSample(0.1f, 9.8f, 0.2f, "accelerometer"))
        assertNotNull(sensorManager.ingestSample(1f, 2f, 3f, "compass"))

        // ...and each type is still throttled against itself.
        assertNull(sensorManager.ingestSample(0.3f, 9.6f, 0.4f, "accelerometer"))
        assertNull(sensorManager.ingestSample(4f, 5f, 6f, "compass"))
    }

    @Test
    fun testStoppingMotionStreamLeavesTheCompassStreamRunning() = runTest {
        sensorManager.startMotionStream("normal")
        sensorManager.startCompassStream("normal")

        sensorManager.stopMotionStream()

        assertFalse(sensorManager.isStreamActive())
        assertTrue(sensorManager.isCompassStreamActive())
        assertNotNull(sensorManager.ingestSample(1f, 2f, 3f, "compass"))
    }

    @Test
    fun testIndividualSensorStreamsAreIndependent() = runTest {
        assertNull(sensorManager.ingestSample(1f, 1f, 1f, "gyroscope"))

        sensorManager.startSensorStream("gyroscope")
        assertTrue(sensorManager.isSensorStreamActive("gyroscope"))
        assertFalse(sensorManager.isSensorStreamActive("accelerometer"))

        assertNotNull(sensorManager.ingestSample(1f, 1f, 1f, "gyroscope"))
        // Accelerometer was never started, so its samples stay rejected.
        assertNull(sensorManager.ingestSample(2f, 2f, 2f, "accelerometer"))

        assertTrue(sensorManager.stopSensorStream("gyroscope"))
        assertFalse(sensorManager.isSensorStreamActive("gyroscope"))
    }

    @Test
    fun testGetLatestSampleReturnsTheLastAdmittedValuePerType() = runTest {
        assertNull(sensorManager.getLatestSample("accelerometer"))

        sensorManager.startSensorStream("accelerometer")
        sensorManager.ingestSample(1.5f, 2.5f, 3.5f, "accelerometer")

        val latest = sensorManager.getLatestSample("accelerometer")
        assertNotNull(latest)
        assertEquals(1.5f, latest!!.x)
        assertEquals(2.5f, latest.y)
        assertEquals(3.5f, latest.z)

        // A type that never streamed still has no sample.
        assertNull(sensorManager.getLatestSample("gyroscope"))
    }

    @Test
    fun testSensorTypeAliasesNormalize() = runTest {
        sensorManager.startSensorStream("magnetometer")
        assertTrue(sensorManager.isCompassStreamActive())
        assertNotNull(sensorManager.ingestSample(1f, 2f, 3f, "magnetic_field"))
    }
}
