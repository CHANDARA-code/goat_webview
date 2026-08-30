package com.goat.webview

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GoatApmCollectorTest {

    private lateinit var apmCollector: GoatApmCollector

    @Before
    fun setUp() {
        apmCollector = GoatApmCollector(
            maxRingBufferSize = 5,
            slaFcpThresholdMs = 120.0,
            slaLcpThresholdMs = 2500.0,
            slaBridgeLatencyThresholdMs = 15.0
        )
    }

    @Test
    fun `test recordMetrics normal operation and statistical summary`() = runTest {
        val appId = "com.goat.shop"

        // Report 1: Healthy
        val r1 = apmCollector.recordMetrics(
            appId = appId,
            fcpMs = 45.0,
            lcpMs = 850.0,
            inpMs = 20.0,
            cls = 0.01,
            domCompleteMs = 120.0,
            bridgeLatencyAvgMs = 1.2
        )
        assertFalse(r1.isSlaViolation)

        // Report 2: Healthy
        val r2 = apmCollector.recordMetrics(
            appId = appId,
            fcpMs = 55.0,
            lcpMs = 950.0,
            inpMs = 25.0,
            cls = 0.02,
            domCompleteMs = 140.0,
            bridgeLatencyAvgMs = 1.8
        )
        assertFalse(r2.isSlaViolation)

        val summary = apmCollector.getSummary(appId)
        assertEquals(2L, summary.totalReports)
        assertEquals(50.0, summary.avgFcpMs, 0.001)
        assertEquals(900.0, summary.avgLcpMs, 0.001)
        assertEquals(1.5, summary.avgBridgeLatencyMs, 0.001)
        assertEquals(0L, summary.totalSlaViolations)
    }

    @Test
    fun `test SLA threshold violations detection`() = runTest {
        val appId = "com.goat.slowapp"

        // Exceeds FCP (>120ms) and Bridge Latency (>15ms)
        val violationRecord = apmCollector.recordMetrics(
            appId = appId,
            fcpMs = 250.0,
            lcpMs = 3000.0,
            bridgeLatencyAvgMs = 22.5
        )

        assertTrue(violationRecord.isSlaViolation)
        assertNotNull(violationRecord.violationReason)
        assertTrue(violationRecord.violationReason?.contains("FCP") == true)
        assertTrue(violationRecord.violationReason?.contains("LCP") == true)
        assertTrue(violationRecord.violationReason?.contains("Bridge Latency") == true)

        val summary = apmCollector.getSummary(appId)
        assertEquals(1L, summary.totalSlaViolations)
    }

    @Test
    fun `test ring buffer capacity eviction`() = runTest {
        val appId = "com.goat.evict"

        for (i in 1..8) {
            apmCollector.recordMetrics(appId = appId, fcpMs = i * 10.0)
        }

        val records = apmCollector.getRecentRecords(appId)
        assertEquals(5, records.size) // Buffer size is capped at 5
        assertEquals(40.0, records.first().fcpMs!!, 0.001)
        assertEquals(80.0, records.last().fcpMs!!, 0.001)
    }

    @Test
    fun `test recordFromJson bridge integration`() = runTest {
        val payload = buildJsonObject {
            put("fcpMs", 62.5)
            put("lcpMs", 420.0)
            put("inpMs", 18.0)
            put("cls", 0.005)
            put("domCompleteMs", 85.0)
            put("bridgeLatencyAvgMs", 0.9)
        }

        val record = apmCollector.recordFromJson("com.goat.jsonapp", payload)
        assertEquals(62.5, record.fcpMs!!, 0.001)
        assertEquals(420.0, record.lcpMs!!, 0.001)
        assertEquals(0.9, record.bridgeLatencyAvgMs!!, 0.001)
        assertFalse(record.isSlaViolation)
    }
}
