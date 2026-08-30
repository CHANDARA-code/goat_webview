package com.goat.webview.ui

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.util.concurrent.atomic.AtomicLong

/**
 * Native Haptic Feedback Waveform Engine (Milestone 2 / Task 10072 & R2 Haptic Subsystem).
 *
 * Implements 10 distinct vibration profiles with exact microsecond timings, amplitude modulation (0-255),
 * and legacy duration fallbacks inspired by Telegram's Mini Apps BotWebViewVibrationEffect.
 *
 * Includes atomic burst throttling (15ms threshold) to protect vibrator HAL from buffer overflows.
 */
class GoatHapticFeedback(private val context: Context) {

    /**
     * Haptic profile definition with timing array (ms), amplitude array (0-255), and legacy duration fallback.
     */
    data class HapticProfile(
        val name: String,
        val timings: LongArray,
        val amplitudes: IntArray,
        val fallbackTimings: LongArray
    ) {
        override fun equals(other: Any?): Boolean {
            if (this === other) return true
            if (other !is HapticProfile) return false
            return name == other.name &&
                    timings.contentEquals(other.timings) &&
                    amplitudes.contentEquals(other.amplitudes) &&
                    fallbackTimings.contentEquals(other.fallbackTimings)
        }

        override fun hashCode(): Int {
            var result = name.hashCode()
            result = 31 * result + timings.contentHashCode()
            result = 31 * result + amplitudes.contentHashCode()
            result = 31 * result + fallbackTimings.contentHashCode()
            return result
        }
    }

    companion object {
        const val MIN_BURST_INTERVAL_MS = 15L

        // 10 Preset Waveforms
        val IMPACT_LIGHT = HapticProfile(
            name = "impact_light",
            timings = longArrayOf(7),
            amplitudes = intArrayOf(65),
            fallbackTimings = longArrayOf(60)
        )

        val IMPACT_MEDIUM = HapticProfile(
            name = "impact_medium",
            timings = longArrayOf(7),
            amplitudes = intArrayOf(145),
            fallbackTimings = longArrayOf(70)
        )

        val IMPACT_HEAVY = HapticProfile(
            name = "impact_heavy",
            timings = longArrayOf(7),
            amplitudes = intArrayOf(255),
            fallbackTimings = longArrayOf(80)
        )

        val IMPACT_RIGID = HapticProfile(
            name = "impact_rigid",
            timings = longArrayOf(3),
            amplitudes = intArrayOf(225),
            fallbackTimings = longArrayOf(50)
        )

        val IMPACT_SOFT = HapticProfile(
            name = "impact_soft",
            timings = longArrayOf(10),
            amplitudes = intArrayOf(175),
            fallbackTimings = longArrayOf(55)
        )

        val NOTIFICATION_SUCCESS = HapticProfile(
            name = "notification_success",
            timings = longArrayOf(14, 65, 14),
            amplitudes = intArrayOf(175, 0, 255),
            fallbackTimings = longArrayOf(50, 60, 65)
        )

        val NOTIFICATION_WARNING = HapticProfile(
            name = "notification_warning",
            timings = longArrayOf(14, 64, 14),
            amplitudes = intArrayOf(225, 0, 175),
            fallbackTimings = longArrayOf(65, 60, 40)
        )

        val NOTIFICATION_ERROR = HapticProfile(
            name = "notification_error",
            timings = longArrayOf(14, 48, 14, 48, 14, 48, 20),
            amplitudes = intArrayOf(200, 0, 200, 0, 255, 0, 145),
            fallbackTimings = longArrayOf(40, 60, 40, 60, 65, 60, 40)
        )

        val SELECTION_CHANGE = HapticProfile(
            name = "selection_change",
            timings = longArrayOf(1),
            amplitudes = intArrayOf(65),
            fallbackTimings = longArrayOf(30)
        )

        val APP_ERROR = HapticProfile(
            name = "app_error",
            timings = longArrayOf(30, 10, 150, 10),
            amplitudes = intArrayOf(0, 100, 0, 100),
            fallbackTimings = longArrayOf(40, 60, 40, 60, 65, 60, 40)
        )

        val ALL_PROFILES = mapOf(
            "impact_light" to IMPACT_LIGHT,
            "impact_medium" to IMPACT_MEDIUM,
            "impact_heavy" to IMPACT_HEAVY,
            "impact_rigid" to IMPACT_RIGID,
            "impact_soft" to IMPACT_SOFT,
            "notification_success" to NOTIFICATION_SUCCESS,
            "notification_warning" to NOTIFICATION_WARNING,
            "notification_error" to NOTIFICATION_ERROR,
            "selection_change" to SELECTION_CHANGE,
            "app_error" to APP_ERROR
        )
    }

