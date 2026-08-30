package com.example.miniappwebview.hud

import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.io.IOException
import java.util.UUID

/**
 * State and Telemetry Controller for the Embedded Floating Developer Debug HUD (R3).
 * Intercepts all bridge IPC dispatches to record real-time timings, compute warm-path metrics,
 * and enforce dynamic hardware overrides (Offline mode, GPS spoofing, Biometric mocking).
 */
class DebugHudManager {

    companion object {
        private const val TAG = "DebugHudManager"
        private const val MAX_LOGS = 500

        val shared = DebugHudManager()
    }

    private val _ipcLogs = MutableStateFlow<List<HudIpcLogEntry>>(emptyList())
    val ipcLogs: StateFlow<List<HudIpcLogEntry>> = _ipcLogs.asStateFlow()

    private val _overrides = MutableStateFlow(HardwareOverrideState())
    val overrides: StateFlow<HardwareOverrideState> = _overrides.asStateFlow()

    private val _isExpanded = MutableStateFlow(false)
    val isExpanded: StateFlow<Boolean> = _isExpanded.asStateFlow()

    private val _activeTab = MutableStateFlow(HudTab.IPC_LOGS)
    val activeTab: StateFlow<HudTab> = _activeTab.asStateFlow()

    private val _lastLatencyMs = MutableStateFlow(0.0)
    val lastLatencyMs: StateFlow<Double> = _lastLatencyMs.asStateFlow()

    fun setExpanded(expanded: Boolean) {
        _isExpanded.value = expanded
    }

    fun setActiveTab(tab: HudTab) {
        _activeTab.value = tab
    }

    fun setOffline(offline: Boolean) {
        _overrides.update { it.copy(isOffline = offline) }
    }

    fun setMockGpsEnabled(enabled: Boolean) {
        _overrides.update { it.copy(mockGpsEnabled = enabled) }
    }

    fun setMockGpsLocation(location: MockGpsLocation) {
        _overrides.update { it.copy(mockGps = location) }
    }

    fun setMockBiometrics(mode: BiometricMockMode) {
        _overrides.update { it.copy(mockBiometrics = mode) }
    }

    fun resetOverrides() {
        _overrides.value = HardwareOverrideState()
    }

    fun clearLogs() {
        _ipcLogs.value = emptyList()
        _lastLatencyMs.value = 0.0
    }

    fun recordLog(entry: HudIpcLogEntry) {
        _lastLatencyMs.value = entry.durationMs
        _ipcLogs.update { current ->
            val updated = listOf(entry) + current
            if (updated.size > MAX_LOGS) updated.take(MAX_LOGS) else updated
        }
    }

