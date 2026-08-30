package com.goat.webview

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

/**
 * Android 14+ Predictive Back & Interactive Edge-Swipe Coordinator (Task 10126).
 *
 * Tracks gesture progress (0.0 to 1.0), interpolates physical scale (1.0 to 0.9), alpha (1.0 to 0.85),
 * and translation (±150px) for 120 FPS fluid back transitions, and synchronizes with the WebView
 * browser navigation stack.
 *
 * @param ioDispatcher Coroutine dispatcher.
 */
class GoatPredictiveBackCoordinator(
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) {
    companion object {
        const val EDGE_LEFT = 0
        const val EDGE_RIGHT = 1
        const val MIN_SCALE = 0.90f
        const val MIN_ALPHA = 0.85f
        const val MAX_TRANSLATION_X = 150.0f
    }

    /**
     * Discrete lifecycle states of the predictive back gesture.
     */
    enum class GestureState {
        IDLE,
        STARTED,
        PROGRESSING,
        COMMITTED,
        CANCELLED
    }

    data class BackGestureProgress(
        val progress: Float,
        val touchX: Float,
        val touchY: Float,
        val swipeEdge: Int,
        val interpolatedScale: Float,
        val interpolatedAlpha: Float,
        val interpolatedTranslationX: Float,
        val gestureState: GestureState = GestureState.PROGRESSING
    )

    data class BackNavigationResult(
        val action: String, // "COMMITTED" or "CANCELLED"
        val canGoBackInWebView: Boolean,
        val poppedRoute: Boolean,
        val remainingHistoryDepth: Int = 1
    )

    /**
     * Listener interface for observing predictive back gesture lifecycle events.
     */
    interface BackGestureListener {
        fun onGestureStarted(swipeEdge: Int, touchX: Float, touchY: Float) {}
        fun onGestureProgress(progress: BackGestureProgress) {}
        fun onGestureInvoked(result: BackNavigationResult) {}
        fun onGestureCancelled(result: BackNavigationResult) {}
    }

    private val gestureState = AtomicReference(GestureState.IDLE)
    private val webViewHistoryDepth = AtomicInteger(1)
    private val listeners = CopyOnWriteArrayList<BackGestureListener>()

    /**
     * Registers a listener to observe back gesture transitions.
     */
    fun registerGestureListener(listener: BackGestureListener) {
        listeners.add(listener)
    }

    /**
     * Unregisters a previously registered back gesture listener.
     */
    fun unregisterGestureListener(listener: BackGestureListener) {
        listeners.remove(listener)
    }

    /**
     * Sets current WebView history depth for testing/coordination.
     */
    fun setHistoryDepth(depth: Int) {
        webViewHistoryDepth.set(depth.coerceAtLeast(1))
    }

    /**
     * Returns the current tracked WebView history depth.
     */
    fun getHistoryDepth(): Int = webViewHistoryDepth.get()

    /**
     * Starts a predictive back gesture from the left or right edge.
     */
    fun onBackStarted(swipeEdge: Int = EDGE_LEFT, touchX: Float = 0f, touchY: Float = 0f) {
        gestureState.set(GestureState.STARTED)
        for (listener in listeners) {
            try {
                listener.onGestureStarted(swipeEdge, touchX, touchY)
            } catch (_: Exception) {}
        }
    }

    /**
     * Processes progressive touch tracking during the back swipe.
     *
     * Computes 120 FPS interpolated visual transformations:
     * - scale: 1.0f -> 0.90f
     * - alpha: 1.0f -> 0.85f
     * - translationX: 0px -> +150px (EDGE_LEFT) or -150px (EDGE_RIGHT)
     *
     * @param progress Progress fraction between 0.0f and 1.0f.
     * @param touchX Current touch X coordinate in pixels.
     * @param touchY Current touch Y coordinate in pixels.
     * @param swipeEdge [EDGE_LEFT] or [EDGE_RIGHT].
     * @return [BackGestureProgress] with interpolated visual transformation values.
     */
    suspend fun onBackProgressed(
        progress: Float,
        touchX: Float = 0f,
        touchY: Float = 0f,
        swipeEdge: Int = EDGE_LEFT
    ): BackGestureProgress = withContext(ioDispatcher) {
        gestureState.set(GestureState.PROGRESSING)
        val clampedProgress = progress.coerceIn(0.0f, 1.0f)
        val scale = 1.0f - (clampedProgress * (1.0f - MIN_SCALE))
        val alpha = 1.0f - (clampedProgress * (1.0f - MIN_ALPHA))
        val translationX = if (swipeEdge == EDGE_LEFT) {
            clampedProgress * MAX_TRANSLATION_X
        } else {
            -clampedProgress * MAX_TRANSLATION_X
        }

        val gestureProgress = BackGestureProgress(
            progress = clampedProgress,
            touchX = touchX,
            touchY = touchY,
            swipeEdge = swipeEdge,
            interpolatedScale = scale,
            interpolatedAlpha = alpha,
            interpolatedTranslationX = translationX,
            gestureState = GestureState.PROGRESSING
        )

        for (listener in listeners) {
            try {
                listener.onGestureProgress(gestureProgress)
            } catch (_: Exception) {}
        }

        gestureProgress
    }

    /**
     * Invoked when the user completes the gesture (commits back navigation).
     * Pops an entry from WebView internal history if depth > 1, otherwise signals the host route/Activity to pop.
     *
     * @return [BackNavigationResult] indicating if WebView back stack or host activity popped.
     */
    suspend fun onBackInvoked(): BackNavigationResult = withContext(ioDispatcher) {
        gestureState.set(GestureState.COMMITTED)
        val currentDepth = webViewHistoryDepth.get()
        val canGoBack = currentDepth > 1
        val newDepth = if (canGoBack) {
            webViewHistoryDepth.decrementAndGet()
        } else {
            currentDepth
        }

        val result = BackNavigationResult(
            action = "COMMITTED",
            canGoBackInWebView = canGoBack,
            poppedRoute = !canGoBack,
            remainingHistoryDepth = newDepth
        )

        for (listener in listeners) {
            try {
                listener.onGestureInvoked(result)
            } catch (_: Exception) {}
        }

        gestureState.set(GestureState.IDLE)
        result
    }

    /**
     * Invoked when the user cancels the gesture (finger dragged back to screen edge).
     * Snaps visual transformations back to full frame (scale 1.0, alpha 1.0, translation 0).
     */
    suspend fun onBackCancelled(): BackNavigationResult = withContext(ioDispatcher) {
        gestureState.set(GestureState.CANCELLED)
        val currentDepth = webViewHistoryDepth.get()
        val result = BackNavigationResult(
            action = "CANCELLED",
            canGoBackInWebView = currentDepth > 1,
            poppedRoute = false,
            remainingHistoryDepth = currentDepth
        )

        for (listener in listeners) {
            try {
                listener.onGestureCancelled(result)
            } catch (_: Exception) {}
        }

        gestureState.set(GestureState.IDLE)
        result
    }

    /**
     * Returns true if a gesture is currently in progress.
     */
    fun isTrackingGesture(): Boolean {
        val state = gestureState.get()
        return state == GestureState.STARTED || state == GestureState.PROGRESSING
    }

    /**
     * Returns the current discrete gesture state.
     */
    fun getGestureState(): GestureState = gestureState.get()
}

