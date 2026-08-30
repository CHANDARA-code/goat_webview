package com.goat.webview

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Unit test suite for GoatGestureScrollCoordinator (Task 10079).
 */
class GoatGestureScrollCoordinatorTest {

    private lateinit var coordinator: GoatGestureScrollCoordinator

    @Before
    fun setUp() {
        coordinator = GoatGestureScrollCoordinator()
    }

    @Test
    fun `test initial state is at top boundary`() {
        val state = coordinator.getGestureState()
        assertTrue(state.isScrollBoundaryReached)
        assertTrue(state.canParentIntercept)
        assertEquals(0, state.scrollOffsetPx)
        assertEquals("VERTICAL", state.activeDirection)
        assertFalse(state.isFlingActive)
    }

    @Test
    fun `test scrolling mid content prevents parent interception`() = runTest {
        val state = coordinator.updateScrollPosition(scrollY = 150, maxScrollY = 1000)
        assertFalse(state.isScrollBoundaryReached)
        assertFalse(state.canParentIntercept)
        assertEquals(150, state.scrollOffsetPx)

        val shouldIntercept = coordinator.shouldParentInterceptTouch(deltaY = -20f, isOverscrollAllowed = false)
        assertFalse(shouldIntercept)
    }

    @Test
    fun `test scrolling at bottom boundary allows parent overscroll`() = runTest {
        coordinator.updateScrollPosition(scrollY = 1000, maxScrollY = 1000)
        val shouldIntercept = coordinator.shouldParentInterceptTouch(deltaY = -20f, isOverscrollAllowed = true)
        assertTrue(shouldIntercept)
    }

    @Test
    fun `test fling momentum tracking and reset`() = runTest {
        coordinator.setFlingActive(true)
        assertTrue(coordinator.getGestureState().isFlingActive)

        coordinator.reset()
        val resetState = coordinator.getGestureState()
        assertFalse(resetState.isFlingActive)
        assertEquals(0, resetState.scrollOffsetPx)
        assertTrue(resetState.isScrollBoundaryReached)
    }
}
