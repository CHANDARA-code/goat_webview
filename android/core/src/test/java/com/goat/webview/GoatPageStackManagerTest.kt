package com.goat.webview

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Unit test suite for GoatPageStackManager (Task 10091).
 */
class GoatPageStackManagerTest {

    private lateinit var pageStackManager: GoatPageStackManager

    @Before
    fun setUp() {
        pageStackManager = GoatPageStackManager(maxStackDepth = 3)
    }

    @Test
    fun `test initial state contains root page`() {
        val stack = pageStackManager.getStack()
        assertEquals(1, stack.size)
        assertEquals("/", stack.first().route)
        assertEquals("Home", stack.first().title)
        assertFalse(stack.first().isSuspended)
        assertEquals(PageLifecycleState.RESUMED, stack.first().lifecycleState)
        assertFalse(stack.first().memoryTrimmed)
    }

    @Test
    fun `test pushPage suspends previous page and adds new top`() = runTest {
        val pushRes = pageStackManager.pushPage(
            route = "/cart",
            title = "Shopping Cart",
            params = mapOf("coupon" to "SUMMER20")
        )
        assertEquals("NAV_PUSH", pushRes.action)
        assertEquals(2, pushRes.stackDepth)
        assertTrue(pushRes.canPop)
        assertEquals("/cart", pushRes.activePage?.route)
        assertFalse(pushRes.activePage?.isSuspended == true)
        assertEquals("SUMMER20", pushRes.activePage?.params?.get("coupon"))

        val stack = pageStackManager.getStack()
        assertTrue(stack[0].isSuspended) // Root suspended
        assertTrue(stack[0].memoryTrimmed)
        assertEquals(PageLifecycleState.SUSPENDED, stack[0].lifecycleState)

        assertFalse(stack[1].isSuspended) // Cart active
        assertEquals(PageLifecycleState.RESUMED, stack[1].lifecycleState)
    }

    @Test
    fun `test popPage resumes previous page`() = runTest {
        pageStackManager.pushPage("/details")
        val popRes = pageStackManager.popPage()

        assertEquals("NAV_POP", popRes.action)
        assertEquals(1, popRes.stackDepth)
        assertFalse(popRes.canPop)
        assertEquals("/", popRes.activePage?.route)
        assertFalse(popRes.activePage?.isSuspended == true)
        assertEquals(PageLifecycleState.RESUMED, popRes.activePage?.lifecycleState)
        assertFalse(popRes.activePage?.memoryTrimmed == true)
    }

    @Test
    fun `test popToRoot clears intermediate pages`() = runTest {
        pageStackManager.pushPage("/page1")
        pageStackManager.pushPage("/page2")
        val rootRes = pageStackManager.popToRoot()

        assertEquals("NAV_POP_TO_ROOT", rootRes.action)
        assertEquals(1, rootRes.stackDepth)
        assertEquals("/", rootRes.activePage?.route)
        assertFalse(rootRes.activePage?.isSuspended == true)
    }

    @Test
    fun `test maxStackDepth evicts oldest non-root page`() = runTest {
        pageStackManager.pushPage("/p1")
        pageStackManager.pushPage("/p2")
        // Now stack has 3: root, /p1, /p2
        val pushRes = pageStackManager.pushPage("/p3")
        // Stack should still have size 3: root, /p2, /p3 (/p1 evicted)

        val stack = pageStackManager.getStack()
        assertEquals(3, stack.size)
        assertEquals("/", stack[0].route)
        assertEquals("/p2", stack[1].route)
        assertEquals("/p3", stack[2].route)

        assertNotNull(pushRes.evictedPage)
        assertEquals("/p1", pushRes.evictedPage?.route)
        assertEquals(PageLifecycleState.DESTROYED, pushRes.evictedPage?.lifecycleState)
    }

    @Test
    fun `test replacePage replaces top entry without changing depth`() = runTest {
        pageStackManager.pushPage("/temp")
        val replaceRes = pageStackManager.replacePage("/permanent", "Permanent Page", mapOf("source" to "replace"))

        assertEquals("NAV_REPLACE", replaceRes.action)
        assertEquals(2, replaceRes.stackDepth)
        assertEquals("/permanent", replaceRes.activePage?.route)
        assertEquals("replace", replaceRes.activePage?.params?.get("source"))
    }

    @Test
    fun `test lifecycle listener callbacks`() = runTest {
        val events = CopyOnWriteArrayList<String>()
        val listener = object : PageLifecycleListener {
            override fun onPagePushed(entry: PageStackEntry) {
                events.add("PUSH:${entry.route}")
            }

            override fun onPageSuspended(entry: PageStackEntry) {
                events.add("SUSPEND:${entry.route}")
            }

            override fun onPagePopped(poppedEntry: PageStackEntry, newTopEntry: PageStackEntry?) {
                events.add("POP:${poppedEntry.route}->${newTopEntry?.route}")
            }

            override fun onPageResumed(entry: PageStackEntry) {
                events.add("RESUME:${entry.route}")
            }

            override fun onPageEvicted(entry: PageStackEntry) {
                events.add("EVICT:${entry.route}")
            }

            override fun onPageReplaced(oldEntry: PageStackEntry, newEntry: PageStackEntry) {
                events.add("REPLACE:${oldEntry.route}->${newEntry.route}")
            }
        }

        pageStackManager.registerLifecycleListener(listener)

        pageStackManager.pushPage("/sub1")
        pageStackManager.pushPage("/sub2")
        pageStackManager.pushPage("/sub3") // Triggers eviction of /sub1

        assertTrue(events.contains("SUSPEND:/"))
        assertTrue(events.contains("PUSH:/sub1"))
        assertTrue(events.contains("EVICT:/sub1"))

        pageStackManager.popPage()
        assertTrue(events.contains("POP:/sub3->/sub2"))
        assertTrue(events.contains("RESUME:/sub2"))

        pageStackManager.replacePage("/sub2_replaced")
        assertTrue(events.contains("REPLACE:/sub2->/sub2_replaced"))

        pageStackManager.unregisterLifecycleListener(listener)
    }

    @Test
    fun `test findPageById and findPagesByRoute`() = runTest {
        val res1 = pageStackManager.pushPage("/item")
        val pageId = res1.activePage!!.pageId

        val foundById = pageStackManager.findPageById(pageId)
        assertNotNull(foundById)
        assertEquals("/item", foundById?.route)

        val nonExistent = pageStackManager.findPageById("non-existent-id")
        assertNull(nonExistent)

        val pagesByRoute = pageStackManager.findPagesByRoute("/item")
        assertEquals(1, pagesByRoute.size)
    }

    @Test
    fun `test resetToRoot clears all pushed pages`() = runTest {
        pageStackManager.pushPage("/1")
        pageStackManager.pushPage("/2")
        assertEquals(3, pageStackManager.getStack().size)

        pageStackManager.resetToRoot()
        val stack = pageStackManager.getStack()
        assertEquals(1, stack.size)
        assertEquals("/", stack.first().route)
        assertEquals(PageLifecycleState.RESUMED, stack.first().lifecycleState)
    }
}

