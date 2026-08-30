package com.goat.webview

import android.content.Context
import android.content.ContextWrapper
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Unit Test Suite for GoatSafeAreaManager & CSS Insets Injection (Milestone 2 / TC-F10-01 to TC-F10-05).
 */
class GoatSafeAreaManagerTest {

    private lateinit var fakeContext: FakeTestContext
    private lateinit var safeAreaManager: GoatSafeAreaManager

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
    }

    @Before
    fun setUp() {
        fakeContext = FakeTestContext()
        safeAreaManager = GoatSafeAreaManager(fakeContext)
    }

    @Test
    fun testDefaultInsetsState() {
        val insets = safeAreaManager.getInsets()
        assertEquals(0, insets.top)
        assertEquals(0, insets.bottom)
        assertEquals(0, insets.left)
        assertEquals(0, insets.right)
        assertEquals(0, insets.keyboardHeight)
        assertEquals(0, insets.totalBottom)
    }

    @Test
    fun testUpdateSafeAreaAndKeyboard() {
        val updated = safeAreaManager.updateSafeArea(top = 48, bottom = 34, left = 0, right = 0)
        assertEquals(48, updated.top)
        assertEquals(34, updated.bottom)
        assertEquals(0, updated.left)
        assertEquals(0, updated.right)
        assertEquals(0, updated.keyboardHeight)
        assertEquals(34, updated.totalBottom)

        // Soft keyboard opens with 320px
        val withKeyboard = safeAreaManager.updateKeyboardHeight(320)
        assertEquals(48, withKeyboard.top)
        assertEquals(34, withKeyboard.bottom)
        assertEquals(320, withKeyboard.keyboardHeight)
        assertEquals(354, withKeyboard.totalBottom)

        // Soft keyboard closes
        val withoutKeyboard = safeAreaManager.updateKeyboardHeight(0)
        assertEquals(0, withoutKeyboard.keyboardHeight)
        assertEquals(34, withoutKeyboard.totalBottom)
    }

    @Test
    fun testToJsonObjectFormatting() {
        safeAreaManager.updateSafeArea(top = 50, bottom = 40, left = 12, right = 12, keyboardHeight = 280)
        val json = safeAreaManager.toJsonObject()

        assertEquals("50", json["top"]?.jsonPrimitive?.content)
        assertEquals("40", json["bottom"]?.jsonPrimitive?.content)
        assertEquals("12", json["left"]?.jsonPrimitive?.content)
        assertEquals("12", json["right"]?.jsonPrimitive?.content)
        assertEquals("280", json["keyboardHeight"]?.jsonPrimitive?.content)
        assertEquals("320", json["totalBottom"]?.jsonPrimitive?.content)
    }

    @Test
    fun testGenerateCssInjectionScript() {
        val insets = safeAreaManager.updateSafeArea(top = 48, bottom = 34, left = 0, right = 0, keyboardHeight = 300)
        val script = safeAreaManager.generateCssInjectionScript(insets)

        assertTrue(script.contains("--safe-area-inset-top', '48px'"))
        assertTrue(script.contains("--safe-area-inset-bottom', '34px'"))
        assertTrue(script.contains("--keyboard-inset-bottom', '300px'"))
        assertTrue(script.contains("--goat-safe-area-top', '48px'"))
        assertTrue(script.contains("--goat-safe-area-bottom', '34px'"))
        assertTrue(script.contains("--goat-keyboard-height', '300px'"))
    }

    @Test
    fun testEventFormatting() {
        val safeEvent = safeAreaManager.formatSafeAreaEvent()
        assertNotNull(safeEvent["top"])
        assertNotNull(safeEvent["bottom"])

        val kbEvent = safeAreaManager.formatKeyboardInsetsEvent(keyboardHeight = 320, durationMs = 300L)
        assertEquals("320", kbEvent["keyboardHeight"]?.jsonPrimitive?.content)
        assertEquals("300", kbEvent["durationMs"]?.jsonPrimitive?.content)
        assertEquals("true", kbEvent["isVisible"]?.jsonPrimitive?.content)
    }
}
