package com.goat.webview.feature.web3.ui

import com.goat.webview.feature.web3.spi.DecodedTransactionPreview
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class Web3ConfirmGateTest {

    private class FakeWindow(override val apiLevel: Int) : Web3SecureWindow {
        var secure = false
        var filterObscured = false
        var hideOverlays = false
        var hideOverlaysCalls = 0

        override fun setSecureFlag(enabled: Boolean) { secure = enabled }
        override fun setFilterTouchesWhenObscured(enabled: Boolean) { filterObscured = enabled }
        override fun setHideOverlayWindows(enabled: Boolean) {
            hideOverlays = enabled
            hideOverlaysCalls++
        }
    }

    private fun preview(unverified: Boolean) = DecodedTransactionPreview(
        networkName = "Ethereum", recipient = "0xdead",
        valueFormatted = "1", feeFormatted = "0.001",
        methodName = "approve", methodDescription = "test",
        isUnverifiedContract = unverified
    )

    // ---- Slide gesture ----

    @Test
    fun testConfirmationRequiresReachingTheFullThreshold() {
        val gate = Web3ConfirmGate(requiresRiskAcknowledgement = false)
        assertEquals(SlideOutcome.SLIDING, gate.onDrag(0.5f))
        assertEquals(SlideOutcome.SLIDING, gate.onDrag(0.99f))
        assertEquals(SlideOutcome.CONFIRMED, gate.onDrag(1.0f))
    }

    @Test
    fun testReleasingBelowThresholdCancelsAndResetsProgress() {
        val gate = Web3ConfirmGate(requiresRiskAcknowledgement = false)
        gate.onDrag(0.95f)
        assertEquals(SlideOutcome.CANCELLED, gate.onRelease())
        assertEquals(0f, gate.progress, 0.0001f)
    }

    @Test
    fun testPartialGesturesCannotAccumulateIntoAConfirmation() {
        val gate = Web3ConfirmGate(requiresRiskAcknowledgement = false)
        repeat(20) {
            gate.onDrag(0.9f)
            gate.onRelease()
        }
        assertFalse("repeated partial drags must never confirm", gate.outcome == SlideOutcome.CONFIRMED)
        assertEquals(0f, gate.progress, 0.0001f)
    }

    @Test
    fun testOnceConfirmedTheOutcomeIsStable() {
        val gate = Web3ConfirmGate(requiresRiskAcknowledgement = false)
        gate.onDrag(1.0f)
        assertEquals(SlideOutcome.CONFIRMED, gate.onDrag(0.1f))
        assertEquals(SlideOutcome.CONFIRMED, gate.onRelease())
    }

    @Test
    fun testExplicitCancelResets() {
        val gate = Web3ConfirmGate(requiresRiskAcknowledgement = false)
        gate.onDrag(0.6f)
        assertEquals(SlideOutcome.CANCELLED, gate.onCancel())
        assertEquals(0f, gate.progress, 0.0001f)
    }

    @Test
    fun testProgressIsClampedToTheValidRange() {
        val gate = Web3ConfirmGate(requiresRiskAcknowledgement = false)
        gate.onDrag(-5f)
        assertEquals(0f, gate.progress, 0.0001f)
        gate.onDrag(50f)
        assertEquals(1f, gate.progress, 0.0001f)
    }

    // ---- Tapjacking (threat A7) ----

    @Test
    fun testTouchDeliveredWhileObscuredIsDiscardedNotConfirmed() {
        val gate = Web3ConfirmGate(requiresRiskAcknowledgement = false)
        val outcome = gate.onDrag(1.0f, obscured = true)
        assertEquals("an obscured touch must never confirm", SlideOutcome.IDLE, outcome)
        assertEquals(0f, gate.progress, 0.0001f)
        assertEquals(1, gate.obscuredTouchRejections)
    }

    @Test
    fun testAnObscuredTouchMidGestureResetsTheWholeGesture() {
        val gate = Web3ConfirmGate(requiresRiskAcknowledgement = false)
        gate.onDrag(0.9f)
        gate.onDrag(0.95f, obscured = true)
        assertEquals(0f, gate.progress, 0.0001f)
        assertEquals(SlideOutcome.IDLE, gate.outcome)
        assertEquals(SlideOutcome.SLIDING, gate.onDrag(0.5f))
    }

    // ---- Unverified-contract acknowledgement ----

    @Test
    fun testSliderIsLockedUntilUnverifiedContractRiskIsAcknowledged() {
        val gate = Web3ConfirmGate(preview(unverified = true))
        assertFalse(gate.isSliderUnlocked)
        assertEquals(SlideOutcome.IDLE, gate.onDrag(1.0f))

        gate.acknowledgeRisk(true)
        assertTrue(gate.isSliderUnlocked)
        assertEquals(SlideOutcome.CONFIRMED, gate.onDrag(1.0f))
    }

    @Test
    fun testWithdrawingAcknowledgementRelocksAndResets() {
        val gate = Web3ConfirmGate(preview(unverified = true))
        gate.acknowledgeRisk(true)
        gate.onDrag(0.8f)
        gate.acknowledgeRisk(false)
        assertFalse(gate.isSliderUnlocked)
        assertEquals(0f, gate.progress, 0.0001f)
    }

    @Test
    fun testAVerifiedContractNeedsNoAcknowledgement() {
        val gate = Web3ConfirmGate(preview(unverified = false))
        assertTrue(gate.isSliderUnlocked)
        assertEquals(SlideOutcome.CONFIRMED, gate.onDrag(1.0f))
    }

    // ---- Window protections ----

    @Test
    fun testAllThreeProtectionsAreAppliedOnModernAndroid() {
        val window = FakeWindow(apiLevel = 34)
        val applied = Web3ConfirmWindowGuard.apply(window)

        assertTrue("FLAG_SECURE must be set", window.secure)
        assertTrue("obscured touches must be filtered", window.filterObscured)
        assertTrue("overlay windows must be hidden on API 31+", window.hideOverlays)
        assertEquals(
            Web3ConfirmWindowGuard.AppliedProtections(true, true, true),
            applied
        )
    }

    @Test
    fun testOverlayHidingIsSkippedBelowApi31ButTheOthersStillApply() {
        val window = FakeWindow(apiLevel = 30)
        val applied = Web3ConfirmWindowGuard.apply(window)

        assertTrue(window.secure)
        assertTrue(window.filterObscured)
        assertFalse("setHideOverlayWindows does not exist below API 31", applied.hidOverlayWindows)
        assertEquals(0, window.hideOverlaysCalls)
    }

    @Test
    fun testReleaseClearsTheProtections() {
        val window = FakeWindow(apiLevel = 34)
        Web3ConfirmWindowGuard.apply(window)
        Web3ConfirmWindowGuard.release(window)
        assertFalse(window.secure)
        assertFalse(window.hideOverlays)
    }
}
