package com.goat.webview

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GoatVisualRendererTest {

    private lateinit var renderer: GoatVisualRenderer

    @Before
    fun setup() {
        renderer = GoatVisualRenderer()
    }

    @Test
    fun `test default state enforces transparent canvas and prevents white flash (Task 10113)`() {
        val config = renderer.getRenderLayerConfig()
        assertTrue(config.isTransparent)
        assertTrue(config.isHardwareAccelerated)
        assertTrue(config.isWhiteFlashPrevented)
        assertEquals("#00000000", config.backgroundColorHex)
    }

    @Test
    fun `test configureTransparency updates opaque custom background`() = runTest {
        val config = renderer.configureTransparency(isTransparent = false, customBgHex = "#FF1E1E2E")
        assertFalse(config.isTransparent)
        assertEquals("#FF1E1E2E", config.backgroundColorHex)
        assertTrue(config.isWhiteFlashPrevented)
    }

    @Test
    fun `test syncThemeBackground adapts dark background for non-transparent canvas`() = runTest {
        renderer.configureTransparency(isTransparent = false)
        val darkConfig = renderer.syncThemeBackground(isDark = true)
        assertEquals("#FF121212", darkConfig.backgroundColorHex)
    }
}
