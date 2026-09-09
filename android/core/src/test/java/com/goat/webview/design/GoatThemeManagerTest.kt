package com.goat.webview.design

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GoatThemeManagerTest {

    @Before
    fun setUp() {
        GoatThemeManager.resetForTesting()
        GoatDesignManager.resetForTesting()
    }

    @After
    fun tearDown() {
        GoatThemeManager.resetForTesting()
        GoatDesignManager.resetForTesting()
    }

    @Test
    fun defaultsToLight() {
        assertEquals(GoatThemeTokens.LIGHT, GoatThemeManager.current.colorScheme)
    }

    @Test
    fun setColorSchemeSwapsTheWholePalette() {
        GoatThemeManager.setColorScheme(dark = true)
        val t = GoatThemeManager.current
        assertEquals(GoatThemeTokens.DARK, t.colorScheme)
        assertEquals("#1c1c1d", t.bgColor)
        assertEquals("#ffffff", t.textColor)
    }

    @Test
    fun updateThemeKeepsUnspecifiedFields() {
        GoatThemeManager.updateTheme { it.copy(buttonColor = "#ff0000") }
        val t = GoatThemeManager.current
        assertEquals("#ff0000", t.buttonColor)
        // A host that only cares about one colour must not silently lose the rest.
        assertEquals(GoatThemeTokens.DEFAULT_LIGHT.bgColor, t.bgColor)
        assertEquals(GoatThemeTokens.DEFAULT_LIGHT.linkColor, t.linkColor)
    }

    @Test
    fun listenersFireOnChange() {
        var fired = 0
        GoatThemeManager.addListener { fired++ }
        GoatThemeManager.setColorScheme(dark = true)
        assertEquals(1, fired)
    }

    @Test
    fun anIdenticalThemeDoesNotNotify() {
        var fired = 0
        GoatThemeManager.addListener { fired++ }
        GoatThemeManager.setTheme(GoatThemeTokens.DEFAULT_LIGHT)
        // Already light. Re-pushing identical tokens would re-run every mini-app's themeChanged
        // handler and repaint for nothing.
        assertEquals(0, fired)
    }

    @Test
    fun aThrowingListenerDoesNotStopTheOthers() {
        var reached = false
        GoatThemeManager.addListener { throw RuntimeException("boom") }
        GoatThemeManager.addListener { reached = true }
        GoatThemeManager.setColorScheme(dark = true)
        assertTrue(reached)
    }

    @Test
    fun removedListenersStopFiring() {
        var fired = 0
        val l = GoatThemeManager.Listener { fired++ }
        GoatThemeManager.addListener(l)
        GoatThemeManager.removeListener(l)
        GoatThemeManager.setColorScheme(dark = true)
        assertEquals(0, fired)
    }

    @Test
    fun telegramKeyNamesAreEmitted() {
        // A mini-app ported from Telegram looks for these exact keys.
        val map = GoatThemeTokens.DEFAULT_LIGHT.toMap()
        for (k in listOf(
            "bg_color", "text_color", "hint_color", "link_color",
            "button_color", "button_text_color", "secondary_bg_color"
        )) {
            assertTrue("missing Telegram key: $k", map.containsKey(k))
        }
    }

    @Test
    fun designManagerIsIndependentOfTheme() {
        var designFired = 0
        GoatDesignManager.addListener { designFired++ }
        GoatThemeManager.setColorScheme(dark = true)
        assertEquals("a colour change must not invalidate the design scale", 0, designFired)

        GoatDesignManager.updateDesign { it.copy(spacingUnit = "4px") }
        assertEquals(1, designFired)
        assertEquals("4px", GoatDesignManager.current.spacingUnit)
    }

    @Test
    fun verboseIsOffByDefault() {
        assertFalse(GoatThemeManager.verbose)
        assertFalse(GoatDesignManager.verbose)
    }
}
