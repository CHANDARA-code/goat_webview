package com.goat.webview

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Lifecycle state of a page entry in the native multi-WebView stack.
 */
@Serializable
enum class PageLifecycleState {
    CREATED,
    RESUMED,
    SUSPENDED,
    DESTROYED
}

/**
 * Metadata record for a single page entry in the native multi-WebView stack.
 */
@Serializable
data class PageStackEntry(
    val pageId: String,
    val route: String,
    val title: String,
    val isSuspended: Boolean,
    val timestamp: Long,
    val params: Map<String, String> = emptyMap(),
    val lifecycleState: PageLifecycleState = PageLifecycleState.RESUMED,
    val memoryTrimmed: Boolean = false
)

/**
 * Result model for native page stack modifications.
 */
@Serializable
data class PageStackResult(
    val action: String,
    val activePage: PageStackEntry?,
    val stackDepth: Int,
    val canPop: Boolean,
    val allPages: List<PageStackEntry>,
    val evictedPage: PageStackEntry? = null
)

/**
 * Listener interface for monitoring page stack lifecycle events and coordinating with FastPool.
 */
interface PageLifecycleListener {
    fun onPagePushed(entry: PageStackEntry) {}
    fun onPagePopped(poppedEntry: PageStackEntry, newTopEntry: PageStackEntry?) {}
    fun onPageSuspended(entry: PageStackEntry) {}
    fun onPageResumed(entry: PageStackEntry) {}
    fun onPageEvicted(entry: PageStackEntry) {}
    fun onPageReplaced(oldEntry: PageStackEntry, newEntry: PageStackEntry) {}
}

/**
 * Multi-WebView Native Page Stack Coordinator (Task 10091).
 *
 * Coordinates physical and virtual page transitions for native 120 FPS swipe-back navigation.
 * Suspends non-active background WebViews (reducing idle RAM < 8MB) and evicts oldest entries
 * when exceeding the configured stack capacity while preserving the root page at index 0.
 */
