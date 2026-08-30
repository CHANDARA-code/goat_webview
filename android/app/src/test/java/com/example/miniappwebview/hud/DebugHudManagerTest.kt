package com.example.miniappwebview.hud

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.IOException

class DebugHudManagerTest {

    private lateinit var manager: DebugHudManager

    @Before
    fun setUp() {
        manager = DebugHudManager()
    }

    @Test
    fun `test initial manager state is empty`() {
        assertTrue(manager.ipcLogs.value.isEmpty())
        assertFalse(manager.isExpanded.value)
        assertFalse(manager.overrides.value.hasActiveOverrides)
        assertEquals(LatencyStats.EMPTY, manager.getLatencyStats())
    }

    @Test
    fun `test record and clear IPC logs`() {
        val entry1 = HudIpcLogEntry(
            id = "test-1",
            timestamp = System.currentTimeMillis(),
            action = "REQUEST_PAYMENT",
            status = "SUCCESS",
            durationMs = 2.4,
            isWarmPath = true,
            request = buildJsonObject { put("amount", 15.0) },
            response = buildJsonObject { put("txHash", "0x123") }
        )

        manager.recordLog(entry1)
        assertEquals(1, manager.ipcLogs.value.size)
        assertEquals(2.4, manager.lastLatencyMs.value, 0.001)

        val stats = manager.getLatencyStats()
        assertEquals(1, stats.totalCalls)
        assertEquals(1, stats.warmPathCalls)
        assertEquals(100.0, stats.warmPathPercentage, 0.001)
        assertEquals(2.4, stats.avgLatencyMs, 0.001)

        manager.clearLogs()
        assertTrue(manager.ipcLogs.value.isEmpty())
        assertEquals(0.0, manager.lastLatencyMs.value, 0.001)
    }

    @Test
    fun `test latency stats categorization`() {
        manager.recordLog(createSampleEntry("ACT_1", 2.0))  // Warm (<5ms)
        manager.recordLog(createSampleEntry("ACT_2", 4.5))  // Warm (<5ms)
        manager.recordLog(createSampleEntry("ACT_3", 8.0))  // Standard (5-15ms)
        manager.recordLog(createSampleEntry("ACT_4", 20.0)) // Cold (>15ms)

        val stats = manager.getLatencyStats()
        assertEquals(4, stats.totalCalls)
        assertEquals(2, stats.warmPathCalls)
        assertEquals(1, stats.standardCalls)
        assertEquals(1, stats.coldCalls)
        assertEquals(50.0, stats.warmPathPercentage, 0.001)
        assertEquals(2.0, stats.minLatencyMs, 0.001)
        assertEquals(20.0, stats.maxLatencyMs, 0.001)
        assertEquals(8.625, stats.avgLatencyMs, 0.001)
    }

    @Test
    fun `test hardware override offline mode`() = runTest {
        manager.setOffline(true)
        assertTrue(manager.overrides.value.isOffline)
        assertTrue(manager.overrides.value.hasActiveOverrides)

        // Intercept IS_CONNECTED
        val connResult = manager.interceptBridgeAction("IS_CONNECTED", buildJsonObject {}) { _, _ ->
            Result.success(buildJsonObject { put("connected", true) })
        }
        assertTrue(connResult.isSuccess)
        val connJson = connResult.getOrThrow()
        assertEquals("false", connJson["connected"]?.jsonPrimitive?.content)
        assertEquals("true", connJson["mocked"]?.jsonPrimitive?.content)

        // Intercept API_REQUEST
        val apiResult = manager.interceptBridgeAction("API_REQUEST", buildJsonObject { put("url", "https://api.example.com") }) { _, _ ->
            Result.success(buildJsonObject { put("status", 200) })
        }
        assertTrue(apiResult.isFailure)
        assertTrue(apiResult.exceptionOrNull() is IOException)
    }

