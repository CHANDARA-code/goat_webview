package com.example.miniappwebview.security

import com.goat.webview.GoatSecurityManager
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.security.KeyPairGenerator
import java.security.spec.ECGenParameterSpec

class ShowcaseSecurityTest {

    @Test
    fun `test ECDSA digital signature generation and verification`() {
        val keyPairGen = KeyPairGenerator.getInstance("EC")
        keyPairGen.initialize(ECGenParameterSpec("secp256r1"))
        val keyPair = keyPairGen.generateKeyPair()

        val sampleData = "Goat-MiniApp-Asset-Bundle-V1.0-Payload".toByteArray(Charsets.UTF_8)
        val signature = GoatSecurityManager.signBytes(sampleData, keyPair.private)

        val isValid = GoatSecurityManager.verifyBytesSignature(
            data = sampleData,
            signatureBytes = signature,
            publicKey = keyPair.public
        )
        assertTrue("Valid signature must pass verification", isValid)

        val tamperedData = "Goat-MiniApp-Asset-Bundle-V1.0-Tampered".toByteArray(Charsets.UTF_8)
        val isTamperedValid = GoatSecurityManager.verifyBytesSignature(
            data = tamperedData,
            signatureBytes = signature,
            publicKey = keyPair.public
        )
        assertFalse("Tampered data must fail signature verification", isTamperedValid)
    }

    @Test
    fun `test stream digital signature verification`() {
        val keyPairGen = KeyPairGenerator.getInstance("EC")
        keyPairGen.initialize(ECGenParameterSpec("secp256r1"))
        val keyPair = keyPairGen.generateKeyPair()

        val payload = "Streamed-Archive-Content-SHA256".toByteArray(Charsets.UTF_8)
        val signature = GoatSecurityManager.signStream(ByteArrayInputStream(payload), keyPair.private)

        val isValid = GoatSecurityManager.verifyStreamSignature(
            inputStream = ByteArrayInputStream(payload),
            signatureBytes = signature,
            publicKey = keyPair.public
        )
        assertTrue("Valid stream signature must pass verification", isValid)
    }
}
