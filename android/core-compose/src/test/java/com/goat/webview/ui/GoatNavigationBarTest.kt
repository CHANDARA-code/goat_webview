package com.goat.webview.ui

import android.content.Context
import android.content.ContextWrapper
import android.content.res.Configuration
import android.content.res.Resources
import android.graphics.Color
import android.util.DisplayMetrics
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

/**
 * Unit Test Suite for GoatNavigationBar & GoatColorUtils (Milestone 2 / TC-F06-01 to TC-F06-05).
 */
class GoatNavigationBarTest {

    private lateinit var fakeContext: FakeTestContext

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this

        @Suppress("DEPRECATION")
        override fun getResources(): Resources {
            val config = Configuration().apply {
                screenWidthDp = 411
                screenHeightDp = 891
                uiMode = Configuration.UI_MODE_NIGHT_YES
            }
            val metrics = DisplayMetrics().apply {
                density = 2.0f
                widthPixels = 822
                heightPixels = 1782
            }
            return Resources(assets, metrics, config)
        }
    }

    @Before
    fun setUp() {
        fakeContext = FakeTestContext()
    }

    @Test
    fun testDefaultStateValues() {
        val state = GoatNavigationBarState()
        assertEquals("", state.title)
        assertNull(state.subtitle)
        assertEquals(0xFF0F172A.toInt(), state.backgroundColor)
        assertEquals(0xFFF8FAFC.toInt(), state.textColor)
        assertFalse(state.isDark)
        assertEquals(GoatNavButtonType.BACK, state.leftButton)
        assertEquals(listOf(GoatNavButtonType.MORE, GoatNavButtonType.CLOSE), state.rightButtons)
        assertFalse(state.isProgressVisible)
        assertNull(state.progress)
    }

    @Test
    fun testNavButtonTypeFromString() {
        assertEquals(GoatNavButtonType.BACK, GoatNavButtonType.fromString("BACK"))
        assertEquals(GoatNavButtonType.BACK, GoatNavButtonType.fromString("back"))
        assertEquals(GoatNavButtonType.CLOSE, GoatNavButtonType.fromString("CLOSE"))
        assertEquals(GoatNavButtonType.MORE, GoatNavButtonType.fromString("MORE"))
        assertEquals(GoatNavButtonType.CUSTOM, GoatNavButtonType.fromString("CUSTOM"))
        assertEquals(GoatNavButtonType.CUSTOM, GoatNavButtonType.fromString("UNKNOWN_BTN"))
        assertEquals(GoatNavButtonType.CUSTOM, GoatNavButtonType.fromString(null))
    }

    @Test
    fun testHexColorParsingValidFormats() {
        // 6-character hex
        val c1 = GoatColorUtils.parseHexColor("#FFFFFF")
        assertEquals(Color.WHITE, c1)

        val c2 = GoatColorUtils.parseHexColor("000000")
        assertEquals(Color.BLACK, c2)

        val c3 = GoatColorUtils.parseHexColor("#FF0000")
        assertEquals(Color.RED, c3)

        // 3-character hex (#RGB -> #RRGGBB)
        val cShort = GoatColorUtils.parseHexColor("#FFF")
        assertEquals(Color.WHITE, cShort)

        val cRedShort = GoatColorUtils.parseHexColor("#F00")
        assertEquals(Color.RED, cRedShort)

        // 8-character hex (#AARRGGBB)
        val cAlpha = GoatColorUtils.parseHexColor("#80FF0000")
        assertEquals(0x80FF0000.toInt(), cAlpha)

        // 4-character hex (#ARGB -> #AARRGGBB)
        val c4 = GoatColorUtils.parseHexColor("#F00F")
        assertEquals(0xFF0000FF.toInt(), c4)
    }

    @Test
    fun testHexColorParsingInvalidFormats() {
        val invalidColors = listOf("invalid", "#XYZ", "#12", "#12345", "#1234567", "#GG0000")
        for (inv in invalidColors) {
            try {
                GoatColorUtils.parseHexColor(inv)
                fail("Expected IllegalArgumentException for invalid color string '$inv'")
            } catch (e: IllegalArgumentException) {
                assertTrue(e.message?.contains("INVALID_ARGUMENT") == true)
            }
        }
    }

    @Test
    fun testViewProgrammaticMutations() {
        val navBarView = GoatNavigationBarView(fakeContext)

        navBarView.setTitle("My Mini App", "Online")
        assertEquals("My Mini App", navBarView.getState().title)
        assertEquals("Online", navBarView.getState().subtitle)

        navBarView.setColors("#1E293B", "#F1F5F9", isDark = true)
        assertEquals(GoatColorUtils.parseHexColor("#1E293B"), navBarView.getState().backgroundColor)
        assertEquals(GoatColorUtils.parseHexColor("#F1F5F9"), navBarView.getState().textColor)
        assertTrue(navBarView.getState().isDark)

        navBarView.setButtons(GoatNavButtonType.CLOSE, listOf(GoatNavButtonType.CUSTOM))
        assertEquals(GoatNavButtonType.CLOSE, navBarView.getState().leftButton)
        assertEquals(listOf(GoatNavButtonType.CUSTOM), navBarView.getState().rightButtons)

        navBarView.setProgress(visible = true, progress = 42)
        assertTrue(navBarView.getState().isProgressVisible)
        assertEquals(42, navBarView.getState().progress)

        var clickedButton: GoatNavButtonType? = null
        navBarView.setOnButtonClickListener { clickedButton = it }
        assertNull(clickedButton)
    }
}