    @Test
    fun `test hardware override GPS spoofing`() = runTest {
        val spoofedLoc = MockGpsLocation("Tokyo Shibuya", 35.6580, 139.7016, 4.0f)
        manager.setMockGpsEnabled(true)
        manager.setMockGpsLocation(spoofedLoc)

        val result = manager.interceptBridgeAction("GET_LOCATION", buildJsonObject {}) { _, _ ->
            Result.success(buildJsonObject {
                put("latitude", 0.0)
                put("longitude", 0.0)
            })
        }

        assertTrue(result.isSuccess)
        val json = result.getOrThrow()
        assertEquals("35.658", json["latitude"]?.jsonPrimitive?.content)
        assertEquals("139.7016", json["longitude"]?.jsonPrimitive?.content)
        assertEquals("Tokyo Shibuya", json["name"]?.jsonPrimitive?.content)
        assertEquals("true", json["mocked"]?.jsonPrimitive?.content)
    }

    @Test
    fun `test hardware override biometric mocking`() = runTest {
        // 1. Force Success
        manager.setMockBiometrics(BiometricMockMode.FORCE_SUCCESS)
        val authSuccessResult = manager.interceptBridgeAction("BIOMETRIC_AUTH", buildJsonObject {}) { _, _ ->
            Result.failure(Exception("Native auth failed"))
        }
        assertTrue(authSuccessResult.isSuccess)
        val successJson = authSuccessResult.getOrThrow()
        assertEquals("true", successJson["authenticated"]?.jsonPrimitive?.content)
        assertNotNull(successJson["token"])

        // 2. Force Error
        manager.setMockBiometrics(BiometricMockMode.FORCE_ERROR)
        val authErrorResult = manager.interceptBridgeAction("BIOMETRIC_AUTH", buildJsonObject {}) { _, _ ->
            Result.success(buildJsonObject { put("authenticated", true) })
        }
        assertTrue(authErrorResult.isSuccess)
        val errJson = authErrorResult.getOrThrow()
        assertEquals("false", errJson["authenticated"]?.jsonPrimitive?.content)
        assertEquals("100", errJson["errorCode"]?.jsonPrimitive?.content)

        // 3. Locked Out
        manager.setMockBiometrics(BiometricMockMode.LOCKED_OUT)
        val lockoutResult = manager.interceptBridgeAction("BIOMETRIC_AUTH", buildJsonObject {}) { _, _ ->
            Result.success(buildJsonObject { put("authenticated", true) })
        }
        assertTrue(lockoutResult.isSuccess)
        val lockJson = lockoutResult.getOrThrow()
        assertEquals("false", lockJson["authenticated"]?.jsonPrimitive?.content)
        assertEquals("7", lockJson["errorCode"]?.jsonPrimitive?.content)

        // 4. Not Enrolled Check
        manager.setMockBiometrics(BiometricMockMode.NOT_ENROLLED)
        val supportResult = manager.interceptBridgeAction("CHECK_BIOMETRIC_SUPPORT", buildJsonObject {}) { _, _ ->
            Result.success(buildJsonObject { put("supported", true) })
        }
        assertTrue(supportResult.isSuccess)
        val notEnrolledJson = supportResult.getOrThrow()
        assertEquals("false", notEnrolledJson["supported"]?.jsonPrimitive?.content)
        assertEquals("NONE_ENROLLED", notEnrolledJson["reason"]?.jsonPrimitive?.content)
    }

    @Test
    fun `test reset overrides restores clean state`() {
        manager.setOffline(true)
        manager.setMockGpsEnabled(true)
        manager.setMockBiometrics(BiometricMockMode.FORCE_SUCCESS)
        assertTrue(manager.overrides.value.hasActiveOverrides)

        manager.resetOverrides()
        assertFalse(manager.overrides.value.hasActiveOverrides)
        assertFalse(manager.overrides.value.isOffline)
        assertFalse(manager.overrides.value.mockGpsEnabled)
        assertEquals(BiometricMockMode.AUTO, manager.overrides.value.mockBiometrics)
    }

    private fun createSampleEntry(action: String, durationMs: Double): HudIpcLogEntry {
        return HudIpcLogEntry(
            id = "entry-$action",
            timestamp = System.currentTimeMillis(),
            action = action,
            status = "SUCCESS",
            durationMs = durationMs,
            isWarmPath = durationMs < 5.0,
            request = buildJsonObject {}
        )
    }
}
