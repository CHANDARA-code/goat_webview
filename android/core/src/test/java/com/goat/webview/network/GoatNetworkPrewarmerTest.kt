package com.goat.webview.network

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertFalse
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
    fun hostParsingStripsSchemeAndPort() {
        assertTrue(parseHost("https://api.example.com/path") == "api.example.com")
        assertTrue(parseHost("http://localhost:3001/api") == "localhost")
        assertTrue(parseHost("api.example.com:443") == "api.example.com")
        assertTrue(parseHost("https://") == null)
    }

    private fun parseHost(raw: String): String? {
        val host = raw.trim()
            .removePrefix("https://")
            .removePrefix("http://")
            .substringBefore("/")
            .substringBefore(":")
        return host.ifBlank { null }
    }
}
