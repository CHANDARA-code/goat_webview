package com.goat.webview.ui

import android.content.Context
import android.content.ContextWrapper
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Unit Test Suite for GoatHapticFeedback 10-Waveform Engine (Milestone 2 / TC-F11-01 to TC-F11-05).
 */
class GoatHapticFeedbackTest {

    private lateinit var fakeContext: FakeTestContext
    private lateinit var hapticEngine: GoatHapticFeedback

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
    }

    @Before
    fun setUp() {
        fakeContext = FakeTestContext()
        hapticEngine = GoatHapticFeedback(fakeContext)
    }

    @Test
    fun testAll10ProfilesDefinedWithNonEmptyWaveforms() {
        assertEquals(10, GoatHapticFeedback.ALL_PROFILES.size)

        for ((name, profile) in GoatHapticFeedback.ALL_PROFILES) {
            assertNotNull(profile)
            assertEquals(name, profile.name)
            assertTrue("Timings must not be empty for $name", profile.timings.isNotEmpty())
            assertTrue("Amplitudes must not be empty for $name", profile.amplitudes.isNotEmpty())
            assertEquals(
                "Timings and amplitudes must match in length for $name",
                profile.timings.size,
                profile.amplitudes.size
            )
            assertTrue("Fallback timings must not be empty for $name", profile.fallbackTimings.isNotEmpty())
        }
    }

    @Test
    fun testProfileResolution() {
        // Impact styles
        val pLight = hapticEngine.resolveProfile("impact", "light", null)
        assertEquals(GoatHapticFeedback.IMPACT_LIGHT, pLight)

        val pMedium = hapticEngine.resolveProfile("impact", "medium", null)
        assertEquals(GoatHapticFeedback.IMPACT_MEDIUM, pMedium)

        val pHeavy = hapticEngine.resolveProfile("impact", "heavy", null)
        assertEquals(GoatHapticFeedback.IMPACT_HEAVY, pHeavy)

        val pRigid = hapticEngine.resolveProfile("impact", "rigid", null)
        assertEquals(GoatHapticFeedback.IMPACT_RIGID, pRigid)

        val pSoft = hapticEngine.resolveProfile("impact", "soft", null)
        assertEquals(GoatHapticFeedback.IMPACT_SOFT, pSoft)

        // Notification types
        val pSuccess = hapticEngine.resolveProfile("notification", null, "success")
        assertEquals(GoatHapticFeedback.NOTIFICATION_SUCCESS, pSuccess)

        val pWarning = hapticEngine.resolveProfile("notification", null, "warning")
        assertEquals(GoatHapticFeedback.NOTIFICATION_WARNING, pWarning)

        val pError = hapticEngine.resolveProfile("notification", null, "error")
        assertEquals(GoatHapticFeedback.NOTIFICATION_ERROR, pError)

        // Selection
        val pSelection = hapticEngine.resolveProfile("selection", null, null)
        assertEquals(GoatHapticFeedback.SELECTION_CHANGE, pSelection)

        // Legacy shortcuts
        val pLegacyLight = hapticEngine.resolveProfile("light", null, null)
        assertEquals(GoatHapticFeedback.IMPACT_LIGHT, pLegacyLight)

        val pLegacySuccess = hapticEngine.resolveProfile("success", null, null)
        assertEquals(GoatHapticFeedback.NOTIFICATION_SUCCESS, pLegacySuccess)
    }

    @Test
    fun testTriggerPayloadExecution() {
        val payload = buildJsonObject {
            put("type", "impact")
            put("style", "heavy")
        }

        val result = hapticEngine.trigger(payload)
        assertEquals("vibrated", result["status"]?.jsonPrimitive?.content)
        assertEquals("impact_heavy", result["profile"]?.jsonPrimitive?.content)
    }

    @Test
    fun testBurstThrottling() {
        val payload = buildJsonObject {
            put("type", "selection")
        }

        // First trigger succeeds
        val res1 = hapticEngine.trigger(payload)
        assertEquals("vibrated", res1["status"]?.jsonPrimitive?.content)

        // Immediate subsequent trigger (< 15ms) gets throttled
        val res2 = hapticEngine.trigger(payload)
        assertEquals("vibrated", res2["status"]?.jsonPrimitive?.content)
        assertEquals("true", res2["throttled"]?.jsonPrimitive?.content)
    }
}
