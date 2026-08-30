package com.example.miniappwebview.hud

import androidx.compose.ui.graphics.Color
import kotlinx.serialization.json.JsonObject

/**
 * Latency grading threshold complying with R3 specifications:
 * - Warm-Path: < 5ms (Green #10B981)
 * - Standard: 5 - 15ms (Amber #F59E0B)
 * - Slow/Cold: > 15ms (Red #EF4444)
 */
enum class LatencyGrade(
    val label: String,
    val color: Color,
    val badgeBgColor: Color,
    val description: String
) {
    WARM_PATH(
        label = "WARM (<5ms)",
        color = Color(0xFF10B981),
        badgeBgColor = Color(0xFF064E3B),
        description = "Sub-5ms warm-path optimized memory bridge"
    ),
    STANDARD(
        label = "STD (5-15ms)",
        color = Color(0xFFF59E0B),
        badgeBgColor = Color(0xFF78350F),
        description = "Standard bridge response time"
    ),
    COLD(
        label = "COLD (>15ms)",
        color = Color(0xFFEF4444),
        badgeBgColor = Color(0xFF7F1D1D),
        description = "Cold load or heavy computation"
    );

    companion object {
        fun fromDuration(durationMs: Double): LatencyGrade {
            return when {
                durationMs < 5.0 -> WARM_PATH
                durationMs <= 15.0 -> STANDARD
                else -> COLD
            }
        }
    }
}

/**
 * Biometric Mocking Modes for Developer HUD hardware override panel.
 */
enum class BiometricMockMode(val label: String, val description: String) {
    AUTO(
        label = "Real Hardware",
        description = "Use real AndroidX BiometricPrompt and biometric hardware"
    ),
    FORCE_SUCCESS(
        label = "Force Success",
        description = "Instantly return successful biometric authentication"
    ),
    FORCE_ERROR(
        label = "Force Error",
        description = "Simulate user cancellation or biometric match failure"
    ),
    LOCKED_OUT(
        label = "Locked Out",
        description = "Simulate temporary hardware lockout (too many failed attempts)"
    ),
    NOT_ENROLLED(
        label = "Not Enrolled",
        description = "Simulate device with no registered biometric credentials"
    )
}

/**
 * GPS Location payload for location spoofing in HUD.
 */
data class MockGpsLocation(
    val name: String,
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float = 5.0f
) {
    companion object {
        val PRESETS = listOf(
            MockGpsLocation("San Francisco HQ", 37.7749, -122.4194, 3.5f),
            MockGpsLocation("Tokyo Shibuya", 35.6580, 139.7016, 4.0f),
            MockGpsLocation("London Tower", 51.5055, -0.0754, 5.0f),
            MockGpsLocation("Phnom Penh Vattanac", 11.5724, 104.9202, 2.5f),
            MockGpsLocation("Singapore Marina Bay", 1.2838, 103.8591, 3.0f)
        )
    }
}

/**
 * Hardware Overrides state container.
 */
data class HardwareOverrideState(
    val isOffline: Boolean = false,
    val mockGpsEnabled: Boolean = false,
    val mockGps: MockGpsLocation = MockGpsLocation.PRESETS[0],
    val mockBiometrics: BiometricMockMode = BiometricMockMode.AUTO
) {
    val hasActiveOverrides: Boolean
        get() = isOffline || mockGpsEnabled || mockBiometrics != BiometricMockMode.AUTO
}

/**
 * Immutable log record for real-time IPC message inspection (R3).
 */
data class HudIpcLogEntry(
    val id: String,
    val timestamp: Long,
    val action: String,
    val status: String, // SUCCESS, ERROR, MOCKED
    val durationMs: Double,
    val isWarmPath: Boolean,
    val request: JsonObject,
    val response: JsonObject? = null,
    val error: String? = null
) {
    val latencyGrade: LatencyGrade
        get() = LatencyGrade.fromDuration(durationMs)
}

/**
 * Real-time APM Latency Statistics.
 */
data class LatencyStats(
    val totalCalls: Int,
    val warmPathCalls: Int,
    val standardCalls: Int,
    val coldCalls: Int,
    val warmPathPercentage: Double,
    val avgLatencyMs: Double,
    val minLatencyMs: Double,
    val maxLatencyMs: Double
) {
    companion object {
        val EMPTY = LatencyStats(
            totalCalls = 0,
            warmPathCalls = 0,
            standardCalls = 0,
            coldCalls = 0,
            warmPathPercentage = 100.0,
            avgLatencyMs = 0.0,
            minLatencyMs = 0.0,
            maxLatencyMs = 0.0
        )
    }
}

/**
 * Tabs available in the expanded Debug HUD inspector.
 */
enum class HudTab(val title: String) {
    IPC_LOGS("IPC Inspector"),
    LATENCY_APM("Latency APM"),
    OVERRIDES("Hardware Overrides"),
    SYSTEM("Engine & Diagnostics")
}
