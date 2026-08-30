package com.goat.webview

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Unit test suite for GoatStartupBenchmark (Task 10085).
 */
class GoatStartupBenchmarkTest {

    private lateinit var benchmark: GoatStartupBenchmark

    @Before
    fun setUp() {
        benchmark = GoatStartupBenchmark(
            coldBootSlaMs = 120L,
            warmBootSlaMs = 15L,
            memoryDeltaSlaMb = 45.0
        )
    }

    @Test
    fun `test initial report is empty and within SLA default`() {
        val report = benchmark.generateReport()
        assertEquals(0L, report.coldStartTimeMs)
        assertEquals(0L, report.warmStartTimeMs)
        assertTrue(report.isColdBootWithinSla)
        assertTrue(report.isWarmBootWithinSla)
        assertTrue(report.isMemoryWithinSla)
    }

    @Test
    fun `test sample within SLA passes compliance check`() {
        benchmark.recordStartupSample(coldDurationMs = 85L, warmDurationMs = 12L, memoryBytes = 30L * 1024 * 1024)
        val report = benchmark.generateReport()
        assertEquals(85L, report.coldStartTimeMs)
        assertEquals(12L, report.warmStartTimeMs)
        assertEquals(30.0, report.memoryDeltaMb, 0.01)
        assertTrue(report.isColdBootWithinSla)
        assertTrue(report.isWarmBootWithinSla)
        assertTrue(report.isMemoryWithinSla)
        assertEquals(1, report.totalSamples)
    }

    @Test
    fun `test sample exceeding SLA flags compliance failure`() {
        benchmark.recordStartupSample(coldDurationMs = 180L, warmDurationMs = 25L, memoryBytes = 60L * 1024 * 1024)
        val report = benchmark.generateReport()
        assertFalse(report.isColdBootWithinSla)
        assertFalse(report.isWarmBootWithinSla)
        assertFalse(report.isMemoryWithinSla)
    }
}
