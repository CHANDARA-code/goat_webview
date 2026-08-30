package com.goat.webview.rendering

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class GoatAdaptiveRefreshRateManagerTest {

    @Test
    fun elevatesDuringGestureAndSettlesAfterIdleWindow() = runTest {
        val manager = GoatAdaptiveRefreshRateManager(idleSettleAfterMs = 300L, scope = this)
        val applied = mutableListOf<Boolean>()
        manager.onElevateRefreshRate = { elevate ->
            applied.add(elevate)
            true
        }

        manager.onGestureActive()
        assertTrue(manager.isElevated())

        manager.onGestureSettled()
        assertTrue(manager.isElevated())

        advanceTimeBy(299)
        assertTrue(manager.isElevated())

        advanceTimeBy(2)
        assertFalse(manager.isElevated())
        assertTrue(applied == listOf(true, false))
    }

    @Test
    fun repeatedGesturesKeepElevationWithoutDuplicateCalls() = runTest {
        val manager = GoatAdaptiveRefreshRateManager(idleSettleAfterMs = 300L, scope = this)
        var elevateCalls = 0
        manager.onElevateRefreshRate = { elevate ->
            if (elevate) elevateCalls++
            true
        }

        manager.onGestureActive()
        manager.onGestureActive()
        manager.onGestureActive()
        assertTrue(elevateCalls == 1)
        assertTrue(manager.isElevated())
    }

    @Test
    fun unsupportedDeviceFallsBackWithoutElevation() = runTest {
        val manager = GoatAdaptiveRefreshRateManager(idleSettleAfterMs = 300L, scope = this)
        manager.onElevateRefreshRate = { false }

        manager.onGestureActive()
        assertFalse(manager.isElevated())
    }

    @Test
    fun disabledManagerNeverElevatesAndDropsImmediately() = runTest {
        val manager = GoatAdaptiveRefreshRateManager(idleSettleAfterMs = 300L, scope = this)
        var elevated = false
        manager.onElevateRefreshRate = { value ->
            elevated = value
            true
        }

        manager.onGestureActive()
        assertTrue(elevated)

        manager.setEnabled(false)
        assertFalse(elevated)
        assertFalse(manager.isElevated())

        manager.onGestureActive()
        assertFalse(manager.isElevated())
    }

    @Test
    fun missingHostCallbackIsASafeNoOp() = runTest {
        val manager = GoatAdaptiveRefreshRateManager(idleSettleAfterMs = 300L, scope = this)
        manager.onGestureActive()
        manager.onGestureSettled()
        advanceTimeBy(500)
        assertFalse(manager.isElevated())
    }
}
