package com.goat.webview.ui

import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/** Task 10173. */
class GoatClosingBehaviorControllerTest {

    @Before
    fun setUp() = GoatClosingBehaviorController.resetForTesting()

    @After
    fun tearDown() = GoatClosingBehaviorController.resetForTesting()

    @Test
    fun bothFlagsDefaultToFalse() {
        assertFalse(GoatClosingBehaviorController.needConfirmation)
        assertFalse(GoatClosingBehaviorController.allowVerticalSwipe)
        assertFalse(GoatClosingBehaviorController.shouldConfirmClose())
    }

    @Test
    fun armingConfirmationGatesEveryDismissalPath() {
        GoatClosingBehaviorController.setNeedConfirmation(true)
        // shouldConfirmClose is what back-press, edge-swipe and the native close button all call,
        // so a single true here is what makes all three route through the dialog.
        assertTrue(GoatClosingBehaviorController.shouldConfirmClose())
    }

    @Test
    fun swipeFlagIsIndependentOfConfirmation() {
        GoatClosingBehaviorController.setNeedConfirmation(true)
        assertFalse(
            "arming confirmation must not silently re-enable the dismiss gesture",
            GoatClosingBehaviorController.allowVerticalSwipe
        )

        GoatClosingBehaviorController.setAllowVerticalSwipe(true)
        assertTrue(GoatClosingBehaviorController.allowVerticalSwipe)
        assertTrue(
            "enabling the swipe gesture must not disarm confirmation",
            GoatClosingBehaviorController.needConfirmation
        )
    }

    @Test
    fun aNewRouteResetsBothFlagsToDefaults() {
        GoatClosingBehaviorController.setNeedConfirmation(true)
        GoatClosingBehaviorController.setAllowVerticalSwipe(true)

        GoatClosingBehaviorController.resetForNewRoute()

        // Acceptance criterion 3. Without this a confirmation armed on a form screen would keep
        // asking "discard changes?" on a later route that has no changes to discard.
        assertFalse(GoatClosingBehaviorController.needConfirmation)
        assertFalse(GoatClosingBehaviorController.allowVerticalSwipe)
    }
}
