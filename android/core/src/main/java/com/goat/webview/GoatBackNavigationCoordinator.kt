package com.goat.webview

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import java.util.concurrent.atomic.AtomicInteger

/**
 * Action decided by the native back navigation coordinator.
 */
enum class BackPressAction {
    WEB_HISTORY_POP,
    ACTIVITY_FINISH,
    INTERCEPTED_BY_JS
}

/**
 * Result of handling a hardware or gesture back-press.
 */
@Serializable
data class BackNavigationResult(
    val action: String,
    val canGoBack: Boolean,
    val currentHistoryIndex: Int,
    val totalHistoryCount: Int,
    val routePopped: String? = null
)

/**
 * Android Native BackHandler & DOM History Round-Trip Coordinator (Task 10094).
 *
 * Coordinates hardware back-press events and gesture navigations, ensuring internal
 * WebView SPA history routes rewind smoothly without premature Activity finishes.
 */
class GoatBackNavigationCoordinator {

    private val historyStack = mutableListOf<String>()
    private val currentIndex = AtomicInteger(0)

    init {
        // Root route
        historyStack.add("/")
    }

    /**
     * Pushes a new virtual route onto the web history stack.
     */
    fun pushState(route: String): Int {
        val nextIdx = currentIndex.incrementAndGet()
        if (nextIdx < historyStack.size) {
            historyStack[nextIdx] = route
        } else {
            historyStack.add(route)
        }
        return nextIdx
    }

    /**
     * Checks if there are history entries preceding the current index.
     */
    fun canGoBack(): Boolean {
        return currentIndex.get() > 0
    }

    /**
     * Handles a hardware back-press or gesture back navigation.
     *
     * @return [BackNavigationResult] specifying whether to pop web history or exit the activity.
     */
    suspend fun handleBackPress(): BackNavigationResult = withContext(Dispatchers.IO) {
        val curr = currentIndex.get()
        if (curr > 0) {
            val poppedRoute = if (curr < historyStack.size) historyStack[curr] else null
            val newIdx = currentIndex.decrementAndGet()
            BackNavigationResult(
                action = BackPressAction.WEB_HISTORY_POP.name,
                canGoBack = newIdx > 0,
                currentHistoryIndex = newIdx,
                totalHistoryCount = historyStack.size,
                routePopped = poppedRoute
            )
        } else {
            BackNavigationResult(
                action = BackPressAction.ACTIVITY_FINISH.name,
                canGoBack = false,
                currentHistoryIndex = 0,
                totalHistoryCount = historyStack.size,
                routePopped = null
            )
        }
    }

    /**
     * Resets the history stack back to root.
     */
    fun resetHistory() {
        historyStack.clear()
        historyStack.add("/")
        currentIndex.set(0)
    }

    /**
     * Returns the current route.
     */
    fun getCurrentRoute(): String {
        val idx = currentIndex.get()
        return if (idx < historyStack.size) historyStack[idx] else "/"
    }
}
