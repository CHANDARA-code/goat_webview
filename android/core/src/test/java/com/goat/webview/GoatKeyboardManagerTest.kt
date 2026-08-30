package com.goat.webview

import android.content.Context
import android.content.ContextWrapper
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GoatKeyboardManagerTest {

    private lateinit var fakeContext: FakeTestContext
    private lateinit var keyboardManager: GoatKeyboardManager

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
    }

    @Before
    fun setUp() {
        fakeContext = FakeTestContext()
        keyboardManager = GoatKeyboardManager(fakeContext)
    }

    @Test
    fun testKeyboardInsetsLifecycle() = runTest {
        val initial = keyboardManager.getCurrentInsets()
        assertFalse(initial.isVisible)
        assertEquals(0, initial.heightPx)

        // Keyboard shows with 840px height
        val openState = keyboardManager.updateKeyboardInsets(840, 250L)
        assertTrue(openState.isVisible)
        assertEquals(840, openState.heightPx)
        assertEquals(840, openState.adjustedViewportBottomInset)

        // Keyboard hides
        val closeState = keyboardManager.updateKeyboardInsets(0, 200L)
        assertFalse(closeState.isVisible)
        assertEquals(0, closeState.heightPx)
        assertEquals(0, closeState.adjustedViewportBottomInset)
    }
}