    private val lastTriggerTimeMs = AtomicLong(0L)

    private val vibrator: Vibrator? by lazy {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }
        } catch (e: Throwable) {
            null
        }
    }

    /**
     * Resolves the haptic profile from the incoming payload parameters.
     */
    fun resolveProfile(type: String?, style: String?, notificationType: String?): HapticProfile {
        val normalizedType = type?.lowercase()?.trim() ?: "impact"
        val normalizedStyle = style?.lowercase()?.trim() ?: "medium"
        val normalizedNotif = notificationType?.lowercase()?.trim() ?: "success"

        // Check direct legacy/alias strings
        when (normalizedType) {
            "light" -> return IMPACT_LIGHT
            "medium" -> return IMPACT_MEDIUM
            "heavy" -> return IMPACT_HEAVY
            "rigid" -> return IMPACT_RIGID
            "soft" -> return IMPACT_SOFT
            "success" -> return NOTIFICATION_SUCCESS
            "warning" -> return NOTIFICATION_WARNING
            "error" -> return NOTIFICATION_ERROR
            "selection" -> return SELECTION_CHANGE
            "app_error" -> return APP_ERROR
        }

        return when (normalizedType) {
            "notification" -> {
                when (normalizedNotif) {
                    "warning" -> NOTIFICATION_WARNING
                    "error" -> NOTIFICATION_ERROR
                    else -> NOTIFICATION_SUCCESS
                }
            }
            "selection" -> SELECTION_CHANGE
            "app_error" -> APP_ERROR
            "impact" -> {
                when (normalizedStyle) {
                    "light" -> IMPACT_LIGHT
                    "heavy" -> IMPACT_HEAVY
                    "rigid" -> IMPACT_RIGID
                    "soft" -> IMPACT_SOFT
                    else -> IMPACT_MEDIUM
                }
            }
            else -> IMPACT_MEDIUM
        }
    }

    /**
     * Triggers vibration using the appropriate waveform based on device hardware capabilities.
     * Returns a JSON object with execution metrics.
     */
    fun trigger(payload: JsonObject): JsonObject {
        val type = payload["type"]?.jsonPrimitive?.content
        val style = payload["style"]?.jsonPrimitive?.content
        val notificationType = payload["notificationType"]?.jsonPrimitive?.content

        val profile = resolveProfile(type, style, notificationType)
        val now = System.currentTimeMillis()
        val last = lastTriggerTimeMs.get()
        val isThrottled = (now - last < MIN_BURST_INTERVAL_MS)
        var fallbackUsed = false
        if (!isThrottled) {
            lastTriggerTimeMs.set(now)
            val vib = vibrator
            if (vib != null && vib.hasVibrator()) {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        if (vib.hasAmplitudeControl()) {
                            val effect = VibrationEffect.createWaveform(profile.timings, profile.amplitudes, -1)
                            vib.vibrate(effect)
                        } else {
                            fallbackUsed = true
                            val effect = VibrationEffect.createWaveform(profile.fallbackTimings, -1)
                            vib.vibrate(effect)
                        }
                    } else {
                        fallbackUsed = true
                        @Suppress("DEPRECATION")
                        vib.vibrate(profile.fallbackTimings, -1)
                    }
                } catch (e: Throwable) {
                    fallbackUsed = true
                }
            }
        }

        return buildJsonObject {
            put("status", "vibrated")
            put("profile", profile.name)
            put("type", type ?: "impact")
            if (style != null) put("style", style)
            if (notificationType != null) put("notificationType", notificationType)
            put("fallbackUsed", fallbackUsed)
            if (isThrottled) put("throttled", true)
        }
    }
}
