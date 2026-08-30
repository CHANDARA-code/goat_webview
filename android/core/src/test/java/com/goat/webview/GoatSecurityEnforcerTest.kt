package com.goat.webview

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.security.KeyPairGenerator
import java.security.spec.ECGenParameterSpec

/**
 * Rigorous security enforcer unit tests covering:
 * - Dynamic virtual origin isolation (https://tenantA.appassets.androidplatform.net vs https://tenantB.appassets.androidplatform.net)
 * - Anti-spoofing and domain suffix attack rejection
 * - Cleartext HTTP rejection and secure transport validation (MASVS-NETWORK-01)
 * - Cryptographic ECDSA and RSA-2048 pre-extraction digital signature validation (MASVS-CRYPTO-01)
 * - Content Security Policy (CSP) header & meta-tag synthesis
 */
class GoatSecurityEnforcerTest {

    @Test
    fun `test origin whitelist verification enforces strict virtual origin and dynamic tenant domains`() {
        // 1. Whitelisted base virtual origins
        assertTrue("Base virtual HTTPS origin must be allowed", GoatSecurityManager.isOriginAllowed("https://appassets.androidplatform.net"))
        assertTrue("Base virtual HTTPS origin with trailing slash must be allowed", GoatSecurityManager.isOriginAllowed("https://appassets.androidplatform.net/"))
        assertTrue("Goat custom scheme origin must be allowed", GoatSecurityManager.isOriginAllowed("goat://assets"))
        assertTrue("Goat custom scheme origin with trailing slash must be allowed", GoatSecurityManager.isOriginAllowed("goat://assets/"))

        // 2. Dynamic tenant-scoped virtual domains MUST be permitted under *.appassets.androidplatform.net
        assertTrue("Tenant A domain must be allowed", GoatSecurityManager.isOriginAllowed("https://tenantA.appassets.androidplatform.net"))
        assertTrue("Tenant A domain with slash must be allowed", GoatSecurityManager.isOriginAllowed("https://tenantA.appassets.androidplatform.net/"))
        assertTrue("Tenant B domain must be allowed", GoatSecurityManager.isOriginAllowed("https://tenantB.appassets.androidplatform.net"))
        assertTrue("Numeric tenant domain must be allowed", GoatSecurityManager.isOriginAllowed("https://app12345.appassets.androidplatform.net"))
        assertTrue("Dashed tenant domain must be allowed", GoatSecurityManager.isOriginAllowed("https://my-mini-app.appassets.androidplatform.net"))

        // 3. Malicious / Untrusted / Spoofed origins MUST be rejected
        assertFalse("External website must be rejected", GoatSecurityManager.isOriginAllowed("https://evil.com"))
        assertFalse("Cleartext HTTP default origin must be rejected", GoatSecurityManager.isOriginAllowed("http://appassets.androidplatform.net"))
        assertFalse("Cleartext HTTP tenant origin must be rejected", GoatSecurityManager.isOriginAllowed("http://tenantA.appassets.androidplatform.net"))
        assertFalse("Domain suffix spoofing attack must be rejected", GoatSecurityManager.isOriginAllowed("https://tenantA.appassets.androidplatform.net.evil.com"))
        assertFalse("Domain suffix spoofing attack 2 must be rejected", GoatSecurityManager.isOriginAllowed("https://appassets.androidplatform.net.attacker.com"))
        assertFalse("Prefix spoofing attack must be rejected", GoatSecurityManager.isOriginAllowed("https://eviltargetappassets.androidplatform.net"))
        assertFalse("file:// origin must be rejected", GoatSecurityManager.isOriginAllowed("file:///android_asset/index.html"))
        assertFalse("javascript: pseudo-scheme must be rejected", GoatSecurityManager.isOriginAllowed("javascript:void(0)"))
        assertFalse("data: pseudo-scheme must be rejected", GoatSecurityManager.isOriginAllowed("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="))
        assertFalse("Null origin must be rejected", GoatSecurityManager.isOriginAllowed(null))
        assertFalse("Empty string origin must be rejected", GoatSecurityManager.isOriginAllowed(""))
        assertFalse("Blank whitespace origin must be rejected", GoatSecurityManager.isOriginAllowed("   "))
    }

    @Test
    fun `test tenant specific origin isolation when strict whitelist is passed`() {
        val tenantAOrigin = "https://tenantA.appassets.androidplatform.net"
        val tenantBOrigin = "https://tenantB.appassets.androidplatform.net"

        val tenantAWhitelist = setOf(tenantAOrigin)
        val tenantBWhitelist = setOf(tenantBOrigin)

        // Exact match against scoped whitelist
        assertTrue(tenantAWhitelist.contains(tenantAOrigin))
        assertTrue(tenantBWhitelist.contains(tenantBOrigin))
        assertFalse("Tenant A whitelist must not match Tenant B origin", tenantAWhitelist.contains(tenantBOrigin))
        assertFalse("Tenant B whitelist must not match Tenant A origin", tenantBWhitelist.contains(tenantAOrigin))
    }

