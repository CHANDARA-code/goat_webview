package com.goat.webview

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Low-end adaptation. The engine used to behave identically on a 2 GB phone and a 12 GB flagship,
 * prewarming a standby WebView and parking two — good trades with RAM to spare, bad ones without.
 */
class GoatDeviceTierTest {

    @Before
    fun setUp() = GoatDeviceTier.resetForTesting()

    @After
    fun tearDown() {
        GoatDeviceTier.resetForTesting()
        GoatFastPool.trimMemory()
    }

    @Test
    fun overrideForcesTheLowEndPath() {
        GoatDeviceTier.setLowEndOverride(true)
        assertTrue(GoatDeviceTier.isLowEnd(FakeTestContext()))
    }

    @Test
    fun overrideCanAlsoForceTheNormalPath() {
        // A host shipping to known-good hardware may want the latency trade back.
        GoatDeviceTier.setLowEndOverride(false)
        assertFalse(GoatDeviceTier.isLowEnd(FakeTestContext()))
    }

    @Test
    fun clearingTheOverrideRestoresDetection() {
        GoatDeviceTier.setLowEndOverride(true)
        assertTrue(GoatDeviceTier.isLowEnd(FakeTestContext()))
        GoatDeviceTier.setLowEndOverride(null)
        GoatDeviceTier.resetForTesting()
        // FakeTestContext has no ActivityManager, so detection must fail safe to "not low-end"
        // rather than throwing or pessimising every device in a test environment.
        assertFalse(GoatDeviceTier.isLowEnd(FakeTestContext()))
    }

    @Test
    fun detectionFailureIsNotFatal() {
        // FakeTestContext returns no ActivityManager. Tiering must never break startup.
        GoatDeviceTier.setLowEndOverride(null)
        assertFalse(GoatDeviceTier.isLowEnd(FakeTestContext()))
    }

    @Test
    fun lowEndKeepsOneParkedInstanceInsteadOfTwo() {
        GoatDeviceTier.setLowEndOverride(true)
        assertEquals(1, GoatFastPool.effectiveMaxHotSize(FakeTestContext()))

        GoatDeviceTier.setLowEndOverride(false)
        assertEquals(GoatFastPool.MAX_HOT_SIZE, GoatFastPool.effectiveMaxHotSize(FakeTestContext()))
    }

    @Test
    fun aNullContextFallsBackToTheNormalCapRatherThanPessimising() {
        assertEquals(GoatFastPool.MAX_HOT_SIZE, GoatFastPool.effectiveMaxHotSize(null))
    }
}
