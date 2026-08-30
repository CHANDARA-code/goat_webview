package com.goat.webview

import android.util.Log
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicLong

/**
 * Data model for captured Core Web Vitals and bridge latency metrics (Task 10124).
 */
@Serializable
data class ApmMetricRecord(
    val id: String,
    val appId: String,
    val timestampMs: Long = System.currentTimeMillis(),
    val fcpMs: Double? = null,
    val lcpMs: Double? = null,
    val inpMs: Double? = null,
    val cls: Double? = null,
    val domCompleteMs: Double? = null,
    val bridgeLatencyAvgMs: Double? = null,
    val isSlaViolation: Boolean = false,
    val violationReason: String? = null
)

/**
 * APM statistical summary aggregated across metric reports.
 */
@Serializable
data class ApmSummary(
    val totalReports: Long,
    val avgFcpMs: Double,
    val avgLcpMs: Double,
    val avgBridgeLatencyMs: Double,
    val totalSlaViolations: Long
)

/**
 * High-performance, low-overhead in-engine Application Performance Monitoring (APM) collector.
 */
class GoatApmCollector(
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
    private val maxRingBufferSize: Int = 100,
    private val slaFcpThresholdMs: Double = 120.0,
    private val slaLcpThresholdMs: Double = 2500.0,
    private val slaBridgeLatencyThresholdMs: Double = 15.0
) {

    companion object {
        private const val TAG = "GoatApmCollector"
    }

    private val ringBuffer = ConcurrentLinkedQueue<ApmMetricRecord>()
    private val totalReportCounter = AtomicLong(0)
    private val totalViolationCounter = AtomicLong(0)

    /**
     * Ingests a new telemetry metric record asynchronously.
     */
    suspend fun recordMetrics(
        appId: String,
        fcpMs: Double? = null,
        lcpMs: Double? = null,
        inpMs: Double? = null,
        cls: Double? = null,
        domCompleteMs: Double? = null,
        bridgeLatencyAvgMs: Double? = null
    ): ApmMetricRecord = withContext(ioDispatcher) {
        val violations = mutableListOf<String>()

        if (fcpMs != null && fcpMs > slaFcpThresholdMs) {
            violations.add("FCP (${fcpMs}ms > ${slaFcpThresholdMs}ms)")
        }
        if (lcpMs != null && lcpMs > slaLcpThresholdMs) {
            violations.add("LCP (${lcpMs}ms > ${slaLcpThresholdMs}ms)")
        }
        if (bridgeLatencyAvgMs != null && bridgeLatencyAvgMs > slaBridgeLatencyThresholdMs) {
            violations.add("Bridge Latency (${bridgeLatencyAvgMs}ms > ${slaBridgeLatencyThresholdMs}ms)")
        }

        val isViolation = violations.isNotEmpty()
        if (isViolation) {
            totalViolationCounter.incrementAndGet()
            Log.w(TAG, "APM SLA Violation for appId=$appId: ${violations.joinToString(", ")}")
        }

        val record = ApmMetricRecord(
            id = "apm_${System.currentTimeMillis()}_${totalReportCounter.incrementAndGet()}",
            appId = appId,
            timestampMs = System.currentTimeMillis(),
            fcpMs = fcpMs,
            lcpMs = lcpMs,
            inpMs = inpMs,
            cls = cls,
            domCompleteMs = domCompleteMs,
            bridgeLatencyAvgMs = bridgeLatencyAvgMs,
            isSlaViolation = isViolation,
            violationReason = if (isViolation) violations.joinToString("; ") else null
        )

        ringBuffer.add(record)
        while (ringBuffer.size > maxRingBufferSize) {
            ringBuffer.poll()
        }

        record
    }

    /**
     * Parses and ingests a JSON payload from a bridge IPC event.
     */
    suspend fun recordFromJson(appId: String, payload: JsonObject): ApmMetricRecord = withContext(ioDispatcher) {
        val fcp = payload["fcpMs"]?.jsonPrimitive?.doubleOrNull
        val lcp = payload["lcpMs"]?.jsonPrimitive?.doubleOrNull
        val inp = payload["inpMs"]?.jsonPrimitive?.doubleOrNull
        val cls = payload["cls"]?.jsonPrimitive?.doubleOrNull
        val dom = payload["domCompleteMs"]?.jsonPrimitive?.doubleOrNull
        val bridgeLat = payload["bridgeLatencyAvgMs"]?.jsonPrimitive?.doubleOrNull

        recordMetrics(
            appId = appId,
            fcpMs = fcp,
            lcpMs = lcp,
            inpMs = inp,
            cls = cls,
            domCompleteMs = dom,
            bridgeLatencyAvgMs = bridgeLat
        )
    }

    /**
     * Retrieves all cached metric records from the in-memory ring buffer.
     */
    suspend fun getRecentRecords(appId: String? = null): List<ApmMetricRecord> = withContext(ioDispatcher) {
        if (appId == null) {
            ringBuffer.toList()
        } else {
            ringBuffer.filter { it.appId == appId }
        }
    }

    /**
     * Generates aggregated summary statistics across collected metrics.
     */
    suspend fun getSummary(appId: String? = null): ApmSummary = withContext(ioDispatcher) {
        val records = getRecentRecords(appId)
        val count = records.size.toLong()

        if (count == 0L) {
            return@withContext ApmSummary(0, 0.0, 0.0, 0.0, 0)
        }

        val fcpValues = records.mapNotNull { it.fcpMs }
        val lcpValues = records.mapNotNull { it.lcpMs }
        val bridgeValues = records.mapNotNull { it.bridgeLatencyAvgMs }
        val violationCount = records.count { it.isSlaViolation }.toLong()

        ApmSummary(
            totalReports = count,
            avgFcpMs = if (fcpValues.isNotEmpty()) fcpValues.average() else 0.0,
            avgLcpMs = if (lcpValues.isNotEmpty()) lcpValues.average() else 0.0,
            avgBridgeLatencyMs = if (bridgeValues.isNotEmpty()) bridgeValues.average() else 0.0,
            totalSlaViolations = violationCount
        )
    }

    /**
     * Clears all buffered APM metric history.
     */
    suspend fun clear() = withContext(ioDispatcher) {
        ringBuffer.clear()
        totalReportCounter.set(0)
        totalViolationCounter.set(0)
    }
}
