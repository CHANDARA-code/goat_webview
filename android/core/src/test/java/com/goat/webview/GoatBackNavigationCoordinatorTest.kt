package com.goat.webview

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GoatBackNavigationCoordinatorTest {

    private lateinit var coordinator: GoatBackNavigationCoordinator

    @Before
    fun setup() {
        coordinator = GoatBackNavigationCoordinator()
    }

    @Test
    fun `test initial state cannot go back and finishes activity on back press (Task 10094)`() = runTest {
        assertFalse(coordinator.canGoBack())
        assertEquals("/", coordinator.getCurrentRoute())

        val result = coordinator.handleBackPress()
        assertEquals("ACTIVITY_FINISH", result.action)
        assertFalse(result.canGoBack)
        assertEquals(0, result.currentHistoryIndex)
    }

    @Test
    fun `test multi-route history push and pop rewinds until root`() = runTest {
        coordinator.pushState("/home")
        coordinator.pushState("/details")
        coordinator.pushState("/checkout")

        assertTrue(coordinator.canGoBack())
        assertEquals("/checkout", coordinator.getCurrentRoute())

        // 1st Back: pops /checkout -> /details
        val res1 = coordinator.handleBackPress()
        assertEquals("WEB_HISTORY_POP", res1.action)
        assertEquals("/checkout", res1.routePopped)
        assertTrue(res1.canGoBack)

        // 2nd Back: pops /details -> /home
        val res2 = coordinator.handleBackPress()
        assertEquals("WEB_HISTORY_POP", res2.action)
        assertEquals("/details", res2.routePopped)
        assertTrue(res2.canGoBack)

        // 3rd Back: pops /home -> /
        val res3 = coordinator.handleBackPress()
        assertEquals("WEB_HISTORY_POP", res3.action)
        assertFalse(res3.canGoBack)

        // 4th Back: root reached -> finishes activity
        val res4 = coordinator.handleBackPress()
        assertEquals("ACTIVITY_FINISH", res4.action)
    }

    @Test
    fun `test zero back-press gesture stalls on rapid back presses`() = runTest {
        coordinator.pushState("/1")
        coordinator.pushState("/2")
        val res1 = coordinator.handleBackPress()
        val res2 = coordinator.handleBackPress()
        val res3 = coordinator.handleBackPress()
        assertEquals("WEB_HISTORY_POP", res1.action)
        assertEquals("WEB_HISTORY_POP", res2.action)
        assertEquals("ACTIVITY_FINISH", res3.action)
    }
}
