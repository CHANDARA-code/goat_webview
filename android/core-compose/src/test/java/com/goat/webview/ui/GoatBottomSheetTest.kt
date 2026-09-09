package com.goat.webview.ui

import android.content.Context
import android.content.ContextWrapper
import android.content.res.Configuration
import android.content.res.Resources
import android.util.DisplayMetrics
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Unit Test Suite for GoatBottomSheet & Snap Calculations (Milestone 2 / TC-F08-01 to TC-F08-05).
 */
class GoatBottomSheetTest {

    private lateinit var fakeContext: FakeTestContext

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this

        @Suppress("DEPRECATION")
        override fun getResources(): Resources {
            val config = Configuration().apply {
                screenWidthDp = 411
                screenHeightDp = 891
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
    fun testSnapPointsSanitization() {
        // Unsorted and containing out-of-bound fractions
        val raw = listOf(1.5f, 0.9f, 0.05f, 0.5f, 0.25f, 0.5f)
        val sanitized = GoatBottomSheetConfig.sanitizeSnapPoints(raw)

        assertEquals(listOf(0.1f, 0.25f, 0.5f, 0.9f, 1.0f), sanitized)

        // Empty list falls back to default [0.25, 0.5, 0.9]
        val emptySanitized = GoatBottomSheetConfig.sanitizeSnapPoints(emptyList())
        assertEquals(listOf(0.25f, 0.5f, 0.9f), emptySanitized)
    }

    @Test
    fun testExpandAndCollapseTransitions() {
        val state = GoatBottomSheetState(
            snapPoints = listOf(0.25f, 0.5f, 0.9f),
            currentSnap = 0.5f,
            isDismissible = true
        )

        // Expand from 0.5 -> 0.9
        val expandedSnap = state.expand()
        assertEquals(0.9f, expandedSnap)

        // Expand again from 0.9 stays at 0.9 (max)
        val expandedMax = state.copy(currentSnap = expandedSnap).expand()
        assertEquals(0.9f, expandedMax)

        // Collapse from 0.5 -> 0.25
        val (collapsedSnap, dismissed1) = state.collapse()
        assertEquals(0.25f, collapsedSnap)
        assertFalse(dismissed1)

        // Collapse from 0.25 (minimum snap) with isDismissible = true -> dismissed
        val (dismissedSnap, isDismissed) = state.copy(currentSnap = 0.25f).collapse()
        assertEquals(0.0f, dismissedSnap)
        assertTrue(isDismissed)

        // Collapse from 0.25 with isDismissible = false -> stays at 0.25
        val nonDismissibleState = state.copy(currentSnap = 0.25f, isDismissible = false)
        val (heldSnap, heldDismissed) = nonDismissibleState.collapse()
        assertEquals(0.25f, heldSnap)
        assertFalse(heldDismissed)
    }

    @Test
    fun testSheetValueFromFraction() {
        val snapPoints = listOf(0.25f, 0.5f, 0.9f)

        assertEquals(GoatSheetValue.HIDDEN, GoatSheetValue.fromSnapFraction(0.0f, snapPoints))
        assertEquals(GoatSheetValue.COLLAPSED, GoatSheetValue.fromSnapFraction(0.25f, snapPoints))
        assertEquals(GoatSheetValue.HALF, GoatSheetValue.fromSnapFraction(0.5f, snapPoints))
        assertEquals(GoatSheetValue.EXPANDED, GoatSheetValue.fromSnapFraction(0.9f, snapPoints))
    }

    @Test
    fun testBottomSheetContainerState() {
        val container = GoatBottomSheetContainer(fakeContext)

        container.setSnapPoints(listOf(0.3f, 0.6f, 0.95f), initialSnap = 0.6f, isDismissible = true)
        assertEquals(listOf(0.3f, 0.6f, 0.95f), container.getState().snapPoints)
        assertEquals(0.6f, container.getState().currentSnap)
        assertTrue(container.getState().isDismissible)

        var snapEmitted: Float? = null
        var sheetValueEmitted: GoatSheetValue? = null
        container.setOnSnapListener { snap, value ->
            snapEmitted = snap
            sheetValueEmitted = value
        }

        val next = container.expand()
        assertEquals(0.95f, next)
        assertEquals(0.95f, snapEmitted)
        assertEquals(GoatSheetValue.EXPANDED, sheetValueEmitted)

        val (prev, dism) = container.collapse()
        assertEquals(0.6f, prev)
        assertFalse(dism)
        assertEquals(0.6f, snapEmitted)
    }
}