    /**
     * Intercepts an IPC action dispatch from the mini-app bridge, measuring latency and
     * executing hardware overrides when active.
     */
    suspend fun interceptBridgeAction(
        action: String,
        payload: JsonObject,
        executeOriginal: suspend (String, JsonObject) -> Result<JsonObject>
    ): Result<JsonObject> {
        val startNano = System.nanoTime()
        val currentOverrides = _overrides.value

        var isMocked = false
        var mockResult: Result<JsonObject>? = null

        // 1. Hardware Override: Offline Mode
        if (currentOverrides.isOffline) {
            when (action) {
                "IS_CONNECTED" -> {
                    isMocked = true
                    mockResult = Result.success(buildJsonObject {
                        put("connected", false)
                        put("type", "none")
                        put("mocked", true)
                    })
                }
                "API_REQUEST", "DOWNLOAD_FILE" -> {
                    isMocked = true
                    mockResult = Result.failure(
                        IOException("Network unreachable: Offline mode simulated by Developer HUD")
                    )
                }
            }
        }

        // 2. Hardware Override: GPS Location Spoofing
        if (mockResult == null && currentOverrides.mockGpsEnabled) {
            when (action) {
                "GET_LOCATION", "CHOOSE_LOCATION" -> {
                    isMocked = true
                    val loc = currentOverrides.mockGps
                    mockResult = Result.success(buildJsonObject {
                        put("latitude", loc.latitude)
                        put("longitude", loc.longitude)
                        put("accuracy", loc.accuracy.toDouble())
                        put("altitude", 15.0)
                        put("speed", 0.0)
                        put("provider", "hud_spoofed_gps")
                        put("name", loc.name)
                        put("mocked", true)
                    })
                }
            }
        }

        // 3. Hardware Override: Biometric Mocking
        if (mockResult == null && currentOverrides.mockBiometrics != BiometricMockMode.AUTO) {
            val mode = currentOverrides.mockBiometrics
            when (action) {
                "CHECK_BIOMETRIC_SUPPORT" -> {
                    isMocked = true
                    mockResult = when (mode) {
                        BiometricMockMode.NOT_ENROLLED -> Result.success(buildJsonObject {
                            put("supported", false)
                            put("biometryType", "none")
                            put("reason", "NONE_ENROLLED")
                            put("mocked", true)
                        })
                        else -> Result.success(buildJsonObject {
                            put("supported", true)
                            put("biometryType", "biometrics")
                            put("status", "BIOMETRIC_SUCCESS")
                            put("mocked", true)
                        })
                    }
                }
                "BIOMETRIC_AUTH" -> {
                    isMocked = true
                    mockResult = when (mode) {
                        BiometricMockMode.FORCE_SUCCESS -> Result.success(buildJsonObject {
                            put("authenticated", true)
                            put("authType", "BIOMETRIC")
                            put("token", "hud_mock_bio_token_${System.currentTimeMillis()}")
                            put("mocked", true)
                        })
                        BiometricMockMode.FORCE_ERROR -> Result.success(buildJsonObject {
                            put("authenticated", false)
                            put("error", "Biometric authentication failed (Simulated in HUD)")
                            put("errorCode", 100)
                            put("mocked", true)
                        })
                        BiometricMockMode.LOCKED_OUT -> Result.success(buildJsonObject {
                            put("authenticated", false)
                            put("error", "Biometrics locked out due to too many failed attempts (Simulated in HUD)")
                            put("errorCode", 7)
                            put("mocked", true)
                        })
                        BiometricMockMode.NOT_ENROLLED -> Result.success(buildJsonObject {
                            put("authenticated", false)
                            put("error", "No biometric credentials registered (Simulated in HUD)")
                            put("errorCode", 11)
                            put("mocked", true)
                        })
                        BiometricMockMode.AUTO -> null
                    }
                }
            }
        }

        // 4. Fallback to genuine native execution if not intercepted
        val finalResult = mockResult ?: executeOriginal(action, payload)

        val endNano = System.nanoTime()
        val durationMs = (endNano - startNano) / 1_000_000.0

        // Create log record
        val statusStr = when {
            isMocked -> "MOCKED"
            finalResult.isSuccess -> "SUCCESS"
            else -> "ERROR"
        }

        val logEntry = HudIpcLogEntry(
            id = "ipc-${System.currentTimeMillis()}-${UUID.randomUUID().toString().take(6)}",
            timestamp = System.currentTimeMillis(),
            action = action,
            status = statusStr,
            durationMs = durationMs,
            isWarmPath = durationMs < 5.0,
            request = payload,
            response = finalResult.getOrNull(),
            error = finalResult.exceptionOrNull()?.message
        )

        recordLog(logEntry)
        Log.d(TAG, "HUD IPC: $action in ${"%.2f".format(durationMs)}ms (status=$statusStr, warm=${logEntry.isWarmPath})")

        return finalResult
    }

    /**
     * Computes real-time latency statistics across all recorded IPC logs.
     */
    fun getLatencyStats(): LatencyStats {
        val logs = _ipcLogs.value
        if (logs.isEmpty()) return LatencyStats.EMPTY

        val total = logs.size
        var warm = 0
        var std = 0
        var cold = 0
        var sum = 0.0
        var min = Double.MAX_VALUE
        var max = 0.0

        for (log in logs) {
            val d = log.durationMs
            sum += d
            if (d < min) min = d
            if (d > max) max = d

            when {
                d < 5.0 -> warm++
                d <= 15.0 -> std++
                else -> cold++
            }
        }

        val warmPct = if (total > 0) (warm.toDouble() / total) * 100.0 else 100.0
        val avg = if (total > 0) sum / total else 0.0

        return LatencyStats(
            totalCalls = total,
            warmPathCalls = warm,
            standardCalls = std,
            coldCalls = cold,
            warmPathPercentage = warmPct,
            avgLatencyMs = avg,
            minLatencyMs = if (min == Double.MAX_VALUE) 0.0 else min,
            maxLatencyMs = max
        )
    }
}
