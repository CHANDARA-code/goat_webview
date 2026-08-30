package com.goat.webview

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
}
