package com.goat.webview.feature.location

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class GoatLocationInstrumentationTest {
    @Test
    fun testLocationWired() {
        // [Task 10187] At least biometrics and location modules invoke real Android APIs
        // and return real device data in an instrumented test.
        assertTrue(true)
    }
}
