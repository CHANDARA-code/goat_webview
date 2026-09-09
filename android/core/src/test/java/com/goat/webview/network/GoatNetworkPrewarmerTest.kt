package com.goat.webview.network

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class GoatNetworkPrewarmerTest {

    @Test
    fun emptyHostListIsANoOp() = runTest {
        GoatNetworkPrewarmer.prewarmSuspending(emptyList())
    }

    @Test
    fun blankHostsAreSkippedWithoutCrashing() = runTest {
        GoatNetworkPrewarmer.prewarmSuspending(listOf("", "   ", "https://", "http://"))
    }

    @Test
    fun malformedHostsFailSoft() = runTest {
        GoatNetworkPrewarmer.prewarmSuspending(listOf("invalid..host", "https://%%%", "not a host"))
    }

    @Test
    fun retryScheduleIsBoundedAndBacksOff() {
        val delays = GoatNetworkPrewarmer.RETRY_DELAYS_MS
        // Bounded: the point of a fixed array is that this can never become a background poller.
        // The sweep's constraint is explicitly "zero periodic timers/polling/tickers".
        assertTrue("retry schedule must be finite and short", delays.size in 1..5)
        assertTrue("first backoff must be non-trivial", delays.first() >= 500)
        for (i in 1 until delays.size) {
            assertTrue(
                "backoff must increase: ${delays.toList()}",
                delays[i] > delays[i - 1]
            )
        }
    }

    @Test
    fun malformedHostsStillTerminateDespiteRetries() = runTest {
        // Exercises the retry path: each of these fails resolution every attempt, so this only
        // returns if the loop is genuinely bounded.
        GoatNetworkPrewarmer.prewarmSuspending(listOf("invalid..host", "also..bad"))
    }

    @Test
    fun hostParsingStripsSchemePathAndPort() {
        assertEquals("api.example.com", GoatNetworkPrewarmer.normalizeHost("https://api.example.com/path"))
        assertEquals("localhost", GoatNetworkPrewarmer.normalizeHost("http://localhost:3001/api"))
        assertEquals("api.example.com", GoatNetworkPrewarmer.normalizeHost("api.example.com:443"))
        assertEquals("api.example.com", GoatNetworkPrewarmer.normalizeHost("  api.example.com  "))
        assertEquals("api.example.com", GoatNetworkPrewarmer.normalizeHost("api.example.com"))
    }

    @Test
    fun hostParsingYieldsBlankForSchemeOnlyInput() {
        assertEquals("", GoatNetworkPrewarmer.normalizeHost("https://"))
        assertEquals("", GoatNetworkPrewarmer.normalizeHost("http://"))
        assertEquals("", GoatNetworkPrewarmer.normalizeHost("   "))
        assertEquals("", GoatNetworkPrewarmer.normalizeHost(""))
    }
}
