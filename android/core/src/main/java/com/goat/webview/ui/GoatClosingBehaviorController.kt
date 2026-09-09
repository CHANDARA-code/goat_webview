package com.goat.webview.ui

/**
 * Mini-app closing and swipe-dismiss behaviour (Task 10173).
 *
 * A mini-app mid-form-entry sets `needConfirmation` so the host asks before dismissing, and clears
 * `allowVerticalSwipe` so the container's drag-to-dismiss gesture cannot pull the sheet away.
 *
 * Both flags are per-route, not per-mini-app: they reset to false when a new route loads, so a
 * confirmation armed on a form screen cannot keep blocking dismissal after the user navigates away
 * from it.
 */
object GoatClosingBehaviorController {

    @Volatile
    private var needConfirmationFlag: Boolean = false

    @Volatile
    private var allowVerticalSwipeFlag: Boolean = false

    /** True when a dismissal must route through a confirmation dialog first. */
    val needConfirmation: Boolean
        get() = needConfirmationFlag

    /** True when the container-level vertical drag-to-dismiss gesture is permitted. */
    val allowVerticalSwipe: Boolean
        get() = allowVerticalSwipeFlag

    fun setNeedConfirmation(value: Boolean) {
        needConfirmationFlag = value
    }

    fun setAllowVerticalSwipe(value: Boolean) {
        allowVerticalSwipeFlag = value
    }

    /**
     * Called when a new mini-app route loads.
     *
     * Without this, a mini-app that armed confirmation on a form screen would keep intercepting
     * back-press and close after navigating to an unrelated route -- the user would be asked to
     * discard changes on a screen that has none.
     */
    fun resetForNewRoute() {
        needConfirmationFlag = false
        allowVerticalSwipeFlag = false
    }

    /**
     * Whether a close request should be intercepted.
     *
     * Kept as its own function rather than reading [needConfirmation] at each call site so every
     * dismissal path -- hardware back, edge swipe, native close button -- asks the same question.
     */
    fun shouldConfirmClose(): Boolean = needConfirmationFlag

    internal fun resetForTesting() = resetForNewRoute()
}
