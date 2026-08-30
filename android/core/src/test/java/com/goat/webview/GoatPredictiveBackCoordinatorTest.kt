package com.goat.webview

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Unit test suite for GoatPredictiveBackCoordinator (Task 10126).
 */
class GoatPredictiveBackCoordinatorTest {

    private lateinit var coordinator: GoatPredictiveBackCoordinator

    @Before
    fun setUp() {
        coordinator = GoatPredictiveBackCoordinator()
    }

    @Test
    fun `test initial state is IDLE and depth is 1`() {
        assertEquals(GoatPredictiveBackCoordinator.GestureState.IDLE, coordinator.getGestureState())
        assertFalse(coordinator.isTrackingGesture())
        assertEquals(1, coordinator.getHistoryDepth())
    }

    @Test
    fun `test left edge swipe tracking and 120 FPS physics interpolation`() = runTest {
        coordinator.onBackStarted(GoatPredictiveBackCoordinator.EDGE_LEFT, 10f, 200f)
        assertTrue(coordinator.isTrackingGesture())
        assertEquals(GoatPredictiveBackCoordinator.GestureState.STARTED, coordinator.getGestureState())

        // 0% progress
        val p0 = coordinator.onBackProgressed(0.0f, 10f, 200f, GoatPredictiveBackCoordinator.EDGE_LEFT)
        assertEquals(0.0f, p0.progress, 0.0001f)
        assertEquals(1.0f, p0.interpolatedScale, 0.0001f)
        assertEquals(1.0f, p0.interpolatedAlpha, 0.0001f)
        assertEquals(0.0f, p0.interpolatedTranslationX, 0.0001f)

        // 50% progress
        val p50 = coordinator.onBackProgressed(0.5f, 200f, 400f, GoatPredictiveBackCoordinator.EDGE_LEFT)
        assertEquals(0.5f, p50.progress, 0.0001f)
        assertEquals(0.95f, p50.interpolatedScale, 0.0001f)
        assertEquals(0.925f, p50.interpolatedAlpha, 0.0001f)
        assertEquals(75.0f, p50.interpolatedTranslationX, 0.0001f)

        // 100% progress
        val p100 = coordinator.onBackProgressed(1.0f, 400f, 400f, GoatPredictiveBackCoordinator.EDGE_LEFT)
        assertEquals(1.0f, p100.progress, 0.0001f)
        assertEquals(0.90f, p100.interpolatedScale, 0.0001f)
        assertEquals(0.85f, p100.interpolatedAlpha, 0.0001f)
        assertEquals(150.0f, p100.interpolatedTranslationX, 0.0001f)
    }

    @Test
    fun `test right edge swipe translation direction`() = runTest {
        coordinator.onBackStarted(GoatPredictiveBackCoordinator.EDGE_RIGHT)

        val p50 = coordinator.onBackProgressed(0.5f, 800f, 300f, GoatPredictiveBackCoordinator.EDGE_RIGHT)
        assertEquals(0.5f, p50.progress, 0.0001f)
        assertEquals(-75.0f, p50.interpolatedTranslationX, 0.0001f)

        val p100 = coordinator.onBackProgressed(1.0f, 700f, 300f, GoatPredictiveBackCoordinator.EDGE_RIGHT)
        assertEquals(-150.0f, p100.interpolatedTranslationX, 0.0001f)
    }

    @Test
    fun `test progress clamping to unit interval`() = runTest {
        coordinator.onBackStarted()

        val underflow = coordinator.onBackProgressed(-0.5f, 0f, 0f)
        assertEquals(0.0f, underflow.progress, 0.0001f)
        assertEquals(1.0f, underflow.interpolatedScale, 0.0001f)

        val overflow = coordinator.onBackProgressed(1.5f, 0f, 0f)
        assertEquals(1.0f, overflow.progress, 0.0001f)
        assertEquals(0.90f, overflow.interpolatedScale, 0.0001f)
    }

    @Test
    fun `test gesture cancellation resets state and spring back`() = runTest {
        coordinator.onBackStarted()
        coordinator.onBackProgressed(0.6f)
        assertTrue(coordinator.isTrackingGesture())

        val cancelResult = coordinator.onBackCancelled()
        assertEquals("CANCELLED", cancelResult.action)
        assertFalse(coordinator.isTrackingGesture())
        assertEquals(GoatPredictiveBackCoordinator.GestureState.IDLE, coordinator.getGestureState())
    }

    @Test
    fun `test predictive back invoked with multi-depth history`() = runTest {
        coordinator.setHistoryDepth(3)
        assertEquals(3, coordinator.getHistoryDepth())

        // 1st Back invocation pops internal history (3 -> 2)
        coordinator.onBackStarted()
        val res1 = coordinator.onBackInvoked()
        assertEquals("COMMITTED", res1.action)
        assertTrue(res1.canGoBackInWebView)
        assertFalse(res1.poppedRoute)
        assertEquals(2, res1.remainingHistoryDepth)
        assertEquals(2, coordinator.getHistoryDepth())

        // 2nd Back invocation pops internal history (2 -> 1)
        coordinator.onBackStarted()
        val res2 = coordinator.onBackInvoked()
        assertTrue(res2.canGoBackInWebView)
        assertFalse(res2.poppedRoute)
        assertEquals(1, res2.remainingHistoryDepth)

        // 3rd Back invocation pops host Route / Activity
        coordinator.onBackStarted()
        val res3 = coordinator.onBackInvoked()
        assertFalse(res3.canGoBackInWebView)
        assertTrue(res3.poppedRoute)
        assertEquals(1, res3.remainingHistoryDepth)
    }

    @Test
    fun `test gesture listener lifecycle callbacks`() = runTest {
        val events = CopyOnWriteArrayList<String>()
        val listener = object : GoatPredictiveBackCoordinator.BackGestureListener {
            override fun onGestureStarted(swipeEdge: Int, touchX: Float, touchY: Float) {
                events.add("STARTED:$swipeEdge")
            }

            override fun onGestureProgress(progress: GoatPredictiveBackCoordinator.BackGestureProgress) {
                events.add("PROGRESS:${progress.progress}")
            }

            override fun onGestureInvoked(result: GoatPredictiveBackCoordinator.BackNavigationResult) {
                events.add("INVOKED:${result.action}")
            }

            override fun onGestureCancelled(result: GoatPredictiveBackCoordinator.BackNavigationResult) {
                events.add("CANCELLED:${result.action}")
            }
        }

        coordinator.registerGestureListener(listener)

        coordinator.onBackStarted(GoatPredictiveBackCoordinator.EDGE_LEFT, 50f, 100f)
        coordinator.onBackProgressed(0.4f)
        coordinator.onBackInvoked()

        assertTrue(events.contains("STARTED:0"))
        assertTrue(events.contains("PROGRESS:0.4"))
        assertTrue(events.contains("INVOKED:COMMITTED"))

        coordinator.onBackStarted(GoatPredictiveBackCoordinator.EDGE_RIGHT)
        coordinator.onBackCancelled()
        assertTrue(events.contains("STARTED:1"))
        assertTrue(events.contains("CANCELLED:CANCELLED"))

        coordinator.unregisterGestureListener(listener)
    }

    @Test
    fun `test history depth lower bound is 1`() {
        coordinator.setHistoryDepth(-10)
        assertEquals(1, coordinator.getHistoryDepth())
    }
}

