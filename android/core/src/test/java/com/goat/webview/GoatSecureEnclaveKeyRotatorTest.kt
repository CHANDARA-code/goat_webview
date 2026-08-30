package com.goat.webview

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import java.security.KeyStore

class GoatSecureEnclaveKeyRotatorTest {

    private lateinit var keyRotator: GoatSecureEnclaveKeyRotator

    @Before
    fun setUp() {
        keyRotator = GoatSecureEnclaveKeyRotator()
    }

    @Test
    fun testKeyRotationAndVersionIndexing() {
        val v1 = keyRotator.rotateKey("tenant_finance")
        assertEquals(1, v1)
        val k1 = keyRotator.getKey("tenant_finance", 1)
        assertNotNull(k1)

        val v2 = keyRotator.rotateKey("tenant_finance")
        assertEquals(2, v2)
        val k2 = keyRotator.getKey("tenant_finance", 2)
        assertNotNull(k2)

        // Ensure older version remains available in KeyStore for reading historical data
        val historicalK1 = keyRotator.getKey("tenant_finance", 1)
        assertNotNull(historicalK1)
        assertEquals(k1?.algorithm, historicalK1?.algorithm)
        assertEquals(k1?.format, historicalK1?.format)

        keyRotator.purgeTenantKeys("tenant_finance")
        assertEquals(0, keyRotator.getActiveKeyVersion("tenant_finance"))
        assertNull(keyRotator.getKey("tenant_finance"))
    }

    @Test
    fun testExplicitRejectionWhenHardwareEnclaveIsUnavailable() {
        // Enforce strict hardware-backed AndroidKeyStore in non-Android JVM test environment
        val strictHardwareRotator = GoatSecureEnclaveKeyRotator(
            keyStoreProvider = GoatSecureEnclaveKeyRotator.ANDROID_KEYSTORE,
            customKeyStore = null,
            requireHardwareBacked = true
        )

        assertFalse("Hardware KeyStore should report false in standard non-Android JVM", strictHardwareRotator.isHardwareBacked())

        try {
            strictHardwareRotator.rotateKey("tenant_unsupported")
            fail("Expected GoatBridgeException with UNSUPPORTED_ON_DEVICE")
        } catch (e: GoatBridgeException) {
            assertEquals("UNSUPPORTED_ON_DEVICE", e.code)
            assertTrue(e.message?.contains("unavailable") == true)
        }

        val result = strictHardwareRotator.rotateKeyResult("tenant_unsupported")
        assertTrue(result.isFailure)
        val exception = result.exceptionOrNull()
        assertTrue(exception is GoatBridgeException)
        assertEquals("UNSUPPORTED_ON_DEVICE", (exception as GoatBridgeException).code)
    }

    @Test
    fun testMultiTenantKeyIsolation() {
        val vA = keyRotator.rotateKey("tenant_alpha")
        val vB = keyRotator.rotateKey("tenant_beta")

        assertEquals(1, vA)
        assertEquals(1, vB)

        val keyA = keyRotator.getKey("tenant_alpha")
        val keyB = keyRotator.getKey("tenant_beta")

        assertNotNull(keyA)
        assertNotNull(keyB)

        keyRotator.purgeTenantKeys("tenant_alpha")
        assertNull(keyRotator.getKey("tenant_alpha"))
        assertNotNull(keyRotator.getKey("tenant_beta"))
    }
}
