package com.goat.webview

import com.goat.webview.ui.GoatClosingBehaviorController
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Task 10173: the confirmation gate on the dismissal path.
 *
 * The distinction that matters is that only an actual dismissal is gated -- a back press that pops
 * web history stays inside the mini-app, and prompting "discard changes?" on every in-app back
 * would be wrong.
 */
class GoatClosingConfirmationGateTest {

    private fun handler(
        onShowModal: (suspend (String, String, Boolean, String, String) -> Pair<Boolean, Boolean>)? = null
    ) = GoatBridgeActionHandler(
        context = FakeTestContext(),
        onShowModal = onShowModal
    )

    @Before
    fun setUp() = GoatClosingBehaviorController.resetForTesting()

    @After
    fun tearDown() = GoatClosingBehaviorController.resetForTesting()

    @Test
    fun dismissProceedsWhenNoConfirmationIsArmed() = runTest {
        val h = handler()
        val result = h.handleBackPress()
        assertEquals(
            BackPressAction.ACTIVITY_FINISH.name,
            result["action"]?.jsonPrimitive?.content
        )
    }

    @Test
    fun armedConfirmationBlocksDismissalWhenTheUserCancels() = runTest {
        var shown = false
        val h = handler { _, _, _, _, _ -> shown = true; Pair(false, true) }
        GoatClosingBehaviorController.setNeedConfirmation(true)

        val result = h.handleBackPress()

        assertTrue("the prompt must actually be presented", shown)
        assertEquals("DISMISS_CANCELLED", result["action"]?.jsonPrimitive?.content)
    }

    @Test
    fun armedConfirmationAllowsDismissalWhenTheUserConfirms() = runTest {
        val h = handler { _, _, _, _, _ -> Pair(true, false) }
        GoatClosingBehaviorController.setNeedConfirmation(true)

        val result = h.handleBackPress()

        assertEquals(
            BackPressAction.ACTIVITY_FINISH.name,
            result["action"]?.jsonPrimitive?.content
        )
    }

    @Test
    fun aWebHistoryPopIsNotGated() = runTest {
        var shown = false
        val h = handler { _, _, _, _, _ -> shown = true; Pair(false, true) }
        GoatClosingBehaviorController.setNeedConfirmation(true)
        h.handlePushHistoryState(buildJsonObject { put("route", "/form") })

        val result = h.handleBackPress()

        assertEquals(
            BackPressAction.WEB_HISTORY_POP.name,
            result["action"]?.jsonPrimitive?.content
        )
        assertTrue("popping in-app history must not prompt", !shown)
    }

    @Test
    fun aMissingHostDialogMustNotMakeTheMiniAppImpossibleToClose() = runTest {
        // No onShowModal wired. Refusing to close here would trap the user with no way out.
        val h = handler(onShowModal = null)
        GoatClosingBehaviorController.setNeedConfirmation(true)

        val result = h.handleBackPress()

        assertEquals(
            BackPressAction.ACTIVITY_FINISH.name,
            result["action"]?.jsonPrimitive?.content
        )
    }
}
