package com.goat.webview.design

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GoatDesignBootstrapTest {

    @Test
    fun cssVariablesUseDashesNotUnderscores() {
        assertTrue(
            GoatDesignBootstrap.cssVariableName("bg_color", "goat-theme") == "--goat-theme-bg-color"
        )
    }

    @Test
    fun styleTextCarriesEveryThemeAndDesignToken() {
        val css = GoatDesignBootstrap.buildStyleText(
            GoatThemeTokens.DEFAULT_LIGHT, GoatDesignTokens.DEFAULT
        )
        for (k in GoatThemeTokens.DEFAULT_LIGHT.toMap().keys) {
            assertTrue("theme token missing from CSS: $k",
                css.contains(GoatDesignBootstrap.cssVariableName(k, "goat-theme")))
        }
        for (k in GoatDesignTokens.DEFAULT.toMap().keys) {
            assertTrue("design token missing from CSS: $k",
                css.contains(GoatDesignBootstrap.cssVariableName(k, "goat-design")))
        }
    }

    @Test
    fun telegramAliasesAreEmittedSoAPortedMiniAppRendersUnchanged() {
        val css = GoatDesignBootstrap.buildStyleText(
            GoatThemeTokens.DEFAULT_LIGHT, GoatDesignTokens.DEFAULT
        )
        assertTrue(css.contains("--tg-theme-bg-color"))
        assertTrue(css.contains("--tg-theme-button-color"))
    }

    @Test
    fun colorSchemeIsDeclaredSoNativeControlsMatch() {
        val css = GoatDesignBootstrap.buildStyleText(
            GoatThemeTokens.DEFAULT_DARK, GoatDesignTokens.DEFAULT
        )
        // Without this, form controls and scrollbars stay light on a dark host.
        assertTrue(css.contains("color-scheme:dark"))
    }

    @Test
    fun aTokenContainingQuotesCannotBreakOutOfTheScript() {
        // Host-supplied values become script content. A naive string concat would let this close
        // the literal and inject arbitrary JS into every mini-app.
        //
        // Asserted by round-trip rather than substring: the payload legitimately CONTAINS the
        // hostile text in escaped form, so `contains` proves nothing. What matters is that the
        // emitted JSON still parses and yields the value verbatim -- which is only true if every
        // quote was escaped.
        val hostile = GoatThemeTokens.DEFAULT_LIGHT.copy(
            bgColor = "\"; window.__pwned = true; var x = \"",
            textColor = "</script><script>window.__pwned2=1;</script>"
        )
        val js = GoatDesignBootstrap.buildScript(hostile, GoatDesignTokens.DEFAULT)

        // Take the whole line: the hostile value contains ';', so splitting on the first one
        // truncates the JSON mid-string.
        val line = js.lineSequence().first { it.trimStart().startsWith("app.themeParams = ") }
        val payload = line.substringAfter("app.themeParams = ").trim().removeSuffix(";")
        val parsed = Json.parseToJsonElement(payload).jsonObject

        assertEquals(hostile.bgColor, parsed["bg_color"]?.jsonPrimitive?.content)
        assertEquals(hostile.textColor, parsed["text_color"]?.jsonPrimitive?.content)

        // And the raw quote must never appear unescaped inside the literal.
        assertFalse(
            "an unescaped quote survived into the script",
            js.contains("= \"; window.__pwned")
        )
    }

    @Test
    fun theBootstrapIsIdempotentByConstruction() {
        val js = GoatDesignBootstrap.buildScript(
            GoatThemeTokens.DEFAULT_LIGHT, GoatDesignTokens.DEFAULT
        )
        // Re-running must reuse the same <style> element rather than appending a second one on
        // every navigation.
        assertTrue(js.contains("getElementById(STYLE_ID)"))
        assertTrue(js.contains("window.GoatWebApp = app"))
    }

    @Test
    fun updateScriptTargetsTheLivePageWithoutReload() {
        val js = GoatDesignBootstrap.buildUpdateScript(
            GoatThemeTokens.DEFAULT_DARK, GoatDesignTokens.DEFAULT
        )
        assertTrue(js.contains("__applyTokens"))
        assertTrue(js.contains("dark"))
        // Guarded, because a host may change theme before any page has loaded.
        assertTrue(js.startsWith("window.GoatWebApp &&"))
    }
}