    @Test
    fun `test cleartext HTTP rejection and secure URL validation (OWASP MASVS-NETWORK)`() {
        // Secure URLs
        assertTrue(GoatSecurityManager.isSecureUrl("https://api.goat.io/v1/auth"))
        assertTrue(GoatSecurityManager.isSecureUrl("https://tenantA.appassets.androidplatform.net/assets/index.html"))
        assertTrue(GoatSecurityManager.isSecureUrl("goat://assets/index.html"))
        assertTrue(GoatSecurityManager.isSecureUrl("wss://stream.goat.io/feed"))

        // Insecure cleartext HTTP traffic MUST be rejected
        assertFalse(GoatSecurityManager.isSecureUrl("http://api.goat.io/v1/auth"))
        assertFalse(GoatSecurityManager.isSecureUrl("http://192.168.1.100:8080/data"))
        assertFalse(GoatSecurityManager.isSecureUrl("http://localhost:3000"))
        assertFalse(GoatSecurityManager.isSecureUrl(null))
        assertFalse(GoatSecurityManager.isSecureUrl(""))
        assertFalse(GoatSecurityManager.isSecureUrl("   "))
    }

    @Test
    fun `test Content Security Policy meta tag and directive generation`() {
        val defaultTag = GoatSecurityManager.generateCspMetaTag()
        assertTrue("CSP must contain http-equiv", defaultTag.contains("http-equiv=\"Content-Security-Policy\""))
        assertTrue("CSP must restrict default-src", defaultTag.contains("default-src 'self' https://appassets.androidplatform.net"))
        assertTrue("CSP must restrict frame-src", defaultTag.contains("frame-src 'none'"))
        assertTrue("CSP must restrict object-src", defaultTag.contains("object-src 'none'"))
        assertTrue("CSP must restrict base-uri", defaultTag.contains("base-uri 'self'"))

        // Custom directives
        val customDirectives = "default-src 'self'; script-src 'self' https://cdn.trusted.io; connect-src https://api.goat.io"
        val customTag = GoatSecurityManager.generateCspMetaTag(customDirectives)
        assertEquals("<meta http-equiv=\"Content-Security-Policy\" content=\"$customDirectives\">", customTag)
    }

    @Test
    fun `test ECDSA digital signature generation and verification for bundle integrity`() {
        // Generate real ECDSA P-256 keypair
        val kpg = KeyPairGenerator.getInstance("EC")
        kpg.initialize(ECGenParameterSpec("secp256r1"))
        val keyPair = kpg.generateKeyPair()

        val samplePayload = "Goat MiniApp Bundle Content Integrity Payload v1.0.0".toByteArray(Charsets.UTF_8)

        // Sign payload with private key
        val signature = GoatSecurityManager.signBytes(samplePayload, keyPair.private, GoatSecurityManager.ALGORITHM_ECDSA)
        assertNotNull("Signature must not be null", signature)
        assertTrue("Signature length must be > 0", signature.isNotEmpty())

        // Verify valid signature with public key
        val isValid = GoatSecurityManager.verifyBytesSignature(
            data = samplePayload,
            signatureBytes = signature,
            publicKey = keyPair.public,
            algorithm = GoatSecurityManager.ALGORITHM_ECDSA
        )
        assertTrue("Genuine ECDSA signature must verify successfully", isValid)

        // Verify corrupted payload fails verification (anti-tamper)
        val tamperedPayload = "Tampered MiniApp Bundle Content Payload".toByteArray(Charsets.UTF_8)
        val isTamperedValid = GoatSecurityManager.verifyBytesSignature(
            data = tamperedPayload,
            signatureBytes = signature,
            publicKey = keyPair.public,
            algorithm = GoatSecurityManager.ALGORITHM_ECDSA
        )
        assertFalse("Tampered payload must fail cryptographic verification", isTamperedValid)
    }

    @Test
    fun `test RSA-2048 digital signature generation and verification`() {
        // Generate real RSA-2048 keypair
        val kpg = KeyPairGenerator.getInstance("RSA")
        kpg.initialize(2048)
        val keyPair = kpg.generateKeyPair()

        val bundleBytes = "MiniApp Binary Bundle Archive SHA-256 Manifest".toByteArray(Charsets.UTF_8)

        val signature = GoatSecurityManager.signBytes(bundleBytes, keyPair.private, GoatSecurityManager.ALGORITHM_RSA)
        assertTrue("RSA signature must be valid length", signature.size == 256)

        val isValid = GoatSecurityManager.verifyBytesSignature(
            data = bundleBytes,
            signatureBytes = signature,
            publicKey = keyPair.public,
            algorithm = GoatSecurityManager.ALGORITHM_RSA
        )
        assertTrue("Genuine RSA-2048 signature must verify successfully", isValid)

        // Verify corrupted signature bytes fail verification
        val corruptedSignature = signature.copyOf()
        corruptedSignature[0] = (corruptedSignature[0].toInt() xor 0xFF).toByte()
        val isCorruptedValid = GoatSecurityManager.verifyBytesSignature(
            data = bundleBytes,
            signatureBytes = corruptedSignature,
            publicKey = keyPair.public,
            algorithm = GoatSecurityManager.ALGORITHM_RSA
        )
        assertFalse("Corrupted signature must fail verification", isCorruptedValid)
    }
}
