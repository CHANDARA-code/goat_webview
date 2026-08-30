package com.goat.webview

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Test

class GoatOffscreenCanvasPoolTest {

    private lateinit var canvasPool: GoatOffscreenCanvasPool

    @Before
    fun setUp() {
        canvasPool = GoatOffscreenCanvasPool(maxPoolSize = 2)
    }

    @Test
    fun testAcquireAndReleaseCycle() {
        val texture = canvasPool.acquire(1)
        assertNotNull(texture)
        assertEquals(1, canvasPool.getActiveAllocationCount())
        assertEquals(0, canvasPool.getPoolSize())

        canvasPool.release(texture)
        assertEquals(1, canvasPool.getPoolSize())

        val reused = canvasPool.acquire(2)
        assertEquals(reused, texture)
        assertEquals(0, canvasPool.getPoolSize())
    }

    @Test
    fun testPoolCapacityBound() {
        val t1 = canvasPool.acquire(1)
        val t2 = canvasPool.acquire(2)
        val t3 = canvasPool.acquire(3)

        canvasPool.release(t1)
        canvasPool.release(t2)
        canvasPool.release(t3) // Exceeds maxPoolSize (2) -> releases directly

        assertEquals(2, canvasPool.getPoolSize())
        canvasPool.clear()
        assertEquals(0, canvasPool.getPoolSize())
    }
}
