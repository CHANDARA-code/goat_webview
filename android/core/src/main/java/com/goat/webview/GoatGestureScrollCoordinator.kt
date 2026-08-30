package com.goat.webview

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Scroll direction and gesture conflict resolution modes.
 */
enum class ScrollDirection {
    VERTICAL,
    HORIZONTAL,
    NONE
}

/**
 * Result state for gesture routing evaluation.
 */
@Serializable
data class GestureScrollState(
    val isScrollBoundaryReached: Boolean,
    val canParentIntercept: Boolean,
    val activeDirection: String,
    val scrollOffsetPx: Int,
    val isFlingActive: Boolean
)

/**
 * Zero-Stall Gesture & Scroll Synchronization Coordinator (Task 10079).
 *
 * Resolves touch conflict deadlocks between host parent containers (ViewPager2, NestedScrollView,
 * Compose LazyColumn) and child MiniApp WebView instances by tracking gesture momentum,
 * scroll boundary limits, and edge over-scroll thresholds.
 */
class GoatGestureScrollCoordinator {

    private val isAtTopBoundary = AtomicBoolean(true)
    private val isAtBottomBoundary = AtomicBoolean(false)
    private val currentScrollOffsetY = AtomicInteger(0)
    private val isFlinging = AtomicBoolean(false)
    private var primaryDirection: ScrollDirection = ScrollDirection.VERTICAL

    var onFlingStateChanged: ((Boolean) -> Unit)? = null

    /**
     * Updates the current scroll offset and boundary states reported by DOM/WebView.
     */
    suspend fun updateScrollPosition(
        scrollY: Int,
        maxScrollY: Int,
        direction: ScrollDirection = ScrollDirection.VERTICAL
    ): GestureScrollState = withContext(Dispatchers.IO) {
        currentScrollOffsetY.set(scrollY)
        primaryDirection = direction
        isAtTopBoundary.set(scrollY <= 0)
        isAtBottomBoundary.set(scrollY >= maxScrollY && maxScrollY > 0)

        getGestureState()
    }

    /**
     * Determines whether the parent scroll container should intercept or disallow touch events.
     */
    suspend fun shouldParentInterceptTouch(
        deltaY: Float,
        isOverscrollAllowed: Boolean = false
    ): Boolean = withContext(Dispatchers.IO) {
        // Parent intercepts only when scrolling up at the top edge or scrolling down at the bottom edge
        if (deltaY > 0 && isAtTopBoundary.get()) {
            return@withContext isOverscrollAllowed
        }
        if (deltaY < 0 && isAtBottomBoundary.get()) {
            return@withContext isOverscrollAllowed
        }
        false
    }

    /**
     * Sets whether a fling gesture is actively decelerating.
     */
    fun setFlingActive(active: Boolean) {
        val previous = isFlinging.getAndSet(active)
        if (previous != active) {
            onFlingStateChanged?.invoke(active)
        }
    }

    /**
     * Returns the active gesture scroll synchronization state.
     */
    fun getGestureState(): GestureScrollState {
        val boundary = isAtTopBoundary.get() || isAtBottomBoundary.get()
        return GestureScrollState(
            isScrollBoundaryReached = boundary,
            canParentIntercept = boundary,
            activeDirection = primaryDirection.name,
            scrollOffsetPx = currentScrollOffsetY.get(),
            isFlingActive = isFlinging.get()
        )
    }

    /**
     * Resets gesture tracking state to initial viewport defaults.
     */
    fun reset() {
        isAtTopBoundary.set(true)
        isAtBottomBoundary.set(false)
        currentScrollOffsetY.set(0)
        isFlinging.set(false)
        primaryDirection = ScrollDirection.VERTICAL
    }
}
