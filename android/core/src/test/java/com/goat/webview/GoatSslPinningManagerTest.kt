package com.goat.webview

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GoatSslPinningManagerTest {

    private lateinit var sslManager: GoatSslPinningManager

    @Before
    fun setUp() {
        sslManager = GoatSslPinningManager()
    }

    @Test
    fun testDefaultPinsAndVerification() = runTest {
        val validPin = "sha256/WoiWRyIOVNa9ihaBciRSC7XHjliYS9VwUGOIud4PB18="
        val auditValid = sslManager.verifyPin("appassets.androidplatform.net", validPin)
        assertTrue(auditValid.isPinned)
        assertTrue(auditValid.isCertificateValid)
        assertEquals("SECURE", auditValid.auditStatus)
        assertEquals(validPin, auditValid.matchedPin)

        // Invalid pin mismatch
        val invalidPin = "sha256/INVALID_MITM_ATTACK_KEY_HASH_VALUE_HERE="
        val auditInvalid = sslManager.verifyPin("appassets.androidplatform.net", invalidPin)
        assertTrue(auditInvalid.isPinned)
        assertFalse(auditInvalid.isCertificateValid)
        assertEquals("PIN_MISMATCH", auditInvalid.auditStatus)
        assertNull(auditInvalid.matchedPin)
    }

    @Test
    fun testUnpinnedHostAndDynamicPinRegistration() = runTest {
        val auditUnpinned = sslManager.verifyPin("unpinned-host.example.com", "sha256/any_key")
        assertFalse(auditUnpinned.isPinned)
        assertEquals("UNPINNED", auditUnpinned.auditStatus)

        // Register dynamic pin
        val customPin = "sha256/custom_enterprise_pin_hash="
        sslManager.addPin("custom-host.enterprise.com", customPin)

        val auditPinned = sslManager.verifyPin("custom-host.enterprise.com", customPin)
        assertTrue(auditPinned.isPinned)
        assertTrue(auditPinned.isCertificateValid)
        assertEquals("SECURE", auditPinned.auditStatus)
    }

    @Test
    fun testNetworkSecurityUrlAudit() = runTest {
        val audit = sslManager.auditNetworkSecurity("https://api.goat.io/v1/auth/tokens")
        assertTrue(audit.isPinned)
        assertTrue(audit.isCertificateValid)
        assertEquals("SECURE", audit.auditStatus)
    }
}
