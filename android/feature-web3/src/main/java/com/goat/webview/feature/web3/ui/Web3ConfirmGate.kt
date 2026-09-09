package com.goat.webview.feature.web3.ui

import com.goat.webview.feature.web3.spi.DecodedTransactionPreview

enum class SlideOutcome { IDLE, SLIDING, CONFIRMED, CANCELLED }

/**
 * The confirmation gesture as a pure state machine, separate from any view.
 *
 * Kept out of the Compose layer on purpose: this is the part that decides whether a transaction is
 * authorised, so it has to be exercisable by ordinary unit tests rather than only by a UI test
 * that may never run. The rules it enforces:
 *
 *  - confirmation requires a continuous drag to 100%; releasing early resets to zero rather than
 *    latching, so a partial gesture can never accumulate into an approval;
 *  - a touch delivered while another window was overlaying this one is discarded outright
 *    (`MotionEvent.FLAG_WINDOW_IS_OBSCURED`), which is the tapjacking defence;
 *  - when calldata could not be decoded the slider stays locked until the user explicitly
 *    acknowledges the risk.
 */
class Web3ConfirmGate(
    private val requiresRiskAcknowledgement: Boolean,
    private val completionThreshold: Float = 1.0f
) {

    constructor(preview: DecodedTransactionPreview) : this(
        requiresRiskAcknowledgement = preview.isUnverifiedContract
    )

    var progress: Float = 0f
        private set

    var outcome: SlideOutcome = SlideOutcome.IDLE
        private set

    var riskAcknowledged: Boolean = false
        private set

    var obscuredTouchRejections: Int = 0
        private set

    val isSliderUnlocked: Boolean
        get() = !requiresRiskAcknowledgement || riskAcknowledged

    fun acknowledgeRisk(acknowledged: Boolean) {
        riskAcknowledged = acknowledged
        if (!acknowledged) reset()
    }

    /**
     * @param obscured true when the platform reported another window covering this one for the
     *   touch that produced [fraction]. Such a touch is never trusted, whatever it claims.
     */
    fun onDrag(fraction: Float, obscured: Boolean = false): SlideOutcome {
        if (obscured) {
            obscuredTouchRejections++
            reset()
            return outcome
        }
        if (!isSliderUnlocked) return outcome
        if (outcome == SlideOutcome.CONFIRMED) return outcome

        progress = fraction.coerceIn(0f, 1f)
        outcome = if (progress >= completionThreshold) SlideOutcome.CONFIRMED else SlideOutcome.SLIDING
        return outcome
    }

    /** A release below the threshold cancels; it must never be treated as a confirmation. */
    fun onRelease(): SlideOutcome {
        if (outcome == SlideOutcome.CONFIRMED) return outcome
        reset()
        outcome = SlideOutcome.CANCELLED
        return outcome
    }

    fun onCancel(): SlideOutcome {
        reset()
        outcome = SlideOutcome.CANCELLED
        return outcome
    }

    fun reset() {
        progress = 0f
        outcome = SlideOutcome.IDLE
    }
}

/**
 * The window-level anti-tapjacking flags, behind a seam so the policy is unit-testable without a
 * real `Window`. Threat A7: a translucent overlay positioned over the confirm control turns a
 * user's tap on something benign into an approval.
 */
interface Web3SecureWindow {
    fun setSecureFlag(enabled: Boolean)
    fun setFilterTouchesWhenObscured(enabled: Boolean)
    /** No-op below API 31, where the platform offers no equivalent. */
    fun setHideOverlayWindows(enabled: Boolean)
    val apiLevel: Int
}

object Web3ConfirmWindowGuard {

    const val MIN_SDK_HIDE_OVERLAYS = 31

    data class AppliedProtections(
        val secureFlag: Boolean,
        val filterObscuredTouches: Boolean,
        val hidOverlayWindows: Boolean
    )

    fun apply(window: Web3SecureWindow): AppliedProtections {
        window.setSecureFlag(true)
        window.setFilterTouchesWhenObscured(true)

        val canHideOverlays = window.apiLevel >= MIN_SDK_HIDE_OVERLAYS
        if (canHideOverlays) window.setHideOverlayWindows(true)

        return AppliedProtections(
            secureFlag = true,
            filterObscuredTouches = true,
            hidOverlayWindows = canHideOverlays
        )
    }

    fun release(window: Web3SecureWindow) {
        if (window.apiLevel >= MIN_SDK_HIDE_OVERLAYS) window.setHideOverlayWindows(false)
        window.setSecureFlag(false)
    }
}
