package com.goat.webview.security

import android.util.Log
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicLong

/**
 * Bridge Abuse Prevention Guardrails Manager (Task 10199 / Pillar 1).
 *
 * Enforces two primary anti-abuse guardrails:
 * 1. User Gesture Freshness Gate (Telegram baseline: 10s): Privileged actions (location, biometrics,
 *    payments, sharing) are rejected unless invoked within 10,000ms of a genuine user tap.
 * 2. Repeated-Dialog Cooldown (Telegram baseline: 3 requests / 3s): Dialog requests exceeding the
 *    threshold trigger a cooldown blocking spam.
 */
class GoatAbuseGuardManager(
    private val defaultGestureWindowMs: Long = 10_000L,
    private val maxDialogRequests: Int = 3,
    private val dialogWindowMs: Long = 3_000L
) {
    companion object {
        private const val TAG = "GoatAbuseGuardManager"
        const val ERROR_GESTURE_REQUIRED = "GESTURE_REQUIRED"
        const val ERROR_DIALOG_COOLDOWN_ACTIVE = "DIALOG_COOLDOWN_ACTIVE"

        val PRIVILEGED_ACTIONS = setOf(
            "BIOMETRIC_AUTH",
            "GET_LOCATION",
            "CHOOSE_LOCATION",
            "OPEN_LOCATION",
            "SHARE_SHEET",
            "SHARE_TO_STORY",
            "MAKE_PHONE_CALL",
            "SEND_SMS",
            "IAP_PURCHASE",
            "OPEN_INVOICE",
            "WEB3_SIGN_TRANSACTION",
            "CANCEL_PAYMENT"
        )
    }

    private val lastUserTouchTimestamp = AtomicLong(System.currentTimeMillis())
    private val dialogRequestTimestamps = ConcurrentHashMap<String, ConcurrentLinkedQueue<Long>>()

    /**
     * Records a genuine user touch interaction timestamp.
     */
    fun recordUserGesture(timestampMs: Long = System.currentTimeMillis()) {
        lastUserTouchTimestamp.set(timestampMs)
        Log.d(TAG, "Recorded user gesture at $timestampMs")
    }

    /**
     * Checks whether a user gesture was recorded within the freshness window.
     */
    fun isGestureFresh(windowMs: Long = defaultGestureWindowMs, now: Long = System.currentTimeMillis()): Boolean {
        val lastTouch = lastUserTouchTimestamp.get()
        if (lastTouch == 0L) return false
        val age = now - lastTouch
        return age in 0..windowMs
    }

    /**
     * Returns the age of the last user gesture in milliseconds, or Long.MAX_VALUE if no gesture recorded.
     */
    fun getGestureAgeMs(now: Long = System.currentTimeMillis()): Long {
        val lastTouch = lastUserTouchTimestamp.get()
        if (lastTouch == 0L) return Long.MAX_VALUE
        return now - lastTouch
    }

    /**
     * Determines whether a modal dialog request of [dialogType] should be throttled.
     */
    fun shouldThrottleDialog(
        dialogType: String,
        maxRequests: Int = maxDialogRequests,
        windowMs: Long = dialogWindowMs,
        now: Long = System.currentTimeMillis()
    ): Boolean {
        val queue = dialogRequestTimestamps.computeIfAbsent(dialogType) { ConcurrentLinkedQueue() }

        // Purge timestamps older than the sliding window
        val cutoff = now - windowMs
        while (true) {
            val oldest = queue.peek() ?: break
            if (oldest < cutoff) {
                queue.poll()
            } else {
                break
            }
        }

        if (queue.size >= maxRequests) {
            Log.w(TAG, "Dialog spam detected for '$dialogType': ${queue.size} requests within ${windowMs}ms")
            return true
        }

        queue.offer(now)
        return false
    }

    /**
     * Clears all recorded touch timestamps and dialog histories.
     */
    fun reset() {
        lastUserTouchTimestamp.set(0)
        dialogRequestTimestamps.clear()
    }
}
