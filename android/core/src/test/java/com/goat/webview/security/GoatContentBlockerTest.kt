package com.goat.webview.security

import android.net.Uri
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GoatContentBlockerTest {

    @Test
    fun testEnsureAllowedDomainBypassesBlocker() {
        // [Task 10205] Ensure a specific allowed domain in the JSON rule list successfully bypasses the blocker in an automated test.
        val allowedDomains = setOf("api.example.com", "*.allowed.org")
        val blocker = GoatContentBlocker.compile(allowedDomains)
        
        // Allowed domains should bypass
        assertTrue(blocker.isUriAllowed(Uri.parse("https://api.example.com/data")))
        assertTrue(blocker.isUriAllowed(Uri.parse("https://sub.allowed.org/data")))
        
        // Blocked domains should not bypass
        assertFalse(blocker.isUriAllowed(Uri.parse("https://malicious.com/data")))
    }
}
