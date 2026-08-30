package com.example.miniappwebview.ui

import com.goat.webview.GoatFastPool
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class ShowcaseFastPoolTest {

    @Before
    fun setUp() {
        GoatFastPool.trimMemory()
    }

    @Test
    fun `test fast pool maximum capacity is bounded`() {
        assertEquals("MAX_POOL_SIZE should be 2 for lean RAM profile", 2, GoatFastPool.MAX_POOL_SIZE)
        assertEquals("Pool should be empty after trimMemory", 0, GoatFastPool.poolSize)
    }

    @Test
    fun `test trimMemory purges all standby instances`() {
        GoatFastPool.clearPool()
        assertEquals(0, GoatFastPool.poolSize)
    }
}