class GoatPageStackManager(
    private val maxStackDepth: Int = 10
) {
    private val pageStack = CopyOnWriteArrayList<PageStackEntry>()
    private val lifecycleListeners = CopyOnWriteArrayList<PageLifecycleListener>()

    init {
        // Initialize with default root page
        val rootPage = PageStackEntry(
            pageId = "root",
            route = "/",
            title = "Home",
            isSuspended = false,
            timestamp = System.currentTimeMillis(),
            params = emptyMap(),
            lifecycleState = PageLifecycleState.RESUMED,
            memoryTrimmed = false
        )
        pageStack.add(rootPage)
    }

    /**
     * Registers a listener to observe page lifecycle transitions.
     */
    fun registerLifecycleListener(listener: PageLifecycleListener) {
        lifecycleListeners.add(listener)
    }

    /**
     * Unregisters a previously registered page lifecycle listener.
     */
    fun unregisterLifecycleListener(listener: PageLifecycleListener) {
        lifecycleListeners.remove(listener)
    }

    /**
     * Pushes a new page onto the navigation stack, suspending the previous active page.
     * Trims background memory state on the previous top page and evicts oldest non-root entry if exceeding max depth.
     */
    suspend fun pushPage(
        route: String,
        title: String = "",
        params: Map<String, String> = emptyMap()
    ): PageStackResult = withContext(Dispatchers.IO) {
        val sanitizedRoute = route.trim().ifBlank { "/" }
        val now = System.currentTimeMillis()

        // Suspend previous active page
        if (pageStack.isNotEmpty()) {
            val lastIdx = pageStack.size - 1
            val prev = pageStack[lastIdx]
            val suspendedPrev = prev.copy(
                isSuspended = true,
                lifecycleState = PageLifecycleState.SUSPENDED,
                memoryTrimmed = true
            )
            pageStack[lastIdx] = suspendedPrev
            for (listener in lifecycleListeners) {
                try {
                    listener.onPageSuspended(suspendedPrev)
                } catch (_: Exception) {}
            }
        }

        val newPage = PageStackEntry(
            pageId = UUID.randomUUID().toString().take(8),
            route = sanitizedRoute,
            title = title.ifBlank { sanitizedRoute },
            isSuspended = false,
            timestamp = now,
            params = params,
            lifecycleState = PageLifecycleState.RESUMED,
            memoryTrimmed = false
        )
        pageStack.add(newPage)

        for (listener in lifecycleListeners) {
            try {
                listener.onPagePushed(newPage)
            } catch (_: Exception) {}
        }

        // Evict oldest if exceeding max depth (preserving root at index 0)
        var evicted: PageStackEntry? = null
        if (pageStack.size > maxStackDepth && pageStack.size > 2) {
            evicted = pageStack.removeAt(1).copy(lifecycleState = PageLifecycleState.DESTROYED)
            for (listener in lifecycleListeners) {
                try {
                    listener.onPageEvicted(evicted)
                } catch (_: Exception) {}
            }
        }

        buildResult("NAV_PUSH", evicted)
    }

    /**
     * Pops the top page from the stack and resumes the previous page.
     */
    suspend fun popPage(): PageStackResult = withContext(Dispatchers.IO) {
        if (pageStack.size > 1) {
            val popped = pageStack.removeAt(pageStack.size - 1).copy(lifecycleState = PageLifecycleState.DESTROYED)
            // Resume new top page
            val topIdx = pageStack.size - 1
            val top = pageStack[topIdx]
            val resumedTop = top.copy(
                isSuspended = false,
                lifecycleState = PageLifecycleState.RESUMED,
                memoryTrimmed = false
            )
            pageStack[topIdx] = resumedTop

            for (listener in lifecycleListeners) {
                try {
                    listener.onPagePopped(popped, resumedTop)
                    listener.onPageResumed(resumedTop)
                } catch (_: Exception) {}
            }
        }
        buildResult("NAV_POP")
    }

    /**
     * Pops all pages back to the root page.
     */
    suspend fun popToRoot(): PageStackResult = withContext(Dispatchers.IO) {
        if (pageStack.size > 1) {
            val poppedPages = mutableListOf<PageStackEntry>()
            while (pageStack.size > 1) {
                val popped = pageStack.removeAt(pageStack.size - 1).copy(lifecycleState = PageLifecycleState.DESTROYED)
                poppedPages.add(popped)
            }
            val root = pageStack[0].copy(
                isSuspended = false,
                lifecycleState = PageLifecycleState.RESUMED,
                memoryTrimmed = false
            )
            pageStack[0] = root

            for (listener in lifecycleListeners) {
                try {
                    for (popped in poppedPages) {
                        listener.onPagePopped(popped, root)
                    }
                    listener.onPageResumed(root)
                } catch (_: Exception) {}
            }
        }
        buildResult("NAV_POP_TO_ROOT")
    }

    /**
     * Replaces the current top page with a new route without altering stack depth.
     */
    suspend fun replacePage(
        route: String,
        title: String = "",
        params: Map<String, String> = emptyMap()
    ): PageStackResult = withContext(Dispatchers.IO) {
        val sanitizedRoute = route.trim().ifBlank { "/" }
        val now = System.currentTimeMillis()
        if (pageStack.isNotEmpty()) {
            val lastIdx = pageStack.size - 1
            val oldEntry = pageStack[lastIdx].copy(lifecycleState = PageLifecycleState.DESTROYED)
            val newEntry = PageStackEntry(
                pageId = UUID.randomUUID().toString().take(8),
                route = sanitizedRoute,
                title = title.ifBlank { sanitizedRoute },
                isSuspended = false,
                timestamp = now,
                params = params,
                lifecycleState = PageLifecycleState.RESUMED,
                memoryTrimmed = false
            )
            pageStack[lastIdx] = newEntry

            for (listener in lifecycleListeners) {
                try {
                    listener.onPageReplaced(oldEntry, newEntry)
                } catch (_: Exception) {}
            }
        }
        buildResult("NAV_REPLACE")
    }

    /**
     * Finds a page by its unique pageId.
     */
    fun findPageById(pageId: String): PageStackEntry? {
        return pageStack.firstOrNull { it.pageId == pageId }
    }

    /**
     * Finds all pages with the specified route.
     */
    fun findPagesByRoute(route: String): List<PageStackEntry> {
        return pageStack.filter { it.route == route }
    }

    /**
     * Retrieves the entire current page stack.
     */
    fun getStack(): List<PageStackEntry> = pageStack.toList()

    /**
     * Returns the active top page if one exists.
     */
    fun getActivePage(): PageStackEntry? = pageStack.lastOrNull()

    /**
     * Clears all pages except root, resetting stack to fresh initial state.
     */
    fun resetToRoot() {
        val root = PageStackEntry(
            pageId = "root",
            route = "/",
            title = "Home",
            isSuspended = false,
            timestamp = System.currentTimeMillis(),
            params = emptyMap(),
            lifecycleState = PageLifecycleState.RESUMED,
            memoryTrimmed = false
        )
        pageStack.clear()
        pageStack.add(root)
    }

    private fun buildResult(action: String, evictedPage: PageStackEntry? = null): PageStackResult {
        val top = pageStack.lastOrNull()
        return PageStackResult(
            action = action,
            activePage = top,
            stackDepth = pageStack.size,
            canPop = pageStack.size > 1,
            allPages = pageStack.toList(),
            evictedPage = evictedPage
        )
    }
}

