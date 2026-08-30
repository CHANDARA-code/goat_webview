package com.goat.webview

import android.content.Context
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * IME Software Keyboard Insets Synchronizer (Task 10068 / Pillar 3 IME Sync).
 *
 * Measures WindowInsets virtual keyboard height, dispatches height transition metrics,
 * and calculates viewport bottom inset padding to prevent focused web inputs from being occluded.
 *
 * @param context Android Application Context.
 * @param ioDispatcher Coroutine Dispatcher.
 * @param eventCoalescer Optional event coalescer for deduplication and throttling.
 */
class GoatKeyboardManager(
    private val context: Context,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
    private val eventCoalescer: com.goat.webview.ipc.GoatEventCoalescer? = null
) {
    data class KeyboardInsetsState(
        val isVisible: Boolean,
        val heightPx: Int,
        val durationMs: Long = 250L,
        val adjustedViewportBottomInset: Int
    )

    private val isKeyboardVisible = AtomicBoolean(false)
    private val currentKeyboardHeight = AtomicInteger(0)
    private val defaultAnimationDurationMs = 250L

    /**
     * Simulates or processes an IME WindowInsets change event.
     *
     * @param heightPx Software keyboard height in physical pixels.
     * @param durationMs Animation transition duration in ms.
     * @return [KeyboardInsetsState] with calculated viewport padding.
     */
    suspend fun updateKeyboardInsets(heightPx: Int, durationMs: Long = defaultAnimationDurationMs): KeyboardInsetsState = withContext(ioDispatcher) {
        val visible = heightPx > 0
        isKeyboardVisible.set(visible)
        currentKeyboardHeight.set(if (visible) heightPx else 0)

        val state = KeyboardInsetsState(
            isVisible = visible,
            heightPx = currentKeyboardHeight.get(),
            durationMs = durationMs,
            adjustedViewportBottomInset = currentKeyboardHeight.get()
        )

        eventCoalescer?.emit(
            "ON_KEYBOARD_HEIGHT_CHANGE",
            buildJsonObject {
                put("height", state.heightPx)
                put("isVisible", state.isVisible)
                put("duration", state.durationMs)
                put("adjustedViewportBottomInset", state.adjustedViewportBottomInset)
            },
            minIntervalMs = 50L
        ) { _, _ -> }

        state
    }

    /**
     * Gets the current keyboard insets state.
     */
    fun getCurrentInsets(): KeyboardInsetsState {
        val visible = isKeyboardVisible.get()
        val height = currentKeyboardHeight.get()
        return KeyboardInsetsState(
            isVisible = visible,
            heightPx = height,
            durationMs = 0L,
            adjustedViewportBottomInset = height
        )
    }

    /**
     * Resets the keyboard state (e.g. on page navigation or container unmount).
     */
    fun reset() {
        isKeyboardVisible.set(false)
        currentKeyboardHeight.set(0)
    }
}
