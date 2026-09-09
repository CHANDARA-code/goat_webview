package com.goat.webview

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class GoatApiRequestAllowlistTest {

    private val handler = GoatBridgeActionHandler(
        context = FakeTestContext(),
        appId = "com.goat.test",
        autoRegisterPlugins = false,
        autoRegisterPayments = false
    )

    private val allowlist = setOf("api.example.com", "*.cdn.example.com")

    /**
     * True when the host cleared the DOMAIN_NOT_ALLOWED gate. Reaching DNS_RESOLUTION_FAILED counts
     * as passing: the allowlist is checked at step 2 and DNS at step 3, and these hosts do not
     * resolve on a build machine.
     */
    private fun allowed(url: String): Boolean = try {
        handler.validateAndFilterUrl(url, allowlist)
        true
    } catch (e: SecurityException) {
        val message = e.message.orEmpty()
        when {
            message.startsWith("DOMAIN_NOT_ALLOWED") -> false
            message.startsWith("DNS_RESOLUTION_FAILED") -> true
            else -> throw e
        }
    }

    @Test
    fun `an exact host in the allowlist passes the domain check`() {
        assertTrue(allowed("https://api.example.com/v1/items"))
    }

    @Test
    fun `an unlisted host is rejected`() {
        assertEquals(false, allowed("https://evil.example.com/steal"))
        assertEquals(false, allowed("https://attacker.com/"))
    }

    @Test
    fun `a wildcard matches the base domain and its subdomains`() {
        assertTrue(allowed("https://cdn.example.com/a.png"))
        assertTrue(allowed("https://images.cdn.example.com/a.png"))
    }

    @Test
    fun `a wildcard does not match a suffix impostor`() {
        assertEquals(false, allowed("https://evilcdn.example.com/a.png"))
        assertEquals(false, allowed("https://cdn.example.com.evil.com/a.png"))
    }

    @Test
    fun `an exact pattern does not match subdomains`() {
        assertEquals(false, allowed("https://sub.api.example.com/v1"))
    }

    @Test
    fun `an empty or null allowlist leaves the host unfiltered`() {
        for (list in listOf(null, emptySet<String>())) {
            val rejected = try {
                handler.validateAndFilterUrl("https://anything.example.com/x", list)
                false
            } catch (e: SecurityException) {
                e.message?.startsWith("DOMAIN_NOT_ALLOWED") == true
            }
            assertEquals("an unset allowlist must not filter by domain", false, rejected)
        }
    }

    @Test
    fun `cleartext is still blocked regardless of the allowlist`() {
        val e = assertThrows(SecurityException::class.java) {
            handler.validateAndFilterUrl("http://api.example.com/v1", allowlist)
        }
        assertTrue(e.message!!.startsWith("CLEARTEXT_BLOCKED"))
    }
}
